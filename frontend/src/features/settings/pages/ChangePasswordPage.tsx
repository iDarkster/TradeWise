import { useState } from "react";
import { useForm } from "react-hook-form";
import { ShieldAlert } from "lucide-react";
import { Card } from "../../../components/ui/Card.js";
import { Input } from "../../../components/ui/Input.js";
import { Button } from "../../../components/ui/Button.js";
import { changePasswordSchema, type ChangePasswordFormData } from "../../auth/schemas/authSchemas.js";
import { zodResolver } from "../../../lib/validation/resolver.js";
import { settingsApi } from "../api/settingsApi.js";
import { ApiError } from "../../../lib/api/errors.js";
import styles from "./ChangePasswordPage.module.css";

export function ChangePasswordPage() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  const onSubmit = async (data: ChangePasswordFormData) => {
    setSuccessMessage(null);
    setServerError(null);

    try {
      await settingsApi.changePassword(data);
      setSuccessMessage("Password changed successfully. All other active sessions have been logged out.");
      reset();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "INVALID_CREDENTIALS") {
          setServerError("Your current password is incorrect. Please try again.");
        } else if (err.code === "VALIDATION_ERROR") {
          setServerError(err.message || "New password does not satisfy requirements (8-128 chars, digit, special character, no spaces).");
        } else {
          setServerError(err.message || "Failed to update password.");
        }
      } else {
        setServerError("A network error occurred while updating your password.");
      }
    }
  };

  return (
    <Card
      title="Change Password"
      subtitle="Ensure your account stays secure by using a strong password"
    >
      <div className={styles.notice}>
        <ShieldAlert size={18} className={styles.noticeIcon} />
        <div>
          <strong>Security Notice:</strong> Changing your password will automatically revoke all
          other active sessions on your account. Your current session will remain active.
        </div>
      </div>

      {successMessage && (
        <div className={styles.successBanner} role="status">
          {successMessage}
        </div>
      )}

      {serverError && (
        <div className={styles.errorBanner} role="alert">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
        <Input
          label="Current Password"
          placeholder="Enter current password"
          isPassword
          autoComplete="current-password"
          required
          error={errors.currentPassword?.message}
          {...register("currentPassword")}
        />

        <Input
          label="New Password"
          placeholder="At least 8 characters with digit and symbol"
          helperText="8-128 characters, at least one digit and special character, no spaces"
          isPassword
          autoComplete="new-password"
          required
          error={errors.newPassword?.message}
          {...register("newPassword")}
        />

        <Input
          label="Confirm New Password"
          placeholder="Re-enter your new password"
          isPassword
          autoComplete="new-password"
          required
          error={errors.confirmNewPassword?.message}
          {...register("confirmNewPassword")}
        />

        <div>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Update Password
          </Button>
        </div>
      </form>
    </Card>
  );
}
