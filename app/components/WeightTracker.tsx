"use client";

import Link from "next/link";
import styles from "./WeightTracker.module.css";

const sampleWeights = [
  { date: "Oct 1", value: 180 },
  { date: "Oct 5", value: 179 },
  { date: "Oct 9", value: 178 },
  { date: "Oct 12", value: 177.5 },
  { date: "Oct 15", value: 176.8 },
  { date: "Oct 18", value: 176.2 },
  { date: "Oct 20", value: 175.9 }
];

const currentWeight = sampleWeights[sampleWeights.length - 1]?.value ?? 0;
const targetWeight = 174;

export default function WeightTracker() {
  const max = Math.max(...sampleWeights.map((p) => p.value), targetWeight);
  const min = Math.min(...sampleWeights.map((p) => p.value), targetWeight);

  const points = sampleWeights
    .map((p, index) => {
      const x = (index / (sampleWeights.length - 1 || 1)) * 100;
      const y = ((max - p.value) / (max - min || 1)) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  const targetY = ((max - targetWeight) / (max - min || 1)) * 100;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>Daily Log</div>
        <nav className={styles.nav}>
          <Link href="/" className={styles.navLink}>
            Dashboard
          </Link>
          <Link href="/weight-tracker" className={styles.navLinkActive}>
            Weight
          </Link>
          <Link href="/calendar" className={styles.navLink}>
            Calendar
          </Link>
        </nav>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Crush Your Weight Goals</h1>
          <p className={styles.heroSubtitle}>
            Visualize your progress and stay on track with a clean, simple
            weight tracker.
          </p>
        </section>

        <section className={styles.summaryRow}>
          <div className={styles.summaryCard}>
            <h2 className={styles.summaryLabel}>Current Weight</h2>
            <div className={styles.summaryValue}>{currentWeight.toFixed(1)} lb</div>
          </div>
          <div className={styles.summaryCard}>
            <h2 className={styles.summaryLabel}>Target Weight</h2>
            <div className={styles.summaryValue}>{targetWeight} lb</div>
          </div>
        </section>

        <section className={styles.chartSection}>
          <header className={styles.chartHeader}>
            <h2 className={styles.sectionTitle}>Weight Tracker</h2>
            <div className={styles.chipRow}>
              <button className={styles.chip}>Week</button>
              <button className={styles.chipActive}>Month</button>
              <button className={styles.chip}>Year</button>
              <button className={styles.chip}>All time</button>
            </div>
          </header>

          <div className={styles.chartWrapper}>
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className={styles.chartSvg}
            >
              <line
                x1="0"
                x2="100"
                y1={targetY}
                y2={targetY}
                className={styles.targetLine}
              />
              <polyline
                fill="none"
                points={points}
                className={styles.weightLine}
              />
            </svg>
          </div>
        </section>

        <section className={styles.entriesSection}>
          <h2 className={styles.sectionTitle}>Weight entries</h2>
          <ul className={styles.entriesList}>
            {sampleWeights
              .slice()
              .reverse()
              .map((entry) => (
                <li key={entry.date} className={styles.entryRow}>
                  <div className={styles.entryWeight}>{entry.value} lb</div>
                  <div className={styles.entryMeta}>{entry.date}</div>
                </li>
              ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

