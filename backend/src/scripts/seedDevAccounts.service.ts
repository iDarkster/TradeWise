import "./loadEnv.js";
import { getConfig } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import {
  recordSecurityEvent,
  SecurityEventType,
} from "../services/securityAudit.service.js";
import { hashPassword } from "../utils/crypto.js";
import {
  emailValue,
  fullNameValue,
  passwordValue,
  usernameValue,
} from "../utils/validation.js";

export interface SeedAccountDefinition {
  email: string;
  username: string;
  fullName: string;
  password: string;
  role: "ADMIN" | "USER";
}

export interface SeedResultItem {
  email: string;
  username: string;
  role: "ADMIN" | "USER";
  status: "CREATED" | "SKIPPED";
  userId?: string;
  reason?: string;
}

export interface SeedSummary {
  results: SeedResultItem[];
  createdCount: number;
  skippedCount: number;
  totalCount: number;
}

export class SeedEnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedEnvironmentError";
  }
}

/**
 * 5 Canonical Development Test Accounts.
 * 1 ADMIN + 4 USERS.
 * Passwords adhere strictly to the TradeWise password policy:
 * >= 8 characters, at least 1 digit, at least 1 special character, no spaces.
 */
export const DEV_TEST_ACCOUNTS: readonly SeedAccountDefinition[] = [
  {
    email: "admin@tradewise.local",
    username: "admin_dev",
    fullName: "TradeWise Admin",
    password: "DevAdmin123!",
    role: "ADMIN",
  },
  {
    email: "user1@tradewise.local",
    username: "user1_dev",
    fullName: "Alice Trader",
    password: "DevUser123!",
    role: "USER",
  },
  {
    email: "user2@tradewise.local",
    username: "user2_dev",
    fullName: "Bob Trader",
    password: "DevUser123!",
    role: "USER",
  },
  {
    email: "user3@tradewise.local",
    username: "user3_dev",
    fullName: "Charlie Trader",
    password: "DevUser123!",
    role: "USER",
  },
  {
    email: "user4@tradewise.local",
    username: "user4_dev",
    fullName: "Diana Trader",
    password: "DevUser123!",
    role: "USER",
  },
] as const;

/**
 * Strictly prevents running the development seeder in production environments.
 */
export function assertDevelopmentEnvironment(): void {
  const config = getConfig();

  if (
    config.isProduction ||
    config.nodeEnv === "production" ||
    process.env.NODE_ENV === "production"
  ) {
    throw new SeedEnvironmentError(
      "Development seeding is strictly prohibited in production environments.",
    );
  }
}

/**
 * Validates a seed account definition against standard validation rules.
 */
export function validateSeedAccount(account: SeedAccountDefinition): void {
  emailValue().parse(account.email, "email");
  usernameValue().parse(account.username, "username");
  fullNameValue().parse(account.fullName, "fullName");
  passwordValue().parse(account.password, "password");
}

/**
 * Seeds the development test accounts into the database idempotently.
 * - Validates input data.
 * - Uses Argon2id password hashing.
 * - Creates User and linked Profile.
 * - Appends audit log event (ADMIN_BOOTSTRAPPED for admin, USER_REGISTERED for users).
 * - Existing accounts (by email or username) are left unmodified without error.
 */
export async function seedDevAccounts(
  accounts: readonly SeedAccountDefinition[] = DEV_TEST_ACCOUNTS,
): Promise<SeedSummary> {
  assertDevelopmentEnvironment();

  const results: SeedResultItem[] = [];
  let createdCount = 0;
  let skippedCount = 0;

  for (const account of accounts) {
    validateSeedAccount(account);

    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: account.email },
          { profile: { username: account.username } },
        ],
      },
      include: { profile: true },
    });

    if (existing) {
      results.push({
        email: account.email,
        username: account.username,
        role: account.role,
        status: "SKIPPED",
        userId: existing.id,
        reason: `Account already exists with id: ${existing.id}`,
      });
      skippedCount++;
      continue;
    }

    const passwordHash = await hashPassword(account.password);

    const createdUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: account.email,
          passwordHash,
          role: account.role,
          isActive: true,
          profile: {
            create: {
              username: account.username,
              fullName: account.fullName,
            },
          },
        },
        include: { profile: true },
      });

      await recordSecurityEvent(
        {
          userId: user.id,
          sessionId: null,
          eventType: SecurityEventType.USER_REGISTERED,
          metadata: {
            actorId: user.id,
            username: user.profile?.username ?? null,
            role: account.role,
            seeded: true,
            source: "seed_dev_accounts",
          },
        },
        tx,
      );

      return user;
    });

    results.push({
      email: createdUser.email,
      username: createdUser.profile?.username ?? account.username,
      role: account.role,
      status: "CREATED",
      userId: createdUser.id,
    });
    createdCount++;
  }

  return {
    results,
    createdCount,
    skippedCount,
    totalCount: accounts.length,
  };
}
