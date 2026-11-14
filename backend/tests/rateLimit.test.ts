import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import {
  clearRateLimits,
  createUserDirect,
  removeTrackedUsers,
  trackUser,
  trackUserId,
  VALID_PASSWORD,
} from "./helpers/testData.js";
import {
  hashIdentifier,
  isBlocked,
  LOGIN_ACCOUNT_POLICY,
  LOGIN_IP_POLICY,
  RateLimitIdentifierType,
  RateLimitScope,
  readBucket,
  recordAttempt,
  REGISTRATION_EMAIL_POLICY,
  REGISTRATION_IP_POLICY,
} from "../src/services/rateLimit.service.js";

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

async function failedLogin(email: string, forwardedFor?: string): Promise<number> {
  const test = request(app)
    .post("/api/auth/login")
    .send({ identifier: email, password: "WrongPass1!" });

  if (forwardedFor) {
    test.set("X-Forwarded-For", forwardedFor);
  }

  const response = await test;

  return response.status;
}

describe("login rate limiting", () => {
  it("blocks an account after five failed attempts", async () => {
    const user = trackUser(await createUserDirect());

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(await failedLogin(user.email)).toBe(401);
    }

    const blocked = await failedLogin(user.email);

    expect(blocked).toBe(429);
    expect((await isBlocked(
      RateLimitScope.LOGIN,
      RateLimitIdentifierType.ACCOUNT,
      user.id,
    )).blocked).toBe(true);
  });

  it("keeps a blocked account blocked even with the correct password", async () => {
    const user = trackUser(await createUserDirect());

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await failedLogin(user.email);
    }

    const response = await request(app)
      .post("/api/auth/login")
      .send({ identifier: user.email, password: VALID_PASSWORD });

    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe("RATE_LIMITED");

    const sessions = await prisma.authSession.count({
      where: { userId: user.id },
    });

    expect(sessions).toBe(0);
  });

  it("does not extend the cooldown when further attempts are made", async () => {
    const user = trackUser(await createUserDirect());

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await failedLogin(user.email);
    }

    const first = await readBucket(
      RateLimitScope.LOGIN,
      RateLimitIdentifierType.ACCOUNT,
      user.id,
    );

    expect(first?.blockedUntil).not.toBeNull();

    await failedLogin(user.email);
    await failedLogin(user.email);

    const second = await readBucket(
      RateLimitScope.LOGIN,
      RateLimitIdentifierType.ACCOUNT,
      user.id,
    );

    expect(second?.blockedUntil?.getTime()).toBe(first?.blockedUntil?.getTime());
  });

  it("keeps the account and IP buckets independent", async () => {
    const first = trackUser(await createUserDirect());
    const second = trackUser(await createUserDirect());

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await failedLogin(first.email);
    }

    expect(await failedLogin(second.email)).toBe(401);
  });

  it("blocks the IP bucket after twenty failed attempts", async () => {
    const users = [
      trackUser(await createUserDirect()),
      trackUser(await createUserDirect()),
      trackUser(await createUserDirect()),
      trackUser(await createUserDirect()),
      trackUser(await createUserDirect()),
    ];

    for (const user of users.slice(0, 4)) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await failedLogin(user.email);
      }
    }

    // The twentieth failure has filled the IP bucket.
    expect(await failedLogin(users[4]?.email ?? "")).toBe(429);
  });

  it("resets the account counter after a successful login", async () => {
    const user = trackUser(await createUserDirect());

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await failedLogin(user.email);
    }

    const before = await readBucket(
      RateLimitScope.LOGIN,
      RateLimitIdentifierType.ACCOUNT,
      user.id,
    );

    expect(before?.attemptCount).toBe(3);

    const response = await request(app)
      .post("/api/auth/login")
      .send({ identifier: user.email, password: VALID_PASSWORD });

    expect(response.status).toBe(200);

    const after = await readBucket(
      RateLimitScope.LOGIN,
      RateLimitIdentifierType.ACCOUNT,
      user.id,
    );

    expect(after).toBeNull();
  });

  it("does not reset the IP counter after a successful login", async () => {
    const user = trackUser(await createUserDirect());

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await failedLogin(user.email);
    }

    await request(app)
      .post("/api/auth/login")
      .send({ identifier: user.email, password: VALID_PASSWORD });

    const ipBucket = await readBucket(
      RateLimitScope.LOGIN,
      RateLimitIdentifierType.IP,
      "127.0.0.1",
    );

    expect(ipBucket?.attemptCount).toBe(3);
  });

  it("ignores a spoofed forwarded header when no proxy is trusted", async () => {
    expect(app.get("trust proxy")).toEqual([]);

    const users = [];
    for (let index = 0; index < 5; index += 1) {
      users.push(trackUser(await createUserDirect()));
    }

    for (const [index, user] of users.slice(0, 4).entries()) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await failedLogin(user.email, `203.0.113.${index + 1}`);
      }
    }

    // The spoofed addresses were ignored, so the real client address filled
    // the IP bucket and the next attempt is blocked.
    expect(await failedLogin(users[4]?.email ?? "", "203.0.113.99")).toBe(429);
  });

  it("uses the forwarded address when the connecting proxy is trusted", async () => {
    const originalTrust = app.get("trust proxy");

    try {
      app.set("trust proxy", "127.0.0.1");

      const users = [];
      for (let index = 0; index < 5; index += 1) {
        users.push(trackUser(await createUserDirect()));
      }

      for (const user of users.slice(0, 4)) {
        for (let attempt = 0; attempt < 5; attempt += 1) {
          await failedLogin(user.email, "10.0.0.1");
        }
      }

      // A different forwarded address is a different bucket.
      expect(await failedLogin(users[4]?.email ?? "", "10.0.0.2")).toBe(401);
    } finally {
      app.set("trust proxy", originalTrust);
    }
  });

  it("counts every concurrent failure exactly once", async () => {
    const users = [
      trackUser(await createUserDirect()),
      trackUser(await createUserDirect()),
    ];

    await Promise.all(
      users.flatMap((user) =>
        Array.from({ length: 5 }, () => failedLogin(user.email)),
      ),
    );

    const ipBucket = await readBucket(
      RateLimitScope.LOGIN,
      RateLimitIdentifierType.IP,
      "127.0.0.1",
    );

    expect(ipBucket?.attemptCount).toBe(10);
  });

  it("handles concurrent failed attempts: records increments without lost updates, reaches threshold, rejects subsequent attempts with 429, and preserves fixed cooldown", async () => {
    const user = trackUser(await createUserDirect());

    // Concurrently fire 7 failed login requests for the user
    await Promise.all(
      Array.from({ length: 7 }, () => failedLogin(user.email)),
    );

    // 1. Verify the account bucket reached its configured threshold (5) without lost increments
    const accountBucket = await readBucket(
      RateLimitScope.LOGIN,
      RateLimitIdentifierType.ACCOUNT,
      user.id,
    );

    expect(accountBucket).not.toBeNull();
    expect(accountBucket?.attemptCount).toBe(5);
    expect(accountBucket?.blockedUntil).not.toBeNull();
    expect(accountBucket?.blockedUntil!.getTime()).toBeGreaterThan(Date.now());

    const initialBlockedUntil = accountBucket!.blockedUntil!.getTime();

    // 2. Subsequent request must be rejected with 429 RATE_LIMITED
    const blockedResponse = await request(app)
      .post("/api/auth/login")
      .send({ identifier: user.email, password: VALID_PASSWORD });

    expect(blockedResponse.status).toBe(429);
    expect(blockedResponse.body.error.code).toBe("RATE_LIMITED");

    // 3. Further attempts while blocked must not extend the fixed cooldown
    const bucketAfterBlocked = await readBucket(
      RateLimitScope.LOGIN,
      RateLimitIdentifierType.ACCOUNT,
      user.id,
    );

    expect(bucketAfterBlocked?.blockedUntil?.getTime()).toBe(initialBlockedUntil);
    expect(bucketAfterBlocked?.attemptCount).toBe(5);
  });

  it("records direct concurrent increments atomically without lost updates and locks at threshold", async () => {
    const testKey = `test-concurrent-${randomUUID()}`;

    // Concurrently call recordAttempt 8 times in parallel
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        recordAttempt(
          RateLimitScope.LOGIN,
          RateLimitIdentifierType.ACCOUNT,
          testKey,
          LOGIN_ACCOUNT_POLICY,
        ),
      ),
    );

    expect(results).toHaveLength(8);

    const bucket = await readBucket(
      RateLimitScope.LOGIN,
      RateLimitIdentifierType.ACCOUNT,
      testKey,
    );

    // Reached policy threshold of 5 and stayed locked at 5 with fixed cooldown
    expect(bucket?.attemptCount).toBe(5);
    expect(bucket?.blockedUntil).not.toBeNull();

    const blockedUntilTime = bucket!.blockedUntil!.getTime();

    // Additional attempt while blocked preserves attemptCount and cooldown
    const additional = await recordAttempt(
      RateLimitScope.LOGIN,
      RateLimitIdentifierType.ACCOUNT,
      testKey,
      LOGIN_ACCOUNT_POLICY,
    );

    expect(additional.attemptCount).toBe(5);
    expect(additional.blockedUntil?.getTime()).toBe(blockedUntilTime);
  });

  it("fails closed when the rate-limit store cannot be reached", async () => {
    const user = trackUser(await createUserDirect());

    await prisma.$executeRawUnsafe(
      'ALTER TABLE "AuthRateLimit" RENAME TO "AuthRateLimitUnavailable"',
    );

    try {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ identifier: user.email, password: VALID_PASSWORD });

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe("INTERNAL_ERROR");

      const sessions = await prisma.authSession.count({
        where: { userId: user.id },
      });

      expect(sessions).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "AuthRateLimitUnavailable" RENAME TO "AuthRateLimit"',
      );
    }
  });
});

describe("registration rate limiting", () => {
  it("allows five valid registrations from one address and blocks the sixth", async () => {
    const stamp = randomUUID().replace(/-/g, "").slice(0, 8);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const email = `reg-${attempt}-${stamp}@tradewise.test`;

      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email,
          password: VALID_PASSWORD,
          username: `reg_${attempt}_${stamp}`,
          fullName: "Registration Tester",
        });

      expect(response.status).toBe(201);

      const user = await prisma.user.findUniqueOrThrow({
        where: { email },
        select: { id: true },
      });

      trackUserId(user.id);
    }

    const blocked = await request(app)
      .post("/api/auth/register")
      .send({
        email: `reg-blocked-${randomUUID().replace(/-/g, "").slice(0, 8)}@tradewise.test`,
        password: VALID_PASSWORD,
        username: `reg_blocked_${randomUUID().replace(/-/g, "").slice(0, 8)}`,
        fullName: "Registration Tester",
      });

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
  });

  it("does not count invalid requests", async () => {
    const invalid = await request(app)
      .post("/api/auth/register")
      .send({ email: "not-an-email" });

    expect(invalid.status).toBe(400);

    const bucket = await readBucket(
      RateLimitScope.REGISTRATION,
      RateLimitIdentifierType.IP,
      "127.0.0.1",
    );

    expect(bucket).toBeNull();
  });

  it("counts a valid duplicate email attempt against both buckets", async () => {
    const email = `dup-${randomUUID().replace(/-/g, "").slice(0, 8)}@tradewise.test`;
    const username = `dup_${randomUUID().replace(/-/g, "").slice(0, 8)}`;

    const first = await request(app)
      .post("/api/auth/register")
      .send({ email, password: VALID_PASSWORD, username, fullName: "First" });

    expect(first.status).toBe(201);

    const created = await prisma.user.findUniqueOrThrow({
      where: { email },
      select: { id: true },
    });

    trackUserId(created.id);

    const second = await request(app)
      .post("/api/auth/register")
      .send({
        email: email.toUpperCase(),
        password: VALID_PASSWORD,
        username: `other_${randomUUID().replace(/-/g, "").slice(0, 8)}`,
        fullName: "Second",
      });

    expect(second.status).toBe(409);

    const emailBucket = await readBucket(
      RateLimitScope.REGISTRATION,
      RateLimitIdentifierType.EMAIL,
      email.toLowerCase(),
    );

    expect(emailBucket?.attemptCount).toBe(1);

    const ipBucket = await readBucket(
      RateLimitScope.REGISTRATION,
      RateLimitIdentifierType.IP,
      "127.0.0.1",
    );

    expect(ipBucket?.attemptCount).toBe(2);
  });

  it("counts a username collision against the supplied email and IP buckets", async () => {
    const stamp = randomUUID().replace(/-/g, "").slice(0, 8);
    const owner = trackUser(await createUserDirect({ username: `collide_${stamp}` }));
    const email = `collide-${stamp}@tradewise.test`;

    const response = await request(app)
      .post("/api/auth/register")
      .send({
        email,
        password: VALID_PASSWORD,
        username: owner.username,
        fullName: "Collision",
      });

    expect(response.status).toBe(409);

    const emailBucket = await readBucket(
      RateLimitScope.REGISTRATION,
      RateLimitIdentifierType.EMAIL,
      email,
    );

    expect(emailBucket?.attemptCount).toBe(1);

    const ipBucket = await readBucket(
      RateLimitScope.REGISTRATION,
      RateLimitIdentifierType.IP,
      "127.0.0.1",
    );

    expect(ipBucket?.attemptCount).toBe(1);
  });

  it("blocks an email address after three counted attempts", async () => {
    const stamp = randomUUID().replace(/-/g, "").slice(0, 8);
    const email = `limit-${stamp}@tradewise.test`;
    const username = `limit_${stamp}`;

    const first = await request(app)
      .post("/api/auth/register")
      .send({ email, password: VALID_PASSWORD, username, fullName: "First" });

    expect(first.status).toBe(201);

    const created = await prisma.user.findUniqueOrThrow({
      where: { email },
      select: { id: true },
    });

    trackUserId(created.id);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email,
          password: VALID_PASSWORD,
          username: `other_${stamp}_${attempt}`,
          fullName: "Duplicate",
        });

      expect(response.status).toBe(409);
    }

    const blocked = await request(app)
      .post("/api/auth/register")
      .send({
        email,
        password: VALID_PASSWORD,
        username: `other_${stamp}_f`,
        fullName: "Duplicate",
      });

    expect(blocked.status).toBe(429);
  });

  it("resets the email counter after a successful registration", async () => {
    const email = `reset-${randomUUID().replace(/-/g, "").slice(0, 8)}@tradewise.test`;

    const first = await request(app)
      .post("/api/auth/register")
      .send({
        email,
        password: VALID_PASSWORD,
        username: `reset_${randomUUID().replace(/-/g, "").slice(0, 8)}`,
        fullName: "First",
      });

    expect(first.status).toBe(201);

    const created = await prisma.user.findUniqueOrThrow({
      where: { email },
      select: { id: true },
    });

    trackUserId(created.id);

    const bucket = await readBucket(
      RateLimitScope.REGISTRATION,
      RateLimitIdentifierType.EMAIL,
      email,
    );

    expect(bucket).toBeNull();
  });
});

describe("rate-limit identifier storage", () => {
  it("stores keyed HMAC digests rather than raw identifiers", async () => {
    const user = trackUser(await createUserDirect());

    await failedLogin(user.email);

    const rows = await prisma.authRateLimit.findMany();

    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      expect(row.identifierHash).toMatch(/^[0-9a-f]{64}$/);
      expect(row.identifierHash).not.toContain(user.email);
      expect(row.identifierHash).not.toContain(user.id);
      expect(row.identifierHash).not.toContain("127.0.0.1");
    }
  });

  it("derives a different digest per scope and identifier type", () => {
    const account = hashIdentifier(
      RateLimitScope.LOGIN,
      RateLimitIdentifierType.ACCOUNT,
      "value",
    );
    const email = hashIdentifier(
      RateLimitScope.LOGIN,
      RateLimitIdentifierType.EMAIL,
      "value",
    );
    const registration = hashIdentifier(
      RateLimitScope.REGISTRATION,
      RateLimitIdentifierType.ACCOUNT,
      "value",
    );

    expect(account).not.toBe(email);
    expect(account).not.toBe(registration);
  });

  it("uses the documented thresholds and windows", () => {
    expect(LOGIN_ACCOUNT_POLICY.threshold).toBe(5);
    expect(LOGIN_IP_POLICY.threshold).toBe(20);
    expect(REGISTRATION_IP_POLICY.threshold).toBe(5);
    expect(REGISTRATION_EMAIL_POLICY.threshold).toBe(3);
    expect(LOGIN_ACCOUNT_POLICY.windowMs).toBe(15 * 60 * 1000);
    expect(LOGIN_IP_POLICY.windowMs).toBe(15 * 60 * 1000);
    expect(REGISTRATION_IP_POLICY.windowMs).toBe(15 * 60 * 1000);
    expect(REGISTRATION_EMAIL_POLICY.windowMs).toBe(15 * 60 * 1000);
  });
});
