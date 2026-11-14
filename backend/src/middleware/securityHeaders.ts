import type { NextFunction, Request, RequestHandler, Response } from "express";
import { getConfig } from "../config/env.js";

export interface SecurityHeadersOptions {
  isProduction?: boolean;
}

/**
 * Creates the security headers middleware.
 *
 * Emits defensive HTTP security headers tailored for a REST API.
 * Configurable via options to allow isolated testing of production vs non-production
 * behavior without mutating global runtime environment.
 */
export function createSecurityHeaders(
  options?: SecurityHeadersOptions,
): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const isProduction = options?.isProduction ?? getConfig().isProduction;

    const headers: Record<string, string> = {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Cross-Origin-Opener-Policy": "same-origin",
      "X-DNS-Prefetch-Control": "off",
      "X-Permitted-Cross-Domain-Policies": "none",
    };

    if (isProduction) {
      headers["Strict-Transport-Security"] = "max-age=31536000";
    }

    res.set(headers);
    next();
  };
}

export const securityHeaders: RequestHandler = createSecurityHeaders();
