import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

/**
 * Runtime configuration.
 *
 * Every secret is read from the environment, validated once and surfaced
 * through `getConfig()`. Secrets never have built-in defaults: a missing or
 * weak value is a startup error with an actionable message.
 */

export type NodeEnv = "development" | "test" | "production";

export type SameSite = "lax" | "strict" | "none";

export interface CookieConfig {
  name: string;
  secure: boolean;
  sameSite: SameSite;
  /** Undefined keeps the cookie host-only. */
  domain: string | undefined;
  path: string;
  /** Cookie lifetime in milliseconds. Mirrors the sliding session lifetime. */
  maxAgeMs: number;
}

export interface CorsConfig {
  allowedOrigins: string[];
}

export interface SessionConfig {
  /** Sliding inactivity lifetime of a session. */
  ttlMs: number;
  /** Minimum delay between two persisted activity/expiry refreshes. */
  activityRefreshMs: number;
}

export interface AppConfig {
  nodeEnv: NodeEnv;
  isProduction: boolean;
  port: number;
  databaseUrl: string;
  sessionSecret: string;
  csrfSecret: string;
  rateLimitSecret: string;
  cookie: CookieConfig;
  cors: CorsConfig;
  /** IPs/CIDRs of reverse proxies whose forwarded headers may be trusted. */
  trustedProxies: string[];
  session: SessionConfig;
}

export class ConfigurationError extends Error {
  constructor(readonly problems: string[]) {
    super(
      `Invalid configuration:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`,
    );
    this.name = "ConfigurationError";
  }
}

/** 30 days of inactivity keeps a session alive. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Activity is persisted at most once every five minutes per session. */
const ACTIVITY_REFRESH_MS = 5 * 60 * 1000;

const MIN_SECRET_LENGTH = 32;

const DEFAULT_COOKIE_NAME = "tw_session";

/** Vite's default development server origin. */
const DEFAULT_DEV_ORIGIN = "http://localhost:5173";

const moduleDir = dirname(fileURLToPath(import.meta.url));

function envFileCandidates(): string[] {
  const candidates: string[] = [];

  if (process.env.DOTENV_CONFIG_PATH) {
    candidates.push(resolve(process.env.DOTENV_CONFIG_PATH));
  }

  // Repository root `.env` (backend/src/config -> backend/src -> backend -> root).
  candidates.push(resolve(moduleDir, "../../../.env"));
  candidates.push(resolve(moduleDir, "../../.env"));
  candidates.push(resolve(process.cwd(), ".env"));
  candidates.push(resolve(process.cwd(), "../.env"));

  return candidates;
}

let envFilesLoaded = false;

/**
 * Loads the local `.env` file once. Deliberately skipped under
 * NODE_ENV=test so that a test run can never silently pick up the
 * development database URL.
 */
export function loadEnvFiles(): void {
  if (envFilesLoaded) return;
  envFilesLoaded = true;

  if (process.env.NODE_ENV === "test") return;

  for (const candidate of envFileCandidates()) {
    if (existsSync(candidate)) {
      dotenv.config({ path: candidate });
      return;
    }
  }
}

function readSecret(
  env: NodeJS.ProcessEnv,
  name: string,
  problems: string[],
): string {
  const value = env[name];

  if (value === undefined || value.trim() === "") {
    problems.push(`${name} is required but was not set.`);
    return "";
  }

  if (value.length < MIN_SECRET_LENGTH) {
    problems.push(
      `${name} must be at least ${MIN_SECRET_LENGTH} characters long (received ${value.length}).`,
    );
  }

  return value;
}

function readOrigins(env: NodeJS.ProcessEnv, nodeEnv: NodeEnv, problems: string[]): string[] {
  const raw = env.CORS_ALLOWED_ORIGINS;

  if (raw === undefined || raw.trim() === "") {
    if (nodeEnv === "production") {
      problems.push(
        "CORS_ALLOWED_ORIGINS is required in production. Set it to a comma-separated list of allowed frontend origins.",
      );
      return [];
    }

    return [DEFAULT_DEV_ORIGIN];
  }

  const origins = raw
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter((origin) => origin.length > 0);

  if (origins.length === 0) {
    problems.push("CORS_ALLOWED_ORIGINS did not contain any usable origin.");
  }

  if (origins.includes("*")) {
    problems.push(
      "CORS_ALLOWED_ORIGINS must not contain '*'. Explicit origins are required for credentialed requests.",
    );
  }

  return origins;
}

function readSameSite(env: NodeJS.ProcessEnv, problems: string[]): SameSite {
  const raw = (env.COOKIE_SAME_SITE ?? "lax").trim().toLowerCase();

  if (raw === "lax" || raw === "strict" || raw === "none") {
    return raw;
  }

  problems.push(
    `COOKIE_SAME_SITE must be one of lax, strict, none (received "${raw}").`,
  );

  return "lax";
}

function readPort(env: NodeJS.ProcessEnv, problems: string[]): number {
  const raw = env.PORT ?? "5001";
  const port = Number(raw);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    problems.push(`PORT must be an integer between 1 and 65535 (received "${raw}").`);
    return 5001;
  }

  return port;
}

function readTrustedProxies(env: NodeJS.ProcessEnv): string[] {
  const raw = env.TRUSTED_PROXIES;

  if (!raw) return [];

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * Builds a configuration object from an environment bag. Pure: it performs
 * no I/O so it can be exercised directly by tests.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const problems: string[] = [];

  const nodeEnvRaw = (env.NODE_ENV ?? "development").trim().toLowerCase();
  let nodeEnv: NodeEnv = "development";

  if (nodeEnvRaw === "development" || nodeEnvRaw === "test" || nodeEnvRaw === "production") {
    nodeEnv = nodeEnvRaw;
  } else {
    problems.push(
      `NODE_ENV must be one of development, test, production (received "${nodeEnvRaw}").`,
    );
  }

  const databaseUrl = env.DATABASE_URL?.trim() ?? "";

  if (databaseUrl === "") {
    problems.push("DATABASE_URL is required but was not set.");
  }

  const sessionSecret = readSecret(env, "SESSION_SECRET", problems);
  const csrfSecret = readSecret(env, "CSRF_SECRET", problems);
  const rateLimitSecret = readSecret(env, "RATE_LIMIT_SECRET", problems);

  const sameSite = readSameSite(env, problems);
  const isProduction = nodeEnv === "production";

  const cookieSecureRaw = env.COOKIE_SECURE?.trim().toLowerCase();
  let cookieSecure = isProduction;

  if (cookieSecureRaw !== undefined && cookieSecureRaw !== "") {
    if (cookieSecureRaw === "true" || cookieSecureRaw === "false") {
      cookieSecure = cookieSecureRaw === "true";
    } else {
      problems.push(
        `COOKIE_SECURE must be either true or false (received "${cookieSecureRaw}").`,
      );
    }
  }

  if (sameSite === "none" && !cookieSecure) {
    problems.push(
      "COOKIE_SAME_SITE=none requires COOKIE_SECURE=true, because browsers reject SameSite=None cookies without the Secure attribute.",
    );
  }

  const cookieDomainRaw = env.COOKIE_DOMAIN?.trim();
  const cookieDomain = cookieDomainRaw && cookieDomainRaw.length > 0 ? cookieDomainRaw : undefined;

  const cookieName = env.COOKIE_NAME?.trim() || DEFAULT_COOKIE_NAME;

  if (!/^[A-Za-z0-9_-]+$/.test(cookieName)) {
    problems.push(
      `COOKIE_NAME may only contain letters, digits, underscores and hyphens (received "${cookieName}").`,
    );
  }

  const corsOrigins = readOrigins(env, nodeEnv, problems);

  const port = readPort(env, problems);

  if (problems.length > 0) {
    throw new ConfigurationError(problems);
  }

  return {
    nodeEnv,
    isProduction,
    port,
    databaseUrl,
    sessionSecret,
    csrfSecret,
    rateLimitSecret,
    cookie: {
      name: cookieName,
      secure: cookieSecure,
      sameSite,
      domain: cookieDomain,
      path: "/",
      maxAgeMs: SESSION_TTL_MS,
    },
    cors: {
      allowedOrigins: corsOrigins,
    },
    trustedProxies: readTrustedProxies(env),
    session: {
      ttlMs: SESSION_TTL_MS,
      activityRefreshMs: ACTIVITY_REFRESH_MS,
    },
  };
}

let cached: AppConfig | undefined;

/** Returns the validated configuration, loading it on first use. */
export function getConfig(): AppConfig {
  if (!cached) {
    loadEnvFiles();
    cached = loadConfig();
  }

  return cached;
}

/** Replaces the cached configuration. Intended for tests. */
export function setConfig(config: AppConfig): void {
  cached = config;
}

/** Clears the cached configuration. Intended for tests. */
export function resetConfig(): void {
  cached = undefined;
}
