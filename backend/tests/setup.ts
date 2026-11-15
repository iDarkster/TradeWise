import { randomBytes } from "node:crypto";

/**
 * Vitest setup.
 *
 * Runs before every test file. It provides hermetic, per-run secrets and
 * refuses to let the suite touch anything other than a dedicated test
 * database.
 */

process.env.NODE_ENV = "test";

// Ephemeral, per-run secrets. They are never committed and never reused
// between runs, so no test can depend on a hard-coded secret.
process.env.SESSION_SECRET ??= randomBytes(32).toString("hex");
process.env.CSRF_SECRET ??= randomBytes(32).toString("hex");
process.env.RATE_LIMIT_SECRET ??= randomBytes(32).toString("hex");

process.env.COOKIE_SECURE ??= "false";
process.env.COOKIE_SAME_SITE ??= "lax";
process.env.CORS_ALLOWED_ORIGINS ??= "http://localhost:5173";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Source the repository .env.test before running the test suite.",
  );
}

const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "");

if (!databaseName.endsWith("_test")) {
  throw new Error(
    `Refusing to run the test suite against database "${databaseName}". ` +
      "The integration suite requires a dedicated database whose name ends with \"_test\".",
  );
}
