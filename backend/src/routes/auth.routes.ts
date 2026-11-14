import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { requireAuth, requireCsrf } from "../middleware/auth.js";
import { validateBody, validateParams } from "../middleware/validate.js";
import {
  emailValue,
  passwordValue,
  stringValue,
  usernameValue,
  uuidValue,
} from "../utils/validation.js";

/**
 * Authentication and session endpoints.
 *
 * Public routes: registration and login.
 * Protected routes: session management, CSRF token retrieval.
 */

const router = Router();

const registerShape = {
  email: emailValue(),
  password: passwordValue(),
  username: usernameValue(),
  fullName: stringValue({ min: 1, max: 100, trim: true }),
};

const loginShape = {
  identifier: stringValue({ min: 1, max: 254, trim: true }),
  password: stringValue({ min: 1, max: 128 }),
};

router.post("/register", validateBody(registerShape), authController.register);

router.post("/login", validateBody(loginShape), authController.login);

router.get("/csrf", requireAuth, authController.csrfToken);

router.post("/logout", requireAuth, requireCsrf, authController.logout);

router.post(
  "/logout-others",
  requireAuth,
  requireCsrf,
  authController.logoutOthers,
);

router.post("/logout-all", requireAuth, requireCsrf, authController.logoutAll);

router.get("/sessions", requireAuth, authController.listSessions);

router.delete(
  "/sessions/:id",
  requireAuth,
  requireCsrf,
  validateParams({ id: uuidValue() }),
  authController.revokeSession,
);

export { router as authRouter };
