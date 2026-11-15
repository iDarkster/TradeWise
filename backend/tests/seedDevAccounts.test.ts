import { describe, expect, it, afterEach } from "vitest";
import { resetConfig } from "../src/config/env.js";
import {
  assertDevelopmentEnvironment,
  DEV_TEST_ACCOUNTS,
  seedDevAccounts,
  SeedEnvironmentError,
  validateSeedAccount,
  type SeedAccountDefinition,
} from "../src/scripts/seedDevAccounts.service.js";
import { prisma } from "../src/lib/prisma.js";
import { verifyPassword } from "../src/utils/crypto.js";

describe("seedDevAccounts service", () => {
  afterEach(() => {
    resetConfig();
  });
  it("defines 5 valid canonical test accounts (1 ADMIN + 4 USER)", () => {
    expect(DEV_TEST_ACCOUNTS).toHaveLength(5);

    const adminAccounts = DEV_TEST_ACCOUNTS.filter((a) => a.role === "ADMIN");
    const userAccounts = DEV_TEST_ACCOUNTS.filter((a) => a.role === "USER");

    expect(adminAccounts).toHaveLength(1);
    expect(userAccounts).toHaveLength(4);

    for (const account of DEV_TEST_ACCOUNTS) {
      expect(() => validateSeedAccount(account)).not.toThrow();
    }
  });

  it("rejects seed account with invalid password (violating policy)", () => {
    const invalidAccount: SeedAccountDefinition = {
      email: "invalid@tradewise.local",
      username: "invalid_user",
      fullName: "Invalid User",
      password: "password with spaces 123!",
      role: "USER",
    };

    expect(() => validateSeedAccount(invalidAccount)).toThrow();
  });

  it("strictly prevents seeding when environment is production", () => {
    const originalNodeEnv = process.env.NODE_ENV;

    try {
      process.env.NODE_ENV = "production";
      resetConfig();
      expect(() => assertDevelopmentEnvironment()).toThrow(SeedEnvironmentError);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      resetConfig();
    }
  });

  it("seeds accounts idempotently and verifies password hashing", async () => {
    const testSuffix = Date.now().toString().slice(-6);
    const customTestAccounts: SeedAccountDefinition[] = [
      {
        email: `test_admin_${testSuffix}@tradewise.local`,
        username: `adm_${testSuffix}`,
        fullName: "Test Admin Unit",
        password: "DevAdmin123!",
        role: "ADMIN",
      },
      {
        email: `test_user_${testSuffix}@tradewise.local`,
        username: `usr_${testSuffix}`,
        fullName: "Test User Unit",
        password: "DevUser123!",
        role: "USER",
      },
    ];

    try {
      // First run: accounts should be created
      const firstRun = await seedDevAccounts(customTestAccounts);
      expect(firstRun.createdCount).toBe(2);
      expect(firstRun.skippedCount).toBe(0);

      // Verify records in DB
      for (const def of customTestAccounts) {
        const dbUser = await prisma.user.findUnique({
          where: { email: def.email },
          include: { profile: true },
        });

        expect(dbUser).not.toBeNull();
        expect(dbUser?.role).toBe(def.role);
        expect(dbUser?.profile?.username).toBe(def.username);
        expect(dbUser?.profile?.fullName).toBe(def.fullName);

        // Verify password hash with Argon2id
        const isPasswordValid = await verifyPassword(
          dbUser!.passwordHash,
          def.password,
        );
        expect(isPasswordValid).toBe(true);
      }

      // Second run: accounts already exist, should be skipped (idempotent)
      const secondRun = await seedDevAccounts(customTestAccounts);
      expect(secondRun.createdCount).toBe(0);
      expect(secondRun.skippedCount).toBe(2);
      expect(secondRun.results[0].status).toBe("SKIPPED");
      expect(secondRun.results[1].status).toBe("SKIPPED");
    } finally {
      // Clean up test accounts and audit logs
      const emails = customTestAccounts.map((a) => a.email);
      const testUsers = await prisma.user.findMany({
        where: { email: { in: emails } },
        select: { id: true },
      });
      const ids = testUsers.map((u) => u.id);

      await prisma.$executeRawUnsafe(
        'ALTER TABLE "SecurityAuditLog" DISABLE TRIGGER USER',
      );
      try {
        await prisma.securityAuditLog.deleteMany({
          where: { userId: { in: ids } },
        });
        await prisma.user.deleteMany({
          where: { id: { in: ids } },
        });
      } finally {
        await prisma.$executeRawUnsafe(
          'ALTER TABLE "SecurityAuditLog" ENABLE TRIGGER USER',
        );
      }
    }
  });
});
