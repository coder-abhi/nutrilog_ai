"use client";

import styles from "../page.module.css";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { usePathname } from "next/navigation";

export default function Header() {
    const { user, signOut } = useAuth();
    const pathname = usePathname();

  return (
          <header className={styles.header}>
        <Link href="/" className={styles.brand}>Daily Log</Link>
        <nav className={styles.nav}>
          <Link href="/" className={pathname === "/" ? styles.navLinkActive : styles.navLink}>
            Dashboard
          </Link>
          <Link href="/weight-tracker" className={pathname === "/weight-tracker" ? styles.navLinkActive : styles.navLink}>
            Weight
          </Link>
          <Link href="/calendar" className={pathname === "/calendar" ? styles.navLinkActive : styles.navLink}>
            Calendar
          </Link>
          <div className={styles.userSection}>
            <span className={styles.userName}>{user?.username}</span>
            <button
              type="button"
              onClick={signOut}
              className={styles.signOut}
            >
              Sign out
            </button>
          </div>
        </nav>
      </header>
  );
}
