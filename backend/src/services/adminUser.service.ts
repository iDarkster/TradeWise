import { Prisma, type UserRole } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../utils/apiError.js";
import { revokeUserSessions } from "./session.service.js";
import {
  recordSecurityEvent,
  SecurityEventType,
} from "./securityAudit.service.js";
import { deriveAccountStatus, type AccountStatus } from "./auth.service.js";

/**
 * Administrative user management.
 *
 * Administrators may inspect accounts and suspend or reactivate regular
 * learner accounts. They may not change roles, suspend other administrators,
 * suspend themselves, delete accounts or revoke an individual user's
 * sessions.
 */

export interface AdminUserListQuery {
  page: number;
  limit: number;
  search: string | undefined;
  status: AccountStatus | undefined;
  role: UserRole | undefined;
  createdFrom: Date | undefined;
  createdTo: Date | undefined;
  sortBy: "createdAt" | "username" | "email";
  order: "asc" | "desc";
}

export interface AdminUserListItem {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: UserRole;
  status: AccountStatus;
  createdAt: Date;
  lastLoginAt: Date | null;
  lastActivityAt: Date | null;
}

export interface AdminUserListResult {
  users: AdminUserListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminUserDetails {
  id: string;
  email: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  role: UserRole;
  status: AccountStatus;
  createdAt: Date;
  /** Last time the account record was written. */
  updatedAt: Date;
  registeredAt: Date;
  lastLoginAt: Date | null;
  lastActivityAt: Date | null;
  deletedAt: Date | null;
  activeSessionCount: number;
  sessionActivity: {
    activeSessionCount: number;
    mostRecentActivityAt: Date | null;
    oldestActiveSessionCreatedAt: Date | null;
  };
}

function buildWhere(query: AdminUserListQuery): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};

  if (query.search) {
    where.OR = [
      { email: { contains: query.search, mode: "insensitive" } },
      { profile: { username: { contains: query.search, mode: "insensitive" } } },
      { profile: { fullName: { contains: query.search, mode: "insensitive" } } },
    ];
  }

  switch (query.status) {
    case "DELETED":
      where.deletedAt = { not: null };
      break;
    case "ACTIVE":
      where.isActive = true;
      where.deletedAt = null;
      break;
    case "SUSPENDED":
      where.isActive = false;
      where.deletedAt = null;
      break;
    default:
      // Soft-deleted accounts are excluded unless they are requested.
      where.deletedAt = null;
      break;
  }

  if (query.role) {
    where.role = query.role;
  }

  if (query.createdFrom || query.createdTo) {
    where.createdAt = {
      ...(query.createdFrom ? { gte: query.createdFrom } : {}),
      ...(query.createdTo ? { lte: query.createdTo } : {}),
    };
  }

  return where;
}

function buildOrderBy(
  query: AdminUserListQuery,
): Prisma.UserOrderByWithRelationInput[] {
  const direction = query.order;

  switch (query.sortBy) {
    case "username":
      return [{ profile: { username: direction } }, { id: "asc" }];
    case "email":
      return [{ email: direction }, { id: "asc" }];
    default:
      return [{ createdAt: direction }, { id: "asc" }];
  }
}

/** Lists accounts with pagination, filtering and sorting. */
export async function listUsers(
  query: AdminUserListQuery,
): Promise<AdminUserListResult> {
  const where = buildWhere(query);

  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: buildOrderBy(query),
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: { profile: true },
    }),
  ]);

  return {
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      username: user.profile?.username ?? "",
      fullName: user.profile?.fullName ?? "",
      role: user.role,
      status: deriveAccountStatus(user),
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      lastActivityAt: user.lastActivityAt,
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
}

async function loadUserDetails(userId: string): Promise<AdminUserDetails> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  if (!user) {
    throw new NotFoundError("User not found.");
  }

  const now = new Date();

  const sessions = await prisma.authSession.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { lastActivityAt: "desc" },
    select: { createdAt: true, lastActivityAt: true },
  });

  const mostRecentActivityAt = sessions[0]?.lastActivityAt ?? null;
  const oldestActiveSessionCreatedAt =
    sessions.length > 0 ? sessions[sessions.length - 1]?.createdAt ?? null : null;

  const activityCandidates = [
    user.lastActivityAt,
    mostRecentActivityAt,
  ].filter((value): value is Date => value !== null);

  const updatedAt =
    activityCandidates.length > 0
      ? new Date(
          Math.max(
            user.updatedAt.getTime(),
            ...activityCandidates.map((value) => value.getTime()),
          ),
        )
      : user.updatedAt;

  return {
    id: user.id,
    email: user.email,
    username: user.profile?.username ?? "",
    fullName: user.profile?.fullName ?? "",
    avatarUrl: user.profile?.avatarUrl ?? null,
    role: user.role,
    status: deriveAccountStatus(user),
    createdAt: user.createdAt,
    updatedAt,
    registeredAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    lastActivityAt: user.lastActivityAt,
    deletedAt: user.deletedAt,
    activeSessionCount: sessions.length,
    sessionActivity: {
      activeSessionCount: sessions.length,
      mostRecentActivityAt,
      oldestActiveSessionCreatedAt,
    },
  };
}

/** Returns the details of a single account. */
export async function getUserDetails(userId: string): Promise<AdminUserDetails> {
  return loadUserDetails(userId);
}

async function assertSuspendableTarget(
  adminId: string,
  targetUserId: string,
): Promise<{ id: string; username: string; isActive: boolean; deletedAt: Date | null }> {
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { profile: true },
  });

  if (!target) {
    throw new NotFoundError("User not found.");
  }

  if (target.id === adminId) {
    throw new ForbiddenError("An administrator cannot suspend their own account.");
  }

  if (target.role === "ADMIN") {
    throw new ForbiddenError("Administrator accounts cannot be suspended.");
  }

  return {
    id: target.id,
    username: target.profile?.username ?? "",
    isActive: target.isActive,
    deletedAt: target.deletedAt,
  };
}

/**
 * Suspends a learner account.
 *
 * The status change, the revocation of every active session and the audit
 * event are committed together.
 */
export async function suspendUser(
  adminId: string,
  adminSessionId: string,
  targetUserId: string,
): Promise<AdminUserDetails> {
  const target = await assertSuspendableTarget(adminId, targetUserId);

  if (target.deletedAt !== null) {
    throw new ConflictError("A soft-deleted account cannot be suspended.");
  }

  if (!target.isActive) {
    throw new ConflictError("This account is already suspended.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: targetUserId },
      data: { isActive: false },
    });

    await revokeUserSessions(targetUserId, { db: tx });

    await recordSecurityEvent(
      {
        userId: targetUserId,
        sessionId: adminSessionId,
        eventType: SecurityEventType.USER_SUSPENDED,
        metadata: {
          actorId: adminId,
          targetUserId,
          targetUsername: target.username,
        },
      },
      tx,
    );
  });

  return loadUserDetails(targetUserId);
}

/**
 * Reactivates a suspended learner account.
 *
 * Reactivation restores the right to log in but never restores sessions
 * that were revoked while the account was suspended.
 */
export async function reactivateUser(
  adminId: string,
  adminSessionId: string,
  targetUserId: string,
): Promise<AdminUserDetails> {
  const target = await assertSuspendableTarget(adminId, targetUserId);

  if (target.deletedAt !== null) {
    throw new ConflictError("A soft-deleted account cannot be reactivated.");
  }

  if (target.isActive) {
    throw new ConflictError("This account is already active.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: targetUserId },
      data: { isActive: true },
    });

    await recordSecurityEvent(
      {
        userId: targetUserId,
        sessionId: adminSessionId,
        eventType: SecurityEventType.USER_REACTIVATED,
        metadata: {
          actorId: adminId,
          targetUserId,
          targetUsername: target.username,
        },
      },
      tx,
    );
  });

  return loadUserDetails(targetUserId);
}
