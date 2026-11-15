import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, RotateCcw } from "lucide-react";
import { Card } from "../../../components/ui/Card.js";
import { Input } from "../../../components/ui/Input.js";
import { Button } from "../../../components/ui/Button.js";
import { Badge } from "../../../components/ui/Badge.js";
import { adminApi, type AdminAuditLogQueryParams } from "../api/adminApi.js";
import styles from "./AdminAuditLogsPage.module.css";

export function AdminAuditLogsPage() {
  const [page, setPage] = useState(1);
  const [actionInput, setActionInput] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const queryParams: AdminAuditLogQueryParams = {
    page,
    limit: 10,
    action: actionFilter.trim() || undefined,
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin", "audit-logs", queryParams],
    queryFn: () => adminApi.listAuditLogs(queryParams),
  });

  const events = data?.events ?? [];
  const pagination = data?.pagination ?? {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setActionFilter(actionInput);
  };

  const handleClearFilter = () => {
    setActionInput("");
    setActionFilter("");
    setPage(1);
  };

  const getActionBadgeVariant = (action: string) => {
    if (action.includes("SUSPEND") || action.includes("FAILED") || action.includes("BLOCKED")) {
      return "danger";
    }
    if (action.includes("REACTIVATE") || action.includes("REGISTER") || action.includes("SUCCESS")) {
      return "success";
    }
    if (action.includes("ADMIN")) {
      return "info";
    }
    return "neutral";
  };

  const hasFilter = Boolean(actionInput || actionFilter);

  return (
    <Card
      title="Security Audit Logs"
      subtitle="Immutable trail of critical security, authentication, and administrative actions"
    >
      <form onSubmit={handleSearchSubmit} className={styles.filtersBar}>
        <div className={styles.inputWrapper}>
          <Input
            placeholder="Filter by action name (e.g. USER_SUSPENDED, login, register)..."
            value={actionInput}
            onChange={(e) => setActionInput(e.target.value)}
          />
        </div>

        <div className={styles.buttonGroup}>
          <Button type="submit" variant="secondary" size="md" isLoading={isFetching}>
            <Search size={16} />
            <span>Filter</span>
          </Button>

          {hasFilter && (
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleClearFilter}
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
              <th className={`${styles.th} ${styles.colTimestamp}`}>Timestamp</th>
              <th className={`${styles.th} ${styles.colAction}`}>Action</th>
              <th className={`${styles.th} ${styles.colActor}`}>Actor</th>
              <th className={`${styles.th} ${styles.colTarget}`}>Target</th>
              <th className={`${styles.th} ${styles.colMetadata}`}>Metadata</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className={styles.loadingOrEmpty}>
                  Loading audit logs...
                </td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.loadingOrEmpty}>
                  No security events recorded matching criteria.
                </td>
              </tr>
            ) : (
              events.map((event) => (
                <tr key={event.id} className={styles.tr}>
                  <td className={`${styles.td} ${styles.nowrap}`}>
                    {new Date(event.timestamp).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </td>
                  <td className={`${styles.td} ${styles.nowrap}`}>
                    <Badge variant={getActionBadgeVariant(event.action)}>
                      {event.action}
                    </Badge>
                  </td>
                  <td className={styles.td}>
                    {event.actor ? (
                      <div>
                        <div>{event.actor.username}</div>
                        <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                          {event.actor.email}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: "var(--color-text-muted)" }}>System / Anonymous</span>
                    )}
                  </td>
                  <td className={styles.td}>
                    {event.target ? (
                      <div>
                        <div>{event.target.username}</div>
                        <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                          {event.target.email}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: "var(--color-text-muted)" }}>—</span>
                    )}
                  </td>
                  <td className={styles.td}>
                    {event.metadata && Object.keys(event.metadata).length > 0 ? (
                      <pre className={styles.metadataPre}>
                        {JSON.stringify(event.metadata, null, 2)}
                      </pre>
                    ) : (
                      <span style={{ color: "var(--color-text-muted)" }}>—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        <div>
          Showing page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} total events)
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
