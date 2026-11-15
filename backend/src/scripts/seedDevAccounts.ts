import "./loadEnv.js";
import { ConfigurationError, getConfig } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import {
  DEV_TEST_ACCOUNTS,
  seedDevAccounts,
  SeedEnvironmentError,
} from "./seedDevAccounts.service.js";

/**
 * TradeWise Development Account Seeder CLI.
 *
 * Usage:
 *   npm --prefix backend run seed:dev
 *   npm --prefix backend run db:seed
 *   npm run seed:dev (from root)
 *
 * Idempotently creates 5 development test accounts (1 ADMIN + 4 USERS).
 * Strictly blocked in production.
 */
async function main(): Promise<void> {
  console.log("==================================================");
  console.log("       TradeWise Development Account Seeder       ");
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
    const summary = await seedDevAccounts(DEV_TEST_ACCOUNTS);

    console.log("\nResults:");
    console.table(
      summary.results.map((r) => ({
        Email: r.email,
        Username: r.username,
        Role: r.role,
        Status: r.status,
        ...(r.reason ? { Details: r.reason } : {}),
      })),
    );

    console.log("\nSummary:");
    console.log(`  Total Accounts:   ${summary.totalCount}`);
    console.log(`  Created:          ${summary.createdCount}`);
    console.log(`  Skipped (Exists): ${summary.skippedCount}`);
    console.log("--------------------------------------------------");
    console.log("Development test accounts are ready for use.");
  } catch (error) {
    if (error instanceof SeedEnvironmentError) {
      console.error(`\n[REFUSED] ${error.message}`);
      process.exitCode = 1;
      return;
    }

    console.error("\n[ERROR] Seeding failed unexpectedly:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Unhandled error during seeding:", err);
  process.exitCode = 1;
});
