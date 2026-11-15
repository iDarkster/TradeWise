import { NavLink, Outlet } from "react-router-dom";
import { Users, FileText } from "lucide-react";
import styles from "./AdminLayout.module.css";

export function AdminLayout() {
  return (
    <div className={styles.container}>
      <aside className={styles.sidebar} aria-label="Admin navigation">
        <h3 className={styles.sidebarTitle}>Admin Console</h3>

        <NavLink
          to="/admin/users"
          className={({ isActive }) =>
            [styles.navLink, isActive ? styles.active : ""].filter(Boolean).join(" ")
          }
        >
          <Users size={18} />
          <span>User Management</span>
        </NavLink>

        <NavLink
          to="/admin/audit-logs"
          className={({ isActive }) =>
            [styles.navLink, isActive ? styles.active : ""].filter(Boolean).join(" ")
          }
        >
          <FileText size={18} />
          <span>Security Audit Logs</span>
        </NavLink>
      </aside>

      <section className={styles.content}>
        <Outlet />
      </section>
    </div>
  );
}
