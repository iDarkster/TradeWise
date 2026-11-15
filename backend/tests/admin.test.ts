import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import {
  clearRateLimits,
  createUserDirect,
  loginViaApi,
  removeTrackedUsers,
  trackUser,
  trackUserId,
  VALID_PASSWORD,
} from "./helpers/testData.js";
import {
  administratorExists,
  bootstrapAdministrator,
  BootstrapError,
  type BootstrapResult,
} from "../src/scripts/bootstrapAdmin.service.js";
import { validateBootstrapInput } from "../src/scripts/bootstrapAdmin.service.js";
import { ValidationFailure } from "../src/utils/validation.js";

afterAll(async () => {
  await removeTrackedUsers();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await clearRateLimits();
});

/** Removes every administrator account so the bootstrap can be exercised. */
async function removeAllAdministrators(): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  if (admins.length === 0) return;

  const ids = admins.map((admin) => admin.id);

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

async function createAdminSession(): Promise<{
  admin: { id: string; email: string; username: string; password: string };
  cookie: string;
  csrfToken: string;
}> {
  const admin = trackUser(await createUserDirect({ role: "ADMIN" }));
  const session = await loginViaApi(admin.email, VALID_PASSWORD);

  return { admin, cookie: session.cookie, csrfToken: session.csrfToken };
}

describe("administrator bootstrap", () => {
  it("creates the first administrator with a profile and an audit event", async () => {
    await removeAllAdministrators();

    expect(await administratorExists()).toBe(false);

    const suffix = randomUUID().replace(/-/g, "").slice(0, 8);

    const result = await bootstrapAdministrator({
      email: `admin-${suffix}@tradewise.test`,
      username: `admin_${suffix}`,
      fullName: "Bootstrap Administrator",
      password: VALID_PASSWORD,
      passwordConfirmation: VALID_PASSWORD,
    });

    trackUserId(result.id);

    expect(result.email).toBe(`admin-${suffix}@tradewise.test`);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: result.id },
      include: { profile: true },
    });

    expect(user.role).toBe("ADMIN");
    expect(user.isActive).toBe(true);
    expect(user.profile?.username).toBe(`admin_${suffix}`);
    expect(user.passwordHash).not.toBe(VALID_PASSWORD);
    expect(user.passwordHash.startsWith("$argon2id$")).toBe(true);

    const events = await prisma.securityAuditLog.findMany({
      where: { userId: result.id, eventType: "ADMIN_BOOTSTRAPPED" },
    });

    expect(events).toHaveLength(1);

    await removeAllAdministrators();
  });

  it("refuses to bootstrap a second administrator", async () => {
    await removeAllAdministrators();

    const suffix = randomUUID().replace(/-/g, "").slice(0, 8);

    await bootstrapAdministrator({
      email: `admin-${suffix}@tradewise.test`,
      username: `admin_${suffix}`,
      fullName: "Bootstrap Administrator",
      password: VALID_PASSWORD,
      passwordConfirmation: VALID_PASSWORD,
    });

    expect(await administratorExists()).toBe(true);

    await expect(
      bootstrapAdministrator({
        email: `admin2-${suffix}@tradewise.test`,
        username: `admin2_${suffix}`,
        fullName: "Second Administrator",
        password: VALID_PASSWORD,
        passwordConfirmation: VALID_PASSWORD,
      }),
    ).rejects.toBeInstanceOf(BootstrapError);

    await removeAllAdministrators();
  });

  it("rolls the whole bootstrap back when the audit write fails", async () => {
    await removeAllAdministrators();

    const suffix = randomUUID().replace(/-/g, "").slice(0, 8);
    const email = `admin-${suffix}@tradewise.test`;

    await prisma.$executeRawUnsafe(
      'ALTER TABLE "SecurityAuditLog" RENAME TO "SecurityAuditLogUnavailable"',
    );

    try {
      await expect(
        bootstrapAdministrator({
          email,
          username: `admin_${suffix}`,
          fullName: "Bootstrap Administrator",
          password: VALID_PASSWORD,
          passwordConfirmation: VALID_PASSWORD,
        }),
      ).rejects.toBeTruthy();
    } finally {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "SecurityAuditLogUnavailable" RENAME TO "SecurityAuditLog"',
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });

    expect(user).toBeNull();

    await removeAllAdministrators();
  });

  it("handles concurrent bootstrapAdministrator calls with two sets of credentials, ensuring exactly one succeeds and zero partial records remain", async () => {
    await removeAllAdministrators();

    const stamp = randomUUID().replace(/-/g, "").slice(0, 8);
    const inputA = {
      email: `admin_a_${stamp}@tradewise.test`,
      username: `admin_a_${stamp}`,
      fullName: "Admin A",
      password: VALID_PASSWORD,
      passwordConfirmation: VALID_PASSWORD,
    };

    const inputB = {
      email: `admin_b_${stamp}@tradewise.test`,
      username: `admin_b_${stamp}`,
      fullName: "Admin B",
      password: VALID_PASSWORD,
      passwordConfirmation: VALID_PASSWORD,
    };

    // Concurrently trigger both bootstrap calls in parallel
    const results = await Promise.allSettled([
      bootstrapAdministrator(inputA),
      bootstrapAdministrator(inputB),
    ]);

    const fulfilled = results.filter(
      (r): r is PromiseFulfilledResult<BootstrapResult> => r.status === "fulfilled",
    );
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );

    // Exactly one call succeeds and one is rejected with BootstrapError
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(BootstrapError);
    expect(rejected[0]?.reason.message).toContain("already exists");

    const winner = fulfilled[0]!.value;
    const loserInput = winner.email === inputA.email ? inputB : inputA;

    trackUserId(winner.id);

    // Exactly one administrator exists in the entire database
    const adminUsers = await prisma.user.findMany({
      where: { role: "ADMIN" },
      include: { profile: true },
    });
    expect(adminUsers).toHaveLength(1);
    expect(adminUsers[0]?.email).toBe(winner.email);
    expect(adminUsers[0]?.profile?.username).toBe(winner.username);

    // Exactly one ADMIN_BOOTSTRAPPED audit event exists
    const auditEvents = await prisma.securityAuditLog.findMany({
      where: { eventType: "ADMIN_BOOTSTRAPPED" },
    });
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]?.userId).toBe(winner.id);

    // No partial user/profile/audit records remain from the rejected attempt
    const loserUser = await prisma.user.findUnique({
      where: { email: loserInput.email },
    });
    expect(loserUser).toBeNull();

    const loserProfile = await prisma.profile.findUnique({
      where: { username: loserInput.username },
    });
    expect(loserProfile).toBeNull();

    const loserAuditEvents = await prisma.securityAuditLog.findMany({
      where: { metadata: { path: ["username"], equals: loserInput.username } },
    });
    expect(loserAuditEvents).toHaveLength(0);

    // A subsequent bootstrap attempt is refused
    const subsequentInput = {
      email: `subsequent_${stamp}@tradewise.test`,
      username: `subsequent_${stamp}`,
      fullName: "Subsequent Admin",
      password: VALID_PASSWORD,
      passwordConfirmation: VALID_PASSWORD,
    };
    await expect(bootstrapAdministrator(subsequentInput)).rejects.toBeInstanceOf(
      BootstrapError,
    );

    await removeAllAdministrators();
  });

  it("validates the administrator details with the registration rules", () => {
    expect(() =>
      validateBootstrapInput({
        email: "not-an-email",
        username: "ab",
        fullName: "",
        password: "weak",
        passwordConfirmation: "weak",
      }),
    ).toThrow(ValidationFailure);

    expect(() =>
      validateBootstrapInput({
        email: "admin@tradewise.test",
        username: "admin_user",
        fullName: "Administrator",
        password: VALID_PASSWORD,
        passwordConfirmation: "Different1!",
      }),
    ).toThrow(ValidationFailure);

    expect(() =>
      validateBootstrapInput({
        email: "admin@tradewise.test",
        username: "admin_user",
        fullName: "Administrator",
        password: "Pass word1!",
        passwordConfirmation: "Pass word1!",
      }),
    ).toThrow(ValidationFailure);
  });
});

describe("administrator authorization", () => {
  it("forbids a regular learner from reaching administrator endpoints", async () => {
    const learner = trackUser(await createUserDirect());
    const { cookie } = await loginViaApi(learner.email, VALID_PASSWORD);

    for (const path of [
      "/api/admin/users",
      `/api/admin/users/${learner.id}`,
      "/api/admin/audit-logs",
    ]) {
      const response = await request(app).get(path).set("Cookie", cookie);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    }
  });

  it("requires authentication for administrator endpoints", async () => {
    const response = await request(app).get("/api/admin/users");

    expect(response.status).toBe(401);
  });

  it("refuses to let an administrator suspend their own account", async () => {
    const { admin, cookie, csrfToken } = await createAdminSession();

    const response = await request(app)
      .post(`/api/admin/users/${admin.id}/suspend`)
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("refuses to let an administrator suspend another administrator", async () => {
    const first = await createAdminSession();
    const second = await createAdminSession();

    const response = await request(app)
      .post(`/api/admin/users/${second.admin.id}/suspend`)
      .set("Cookie", first.cookie)
      .set("X-CSRF-Token", first.csrfToken);

    expect(response.status).toBe(403);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: second.admin.id },
    });

    expect(stored.isActive).toBe(true);
  });

  it("returns 404 for an unknown user", async () => {
    const { cookie } = await createAdminSession();

    const response = await request(app)
      .get(`/api/admin/users/${randomUUID()}`)
      .set("Cookie", cookie);

    expect(response.status).toBe(404);
  });
});

describe("administrator user management", () => {
  it("suspends a learner and revokes every active session in the same transaction", async () => {
    const admin = await createAdminSession();
    const learner = trackUser(await createUserDirect());

    const first = await loginViaApi(learner.email, VALID_PASSWORD);
    const second = await loginViaApi(learner.email, VALID_PASSWORD);

    const response = await request(app)
      .post(`/api/admin/users/${learner.id}/suspend`)
      .set("Cookie", admin.cookie)
      .set("X-CSRF-Token", admin.csrfToken);

    expect(response.status).toBe(200);
    expect(response.body.data.user.status).toBe("SUSPENDED");

    const sessions = await prisma.authSession.findMany({
      where: { userId: learner.id },
    });

    expect(sessions.every((session) => session.revokedAt !== null)).toBe(true);

    for (const cookie of [first.cookie, second.cookie]) {
      const check = await request(app).get("/api/me").set("Cookie", cookie);
      expect(check.status).toBe(401);
    }

    const login = await request(app)
      .post("/api/auth/login")
      .send({ identifier: learner.email, password: VALID_PASSWORD });

    expect(login.status).toBe(401);

    const events = await prisma.securityAuditLog.findMany({
      where: { userId: learner.id, eventType: "USER_SUSPENDED" },
    });

    expect(events).toHaveLength(1);
  });

  it("reactivates a suspended learner without restoring revoked sessions", async () => {
    const admin = await createAdminSession();
    const learner = trackUser(await createUserDirect());

    const before = await loginViaApi(learner.email, VALID_PASSWORD);

    await request(app)
      .post(`/api/admin/users/${learner.id}/suspend`)
      .set("Cookie", admin.cookie)
      .set("X-CSRF-Token", admin.csrfToken);

    const response = await request(app)
      .post(`/api/admin/users/${learner.id}/reactivate`)
      .set("Cookie", admin.cookie)
      .set("X-CSRF-Token", admin.csrfToken);

    expect(response.status).toBe(200);
    expect(response.body.data.user.status).toBe("ACTIVE");

    const oldSession = await request(app)
      .get("/api/me")
      .set("Cookie", before.cookie);

    expect(oldSession.status).toBe(401);

    const fresh = await request(app)
      .post("/api/auth/login")
      .send({ identifier: learner.email, password: VALID_PASSWORD });

    expect(fresh.status).toBe(200);
  });

  it("refuses to reactivate an account that is already active", async () => {
    const admin = await createAdminSession();
    const learner = trackUser(await createUserDirect());

    const response = await request(app)
      .post(`/api/admin/users/${learner.id}/reactivate`)
      .set("Cookie", admin.cookie)
      .set("X-CSRF-Token", admin.csrfToken);

    expect(response.status).toBe(409);
  });

  it("requires a CSRF token for administrator actions", async () => {
    const admin = await createAdminSession();
    const learner = trackUser(await createUserDirect());

    const response = await request(app)
      .post(`/api/admin/users/${learner.id}/suspend`)
      .set("Cookie", admin.cookie);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("CSRF_TOKEN_INVALID");
  });
});

describe("administrator user listing", () => {
  it("returns pagination metadata", async () => {
    const admin = await createAdminSession();

    const response = await request(app)
      .get("/api/admin/users?page=1&limit=5")
      .set("Cookie", admin.cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.pagination).toMatchObject({
      page: 1,
      limit: 5,
    });
    expect(response.body.data.pagination.total).toEqual(expect.any(Number));
    expect(response.body.data.pagination.totalPages).toEqual(expect.any(Number));
  });

  it("rejects invalid pagination values", async () => {
    const admin = await createAdminSession();

    for (const query of ["page=0", "page=abc", "limit=0", "limit=101", "page=-1"]) {
      const response = await request(app)
        .get(`/api/admin/users?${query}`)
        .set("Cookie", admin.cookie);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("filters by status, role and search term", async () => {
    const admin = await createAdminSession();
    const learner = trackUser(await createUserDirect());

    const byStatus = await request(app)
      .get("/api/admin/users?status=ACTIVE")
      .set("Cookie", admin.cookie);

    expect(byStatus.status).toBe(200);

    const ids = byStatus.body.data.users.map((user: { id: string }) => user.id);
    expect(ids).toContain(learner.id);

    const byRole = await request(app)
      .get("/api/admin/users?role=ADMIN")
      .set("Cookie", admin.cookie);

    expect(
      byRole.body.data.users.every(
        (user: { role: string }) => user.role === "ADMIN",
      ),
    ).toBe(true);

    const bySearch = await request(app)
      .get(`/api/admin/users?search=${encodeURIComponent(learner.username)}`)
      .set("Cookie", admin.cookie);

    expect(bySearch.body.data.users).toHaveLength(1);
    expect(bySearch.body.data.users[0].id).toBe(learner.id);
  });

  it("searches users by profile full name, email and username case-insensitively", async () => {
    const admin = await createAdminSession();
    const stamp = randomUUID().replace(/-/g, "").slice(0, 6);
    const learner = trackUser(
      await createUserDirect({
        fullName: `Special Learner ${stamp}`,
        username: `learner_${stamp}`,
        email: `search_${stamp}@example.com`,
      }),
    );

    // Search by full name partial (lowercase)
    const byFullName = await request(app)
      .get("/api/admin/users?search=special+learner")
      .set("Cookie", admin.cookie);
    expect(byFullName.status).toBe(200);
    const byFullNameIds = byFullName.body.data.users.map(
      (u: { id: string }) => u.id,
    );
    expect(byFullNameIds).toContain(learner.id);

    // Search by username partial (uppercase)
    const byUsername = await request(app)
      .get(`/api/admin/users?search=LEARNER_${stamp.toUpperCase()}`)
      .set("Cookie", admin.cookie);
    expect(byUsername.status).toBe(200);
    const byUsernameIds = byUsername.body.data.users.map(
      (u: { id: string }) => u.id,
    );
    expect(byUsernameIds).toContain(learner.id);

    // Search by email partial
    const byEmail = await request(app)
      .get(`/api/admin/users?search=SEARCH_${stamp}`)
      .set("Cookie", admin.cookie);
    expect(byEmail.status).toBe(200);
    const byEmailIds = byEmail.body.data.users.map(
      (u: { id: string }) => u.id,
    );
    expect(byEmailIds).toContain(learner.id);

    // Combined search, role, and status filter
    const combined = await request(app)
      .get(`/api/admin/users?search=${stamp}&role=USER&status=ACTIVE`)
      .set("Cookie", admin.cookie);
    expect(combined.status).toBe(200);
    expect(combined.body.data.users).toHaveLength(1);
    expect(combined.body.data.users[0].id).toBe(learner.id);
  });

  it("excludes deleted accounts unless they are requested explicitly", async () => {
    const admin = await createAdminSession();
    const learner = trackUser(
      await createUserDirect({ deletedAt: new Date() }),
    );

    const withoutFilter = await request(app)
      .get("/api/admin/users")
      .set("Cookie", admin.cookie);

    const withoutIds = withoutFilter.body.data.users.map(
      (user: { id: string }) => user.id,
    );

    expect(withoutIds).not.toContain(learner.id);

    const withFilter = await request(app)
      .get("/api/admin/users?status=DELETED")
      .set("Cookie", admin.cookie);

    const withIds = withFilter.body.data.users.map(
      (user: { id: string }) => user.id,
    );

    expect(withIds).toContain(learner.id);
  });

  it("sorts by creation date, username and email in both directions", async () => {
    const admin = await createAdminSession();

    const newestFirst = await request(app)
      .get("/api/admin/users?sortBy=createdAt&order=desc")
      .set("Cookie", admin.cookie);

    const createdAt = newestFirst.body.data.users.map(
      (user: { createdAt: string }) => new Date(user.createdAt).getTime(),
    );

    for (let index = 1; index < createdAt.length; index += 1) {
      expect(createdAt[index - 1]).toBeGreaterThanOrEqual(createdAt[index] ?? 0);
    }

    const oldestFirst = await request(app)
      .get("/api/admin/users?sortBy=createdAt&order=asc")
      .set("Cookie", admin.cookie);

    const oldest = oldestFirst.body.data.users.map(
      (user: { createdAt: string }) => new Date(user.createdAt).getTime(),
    );

    for (let index = 1; index < oldest.length; index += 1) {
      expect(oldest[index - 1]).toBeLessThanOrEqual(oldest[index] ?? 0);
    }

    const byUsername = await request(app)
      .get("/api/admin/users?sortBy=username&order=asc")
      .set("Cookie", admin.cookie);

    const usernames = byUsername.body.data.users.map(
      (user: { username: string }) => user.username.toLowerCase(),
    );

    expect([...usernames].sort()).toEqual(usernames);

    const byEmail = await request(app)
      .get("/api/admin/users?sortBy=email&order=asc")
      .set("Cookie", admin.cookie);

    const emails = byEmail.body.data.users.map(
      (user: { email: string }) => user.email.toLowerCase(),
    );

    expect([...emails].sort()).toEqual(emails);
  });

  it("rejects an unknown sort column", async () => {
    const admin = await createAdminSession();

    const response = await request(app)
      .get("/api/admin/users?sortBy=passwordHash")
      .set("Cookie", admin.cookie);

    expect(response.status).toBe(400);
  });

  it("filters by creation date range", async () => {
    const admin = await createAdminSession();
    const learner = trackUser(await createUserDirect());

    const created = await prisma.user.findUniqueOrThrow({
      where: { id: learner.id },
      select: { createdAt: true },
    });

    const from = new Date(created.createdAt.getTime() - 60 * 1000).toISOString();
    const to = new Date(created.createdAt.getTime() + 60 * 1000).toISOString();

    const response = await request(app)
      .get(
        `/api/admin/users?createdFrom=${encodeURIComponent(from)}&createdTo=${encodeURIComponent(to)}`,
      )
      .set("Cookie", admin.cookie);

    expect(response.status).toBe(200);

    const ids = response.body.data.users.map((user: { id: string }) => user.id);
    expect(ids).toContain(learner.id);
  });

  it("returns a stable order across repeated requests", async () => {
    const admin = await createAdminSession();

    const first = await request(app)
      .get("/api/admin/users?sortBy=username&order=asc&limit=100")
      .set("Cookie", admin.cookie);

    const second = await request(app)
      .get("/api/admin/users?sortBy=username&order=asc&limit=100")
      .set("Cookie", admin.cookie);

    expect(first.body.data.users.map((user: { id: string }) => user.id)).toEqual(
      second.body.data.users.map((user: { id: string }) => user.id),
    );
  });
});

describe("administrator user details", () => {
  it("returns the account details without sensitive fields", async () => {
    const admin = await createAdminSession();
    const learner = trackUser(await createUserDirect());

    const response = await request(app)
      .get(`/api/admin/users/${learner.id}`)
      .set("Cookie", admin.cookie);

    expect(response.status).toBe(200);

    const user = response.body.data.user;

    expect(user.id).toBe(learner.id);
    expect(user.email).toBe(learner.email);
    expect(user.username).toBe(learner.username);
    expect(user.role).toBe("USER");
    expect(user.status).toBe("ACTIVE");
    expect(user.createdAt).toBeTruthy();
    expect(user.updatedAt).toBeTruthy();
    expect(user.registeredAt).toBeTruthy();
    expect(user.activeSessionCount).toEqual(expect.any(Number));
    expect(user.sessionActivity).toMatchObject({
      activeSessionCount: expect.any(Number),
    });

    const body = JSON.stringify(response.body);

    expect(body).not.toContain("passwordHash");
    expect(body).not.toContain("tokenDigest");
    expect(body).not.toContain("csrfTokenDigest");
  });

  it("keeps historical login information visible for a suspended account", async () => {
    const admin = await createAdminSession();
    const learner = trackUser(await createUserDirect());

    await loginViaApi(learner.email, VALID_PASSWORD);

    await request(app)
      .post(`/api/admin/users/${learner.id}/suspend`)
      .set("Cookie", admin.cookie)
      .set("X-CSRF-Token", admin.csrfToken);

    const response = await request(app)
      .get(`/api/admin/users/${learner.id}`)
      .set("Cookie", admin.cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.user.status).toBe("SUSPENDED");
    expect(response.body.data.user.lastLoginAt).toBeTruthy();
  });
});
