import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { getConfig } from "../config/env.js";
import { hmacSha256Hex } from "../utils/crypto.js";

/**
 * PostgreSQL-backed authentication rate limiting.
 *
 * Every bucket is a row in `AuthRateLimit`. Identifiers are stored as keyed
 * HMAC digests, so neither raw email addresses nor raw IP addresses are
 * ever persisted. All updates happen inside a transaction that locks the
 * bucket row, which keeps the counters correct across concurrent backend
 * instances.
 *
 * The service fails closed: if the database operation cannot be performed,
 * the error propagates and the request is rejected instead of proceeding
 * without a limit.
 */

export const RateLimitScope = {
  LOGIN: "LOGIN",
  REGISTRATION: "REGISTRATION",
} as const;

export type RateLimitScopeValue =
  (typeof RateLimitScope)[keyof typeof RateLimitScope];

export const RateLimitIdentifierType = {
  ACCOUNT: "ACCOUNT",
  EMAIL: "EMAIL",
  IP: "IP",
} as const;

export type RateLimitIdentifierTypeValue =
  (typeof RateLimitIdentifierType)[keyof typeof RateLimitIdentifierType];

export interface RateLimitPolicy {
  /** Number of attempts allowed inside the window before the bucket blocks. */
  threshold: number;
  /** Length of the counting window in milliseconds. */
  windowMs: number;
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/** Login: five failures per account in fifteen minutes. */
export const LOGIN_ACCOUNT_POLICY: RateLimitPolicy = {
  threshold: 5,
  windowMs: FIFTEEN_MINUTES,
};

/** Login: twenty failures per IP address in fifteen minutes. */
export const LOGIN_IP_POLICY: RateLimitPolicy = {
  threshold: 20,
  windowMs: FIFTEEN_MINUTES,
};

/** Registration: five valid attempts per IP address in fifteen minutes. */
export const REGISTRATION_IP_POLICY: RateLimitPolicy = {
  threshold: 5,
  windowMs: FIFTEEN_MINUTES,
};

/** Registration: three valid attempts per email address in fifteen minutes. */
export const REGISTRATION_EMAIL_POLICY: RateLimitPolicy = {
  threshold: 3,
  windowMs: FIFTEEN_MINUTES,
};

/**
 * Maximum number of detailed failed-login audit records written per IP
 * address and counting window.
 *
 * Beyond this the rate-limit counters themselves act as the aggregate, so a
 * distributed guessing attack cannot flood the audit table. The counters
 * still track every attempt.
 */
export const FAILED_LOGIN_AUDIT_DETAIL_LIMIT = 5;

export interface BucketState {
  attemptCount: number;
  windowStartedAt: Date;
  blockedUntil: Date | null;
  expiresAt: Date;
}

interface BucketRow {
  attemptCount: number;
  windowStartedAt: Date;
  blockedUntil: Date | null;
  expiresAt: Date;
}

export type RateLimitDb = Prisma.TransactionClient;

/**
 * Keyed digest of a rate-limit identifier.
 *
 * The scope and identifier type are part of the HMAC input so the same value
 * produces a different digest in every bucket.
 */
export function hashIdentifier(
  scope: RateLimitScopeValue,
  identifierType: RateLimitIdentifierTypeValue,
  value: string,
): string {
  return hmacSha256Hex(
    getConfig().rateLimitSecret,
    `${scope}:${identifierType}:${value}`,
  );
}

async function loadBucket(
  db: RateLimitDb,
  scope: RateLimitScopeValue,
  identifierType: RateLimitIdentifierTypeValue,
  identifierHash: string,
): Promise<BucketRow | null> {
  const rows = await db.$queryRaw<BucketRow[]>(Prisma.sql`
    SELECT "attemptCount", "windowStartedAt", "blockedUntil", "expiresAt"
    FROM "AuthRateLimit"
    WHERE "scope" = ${scope}
      AND "identifierType" = ${identifierType}::"AuthRateLimitIdentifierType"
      AND "identifierHash" = ${identifierHash}
    FOR UPDATE
  `);

  return rows[0] ?? null;
}

async function ensureBucket(
  db: RateLimitDb,
  scope: RateLimitScopeValue,
  identifierType: RateLimitIdentifierTypeValue,
  identifierHash: string,
  windowMs: number,
): Promise<BucketRow | null> {
  const inserted = await db.$queryRaw<BucketRow[]>(Prisma.sql`
    INSERT INTO "AuthRateLimit" (
      "id", "scope", "identifierType", "identifierHash", "attemptCount",
      "windowStartedAt", "blockedUntil", "expiresAt", "createdAt", "updatedAt"
    )
    VALUES (
      gen_random_uuid()::uuid,
      ${scope},
      ${identifierType}::"AuthRateLimitIdentifierType",
      ${identifierHash},
      0,
      now(),
      NULL,
      now() + (${windowMs}::bigint * interval '1 millisecond'),
      now(),
      now()
    )
    ON CONFLICT ("scope", "identifierType", "identifierHash") DO NOTHING
    RETURNING "attemptCount", "windowStartedAt", "blockedUntil", "expiresAt"
  `);

  // A freshly inserted row is already locked by this transaction.
  if (inserted.length > 0) {
    return inserted[0] ?? null;
  }

  return loadBucket(db, scope, identifierType, identifierHash);
}

function nextState(
  row: BucketRow,
  policy: RateLimitPolicy,
  now: Date,
): BucketState {
  const blockedActive =
    row.blockedUntil !== null && row.blockedUntil.getTime() > now.getTime();

  if (blockedActive) {
    // The cooldown is fixed: further attempts neither extend it nor count.
    return {
      attemptCount: row.attemptCount,
      windowStartedAt: row.windowStartedAt,
      blockedUntil: row.blockedUntil,
      expiresAt: new Date(
        Math.max(row.expiresAt.getTime(), (row.blockedUntil ?? now).getTime()),
      ),
    };
  }

  const windowExpired = row.expiresAt.getTime() <= now.getTime();

  if (windowExpired) {
    const expiresAt = new Date(now.getTime() + policy.windowMs);

    return {
      attemptCount: 1,
      windowStartedAt: now,
      blockedUntil: null,
      expiresAt,
    };
  }

  const attemptCount = row.attemptCount + 1;
  const blockedUntil =
    attemptCount >= policy.threshold
      ? new Date(now.getTime() + policy.windowMs)
      : row.blockedUntil;

  const expiresAt = new Date(
    Math.max(
      row.expiresAt.getTime(),
      blockedUntil !== null ? blockedUntil.getTime() : 0,
    ),
  );

  return {
    attemptCount,
    windowStartedAt: row.windowStartedAt,
    blockedUntil,
    expiresAt,
  };
}

/**
 * Records an attempt against a bucket and returns the resulting state.
 *
 * The bucket row is locked for the duration of the transaction, so parallel
 * requests cannot lose an increment.
 */
export async function recordAttempt(
  scope: RateLimitScopeValue,
  identifierType: RateLimitIdentifierTypeValue,
  value: string,
  policy: RateLimitPolicy,
): Promise<BucketState> {
  const identifierHash = hashIdentifier(scope, identifierType, value);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const row = await ensureBucket(
      tx,
      scope,
      identifierType,
      identifierHash,
      policy.windowMs,
    );

    if (!row) {
      throw new Error("Rate-limit bucket could not be created.");
    }

    const state = nextState(row, policy, now);

    const blockedUntilSql =
      state.blockedUntil === null
        ? Prisma.sql`NULL::timestamptz`
        : Prisma.sql`${state.blockedUntil}::timestamptz`;

    await tx.$executeRaw(Prisma.sql`
      UPDATE "AuthRateLimit"
      SET "attemptCount" = ${state.attemptCount},
          "windowStartedAt" = ${state.windowStartedAt}::timestamptz,
          "blockedUntil" = ${blockedUntilSql},
          "expiresAt" = ${state.expiresAt}::timestamptz,
          "updatedAt" = ${now}::timestamptz
      WHERE "scope" = ${scope}
        AND "identifierType" = ${identifierType}::"AuthRateLimitIdentifierType"
        AND "identifierHash" = ${identifierHash}
    `);

    return state;
  });
}

/** Reads a bucket without modifying it. */
export async function readBucket(
  scope: RateLimitScopeValue,
  identifierType: RateLimitIdentifierTypeValue,
  value: string,
): Promise<BucketState | null> {
  const identifierHash = hashIdentifier(scope, identifierType, value);

  const rows = await prisma.$queryRaw<BucketRow[]>(Prisma.sql`
    SELECT "attemptCount", "windowStartedAt", "blockedUntil", "expiresAt"
    FROM "AuthRateLimit"
    WHERE "scope" = ${scope}
      AND "identifierType" = ${identifierType}::"AuthRateLimitIdentifierType"
      AND "identifierHash" = ${identifierHash}
  `);

  const row = rows[0];

  if (!row) return null;

  return {
    attemptCount: row.attemptCount,
    windowStartedAt: row.windowStartedAt,
    blockedUntil: row.blockedUntil,
    expiresAt: row.expiresAt,
  };
}

/** Reports whether a bucket is currently blocked. */
export async function isBlocked(
  scope: RateLimitScopeValue,
  identifierType: RateLimitIdentifierTypeValue,
  value: string,
): Promise<{ blocked: boolean; blockedUntil: Date | null }> {
  const state = await readBucket(scope, identifierType, value);

  if (!state || state.blockedUntil === null) {
    return { blocked: false, blockedUntil: null };
  }

  return {
    blocked: state.blockedUntil.getTime() > Date.now(),
    blockedUntil: state.blockedUntil,
  };
}

/**
 * Clears a bucket.
 *
 * Used when a successful login resets the account failure counter and when
 * a successful registration resets the email counter.
 */
export async function resetBucket(
  scope: RateLimitScopeValue,
  identifierType: RateLimitIdentifierTypeValue,
  value: string,
): Promise<void> {
  const identifierHash = hashIdentifier(scope, identifierType, value);

  await prisma.authRateLimit.deleteMany({
    where: {
      scope,
      identifierType,
      identifierHash,
    },
  });
}

/** Removes buckets whose state is no longer relevant. */
export async function cleanupExpiredRateLimits(now = new Date()): Promise<number> {
  const result = await prisma.authRateLimit.deleteMany({
    where: {
      expiresAt: { lte: now },
    },
  });

  return result.count;
}
