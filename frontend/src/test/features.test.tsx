import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";
import { useAuthStore } from "../stores/authStore.js";
import { settingsApi } from "../features/settings/api/settingsApi.js";
import { authApi } from "../features/auth/api/authApi.js";
import { adminApi } from "../features/admin/api/adminApi.js";
import { BasicDetailsPage } from "../features/settings/pages/BasicDetailsPage.js";
import { ChangePasswordPage } from "../features/settings/pages/ChangePasswordPage.js";
import { ActiveSessionsPage } from "../features/settings/pages/ActiveSessionsPage.js";
import { AdminUsersPage } from "../features/admin/pages/AdminUsersPage.js";
import { AdminUserDetailPage } from "../features/admin/pages/AdminUserDetailPage.js";
import { AdminAuditLogsPage } from "../features/admin/pages/AdminAuditLogsPage.js";
import type { AccountView, AdminUserDetails, AuthSessionItem } from "../types/auth.js";

const mockUser: AccountView = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "trader@example.com",
  username: "trader_jane",
  fullName: "Jane Trader",
  avatarUrl: null,
  role: "USER",
  status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00.000Z",
  lastLoginAt: "2026-01-02T10:00:00.000Z",
  lastActivityAt: "2026-01-02T10:05:00.000Z",
};

const mockAdminUser: AccountView = {
  ...mockUser,
  id: "99999999-9999-9999-9999-999999999999",
  email: "admin@tradewise.test",
  username: "admin_user",
  role: "ADMIN",
};

const mockTargetUserDetails: AdminUserDetails = {
  id: "33333333-3333-3333-3333-333333333333",
  email: "target@example.com",
  username: "target_user",
  fullName: "Target User",
  avatarUrl: null,
  role: "USER",
  status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  registeredAt: "2026-01-01T00:00:00.000Z",
  lastLoginAt: "2026-01-02T00:00:00.000Z",
  lastActivityAt: "2026-01-02T01:00:00.000Z",
  deletedAt: null,
  activeSessionCount: 1,
  sessionActivity: {
    activeSessionCount: 1,
    mostRecentActivityAt: "2026-01-02T01:00:00.000Z",
    oldestActiveSessionCreatedAt: "2026-01-01T00:00:00.000Z",
  },
};

const mockSessions: AuthSessionItem[] = [
  {
    id: "session-1",
    client: "Chrome on macOS",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastActivityAt: "2026-01-01T01:00:00.000Z",
    expiresAt: "2026-01-31T01:00:00.000Z",
    isCurrent: true,
  },
  {
    id: "session-2",
    client: "Safari on iPhone",
    createdAt: "2026-01-02T00:00:00.000Z",
    lastActivityAt: "2026-01-02T00:30:00.000Z",
    expiresAt: "2026-02-01T00:30:00.000Z",
    isCurrent: false,
  },
];

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

describe("TradeWise M1 Settings & Admin Pages", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("BasicDetailsPage", () => {
    it("renders user information with immutable email field", () => {
      useAuthStore.getState().setAuth(mockUser);

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <BasicDetailsPage />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      expect(screen.getByText("Profile & Account Details")).toBeInTheDocument();
      expect(screen.getByText(mockUser.email)).toBeInTheDocument();
      expect(screen.getByText("Read-only")).toBeInTheDocument();
      expect(screen.getByDisplayValue(mockUser.fullName)).toBeInTheDocument();
      expect(screen.getByDisplayValue(mockUser.username)).toBeInTheDocument();
    });

    it("submits profile update successfully", async () => {
      const user = userEvent.setup();
      useAuthStore.getState().setAuth(mockUser);

      const updateSpy = vi.spyOn(settingsApi, "updateProfile").mockResolvedValue({
        ...mockUser,
        fullName: "Jane Updated",
      });

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <BasicDetailsPage />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      const nameInput = screen.getByLabelText(/Full Name/i);
      await user.clear(nameInput);
      await user.type(nameInput, "Jane Updated");

      const saveBtn = screen.getByRole("button", { name: /Save Changes/i });
      await user.click(saveBtn);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ fullName: "Jane Updated" }),
        );
        expect(screen.getByText("Profile updated successfully.")).toBeInTheDocument();
      });
    });
  });

  describe("ChangePasswordPage", () => {
    it("renders password change form and displays security notice", () => {
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <ChangePasswordPage />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      expect(screen.getByRole("heading", { name: /Change Password/i })).toBeInTheDocument();
      expect(screen.getByText(/Changing your password will automatically revoke/i)).toBeInTheDocument();
    });

    it("submits password change and shows success banner", async () => {
      const user = userEvent.setup();
      const changeSpy = vi.spyOn(settingsApi, "changePassword").mockResolvedValue();

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <ChangePasswordPage />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      const currentInput = screen.getByLabelText(/Current Password/i);
      const newInput = screen.getByLabelText(/^New Password/i);
      const confirmInput = screen.getByLabelText(/Confirm New Password/i);
      const submitBtn = screen.getByRole("button", { name: /Update Password/i });

      await user.type(currentInput, "CurrentPassword123!");
      await user.type(newInput, "BrandNewPassword123!");
      await user.type(confirmInput, "BrandNewPassword123!");
      await user.click(submitBtn);

      await waitFor(() => {
        expect(changeSpy).toHaveBeenCalledWith({
          currentPassword: "CurrentPassword123!",
          newPassword: "BrandNewPassword123!",
          confirmNewPassword: "BrandNewPassword123!",
        });
        expect(screen.getByText(/Password changed successfully/i)).toBeInTheDocument();
      });
    });
  });

  describe("ActiveSessionsPage", () => {
    it("renders session list and marks current session", async () => {
      vi.spyOn(authApi, "listSessions").mockResolvedValue(mockSessions);

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <ActiveSessionsPage />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("Chrome on macOS")).toBeInTheDocument();
        expect(screen.getByText("Safari on iPhone")).toBeInTheDocument();
        expect(screen.getByText("Current Session")).toBeInTheDocument();
      });
    });

    it("opens revocation modal when Revoke button is clicked", async () => {
      const user = userEvent.setup();
      vi.spyOn(authApi, "listSessions").mockResolvedValue(mockSessions);

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <ActiveSessionsPage />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("Safari on iPhone")).toBeInTheDocument();
      });

      const revokeBtn = screen.getByRole("button", { name: /^Revoke$/i });
      await user.click(revokeBtn);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to revoke the session for/i)).toBeInTheDocument();
    });
  });

  describe("Admin Portal Pages", () => {
    it("renders AdminUsersPage with user list and filter controls", async () => {
      vi.spyOn(adminApi, "listUsers").mockResolvedValue({
        users: [
          {
            id: mockUser.id,
            email: mockUser.email,
            username: mockUser.username,
            fullName: mockUser.fullName,
            role: mockUser.role,
            status: mockUser.status,
            createdAt: mockUser.createdAt,
            lastLoginAt: mockUser.lastLoginAt,
            lastActivityAt: mockUser.lastActivityAt,
          },
        ],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <AdminUsersPage />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText(mockUser.fullName)).toBeInTheDocument();
        expect(screen.getByText(`@${mockUser.username}`)).toBeInTheDocument();
        expect(screen.getByText("View Details")).toBeInTheDocument();
      });
    });

    it("submits search, status and role filters together and clears them on AdminUsersPage", async () => {
      const user = userEvent.setup();
      const listUsersMock = vi.spyOn(adminApi, "listUsers").mockResolvedValue({
        users: [
          {
            id: mockUser.id,
            email: mockUser.email,
            username: mockUser.username,
            fullName: mockUser.fullName,
            role: mockUser.role,
            status: mockUser.status,
            createdAt: mockUser.createdAt,
            lastLoginAt: mockUser.lastLoginAt,
            lastActivityAt: mockUser.lastActivityAt,
          },
        ],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <AdminUsersPage />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(listUsersMock).toHaveBeenCalledTimes(1);
        expect(listUsersMock).toHaveBeenLastCalledWith({
          page: 1,
          limit: 10,
          search: undefined,
          status: undefined,
          role: undefined,
        });
      });

      // Type and select filters
      const searchInput = screen.getByPlaceholderText(/Search name, email, or username/i);
      const statusSelect = screen.getByLabelText(/Filter by account status/i);
      const roleSelect = screen.getByLabelText(/Filter by user role/i);

      await user.type(searchInput, "Alice");
      await user.selectOptions(statusSelect, "ACTIVE");
      await user.selectOptions(roleSelect, "USER");

      // Verify that queries are NOT triggered on input change
      expect(listUsersMock).toHaveBeenCalledTimes(1);

      // Submit filters
      const filterButton = screen.getByRole("button", { name: /^Filter$/i });
      await user.click(filterButton);

      await waitFor(() => {
        expect(listUsersMock).toHaveBeenCalledTimes(2);
        expect(listUsersMock).toHaveBeenLastCalledWith({
          page: 1,
          limit: 10,
          search: "Alice",
          status: "ACTIVE",
          role: "USER",
        });
      });

      // Clear filters
      const clearButton = screen.getByRole("button", { name: /^Clear$/i });
      await user.click(clearButton);

      await waitFor(() => {
        expect(listUsersMock).toHaveBeenCalledTimes(3);
        expect(listUsersMock).toHaveBeenLastCalledWith({
          page: 1,
          limit: 10,
          search: undefined,
          status: undefined,
          role: undefined,
        });
      });

      expect(searchInput).toHaveValue("");
      expect(statusSelect).toHaveValue("");
      expect(roleSelect).toHaveValue("");
    });

    it("renders AdminUserDetailPage with suspend action for regular user", async () => {
      useAuthStore.getState().setAuth(mockAdminUser);
      vi.spyOn(adminApi, "getUser").mockResolvedValue(mockTargetUserDetails);

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter initialEntries={["/admin/users/33333333-3333-3333-3333-333333333333"]}>
            <Routes>
              <Route path="/admin/users/:id" element={<AdminUserDetailPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("Target User")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Suspend Account/i })).toBeInTheDocument();
      });
    });

    it("renders AdminAuditLogsPage with audit events", async () => {
      vi.spyOn(adminApi, "listAuditLogs").mockResolvedValue({
        events: [
          {
            id: "event-1",
            actorId: mockAdminUser.id,
            actor: { id: mockAdminUser.id, username: "admin_user", email: "admin@tradewise.test" },
            targetId: mockUser.id,
            target: { id: mockUser.id, username: "trader_jane", email: "trader@example.com" },
            action: "USER_SUSPENDED",
            timestamp: "2026-01-02T12:00:00.000Z",
            metadata: { reason: "test violation" },
          },
        ],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <AdminAuditLogsPage />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("Security Audit Logs")).toBeInTheDocument();
        expect(screen.getByText("USER_SUSPENDED")).toBeInTheDocument();
        expect(screen.getByText("admin_user")).toBeInTheDocument();
        expect(screen.getByText("trader_jane")).toBeInTheDocument();
      });
    });

    it("submits action filter and clears filter on AdminAuditLogsPage", async () => {
      const user = userEvent.setup();
      const listAuditLogsMock = vi.spyOn(adminApi, "listAuditLogs").mockResolvedValue({
        events: [
          {
            id: "event-1",
            actorId: mockAdminUser.id,
            actor: { id: mockAdminUser.id, username: "admin_user", email: "admin@tradewise.test" },
            targetId: mockUser.id,
            target: { id: mockUser.id, username: "trader_jane", email: "trader@example.com" },
            action: "LOGIN_SUCCESS",
            timestamp: "2026-01-02T12:00:00.000Z",
            metadata: { ip: "127.0.0.1" },
          },
        ],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <AdminAuditLogsPage />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(listAuditLogsMock).toHaveBeenCalledTimes(1);
        expect(listAuditLogsMock).toHaveBeenLastCalledWith({
          page: 1,
          limit: 10,
          action: undefined,
        });
      });

      const actionInput = screen.getByPlaceholderText(/Filter by action name/i);
      await user.type(actionInput, "login");

      // Verify that query is NOT triggered on typing
      expect(listAuditLogsMock).toHaveBeenCalledTimes(1);

      // Submit filter
      const filterButton = screen.getByRole("button", { name: /^Filter$/i });
      await user.click(filterButton);

      await waitFor(() => {
        expect(listAuditLogsMock).toHaveBeenCalledTimes(2);
        expect(listAuditLogsMock).toHaveBeenLastCalledWith({
          page: 1,
          limit: 10,
          action: "login",
        });
      });

      // Clear filter
      const clearButton = screen.getByRole("button", { name: /^Clear$/i });
      await user.click(clearButton);

      await waitFor(() => {
        expect(listAuditLogsMock).toHaveBeenCalledTimes(3);
        expect(listAuditLogsMock).toHaveBeenLastCalledWith({
          page: 1,
          limit: 10,
          action: undefined,
        });
      });

      expect(actionInput).toHaveValue("");
    });
  });
});
