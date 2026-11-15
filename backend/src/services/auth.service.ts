import { Prisma, type UserRole } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import {
  ApiError,
  ConflictError,
  ErrorCode,
  RateLimitError,
  UnauthorizedError,
} from "../utils/apiError.js";
import {
  getDummyPasswordHash,
  hashPassword,
  verifyPassword,
} from "../utils/crypto.js";
import { createSession, revokeUserSessions } from "./session.service.js";
import {
  recordSecurityEvent,
  SecurityEventType,
} from "./securityAudit.service.js";
import {
  FAILED_LOGIN_AUDIT_DETAIL_LIMIT,
  hashIdentifier,
  isBlocked,
  LOGIN_ACCOUNT_POLICY,
  LOGIN_IP_POLICY,
  RateLimitIdentifierType,
  RateLimitScope,
  recordAttempt,
  resetBucket,
  REGISTRATION_EMAIL_POLICY,
  REGISTRATION_IP_POLICY,
} from "./rateLimit.service.js";

/**
 * Identity services: registration, login and password management.
 *
 * Business rules live here; controllers only translate HTTP input/output.
 */

export type AccountStatus = "ACTIVE" | "SUSPENDED" | "DELETED";

/** Derives the account status from the two independent lifecycle fields. */
export function deriveAccountStatus(user: {
  isActive: boolean;
  deletedAt: Date | null;
}): AccountStatus {
  if (user.deletedAt !== null) return "DELETED";

  return user.isActive ? "ACTIVE" : "SUSPENDED";
}

export interface AccountView {
  id: string;
  email: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  role: UserRole;
  status: AccountStatus;
  createdAt: Date;
  lastLoginAt: Date | null;
  lastActivityAt: Date | null;
}

type UserWithProfile = Prisma.UserGetPayload<{ include: { profile: true } }>;

export function toAccountView(user: UserWithProfile): AccountView {
  return {
    id: user.id,
    email: user.email,
    username: user.profile?.username ?? "",
    fullName: user.profile?.fullName ?? "",
    avatarUrl: user.profile?.avatarUrl ?? null,
    role: user.role,
    status: deriveAccountStatus(user),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    lastActivityAt: user.lastActivityAt,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/* -------------------------------------------------------------------------- */
/* Registration                                                                */
/* -------------------------------------------------------------------------- */

export interface RegisterInput {
  email: string;
  password: string;
  username: string;
  fullName: string;
}

export interface RegisterContext {
  ip: string;
  userAgent?: string | null | undefined;
}

export interface RegisterResult {
  user: AccountView;
  rawToken: string;
  csrfToken: string;
}

/**
 * Registers a new learner account.
 *
 * The account, its profile, the first session and the registration audit
 * event are created in a single transaction, so a partial registration can
 * never be observed. Public registration always creates a USER account.
 *
 * Registration is throttled per IP address and per email address. Requests
 * that fail basic field validation never reach this function and therefore
 * never count against a bucket. Valid attempts that collide with an
 * existing email address or username do count.
 */
export async function registerUser(
  input: RegisterInput,
  context: RegisterContext,
): Promise<RegisterResult> {
  const [ipBucket, emailBucket] = await Promise.all([
    isBlocked(RateLimitScope.REGISTRATION, RateLimitIdentifierType.IP, context.ip),
    isBlocked(
      RateLimitScope.REGISTRATION,
      RateLimitIdentifierType.EMAIL,
      input.email,
    ),
  ]);

  if (ipBucket.blocked || emailBucket.blocked) {
    const blockedUntil = ipBucket.blockedUntil ?? emailBucket.blockedUntil;

    throw new RateLimitError(
      "Too many registration attempts. Please try again later.",
      blockedUntil
        ? {
            retryAfterSeconds: Math.max(
              1,
              Math.ceil((blockedUntil.getTime() - Date.now()) / 1000),
            ),
          }
        : undefined,
    );
  }

  try {
    const result = await createAccount(input, context);

    // A successful registration counts as an attempt against the IP bucket
    // and clears the email counter again.
    await recordAttempt(
      RateLimitScope.REGISTRATION,
      RateLimitIdentifierType.IP,
      context.ip,
      REGISTRATION_IP_POLICY,
    );
    await recordAttempt(
      RateLimitScope.REGISTRATION,
      RateLimitIdentifierType.EMAIL,
      input.email,
      REGISTRATION_EMAIL_POLICY,
    );
    await resetBucket(
      RateLimitScope.REGISTRATION,
      RateLimitIdentifierType.EMAIL,
      input.email,
    );

    return result;
  } catch (error) {
    if (error instanceof ConflictError) {
      // A valid request that collided with an existing identity still counts
      // against both the email and the IP bucket.
      await recordAttempt(
        RateLimitScope.REGISTRATION,
        RateLimitIdentifierType.IP,
        context.ip,
        REGISTRATION_IP_POLICY,
      );
      await recordAttempt(
        RateLimitScope.REGISTRATION,
        RateLimitIdentifierType.EMAIL,
        input.email,
        REGISTRATION_EMAIL_POLICY,
      );
    }

    throw error;
  }
}

async function createAccount(
  input: RegisterInput,
  context: RegisterContext,
): Promise<RegisterResult> {
  const passwordHash = await hashPassword(input.password);

  try {
    return await prisma.$transaction(async (tx) => {
      const emailTaken = await tx.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });

      if (emailTaken) {
        throw new ConflictError("An account with this email address already exists.");
      }

      const usernameTaken = await tx.profile.findFirst({
        where: { username: { equals: input.username, mode: "insensitive" } },
        select: { id: true },
      });

      if (usernameTaken) {
        throw new ConflictError("This username is already taken.");
      }

      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          role: "USER",
          isActive: true,
          profile: {
            create: {
              username: input.username,
              fullName: input.fullName,
            },
          },
        },
        include: { profile: true },
      });

      const created = await createSession({
        userId: user.id,
        userAgent: context.userAgent,
        db: tx,
      });

      await recordSecurityEvent(
        {
          userId: user.id,
          sessionId: created.session.id,
          eventType: SecurityEventType.USER_REGISTERED,
          metadata: {
            actorId: user.id,
            username: user.profile?.username ?? null,
          },
        },
        tx,
      );

      return {
        user: toAccountView(user),
        rawToken: created.rawToken,
        csrfToken: created.csrfToken,
      };
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;

    if (isUniqueViolation(error)) {
      throw new ConflictError(
        "An account with this email address or username already exists.",
      );
    }

    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/* Login                                                                       */
/* -------------------------------------------------------------------------- */

export interface LoginInput {
  identifier: string;
  password: string;
}

export interface LoginContext {
  ip: string;
  userAgent?: string | null | undefined;
}

export interface LoginResult {
  user: AccountView;
  rawToken: string;
  csrfToken: string;
}

async function findUserByIdentifier(
  identifier: string,
  looksLikeEmail: boolean,
): Promise<UserWithProfile | null> {
  if (looksLikeEmail) {
    return prisma.user.findUnique({
      where: { email: identifier.toLowerCase() },
      include: { profile: true },
    });
  }

  return prisma.user.findFirst({
    where: { profile: { username: { equals: identifier, mode: "insensitive" } } },
    include: { profile: true },
  });
}

/**
 * Records a failed authentication attempt.
 *
 * The rate-limit counters are advanced first and in their own transaction, so
 * a failing audit write can never disable the throttling. Detailed audit
 * records are only written for the first few failures from an address inside
 * one window; beyond that the counters act as the aggregate and the audit
 * table cannot be flooded.
 */
async function recordFailedLogin(params: {
  userId: string | null;
  accountKey: string;
  identifierType: "email" | "username";
  ip: string;
  reason: string;
}): Promise<void> {
  await recordAttempt(
    RateLimitScope.LOGIN,
    RateLimitIdentifierType.ACCOUNT,
    params.accountKey,
    LOGIN_ACCOUNT_POLICY,
  );

  const ipState = await recordAttempt(
    RateLimitScope.LOGIN,
    RateLimitIdentifierType.IP,
    params.ip,
    LOGIN_IP_POLICY,
  );

  if (ipState.attemptCount > FAILED_LOGIN_AUDIT_DETAIL_LIMIT) {
    return;
  }

  await recordSecurityEvent({
    userId: params.userId,
    sessionId: null,
    eventType: SecurityEventType.LOGIN_FAILED,
    metadata: {
      identifierType: params.identifierType,
      identifierHash: hashIdentifier(
        RateLimitScope.LOGIN,
        RateLimitIdentifierType.ACCOUNT,
        params.accountKey,
      ),
      ipHash: hashIdentifier(
        RateLimitScope.LOGIN,
        RateLimitIdentifierType.IP,
        params.ip,
      ),
      reason: params.reason,
    },
  });
}

/**
 * Authenticates a user by email address or username.
 *
 * Unknown identifiers and wrong passwords produce the same generic
 * response, so the endpoint never discloses whether an account exists.
 */
export async function login(
  input: LoginInput,
  context: LoginContext,
): Promise<LoginResult> {
  const identifier = input.identifier.trim();
  const looksLikeEmail = identifier.includes("@");

  const user = await findUserByIdentifier(identifier, looksLikeEmail);

  // The account bucket keys on the resolved account so that an email and a
  // username for the same account share one failure budget.
  const accountKey = user ? user.id : `unknown:${identifier.toLowerCase()}`;

  const [accountBucket, ipBucket] = await Promise.all([
    isBlocked(
      RateLimitScope.LOGIN,
      RateLimitIdentifierType.ACCOUNT,
      accountKey,
    ),
    isBlocked(RateLimitScope.LOGIN, RateLimitIdentifierType.IP, context.ip),
  ]);

  if (accountBucket.blocked || ipBucket.blocked) {
    const blockedUntil = accountBucket.blockedUntil ?? ipBucket.blockedUntil;

    await recordSecurityEvent({
      userId: user?.id ?? null,
      sessionId: null,
      eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
      metadata: {
        identifierType: looksLikeEmail ? "email" : "username",
        identifierHash: hashIdentifier(
          RateLimitScope.LOGIN,
          RateLimitIdentifierType.ACCOUNT,
          accountKey,
        ),
        ipHash: hashIdentifier(
          RateLimitScope.LOGIN,
          RateLimitIdentifierType.IP,
          context.ip,
        ),
        reason: "LOGIN_RATE_LIMITED",
      },
    });

    throw new RateLimitError(
      "Too many authentication attempts. Please try again later.",
      blockedUntil
        ? { retryAfterSeconds: Math.max(1, Math.ceil((blockedUntil.getTime() - Date.now()) / 1000)) }
        : undefined,
    );
  }

  let passwordMatches = false;

  if (user) {
    passwordMatches = await verifyPassword(user.passwordHash, input.password);
  } else {
    // Spend comparable time so the response time does not disclose whether
    // the account exists.
    await verifyPassword(await getDummyPasswordHash(), input.password);
  }

  const eligible = user !== null && user.isActive && user.deletedAt === null;

  if (!passwordMatches || !eligible) {
    await recordFailedLogin({
      userId: user?.id ?? null,
      accountKey,
      identifierType: looksLikeEmail ? "email" : "username",
      ip: context.ip,
      reason: !user
        ? "UNKNOWN_IDENTIFIER"
        : !passwordMatches
          ? "INVALID_PASSWORD"
          : !user.isActive
            ? "ACCOUNT_SUSPENDED"
            : "ACCOUNT_DELETED",
    });

    throw new UnauthorizedError(
      "Invalid credentials.",
      ErrorCode.INVALID_CREDENTIALS,
    );
  }

  // A successful login clears the account failure counter. The IP counter is
  // deliberately left untouched.
  await resetBucket(RateLimitScope.LOGIN, RateLimitIdentifierType.ACCOUNT, accountKey);

  const now = new Date();

  const created = await prisma.$transaction(async (tx) => {
    const session = await createSession({
      userId: user.id,
      userAgent: context.userAgent,
      db: tx,
    });

    const updated = await tx.user.update({
      where: { id: user.id },
      data: { lastLoginAt: now, lastActivityAt: now },
      include: { profile: true },
    });

    return { session, updated };
  });

  return {
    user: toAccountView(created.updated),
    rawToken: created.session.rawToken,
    csrfToken: created.session.csrfToken,
  };
}

/* -------------------------------------------------------------------------- */
/* Password change                                                             */
/* -------------------------------------------------------------------------- */

export interface ChangePasswordInput {
  userId: string;
  sessionId: string;
  currentPassword: string;
  newPassword: string;
}

/**
 * Changes the password of the authenticated user.
 *
 * Every other active session is revoked in the same transaction. The caller's
 * own session stays valid.
 */
export async function changePassword(input: ChangePasswordInput): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, passwordHash: true },
  });

  if (!user) {
    throw new UnauthorizedError();
  }

  const matches = await verifyPassword(user.passwordHash, input.currentPassword);

  if (!matches) {
    throw new UnauthorizedError(
      "The current password is incorrect.",
      ErrorCode.INVALID_CREDENTIALS,
    );
  }

  const passwordHash = await hashPassword(input.newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: input.userId },
      data: { passwordHash },
    });

    await revokeUserSessions(input.userId, {
      exceptSessionId: input.sessionId,
      db: tx,
    });

    await recordSecurityEvent(
      {
        userId: input.userId,
        sessionId: input.sessionId,
        eventType: SecurityEventType.PASSWORD_CHANGED,
        metadata: { actorId: input.userId },
      },
      tx,
    );
  });
}
