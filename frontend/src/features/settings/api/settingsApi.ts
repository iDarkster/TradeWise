import { apiClient } from "../../../lib/api/client.js";
import { useAuthStore } from "../../../stores/authStore.js";
import type { AccountView } from "../../../types/auth.js";
import type { ChangePasswordFormData, ProfileUpdateFormData } from "../../auth/schemas/authSchemas.js";

export const settingsApi = {
  /**
   * Update current user profile mutable fields (username, fullName, avatarUrl).
   * Note: email and password are intentionally rejected if sent.
   */
  async updateProfile(data: ProfileUpdateFormData): Promise<AccountView> {
    const payload: Record<string, unknown> = {};
    if (data.username !== undefined && data.username.trim() !== "") payload.username = data.username.trim();
    if (data.fullName !== undefined && data.fullName.trim() !== "") payload.fullName = data.fullName.trim();
    if (data.avatarUrl !== undefined) {
      payload.avatarUrl = data.avatarUrl === "" ? null : data.avatarUrl;
    }

    const result = await apiClient.patch<{ user: AccountView }>("/api/me/profile", payload);
    useAuthStore.getState().setUser(result.user);
    return result.user;
  },

  /**
   * Change current user password.
   * Note: Backend revokes all other sessions upon password change.
   */
  async changePassword(data: ChangePasswordFormData): Promise<void> {
    await apiClient.post<{ changed: boolean }>("/api/me/password", {
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
  },
};
