"use client";

import styles from "../page.module.css";
import Link from "next/link";
import { useState } from "react";
import { CalendarDays, LayoutDashboard, ListChecks, LogOut, Menu, Pencil, Scale, User, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usePathname } from "next/navigation";

const goalLabels: Record<string, string> = {
  muscle_gain: "Muscle Gain",
  weight_loss: "Weight Loss",
  skin_health: "Skin Health",
  hair_growth: "Hair Growth",
  energy_boost: "Energy Boost",
  pcos: "PCOS / PCOD",
};

export default function Header() {
    const { user, signOut } = useAuth();
    const pathname = usePathname();
    const [menuOpen, setMenuOpen] = useState(false);
    const userGoal = (user?.goals ?? []).map((goal) => goalLabels[goal] ?? goal).join(", ");
    const closeMenu = () => setMenuOpen(false);
    const handleSignOut = () => {
      closeMenu();
      signOut();
    };

    const navLinks = [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, active: pathname === "/" },
      { href: "/weight-tracker", label: "Weight", icon: Scale, active: pathname === "/weight-tracker" },
      { href: "/calendar", label: "Calendar", icon: CalendarDays, active: pathname === "/calendar" },
      { href: "/tracker", label: "Tracker", icon: ListChecks, active: pathname.startsWith("/tracker") },
    ];

  return (
          <header className={styles.header}>
        <Link href="/" className={styles.brand}>Daily Log</Link>
        <nav className={styles.nav}>
          {navLinks.map((item) => (
            <Link key={item.href} href={item.href} className={item.active ? styles.navLinkActive : styles.navLink}>
              {item.label}
            </Link>
          ))}
          <div className={styles.userSection}>
            <span className={styles.userName}>{user?.username}</span>
            <Link href="/profile/edit" className={pathname === "/profile/edit" ? styles.navLinkActive : styles.navLink}>
              Edit profile
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className={styles.signOut}
            >
              Sign out
            </button>
          </div>
        </nav>
        <button
          type="button"
          className={styles.mobileMenuButton}
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        {menuOpen && (
          <div className={styles.mobileDrawerLayer}>
            <button
              type="button"
              className={styles.mobileDrawerBackdrop}
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
            />
            <aside className={styles.mobileDrawer} aria-label="Mobile navigation">
              <div className={styles.mobileDrawerTop}>
                <div className={styles.mobileUserCard}>
                  <span className={styles.mobileUserIcon}><User size={18} /></span>
                  <div>
                    <strong>{user?.username}</strong>
                    {userGoal && <span>{userGoal}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.mobileCloseButton}
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                >
                  <X size={20} />
                </button>
              </div>
              <div className={styles.mobileDrawerLinks}>
                {navLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} onClick={closeMenu} className={item.active ? styles.mobileDrawerLinkActive : styles.mobileDrawerLink}>
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
                <Link href="/profile/edit" onClick={closeMenu} className={pathname === "/profile/edit" ? styles.mobileDrawerLinkActive : styles.mobileDrawerLink}>
                  <Pencil size={18} />
                  <span>Edit profile</span>
                </Link>
                <button type="button" className={styles.mobileSignOutButton} onClick={handleSignOut}>
                  <LogOut size={18} />
                  <span>Sign out</span>
                </button>
              </div>
            </aside>
          </div>
        )}
      </header>
  );
}
