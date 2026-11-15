import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resetConfig } from "../src/config/env.js";
import { prisma } from "../src/lib/prisma.js";
import {
  assertDevelopmentEnvironment,
  clearRateLimits,
  ClearRateLimitsEnvironmentError,
} from "../src/scripts/clearRateLimits.service.js";
import {
  RateLimitScope,
  RateLimitIdentifierType,
  recordAttempt,
  REGISTRATION_IP_POLICY,
  LOGIN_IP_POLICY,
} from "../src/services/rateLimit.service.js";

describe("clearRateLimits service", () => {
  beforeEach(async () => {
    await prisma.authRateLimit.deleteMany();
  });

  afterEach(() => {
    resetConfig();
  });

  it("allows clearing rate limits when resolved environment is development", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      // Case 1: Explicit NODE_ENV="development"
      process.env.NODE_ENV = "development";
      resetConfig();
      expect(() => assertDevelopmentEnvironment()).not.toThrow();

      // Case 2: Unset NODE_ENV (defaults to development in local configuration)
      delete process.env.NODE_ENV;
      resetConfig();
      expect(() => assertDevelopmentEnvironment()).not.toThrow();
    } finally {
      process.env.NODE_ENV = originalEnv;
      resetConfig();
    }
  });

  it("strictly prevents clearing rate limits when environment is production", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      resetConfig();
      expect(() => assertDevelopmentEnvironment()).toThrow(ClearRateLimitsEnvironmentError);
      await expect(clearRateLimits()).rejects.toThrow(ClearRateLimitsEnvironmentError);
    } finally {
      process.env.NODE_ENV = originalEnv;
      resetConfig();
    }
  });

  it("strictly prevents clearing rate limits when environment is test", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "test";
      resetConfig();
      expect(() => assertDevelopmentEnvironment()).toThrow(ClearRateLimitsEnvironmentError);
      await expect(clearRateLimits()).rejects.toThrow(ClearRateLimitsEnvironmentError);
    } finally {
      process.env.NODE_ENV = originalEnv;
      resetConfig();
    }
  });

  it("clears registration rate limits without affecting login rate limits", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "development";
      resetConfig();

      // Record registration attempt
      await recordAttempt(
        RateLimitScope.REGISTRATION,
        RateLimitIdentifierType.IP,
        "::1",
        REGISTRATION_IP_POLICY,
      );

      // Record login attempt
      await recordAttempt(
        RateLimitScope.LOGIN,
        RateLimitIdentifierType.IP,
        "::1",
        LOGIN_IP_POLICY,
      );

      const initialTotal = await prisma.authRateLimit.count();
      expect(initialTotal).toBe(2);

      // Clear only registration rate limits
      const result = await clearRateLimits(RateLimitScope.REGISTRATION);
      expect(result.scope).toBe(RateLimitScope.REGISTRATION);
      expect(result.deletedCount).toBe(1);

      // Verify registration rate limit was deleted
      const regCount = await prisma.authRateLimit.count({
        where: { scope: RateLimitScope.REGISTRATION },
      });
      expect(regCount).toBe(0);

      // Verify login rate limit remains intact
      const loginCount = await prisma.authRateLimit.count({
        where: { scope: RateLimitScope.LOGIN },
      });
      expect(loginCount).toBe(1);
    } finally {
      process.env.NODE_ENV = originalEnv;
      resetConfig();
    }
  });
});
