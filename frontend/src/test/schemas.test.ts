import { describe, it, expect } from "vitest";
import {
  passwordSchema,
  usernameSchema,
  emailSchema,
  registerSchema,
  changePasswordSchema,
} from "../features/auth/schemas/authSchemas.js";

describe("TradeWise M1 Auth Validation Schemas", () => {
  describe("Password Policy", () => {
    it("accepts valid passwords meeting all criteria", () => {
      const valid = ["Valid123!", "trader#99x", "P@ssw0rd2026", "A1!aaaaa"];
      valid.forEach((pwd) => {
        const res = passwordSchema.safeParse(pwd);
        expect(res.success, `Expected "${pwd}" to be valid`).toBe(true);
      });
    });

    it("rejects passwords with internal whitespace", () => {
      const res = passwordSchema.safeParse("Valid 123!");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain("whitespace");
      }
    });

    it("rejects passwords with leading or trailing whitespace", () => {
      expect(passwordSchema.safeParse(" Valid123!").success).toBe(false);
      expect(passwordSchema.safeParse("Valid123! ").success).toBe(false);
      expect(passwordSchema.safeParse("Valid123!\t").success).toBe(false);
    });

    it("rejects passwords shorter than 8 characters", () => {
      expect(passwordSchema.safeParse("Val1!").success).toBe(false);
    });

    it("rejects passwords longer than 128 characters", () => {
      const longPwd = "A1!" + "a".repeat(126);
      expect(passwordSchema.safeParse(longPwd).success).toBe(false);
    });

    it("rejects passwords missing a digit", () => {
      expect(passwordSchema.safeParse("ValidSpecial!").success).toBe(false);
    });

    it("rejects passwords missing a special character", () => {
      expect(passwordSchema.safeParse("Valid12345").success).toBe(false);
    });
  });

  describe("Username Policy", () => {
    it("accepts valid usernames", () => {
      expect(usernameSchema.safeParse("trader_01").success).toBe(true);
      expect(usernameSchema.safeParse("admin").success).toBe(true);
      expect(usernameSchema.safeParse("user123").success).toBe(true);
    });

    it("rejects usernames shorter than 3 or longer than 20 characters", () => {
      expect(usernameSchema.safeParse("ab").success).toBe(false);
      expect(usernameSchema.safeParse("a".repeat(21)).success).toBe(false);
    });

    it("rejects usernames with invalid characters or spaces", () => {
      expect(usernameSchema.safeParse("user-name").success).toBe(false);
      expect(usernameSchema.safeParse("user name").success).toBe(false);
      expect(usernameSchema.safeParse("user@name").success).toBe(false);
    });
  });

  describe("Email Validation", () => {
    it("trims and lowercases valid email addresses", () => {
      const res = emailSchema.safeParse("  Trader@Example.COM  ");
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data).toBe("trader@example.com");
      }
    });

    it("rejects invalid email formats", () => {
      expect(emailSchema.safeParse("not-an-email").success).toBe(false);
      expect(emailSchema.safeParse("@missing-user.com").success).toBe(false);
    });
  });

  describe("Registration Schema", () => {
    it("validates matching passwords and complete data", () => {
      const validData = {
        fullName: "Jane Trader",
        email: "jane@tradewise.test",
        username: "jane_trader",
        password: "Password123!",
        confirmPassword: "Password123!",
      };
      expect(registerSchema.safeParse(validData).success).toBe(true);
    });

    it("rejects mismatched confirm password", () => {
      const invalidData = {
        fullName: "Jane Trader",
        email: "jane@tradewise.test",
        username: "jane_trader",
        password: "Password123!",
        confirmPassword: "DifferentPassword123!",
      };
      const res = registerSchema.safeParse(invalidData);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toBe("Passwords do not match");
      }
    });
  });

  describe("Change Password Schema", () => {
    it("rejects when new password matches current password", () => {
      const data = {
        currentPassword: "OldPassword123!",
        newPassword: "OldPassword123!",
        confirmNewPassword: "OldPassword123!",
      };
      const res = changePasswordSchema.safeParse(data);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].message).toContain("different from current");
      }
    });
  });
});
