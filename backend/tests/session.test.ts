import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { touchSession, type SessionSnapshot } from "../src/services/session.service.js";
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

describe("session lifecycle", () => {
  it("allows multiple independent sessions for one account", async () => {
    const user = trackUser(await createUserDirect());

    const first = await loginViaApi(user.email, VALID_PASSWORD);
    const second = await loginViaApi(user.email, VALID_PASSWORD);

    expect(first.cookie).not.toBe(second.cookie);

    const list = await request(app)
      .get("/api/auth/sessions")
      .set("Cookie", first.cookie);

    expect(list.status).toBe(200);
    expect(list.body.data.sessions).toHaveLength(2);
  });

  it("lists session metadata without exposing tokens or digests", async () => {
    const user = trackUser(await createUserDirect());

    const { cookie } = await loginViaApi(user.email, VALID_PASSWORD);

    const list = await request(app)
      .get("/api/auth/sessions")
      .set("Cookie", cookie);

    expect(list.status).toBe(200);

    const session = list.body.data.sessions[0];

    expect(session.id).toEqual(expect.any(String));
    expect(session.client).toEqual(expect.any(String));
    expect(session.createdAt).toBeTruthy();
    expect(session.lastActivityAt).toBeTruthy();
    expect(session.expiresAt).toBeTruthy();
    expect(session.isCurrent).toBe(true);

    const body = JSON.stringify(list.body);
    expect(body).not.toContain("tokenDigest");
    expect(body).not.toContain("csrfTokenDigest");
    expect(body).not.toContain(cookie.split("=")[1] ?? "impossible");
  });

  it("revokes only the current session on logout", async () => {
    const user = trackUser(await createUserDirect());

    const first = await loginViaApi(user.email, VALID_PASSWORD);
    const second = await loginViaApi(user.email, VALID_PASSWORD);

    const logout = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", first.cookie)
      .set("X-CSRF-Token", first.csrfToken);

    expect(logout.status).toBe(204);

    const stillValid = await request(app)
      .get("/api/me")
      .set("Cookie", second.cookie);

    expect(stillValid.status).toBe(200);

    const revoked = await request(app)
      .get("/api/me")
      .set("Cookie", first.cookie);

    expect(revoked.status).toBe(401);
  });

  it("does not record an ordinary logout in the security audit log", async () => {
    const user = trackUser(await createUserDirect());

    const { cookie, csrfToken } = await loginViaApi(user.email, VALID_PASSWORD);

    await request(app)
      .post("/api/auth/logout")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken);

    const events = await prisma.securityAuditLog.findMany({
      where: { userId: user.id },
    });

    expect(events).toHaveLength(0);
  });

  it("revokes every active session on logout-all", async () => {
    const user = trackUser(await createUserDirect());

    const first = await loginViaApi(user.email, VALID_PASSWORD);
    const second = await loginViaApi(user.email, VALID_PASSWORD);

    const response = await request(app)
      .post("/api/auth/logout-all")
      .set("Cookie", first.cookie)
      .set("X-CSRF-Token", first.csrfToken);

    expect(response.status).toBe(204);

    for (const cookie of [first.cookie, second.cookie]) {
      const check = await request(app).get("/api/me").set("Cookie", cookie);
      expect(check.status).toBe(401);
    }

    const events = await prisma.securityAuditLog.findMany({
      where: { userId: user.id, eventType: "LOGOUT_ALL" },
    });

    expect(events).toHaveLength(1);
  });

  it("revokes every other session but keeps the current one", async () => {
    const user = trackUser(await createUserDirect());

    const first = await loginViaApi(user.email, VALID_PASSWORD);
    const second = await loginViaApi(user.email, VALID_PASSWORD);

    const response = await request(app)
      .post("/api/auth/logout-others")
      .set("Cookie", first.cookie)
      .set("X-CSRF-Token", first.csrfToken);

    expect(response.status).toBe(204);

    const current = await request(app).get("/api/me").set("Cookie", first.cookie);
    expect(current.status).toBe(200);

    const other = await request(app).get("/api/me").set("Cookie", second.cookie);
    expect(other.status).toBe(401);
  });

  it("revokes a single session of the current user", async () => {
    const user = trackUser(await createUserDirect());

    const first = await loginViaApi(user.email, VALID_PASSWORD);
    const second = await loginViaApi(user.email, VALID_PASSWORD);

    const sessions = await prisma.authSession.findMany({
      where: { userId: user.id },
    });

    const target = sessions.find((session) => {
      return session.tokenDigest !== first.cookie;
    });

    expect(target).toBeDefined();

    const otherSession = await request(app)
      .get("/api/auth/sessions")
      .set("Cookie", second.cookie);

    const targetId =
      otherSession.body.data.sessions.find(
        (session: { id: string }) => session.id !== second.cookie,
      )?.id ?? target?.id;

    const response = await request(app)
      .delete(`/api/auth/sessions/${targetId}`)
      .set("Cookie", first.cookie)
      .set("X-CSRF-Token", first.csrfToken);

    expect(response.status).toBe(204);

    const remaining = await prisma.authSession.findMany({
      where: { userId: user.id, revokedAt: null },
    });

    expect(remaining).toHaveLength(1);
  });

  it("refuses to revoke a session that belongs to another user", async () => {
    const owner = trackUser(await createUserDirect());
    const other = trackUser(await createUserDirect());

    const ownerSession = await loginViaApi(owner.email, VALID_PASSWORD);
    await loginViaApi(other.email, VALID_PASSWORD);

    const sessions = await prisma.authSession.findMany({
      where: { userId: other.id },
    });

    const otherSessionId = sessions[0]?.id ?? "";

    const response = await request(app)
      .delete(`/api/auth/sessions/${otherSessionId}`)
      .set("Cookie", ownerSession.cookie)
      .set("X-CSRF-Token", ownerSession.csrfToken);

    expect(response.status).toBe(404);

    const stillActive = await prisma.authSession.findFirst({
      where: { id: otherSessionId },
    });

    expect(stillActive?.revokedAt).toBeNull();
  });

  it("rejects an expired session", async () => {
    const user = trackUser(await createUserDirect());

    const { cookie } = await loginViaApi(user.email, VALID_PASSWORD);

    await prisma.authSession.updateMany({
      where: { userId: user.id },
      data: {
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        lastActivityAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() - 60 * 60 * 1000),
      },
    });

    const response = await request(app).get("/api/me").set("Cookie", cookie);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("refreshes the sliding expiry on authenticated activity", async () => {
    const user = trackUser(await createUserDirect());

    const { cookie } = await loginViaApi(user.email, VALID_PASSWORD);

    const staleActivity = new Date(Date.now() - 30 * 60 * 1000);

    await prisma.authSession.updateMany({
      where: { userId: user.id },
      data: {
        createdAt: new Date(staleActivity.getTime() - 60 * 1000),
        lastActivityAt: staleActivity,
        expiresAt: new Date(staleActivity.getTime() + 24 * 60 * 60 * 1000),
      },
    });

    const before = await prisma.authSession.findFirstOrThrow({
      where: { userId: user.id },
    });

    const response = await request(app).get("/api/me").set("Cookie", cookie);
    expect(response.status).toBe(200);

    // Refreshes the browser cookie with fresh Max-Age and identical token
    expect(response.headers["set-cookie"]).toBeDefined();
    const setCookie = response.headers["set-cookie"]?.[0] ?? "";
    expect(setCookie).toContain("tw_session=");
    expect(setCookie).toContain("Max-Age=");
    expect(setCookie.split(";")[0]).toBe(cookie);

    const after = await prisma.authSession.findFirstOrThrow({
      where: { userId: user.id },
    });

    expect(after.lastActivityAt.getTime()).toBeGreaterThan(
      before.lastActivityAt.getTime(),
    );
    expect(after.expiresAt.getTime()).toBeGreaterThan(before.expiresAt.getTime());

    const expectedExpiry = after.lastActivityAt.getTime() + 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(after.expiresAt.getTime() - expectedExpiry)).toBeLessThan(2000);
  });

  it("throttles activity writes to at most once every five minutes", async () => {
    const user = trackUser(await createUserDirect());

    const { cookie } = await loginViaApi(user.email, VALID_PASSWORD);

    const recentActivity = new Date(Date.now() - 60 * 1000);

    await prisma.authSession.updateMany({
      where: { userId: user.id },
      data: {
        createdAt: new Date(recentActivity.getTime() - 60 * 1000),
        lastActivityAt: recentActivity,
        expiresAt: new Date(recentActivity.getTime() + 24 * 60 * 60 * 1000),
      },
    });

    const response = await request(app).get("/api/me").set("Cookie", cookie);
    expect(response.status).toBe(200);

    // Throttled: no Set-Cookie header emitted
    expect(response.headers["set-cookie"]).toBeUndefined();

    const after = await prisma.authSession.findFirstOrThrow({
      where: { userId: user.id },
    });

    expect(after.lastActivityAt.getTime()).toBe(recentActivity.getTime());
  });

  it("takes effect immediately when a session is revoked", async () => {
    const user = trackUser(await createUserDirect());

    const { cookie } = await loginViaApi(user.email, VALID_PASSWORD);

    await prisma.authSession.updateMany({
      where: { userId: user.id },
      data: { revokedAt: new Date() },
    });

    const response = await request(app).get("/api/me").set("Cookie", cookie);

    expect(response.status).toBe(401);
  });

  it("rejects an unauthenticated request to a protected endpoint", async () => {
    const response = await request(app).get("/api/me");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects a request with an unknown session cookie", async () => {
    const response = await request(app)
      .get("/api/me")
      .set("Cookie", "tw_session=not-a-real-token");

    expect(response.status).toBe(401);
  });

  it("does not refresh touchSession if session is revoked concurrently and asserts exact equality of expiresAt", async () => {
    const user = trackUser(await createUserDirect());
    await loginViaApi(user.email, VALID_PASSWORD);

    const session = await prisma.authSession.findFirstOrThrow({
      where: { userId: user.id },
    });

    const originalExpiresAt = session.expiresAt;

    const agedCreatedAt = new Date(Date.now() - 15 * 60 * 1000);
    const agedActivity = new Date(Date.now() - 10 * 60 * 1000);

    await prisma.authSession.update({
      where: { id: session.id },
      data: {
        createdAt: agedCreatedAt,
        lastActivityAt: agedActivity,
      },
    });

    // Snapshot aged 10 minutes ago
    const snapshot: SessionSnapshot = {
      id: session.id,
      userId: session.userId,
      createdAt: agedCreatedAt,
      lastActivityAt: agedActivity,
      expiresAt: originalExpiresAt,
      revokedAt: null,
      userAgent: session.userAgent,
    };

    // Concurrently revoke the session in PostgreSQL
    await prisma.authSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const result = await touchSession(snapshot);
    expect(result.status).toBe("invalid");

    const after = await prisma.authSession.findUniqueOrThrow({
      where: { id: session.id },
    });

    // Exact equality check: expiresAt must NOT have slid forward
    expect(after.expiresAt.getTime()).toBe(originalExpiresAt.getTime());
  });

  it("does not refresh touchSession if session is already expired", async () => {
    const user = trackUser(await createUserDirect());
    await loginViaApi(user.email, VALID_PASSWORD);

    const session = await prisma.authSession.findFirstOrThrow({
      where: { userId: user.id },
    });

    const expiredTime = new Date(Date.now() - 5 * 1000);
    const originalActivity = new Date(Date.now() - 10 * 60 * 1000);
    const originalCreatedAt = new Date(originalActivity.getTime() - 60 * 1000);

    await prisma.authSession.update({
      where: { id: session.id },
      data: {
        createdAt: originalCreatedAt,
        lastActivityAt: originalActivity,
        expiresAt: expiredTime,
      },
    });

    const snapshot: SessionSnapshot = {
      id: session.id,
      userId: session.userId,
      createdAt: originalCreatedAt,
      lastActivityAt: originalActivity,
      expiresAt: expiredTime,
      revokedAt: null,
      userAgent: session.userAgent,
    };

    const result = await touchSession(snapshot);
    expect(result.status).toBe("invalid");

    const after = await prisma.authSession.findUniqueOrThrow({
      where: { id: session.id },
    });
    expect(after.expiresAt.getTime()).toBe(expiredTime.getTime());
  });

  it("handles concurrent refresh attempts on the same snapshot with exactly one winning CAS", async () => {
    const user = trackUser(await createUserDirect());
    await loginViaApi(user.email, VALID_PASSWORD);

    const agedActivity = new Date(Date.now() - 15 * 60 * 1000);
    const agedCreatedAt = new Date(agedActivity.getTime() - 60 * 1000);

    await prisma.authSession.updateMany({
      where: { userId: user.id },
      data: {
        createdAt: agedCreatedAt,
        lastActivityAt: agedActivity,
        expiresAt: new Date(agedActivity.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const session = await prisma.authSession.findFirstOrThrow({
      where: { userId: user.id },
    });

    const snapshot: SessionSnapshot = {
      id: session.id,
      userId: session.userId,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      expiresAt: session.expiresAt,
      revokedAt: null,
      userAgent: session.userAgent,
    };

    // Concurrently trigger two touches using the identical snapshot
    const [resA, resB] = await Promise.all([
      touchSession(snapshot),
      touchSession(snapshot),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual(["refreshed", "stale"]);

    const after = await prisma.authSession.findUniqueOrThrow({
      where: { id: session.id },
    });

    expect(after.lastActivityAt.getTime()).toBeGreaterThan(agedActivity.getTime());
    expect(after.expiresAt.getTime()).toBeGreaterThan(session.expiresAt.getTime());
  });

  it("handles concurrent HTTP requests during refresh window without duplicate conflicting cookie updates", async () => {
    const user = trackUser(await createUserDirect());
    const { cookie } = await loginViaApi(user.email, VALID_PASSWORD);

    const agedActivity = new Date(Date.now() - 15 * 60 * 1000);
    const agedCreatedAt = new Date(agedActivity.getTime() - 60 * 1000);

    await prisma.authSession.updateMany({
      where: { userId: user.id },
      data: {
        createdAt: agedCreatedAt,
        lastActivityAt: agedActivity,
        expiresAt: new Date(agedActivity.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Send two concurrent requests using the aged session cookie
    const [reqA, reqB] = await Promise.all([
      request(app).get("/api/me").set("Cookie", cookie),
      request(app).get("/api/me").set("Cookie", cookie),
    ]);

    expect(reqA.status).toBe(200);
    expect(reqB.status).toBe(200);

    const cookieA = reqA.headers["set-cookie"];
    const cookieB = reqB.headers["set-cookie"];

    // Exactly one of the two concurrent requests won the CAS and emitted Set-Cookie
    const hasCookieA = cookieA !== undefined;
    const hasCookieB = cookieB !== undefined;
    expect(hasCookieA !== hasCookieB).toBe(true);

    const refreshedCookieHeader = (hasCookieA ? cookieA : cookieB)?.[0] ?? "";
    expect(refreshedCookieHeader).toContain("tw_session=");
    expect(refreshedCookieHeader).toContain("Max-Age=");
    expect(refreshedCookieHeader.split(";")[0]).toBe(cookie);
  });

  it("handles a genuine concurrent race between revocation and touchSession", async () => {
    const user = trackUser(await createUserDirect());
    await loginViaApi(user.email, VALID_PASSWORD);

    const agedActivity = new Date(Date.now() - 15 * 60 * 1000);
    const agedCreatedAt = new Date(agedActivity.getTime() - 60 * 1000);

    await prisma.authSession.updateMany({
      where: { userId: user.id },
      data: {
        createdAt: agedCreatedAt,
        lastActivityAt: agedActivity,
        expiresAt: new Date(agedActivity.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const session = await prisma.authSession.findFirstOrThrow({
      where: { userId: user.id },
    });

    const originalExpiresAt = session.expiresAt;

    const snapshot: SessionSnapshot = {
      id: session.id,
      userId: session.userId,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      expiresAt: session.expiresAt,
      revokedAt: null,
      userAgent: session.userAgent,
    };

    // Concurrently trigger revocation and touchSession in parallel
    const [, touchResult] = await Promise.all([
      prisma.authSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      touchSession(snapshot),
    ]);

    // In all serializations, the session must end up revoked in the database
    const finalSession = await prisma.authSession.findUniqueOrThrow({
      where: { id: session.id },
    });
    expect(finalSession.revokedAt).not.toBeNull();

    if (touchResult.status === "invalid") {
      // Revocation committed before touchSession CAS: expiry was untouched
      expect(finalSession.expiresAt.getTime()).toBe(originalExpiresAt.getTime());
    } else {
      // touchSession CAS committed before revocation: touchResult was refreshed
      expect(touchResult.status).toBe("refreshed");
    }
  });
});
