import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, RotateCcw } from "lucide-react";
import { Card } from "../../../components/ui/Card.js";
import { Input } from "../../../components/ui/Input.js";
import { Button } from "../../../components/ui/Button.js";
import { Badge } from "../../../components/ui/Badge.js";
import { adminApi, type AdminUserQueryParams } from "../api/adminApi.js";
import styles from "./AdminUsersPage.module.css";

export function AdminUsersPage() {
  const [page, setPage] = useState(1);

  // Form draft state (does not trigger refetch until Filter is submitted)
  const [draftSearch, setDraftSearch] = useState("");
  const [draftStatus, setDraftStatus] = useState<"" | "ACTIVE" | "SUSPENDED" | "DELETED">("");
  const [draftRole, setDraftRole] = useState<"" | "USER" | "ADMIN">("");

  // Applied filter state (drives the TanStack Query)
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedStatus, setAppliedStatus] = useState<"" | "ACTIVE" | "SUSPENDED" | "DELETED">("");
  const [appliedRole, setAppliedRole] = useState<"" | "USER" | "ADMIN">("");

  const queryParams: AdminUserQueryParams = {
    page,
    limit: 10,
    search: appliedSearch.trim() || undefined,
    status: appliedStatus || undefined,
    role: appliedRole || undefined,
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin", "users", queryParams],
    queryFn: () => adminApi.listUsers(queryParams),
  });

  const users = data?.users ?? [];
  const pagination = data?.pagination ?? {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  };

  const hasActiveFilters = Boolean(appliedSearch || appliedStatus || appliedRole);
  const hasDraftFilters = Boolean(draftSearch || draftStatus || draftRole);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(draftSearch);
    setAppliedStatus(draftStatus);
    setAppliedRole(draftRole);
  };

  const handleClearFilters = () => {
    setDraftSearch("");
    setDraftStatus("");
    setDraftRole("");
    setPage(1);
    setAppliedSearch("");
    setAppliedStatus("");
    setAppliedRole("");
  };

  return (
    <Card
      title="User Management"
      subtitle="Inspect accounts, review roles, and manage access status"
    >
      <form onSubmit={handleFilterSubmit} className={styles.filtersBar}>
        <div className={styles.searchWrapper}>
          <Input
            placeholder="Search name, email, or username..."
            value={draftSearch}
            onChange={(e) => setDraftSearch(e.target.value)}
          />
        </div>

        <select
          className={styles.select}
          value={draftStatus}
          onChange={(e) => setDraftStatus(e.target.value as "" | "ACTIVE" | "SUSPENDED" | "DELETED")}
          aria-label="Filter by account status"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="DELETED">Deleted</option>
        </select>

        <select
          className={styles.select}
          value={draftRole}
          onChange={(e) => setDraftRole(e.target.value as "" | "USER" | "ADMIN")}
          aria-label="Filter by user role"
        >
          <option value="">All Roles</option>
          <option value="USER">User</option>
          <option value="ADMIN">Admin</option>
        </select>

        <div className={styles.buttonGroup}>
          <Button type="submit" variant="secondary" size="md" isLoading={isFetching}>
            <Search size={16} />
            <span>Filter</span>
          </Button>

          {(hasActiveFilters || hasDraftFilters) && (
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleClearFilters}
              disabled={isFetching}
            >
              <RotateCcw size={14} />
              <span>Clear</span>
            </Button>
          )}
        </div>
      </form>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={`${styles.th} ${styles.colUser}`}>User</th>
              <th className={`${styles.th} ${styles.colUsername}`}>Username</th>
              <th className={`${styles.th} ${styles.colRole}`}>Role</th>
              <th className={`${styles.th} ${styles.colStatus}`}>Status</th>
              <th className={`${styles.th} ${styles.colRegistered}`}>Registered</th>
              <th className={`${styles.th} ${styles.colLastLogin}`}>Last Login</th>
              <th className={`${styles.th} ${styles.colActions}`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className={styles.loadingOrEmpty}>
                  Loading user directory...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.loadingOrEmpty}>
                  No users found matching current filters.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className={styles.tr}>
                  <td className={styles.td}>
                    <div className={styles.userCell}>
                      <span className={styles.userName}>{user.fullName}</span>
                      <span className={styles.userEmail}>{user.email}</span>
                    </div>
                  </td>
                  <td className={styles.td}>@{user.username}</td>
                  <td className={styles.td}>
                    <Badge variant={user.role === "ADMIN" ? "info" : "neutral"}>
                      {user.role}
                    </Badge>
                  </td>
                  <td className={styles.td}>
                    <Badge
                      variant={
                        user.status === "ACTIVE"
                          ? "success"
                          : user.status === "SUSPENDED"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {user.status}
                    </Badge>
                  </td>
                  <td className={styles.td}>
                    {new Date(user.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className={styles.td}>
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Never"}
                  </td>
                  <td className={styles.td} style={{ textAlign: "right" }}>
                    <Link to={`/admin/users/${user.id}`}>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        <div>
          Showing page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} total users)
        </div>
        <div className={styles.paginationControls}>
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pagination.totalPages || isLoading}
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </Card>
  );
}
