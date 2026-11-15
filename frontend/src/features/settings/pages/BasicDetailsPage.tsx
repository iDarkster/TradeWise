import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useAuthStore } from "../../../stores/authStore.js";
import { settingsApi } from "../api/settingsApi.js";
import { Card } from "../../../components/ui/Card.js";
import { Input } from "../../../components/ui/Input.js";
import { Button } from "../../../components/ui/Button.js";
import { Badge } from "../../../components/ui/Badge.js";
import { profileUpdateSchema, type ProfileUpdateFormData } from "../../auth/schemas/authSchemas.js";
import { zodResolver } from "../../../lib/validation/resolver.js";
import { ApiError } from "../../../lib/api/errors.js";
import styles from "./BasicDetailsPage.module.css";

export function BasicDetailsPage() {
  const { user } = useAuthStore();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileUpdateFormData>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      username: user?.username || "",
      avatarUrl: user?.avatarUrl || "",
    },
  });

  useEffect(() => {
    if (user) {
      reset({
        fullName: user.fullName,
        username: user.username,
        avatarUrl: user.avatarUrl || "",
      });
    }
  }, [user, reset]);

  const onSubmit = async (data: ProfileUpdateFormData) => {
    setSuccessMessage(null);
    setServerError(null);

    try {
      await settingsApi.updateProfile(data);
      setSuccessMessage("Profile updated successfully.");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "CONFLICT") {
          setServerError("That username is already taken. Please choose another.");
        } else {
          setServerError(err.message || "Failed to update profile.");
        }
      } else {
        setServerError("A network error occurred while updating your profile.");
      }
    }
  };

  if (!user) return null;

  return (
    <Card
      title="Profile & Account Details"
      subtitle="View your account information and update your public profile"
    >
      <div className={styles.readOnlySection}>
        <div className={styles.readOnlyRow}>
          <span className={styles.readOnlyLabel}>Email Address</span>
          <span className={styles.readOnlyValue}>
            {user.email}
            <span className={styles.badgeImmutable}>Read-only</span>
          </span>
        </div>

        <div className={styles.readOnlyRow}>
          <span className={styles.readOnlyLabel}>Account Role</span>
          <span className={styles.readOnlyValue}>
            <Badge variant={user.role === "ADMIN" ? "info" : "neutral"}>
              {user.role}
            </Badge>
          </span>
        </div>

        <div className={styles.readOnlyRow}>
          <span className={styles.readOnlyLabel}>Account Status</span>
          <span className={styles.readOnlyValue}>
            <Badge variant={user.status === "ACTIVE" ? "success" : "danger"}>
              {user.status}
            </Badge>
          </span>
        </div>

        <div className={styles.readOnlyRow}>
          <span className={styles.readOnlyLabel}>Member Since</span>
          <span className={styles.readOnlyValue}>
            {new Date(user.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
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
          label="Full Name"
          placeholder="Enter your full name"
          required
          error={errors.fullName?.message}
          {...register("fullName")}
        />

        <Input
          label="Username"
          placeholder="Enter your username"
          helperText="3-20 characters using letters, numbers, and underscores"
          required
          error={errors.username?.message}
          {...register("username")}
        />

        <Input
          label="Avatar URL (Optional)"
          type="url"
          placeholder="https://example.com/avatar.png"
          helperText="Link to an image hosted on HTTPS"
          error={errors.avatarUrl?.message}
          {...register("avatarUrl")}
        />

        <div>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            disabled={!isDirty || isSubmitting}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </Card>
  );
}
