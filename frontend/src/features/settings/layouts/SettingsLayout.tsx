import { NavLink, Outlet } from "react-router-dom";
import { User, KeyRound, Monitor } from "lucide-react";
import styles from "./SettingsLayout.module.css";

export function SettingsLayout() {
  return (
    <div className={styles.container}>
      <aside className={styles.sidebar} aria-label="Settings navigation">
        <h3 className={styles.sidebarTitle}>Settings</h3>

        <NavLink
          to="/settings/basic-details"
          className={({ isActive }) =>
            [styles.navLink, isActive ? styles.active : ""].filter(Boolean).join(" ")
          }
        >
          <User size={18} />
          <span>Profile & Account</span>
        </NavLink>

        <NavLink
          to="/settings/change-password"
          className={({ isActive }) =>
            [styles.navLink, isActive ? styles.active : ""].filter(Boolean).join(" ")
          }
        >
          <KeyRound size={18} />
          <span>Change Password</span>
        </NavLink>

        <NavLink
          to="/settings/sessions"
          className={({ isActive }) =>
            [styles.navLink, isActive ? styles.active : ""].filter(Boolean).join(" ")
          }
        >
          <Monitor size={18} />
          <span>Active Sessions</span>
        </NavLink>
      </aside>

      <section className={styles.content}>
        <Outlet />
      </section>
    </div>
  );
}
