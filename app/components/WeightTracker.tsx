"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import styles from "./WeightTracker.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type WeightEntry = { value_kg: number; recorded_at: string | null };

export default function WeightTracker() {
  const { user, signOut, getAuthHeaders } = useAuth();
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [logWeightValue, setLogWeightValue] = useState("");
  const [logWeightDate, setLogWeightDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [logWeightSubmitting, setLogWeightSubmitting] = useState(false);
  const [logWeightError, setLogWeightError] = useState<string | null>(null);

  const fetchWeights = useCallback(async () => {
    if (!user?.username) return;
    try {
      const res = await fetch(`${API_BASE}/weight_entries`, {
        headers: { ...getAuthHeaders() },
      });
      if (res.status === 401) {
        signOut();
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [user?.username, getAuthHeaders, signOut]);

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

  const handleLogWeight = async () => {
    const v = parseFloat(logWeightValue);
    if (Number.isNaN(v) || v <= 0) {
      setLogWeightError("Enter a valid weight (kg).");
      return;
    }
    setLogWeightError(null);
    setLogWeightSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/weight_entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ value_kg: v, recorded_at: logWeightDate || undefined }),
      });
      const data = await res.json();
      if (res.status === 401) {
        signOut();
        return;
      }
      if (!res.ok) {
        setLogWeightError(data.detail || "Failed to log weight.");
        return;
      }
      setLogWeightValue("");
      setLogWeightDate(new Date().toISOString().slice(0, 10));
      fetchWeights();
    } catch {
      setLogWeightError("Network error.");
    } finally {
      setLogWeightSubmitting(false);
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

        <section className={styles.logWeightSection}>
          <h2 className={styles.sectionTitle}>Log weight</h2>
          <div className={styles.logWeightRow}>
            <label className={styles.logWeightLabel}>
              Weight (kg)
              <input
                type="number"
                step="0.1"
                min="1"
                placeholder="e.g. 70"
                className={styles.logWeightInput}
                value={logWeightValue}
                onChange={(e) => setLogWeightValue(e.target.value)}
              />
            </label>
            <label className={styles.logWeightLabel}>
              Date
              <input
                type="date"
                className={styles.logWeightInput}
                value={logWeightDate}
                onChange={(e) => setLogWeightDate(e.target.value)}
              />
            </label>
            <button
              type="button"
              className={styles.logWeightBtn}
              onClick={handleLogWeight}
              disabled={logWeightSubmitting}
            >
              {logWeightSubmitting ? "…" : "Log weight"}
            </button>
          </div>
          {logWeightError && <p className={styles.logWeightError}>{logWeightError}</p>}
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
                <li key={`${entry.recorded_at ?? "na"}-${i}`} className={styles.entryRow}>
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

