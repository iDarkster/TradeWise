import { Router } from "express";
import * as meController from "../controllers/me.controller.js";
import { requireAuth, requireCsrf } from "../middleware/auth.js";
import { validateBody, validatePartialBody } from "../middleware/validate.js";
import {
  fullNameValue,
  nullable,
  optional,
  passwordValue,
  stringValue,
  urlValue,
  usernameValue,
} from "../utils/validation.js";

/**
 * Endpoints for the authenticated user's own resources.
 *
 * Email and password are immutable here: an email change workflow and a
 * password reset workflow are out of scope for this module.
 */

const router = Router();

const profileShape = {
  username: optional(usernameValue()),
  fullName: optional(fullNameValue()),
  avatarUrl: optional(nullable(urlValue())),
};

const passwordChangeShape = {
  currentPassword: stringValue({ min: 1, max: 128 }),
  newPassword: passwordValue(),
};

router.use(requireAuth);

router.get("/", meController.getMe);

router.patch(
  "/profile",
  requireCsrf,
  validatePartialBody(profileShape, {
    rejectUnknown: true,
    unknownMessage: (key) => {
      if (key === "email") {
        return "The email address cannot be changed through this endpoint.";
      }

      if (key === "password") {
        return "The password cannot be changed through this endpoint.";
      }

      return "This field cannot be updated through this endpoint.";
    },
  }),
  meController.updateMyProfile,
);

router.post(
  "/password",
  requireCsrf,
  validateBody(passwordChangeShape),
  meController.changeMyPassword,
);

export { router as meRouter };
