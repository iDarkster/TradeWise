import { PassThrough, Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  ConfigurationError,
  loadConfig,
} from "../src/config/env.js";
import {
  constantTimeEqualHex,
  generateToken,
  hashPassword,
  hmacSha256Hex,
  sha256Hex,
  verifyPassword,
} from "../src/utils/crypto.js";
import {
  describeClient,
  formatClientLabel,
  normaliseUserAgent,
} from "../src/utils/userAgent.js";
import {
  emailValue,
  enumValue,
  intValue,
  nullable,
  optional,
  parsePartialShape,
  parseShape,
  passwordValue,
  stringValue,
  urlValue,
  usernameValue,
  uuidValue,
  ValidationFailure,
} from "../src/utils/validation.js";
import { promptHidden, promptText, TerminalPrompter } from "../src/scripts/prompt.js";
import { describeDatabaseTarget } from "../src/scripts/bootstrapAdmin.service.js";

const baseEnv = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://user:pass@127.0.0.1:5433/tradewise_test?schema=public",
  SESSION_SECRET: "a".repeat(48),
  CSRF_SECRET: "b".repeat(48),
  RATE_LIMIT_SECRET: "c".repeat(48),
} satisfies NodeJS.ProcessEnv;

describe("configuration", () => {
  it("builds a configuration from a valid environment", () => {
    const config = loadConfig({ ...baseEnv });

    expect(config.nodeEnv).toBe("test");
    expect(config.isProduction).toBe(false);
    expect(config.port).toBe(5001);
    expect(config.cookie.name).toBe("tw_session");
    expect(config.cookie.secure).toBe(false);
    expect(config.cookie.sameSite).toBe("lax");
    expect(config.cookie.domain).toBeUndefined();
    expect(config.cookie.maxAgeMs).toBe(30 * 24 * 60 * 60 * 1000);
    expect(config.session.ttlMs).toBe(30 * 24 * 60 * 60 * 1000);
    expect(config.session.activityRefreshMs).toBe(5 * 60 * 1000);
    expect(config.trustedProxies).toEqual([]);
  });

  it("fails with a clear message when a secret is missing", () => {
    expect(() => {
      const env = { ...baseEnv };
      delete env.SESSION_SECRET;

      loadConfig(env);
    }).toThrow(ConfigurationError);

    try {
      const env = { ...baseEnv };
      delete env.SESSION_SECRET;

      loadConfig(env);
    } catch (error) {
      expect((error as ConfigurationError).problems.join(" ")).toContain(
        "SESSION_SECRET is required",
      );
    }
  });

  it("rejects a secret that is too short", () => {
    try {
      loadConfig({ ...baseEnv, CSRF_SECRET: "short" });
      throw new Error("expected a configuration error");
    } catch (error) {
      expect((error as ConfigurationError).problems.join(" ")).toContain(
        "CSRF_SECRET must be at least 32 characters",
      );
    }
  });

  it("requires explicit CORS origins in production", () => {
    try {
      loadConfig({ ...baseEnv, NODE_ENV: "production" });
      throw new Error("expected a configuration error");
    } catch (error) {
      expect((error as ConfigurationError).problems.join(" ")).toContain(
        "CORS_ALLOWED_ORIGINS is required in production",
      );
    }
  });

  it("rejects a wildcard CORS origin", () => {
    try {
      loadConfig({
        ...baseEnv,
        NODE_ENV: "production",
        CORS_ALLOWED_ORIGINS: "*",
      });
      throw new Error("expected a configuration error");
    } catch (error) {
      expect((error as ConfigurationError).problems.join(" ")).toContain(
        "must not contain '*'",
      );
    }
  });

  it("marks the cookie as secure in production", () => {
    const config = loadConfig({
      ...baseEnv,
      NODE_ENV: "production",
      CORS_ALLOWED_ORIGINS: "https://app.tradewise.example",
    });

    expect(config.isProduction).toBe(true);
    expect(config.cookie.secure).toBe(true);
  });

  it("requires a secure cookie when SameSite is none", () => {
    try {
      loadConfig({
        ...baseEnv,
        NODE_ENV: "production",
        CORS_ALLOWED_ORIGINS: "https://app.tradewise.example",
        COOKIE_SAME_SITE: "none",
        COOKIE_SECURE: "false",
      });
      throw new Error("expected a configuration error");
    } catch (error) {
      expect((error as ConfigurationError).problems.join(" ")).toContain(
        "COOKIE_SAME_SITE=none requires COOKIE_SECURE=true",
      );
    }
  });

  it("rejects an invalid port and environment name", () => {
    try {
      loadConfig({ ...baseEnv, PORT: "not-a-port" });
      throw new Error("expected a configuration error");
    } catch (error) {
      expect((error as ConfigurationError).problems.join(" ")).toContain(
        "PORT must be an integer",
      );
    }

    try {
      loadConfig({ ...baseEnv, NODE_ENV: "staging" });
      throw new Error("expected a configuration error");
    } catch (error) {
      expect((error as ConfigurationError).problems.join(" ")).toContain(
        "NODE_ENV must be one of",
      );
    }
  });

  it("reads the trusted proxy list", () => {
    const config = loadConfig({
      ...baseEnv,
      TRUSTED_PROXIES: "127.0.0.1, 10.0.0.0/8",
    });

    expect(config.trustedProxies).toEqual(["127.0.0.1", "10.0.0.0/8"]);
  });
});

describe("validation helpers", () => {
  it("normalises email addresses", () => {
    expect(emailValue().parse("  User@Example.COM ", "email")).toBe(
      "user@example.com",
    );
  });

  it("rejects invalid email addresses", () => {
    expect(() => emailValue().parse("nope", "email")).toThrow();
    expect(() => emailValue().parse("a@b", "email")).toThrow();
    expect(() => emailValue().parse(42, "email")).toThrow();
  });

  it("enforces the username rules", () => {
    expect(usernameValue().parse("Valid_1", "username")).toBe("Valid_1");
    expect(() => usernameValue().parse("ab", "username")).toThrow();
    expect(() => usernameValue().parse("a".repeat(21), "username")).toThrow();
    expect(() => usernameValue().parse("with space", "username")).toThrow();
    expect(() => usernameValue().parse("dash-name", "username")).toThrow();
  });

  it("enforces the password rules", () => {
    // Valid representative cases (case-agnostic, length >= 8 and <= 128, digit + special char)
    expect(passwordValue().parse("darkster123!", "password")).toBe("darkster123!");
    expect(passwordValue().parse("Darkster123!", "password")).toBe("Darkster123!");
    expect(passwordValue().parse("ValidPass1!", "password")).toBe("ValidPass1!");

    // Invalid whitespace anywhere (internal, leading, trailing, tab, newline)
    expect(() => passwordValue().parse("darkster 123!", "password")).toThrow();
    expect(() => passwordValue().parse(" darkster123!", "password")).toThrow();
    expect(() => passwordValue().parse("darkster123! ", "password")).toThrow();
    expect(() => passwordValue().parse("darkster\t123!", "password")).toThrow();
    expect(() => passwordValue().parse("darkster\n123!", "password")).toThrow();

    // Invalid missing requirements or length boundaries
    expect(() => passwordValue().parse("darkster!", "password")).toThrow();
    expect(() => passwordValue().parse("darkster123", "password")).toThrow();
    expect(() => passwordValue().parse("d1!", "password")).toThrow();
    expect(() => passwordValue().parse("Aa1!".repeat(33), "password")).toThrow();
    expect(() => passwordValue().parse("A".repeat(129), "password")).toThrow();
    expect(() => passwordValue().parse("NoDigitsHere!", "password")).toThrow();
    expect(() => passwordValue().parse("NoSpecials123", "password")).toThrow();
  });

  it("validates URLs, identifiers, integers and dates", () => {
    expect(urlValue().parse("https://example.com/a.png", "avatarUrl")).toBe(
      "https://example.com/a.png",
    );
    expect(() => urlValue().parse("javascript:alert(1)", "avatarUrl")).toThrow();

    expect(
      uuidValue().parse("3f2504e0-4f89-11d3-9a0c-0305e82c3301", "id"),
    ).toBe("3f2504e0-4f89-11d3-9a0c-0305e82c3301");
    expect(() => uuidValue().parse("not-a-uuid", "id")).toThrow();

    expect(intValue({ min: 1, max: 100 }).parse("42", "limit")).toBe(42);
    expect(() => intValue({ min: 1 }).parse("0", "limit")).toThrow();
    expect(() => intValue().parse("abc", "limit")).toThrow();

    expect(enumValue(["ACTIVE", "SUSPENDED"]).parse("ACTIVE", "status")).toBe(
      "ACTIVE",
    );
    expect(() => enumValue(["ACTIVE"]).parse("OTHER", "status")).toThrow();
  });

  it("supports optional and nullable fields", () => {
    expect(optional(stringValue()).parse(undefined, "a")).toBeUndefined();
    expect(nullable(stringValue()).parse(null, "a")).toBeNull();
    expect(() => nullable(stringValue()).parse(5, "a")).toThrow();
  });

  it("collects every field error in one report", () => {
    try {
      parseShape(
        { email: emailValue(), username: usernameValue(), password: passwordValue() },
        { email: "nope", username: "x" },
      );
      throw new Error("expected a validation failure");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationFailure);
      const failure = error as ValidationFailure;
      expect(Object.keys(failure.fields).sort()).toEqual([
        "email",
        "password",
        "username",
      ]);
    }
  });

  it("rejects unknown fields when asked to", () => {
    try {
      parseShape({ username: usernameValue() }, { username: "valid", role: "ADMIN" }, {
        rejectUnknown: true,
      });
      throw new Error("expected a validation failure");
    } catch (error) {
      const failure = error as ValidationFailure;
      expect(failure.fields.role).toBeTruthy();
    }
  });

  it("only validates the keys that are present in a partial update", () => {
    const result = parsePartialShape(
      { username: usernameValue(), fullName: stringValue() },
      { fullName: "Only Name" },
    );

    expect(result).toEqual({ fullName: "Only Name" });
  });
});

describe("cryptographic helpers", () => {
  it("hashes and verifies a password with Argon2id", async () => {
    const hash = await hashPassword("ValidPass1!");

    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(hash).not.toContain("ValidPass1!");
    expect(await verifyPassword(hash, "ValidPass1!")).toBe(true);
    expect(await verifyPassword(hash, "WrongPass1!")).toBe(false);
  });

  it("treats a malformed hash as a failed verification", async () => {
    expect(await verifyPassword("not-a-hash", "ValidPass1!")).toBe(false);
  });

  it("generates unique high-entropy tokens", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateToken(32)));

    expect(tokens.size).toBe(200);
    expect([...tokens][0]?.length).toBeGreaterThanOrEqual(40);
  });

  it("computes stable digests", () => {
    expect(sha256Hex("value")).toHaveLength(64);
    expect(sha256Hex("value")).toBe(sha256Hex("value"));
    expect(hmacSha256Hex("secret", "value")).not.toBe(sha256Hex("value"));
    expect(hmacSha256Hex("secret", "value")).toBe(
      hmacSha256Hex("secret", "value"),
    );
    expect(hmacSha256Hex("other", "value")).not.toBe(
      hmacSha256Hex("secret", "value"),
    );
  });

  it("compares digests in constant time without throwing on a length mismatch", () => {
    expect(constantTimeEqualHex("abc", "abc")).toBe(true);
    expect(constantTimeEqualHex("abc", "abd")).toBe(false);
    expect(constantTimeEqualHex("abc", "abcd")).toBe(false);
  });
});

describe("client description", () => {
  it("describes common browsers and platforms", () => {
    expect(
      describeClient(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      ),
    ).toEqual({ browser: "Chrome", platform: "Windows" });

    expect(
      describeClient(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      ),
    ).toEqual({ browser: "Safari", platform: "macOS" });

    expect(describeClient(undefined)).toEqual({
      browser: "Unknown browser",
      platform: "Unknown platform",
    });
  });

  it("formats a readable label", () => {
    expect(formatClientLabel(undefined)).toBe("Unknown client");
    expect(formatClientLabel("Mozilla/5.0 (X11; Linux x86_64) Firefox/121.0")).toBe(
      "Firefox on Linux",
    );
  });

  it("normalises and bounds the stored user agent", () => {
    expect(normaliseUserAgent(undefined)).toBeNull();
    expect(normaliseUserAgent("   ")).toBeNull();
    expect(normaliseUserAgent("Mozilla/5.0")).toBe("Mozilla/5.0");
    expect(normaliseUserAgent("x".repeat(600))).toHaveLength(512);
  });
});

describe("terminal prompts", () => {
  it("never echoes the secret it reads", async () => {
    const input = new PassThrough();
    const chunks: string[] = [];
    const output = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(String(chunk));
        callback();
      },
    });

    const pending = promptHidden("Password: ", { input, output });

    input.write("sup3r-s3cret\n");

    const answer = await pending;

    expect(answer).toBe("sup3r-s3cret");
    expect(chunks.join("")).not.toContain("sup3r-s3cret");
    expect(chunks.join("")).toContain("Password: ");
  });

  it("never echoes a secret read from a terminal", async () => {
    const input = new PassThrough() as PassThrough & { isTTY: boolean };
    input.isTTY = true;

    const chunks: string[] = [];
    const output = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(String(chunk));
        callback();
      },
    });

    const prompter = new TerminalPrompter({ input, output });

    const pending = prompter.askSecret("Password: ");

    input.write("terminal-s3cret\n");

    const answer = await pending;

    prompter.close();

    expect(answer).toBe("terminal-s3cret");
    expect(chunks.join("")).not.toContain("terminal-s3cret");
    expect(chunks.join("")).toContain("Password: ");
  });

  it("reads visible text", async () => {
    const input = new PassThrough();
    const chunks: string[] = [];
    const output = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(String(chunk));
        callback();
      },
    });

    const pending = promptText("Email: ", { input, output });

    input.write("admin@tradewise.test\n");

    await expect(pending).resolves.toBe("admin@tradewise.test");
    // A pipe has no terminal echo, so only the question is written out.
    expect(chunks.join("")).toContain("Email: ");
  });

  it("keeps piped lines in order across several questions", async () => {
    const input = new PassThrough();
    const output = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    });

    const prompter = new TerminalPrompter({ input, output });

    const pending = (async () => {
      const email = await prompter.ask("Email: ");
      const username = await prompter.ask("Username: ");
      const secret = await prompter.askSecret("Password: ");
      return { email, username, secret };
    })();

    input.write("first@tradewise.test\nsecond_user\ns3cret\n");

    await expect(pending).resolves.toEqual({
      email: "first@tradewise.test",
      username: "second_user",
      secret: "s3cret",
    });

    prompter.close();
  });
});

describe("database target description", () => {
  it("describes the target without revealing the password", () => {
    const target = describeDatabaseTarget(
      "postgresql://tradewise:sup3r-secret@127.0.0.1:5433/tradewise?schema=public",
    );

    expect(target).toEqual({
      host: "127.0.0.1",
      port: "5433",
      database: "tradewise",
      user: "tradewise",
    });
    expect(JSON.stringify(target)).not.toContain("sup3r-secret");
  });
});
