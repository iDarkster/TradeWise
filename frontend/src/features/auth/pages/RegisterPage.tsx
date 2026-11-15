import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { Check, X } from "lucide-react";
import { Button } from "../../../components/ui/Button.js";
import { Input } from "../../../components/ui/Input.js";
import { Card } from "../../../components/ui/Card.js";
import { registerSchema, type RegisterFormData } from "../schemas/authSchemas.js";
import { zodResolver } from "../../../lib/validation/resolver.js";
import { authApi } from "../api/authApi.js";
import { ApiError } from "../../../lib/api/errors.js";
import styles from "./RegisterPage.module.css";

export function RegisterPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      username: "",
      password: "",
      confirmPassword: "",
    },
    mode: "onChange",
  });

  const passwordValue = useWatch({ control, name: "password" }) || "";

  // Password requirement checks (matching backend policy)
  const hasMinLength = passwordValue.length >= 8 && passwordValue.length <= 128;
  const hasDigit = /\d/.test(passwordValue);
  const hasSpecial = /[^A-Za-z0-9]/.test(passwordValue);
  const hasNoSpaces = !/\s/.test(passwordValue) && passwordValue.length > 0;

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null);
    try {
      await authApi.register({
        fullName: data.fullName,
        email: data.email,
        username: data.username,
        password: data.password,
      });
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "CONFLICT") {
          setServerError("An account with this email or username already exists.");
        } else if (err.code === "VALIDATION_ERROR" && err.details) {
          const fieldErrors = (err.details as { fields?: Record<string, string> }).fields;
          if (fieldErrors) {
            Object.entries(fieldErrors).forEach(([field, msg]) => {
              setError(field as keyof RegisterFormData, { message: msg });
            });
          }
          setServerError(err.message || "Please fix the validation errors.");
        } else if (err.code === "RATE_LIMITED") {
          const retryAfter = (err.details as { retryAfterSeconds?: number })?.retryAfterSeconds;
          if (typeof retryAfter === "number" && retryAfter > 0) {
            const minutes = Math.floor(retryAfter / 60);
            const seconds = retryAfter % 60;
            const timeDesc =
              minutes > 0
                ? seconds > 0
                  ? `${minutes}m ${seconds}s`
                  : `${minutes} minute${minutes > 1 ? "s" : ""}`
                : `${seconds} second${seconds > 1 ? "s" : ""}`;
            setServerError(`Too many registration attempts. Please wait ${timeDesc} before trying again.`);
          } else {
            setServerError("Too many registration attempts. Please wait a moment before trying again.");
          }
        } else {
          setServerError(err.message || "Registration failed. Please try again.");
        }
      } else {
        setServerError("A network error occurred. Please check your connection.");
      }
    }
  };

  return (
    <div className={styles.pageContainer}>
      <Card className={styles.registerCard}>
        <div className={styles.brandHeader}>
          <div className={styles.logo}>TW</div>
          <h1 className={styles.title}>Create your account</h1>
          <p className={styles.subtitle}>Start your paper trading journey with ₹1,00,000 virtual cash</p>
        </div>

        {serverError && (
          <div className={styles.errorBanner} role="alert">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
          <Input
            label="Full Name"
            placeholder="e.g. Jane Doe"
            autoComplete="name"
            required
            error={errors.fullName?.message}
            {...register("fullName")}
          />

          <Input
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
            error={errors.email?.message}
            {...register("email")}
          />

          <Input
            label="Username"
            placeholder="3-20 characters (letters, numbers, _)"
            autoComplete="username"
            required
            error={errors.username?.message}
            {...register("username")}
          />

          <Input
            label="Password"
            placeholder="At least 8 characters"
            isPassword
            autoComplete="new-password"
            required
            error={errors.password?.message}
            {...register("password")}
          />

          {passwordValue.length > 0 && (
            <div className={styles.passwordRequirements}>
              <div className={styles.reqTitle}>Password requirements:</div>
              <ul className={styles.reqList}>
                <li className={`${styles.reqItem} ${hasMinLength ? styles.valid : styles.invalid}`}>
                  {hasMinLength ? <Check size={14} /> : <X size={14} />}
                  <span>8 to 128 characters</span>
                </li>
                <li className={`${styles.reqItem} ${hasDigit ? styles.valid : styles.invalid}`}>
                  {hasDigit ? <Check size={14} /> : <X size={14} />}
                  <span>At least one number (0-9)</span>
                </li>
                <li className={`${styles.reqItem} ${hasSpecial ? styles.valid : styles.invalid}`}>
                  {hasSpecial ? <Check size={14} /> : <X size={14} />}
                  <span>At least one special character (!@#$%...)</span>
                </li>
                <li className={`${styles.reqItem} ${hasNoSpaces ? styles.valid : styles.invalid}`}>
                  {hasNoSpaces ? <Check size={14} /> : <X size={14} />}
                  <span>No spaces or whitespace allowed</span>
                </li>
              </ul>
            </div>
          )}

          <Input
            label="Confirm Password"
            placeholder="Re-enter your password"
            isPassword
            autoComplete="new-password"
            required
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />

          <Button type="submit" variant="primary" size="lg" fullWidth isLoading={isSubmitting}>
            Create Account
          </Button>
        </form>

        <div className={styles.footerText}>
          Already have an account?{" "}
          <Link to="/login" className={styles.link}>
            Log In
          </Link>
        </div>
      </Card>
    </div>
  );
}
