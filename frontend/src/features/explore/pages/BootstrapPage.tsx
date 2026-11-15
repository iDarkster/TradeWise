import { useTheme } from "../../../hooks/useTheme.js";
import { useAuthStore } from "../../../stores/authStore.js";
import { Link, Navigate } from "react-router-dom";
import { ShieldCheck, Layers, Palette, Terminal, ArrowRight } from "lucide-react";
import { Button } from "../../../components/ui/Button.js";
import styles from "./BootstrapPage.module.css";

export function BootstrapPage() {
  const { theme } = useTheme();
  const { user, isAuthenticated, isAdmin } = useAuthStore();

  if (isAuthenticated && isAdmin) {
    return <Navigate to="/admin/users" replace />;
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <section className={styles.card}>
          <div className={styles.badge}>Foundation Active</div>
          <h2 className={styles.heading}>Frontend Foundation Reconstructed</h2>
          <p className={styles.copy}>
            Welcome to TradeWise — simulated paper trading and trading education platform.
            Module 1 Identity &amp; Access is fully active.
          </p>

          <div style={{ marginTop: "var(--space-4)", marginBottom: "var(--space-6)" }}>
            {isAuthenticated && user ? (
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <span style={{ fontSize: "var(--fs-body)", color: "var(--color-text-secondary)" }}>
                  Signed in as <strong>{user.fullName}</strong> (@{user.username})
                </span>
                <Link to="/settings/basic-details">
                  <Button variant="secondary" size="sm">
                    Manage Profile <ArrowRight size={14} />
                  </Button>
                </Link>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "var(--space-3)" }}>
                <Link to="/register">
                  <Button variant="primary" size="md">
                    Create Account
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="outline" size="md">
                    Sign In
                  </Button>
                </Link>
              </div>
            )}
          </div>

          <div className={styles.grid}>
            <div className={styles.featureItem}>
              <div className={styles.featureIcon}>
                <Palette size={20} />
              </div>
              <div>
                <h3 className={styles.featureTitle}>Dual Theme System</h3>
                <p className={styles.featureText}>
                  Light and Dark modes are active and persisted. Current mode: <strong>{theme}</strong>.
                </p>
              </div>
            </div>

            <div className={styles.featureItem}>
              <div className={styles.featureIcon}>
                <Layers size={20} />
              </div>
              <div>
                <h3 className={styles.featureTitle}>Feature-Slice Architecture</h3>
                <p className={styles.featureText}>
                  Organized by domain slices, including auth, explore, holdings, trading, learning, and quizzes.
                </p>
              </div>
            </div>

            <div className={styles.featureItem}>
              <div className={styles.featureIcon}>
                <Terminal size={20} />
              </div>
              <div>
                <h3 className={styles.featureTitle}>Typed API Boundary</h3>
                <p className={styles.featureText}>
                  Centralized HTTP client with credentials support, CSRF token handling, and typed error envelopes.
                </p>
              </div>
            </div>

            <div className={styles.featureItem}>
              <div className={styles.featureIcon}>
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className={styles.featureTitle}>Ready for Module 1</h3>
                <p className={styles.featureText}>
                  Identity &amp; Access UI implementation with session, CSRF, and admin portal.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
