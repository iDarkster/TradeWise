import { useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, KeyRound, Monitor, LogOut, Sun, Moon } from "lucide-react";
import { useAuthStore } from "../../stores/authStore.js";
import { useTheme } from "../../hooks/useTheme.js";
import { authApi } from "../../features/auth/api/authApi.js";
import { Badge } from "../ui/Badge.js";
import styles from "./ProfileMenu.module.css";

export interface ProfileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileMenu({ isOpen, onClose }: ProfileMenuProps) {
  const { user, isAdmin } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !user) return null;

  const handleLogout = async () => {
    onClose();
    try {
      await authApi.logout();
    } catch {
      // Ignored: client state is cleared anyway
    }
    navigate("/login", { replace: true });
  };

  return (
    <div ref={menuRef} className={styles.popover} role="menu" aria-label="User profile menu">
      <div className={styles.userSummary}>
        <div className={styles.userNameRow}>
          <span className={styles.userName}>{user.fullName}</span>
          {isAdmin ? (
            <Badge variant="info">Admin</Badge>
          ) : (
            <Badge variant={user.status === "ACTIVE" ? "success" : "danger"}>
              {user.status}
            </Badge>
          )}
        </div>
        <span className={styles.userHandle}>@{user.username}</span>
        <span className={styles.userEmail}>{user.email}</span>
      </div>

      <ul className={styles.menuList}>
        <li>
          <Link
            to="/settings/basic-details"
            className={styles.menuItem}
            onClick={onClose}
            role="menuitem"
          >
            <span className={styles.menuItemIcon}>
              <User size={16} />
            </span>
            <span>Profile & Account</span>
          </Link>
        </li>
        <li>
          <Link
            to="/settings/change-password"
            className={styles.menuItem}
            onClick={onClose}
            role="menuitem"
          >
            <span className={styles.menuItemIcon}>
              <KeyRound size={16} />
            </span>
            <span>Change Password</span>
          </Link>
        </li>
        <li>
          <Link
            to="/settings/sessions"
            className={styles.menuItem}
            onClick={onClose}
            role="menuitem"
          >
            <span className={styles.menuItemIcon}>
              <Monitor size={16} />
            </span>
            <span>Active Sessions</span>
          </Link>
        </li>
      </ul>

      <div className={styles.footer}>
        <button
          type="button"
          onClick={toggleTheme}
          className={styles.themeToggle}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
          {theme === "light" ? <Sun size={14} /> : <Moon size={14} />}
          <span>{theme === "light" ? "Light" : "Dark"}</span>
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className={styles.logoutButton}
          aria-label="Log out"
        >
          <LogOut size={14} />
          <span>Log out</span>
        </button>
      </div>
    </div>
  );
}
