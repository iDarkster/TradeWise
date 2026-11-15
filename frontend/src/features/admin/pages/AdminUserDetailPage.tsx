import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { Card } from "../../../components/ui/Card.js";
import { Button } from "../../../components/ui/Button.js";
import { Badge } from "../../../components/ui/Badge.js";
import { Modal } from "../../../components/ui/Modal.js";
import { adminApi } from "../api/adminApi.js";
import { useAuthStore } from "../../../stores/authStore.js";
import { ApiError } from "../../../lib/api/errors.js";
import styles from "./AdminUserDetailPage.module.css";

export function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user: currentAdmin } = useAuthStore();
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal state
  const [modalAction, setModalAction] = useState<"suspend" | "reactivate" | null>(null);

  const {
    data: user,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ["admin", "user", id],
    queryFn: () => adminApi.getUser(id!),
    enabled: Boolean(id),
  });

  const actionMutation = useMutation({
    mutationFn: async (action: "suspend" | "reactivate") => {
      if (!id) throw new Error("Missing ID");
      if (action === "suspend") {
        return adminApi.suspendUser(id);
      } else {
        return adminApi.reactivateUser(id);
      }
    },
    onSuccess: (updatedUser, action) => {
      queryClient.setQueryData(["admin", "user", id], updatedUser);
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setSuccessMessage(
        action === "suspend"
          ? "User account has been suspended and all active sessions revoked."
          : "User account has been reactivated.",
      );
      setModalAction(null);
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        if (err.code === "CONFLICT") {
          setErrorMessage("Cannot modify this account (e.g. self or administrator suspension is prohibited).");
        } else {
          setErrorMessage(err.message || `Failed to ${modalAction} user.`);
        }
      } else {
        setErrorMessage("Network error occurred.");
      }
      setModalAction(null);
    },
  });

  const handleActionConfirm = () => {
    if (!id || !modalAction) return;
    setSuccessMessage(null);
    setErrorMessage(null);
    actionMutation.mutate(modalAction);
  };

  if (isLoading) {
    return <div>Loading account details...</div>;
  }

  const displayError =
    errorMessage || (queryError instanceof ApiError ? queryError.message : null);

  if (!user) {
    return (
      <div>
        <Link to="/admin/users" className={styles.backLink}>
          <ArrowLeft size={16} /> Back to User Management
        </Link>
        <p>{displayError || "User not found."}</p>
      </div>
    );
  }

  const isSelf = currentAdmin?.id === user.id;
  const isTargetAdmin = user.role === "ADMIN";
  const canSuspend = user.status === "ACTIVE" && !isSelf && !isTargetAdmin;
  const canReactivate = user.status === "SUSPENDED";

  return (
    <div>
      <Link to="/admin/users" className={styles.backLink}>
        <ArrowLeft size={16} /> Back to User Management
      </Link>

      {successMessage && (
        <div className={styles.successBanner} role="status">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className={styles.errorBanner} role="alert">
          {errorMessage}
        </div>
      )}

      <Card title={user.fullName} subtitle={`@${user.username} • ${user.email}`}>
        <div className={styles.detailGrid}>
          {/* Identity & Status */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Account Overview</h4>

            <div className={styles.detailRow}>
              <span className={styles.label}>Account ID</span>
              <span className={styles.value} style={{ fontSize: "12px", fontFamily: "monospace" }}>
                {user.id}
              </span>
            </div>

            <div className={styles.detailRow}>
              <span className={styles.label}>Role</span>
              <span className={styles.value}>
                <Badge variant={user.role === "ADMIN" ? "info" : "neutral"}>{user.role}</Badge>
              </span>
            </div>

            <div className={styles.detailRow}>
              <span className={styles.label}>Status</span>
              <span className={styles.value}>
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
              </span>
            </div>

            <div className={styles.detailRow}>
              <span className={styles.label}>Active Sessions</span>
              <span className={styles.value}>{user.activeSessionCount}</span>
            </div>
          </div>

          {/* Timestamps */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Activity & Timestamps</h4>

            <div className={styles.detailRow}>
              <span className={styles.label}>Registered At</span>
              <span className={styles.value}>
                {new Date(user.registeredAt || user.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>

            <div className={styles.detailRow}>
              <span className={styles.label}>Last Login</span>
              <span className={styles.value}>
                {user.lastLoginAt
                  ? new Date(user.lastLoginAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Never"}
              </span>
            </div>

            <div className={styles.detailRow}>
              <span className={styles.label}>Last Activity</span>
              <span className={styles.value}>
                {user.lastActivityAt
                  ? new Date(user.lastActivityAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "None"}
              </span>
            </div>

            <div className={styles.detailRow}>
              <span className={styles.label}>Account Updated</span>
              <span className={styles.value}>
                {new Date(user.updatedAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>

          {/* Administrative Actions */}
          <div className={styles.actionsCard}>
            <div className={styles.actionsText}>
              <span className={styles.actionsTitle}>Account Status Control</span>
              <span className={styles.actionsDesc}>
                {isSelf
                  ? "You cannot modify your own administrator account status."
                  : isTargetAdmin
                    ? "Administrator accounts cannot be suspended."
                    : user.status === "ACTIVE"
                      ? "Suspending this account immediately revokes all active sessions and prevents further logins."
                      : "Reactivating this account restores the user's ability to log in."}
              </span>
            </div>

            <div>
              {canSuspend && (
                <Button variant="danger" size="md" onClick={() => setModalAction("suspend")}>
                  Suspend Account
                </Button>
              )}

              {canReactivate && (
                <Button variant="primary" size="md" onClick={() => setModalAction("reactivate")}>
                  Reactivate Account
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Confirmation Modal */}
      <Modal
        isOpen={Boolean(modalAction)}
        onClose={() => setModalAction(null)}
        title={modalAction === "suspend" ? "Suspend User Account" : "Reactivate User Account"}
        footer={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setModalAction(null)}
              disabled={actionMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant={modalAction === "suspend" ? "danger" : "primary"}
              size="md"
              onClick={handleActionConfirm}
              isLoading={actionMutation.isPending}
            >
              {modalAction === "suspend" ? "Confirm Suspension" : "Confirm Reactivation"}
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
          <ShieldAlert size={20} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            {modalAction === "suspend" ? (
              <p>
                Are you sure you want to suspend <strong>{user.fullName}</strong> (@{user.username})?
                All active sessions will be terminated immediately.
              </p>
            ) : (
              <p>
                Are you sure you want to reactivate <strong>{user.fullName}</strong> (@{user.username})?
                The user will be permitted to log in again.
              </p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
