import type { Prisma, UserRole } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { getConfig } from "../config/env.js";
import {
  constantTimeEqualHex,
  generateToken,
  hmacSha256Hex,
  sha256Hex,
} from "../utils/crypto.js";
import { normaliseUserAgent } from "../utils/userAgent.js";

/**
 * Database-backed, opaque session management.
 *
 * A session cookie carries a high-entropy random token. Only a keyed digest
 * of that token is stored, so a database leak does not expose usable
 * credentials.
 */

export type SessionDb = Pick<
  Prisma.TransactionClient,
  "authSession" | "user" | "profile"
>;

export interface SessionSnapshot {
  id: string;
  userId: string;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  userAgent: string | null;
}

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  deletedAt: Date | null;
}

export interface AuthContext {
  user: SessionUser;
  session: SessionSnapshot;
  /** Raw session token. Server-side only; never serialised to a client. */
  rawToken: string;
  /** Stored digest of the session's CSRF token. Never serialised to a client. */
  csrfTokenDigest: string;
}

export interface CreatedSession {
  session: SessionSnapshot;
  rawToken: string;
  csrfToken: string;
}

/** Keyed digest of a raw session token. This is what the database stores. */
export function hashSessionToken(rawToken: string): string {
  return hmacSha256Hex(getConfig().sessionSecret, rawToken);
}

/**
 * Derives the CSRF token for a session.
 *
 * The token is a deterministic HMAC over the raw session token, so it can be
 * reproduced after a page reload without the raw token ever being stored.
 */
export function deriveCsrfToken(rawToken: string): string {
  return hmacSha256Hex(getConfig().csrfSecret, rawToken);
}

/** Digest of a CSRF token. This is what the database stores. */
export function hashCsrfToken(csrfToken: string): string {
  return sha256Hex(csrfToken);
}

/**
 * Verifies a client-supplied CSRF token against the session it belongs to.
 *
 * Both the derived token and its stored digest are checked, so a token is
 * only accepted for the session that produced it.
 */
export function verifyCsrfToken(
  csrfTokenDigest: string,
  rawToken: string,
  providedToken: string,
): boolean {
  const derived = deriveCsrfToken(rawToken);
  const derivedDigest = hashCsrfToken(derived);

  if (!constantTimeEqualHex(derivedDigest, csrfTokenDigest)) {
    return false;
  }

  return constantTimeEqualHex(providedToken, derived);
}

export interface CreateSessionOptions {
  userId: string;
  userAgent?: string | null | undefined;
  db?: SessionDb;
}

/** Creates a new independent session for a user. */
export async function createSession(
  options: CreateSessionOptions,
): Promise<CreatedSession> {
  const db = options.db ?? prisma;
  const config = getConfig();

  const rawToken = generateToken(32);
  const csrfToken = deriveCsrfToken(rawToken);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.session.ttlMs);

  const session = await db.authSession.create({
    data: {
      userId: options.userId,
      tokenDigest: hashSessionToken(rawToken),
      csrfTokenDigest: hashCsrfToken(csrfToken),
      userAgent: normaliseUserAgent(options.userAgent),
      createdAt: now,
      lastActivityAt: now,
      expiresAt,
    },
    select: {
      id: true,
      userId: true,
      createdAt: true,
      lastActivityAt: true,
      expiresAt: true,
      revokedAt: true,
      userAgent: true,
    },
  });

  return { session, rawToken, csrfToken };
}

/**
 * Resolves a raw session token into an authentication context.
 *
 * Returns null for unknown, revoked, expired and ineligible accounts.
 */
export async function resolveSession(
  rawToken: string,
): Promise<AuthContext | null> {
  if (!rawToken) return null;

  const session = await prisma.authSession.findUnique({
    where: { tokenDigest: hashSessionToken(rawToken) },
    select: {
      id: true,
      userId: true,
      csrfTokenDigest: true,
      createdAt: true,
      lastActivityAt: true,
      expiresAt: true,
      revokedAt: true,
      userAgent: true,
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!session) return null;

  const now = Date.now();

  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= now) return null;
  if (!session.user.isActive) return null;
  if (session.user.deletedAt) return null;

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
      isActive: session.user.isActive,
      deletedAt: session.user.deletedAt,
    },
    session: {
      id: session.id,
      userId: session.userId,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
      userAgent: session.userAgent,
    },
    rawToken,
    csrfTokenDigest: session.csrfTokenDigest,
  };
}

export type TouchSessionStatus = "not_due" | "refreshed" | "stale" | "invalid";

export interface TouchSessionResult {
  status: TouchSessionStatus;
}

/**
 * Refreshes the activity timestamp and sliding expiry of a session.
 *
 * Writes are throttled to at most one per session every five minutes. The
 * update is an atomic compare-and-swap enforcing that the session is still
 * unrevoked and unexpired.
 *
 * Returns a discriminated result:
 * - "refreshed": update was committed; caller should refresh the cookie.
 * - "not_due": within throttle interval; no update required.
 * - "stale": another concurrent request won the CAS; session remains valid.
 * - "invalid": session was revoked or expired concurrently; reject request.
 */
export async function touchSession(
  session: SessionSnapshot,
  now = new Date(),
): Promise<TouchSessionResult> {
  const config = getConfig();

  const elapsed = now.getTime() - session.lastActivityAt.getTime();

  if (elapsed < config.session.activityRefreshMs) {
    return { status: "not_due" };
  }

  const expiresAt = new Date(now.getTime() + config.session.ttlMs);

  const updatedCount = await prisma.$transaction(async (tx) => {
    const updated = await tx.authSession.updateMany({
      where: {
        id: session.id,
        lastActivityAt: session.lastActivityAt,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { lastActivityAt: now, expiresAt },
    });

    if (updated.count > 0) {
      await tx.user.updateMany({
        where: { id: session.userId },
        data: { lastActivityAt: now },
      });
    }

    return updated.count;
  });

  if (updatedCount > 0) {
    return { status: "refreshed" };
  }

  // updateMany matched 0 rows. Disambiguate whether another concurrent
  // request won the CAS (stale) or if the session is revoked/expired (invalid).
  const current = await prisma.authSession.findUnique({
    where: { id: session.id },
    select: { revokedAt: true, expiresAt: true },
  });

  if (!current || current.revokedAt !== null || current.expiresAt.getTime() <= now.getTime()) {
    return { status: "invalid" };
  }

  return { status: "stale" };
}

/** Revokes a single session. */
export async function revokeSessionById(
  sessionId: string,
  db: SessionDb = prisma,
): Promise<void> {
  await db.authSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Revokes every active session of a user.
 *
 * `exceptSessionId` keeps a single session alive, used when a password
 * change preserves the caller's own session.
 */
export async function revokeUserSessions(
  userId: string,
  options: { exceptSessionId?: string; db?: SessionDb } = {},
): Promise<number> {
  const db = options.db ?? prisma;

  const result = await db.authSession.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(options.exceptSessionId ? { id: { not: options.exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });

  return result.count;
}

/** Lists the active sessions of a user, newest activity first. */
export async function listActiveSessions(userId: string): Promise<SessionSnapshot[]> {
  const now = new Date();

  const sessions = await prisma.authSession.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: [{ lastActivityAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      userId: true,
      createdAt: true,
      lastActivityAt: true,
      expiresAt: true,
      revokedAt: true,
      userAgent: true,
    },
  });

  return sessions;
}

/** Counts the active sessions of a user. */
export async function countActiveSessions(userId: string): Promise<number> {
  const now = new Date();

  return prisma.authSession.count({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: now },
    },
  });
}
