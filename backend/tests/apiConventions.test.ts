import { afterAll, beforeEach, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { createSecurityHeaders } from "../src/middleware/securityHeaders.js";
import {
  clearRateLimits,
  createUserDirect,
  loginViaApi,
  removeTrackedUsers,
  trackUser,
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

describe("API response conventions", () => {
  it("wraps successful responses in the success envelope", async () => {
    const user = trackUser(await createUserDirect());
    const { cookie } = await loginViaApi(user.email, VALID_PASSWORD);

    const response = await request(app).get("/api/me").set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(Object.keys(response.body)).toEqual(["success", "data"]);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeTypeOf("object");
  });

  it("wraps failures in the error envelope", async () => {
    const response = await request(app).get("/api/me");

    expect(response.status).toBe(401);
    expect(Object.keys(response.body)).toEqual(["success", "error"]);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toEqual(expect.any(String));
    expect(response.body.error.message).toEqual(expect.any(String));
  });

  it("reports field-level validation details", async () => {
    const response = await request(app).post("/api/auth/register").send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details.fields).toBeTypeOf("object");
    expect(Object.keys(response.body.error.details.fields)).toEqual(
      expect.arrayContaining(["email", "password", "username", "fullName"]),
    );
  });

  it("uses 201 for registration", async () => {
    const email = `conv-${Date.now()}@tradewise.test`;
    const username = `conv_${Date.now()}`;

    const response = await request(app).post("/api/auth/register").send({
      email,
      password: VALID_PASSWORD,
      username,
      fullName: "Conventions",
    });

    expect(response.status).toBe(201);

    const created = await prisma.user.findUniqueOrThrow({
      where: { email },
      select: { id: true },
    });

    trackUserId(created.id);
  });

  it("uses 204 without a body for logout", async () => {
    const user = trackUser(await createUserDirect());
    const { cookie, csrfToken } = await loginViaApi(user.email, VALID_PASSWORD);

    const response = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
  });

  it("uses 401 for unauthenticated requests", async () => {
    const response = await request(app).get("/api/me");

    expect(response.status).toBe(401);
  });

  it("uses 403 for forbidden requests", async () => {
    const user = trackUser(await createUserDirect());
    const { cookie } = await loginViaApi(user.email, VALID_PASSWORD);

    const response = await request(app)
      .get("/api/admin/users")
      .set("Cookie", cookie);

    expect(response.status).toBe(403);
  });

  it("uses 404 for an unknown route", async () => {
    const response = await request(app).get("/api/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("uses 409 for a conflicting resource", async () => {
    const user = trackUser(await createUserDirect());

    const response = await request(app)
      .post("/api/auth/register")
      .send({
        email: user.email,
        password: VALID_PASSWORD,
        username: `other_${Date.now()}`,
        fullName: "Conflict",
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CONFLICT");
  });

  it("uses 429 when a rate limit is exceeded", async () => {
    const user = trackUser(await createUserDirect());

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app)
        .post("/api/auth/login")
        .send({ identifier: user.email, password: "WrongPass1!" });
    }

    const response = await request(app)
      .post("/api/auth/login")
      .send({ identifier: user.email, password: VALID_PASSWORD });

    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe("RATE_LIMITED");
  });

  it("returns a generic 500 without leaking internal details", async () => {
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
      expect(response.body.error.message).toBe("An unexpected error occurred.");
      expect(response.body.error.details).toBeUndefined();

      const body = JSON.stringify(response.body);

      expect(body).not.toContain("Prisma");
      expect(body).not.toContain("prisma");
      expect(body).not.toContain("AuthRateLimit");
      expect(body).not.toContain("SELECT");
      expect(body).not.toContain("at ");
    } finally {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "AuthRateLimitUnavailable" RENAME TO "AuthRateLimit"',
      );
    }
  });

  it("preserves the health endpoints", async () => {
    const liveness = await request(app).get("/api/health");

    expect(liveness.status).toBe(200);
    expect(liveness.body.status).toBe("ok");

    const readiness = await request(app).get("/api/health/db");

    expect(readiness.status).toBe(200);
    expect(readiness.body.database).toBe("connected");
  });

  it("answers CORS preflight requests for allowed origins only", async () => {
    const allowed = await request(app)
      .options("/api/auth/login")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST");

    expect(allowed.status).toBeLessThan(300);
    expect(allowed.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");

    const denied = await request(app)
      .options("/api/auth/login")
      .set("Origin", "https://not-allowed.example")
      .set("Access-Control-Request-Method", "POST");

    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("Cache-Control on sensitive endpoints (Finding 4)", () => {
  const EXPECTED_NO_CACHE = "no-store, no-cache, must-revalidate, private";
  const EXPECTED_PRAGMA = "no-cache";

  it("sets no-store headers on a successful sensitive GET response (/api/me)", async () => {
    const user = trackUser(await createUserDirect());
    const { cookie } = await loginViaApi(user.email, VALID_PASSWORD);

    const response = await request(app).get("/api/me").set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe(EXPECTED_NO_CACHE);
    expect(response.headers["pragma"]).toBe(EXPECTED_PRAGMA);
  });

  it("sets no-store headers on a login response (/api/auth/login)", async () => {
    const user = trackUser(await createUserDirect());

    const response = await request(app)
      .post("/api/auth/login")
      .send({ identifier: user.email, password: VALID_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe(EXPECTED_NO_CACHE);
    expect(response.headers["pragma"]).toBe(EXPECTED_PRAGMA);
  });

  it("sets no-store headers on an unauthenticated 401 response (/api/me)", async () => {
    const response = await request(app).get("/api/me");

    expect(response.status).toBe(401);
    expect(response.headers["cache-control"]).toBe(EXPECTED_NO_CACHE);
    expect(response.headers["pragma"]).toBe(EXPECTED_PRAGMA);
  });

  it("sets no-store headers on an admin endpoint response (/api/admin/users)", async () => {
    const admin = trackUser(await createUserDirect({ role: "ADMIN" }));
    const { cookie } = await loginViaApi(admin.email, VALID_PASSWORD);

    const response = await request(app)
      .get("/api/admin/users")
      .set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe(EXPECTED_NO_CACHE);
    expect(response.headers["pragma"]).toBe(EXPECTED_PRAGMA);
  });

  it("sets no-store headers on a 204 logout response (/api/auth/logout)", async () => {
    const user = trackUser(await createUserDirect());
    const { cookie, csrfToken } = await loginViaApi(user.email, VALID_PASSWORD);

    const response = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken);

    expect(response.status).toBe(204);
    expect(response.headers["cache-control"]).toBe(EXPECTED_NO_CACHE);
    expect(response.headers["pragma"]).toBe(EXPECTED_PRAGMA);
  });

  it("sets no-store headers on validation errors and CSRF rejections", async () => {
    const valResponse = await request(app).post("/api/auth/register").send({});
    expect(valResponse.status).toBe(400);
    expect(valResponse.headers["cache-control"]).toBe(EXPECTED_NO_CACHE);
    expect(valResponse.headers["pragma"]).toBe(EXPECTED_PRAGMA);

    const user = trackUser(await createUserDirect());
    const { cookie } = await loginViaApi(user.email, VALID_PASSWORD);
    const csrfResponse = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", "invalid-csrf-token");
    expect(csrfResponse.status).toBe(403);
    expect(csrfResponse.headers["cache-control"]).toBe(EXPECTED_NO_CACHE);
    expect(csrfResponse.headers["pragma"]).toBe(EXPECTED_PRAGMA);
  });

  it("does not set no-store on public health endpoints (/api/health, /api/health/db)", async () => {
    const liveness = await request(app).get("/api/health");
    expect(liveness.status).toBe(200);
    expect(liveness.headers["cache-control"]).toBeUndefined();
    expect(liveness.headers["pragma"]).toBeUndefined();

    const readiness = await request(app).get("/api/health/db");
    expect(readiness.status).toBe(200);
    expect(readiness.headers["cache-control"]).toBeUndefined();
    expect(readiness.headers["pragma"]).toBeUndefined();
  });
});

describe("Security headers (Finding 5)", () => {
  const EXPECTED_SECURITY_HEADERS = {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    "referrer-policy": "strict-origin-when-cross-origin",
    "cross-origin-opener-policy": "same-origin",
    "x-dns-prefetch-control": "off",
    "x-permitted-cross-domain-policies": "none",
  };

  it("emits security headers and suppresses X-Powered-By on normal API responses", async () => {
    const user = trackUser(await createUserDirect());
    const { cookie } = await loginViaApi(user.email, VALID_PASSWORD);

    const response = await request(app).get("/api/me").set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(response.headers["x-powered-by"]).toBeUndefined();
    for (const [header, value] of Object.entries(EXPECTED_SECURITY_HEADERS)) {
      expect(response.headers[header]).toBe(value);
    }
  });

  it("emits security headers and suppresses X-Powered-By on public health endpoints", async () => {
    const liveness = await request(app).get("/api/health");

    expect(liveness.status).toBe(200);
    expect(liveness.headers["x-powered-by"]).toBeUndefined();
    for (const [header, value] of Object.entries(EXPECTED_SECURITY_HEADERS)) {
      expect(liveness.headers[header]).toBe(value);
    }
  });

  it("emits security headers and suppresses X-Powered-By on 404 responses", async () => {
    const notFound = await request(app).get("/api/does-not-exist");

    expect(notFound.status).toBe(404);
    expect(notFound.headers["x-powered-by"]).toBeUndefined();
    for (const [header, value] of Object.entries(EXPECTED_SECURITY_HEADERS)) {
      expect(notFound.headers[header]).toBe(value);
    }
  });

  it("emits security headers on CORS preflight requests without interfering with CORS", async () => {
    const preflight = await request(app)
      .options("/api/auth/login")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST");

    expect(preflight.status).toBeLessThan(300);
    expect(preflight.headers["x-powered-by"]).toBeUndefined();
    expect(preflight.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
    for (const [header, value] of Object.entries(EXPECTED_SECURITY_HEADERS)) {
      expect(preflight.headers[header]).toBe(value);
    }
  });

  it("does not emit Cross-Origin-Resource-Policy by default", async () => {
    const response = await request(app).get("/api/health");
    expect(response.headers["cross-origin-resource-policy"]).toBeUndefined();
  });

  it("does not emit HSTS outside of production", async () => {
    const response = await request(app).get("/api/health");
    expect(response.headers["strict-transport-security"]).toBeUndefined();
  });

  it("emits HSTS with max-age=31536000 and no includeSubDomains when in production configuration", async () => {
    const prodMiddleware = createSecurityHeaders({ isProduction: true });
    const prodApp = express();
    prodApp.disable("x-powered-by");
    prodApp.use(prodMiddleware);
    prodApp.get("/test", (_req, res) => {
      res.json({ ok: true });
    });

    const response = await request(prodApp).get("/test");

    expect(response.status).toBe(200);
    expect(response.headers["strict-transport-security"]).toBe("max-age=31536000");
    expect(response.headers["strict-transport-security"]).not.toContain("includeSubDomains");

    const nonProdMiddleware = createSecurityHeaders({ isProduction: false });
    const nonProdApp = express();
    nonProdApp.use(nonProdMiddleware);
    nonProdApp.get("/test", (_req, res) => {
      res.json({ ok: true });
    });

    const nonProdResponse = await request(nonProdApp).get("/test");
    expect(nonProdResponse.status).toBe(200);
    expect(nonProdResponse.headers["strict-transport-security"]).toBeUndefined();
  });
});
