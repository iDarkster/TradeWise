import { apiClient, setCsrfToken } from "../../../lib/api/client.js";
import { useAuthStore } from "../../../stores/authStore.js";
import type {
  AccountView,
  AuthSessionItem,
  AuthSuccessPayload,
} from "../../../types/auth.js";
import type { LoginFormData, RegisterFormData } from "../schemas/authSchemas.js";

export const authApi = {
  /**
   * Register a new user account.
   * On success: seeds the in-memory CSRF token and updates in-memory auth state.
   */
  async register(data: Omit<RegisterFormData, "confirmPassword">): Promise<AccountView> {
    const result = await apiClient.post<AuthSuccessPayload>("/api/auth/register", data);
    setCsrfToken(result.csrfToken);
    useAuthStore.getState().setAuth(result.user);
    return result.user;
  },

  /**
   * Login with email/username and password.
   * On success: seeds the in-memory CSRF token and updates in-memory auth state.
   */
  async login(data: LoginFormData): Promise<AccountView> {
    const result = await apiClient.post<AuthSuccessPayload>("/api/auth/login", data);
    setCsrfToken(result.csrfToken);
    useAuthStore.getState().setAuth(result.user);
    return result.user;
  },

  /**
   * Fetch current authenticated user.
   */
  async getMe(): Promise<AccountView> {
    const result = await apiClient.get<{ user: AccountView }>("/api/me");
    return result.user;
  },

  /**
   * Fetch current session's CSRF token.
   */
  async getCsrfToken(): Promise<string> {
    const result = await apiClient.get<{ csrfToken: string }>("/api/auth/csrf");
    setCsrfToken(result.csrfToken);
    return result.csrfToken;
  },

  /**
   * Logout current session.
   */
  async logout(): Promise<void> {
    try {
      await apiClient.post<void>("/api/auth/logout");
    } finally {
      setCsrfToken(null);
      useAuthStore.getState().clearAuth();
    }
  },

  /**
   * Logout all other sessions except current.
   */
  async logoutOthers(): Promise<void> {
    await apiClient.post<void>("/api/auth/logout-others");
  },

  /**
   * Logout all sessions including current.
   */
  async logoutAll(): Promise<void> {
    try {
      await apiClient.post<void>("/api/auth/logout-all");
    } finally {
      setCsrfToken(null);
      useAuthStore.getState().clearAuth();
    }
  },

  /**
   * List active sessions for the current user.
   */
  async listSessions(): Promise<AuthSessionItem[]> {
    const result = await apiClient.get<{ sessions: AuthSessionItem[] }>("/api/auth/sessions");
    return result.sessions;
  },

  /**
   * Revoke a specific session by ID.
   */
  async revokeSession(sessionId: string): Promise<void> {
    await apiClient.delete<void>(`/api/auth/sessions/${sessionId}`);
  },
};
