import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";

/**
 * Security audit logging.
 *
 * `SecurityAuditLog` is deliberately separate from `AdminActivityLog`:
 * this table records *security and account* events, while
 * `AdminActivityLog` records administrative actions on domain resources.
 *
 * Records are append-only in the database. Metadata is sanitised before it
 * is written so that no credential material can ever reach the table.
 */

export const SecurityEventType = {
  USER_REGISTERED: "USER_REGISTERED",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",
  LOGIN_FAILED: "LOGIN_FAILED",
  SESSION_REVOKED: "SESSION_REVOKED",
  LOGOUT_ALL: "LOGOUT_ALL",
  USER_SUSPENDED: "USER_SUSPENDED",
  USER_REACTIVATED: "USER_REACTIVATED",
  SUSPICIOUS_ACTIVITY: "SUSPICIOUS_ACTIVITY",
  ADMIN_BOOTSTRAPPED: "ADMIN_BOOTSTRAPPED",
} as const;

export type SecurityEventTypeValue =
  (typeof SecurityEventType)[keyof typeof SecurityEventType];

/**
 * Metadata keys whose values must never be persisted. The pattern covers
 * passwords, password hashes, session tokens, token digests, CSRF tokens and
 * any other secret.
 */
const FORBIDDEN_METADATA_KEY =
  /(password|passphrase|token|secret|credential|digest|cookie|authorization|sessionvalue)/i;

const MAX_STRING_LENGTH = 512;
const MAX_ARRAY_ITEMS = 50;
const MAX_OBJECT_KEYS = 50;

export type SafeMetadataValue = string | number | boolean | null;
export type SafeMetadata = Record<string, SafeMetadataValue | SafeMetadataValue[]>;

function sanitiseValue(value: unknown, depth: number): SafeMetadataValue | SafeMetadataValue[] | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH ? value.slice(0, MAX_STRING_LENGTH) : value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    if (depth >= 2) return [];

    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((entry) => sanitiseValue(entry, depth + 1))
      .filter((entry): entry is SafeMetadataValue => entry !== null || true);
  }

  return null;
}

/**
 * Removes anything that could carry sensitive authentication material.
 *
 * Only primitive values survive; nested objects are dropped and forbidden
 * keys are removed entirely.
 */
export function sanitizeMetadata(metadata: Record<string, unknown> | undefined): SafeMetadata {
  if (!metadata) return {};

  const result: SafeMetadata = {};
  let included = 0;

  for (const [key, value] of Object.entries(metadata)) {
    if (included >= MAX_OBJECT_KEYS) break;

    if (FORBIDDEN_METADATA_KEY.test(key)) continue;

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      continue;
    }

    const sanitised = sanitiseValue(value, 0);

    if (sanitised === null && value !== null) continue;

    result[key] = sanitised;
    included += 1;
  }

  return result;
}

/** A client that can write audit records. */
export type AuditDb = Pick<
  Prisma.TransactionClient,
  "securityAuditLog" | "user" | "authSession" | "profile"
>;

export interface SecurityEventInput {
  /** The user the event concerns. Null for events without a known subject. */
  userId?: string | null;
  /** The session involved in the event, when there is one. */
  sessionId?: string | null;
  eventType: SecurityEventTypeValue;
  metadata?: Record<string, unknown>;
}

/**
 * Appends a security audit record.
 *
 * When `db` is supplied the record is written inside the caller's
 * transaction, so an audit failure rolls back the operation it documents.
 */
export async function recordSecurityEvent(
  event: SecurityEventInput,
  db: AuditDb = prisma,
): Promise<void> {
  await db.securityAuditLog.create({
    data: {
      userId: event.userId ?? null,
      sessionId: event.sessionId ?? null,
      eventType: event.eventType,
      metadata: sanitizeMetadata(event.metadata),
    },
  });
}
