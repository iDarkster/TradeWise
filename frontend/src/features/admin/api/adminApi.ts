import { apiClient } from "../../../lib/api/client.js";
import type {
  AdminAuditLogResponse,
  AdminUserDetails,
  AdminUserListResponse,
} from "../../../types/auth.js";

export interface AdminUserQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: "ACTIVE" | "SUSPENDED" | "DELETED";
  role?: "USER" | "ADMIN";
  sortBy?: "createdAt" | "username" | "email";
  order?: "asc" | "desc";
  createdFrom?: string;
  createdTo?: string;
}

export interface AdminAuditLogQueryParams {
  page?: number;
  limit?: number;
  actorId?: string;
  targetId?: string;
  action?: string;
  createdFrom?: string;
  createdTo?: string;
}

export const adminApi = {
  /**
   * List users with pagination and filters.
   */
  async listUsers(params?: AdminUserQueryParams): Promise<AdminUserListResponse> {
    return apiClient.get<AdminUserListResponse>("/api/admin/users", {
      params: params as Record<string, string | number | boolean | undefined>,
    });
  },

  /**
   * Get user details with session activity statistics.
   */
  async getUser(id: string): Promise<AdminUserDetails> {
    const result = await apiClient.get<{ user: AdminUserDetails }>(`/api/admin/users/${id}`);
    return result.user;
  },

  /**
   * Suspend a regular user account.
   */
  async suspendUser(id: string): Promise<AdminUserDetails> {
    const result = await apiClient.post<{ user: AdminUserDetails }>(`/api/admin/users/${id}/suspend`);
    return result.user;
  },

  /**
   * Reactivate a suspended user account.
   */
  async reactivateUser(id: string): Promise<AdminUserDetails> {
    const result = await apiClient.post<{ user: AdminUserDetails }>(`/api/admin/users/${id}/reactivate`);
    return result.user;
  },

  /**
   * List security audit log events with pagination and filters.
   */
  async listAuditLogs(params?: AdminAuditLogQueryParams): Promise<AdminAuditLogResponse> {
    return apiClient.get<AdminAuditLogResponse>("/api/admin/audit-logs", {
      params: params as Record<string, string | number | boolean | undefined>,
    });
  },
};
