import { useEffect, useRef } from "react";
import { authApi } from "../api/authApi.js";
import { useAuthStore } from "../../../stores/authStore.js";

/**
 * Initializes and restores authentication session on application load.
 * Sequence:
 * 1. GET /api/me to check for an existing HTTP-only cookie session.
 * 2. If authenticated, GET /api/auth/csrf to acquire a session-bound CSRF token.
 * 3. Transitions status to 'authenticated' or 'unauthenticated'.
 */
export function useAuthInit() {
  const status = useAuthStore((state) => state.status);
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const setStatus = useAuthStore((state) => state.setStatus);
  const initializedRef = useRef(false);

  useEffect(() => {
    // Only run once when status is idle
    if (initializedRef.current || useAuthStore.getState().status !== "idle") {
      return;
    }

    initializedRef.current = true;
    setStatus("loading");

    async function bootstrap() {
      try {
        const user = await authApi.getMe();
        setAuth(user);

        // Fetch CSRF token for subsequent mutating operations
        try {
          await authApi.getCsrfToken();
        } catch {
          // CSRF token retrieval failed, but user identity is restored
        }
      } catch {
        clearAuth();
      }
    }

    void bootstrap();
  }, [setAuth, clearAuth, setStatus]);

  return {
    isInitializing: status === "idle" || status === "loading",
  };
}
