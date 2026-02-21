"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import styles from "./WeightTracker.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type WeightEntry = { value_kg: number; recorded_at: string | null };

export default function WeightTracker() {
  const { user, signOut } = useAuth();
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWeights = useCallback(async () => {
    if (!user?.username) return;
    try {
      const res = await fetch(`${API_BASE}/weight_entries?username=${encodeURIComponent(user.username)}`);
      if (!res.ok) return;
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [user?.username]);

  useEffect(() => {
    fetchWeights();
  }, [fetchWeights]);

  const weightsOrdered = [...entries].reverse();
  const currentWeightKg = entries[0]?.value_kg ?? user?.weight_kg ?? 0;
  const targetWeightKg =
    user?.target_weight_kg != null && user.target_weight_kg > 0
      ? user.target_weight_kg
      : Math.max(0, currentWeightKg - 5);

  const allValues = weightsOrdered.length
    ? weightsOrdered.map((e) => e.value_kg)
    : (user?.weight_kg ? [user.weight_kg] : []);
  const max = Math.max(...allValues, targetWeightKg, 1);
  const min = Math.min(...allValues, targetWeightKg, 0);

  const points = weightsOrdered
    .map((p, index) => {
      const x = (weightsOrdered.length - 1 ? index / (weightsOrdered.length - 1) : 0) * 100;
      const y = ((max - p.value_kg) / (max - min || 1)) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  const targetY = ((max - targetWeightKg) / (max - min || 1)) * 100;

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return iso;
    }
  };

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
          <span className={styles.userName}>{user?.username}</span>
          <button type="button" onClick={signOut} className={styles.signOut}>
            Sign out
          </button>
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
            <div className={styles.summaryValue}>
              {loading ? "…" : `${currentWeightKg.toFixed(1)} kg`}
            </div>
          </div>
          <div className={styles.summaryCard}>
            <h2 className={styles.summaryLabel}>Target Weight</h2>
            <div className={styles.summaryValue}>{targetWeightKg.toFixed(1)} kg</div>
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
          {loading ? (
            <p className={styles.entryMeta}>Loading…</p>
          ) : entries.length === 0 ? (
            <p className={styles.entryMeta}>
              No weight entries yet. Your profile weight ({user?.weight_kg ?? "—"} kg) is used until you add entries via the API.
            </p>
          ) : (
            <ul className={styles.entriesList}>
              {entries.map((entry, i) => (
                <li key={entry.recorded_at ?? i} className={styles.entryRow}>
                  <div className={styles.entryWeight}>{entry.value_kg.toFixed(1)} kg</div>
                  <div className={styles.entryMeta}>{formatDate(entry.recorded_at)}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

