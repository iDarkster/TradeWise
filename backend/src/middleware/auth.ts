import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { UserRole } from "../generated/prisma/client.js";
import { ErrorCode, ForbiddenError, UnauthorizedError } from "../utils/apiError.js";
import { clearSessionCookie, readSessionCookie, setSessionCookie } from "../utils/cookies.js";
import {
  resolveSession,
  touchSession,
  verifyCsrfToken,
} from "../services/session.service.js";

/**
 * Authentication and authorisation middleware.
 *
 * Every authenticated request validates its session against the database, so
 * a revoked session stops working immediately.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Requires a valid, unrevoked and unexpired session. */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const rawToken = readSessionCookie(req);

  if (!rawToken) {
    clearSessionCookie(res);
    throw new UnauthorizedError();
  }

  const auth = await resolveSession(rawToken);

  if (!auth) {
    clearSessionCookie(res);
    throw new UnauthorizedError();
  }

  req.auth = auth;

  // Refreshes the sliding expiry and browser cookie Max-Age at most once every five minutes.
  const touchResult = await touchSession(auth.session);

  if (touchResult.status === "refreshed") {
    setSessionCookie(res, auth.rawToken);
  } else if (touchResult.status === "invalid") {
    clearSessionCookie(res);
    throw new UnauthorizedError();
  }

  next();
}

/** Requires the authenticated user to hold one of the given roles. */
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      throw new UnauthorizedError();
    }

    if (!roles.includes(req.auth.user.role)) {
      throw new ForbiddenError();
    }

    next();
  };
}

/**
 * Requires a valid CSRF token on state-changing requests.
 *
 * The token is bound to the session that issued it: it is derived from the
 * raw session token with a server-side secret and verified against the
 * digest stored with the session.
 */
export function requireCsrf(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.auth) {
    throw new UnauthorizedError();
  }

  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }

  const provided = req.get("X-CSRF-Token");

  if (!provided) {
    throw new ForbiddenError(
      "A valid CSRF token is required for this request.",
      ErrorCode.CSRF_TOKEN_INVALID,
    );
  }

  if (!verifyCsrfToken(req.auth.csrfTokenDigest, req.auth.rawToken, provided)) {
    throw new ForbiddenError(
      "The CSRF token is missing or invalid.",
      ErrorCode.CSRF_TOKEN_INVALID,
    );
  }

  next();
}
