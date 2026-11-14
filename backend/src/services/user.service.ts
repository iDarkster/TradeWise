import { prisma } from "../lib/prisma.js";
import { ConflictError, NotFoundError } from "../utils/apiError.js";
import { type AccountView, toAccountView } from "./auth.service.js";

/**
 * Profile management for the authenticated user.
 *
 * Email and password are immutable through these endpoints: an email change
 * workflow and a password reset workflow are explicitly out of scope.
 */

export async function getAccount(userId: string): Promise<AccountView> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  if (!user) {
    throw new NotFoundError("Account not found.");
  }

  return toAccountView(user);
}

export interface UpdateProfileInput {
  username?: string;
  fullName?: string;
  avatarUrl?: string | null;
}

/** Updates the mutable profile fields of the authenticated user. */
export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<AccountView> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  if (!existing) {
    throw new NotFoundError("Account not found.");
  }

  if (!existing.profile) {
    throw new NotFoundError("Profile not found.");
  }

  if (input.username !== undefined && input.username !== existing.profile.username) {
    const taken = await prisma.profile.findFirst({
      where: {
        username: { equals: input.username, mode: "insensitive" },
        NOT: { userId },
      },
      select: { id: true },
    });

    if (taken) {
      throw new ConflictError("This username is already taken.");
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      profile: {
        update: {
          ...(input.username !== undefined ? { username: input.username } : {}),
          ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
          ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
        },
      },
    },
    include: { profile: true },
  });

  return toAccountView(user);
}
