import React from "react";
import styles from "./Card.module.css";

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function Card({
  title,
  subtitle,
  footer,
  children,
  className,
  ...props
}: CardProps) {
  return (
    <div className={[styles.card, className || ""].filter(Boolean).join(" ")} {...props}>
      {(title || subtitle) && (
        <div className={styles.header}>
          {title && typeof title === "string" ? <h3 className={styles.title}>{title}</h3> : title}
          {subtitle && typeof subtitle === "string" ? <p className={styles.subtitle}>{subtitle}</p> : subtitle}
        </div>
      )}
      <div className={styles.content}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
