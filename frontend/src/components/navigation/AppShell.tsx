import { Outlet } from "react-router-dom";
import { GlobalHeader } from "./GlobalHeader.js";
import { useAuthInit } from "../../features/auth/hooks/useAuthInit.js";
import styles from "./AppShell.module.css";

export function AppShell() {
  // Bootstrap auth session on startup
  useAuthInit();

  return (
    <div id="app-root" className={styles.layout}>
      <GlobalHeader />
      <main className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <p>
            TradeWise &copy; {new Date().getFullYear()} &bull; Simulated Paper-Trading &amp; Education Platform
          </p>
          <p className={styles.disclaimer}>
            Virtual money only. Not real-money brokerage execution.
          </p>
        </div>
      </footer>
    </div>
  );
}
