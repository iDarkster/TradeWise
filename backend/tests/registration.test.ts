import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import {
  clearRateLimits,
  rawSessionCookie,
  registrationPayload,
  removeTrackedUsers,
  trackUserId,
  VALID_PASSWORD,
} from "./helpers/testData.js";

afterAll(async () => {
  await removeTrackedUsers();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await clearRateLimits();
});

async function trackCreatedUser(email: string): Promise<void> {
  // The database stores canonical (lower case, trimmed) email addresses.
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true },
  });

  if (user) trackUserId(user.id);
}

describe("POST /api/auth/register", () => {
  it("creates a learner account, profile and session and returns 201", async () => {
    const payload = registrationPayload();

    const response = await request(app)
      .post("/api/auth/register")
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user).toMatchObject({
      email: payload.email,
      username: payload.username,
      fullName: payload.fullName,
      role: "USER",
      status: "ACTIVE",
    });

    const cookie = rawSessionCookie(response);
    expect(cookie).toContain("tw_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("SameSite=Lax");

    await trackCreatedUser(payload.email);

    const user = await prisma.user.findUnique({
      where: { email: payload.email },
      include: { profile: true, authSessions: true },
    });

    expect(user).not.toBeNull();
    expect(user?.profile?.username).toBe(payload.username);
    expect(user?.authSessions).toHaveLength(1);
    expect(user?.lastLoginAt).toBeNull();
  });

  it("never creates an ADMIN account through public registration", async () => {
    const payload = registrationPayload();

    const response = await request(app)
      .post("/api/auth/register")
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.data.user.role).toBe("USER");

    await trackCreatedUser(payload.email);

    const user = await prisma.user.findUnique({
      where: { email: payload.email },
      select: { role: true },
    });

    expect(user?.role).toBe("USER");
  });

  it("ignores a role supplied in the request body", async () => {
    const payload = registrationPayload();

    const response = await request(app)
      .post("/api/auth/register")
      .send({ ...payload, role: "ADMIN" });

    expect(response.status).toBe(201);
    expect(response.body.data.user.role).toBe("USER");

    await trackCreatedUser(payload.email);
  });

  it("hashes the password with Argon2id and never returns it", async () => {
    const payload = registrationPayload();

    const response = await request(app)
      .post("/api/auth/register")
      .send(payload);

    expect(response.status).toBe(201);
    expect(JSON.stringify(response.body)).not.toContain(payload.password);
    expect(response.body.data.user.passwordHash).toBeUndefined();

    await trackCreatedUser(payload.email);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: payload.email },
    });

    expect(user.passwordHash).not.toBe(payload.password);
    expect(user.passwordHash.startsWith("$argon2id$")).toBe(true);
  });

  it("normalises the email address to lower case and trims whitespace", async () => {
    const payload = registrationPayload({ email: "  MiXeD.Case@TradeWise.TEST  " });

    const response = await request(app)
      .post("/api/auth/register")
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.data.user.email).toBe("mixed.case@tradewise.test");

    await trackCreatedUser("mixed.case@tradewise.test");
  });

  it("records a registration security audit event", async () => {
    const payload = registrationPayload();

    await request(app).post("/api/auth/register").send(payload);
    await trackCreatedUser(payload.email);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: payload.email },
      select: { id: true },
    });

    const events = await prisma.securityAuditLog.findMany({
      where: { userId: user.id, eventType: "USER_REGISTERED" },
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.sessionId).toBeTruthy();
  });

  it("rejects a request that is missing required fields", async () => {
    const response = await request(app).post("/api/auth/register").send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details.fields).toMatchObject({
      email: expect.any(String),
      password: expect.any(String),
      username: expect.any(String),
      fullName: expect.any(String),
    });
  });

  it("rejects an invalid email address", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send(registrationPayload({ email: "not-an-email" }));

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields.email).toBeTruthy();
  });

  it("rejects a duplicate email address that differs only in case", async () => {
    const payload = registrationPayload({ email: "Duplicate.Case@tradewise.test" });

    const first = await request(app)
      .post("/api/auth/register")
      .send(payload);

    expect(first.status).toBe(201);
    await trackCreatedUser(payload.email);

    const second = await request(app)
      .post("/api/auth/register")
      .send(registrationPayload({ email: "duplicate.case@tradewise.test" }));

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("CONFLICT");
  });

  it("rejects an invalid username", async () => {
    for (const username of ["ab", "a".repeat(21), "has space", "bad-char", ""]) {
      const response = await request(app)
        .post("/api/auth/register")
        .send(registrationPayload({ username }));

      expect(response.status).toBe(400);
      expect(response.body.error.details.fields.username).toBeTruthy();
    }
  });

  it("rejects a duplicate username that differs only in case", async () => {
    const payload = registrationPayload({ username: "Duplicate_User" });

    const first = await request(app)
      .post("/api/auth/register")
      .send(payload);

    expect(first.status).toBe(201);
    await trackCreatedUser(payload.email);

    const second = await request(app)
      .post("/api/auth/register")
      .send(registrationPayload({ username: "duplicate_user" }));

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("CONFLICT");
  });

  it("enforces the password policy", async () => {
    const cases: Array<[string, string]> = [
      ["Aa1!", "shorter than 8 characters"],
      ["Aa1!".repeat(33), "longer than 128 characters"],
      ["NoDigitsHere!", "missing a digit"],
      ["NoSpecials123", "missing a special character"],
    ];

    for (const [password] of cases) {
      const response = await request(app)
        .post("/api/auth/register")
        .send(registrationPayload({ password }));

      expect(response.status).toBe(400);
      expect(response.body.error.details.fields.password).toBeTruthy();
    }
  });

  it("accepts a password that satisfies the policy at its boundaries", async () => {
    const shortest = "Aa12345!";
    const longest = `Aa12345!${"x".repeat(119)}`;

    for (const password of [shortest, longest]) {
      const payload = registrationPayload({ password });

      const response = await request(app)
        .post("/api/auth/register")
        .send(payload);

      expect(response.status).toBe(201);
      await trackCreatedUser(payload.email);
    }
  });

  it("rejects passwords containing spaces or whitespace", async () => {
    const invalidPasswords = [
      `Pass word ${VALID_PASSWORD}`,
      ` ${VALID_PASSWORD}`,
      `${VALID_PASSWORD} `,
      "darkster 123!",
      " darkster123!",
      "darkster123! ",
      "darkster\t123!",
      "darkster\n123!",
    ];

    for (const password of invalidPasswords) {
      const payload = registrationPayload({ password });

      const response = await request(app)
        .post("/api/auth/register")
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(response.body.error.details.fields.password).toBeTruthy();
    }
  });

  it("does not require upper or lower case characters", async () => {
    const payload = registrationPayload({ password: "lowercase1!andmore" });

    const response = await request(app)
      .post("/api/auth/register")
      .send(payload);

    expect(response.status).toBe(201);
    await trackCreatedUser(payload.email);
  });

  it("rejects a malformed JSON body with 400", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .set("Content-Type", "application/json")
      .send("{not json");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("MALFORMED_REQUEST");
  });
});
