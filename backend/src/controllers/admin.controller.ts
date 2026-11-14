import type { Request, Response } from "express";
import {
  getUserDetails,
  listUsers as listUsersService,
  reactivateUser as reactivateUserService,
  suspendUser as suspendUserService,
  type AdminUserListQuery,
} from "../services/adminUser.service.js";
import {
  listAuditEvents,
  type AdminAuditLogQuery,
} from "../services/adminAudit.service.js";
import { sendSuccess } from "../utils/response.js";
import { validatedParams, validatedQuery } from "../middleware/validate.js";

/** HTTP controllers for the administrator endpoints. */

export async function listUsers(req: Request, res: Response): Promise<void> {
  const query = validatedQuery<Partial<AdminUserListQuery>>(req);

  const result = await listUsersService({
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    search: query.search,
    status: query.status,
    role: query.role,
    createdFrom: query.createdFrom,
    createdTo: query.createdTo,
    sortBy: query.sortBy ?? "createdAt",
    order: query.order ?? "desc",
  });

  sendSuccess(res, result);
}

export async function getUser(req: Request, res: Response): Promise<void> {
  const { id } = validatedParams<{ id: string }>(req);

  sendSuccess(res, { user: await getUserDetails(id) });
}

export async function suspendUser(req: Request, res: Response): Promise<void> {
  const auth = req.auth;

  if (!auth) {
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHENTICATED", message: "Authentication is required." },
    });
    return;
  }

  const { id } = validatedParams<{ id: string }>(req);

  const user = await suspendUserService(auth.user.id, auth.session.id, id);

  sendSuccess(res, { user });
}

export async function reactivateUser(req: Request, res: Response): Promise<void> {
  const auth = req.auth;

  if (!auth) {
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHENTICATED", message: "Authentication is required." },
    });
    return;
  }

  const { id } = validatedParams<{ id: string }>(req);

  const user = await reactivateUserService(auth.user.id, auth.session.id, id);

  sendSuccess(res, { user });
}

export async function listAuditLogs(req: Request, res: Response): Promise<void> {
  const query = validatedQuery<Partial<AdminAuditLogQuery>>(req);

  const result = await listAuditEvents({
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    actorId: query.actorId,
    targetId: query.targetId,
    action: query.action,
    createdFrom: query.createdFrom,
    createdTo: query.createdTo,
  });

  sendSuccess(res, result);
}
