import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { hashPassword } from "../utils/crypto.js";
import {
  emailValue,
  fullNameValue,
  passwordValue,
  usernameValue,
  ValidationFailure,
  type Validator,
} from "../utils/validation.js";
import {
  recordSecurityEvent,
  SecurityEventType,
} from "../services/securityAudit.service.js";

/**
 * Core of the administrator bootstrap command.
 *
 * Separated from the interactive shell so it can be exercised by tests.
 */

export interface BootstrapInput {
  email: string;
  username: string;
  fullName: string;
  password: string;
  passwordConfirmation: string;
}

export interface BootstrapResult {
  id: string;
  email: string;
  username: string;
}

export class BootstrapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BootstrapError";
  }
}

export interface DatabaseTarget {
  host: string;
  port: string;
  database: string;
  user: string;
}

/** Describes the target database without revealing the password. */
export function describeDatabaseTarget(databaseUrl: string): DatabaseTarget {
  const url = new URL(databaseUrl);

  return {
    host: url.hostname,
    port: url.port || "5432",
    database: url.pathname.replace(/^\//, ""),
    user: decodeURIComponent(url.username),
  };
}

/**
 * Validates the supplied administrator details with the same rules that
 * public registration uses.
 *
 * All problems are reported together so the operator can correct the input
 * in one go.
 */
export function validateBootstrapInput(input: BootstrapInput): {
  email: string;
  username: string;
  fullName: string;
  password: string;
} {
  const errors: Record<string, string> = {};

  const read = <T>(field: string, validator: Validator<T>): T | undefined => {
    try {
      return validator.parse(
        (input as unknown as Record<string, unknown>)[field],
        field,
      );
    } catch (error) {
      if (error instanceof Error && "field" in error) {
        errors[field] = error.message;
        return undefined;
      }

      throw error;
    }
  };

  const email = read("email", emailValue());
  const username = read("username", usernameValue());
  const fullName = read("fullName", fullNameValue());
  const password = read("password", passwordValue());

  if (password !== undefined && password !== input.passwordConfirmation) {
    errors.passwordConfirmation = "The passwords do not match.";
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationFailure(errors);
  }

  return {
    email: email as string,
    username: username as string,
    fullName: fullName as string,
    password: password as string,
  };
}

/**
 * 64-bit integer lock identifier for PostgreSQL transaction advisory lock:
 * hex 0x5457_4144_4d49_4e6en ("TWADMINn" in ASCII, decimal 6077397983770005102).
 * Fits within PostgreSQL signed BIGINT range [-2^63, 2^63 - 1].
 */
export const ADMIN_BOOTSTRAP_LOCK_ID = 0x5457_4144_4d49_4e6en;

/** Reports whether an administrator account already exists. */
export async function administratorExists(): Promise<boolean> {
  const count = await prisma.user.count({ where: { role: "ADMIN" } });

  return count > 0;
}

/**
 * Creates the first administrator account.
 *
 * The account, its profile and the bootstrap audit event are created in a
 * single transaction, so a failing audit write rolls the whole bootstrap
 * back and no half-initialised administrator is left behind.
 */
export async function bootstrapAdministrator(
  input: BootstrapInput,
): Promise<BootstrapResult> {
  const validated = validateBootstrapInput(input);

  if (await administratorExists()) {
    throw new BootstrapError(
      "An administrator account already exists. Bootstrap is refused.",
    );
  }

  const passwordHash = await hashPassword(validated.password);

  return prisma.$transaction(async (tx) => {
    // Acquire a transaction-scoped advisory lock to serialize concurrent bootstraps.
    // Automatically released when this transaction commits or rolls back.
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(${ADMIN_BOOTSTRAP_LOCK_ID}::bigint)`,
    );

    // Recheck administrator existence under the lock to prevent race conditions.
    const count = await tx.user.count({ where: { role: "ADMIN" } });
    if (count > 0) {
      throw new BootstrapError(
        "An administrator account already exists. Bootstrap is refused.",
      );
    }

    const user = await tx.user.create({
      data: {
        email: validated.email,
        passwordHash,
        role: "ADMIN",
        isActive: true,
        profile: {
          create: {
            username: validated.username,
            fullName: validated.fullName,
          },
        },
      },
      include: { profile: true },
    });

    await recordSecurityEvent(
      {
        userId: user.id,
        sessionId: null,
        eventType: SecurityEventType.ADMIN_BOOTSTRAPPED,
        metadata: {
          actorId: user.id,
          username: user.profile?.username ?? null,
        },
      },
      tx,
    );

    return {
      id: user.id,
      email: user.email,
      username: user.profile?.username ?? "",
    };
  });
}
