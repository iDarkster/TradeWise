import "./loadEnv.js";
import { ConfigurationError, getConfig } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import {
  clearRateLimits,
  ClearRateLimitsEnvironmentError,
} from "./clearRateLimits.service.js";
import { RateLimitScope } from "../services/rateLimit.service.js";

/**
 * TradeWise Rate Limit Clear Utility CLI.
 *
 * Usage:
 *   npm --prefix backend run ratelimit:clear:dev
 *   npm run dev:ratelimit:clear (from root)
 *
 * Strictly blocked in production.
 */
async function main(): Promise<void> {
  console.log("==================================================");
  console.log("    TradeWise Rate Limit Clear Utility (Dev)      ");
  console.log("==================================================");

  try {
    const config = getConfig();
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(`Database:    ${config.databaseUrl.replace(/:[^:@]+@/, ":****@")}`);
    console.log("--------------------------------------------------");
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error(`[Configuration Error] ${error.message}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  try {
    const summary = await clearRateLimits(RateLimitScope.REGISTRATION);
    console.log(`\nCleared ${summary.deletedCount} rate-limit bucket(s) in scope '${summary.scope}'.`);
    console.log("Local registration rate-limit buckets are now pristine.");
  } catch (error) {
    if (error instanceof ClearRateLimitsEnvironmentError) {
      console.error(`[Environment Error] ${error.message}`);
      process.exitCode = 1;
      return;
    }
    console.error("Unexpected error during rate-limit clear:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Fatal error in clearRateLimits:", err);
  process.exitCode = 1;
});
