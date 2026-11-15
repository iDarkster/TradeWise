import type { NextFunction, Request, Response } from "express";

/**
 * Disables HTTP caching for sensitive API endpoints.
 *
 * Sets Cache-Control: no-store, no-cache, must-revalidate, private
 * and Pragma: no-cache to prevent intermediate proxies, browsers,
 * and edge caches from storing sensitive authentication, session,
 * profile, or administrative data.
 */
export function noCache(_req: Request, res: Response, next: NextFunction): void {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    Pragma: "no-cache",
  });
  next();
}
