import type { Request, Response } from "express";
import {
  changePassword as changePasswordService,
  type ChangePasswordInput,
} from "../services/auth.service.js";
import {
  getAccount,
  updateProfile,
  type UpdateProfileInput,
} from "../services/user.service.js";
import { sendSuccess } from "../utils/response.js";
import { validatedBody } from "../middleware/validate.js";

/** HTTP controllers for the authenticated user's own resources. */

export async function getMe(req: Request, res: Response): Promise<void> {
  const auth = req.auth;

  if (!auth) {
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHENTICATED", message: "Authentication is required." },
    });
    return;
  }

  sendSuccess(res, { user: await getAccount(auth.user.id) });
}

export async function updateMyProfile(
  req: Request,
  res: Response,
): Promise<void> {
  const auth = req.auth;

  if (!auth) {
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHENTICATED", message: "Authentication is required." },
    });
    return;
  }

  const input = validatedBody<UpdateProfileInput>(req);

  sendSuccess(res, { user: await updateProfile(auth.user.id, input) });
}

export async function changeMyPassword(
  req: Request,
  res: Response,
): Promise<void> {
  const auth = req.auth;

  if (!auth) {
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHENTICATED", message: "Authentication is required." },
    });
    return;
  }

  const input = validatedBody<ChangePasswordInput>(req);

  await changePasswordService({
    userId: auth.user.id,
    sessionId: auth.session.id,
    currentPassword: input.currentPassword,
    newPassword: input.newPassword,
  });

  sendSuccess(res, { changed: true });
}
