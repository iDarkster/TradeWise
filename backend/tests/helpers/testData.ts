import { randomUUID } from "node:crypto";
import type { Response } from "supertest";
import request from "supertest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { hashPassword } from "../../src/utils/crypto.js";

/**
 * Shared helpers for the Module 1 integration tests.
 *
 * Every test creates its own isolated accounts and removes them afterwards.
 */

export const VALID_PASSWORD = "ValidPass1!";

export interface CreatedUser {
  id: string;
  email: string;
  username: string;
  password: string;
  role: "USER" | "ADMIN";
}

export interface CreateUserOptions {
  email?: string;
  username?: string;
  password?: string;
  role?: "USER" | "ADMIN";
  isActive?: boolean;
  deletedAt?: Date | null;
  fullName?: string;
}

/** Creates a user directly in the database, bypassing the public API. */
export async function createUserDirect(
  options: CreateUserOptions = {},
): Promise<CreatedUser> {
  // The database enforces canonical (lower case, trimmed) email storage.
  const email = (options.email ?? `m1-${randomUUID()}@tradewise.test`)
    .trim()
    .toLowerCase();
  const password = options.password ?? VALID_PASSWORD;
  const username =
    options.username ?? `m1_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: options.role ?? "USER",
      isActive: options.isActive ?? true,
      ...(options.deletedAt ? { deletedAt: options.deletedAt } : {}),
      profile: {
        create: {
          username,
          fullName: options.fullName ?? "Module One Tester",
        },
      },
    },
  });

  return { id: user.id, email, username, password, role: options.role ?? "USER" };
}

const createdUserIds = new Set<string>();

/** Tracks a user id so it can be removed when the suite finishes. */
export function trackUserId(userId: string): void {
  createdUserIds.add(userId);
}

/** Tracks a user so it can be removed when the suite finishes. */
export function trackUser(user: CreatedUser): CreatedUser {
  trackUserId(user.id);
  return user;
}

/** Removes every account created through `createUserDirect`/`trackUser`. */
export async function removeTrackedUsers(): Promise<void> {
  const ids = [...createdUserIds];
  createdUserIds.clear();

  if (ids.length === 0) return;

  await prisma.$executeRawUnsafe(
    'ALTER TABLE "SecurityAuditLog" DISABLE TRIGGER USER',
  );

  try {
    await prisma.securityAuditLog.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  } finally {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "SecurityAuditLog" ENABLE TRIGGER USER',
    );
  }
}

/** Removes rate-limit buckets so a test starts from a clean state. */
export async function clearRateLimits(): Promise<void> {
  await prisma.authRateLimit.deleteMany({});
}

/** Returns the full `Set-Cookie` header for the session cookie. */
export function rawSessionCookie(response: Response): string {
  const header = response.headers["set-cookie"];
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  const session = cookies.find((cookie) => cookie.startsWith("tw_session="));

  if (!session) {
    throw new Error("Response did not contain a session cookie.");
  }

  return session;
}

/** Extracts the session cookie value from a response. */
export function sessionCookie(response: Response): string {
  return rawSessionCookie(response).split(";")[0] ?? "";
}

export interface RegistrationPayload {
  email: string;
  password: string;
  username: string;
  fullName: string;
}

/** Builds a valid registration payload with unique values. */
export function registrationPayload(
  overrides: Partial<RegistrationPayload> = {},
): RegistrationPayload {
  const unique = randomUUID().replace(/-/g, "").slice(0, 12);

  return {
    email: `m1-${unique}@tradewise.test`,
    password: VALID_PASSWORD,
    username: `m1_${unique}`,
    fullName: "Module One Tester",
    ...overrides,
  };
}

/** Registers a learner through the public API. */
export async function registerViaApi(
  overrides: Partial<RegistrationPayload> = {},
): Promise<{ response: Response; body: RegistrationPayload }> {
  const payload = registrationPayload(overrides);

  const response = await request(app).post("/api/auth/register").send(payload);

  return { response, body: payload };
}

/** Logs in through the public API and returns the session cookie and CSRF token. */
export async function loginViaApi(
  identifier: string,
  password: string,
): Promise<{ response: Response; cookie: string; csrfToken: string }> {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ identifier, password });

  const cookie = sessionCookie(response);
  const csrfToken = (response.body?.data?.csrfToken ?? "") as string;

  return { response, cookie, csrfToken };
}

/** Performs an authenticated request with the given cookie and CSRF token. */
export function withSession(
  cookie: string,
  csrfToken?: string,
): request.Test {
  const test = request(app).set("Cookie", cookie);

  return csrfToken ? test.set("X-CSRF-Token", csrfToken) : test;
}
