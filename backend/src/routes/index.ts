import type { Express } from "express";
import { noCache } from "../middleware/noCache.js";
import { adminRouter } from "./admin.routes.js";
import { authRouter } from "./auth.routes.js";
import { meRouter } from "./me.routes.js";

/**
 * Route registration.
 *
 * Routes are unversioned and grouped by the resource they act on.
 * Sensitive route groups apply the noCache middleware to prevent
 * storing authentication, profile, and admin responses in caches.
 */
export function registerRoutes(app: Express): void {
  app.use("/api/auth", noCache, authRouter);
  app.use("/api/me", noCache, meRouter);
  app.use("/api/admin", noCache, adminRouter);
}
