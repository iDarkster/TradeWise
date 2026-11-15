import "./loadEnv.js";
import { getConfig } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { RateLimitScope, type RateLimitScopeValue } from "../services/rateLimit.service.js";

export class ClearRateLimitsEnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClearRateLimitsEnvironmentError";
  }
}

/**
 * Strictly prevents clearing rate limits outside the development environment.
 * The validated application configuration is the single source of truth.
 */
export function assertDevelopmentEnvironment(): void {
  const config = getConfig();

  if (config.isProduction || config.nodeEnv !== "development") {
    throw new ClearRateLimitsEnvironmentError(
      "Clearing rate limits is strictly prohibited outside the development environment.",
    );
  }
}

export interface ClearRateLimitsResult {
  scope: RateLimitScopeValue;
  deletedCount: number;
}

/**
 * Clears local rate limits for development hygiene.
 * Defaults exclusively to the REGISTRATION scope so unrelated rate-limit scopes
 * are not cleared unnecessarily.
 */
export async function clearRateLimits(
  scope: RateLimitScopeValue = RateLimitScope.REGISTRATION,
): Promise<ClearRateLimitsResult> {
  assertDevelopmentEnvironment();

  const result = await prisma.authRateLimit.deleteMany({
    where: { scope },
  });

  return {
    scope,
    deletedCount: result.count,
  };
}
