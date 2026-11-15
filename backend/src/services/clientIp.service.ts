import type { Request } from "express";

/**
 * Resolves the client IP address of a request.
 *
 * Express computes `req.ip` using the application's `trust proxy` setting.
 * Forwarded headers are therefore only honoured when the connecting proxy is
 * explicitly listed in `TRUSTED_PROXIES`; otherwise the direct connection
 * address is used and a spoofed `X-Forwarded-For` header is ignored.
 */
export function getClientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}
