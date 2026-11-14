import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import {
  login as loginService,
  registerUser as registerUserService,
  type LoginInput,
  type RegisterInput,
} from "../services/auth.service.js";
import { getClientIp } from "../services/clientIp.service.js";
import {
  deriveCsrfToken,
  listActiveSessions,
  revokeSessionById,
  revokeUserSessions,
} from "../services/session.service.js";
import { recordSecurityEvent, SecurityEventType } from "../services/securityAudit.service.js";
import { NotFoundError } from "../utils/apiError.js";
import { clearSessionCookie, setSessionCookie } from "../utils/cookies.js";
import { sendSuccess } from "../utils/response.js";
import { formatClientLabel } from "../utils/userAgent.js";
import { validatedBody, validatedParams } from "../middleware/validate.js";

/** HTTP controllers for the authentication and session endpoints. */

export async function register(
  req: Request,
  res: Response,
): Promise<void> {
  const input = validatedBody<RegisterInput>(req);

  const result = await registerUserService(input, {
    ip: getClientIp(req),
    userAgent: req.get("user-agent"),
  });

  setSessionCookie(res, result.rawToken);

  sendSuccess(
    res,
    {
      user: result.user,
      csrfToken: result.csrfToken,
    },
    201,
  );
}

export async function login(req: Request, res: Response): Promise<void> {
  const input = validatedBody<LoginInput>(req);

  const result = await loginService(input, {
    ip: getClientIp(req),
    userAgent: req.get("user-agent"),
  });

  setSessionCookie(res, result.rawToken);

  sendSuccess(res, {
    user: result.user,
    csrfToken: result.csrfToken,
  });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const auth = req.auth;

  if (!auth) {
    res.status(204).end();
    return;
  }

  // An ordinary logout is not a security event and is not audited.
  await revokeSessionById(auth.session.id);

  clearSessionCookie(res);

  res.status(204).end();
}

export async function logoutOthers(req: Request, res: Response): Promise<void> {
  const auth = req.auth;

  if (!auth) {
    res.status(204).end();
    return;
  }

  const revoked = await revokeUserSessions(auth.user.id, {
    exceptSessionId: auth.session.id,
  });

  await recordSecurityEvent({
    userId: auth.user.id,
    sessionId: auth.session.id,
    eventType: SecurityEventType.SESSION_REVOKED,
    metadata: { actorId: auth.user.id, revokedSessions: revoked },
  });

  res.status(204).end();
}

export async function logoutAll(req: Request, res: Response): Promise<void> {
  const auth = req.auth;

  if (!auth) {
    res.status(204).end();
    return;
  }

  const revoked = await revokeUserSessions(auth.user.id);

  await recordSecurityEvent({
    userId: auth.user.id,
    sessionId: auth.session.id,
    eventType: SecurityEventType.LOGOUT_ALL,
    metadata: { actorId: auth.user.id, revokedSessions: revoked },
  });

  clearSessionCookie(res);

  res.status(204).end();
}

export async function listSessions(req: Request, res: Response): Promise<void> {
  const auth = req.auth;

  if (!auth) {
    res.status(200).json({ success: true, data: { sessions: [] } });
    return;
  }

  const sessions = await listActiveSessions(auth.user.id);

  sendSuccess(res, {
    sessions: sessions.map((session) => ({
      id: session.id,
      client: formatClientLabel(session.userAgent),
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      expiresAt: session.expiresAt,
      isCurrent: session.id === auth.session.id,
    })),
  });
}

export async function revokeSession(
  req: Request,
  res: Response,
): Promise<void> {
  const auth = req.auth;

  if (!auth) {
    res.status(204).end();
    return;
  }

  const { id } = validatedParams<{ id: string }>(req);

  const session = await revokeSessionByIdOwnedByUser(id, auth.user.id);

  if (!session) {
    throw new NotFoundError("Session not found.");
  }

  await recordSecurityEvent({
    userId: auth.user.id,
    sessionId: auth.session.id,
    eventType: SecurityEventType.SESSION_REVOKED,
    metadata: { actorId: auth.user.id, revokedSessionId: id },
  });

  if (id === auth.session.id) {
    clearSessionCookie(res);
  }

  res.status(204).end();
}

async function revokeSessionByIdOwnedByUser(
  sessionId: string,
  userId: string,
): Promise<{ id: string } | null> {
  const session = await prisma.authSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true },
  });

  if (!session) return null;

  await revokeSessionById(sessionId);

  return session;
}

export function csrfToken(req: Request, res: Response): void {
  const auth = req.auth;

  if (!auth) {
    res.status(200).json({ success: true, data: { csrfToken: null } });
    return;
  }

  sendSuccess(res, { csrfToken: deriveCsrfToken(auth.rawToken) });
}
