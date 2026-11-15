import { z } from "zod";

/**
 * TradeWise Password Policy (authoritative, matching backend):
 * - Minimum: 8 characters
 * - Maximum: 128 characters
 * - At least one digit
 * - At least one special character
 * - Strictly NO whitespace anywhere (leading, trailing, or internal)
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .max(128, "Password cannot exceed 128 characters")
  .regex(/\d/, "Password must contain at least one digit")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character")
  .refine((val) => !/\s/.test(val), {
    message: "Password cannot contain spaces or whitespace characters",
  });

export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username cannot exceed 20 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores");

export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .max(254, "Email cannot exceed 254 characters")
  .trim()
  .toLowerCase()
  .email("Invalid email address");

export const fullNameSchema = z
  .string()
  .min(1, "Full name is required")
  .max(100, "Full name cannot exceed 100 characters")
  .trim();

export const registerSchema = z
  .object({
    email: emailSchema,
    username: usernameSchema,
    fullName: fullNameSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterFormData = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, "Email or username is required")
    .max(254, "Identifier cannot exceed 254 characters")
    .trim(),
  password: z.string().min(1, "Password is required").max(128, "Password cannot exceed 128 characters"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const profileUpdateSchema = z.object({
  username: usernameSchema.optional(),
  fullName: fullNameSchema.optional(),
  avatarUrl: z
    .string()
    .url("Invalid URL format")
    .max(2000, "Avatar URL is too long")
    .nullable()
    .optional()
    .or(z.literal("")),
});

export type ProfileUpdateFormData = z.infer<typeof profileUpdateSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmNewPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "New passwords do not match",
    path: ["confirmNewPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
