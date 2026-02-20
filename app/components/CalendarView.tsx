"use client";

import Link from "next/link";
import styles from "./CalendarView.module.css";

const daysRow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const sampleMonth = [
  { day: 1, status: "high" },
  { day: 2, status: "ok" },
  { day: 3, status: "ok" },
  { day: 4, status: "low" },
  { day: 5, status: "high" },
  { day: 6, status: "ok" },
  { day: 7, status: "ok" },
  { day: 8, status: "low" },
  { day: 9, status: "ok" },
  { day: 10, status: "high" },
  { day: 11, status: "ok" },
  { day: 12, status: "low" },
  { day: 13, status: "ok" },
  { day: 14, status: "ok" },
  { day: 15, status: "high" },
  { day: 16, status: "ok" },
  { day: 17, status: "ok" },
  { day: 18, status: "low" },
  { day: 19, status: "ok" },
  { day: 20, status: "ok" },
  { day: 21, status: "high" }
];

const entries = [
  {
    title: "Grilled salmon, steamed broccoli, brown rice",
    calories: 445,
    carbs: 56,
    protein: 31,
    fat: 13
  },
  {
    title: "Omelette with veggies",
    calories: 280,
    carbs: 8,
    protein: 22,
    fat: 18
  }
];

export default function CalendarView() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>Daily Log</div>
        <nav className={styles.nav}>
          <Link href="/" className={styles.navLink}>
            Dashboard
          </Link>
          <Link href="/weight-tracker" className={styles.navLink}>
            Weight
          </Link>
          <Link href="/calendar" className={styles.navLinkActive}>
            Calendar
          </Link>
        </nav>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Stay Consistent and Get Results</h1>
          <p className={styles.heroSubtitle}>
            See your streaks and macros over the month in a clean calendar view.
          </p>
        </section>

        <section className={styles.calendarShell}>
          <header className={styles.calendarTop}>
            <div className={styles.dateSwitcher}>
              <button className={styles.chevronBtn}>‹</button>
              <div className={styles.monthLabel}>October</div>
              <button className={styles.chevronBtn}>›</button>
            </div>

            <div className={styles.monthTabs}>
              {["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"].map(
                (m) => (
                  <button
                    key={m}
                    className={
                      m === "Oct" ? styles.monthTabActive : styles.monthTab
                    }
                  >
                    {m}
                  </button>
                )
              )}
            </div>
          </header>

          <div className={styles.calendarGrid}>
            {daysRow.map((d) => (
              <div key={d} className={styles.dayLabel}>
                {d[0]}
              </div>
            ))}
            {sampleMonth.map((day) => (
              <button
                key={day.day}
                className={`${styles.dayCell} ${
                  styles[`status_${day.status}`]
                }`}
              >
                {day.day}
              </button>
            ))}
          </div>

          <section className={styles.statsRow}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Calories</div>
              <div className={styles.statValue}>445</div>
              <div className={styles.statSub}>Food · 445 · Exercise · 0</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Macros</div>
              <div className={styles.statSub}>Carbs 56g · Protein 31g · Fat 13g</div>
            </div>
          </section>

          <section className={styles.entriesSection}>
            <h2 className={styles.sectionTitle}>Today&apos;s meals</h2>
            {entries.map((entry) => (
              <article key={entry.title} className={styles.entryCard}>
                <div className={styles.entryTitle}>{entry.title}</div>
                <div className={styles.entryMacros}>
                  <span>Calories {entry.calories}</span>
                  <span>Carbs {entry.carbs}g</span>
                  <span>Protein {entry.protein}g</span>
                  <span>Fat {entry.fat}g</span>
                </div>
              </article>
            ))}
          </section>
        </section>
      </main>
    </div>
  );
}

