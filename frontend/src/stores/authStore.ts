import { create } from "zustand";
import type { AccountView } from "../types/auth.js";

export type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  user: AccountView | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  isAdmin: boolean;
  setAuth: (user: AccountView) => void;
  setUser: (user: AccountView) => void;
  clearAuth: () => void;
  setStatus: (status: AuthStatus) => void;
}

/**
 * In-memory authentication store.
 * NEVER persists tokens, passwords, or credentials in localStorage/sessionStorage.
 * Authoritative session state is held by the backend via HTTP-only cookie.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "idle",
  isAuthenticated: false,
  isAdmin: false,

  setAuth: (user: AccountView) =>
    set({
      user,
      status: "authenticated",
      isAuthenticated: true,
      isAdmin: user.role === "ADMIN",
    }),

  setUser: (user: AccountView) =>
    set((state) => ({
      user,
      isAdmin: user.role === "ADMIN",
      isAuthenticated: state.isAuthenticated,
    })),

  clearAuth: () =>
    set({
      user: null,
      status: "unauthenticated",
      isAuthenticated: false,
      isAdmin: false,
    }),

  setStatus: (status: AuthStatus) => set({ status }),
}));
