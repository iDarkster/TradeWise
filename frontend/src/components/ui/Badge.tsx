import React from "react";
import styles from "./Badge.module.css";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "success" | "danger" | "warning" | "info" | "neutral";
  children: React.ReactNode;
}

export function Badge({
  variant = "neutral",
  children,
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={[styles.badge, styles[variant], className || ""].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </span>
  );
}
