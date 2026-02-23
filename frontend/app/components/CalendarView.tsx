"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import styles from "./CalendarView.module.css";
import Header from "./Header";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const DAYS_HEADER = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type DaySummary = {
  summary: { calories_intake: number; calories_burned: number; protein: number; carbs: number; fibre: number; sugar: number };
  foods: Array<{ name: string; quantity: number; unit: string; calories: number; protein: number; carbs: number; fat: number; fibre: number; sugar: number }>;
  activities: Array<{ type: string; quantity: number; unit: string; calories_burned: number }>;
};

function getDaysInMonth(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const daysInMonth = last.getDate();
  const grid: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);
  const remaining = 42 - grid.length;
  for (let i = 0; i < remaining; i++) grid.push(null);
  return grid;
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function CalendarView() {
  const { user, signOut, getAuthHeaders } = useAuth();
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string>(() => toYMD(new Date()));
  const [daySummary, setDaySummary] = useState<DaySummary | null>(null);
  const [loading, setLoading] = useState(true);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const fetchDaySummary = useCallback(
    async (dateStr: string) => {
      try {
        const res = await fetch(`${API_BASE}/today_summary?date=${dateStr}`, {
          headers: { ...getAuthHeaders() },
        });
        if (res.status === 401) {
          signOut();
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        setDaySummary(data);
      } catch {
        setDaySummary(null);
      } finally {
        setLoading(false);
      }
    },
    [getAuthHeaders, signOut]
  );

  useEffect(() => {
    setLoading(true);
    fetchDaySummary(selectedDate);
  }, [selectedDate, fetchDaySummary]);

  const handlePrevMonth = () => setViewDate(new Date(year, month - 1));
  const handleNextMonth = () => setViewDate(new Date(year, month + 1));

  const grid = getDaysInMonth(year, month);

  const handleDayClick = (day: number | null) => {
    if (day === null) return;
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setSelectedDate(dateStr);
  };

  const selectedLabel = (() => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
  })();

  return (
    <div className={styles.page}>
      <Header />

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
              <button type="button" className={styles.chevronBtn} onClick={handlePrevMonth} aria-label="Previous month">‹</button>
              <div className={styles.monthLabel}>{monthLabel}</div>
              <button type="button" className={styles.chevronBtn} onClick={handleNextMonth} aria-label="Next month">›</button>
            </div>
          </header>

          <div className={styles.calendarGrid}>
            {DAYS_HEADER.map((d) => (
              <div key={d} className={styles.dayLabel}>
                {d[0]}
              </div>
            ))}
            {grid.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className={styles.dayCellEmpty} />;
              }
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === toYMD(new Date());
              return (
                <button
                  key={dateStr}
                  type="button"
                  className={`${styles.dayCell} ${isSelected ? styles.dayCellSelected : ""} ${isToday ? styles.dayCellToday : ""}`}
                  onClick={() => handleDayClick(day)}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <p className={styles.selectedDateLabel}>Selected: {selectedLabel}</p>

          {loading ? (
            <p className={styles.entryMeta}>Loading…</p>
          ) : daySummary ? (
            <>
              <section className={styles.statsRow}>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Calories</div>
                  <div className={styles.statValue}>{daySummary.summary.calories_intake}</div>
                  <div className={styles.statSub}>
                    Food · {daySummary.summary.calories_intake} · Exercise · {daySummary.summary.calories_burned}
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Macros</div>
                  <div className={styles.statSub}>
                    Carbs {daySummary.summary.carbs}g · Protein {daySummary.summary.protein}g · Fat (from foods below)
                  </div>
                </div>
              </section>

              <section className={styles.entriesSection}>
                <h2 className={styles.sectionTitle}>Meals on this day</h2>
                {daySummary.foods.length === 0 ? (
                  <p className={styles.entryMeta}>No food logged for this date.</p>
                ) : (
                  daySummary.foods.map((entry, i) => (
                    <article key={`${entry.name}-${i}`} className={styles.entryCard}>
                      <div className={styles.entryTitle}>{entry.name}</div>
                      <div className={styles.entryMacros}>
                        <span>Calories {entry.calories}</span>
                        <span>Carbs {entry.carbs}g</span>
                        <span>Protein {entry.protein}g</span>
                        <span>Fat {entry.fat}g</span>
                      </div>
                    </article>
                  ))
                )}
              </section>
            </>
          ) : (
            <p className={styles.entryMeta}>Could not load data for this date.</p>
          )}
        </section>
      </main>
    </div>
  );
}

