import {
  Algorithm,
  hash as argon2Hash,
  verify as argon2Verify,
} from "@node-rs/argon2";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Cryptographic helpers.
 *
 * Passwords use Argon2id with the OWASP-recommended baseline parameters.
 * Session and CSRF tokens are opaque random values; only keyed digests of
 * them are persisted.
 */

export const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

/** Hashes a password with Argon2id. */
export async function hashPassword(password: string): Promise<string> {
  return argon2Hash(password, ARGON2_OPTIONS);
}

/**
 * Verifies a password against an Argon2id hash.
 *
 * Returns false instead of throwing when the stored hash is malformed, so a
 * corrupted record can never crash an authentication path.
 */
export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2Verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * A throwaway Argon2id hash used to spend the same amount of CPU time on a
 * login attempt for an unknown account as for a known one. Without it the
 * response time would disclose whether an account exists.
 */
export function getDummyPasswordHash(): Promise<string> {
  dummyHash ??= argon2Hash(randomBytes(32).toString("hex"), ARGON2_OPTIONS);

  return dummyHash;
}

/** Generates a cryptographically secure, URL-safe random token. */
export function generateToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

/** SHA-256 digest of a string, hex encoded. */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Keyed HMAC-SHA-256 of a string, hex encoded. */
export function hmacSha256Hex(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value, "utf8").digest("hex");
}

/**
 * Constant-time comparison of two hex strings of equal length.
 *
 * Returns false for mismatched lengths without leaking their contents.
 */
export function constantTimeEqualHex(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}
