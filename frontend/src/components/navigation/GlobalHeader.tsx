import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { ChevronDown, Sun, Moon } from "lucide-react";
import { useAuthStore } from "../../stores/authStore.js";
import { useTheme } from "../../hooks/useTheme.js";
import { Button } from "../ui/Button.js";
import { ProfileMenu } from "./ProfileMenu.js";
import styles from "./GlobalHeader.module.css";

export function GlobalHeader() {
  const { user, isAuthenticated, isAdmin } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const getInitials = (name?: string) => {
    if (!name) return "TW";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to={isAdmin ? "/admin/users" : "/"} className={styles.brandLink}>
          <div className={styles.logo}>TW</div>
          <div className={styles.brandText}>
            <span className={styles.brandTitle}>TradeWise</span>
            <span className={styles.brandTagline}>Learn • Practice • Trade</span>
          </div>
        </Link>

        <nav className={styles.nav}>
          {isAuthenticated && (
            <>
              {!isAdmin && (
                <NavLink
                  to="/"
                  className={({ isActive }) =>
                    [styles.navLink, isActive ? styles.active : ""].filter(Boolean).join(" ")
                  }
                >
                  Dashboard
                </NavLink>
              )}

              {isAdmin && (
                <NavLink
                  to="/admin/users"
                  className={({ isActive }) =>
                    [styles.navLink, isActive ? styles.active : ""].filter(Boolean).join(" ")
                  }
                >
                  Admin Portal
                </NavLink>
              )}
            </>
          )}

          {isAuthenticated && user ? (
            <div className={styles.avatarWrapper}>
              <button
                type="button"
                className={styles.avatarButton}
                onClick={() => setIsMenuOpen((prev) => !prev)}
                aria-expanded={isMenuOpen}
                aria-label="User profile and menu"
              >
                <div className={styles.avatarCircle}>{getInitials(user.fullName)}</div>
                <span className={styles.avatarName}>{user.fullName}</span>
                <ChevronDown size={14} />
              </button>

              <ProfileMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <button
                type="button"
                onClick={toggleTheme}
                className={styles.themeButton}
                aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              >
                {theme === "light" ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <Link to="/login">
                <Button variant="outline" size="sm">
                  Log In
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="primary" size="sm">
                  Sign Up
                </Button>
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
