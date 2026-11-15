import { prisma } from "../lib/prisma.js";
import { cleanupExpiredRateLimits } from "../services/rateLimit.service.js";

/**
 * Removes rate-limit buckets whose window and cooldown have both expired.
 *
 * Run with `npm run rate-limits:cleanup`. The buckets are bounded by the
 * number of distinct identifiers seen, so this keeps the table small without
 * affecting any live limit.
 */
async function main(): Promise<void> {
  try {
    const removed = await cleanupExpiredRateLimits();

    console.log(`Removed ${removed} expired rate-limit bucket(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Rate-limit cleanup failed:", error);
  process.exitCode = 1;
});
