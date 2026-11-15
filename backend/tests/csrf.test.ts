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

afterAll(async () => {
  await removeTrackedUsers();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await clearRateLimits();
});

describe("CSRF protection", () => {
  it("returns the CSRF token of the current session", async () => {
    const user = trackUser(await createUserDirect());

    const { cookie } = await loginViaApi(user.email, VALID_PASSWORD);

    const response = await request(app)
      .get("/api/auth/csrf")
      .set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.csrfToken).toEqual(expect.any(String));
    expect(response.body.data.csrfToken.length).toBe(64);
  });

  it("reproduces the same token after a page reload", async () => {
    const user = trackUser(await createUserDirect());

    const { cookie } = await loginViaApi(user.email, VALID_PASSWORD);

    const first = await request(app)
      .get("/api/auth/csrf")
      .set("Cookie", cookie);

    const second = await request(app)
      .get("/api/auth/csrf")
      .set("Cookie", cookie);

    expect(first.body.data.csrfToken).toBe(second.body.data.csrfToken);
  });

  it("accepts a state-changing request that carries a valid token", async () => {
    const user = trackUser(await createUserDirect());

    const { cookie, csrfToken } = await loginViaApi(user.email, VALID_PASSWORD);

    const response = await request(app)
      .patch("/api/me/profile")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ fullName: "Updated Name" });

    expect(response.status).toBe(200);
    expect(response.body.data.user.fullName).toBe("Updated Name");
  });

  it("rejects a state-changing request without a token", async () => {
    const user = trackUser(await createUserDirect());

    const { cookie } = await loginViaApi(user.email, VALID_PASSWORD);

    const response = await request(app)
      .patch("/api/me/profile")
      .set("Cookie", cookie)
      .send({ fullName: "Updated Name" });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("CSRF_TOKEN_INVALID");
  });

  it("rejects a state-changing request with an invalid token", async () => {
    const user = trackUser(await createUserDirect());

    const { cookie } = await loginViaApi(user.email, VALID_PASSWORD);

    const response = await request(app)
      .patch("/api/me/profile")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", "f".repeat(64))
      .send({ fullName: "Updated Name" });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("CSRF_TOKEN_INVALID");
  });

  it("binds the token to the session that issued it", async () => {
    const user = trackUser(await createUserDirect());

    const first = await loginViaApi(user.email, VALID_PASSWORD);
    const second = await loginViaApi(user.email, VALID_PASSWORD);

    const response = await request(app)
      .patch("/api/me/profile")
      .set("Cookie", second.cookie)
      .set("X-CSRF-Token", first.csrfToken)
      .send({ fullName: "Updated Name" });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("CSRF_TOKEN_INVALID");
  });

  it("rejects a request from a revoked session", async () => {
    const user = trackUser(await createUserDirect());

    const { cookie, csrfToken } = await loginViaApi(user.email, VALID_PASSWORD);

    await prisma.authSession.updateMany({
      where: { userId: user.id },
      data: { revokedAt: new Date() },
    });

    const response = await request(app)
      .patch("/api/me/profile")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ fullName: "Updated Name" });

    expect(response.status).toBe(401);
  });

  it("does not require a token for read-only requests", async () => {
    const user = trackUser(await createUserDirect());

    const { cookie } = await loginViaApi(user.email, VALID_PASSWORD);

    const response = await request(app).get("/api/me").set("Cookie", cookie);

    expect(response.status).toBe(200);
  });

  it("never stores the raw CSRF token in the database", async () => {
    const user = trackUser(await createUserDirect());

    const { cookie, csrfToken } = await loginViaApi(user.email, VALID_PASSWORD);

    const session = await prisma.authSession.findFirstOrThrow({
      where: { userId: user.id },
    });

    expect(session.csrfTokenDigest).not.toBe(csrfToken);
    expect(session.csrfTokenDigest).toMatch(/^[0-9a-f]{64}$/);

    const stored = await prisma.$queryRaw<Array<{ csrfTokenDigest: string }>>`
      SELECT "csrfTokenDigest" FROM "AuthSession" WHERE "userId" = ${user.id}::uuid
    `;

    expect(stored[0]?.csrfTokenDigest).not.toContain(csrfToken);
    expect(JSON.stringify(stored)).not.toContain(cookie.split("=")[1] ?? "");
  });

  it("requires authentication to fetch a CSRF token", async () => {
    const response = await request(app).get("/api/auth/csrf");

    expect(response.status).toBe(401);
  });
});
