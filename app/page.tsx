// app/dashboard/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import BottomInput from "./components/BottomInput";
import styles from "./page.module.css";

export default function DashboardPage() {
  const [summaryData, setSummaryData] = useState({
    calories_intake: 0,
    calories_burned: 0,
    protein: 0,
    carbs: 0,
    fibre: 0,
    sugar: 0
  });

  const data = {
    caloriesIntake: summaryData?.calories_intake ?? 0,
    caloriesBurned: summaryData?.calories_burned ?? 0,
    protein: summaryData?.protein ?? 0,
    carbs: summaryData?.carbs ?? 0,
    fibre: summaryData?.fibre ?? 0,
    sugar: summaryData?.sugar ?? 0
  };

  const SUGAR_LIMIT = 25;
  const sugarExceeded = (summaryData?.sugar ?? 0) > SUGAR_LIMIT;

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>Daily Log</div>
        <nav className={styles.nav}>
          <Link href="/" className={styles.navLinkActive}>
            Dashboard
          </Link>
          <Link href="/weight-tracker" className={styles.navLink}>
            Weight
          </Link>
          <Link href="/calendar" className={styles.navLink}>
            Calendar
          </Link>
        </nav>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Simple &amp; Easy Calorie Tracking</h1>
          <p className={styles.heroSubtitle}>
            Track your meals, macros, and progress in one clean dashboard.
          </p>
        </section>

        <section className={styles.topBar}>
          <div className={styles.datePill}>{todayLabel}</div>
          <div className={styles.viewTabs}>
            <button className={styles.viewTabActive}>Today</button>
            <button className={styles.viewTab}>Week</button>
            <button className={styles.viewTab}>Month</button>
          </div>
        </section>

        <section className={styles.cardsGrid}>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Calories</div>
            <div className={styles.cardNumber}>{data.caloriesIntake}</div>
            <div className={styles.cardMeta}>
              <span>Food</span>
              <span>{data.caloriesIntake} kcal</span>
            </div>
            <div className={styles.cardMeta}>
              <span>Exercise</span>
              <span>{data.caloriesBurned} kcal</span>
            </div>
            <div className={styles.cardFooter}>
              Net {data.caloriesIntake - data.caloriesBurned} kcal
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardLabel}>Macros</div>
            <div className={styles.macrosRow}>
              <div className={styles.macroChip}>
                <span>Carbs</span>
                <strong>{data.carbs} g</strong>
              </div>
              <div className={styles.macroChip}>
                <span>Protein</span>
                <strong>{data.protein} g</strong>
              </div>
              <div className={styles.macroChip}>
                <span>Fibre</span>
                <strong>{data.fibre} g</strong>
              </div>
            </div>
            <div
              className={
                sugarExceeded ? styles.sugarExceeded : styles.sugarOk
              }
            >
              <span>Sugar</span>
              <strong>
                {data.sugar} g
                {sugarExceeded && ` (over ${SUGAR_LIMIT} g)`}
              </strong>
            </div>
          </div>
        </section>

        <section className={styles.entriesSection}>
          <h2 className={styles.sectionTitle}>Today&apos;s log</h2>
          <p className={styles.sectionHint}>
            Use the input at the bottom to quickly log meals or exercise. They
            will appear here when you wire the backend.
          </p>
          <div className={styles.placeholderCard}>
            No detailed entries yet. Start logging to see a timeline like in the
            screenshots.
          </div>
        </section>
      </main>

      <BottomInput onCaloriesCalculated={setSummaryData} />
    </div>
  );
}