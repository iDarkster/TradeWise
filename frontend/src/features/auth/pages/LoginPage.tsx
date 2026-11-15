import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Button } from "../../../components/ui/Button.js";
import { Input } from "../../../components/ui/Input.js";
import { Card } from "../../../components/ui/Card.js";
import { loginSchema, type LoginFormData } from "../schemas/authSchemas.js";
import { zodResolver } from "../../../lib/validation/resolver.js";
import { authApi } from "../api/authApi.js";
import { ApiError } from "../../../lib/api/errors.js";
import styles from "./LoginPage.module.css";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    try {
      const user = await authApi.login(data);
      const destination = from && from !== "/" ? from : user.role === "ADMIN" ? "/admin/users" : "/";
      navigate(destination, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "INVALID_CREDENTIALS") {
          setServerError("Invalid email/username or password. Please try again.");
        } else if (err.code === "RATE_LIMITED") {
          setServerError("Too many login attempts. Please wait a moment before trying again.");
        } else {
          setServerError(err.message || "Failed to log in. Please try again.");
        }
      } else {
        setServerError("A network error occurred. Please check your connection.");
      }
    }
  };

  return (
    <div className={styles.pageContainer}>
      <Card className={styles.loginCard}>
        <div className={styles.brandHeader}>
          <div className={styles.logo}>TW</div>
          <h1 className={styles.title}>Welcome back</h1>
          <p className={styles.subtitle}>Log in to your TradeWise paper-trading account</p>
        </div>

        {serverError && (
          <div className={styles.errorBanner} role="alert">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
          <Input
            label="Email or Username"
            placeholder="Enter your email or username"
            autoComplete="username"
            required
            error={errors.identifier?.message}
            {...register("identifier")}
          />

          <Input
            label="Password"
            placeholder="Enter your password"
            isPassword
            autoComplete="current-password"
            required
            error={errors.password?.message}
            {...register("password")}
          />

          <Button type="submit" variant="primary" size="lg" fullWidth isLoading={isSubmitting}>
            Log In
          </Button>
        </form>

        <div className={styles.footerText}>
          Don&apos;t have an account?{" "}
          <Link to="/register" className={styles.link}>
            Create one
          </Link>
        </div>
      </Card>
    </div>
  );
}
