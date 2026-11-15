import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import {
  sanitizeMetadata,
  type SafeMetadata,
} from "./securityAudit.service.js";

/**
 * Read access to the security audit log for administrators.
 *
 * The log records the *subject* of an event in `userId` and the acting
 * session in `sessionId`. The actor of an event is therefore the owner of
 * that session, which keeps the actor filter on an indexed join instead of a
 * JSON lookup.
 */

export interface AdminAuditLogQuery {
  page: number;
  limit: number;
  actorId: string | undefined;
  targetId: string | undefined;
  action: string | undefined;
  createdFrom: Date | undefined;
  createdTo: Date | undefined;
}

export interface ActorSummary {
  id: string;
  username: string;
  email: string;
}

export interface AdminAuditLogEntry {
  id: string;
  actorId: string | null;
  actor: ActorSummary | null;
  targetId: string | null;
  target: ActorSummary | null;
  action: string;
  timestamp: Date;
  metadata: SafeMetadata;
}

export interface AdminAuditLogResult {
  events: AdminAuditLogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface AuditRow {
  id: string;
  userId: string | null;
  sessionId: string | null;
  eventType: string;
  metadata: unknown;
  createdAt: Date;
  session: { userId: string } | null;
}

function buildWhere(query: AdminAuditLogQuery): Prisma.SecurityAuditLogWhereInput {
  const where: Prisma.SecurityAuditLogWhereInput = {};

  if (query.actorId) {
    where.session = { userId: query.actorId };
  }

  if (query.targetId) {
    where.userId = query.targetId;
  }

  if (query.action) {
    where.eventType = { contains: query.action, mode: "insensitive" };
  }

  if (query.createdFrom || query.createdTo) {
    where.createdAt = {
      ...(query.createdFrom ? { gte: query.createdFrom } : {}),
      ...(query.createdTo ? { lte: query.createdTo } : {}),
    };
  }

  return where;
}

function readMetadata(value: unknown): SafeMetadata {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return sanitizeMetadata(value as Record<string, unknown>);
}

/** Lists security audit events with pagination and filtering. */
export async function listAuditEvents(
  query: AdminAuditLogQuery,
): Promise<AdminAuditLogResult> {
  const where = buildWhere(query);

  const [total, rows] = await prisma.$transaction([
    prisma.securityAuditLog.count({ where }),
    prisma.securityAuditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: {
        id: true,
        userId: true,
        sessionId: true,
        eventType: true,
        metadata: true,
        createdAt: true,
        session: { select: { userId: true } },
      },
    }),
  ]);

  const actorIds = new Set<string>();
  const targetIds = new Set<string>();

  for (const row of rows as AuditRow[]) {
    const metadata = readMetadata(row.metadata);
    const actorId = row.session?.userId ?? metadata.actorId;

    if (typeof actorId === "string") actorIds.add(actorId);
    if (row.userId) targetIds.add(row.userId);
  }

  const allIds = [...new Set([...actorIds, ...targetIds])];

  const users = await prisma.user.findMany({
    where: { id: { in: allIds } },
    include: { profile: true },
  });

  const summaries = new Map<string, ActorSummary>();

  for (const user of users) {
    summaries.set(user.id, {
      id: user.id,
      username: user.profile?.username ?? "",
      email: user.email,
    });
  }

  const events: AdminAuditLogEntry[] = (rows as AuditRow[]).map((row) => {
    const metadata = readMetadata(row.metadata);
    const actorId = row.session?.userId ?? metadata.actorId ?? null;

    return {
      id: row.id,
      actorId: typeof actorId === "string" ? actorId : null,
      actor: typeof actorId === "string" ? (summaries.get(actorId) ?? null) : null,
      targetId: row.userId,
      target: row.userId ? (summaries.get(row.userId) ?? null) : null,
      action: row.eventType,
      timestamp: row.createdAt,
      metadata,
    };
  });

  return {
    events,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
}
