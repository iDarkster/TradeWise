import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
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

afterAll(async () => {
  await removeTrackedUsers();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await clearRateLimits();
});

afterEach(async () => {
  await clearRateLimits();
});

describe("POST /api/auth/login", () => {
  it("authenticates with an email address", async () => {
    const user = trackUser(await createUserDirect());

    const response = await request(app)
      .post("/api/auth/login")
      .send({ identifier: user.email, password: VALID_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.id).toBe(user.id);
    expect(response.body.data.user.email).toBe(user.email);
    expect(response.body.data.csrfToken).toEqual(expect.any(String));
  });

  it("authenticates with a username", async () => {
    const user = trackUser(await createUserDirect());

    const response = await request(app)
      .post("/api/auth/login")
      .send({ identifier: user.username, password: VALID_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.data.user.id).toBe(user.id);
  });

  it("matches identifiers case-insensitively", async () => {
    const user = trackUser(await createUserDirect());

    const byEmail = await request(app)
      .post("/api/auth/login")
      .send({ identifier: user.email.toUpperCase(), password: VALID_PASSWORD });

    expect(byEmail.status).toBe(200);

    const byUsername = await request(app)
      .post("/api/auth/login")
      .send({ identifier: user.username.toUpperCase(), password: VALID_PASSWORD });

    expect(byUsername.status).toBe(200);
  });

  it("creates an independent session on every successful login", async () => {
    const user = trackUser(await createUserDirect());

    await loginViaApi(user.email, VALID_PASSWORD);
    await loginViaApi(user.email, VALID_PASSWORD);

    const sessions = await prisma.authSession.findMany({
      where: { userId: user.id },
    });

    expect(sessions).toHaveLength(2);
    expect(sessions[0]?.id).not.toBe(sessions[1]?.id);
  });

  it("updates the last login timestamp", async () => {
    const user = trackUser(await createUserDirect());

    expect(user.id).toBeTruthy();

    await loginViaApi(user.email, VALID_PASSWORD);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });

    expect(stored.lastLoginAt).not.toBeNull();
    expect(stored.lastActivityAt).not.toBeNull();
  });

  it("does not record a successful login in the security audit log", async () => {
    const user = trackUser(await createUserDirect());

    await loginViaApi(user.email, VALID_PASSWORD);

    const events = await prisma.securityAuditLog.findMany({
      where: { userId: user.id },
    });

    expect(events).toHaveLength(0);
  });

  it("rejects an incorrect password with a generic 401", async () => {
    const user = trackUser(await createUserDirect());

    const response = await request(app)
      .post("/api/auth/login")
      .send({ identifier: user.email, password: "WrongPass1!" });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns the identical response for an unknown identifier", async () => {
    const user = trackUser(await createUserDirect());

    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ identifier: user.email, password: "WrongPass1!" });

    const unknownIdentifier = await request(app)
      .post("/api/auth/login")
      .send({ identifier: "nobody@tradewise.test", password: "WrongPass1!" });

    expect(unknownIdentifier.status).toBe(wrongPassword.status);
    expect(unknownIdentifier.body).toEqual(wrongPassword.body);
  });

  it("rejects a suspended account", async () => {
    const user = trackUser(await createUserDirect({ isActive: false }));

    const response = await request(app)
      .post("/api/auth/login")
      .send({ identifier: user.email, password: VALID_PASSWORD });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects a soft-deleted account even when it is still marked active", async () => {
    const user = trackUser(
      await createUserDirect({ isActive: true, deletedAt: new Date() }),
    );

    const response = await request(app)
      .post("/api/auth/login")
      .send({ identifier: user.email, password: VALID_PASSWORD });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("sets a session cookie and never returns the raw token in the body", async () => {
    const user = trackUser(await createUserDirect());

    const response = await request(app)
      .post("/api/auth/login")
      .send({ identifier: user.email, password: VALID_PASSWORD });

    const setCookie = String(response.headers["set-cookie"]);
    expect(setCookie).toContain("tw_session=");
    expect(setCookie).toContain("HttpOnly");

    const rawCookie = setCookie.split(";")[0]?.split("=")[1] ?? "";
    expect(rawCookie.length).toBeGreaterThan(20);
    expect(JSON.stringify(response.body)).not.toContain(rawCookie);
  });

  it("stores only a digest of the session token", async () => {
    const user = trackUser(await createUserDirect());

    const { cookie } = await loginViaApi(user.email, VALID_PASSWORD);
    const rawToken = cookie.split("=")[1] ?? "";

    const session = await prisma.authSession.findFirstOrThrow({
      where: { userId: user.id },
    });

    expect(session.tokenDigest).not.toBe(rawToken);
    expect(session.tokenDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(session.csrfTokenDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects a login request without an identifier or password", async () => {
    const response = await request(app).post("/api/auth/login").send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
