import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Monitor, Smartphone, Globe, ShieldAlert } from "lucide-react";
import { Card } from "../../../components/ui/Card.js";
import { Button } from "../../../components/ui/Button.js";
import { Badge } from "../../../components/ui/Badge.js";
import { Modal } from "../../../components/ui/Modal.js";
import { authApi } from "../../auth/api/authApi.js";
import { ApiError } from "../../../lib/api/errors.js";
import styles from "./ActiveSessionsPage.module.css";

export function ActiveSessionsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    data: sessions = [],
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ["auth", "sessions"],
    queryFn: () => authApi.listSessions(),
  });

  const [dialogState, setDialogState] = useState<{
    type: "revoke_single" | "logout_others" | "logout_all" | null;
    sessionId?: string;
    sessionClient?: string;
  }>({
    type: null,
  });

  const revokeMutation = useMutation({
    mutationFn: async () => {
      if (dialogState.type === "revoke_single" && dialogState.sessionId) {
        await authApi.revokeSession(dialogState.sessionId);
        setSuccessMessage("Session revoked successfully.");
      } else if (dialogState.type === "logout_others") {
        await authApi.logoutOthers();
        setSuccessMessage("Logged out of all other active sessions.");
      } else if (dialogState.type === "logout_all") {
        await authApi.logoutAll();
        navigate("/login", { replace: true });
        return;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] });
      setDialogState({ type: null });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || "Failed to process session revocation.");
      } else {
        setErrorMessage("A network error occurred.");
      }
      setDialogState({ type: null });
    },
  });

  const confirmAction = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
    revokeMutation.mutate();
  };

  const getDeviceIcon = (client: string) => {
    const lower = client.toLowerCase();
    if (lower.includes("mobile") || lower.includes("android") || lower.includes("iphone")) {
      return <Smartphone size={18} />;
    }
    if (lower.includes("mac") || lower.includes("windows") || lower.includes("linux")) {
      return <Monitor size={18} />;
    }
    return <Globe size={18} />;
  };

  const displayError =
    errorMessage || (queryError instanceof ApiError ? queryError.message : null);

  return (
    <Card
      title="Active Sessions"
      subtitle="Manage devices and browsers currently signed in to your TradeWise account"
    >
      <div className={styles.topActions}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setDialogState({ type: "logout_others" })}
          disabled={isLoading || sessions.filter((s) => !s.isCurrent).length === 0}
        >
          Log Out Other Devices
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setDialogState({ type: "logout_all" })}
          disabled={isLoading}
        >
          Log Out Everywhere
        </Button>
      </div>

      {successMessage && (
        <div className={styles.successBanner} role="status">
          {successMessage}
        </div>
      )}

      {displayError && (
        <div className={styles.errorBanner} role="alert">
          {displayError}
        </div>
      )}

      {isLoading ? (
        <div className={styles.emptyState}>Loading active sessions...</div>
      ) : sessions.length === 0 ? (
        <div className={styles.emptyState}>No active sessions found.</div>
      ) : (
        <div className={styles.sessionList}>
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`${styles.sessionItem} ${session.isCurrent ? styles.current : ""}`}
            >
              <div className={styles.sessionInfo}>
                <div className={styles.sessionIcon}>{getDeviceIcon(session.client)}</div>
                <div className={styles.sessionDetails}>
                  <div className={styles.sessionClient}>
                    <span>{session.client || "Web Client"}</span>
                    {session.isCurrent && <Badge variant="success">Current Session</Badge>}
                  </div>
                  <div className={styles.sessionMeta}>
                    <span>
                      Signed in:{" "}
                      {new Date(session.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {" • "}
                    <span>
                      Last active:{" "}
                      {new Date(session.lastActivityAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {!session.isCurrent && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setDialogState({
                      type: "revoke_single",
                      sessionId: session.id,
                      sessionClient: session.client,
                    })
                  }
                >
                  Revoke
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={Boolean(dialogState.type)}
        onClose={() => setDialogState({ type: null })}
        title={
          dialogState.type === "revoke_single"
            ? "Revoke Session"
            : dialogState.type === "logout_others"
              ? "Log Out Other Sessions"
              : "Log Out Everywhere"
        }
        footer={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setDialogState({ type: null })}
              disabled={revokeMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={confirmAction}
              isLoading={revokeMutation.isPending}
            >
              {dialogState.type === "logout_all" ? "Log Out Everywhere" : "Revoke Session"}
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
          <ShieldAlert size={20} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            {dialogState.type === "revoke_single" ? (
              <p>
                Are you sure you want to revoke the session for{" "}
                <strong>{dialogState.sessionClient || "this device"}</strong>? That browser will immediately
                be logged out.
              </p>
            ) : dialogState.type === "logout_others" ? (
              <p>
                Are you sure you want to log out of all other active sessions? Only this current browser will
                remain signed in.
              </p>
            ) : (
              <p>
                Are you sure you want to log out everywhere? You will immediately be signed out of this browser
                and all other active devices.
              </p>
            )}
          </div>
        </div>
      </Modal>
    </Card>
  );
}
