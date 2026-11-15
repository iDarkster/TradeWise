import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";
import { useAuthStore } from "../stores/authStore.js";
import { setCsrfToken, getCsrfToken, apiClient } from "../lib/api/client.js";
import { ApiError } from "../lib/api/errors.js";
import { authApi } from "../features/auth/api/authApi.js";
import { Button } from "../components/ui/Button.js";
import { Input } from "../components/ui/Input.js";
import { Modal } from "../components/ui/Modal.js";
import { Badge } from "../components/ui/Badge.js";
import { Card } from "../components/ui/Card.js";
import { ProtectedRoute, AdminRoute, PublicOnlyRoute } from "../components/navigation/RouteGuards.js";
import { ThemeProvider } from "../app/providers/ThemeProvider.js";
import { GlobalHeader } from "../components/navigation/GlobalHeader.js";
import { ProfileMenu } from "../components/navigation/ProfileMenu.js";
import { BootstrapPage } from "../features/explore/pages/BootstrapPage.js";
import { LoginPage } from "../features/auth/pages/LoginPage.js";
import { RegisterPage } from "../features/auth/pages/RegisterPage.js";
import type { AccountView } from "../types/auth.js";

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

const mockAdmin: AccountView = {
  ...mockUser,
  id: "22222222-2222-2222-2222-222222222222",
  email: "admin@tradewise.test",
  username: "super_admin",
  role: "ADMIN",
};

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

describe("TradeWise M1 Frontend Integration", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
    setCsrfToken(null);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Auth Store State Management", () => {
    it("updates store and computes isAdmin correctly for regular user", () => {
      useAuthStore.getState().setAuth(mockUser);
      const state = useAuthStore.getState();

      expect(state.isAuthenticated).toBe(true);
      expect(state.isAdmin).toBe(false);
      expect(state.status).toBe("authenticated");
      expect(state.user?.email).toBe("trader@example.com");
    });

    it("updates store and computes isAdmin correctly for admin user", () => {
      useAuthStore.getState().setAuth(mockAdmin);
      const state = useAuthStore.getState();

      expect(state.isAuthenticated).toBe(true);
      expect(state.isAdmin).toBe(true);
      expect(state.status).toBe("authenticated");
    });

    it("clears auth cleanly on logout", () => {
      useAuthStore.getState().setAuth(mockUser);
      useAuthStore.getState().clearAuth();
      const state = useAuthStore.getState();

      expect(state.isAuthenticated).toBe(false);
      expect(state.isAdmin).toBe(false);
      expect(state.status).toBe("unauthenticated");
      expect(state.user).toBeNull();
    });
  });

  describe("API Client & CSRF Management", () => {
    it("manages in-memory CSRF token without leaking to localStorage", () => {
      expect(getCsrfToken()).toBeNull();

      setCsrfToken("test-csrf-token-1234");
      expect(getCsrfToken()).toBe("test-csrf-token-1234");
      expect(localStorage.getItem("csrfToken")).toBeNull();

      setCsrfToken(null);
      expect(getCsrfToken()).toBeNull();
    });

    it("handles 204 No Content responses without calling response.json()", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        status: 204,
        ok: true,
        headers: new Headers(),
        json: vi.fn(),
      } as unknown as Response);

      const result = await apiClient.post("/api/auth/logout");
      expect(result).toBeUndefined();
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/logout"),
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        }),
      );
    });

    it("automatically injects X-CSRF-Token on state-changing requests when available", async () => {
      setCsrfToken("csrf-hex-token-xyz");

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        status: 204,
        ok: true,
        headers: new Headers(),
      } as unknown as Response);

      await apiClient.post("/api/auth/logout-others");

      const callArgs = fetchSpy.mock.calls[0];
      const headers = callArgs[1]?.headers as Headers;
      expect(headers.get("X-CSRF-Token")).toBe("csrf-hex-token-xyz");
    });
  });

  describe("Auth API Client Functions", () => {
    it("seeds CSRF token and sets auth store on successful login", async () => {
      vi.spyOn(apiClient, "post").mockResolvedValue({
        user: mockUser,
        csrfToken: "fresh-csrf-token-999",
      });

      const user = await authApi.login({
        identifier: "trader_jane",
        password: "Password123!",
      });

      expect(user.id).toBe(mockUser.id);
      expect(getCsrfToken()).toBe("fresh-csrf-token-999");
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user?.username).toBe("trader_jane");
    });

    it("clears CSRF token and auth store on logout", async () => {
      useAuthStore.getState().setAuth(mockUser);
      setCsrfToken("old-token");

      vi.spyOn(apiClient, "post").mockResolvedValue(undefined);

      await authApi.logout();

      expect(getCsrfToken()).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  describe("Route Guards", () => {
    it("redirects unauthenticated user away from ProtectedRoute", () => {
      useAuthStore.getState().clearAuth();

      render(
        <MemoryRouter initialEntries={["/settings"]}>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/settings" element={<div>Protected Settings</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByText("Login Page")).toBeInTheDocument();
      expect(screen.queryByText("Protected Settings")).not.toBeInTheDocument();
    });

    it("renders outlet for authenticated user on ProtectedRoute", () => {
      useAuthStore.getState().setAuth(mockUser);

      render(
        <MemoryRouter initialEntries={["/settings"]}>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/settings" element={<div>Protected Settings</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByText("Protected Settings")).toBeInTheDocument();
    });

    it("redirects non-admin away from AdminRoute to home", () => {
      useAuthStore.getState().setAuth(mockUser); // role: USER

      render(
        <MemoryRouter initialEntries={["/admin/users"]}>
          <Routes>
            <Route path="/" element={<div>Home Page</div>} />
            <Route element={<AdminRoute />}>
              <Route path="/admin/users" element={<div>Admin Console</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByText("Home Page")).toBeInTheDocument();
      expect(screen.queryByText("Admin Console")).not.toBeInTheDocument();
    });

    it("allows admin user to access AdminRoute", () => {
      useAuthStore.getState().setAuth(mockAdmin); // role: ADMIN

      render(
        <MemoryRouter initialEntries={["/admin/users"]}>
          <Routes>
            <Route path="/" element={<div>Home Page</div>} />
            <Route element={<AdminRoute />}>
              <Route path="/admin/users" element={<div>Admin Console</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByText("Admin Console")).toBeInTheDocument();
    });

    it("redirects authenticated user away from PublicOnlyRoute", () => {
      useAuthStore.getState().setAuth(mockUser);

      render(
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/" element={<div>Dashboard</div>} />
            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<div>Login Page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByText("Dashboard")).toBeInTheDocument();
      expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
    });

    it("redirects authenticated admin away from PublicOnlyRoute to admin users", () => {
      useAuthStore.getState().setAuth(mockAdmin);

      render(
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/admin/users" element={<div>Admin Console</div>} />
            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<div>Login Page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByText("Admin Console")).toBeInTheDocument();
      expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
    });
  });

  describe("UI Primitives", () => {
    it("renders Button and handles loading and disabled states", () => {
      render(
        <Button isLoading disabled>
          Submit
        </Button>,
      );
      const btn = screen.getByRole("button");
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute("aria-busy", "true");
    });

    it("renders Input with password toggle functionality", async () => {
      const user = userEvent.setup();
      render(<Input label="Password" isPassword placeholder="Enter password" />);

      const input = screen.getByPlaceholderText("Enter password") as HTMLInputElement;
      expect(input.type).toBe("password");

      const toggleBtn = screen.getByRole("button", { name: /show password/i });
      await user.click(toggleBtn);

      expect(input.type).toBe("text");
    });

    it("renders Card and Badge components properly", () => {
      render(
        <Card title="Account Info" subtitle="Your profile data">
          <div>Card Content</div>
          <Badge variant="success">Active</Badge>
        </Card>,
      );

      expect(screen.getByText("Account Info")).toBeInTheDocument();
      expect(screen.getByText("Your profile data")).toBeInTheDocument();
      expect(screen.getByText("Card Content")).toBeInTheDocument();
      expect(screen.getByText("Active")).toBeInTheDocument();
    });

    it("renders Modal and handles escape key dismiss", () => {
      const onClose = vi.fn();
      render(
        <Modal isOpen onClose={onClose} title="Confirm Action">
          <div>Modal Body</div>
        </Modal>,
      );

      expect(screen.getByText("Confirm Action")).toBeInTheDocument();
      expect(screen.getByText("Modal Body")).toBeInTheDocument();

      fireEvent.keyDown(window, { key: "Escape" });
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("Authentication Screens", () => {
    it("renders Login page and handles form submission error", async () => {
      const user = userEvent.setup();
      vi.spyOn(authApi, "login").mockRejectedValue(new Error("Network failure"));

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <LoginPage />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      expect(screen.getByRole("heading", { name: /Welcome back/i })).toBeInTheDocument();

      const identifierInput = screen.getByLabelText(/Email or Username/i);
      const passwordInput = screen.getByLabelText(/^Password/i);
      const submitButton = screen.getByRole("button", { name: /^Log In$/i });

      await user.type(identifierInput, "trader_jane");
      await user.type(passwordInput, "ValidPassword123!");
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
    });

    it("renders Register page with password policy checklist", async () => {
      const user = userEvent.setup();

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <RegisterPage />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      expect(screen.getByRole("heading", { name: /Create your account/i })).toBeInTheDocument();

      const passwordInput = screen.getByLabelText(/^Password/i);
      await user.type(passwordInput, "Test1!");

      expect(screen.getByText("Password requirements:")).toBeInTheDocument();
      expect(screen.getByText("8 to 128 characters")).toBeInTheDocument();
      expect(screen.getByText("At least one number (0-9)")).toBeInTheDocument();
      expect(screen.getByText("At least one special character (!@#$%...)")).toBeInTheDocument();
      expect(screen.getByText("No spaces or whitespace allowed")).toBeInTheDocument();
    });

    it("displays user-friendly retry-after duration when registration is rate limited", async () => {
      const user = userEvent.setup();
      const rateLimitError = new ApiError(429, {
        code: "RATE_LIMITED",
        message: "Too many registration attempts. Please wait a moment before trying again.",
        details: { retryAfterSeconds: 125 },
      });
      vi.spyOn(authApi, "register").mockRejectedValue(rateLimitError);

      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter>
            <RegisterPage />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      await user.type(screen.getByLabelText(/Full Name/i), "Jane Doe");
      await user.type(screen.getByLabelText(/Email Address/i), "newuser@example.com");
      await user.type(screen.getByLabelText(/^Username/i), "newuser123");
      await user.type(screen.getByLabelText(/^Password/i), "ValidPass123!");
      await user.type(screen.getByLabelText(/Confirm Password/i), "ValidPass123!");

      const submitButton = screen.getByRole("button", { name: /^Create Account$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Too many registration attempts. Please wait 2m 5s before trying again.",
        );
      });
    });
  });

  describe("Pass 1 Navigation & Admin UI Refinements", () => {
    it("renders GlobalHeader for regular user with Dashboard and without Settings or Admin Portal", () => {
      useAuthStore.getState().setAuth(mockUser);

      render(
        <ThemeProvider>
          <MemoryRouter>
            <GlobalHeader />
          </MemoryRouter>
        </ThemeProvider>,
      );

      expect(screen.getByRole("link", { name: /Dashboard/i })).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /^Settings$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /Admin Portal/i })).not.toBeInTheDocument();

      const brandLink = screen.getByRole("link", { name: /TradeWise/i });
      expect(brandLink).toHaveAttribute("href", "/");
    });

    it("renders GlobalHeader for admin with Admin Portal and without Dashboard or Settings", () => {
      useAuthStore.getState().setAuth(mockAdmin);

      render(
        <ThemeProvider>
          <MemoryRouter>
            <GlobalHeader />
          </MemoryRouter>
        </ThemeProvider>,
      );

      expect(screen.getByRole("link", { name: /Admin Portal/i })).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /^Dashboard$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /^Settings$/i })).not.toBeInTheDocument();

      const brandLink = screen.getByRole("link", { name: /TradeWise/i });
      expect(brandLink).toHaveAttribute("href", "/admin/users");
    });

    it("renders ProfileMenu with settings destinations and without admin shortcuts for user", () => {
      useAuthStore.getState().setAuth(mockUser);

      render(
        <ThemeProvider>
          <MemoryRouter>
            <ProfileMenu isOpen={true} onClose={vi.fn()} />
          </MemoryRouter>
        </ThemeProvider>,
      );

      expect(screen.getByRole("menuitem", { name: /Profile & Account/i })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: /Change Password/i })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: /Active Sessions/i })).toBeInTheDocument();
      expect(screen.queryByRole("menuitem", { name: /User Management/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("menuitem", { name: /Security Audit Logs/i })).not.toBeInTheDocument();
    });

    it("renders ProfileMenu without admin shortcuts for admin", () => {
      useAuthStore.getState().setAuth(mockAdmin);

      render(
        <ThemeProvider>
          <MemoryRouter>
            <ProfileMenu isOpen={true} onClose={vi.fn()} />
          </MemoryRouter>
        </ThemeProvider>,
      );

      expect(screen.getByRole("menuitem", { name: /Profile & Account/i })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: /Change Password/i })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: /Active Sessions/i })).toBeInTheDocument();
      expect(screen.queryByRole("menuitem", { name: /User Management/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("menuitem", { name: /Security Audit Logs/i })).not.toBeInTheDocument();
    });

    it("redirects admin landing on BootstrapPage directly to /admin/users", () => {
      useAuthStore.getState().setAuth(mockAdmin);

      render(
        <ThemeProvider>
          <MemoryRouter initialEntries={["/"]}>
            <Routes>
              <Route path="/" element={<BootstrapPage />} />
              <Route path="/admin/users" element={<div>Admin Users Landing</div>} />
            </Routes>
          </MemoryRouter>
        </ThemeProvider>,
      );

      expect(screen.getByText("Admin Users Landing")).toBeInTheDocument();
      expect(screen.queryByText("Frontend Foundation Reconstructed")).not.toBeInTheDocument();
    });

    it("renders foundation dashboard on BootstrapPage for regular user", () => {
      useAuthStore.getState().setAuth(mockUser);

      render(
        <ThemeProvider>
          <MemoryRouter initialEntries={["/"]}>
            <Routes>
              <Route path="/" element={<BootstrapPage />} />
            </Routes>
          </MemoryRouter>
        </ThemeProvider>,
      );

      expect(screen.getByText("Frontend Foundation Reconstructed")).toBeInTheDocument();
    });
  });
});
