import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore.js";

/**
 * Loading spinner placeholder during initial authentication check.
 */
function AuthLoadingScreen() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "50vh",
        flexDirection: "column",
        gap: "var(--space-3)",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          border: "3px solid var(--color-border-default)",
          borderTopColor: "var(--color-brand-primary)",
          borderRadius: "50%",
          animation: "spin 0.6s linear infinite",
        }}
      />
      <span style={{ color: "var(--color-text-secondary)", fontSize: "var(--fs-caption)" }}>
        Verifying session...
      </span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/**
 * Requires user to be authenticated.
 * If checking session: displays loading state.
 * If unauthenticated: redirects to /login saving intended destination.
 */
export function ProtectedRoute() {
  const { isAuthenticated, status } = useAuthStore();
  const location = useLocation();

  if (status === "idle" || status === "loading") {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

/**
 * Requires user to have ADMIN role.
 * If unauthenticated: redirects to /login.
 * If authenticated as non-admin: redirects to /.
 */
export function AdminRoute() {
  const { isAuthenticated, isAdmin, status } = useAuthStore();
  const location = useLocation();

  if (status === "idle" || status === "loading") {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

/**
 * For public-only pages like /login and /register.
 * If already authenticated: redirects to previous location or home.
 */
export function PublicOnlyRoute() {
  const { isAuthenticated, isAdmin, status } = useAuthStore();
  const location = useLocation();

  if (status === "idle" || status === "loading") {
    return <AuthLoadingScreen />;
  }

  if (isAuthenticated) {
    const defaultPath = isAdmin ? "/admin/users" : "/";
    const fromPath = (location.state as { from?: { pathname: string } })?.from?.pathname || defaultPath;
    const destination = fromPath === "/" && isAdmin ? "/admin/users" : fromPath;
    return <Navigate to={destination} replace />;
  }

  return <Outlet />;
}
