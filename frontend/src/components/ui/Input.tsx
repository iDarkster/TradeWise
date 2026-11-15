import React, { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import styles from "./Input.module.css";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  isPassword?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      isPassword = false,
      type = "text",
      id,
      className,
      required,
      ...props
    },
    ref,
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    const actualType = isPassword ? (showPassword ? "text" : "password") : type;

    return (
      <div className={styles.fieldContainer}>
        {label && (
          <label htmlFor={inputId} className={styles.label}>
            {label}
            {required && <span className={styles.required}>*</span>}
          </label>
        )}

        <div className={styles.inputWrapper}>
          <input
            ref={ref}
            id={inputId}
            type={actualType}
            className={[
              styles.input,
              error ? styles.hasError : "",
              isPassword ? styles.hasToggle : "",
              className || "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error
                ? `${inputId}-error`
                : helperText
                  ? `${inputId}-helper`
                  : undefined
            }
            required={required}
            {...props}
          />

          {isPassword && (
            <button
              type="button"
              className={styles.toggleButton}
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>

        {error ? (
          <span id={`${inputId}-error`} className={styles.errorText} role="alert">
            {error}
          </span>
        ) : helperText ? (
          <span id={`${inputId}-helper`} className={styles.helperText}>
            {helperText}
          </span>
        ) : null}
      </div>
    );
  },
);

Input.displayName = "Input";
