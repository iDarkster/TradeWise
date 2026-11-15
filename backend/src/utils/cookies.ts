import type { Request, Response } from "express";
import { getConfig } from "../config/env.js";

/**
 * Session cookie handling.
 *
 * The cookie is host-only, HTTP-only and scoped to `/`. `Secure` follows the
 * environment configuration so that production deployments always mark it as
 * secure while local development over plain HTTP keeps working.
 */

export function readSessionCookie(req: Request): string | undefined {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;

  if (!cookies) return undefined;

  const value = cookies[getConfig().cookie.name];

  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function setSessionCookie(res: Response, rawToken: string): void {
  const config = getConfig();

  res.cookie(config.cookie.name, rawToken, {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    ...(config.cookie.domain ? { domain: config.cookie.domain } : {}),
    path: config.cookie.path,
    maxAge: config.cookie.maxAgeMs,
  });
}

export function clearSessionCookie(res: Response): void {
  const config = getConfig();

  res.clearCookie(config.cookie.name, {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    ...(config.cookie.domain ? { domain: config.cookie.domain } : {}),
    path: config.cookie.path,
  });
}
