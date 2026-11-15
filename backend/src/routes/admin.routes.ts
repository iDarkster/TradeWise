import { Router } from "express";
import * as adminController from "../controllers/admin.controller.js";
import { requireAuth, requireCsrf, requireRole } from "../middleware/auth.js";
import { validateParams, validateQuery } from "../middleware/validate.js";
import {
  dateValue,
  enumValue,
  intValue,
  optional,
  stringValue,
  uuidValue,
} from "../utils/validation.js";

/**
 * Administrator endpoints.
 *
 * Only ADMIN accounts may reach these routes. Administrators may inspect
 * accounts and audit records, and may suspend or reactivate regular learner
 * accounts. They may not change roles, delete accounts or revoke an
 * individual user's sessions.
 */

const router = Router();

const userListQueryShape = {
  page: optional(intValue({ min: 1 })),
  limit: optional(intValue({ min: 1, max: 100 })),
  search: optional(stringValue({ max: 200, trim: true })),
  status: optional(enumValue(["ACTIVE", "SUSPENDED", "DELETED"])),
  role: optional(enumValue(["USER", "ADMIN"])),
  createdFrom: optional(dateValue()),
  createdTo: optional(dateValue()),
  sortBy: optional(enumValue(["createdAt", "username", "email"])),
  order: optional(enumValue(["asc", "desc"])),
};

const auditLogQueryShape = {
  page: optional(intValue({ min: 1 })),
  limit: optional(intValue({ min: 1, max: 100 })),
  actorId: optional(uuidValue()),
  targetId: optional(uuidValue()),
  action: optional(stringValue({ max: 96, trim: true })),
  createdFrom: optional(dateValue()),
  createdTo: optional(dateValue()),
};

router.use(requireAuth, requireRole("ADMIN"));

router.get("/users", validateQuery(userListQueryShape), adminController.listUsers);

router.get(
  "/users/:id",
  validateParams({ id: uuidValue() }),
  adminController.getUser,
);

router.post(
  "/users/:id/suspend",
  requireCsrf,
  validateParams({ id: uuidValue() }),
  adminController.suspendUser,
);

router.post(
  "/users/:id/reactivate",
  requireCsrf,
  validateParams({ id: uuidValue() }),
  adminController.reactivateUser,
);

router.get(
  "/audit-logs",
  validateQuery(auditLogQueryShape),
  adminController.listAuditLogs,
);

export { router as adminRouter };
