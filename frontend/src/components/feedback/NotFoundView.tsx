import { Link } from "react-router-dom";
import styles from "./NotFoundView.module.css";

export function NotFoundView() {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <span className={styles.badge}>404</span>
        <h1 className={styles.title}>Page Not Found</h1>
        <p className={styles.description}>
          The page you are looking for does not exist or has been moved.
        </p>
        <Link to="/" className={styles.link}>
          Back to TradeWise
        </Link>
      </div>
    </div>
  );
}
