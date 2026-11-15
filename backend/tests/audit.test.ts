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
  VALID_PASSWORD,
} from "./helpers/testData.js";
import { sanitizeMetadata } from "../src/services/securityAudit.service.js";

afterAll(async () => {
  await removeTrackedUsers();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await clearRateLimits();
});

async function createAdminSession(): Promise<{
  admin: { id: string; email: string };
  cookie: string;
  csrfToken: string;
}> {
  const admin = trackUser(await createUserDirect({ role: "ADMIN" }));
  const session = await loginViaApi(admin.email, VALID_PASSWORD);

  return { admin, cookie: session.cookie, csrfToken: session.csrfToken };
}

describe("security audit logging", () => {
  it("records the required security events", async () => {
    const admin = await createAdminSession();
    const learner = trackUser(await createUserDirect());

    // Failed login.
    await request(app)
      .post("/api/auth/login")
      .send({ identifier: learner.email, password: "WrongPass1!" });

    // Session revocation.
    await request(app)
      .post("/api/auth/logout-others")
      .set("Cookie", admin.cookie)
      .set("X-CSRF-Token", admin.csrfToken);

    // Suspension.
    await request(app)
      .post(`/api/admin/users/${learner.id}/suspend`)
      .set("Cookie", admin.cookie)
      .set("X-CSRF-Token", admin.csrfToken);

    // Reactivation.
    await request(app)
      .post(`/api/admin/users/${learner.id}/reactivate`)
      .set("Cookie", admin.cookie)
      .set("X-CSRF-Token", admin.csrfToken);

    // Password change.
    const learnerSession = await loginViaApi(learner.email, VALID_PASSWORD);

    await request(app)
      .post("/api/me/password")
      .set("Cookie", learnerSession.cookie)
      .set("X-CSRF-Token", learnerSession.csrfToken)
      .send({ currentPassword: VALID_PASSWORD, newPassword: "BrandNew1!" });

    const events = await prisma.securityAuditLog.findMany({
      where: { userId: learner.id },
      select: { eventType: true },
    });

    const types = events.map((event) => event.eventType);

    expect(types).toContain("LOGIN_FAILED");
    expect(types).toContain("USER_SUSPENDED");
    expect(types).toContain("USER_REACTIVATED");
    expect(types).toContain("PASSWORD_CHANGED");

    // The session revocation was performed by the administrator.
    const adminEvents = await prisma.securityAuditLog.findMany({
      where: { userId: admin.admin.id, eventType: "SESSION_REVOKED" },
    });

    expect(adminEvents.length).toBeGreaterThanOrEqual(1);
  });

  it("records a logout-all event", async () => {
    const user = trackUser(await createUserDirect());
    const session = await loginViaApi(user.email, VALID_PASSWORD);

    await request(app)
      .post("/api/auth/logout-all")
      .set("Cookie", session.cookie)
      .set("X-CSRF-Token", session.csrfToken);

    const events = await prisma.securityAuditLog.findMany({
      where: { userId: user.id, eventType: "LOGOUT_ALL" },
    });

    expect(events).toHaveLength(1);
  });

  it("records suspicious activity when a login is rate limited", async () => {
    const user = trackUser(await createUserDirect());

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app)
        .post("/api/auth/login")
        .send({ identifier: user.email, password: "WrongPass1!" });
    }

    const blocked = await request(app)
      .post("/api/auth/login")
      .send({ identifier: user.email, password: "WrongPass1!" });

    expect(blocked.status).toBe(429);

    const events = await prisma.securityAuditLog.findMany({
      where: { eventType: "SUSPICIOUS_ACTIVITY" },
    });

    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it("never records password, token or digest material", async () => {
    const user = trackUser(await createUserDirect());
    const session = await loginViaApi(user.email, VALID_PASSWORD);

    await request(app)
      .post("/api/me/password")
      .set("Cookie", session.cookie)
      .set("X-CSRF-Token", session.csrfToken)
      .send({ currentPassword: VALID_PASSWORD, newPassword: "BrandNew1!" });

    await request(app)
      .post("/api/auth/login")
      .send({ identifier: user.email, password: "WrongPass1!" });

    const rows = await prisma.securityAuditLog.findMany();

    expect(rows.length).toBeGreaterThan(0);

    const rawToken = session.cookie.split("=")[1] ?? "";

    for (const row of rows) {
      const serialised = JSON.stringify(row.metadata ?? {});

      expect(serialised).not.toContain(VALID_PASSWORD);
      expect(serialised).not.toContain("BrandNew1!");
      expect(serialised).not.toContain(rawToken);
      expect(serialised).not.toContain("argon2");
    }
  });

  it("aggregates repeated failed logins instead of flooding the audit table", async () => {
    const users = [];
    for (let index = 0; index < 4; index += 1) {
      users.push(trackUser(await createUserDirect()));
    }

    for (const user of users) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await request(app)
          .post("/api/auth/login")
          .send({ identifier: user.email, password: "WrongPass1!" });
      }
    }

    const events = await prisma.securityAuditLog.findMany({
      where: {
        eventType: "LOGIN_FAILED",
        userId: { in: users.map((user) => user.id) },
      },
    });

    // Twenty failures happened, but only the first few are recorded in
    // detail; the rate-limit counters aggregate the rest.
    expect(events).toHaveLength(5);
  });

  it("protects audit records against updates and deletes", async () => {
    const user = trackUser(await createUserDirect());

    await request(app)
      .post("/api/auth/login")
      .send({ identifier: user.email, password: "WrongPass1!" });

    const event = await prisma.securityAuditLog.findFirstOrThrow({
      where: { eventType: "LOGIN_FAILED" },
    });

    await expect(
      prisma.securityAuditLog.update({
        where: { id: event.id },
        data: { eventType: "TAMPERED" },
      }),
    ).rejects.toBeTruthy();

    await expect(
      prisma.securityAuditLog.delete({ where: { id: event.id } }),
    ).rejects.toBeTruthy();
  });

  it("fails the authentication attempt closed when the audit write fails", async () => {
    const user = trackUser(await createUserDirect());

    await prisma.$executeRawUnsafe(
      'ALTER TABLE "SecurityAuditLog" RENAME TO "SecurityAuditLogUnavailable"',
    );

    try {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ identifier: user.email, password: "WrongPass1!" });

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe("INTERNAL_ERROR");

      const sessions = await prisma.authSession.count({
        where: { userId: user.id },
      });

      expect(sessions).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "SecurityAuditLogUnavailable" RENAME TO "SecurityAuditLog"',
      );
    }
  });

  it("preserves audit history when the related user is deleted", async () => {
    const user = trackUser(await createUserDirect());

    await request(app)
      .post("/api/auth/login")
      .send({ identifier: user.email, password: "WrongPass1!" });

    const event = await prisma.securityAuditLog.findFirstOrThrow({
      where: { userId: user.id },
    });

    await prisma.user.delete({ where: { id: user.id } });

    const after = await prisma.securityAuditLog.findUnique({
      where: { id: event.id },
    });

    expect(after).not.toBeNull();
    expect(after?.userId).toBeNull();
    expect(after?.eventType).toBe("LOGIN_FAILED");
  });
});

describe("administrator audit log API", () => {
  it("returns the audit events with actor and target summaries", async () => {
    const admin = await createAdminSession();
    const learner = trackUser(await createUserDirect());

    await request(app)
      .post("/api/auth/login")
      .send({ identifier: learner.email, password: "WrongPass1!" });

    const response = await request(app)
      .get("/api/admin/audit-logs")
      .set("Cookie", admin.cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.pagination).toMatchObject({
      page: 1,
      limit: 20,
    });

    const event = response.body.data.events.find(
      (entry: { action: string }) => entry.action === "LOGIN_FAILED",
    );

    expect(event).toBeDefined();
    expect(event.id).toEqual(expect.any(String));
    expect(event.action).toBe("LOGIN_FAILED");
    expect(event.timestamp).toBeTruthy();
    expect(event.targetId).toBe(learner.id);
    expect(event.target).toMatchObject({ id: learner.id, email: learner.email });
  });

  it("filters by action, target and date range", async () => {
    const admin = await createAdminSession();
    const learner = trackUser(await createUserDirect());

    await request(app)
      .post("/api/auth/login")
      .send({ identifier: learner.email, password: "WrongPass1!" });

    const byAction = await request(app)
      .get("/api/admin/audit-logs?action=LOGIN_FAILED")
      .set("Cookie", admin.cookie);

    expect(
      byAction.body.data.events.every(
        (event: { action: string }) => event.action === "LOGIN_FAILED",
      ),
    ).toBe(true);

    const byTarget = await request(app)
      .get(`/api/admin/audit-logs?targetId=${learner.id}`)
      .set("Cookie", admin.cookie);

    expect(byTarget.body.data.events.length).toBeGreaterThan(0);

    const from = new Date(Date.now() - 60 * 1000).toISOString();
    const to = new Date(Date.now() + 60 * 1000).toISOString();

    const byRange = await request(app)
      .get(
        `/api/admin/audit-logs?createdFrom=${encodeURIComponent(from)}&createdTo=${encodeURIComponent(to)}`,
      )
      .set("Cookie", admin.cookie);

    expect(byRange.body.data.events.length).toBeGreaterThan(0);

    const empty = await request(app)
      .get(
        `/api/admin/audit-logs?createdFrom=${encodeURIComponent(to)}&createdTo=${encodeURIComponent(to)}`,
      )
      .set("Cookie", admin.cookie);

    expect(empty.body.data.events).toHaveLength(0);
  });

  it("matches audit actions case-insensitively and on partial substrings", async () => {
    const admin = await createAdminSession();
    const learner = trackUser(await createUserDirect());

    await request(app)
      .post("/api/auth/login")
      .send({ identifier: learner.email, password: "WrongPass1!" });

    // Lowercase match
    const byLowercase = await request(app)
      .get("/api/admin/audit-logs?action=login_failed")
      .set("Cookie", admin.cookie);

    expect(byLowercase.status).toBe(200);
    expect(byLowercase.body.data.events.length).toBeGreaterThan(0);
    expect(
      byLowercase.body.data.events.every((event: { action: string }) =>
        event.action.toLowerCase().includes("login_failed"),
      ),
    ).toBe(true);

    // Partial substring match
    const byPartial = await request(app)
      .get("/api/admin/audit-logs?action=failed")
      .set("Cookie", admin.cookie);

    expect(byPartial.status).toBe(200);
    expect(byPartial.body.data.events.length).toBeGreaterThan(0);
    expect(
      byPartial.body.data.events.every((event: { action: string }) =>
        event.action.toLowerCase().includes("failed"),
      ),
    ).toBe(true);
  });

  it("filters by actor", async () => {
    const admin = await createAdminSession();
    const learner = trackUser(await createUserDirect());

    await request(app)
      .post(`/api/admin/users/${learner.id}/suspend`)
      .set("Cookie", admin.cookie)
      .set("X-CSRF-Token", admin.csrfToken);

    const response = await request(app)
      .get(`/api/admin/audit-logs?actorId=${admin.admin.id}`)
      .set("Cookie", admin.cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.events.length).toBeGreaterThan(0);

    for (const event of response.body.data.events) {
      expect(event.actorId).toBe(admin.admin.id);
    }
  });

  it("paginates and rejects invalid pagination values", async () => {
    const admin = await createAdminSession();

    const page = await request(app)
      .get("/api/admin/audit-logs?page=1&limit=1")
      .set("Cookie", admin.cookie);

    expect(page.status).toBe(200);
    expect(page.body.data.events.length).toBeLessThanOrEqual(1);
    expect(page.body.data.pagination.limit).toBe(1);

    const invalid = await request(app)
      .get("/api/admin/audit-logs?limit=101")
      .set("Cookie", admin.cookie);

    expect(invalid.status).toBe(400);
  });

  it("never exposes sensitive material in the audit response", async () => {
    const admin = await createAdminSession();
    const learner = trackUser(await createUserDirect());

    const session = await loginViaApi(learner.email, VALID_PASSWORD);

    await request(app)
      .post("/api/auth/login")
      .send({ identifier: learner.email, password: "WrongPass1!" });

    const response = await request(app)
      .get("/api/admin/audit-logs")
      .set("Cookie", admin.cookie);

    const body = JSON.stringify(response.body);

    expect(body).not.toContain(VALID_PASSWORD);
    expect(body).not.toContain(session.cookie.split("=")[1] ?? "");
    expect(body).not.toContain("tokenDigest");
    expect(body).not.toContain("csrfTokenDigest");
  });
});

describe("audit metadata sanitisation", () => {
  it("drops forbidden keys and non-primitive values", () => {
    const sanitised = sanitizeMetadata({
      username: "learner",
      password: "secret",
      passwordHash: "argon2",
      sessionToken: "abc",
      csrfToken: "def",
      tokenDigest: "ghi",
      secret: "jkl",
      nested: { password: "nested" },
      count: 3,
      flag: true,
      missing: null,
    });

    expect(sanitised).toEqual({
      username: "learner",
      count: 3,
      flag: true,
      missing: null,
    });
  });

  it("truncates very long strings", () => {
    const sanitised = sanitizeMetadata({ note: "x".repeat(1000) });

    expect((sanitised.note as string).length).toBe(512);
  });
});
