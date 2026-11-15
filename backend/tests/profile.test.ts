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

describe("GET /api/me", () => {
  it("returns the authenticated account", async () => {
    const user = trackUser(await createUserDirect());

    const { cookie } = await loginViaApi(user.email, VALID_PASSWORD);

    const response = await request(app).get("/api/me").set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user).toMatchObject({
      id: user.id,
      email: user.email,
      username: user.username,
      role: "USER",
      status: "ACTIVE",
    });
  });

  it("never exposes the password hash", async () => {
    const user = trackUser(await createUserDirect());

    const { cookie } = await loginViaApi(user.email, VALID_PASSWORD);

    const response = await request(app).get("/api/me").set("Cookie", cookie);

    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    expect(response.body.data.user.passwordHash).toBeUndefined();
  });
});

describe("PATCH /api/me/profile", () => {
  it("updates the allowed profile fields", async () => {
    const user = trackUser(await createUserDirect());

    const { cookie, csrfToken } = await loginViaApi(user.email, VALID_PASSWORD);

    const response = await request(app)
      .patch("/api/me/profile")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .send({
        username: "renamed_user",
        fullName: "Renamed Learner",
        avatarUrl: "https://example.com/avatar.png",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({
      username: "renamed_user",
      fullName: "Renamed Learner",
      avatarUrl: "https://example.com/avatar.png",
    });
  });

  it("clears the avatar when null is supplied", async () => {
    const user = trackUser(await createUserDirect());

    const { cookie, csrfToken } = await loginViaApi(user.email, VALID_PASSWORD);

    await request(app)
      .patch("/api/me/profile")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ avatarUrl: "https://example.com/avatar.png" });

    const response = await request(app)
      .patch("/api/me/profile")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ avatarUrl: null });

    expect(response.status).toBe(200);
    expect(response.body.data.user.avatarUrl).toBeNull();
  });

  it("leaves omitted fields unchanged", async () => {
    const user = trackUser(await createUserDirect({ fullName: "Original Name" }));

    const { cookie, csrfToken } = await loginViaApi(user.email, VALID_PASSWORD);

    const response = await request(app)
      .patch("/api/me/profile")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ fullName: "Changed Name" });

    expect(response.status).toBe(200);
    expect(response.body.data.user.username).toBe(user.username);
    expect(response.body.data.user.fullName).toBe("Changed Name");
  });

  it("rejects an invalid username", async () => {
    const user = trackUser(await createUserDirect());

    const { cookie, csrfToken } = await loginViaApi(user.email, VALID_PASSWORD);

    const response = await request(app)
      .patch("/api/me/profile")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ username: "no spaces allowed" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details.fields.username).toBeTruthy();
  });

  it("rejects a username that is already taken, regardless of case", async () => {
    const owner = trackUser(await createUserDirect({ username: "taken_name" }));
    const other = trackUser(await createUserDirect());

    const { cookie, csrfToken } = await loginViaApi(other.email, VALID_PASSWORD);

    const response = await request(app)
      .patch("/api/me/profile")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ username: "TAKEN_NAME" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CONFLICT");
    expect(owner.username).toBe("taken_name");
  });

  it("rejects an invalid avatar URL", async () => {
    const user = trackUser(await createUserDirect());

    const { cookie, csrfToken } = await loginViaApi(user.email, VALID_PASSWORD);

    for (const avatarUrl of ["not-a-url", "ftp://example.com/a.png"]) {
      const response = await request(app)
        .patch("/api/me/profile")
        .set("Cookie", cookie)
        .set("X-CSRF-Token", csrfToken)
        .send({ avatarUrl });

      expect(response.status).toBe(400);
      expect(response.body.error.details.fields.avatarUrl).toBeTruthy();
    }
  });

  it("refuses to change the email address through the profile endpoint", async () => {
    const user = trackUser(await createUserDirect());

    const { cookie, csrfToken } = await loginViaApi(user.email, VALID_PASSWORD);

    const response = await request(app)
      .patch("/api/me/profile")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ email: "someone-else@tradewise.test" });

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields.email).toContain("email address");

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });

    expect(stored.email).toBe(user.email);
  });

  it("refuses to change the password through the profile endpoint", async () => {
    const user = trackUser(await createUserDirect());

    const { cookie, csrfToken } = await loginViaApi(user.email, VALID_PASSWORD);

    const response = await request(app)
      .patch("/api/me/profile")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ password: "AnotherPass1!" });

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields.password).toContain("password");
  });

  it("rejects an unknown field", async () => {
    const user = trackUser(await createUserDirect());

    const { cookie, csrfToken } = await loginViaApi(user.email, VALID_PASSWORD);

    const response = await request(app)
      .patch("/api/me/profile")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ role: "ADMIN" });

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields.role).toBeTruthy();
  });

  it("cannot escalate the role through the profile endpoint", async () => {
    const user = trackUser(await createUserDirect());

    const { cookie, csrfToken } = await loginViaApi(user.email, VALID_PASSWORD);

    await request(app)
      .patch("/api/me/profile")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ role: "ADMIN" });

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });

    expect(stored.role).toBe("USER");
  });
});

describe("POST /api/me/password", () => {
  it("changes the password and keeps the current session alive", async () => {
    const user = trackUser(await createUserDirect());

    const { cookie, csrfToken } = await loginViaApi(user.email, VALID_PASSWORD);

    const response = await request(app)
      .post("/api/me/password")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ currentPassword: VALID_PASSWORD, newPassword: "BrandNew1!" });

    expect(response.status).toBe(200);

    const stillValid = await request(app).get("/api/me").set("Cookie", cookie);
    expect(stillValid.status).toBe(200);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ identifier: user.email, password: "BrandNew1!" });

    expect(login.status).toBe(200);
  });

  it("revokes every other session", async () => {
    const user = trackUser(await createUserDirect());

    const current = await loginViaApi(user.email, VALID_PASSWORD);
    const other = await loginViaApi(user.email, VALID_PASSWORD);

    const response = await request(app)
      .post("/api/me/password")
      .set("Cookie", current.cookie)
      .set("X-CSRF-Token", current.csrfToken)
      .send({ currentPassword: VALID_PASSWORD, newPassword: "BrandNew1!" });

    expect(response.status).toBe(200);

    const otherSession = await request(app)
      .get("/api/me")
      .set("Cookie", other.cookie);

    expect(otherSession.status).toBe(401);

    const active = await prisma.authSession.findMany({
      where: { userId: user.id, revokedAt: null },
    });

    expect(active).toHaveLength(1);
  });

  it("rejects an incorrect current password", async () => {
    const user = trackUser(await createUserDirect());

    const { cookie, csrfToken } = await loginViaApi(user.email, VALID_PASSWORD);

    const response = await request(app)
      .post("/api/me/password")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ currentPassword: "NotThePassword1!", newPassword: "BrandNew1!" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("enforces the password policy on the new password", async () => {
    const user = trackUser(await createUserDirect());

    const { cookie, csrfToken } = await loginViaApi(user.email, VALID_PASSWORD);

    const response = await request(app)
      .post("/api/me/password")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ currentPassword: VALID_PASSWORD, newPassword: "weak" });

    expect(response.status).toBe(400);
    expect(response.body.error.details.fields.newPassword).toBeTruthy();
  });

  it("rejects new passwords containing spaces or whitespace", async () => {
    const user = trackUser(await createUserDirect());
    const { cookie, csrfToken } = await loginViaApi(user.email, VALID_PASSWORD);

    const invalidPasswords = [
      "New Pass1!",
      " NewPass1!",
      "NewPass1! ",
      "New\tPass1!",
      "New\nPass1!",
    ];

    for (const newPassword of invalidPasswords) {
      const response = await request(app)
        .post("/api/me/password")
        .set("Cookie", cookie)
        .set("X-CSRF-Token", csrfToken)
        .send({ currentPassword: VALID_PASSWORD, newPassword });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(response.body.error.details.fields.newPassword).toBeTruthy();
    }
  });

  it("records a password-change security audit event", async () => {
    const user = trackUser(await createUserDirect());

    const { cookie, csrfToken } = await loginViaApi(user.email, VALID_PASSWORD);

    await request(app)
      .post("/api/me/password")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ currentPassword: VALID_PASSWORD, newPassword: "BrandNew1!" });

    const events = await prisma.securityAuditLog.findMany({
      where: { userId: user.id, eventType: "PASSWORD_CHANGED" },
    });

    expect(events).toHaveLength(1);
  });

  it("never returns password material", async () => {
    const user = trackUser(await createUserDirect());

    const { cookie, csrfToken } = await loginViaApi(user.email, VALID_PASSWORD);

    const response = await request(app)
      .post("/api/me/password")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ currentPassword: VALID_PASSWORD, newPassword: "BrandNew1!" });

    const body = JSON.stringify(response.body);

    expect(body).not.toContain(VALID_PASSWORD);
    expect(body).not.toContain("BrandNew1!");
  });
});
