"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import AuthGate from "./components/AuthGate";
import BottomInput from "./components/BottomInput";
import styles from "./page.module.css";
import { useAuth } from "./context/AuthContext";
import Header from "./components/Header";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type FoodEntry = {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  sugar: number;
  timestamp?: string | null;
};

type ActivityEntry = {
  type: string;
  quantity: number;
  unit: string;
  calories_burned: number;
  timestamp?: string | null;
};

type LogEntry = (FoodEntry & { kind: "food" }) | (ActivityEntry & { kind: "activity" });

type InsulinCurve = {
  timestamp: string | null;
  points: { minute: number; value: number }[];
};

type SummaryData = {
  calories_intake: number;
  calories_burned: number;
  protein: number;
  carbs: number;
  fibre: number;
  sugar: number;
};

type DashboardRange = "today" | "week" | "month";

const EMPTY_SUMMARY: SummaryData = {
  calories_intake: 0,
  calories_burned: 0,
  protein: 0,
  carbs: 0,
  fibre: 0,
  sugar: 0,
};

function toYMD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function formatHour(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}${suffix}`;
}

function buildSmoothPath(points: { x: number; y: number }[]) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const prev = points[index - 1];
    const midX = (prev.x + point.x) / 2;
    const midY = (prev.y + point.y) / 2;
    return `${path} Q ${prev.x} ${prev.y} ${midX} ${midY}`;
  }, "") + ` T ${points[points.length - 1].x} ${points[points.length - 1].y}`;
}

function scaleInsulinPoint(point: { minute: number; value: number }, maxValue: number) {
  return {
    x: (point.minute / 1439) * 100,
    y: 100 - (point.value / maxValue) * 100,
  };
}

function DashboardContent() {
  const { user, signOut, getAuthHeaders } = useAuth();
  const [summaryData, setSummaryData] = useState<SummaryData>(EMPTY_SUMMARY);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [insulinCurves, setInsulinCurves] = useState<InsulinCurve[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => toYMD(new Date()));
  const [dashboardRange, setDashboardRange] = useState<DashboardRange>("today");
  const [passiveCalorie, setPassiveCalorie] = useState(0)
  const selectedRangeDays = dashboardRange === "today" ? 1 : dashboardRange === "week" ? 7 : 30;

  const fetchSummaryForDate = useCallback(async (date: string) => {
    if (!user?.username) return;
    const res = await fetch(`${API_BASE}/today_summary?date=${date}`, {
      headers: { ...getAuthHeaders() },
    });
    if (res.status === 401) {
      signOut();
      return null;
    }
    if (!res.ok) return null;
    return res.json();
  }, [user?.username, getAuthHeaders, signOut]);

  const fetchDashboardSummary = useCallback(async () => {
    if (!user?.username) return;
    setLoading(true);
    try {
      const end = new Date(`${selectedDate}T00:00:00`);
      const dates = Array.from({ length: selectedRangeDays }, (_, index) => {
        const date = new Date(end);
        date.setDate(end.getDate() - (selectedRangeDays - 1 - index));
        return toYMD(date);
      });

      const summaries = await Promise.all(dates.map((date) => fetchSummaryForDate(date)));
      const aggregate = summaries.reduce<SummaryData>((acc, item) => {
        const summary = item?.summary ?? {};
        return {
          calories_intake: acc.calories_intake + (summary.calories_intake ?? 0),
          calories_burned: acc.calories_burned + (summary.calories_burned ?? 0),
          protein: acc.protein + (summary.protein ?? 0),
          carbs: acc.carbs + (summary.carbs ?? 0),
          fibre: acc.fibre + (summary.fibre ?? 0),
          sugar: acc.sugar + (summary.sugar ?? 0),
        };
      }, { ...EMPTY_SUMMARY });
      setSummaryData(aggregate);
      const logEntries = summaries
        .flatMap((item) => [
          ...((item?.foods ?? []).map((entry: FoodEntry) => ({ ...entry, kind: "food" as const }))),
          ...((item?.activities ?? []).map((entry: ActivityEntry) => ({ ...entry, kind: "activity" as const }))),
        ])
        .sort((a, b) => {
          const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return bTime - aTime;
        });
      setEntries(logEntries);
      setInsulinCurves(summaries.flatMap((item) => item?.insulin_curves ?? []));
    } catch {
      setSummaryData(EMPTY_SUMMARY);
      setEntries([]);
      setInsulinCurves([]);
    } finally {
      setLoading(false);
    }
  }, [fetchSummaryForDate, selectedDate, selectedRangeDays, user?.username]);

  const fetchPassiveCalorie = useCallback(async () => {
    if (!user?.username) return;
    try {
      const res = await fetch(`${API_BASE}/passive_calorie_burned`, {
        headers: { ...getAuthHeaders() },
      });
      if (res.status === 401) {
        signOut();
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setPassiveCalorie(data ?? 0);
    } catch {
      // ignore
    }
  }, [user?.username, getAuthHeaders, signOut]);


  useEffect(() => {
    fetchDashboardSummary();
    fetchPassiveCalorie();
  }, [fetchDashboardSummary,fetchPassiveCalorie]);

  const data = {
    caloriesIntake: summaryData?.calories_intake ?? 0,
    caloriesBurned: summaryData?.calories_burned ?? 0,
    protein: summaryData?.protein ?? 0,
    carbs: summaryData?.carbs ?? 0,
    fibre: summaryData?.fibre ?? 0,
    sugar: summaryData?.sugar ?? 0
  };

  const DAILY_SUGAR_LIMIT = 25;
  const sugarLimit = DAILY_SUGAR_LIMIT * selectedRangeDays;
  const sugarExceeded = (summaryData?.sugar ?? 0) > sugarLimit;
  const passiveCaloriesForRange = Math.round(passiveCalorie * selectedRangeDays);
  const netCalories = data.caloriesIntake - data.caloriesBurned - passiveCaloriesForRange;

  const rangeLabel =
    dashboardRange === "today"
      ? "Selected day"
      : dashboardRange === "week"
        ? "Last 7 days"
        : "Last 30 days";

  const insulinChart = useMemo(() => {
    const contributions = new Map<number, number>();
    const keyMinutes = new Set<number>([0, 360, 720, 1080, 1439]);
    insulinCurves.forEach((curve) => {
      if (!curve.timestamp) return;
      const logDate = new Date(curve.timestamp);
      const baseMinute = logDate.getHours() * 60 + logDate.getMinutes();
      const curveEndMinute = Math.max(...curve.points.map((point) => point.minute), 0);

      if (baseMinute > 0 && baseMinute <= 1439) keyMinutes.add(baseMinute - 1);
      if (baseMinute + curveEndMinute < 1439) keyMinutes.add(baseMinute + curveEndMinute + 1);

      curve.points.forEach((point) => {
        const absoluteMinute = baseMinute + point.minute;
        if (absoluteMinute < 0 || absoluteMinute > 1439) return;
        keyMinutes.add(absoluteMinute);
        const contribution = Math.max(0, point.value - 8);
        contributions.set(
          absoluteMinute,
          (contributions.get(absoluteMinute) ?? 0) + contribution
        );
      });
    });

    const series = Array.from(keyMinutes)
      .sort((a, b) => a - b)
      .map((minute) => ({
        minute,
        value: Math.min(100, 8 + (contributions.get(minute) ?? 0)),
      }));
    const maxValue = Math.max(20, ...series.map((point) => point.value));
    const svgPoints = series.map((point) => scaleInsulinPoint(point, maxValue));
    const path = buildSmoothPath(svgPoints);

    return {
      path,
      areaPath: path ? `${path} L 100 100 L 0 100 Z` : "",
      maxValue,
      peak: Math.max(...series.map((point) => point.value)),
      hasData: insulinCurves.some((curve) => curve.points.length > 0),
    };
  }, [insulinCurves]);

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Simple &amp; Easy Calorie Tracking</h1>
          <p className={styles.heroSubtitle}>
            Track your meals, macros, and progress in one clean dashboard.
          </p>
        </section>

        <section className={styles.topBar}>
          <label className={styles.datePill}>
            {formatDisplayDate(selectedDate)}
            <span aria-hidden="true">▾</span>
            <input
              type="date"
              className={styles.dateInput}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              aria-label="Select dashboard date"
            />
          </label>
          <div className={styles.viewTabs}>
            <button
              type="button"
              className={dashboardRange === "today" ? styles.viewTabActive : styles.viewTab}
              onClick={() => setDashboardRange("today")}
            >
              Today
            </button>
            <button
              type="button"
              className={dashboardRange === "week" ? styles.viewTabActive : styles.viewTab}
              onClick={() => setDashboardRange("week")}
            >
              Week
            </button>
            <button
              type="button"
              className={dashboardRange === "month" ? styles.viewTabActive : styles.viewTab}
              onClick={() => setDashboardRange("month")}
            >
              Month
            </button>
          </div>
          <span className={styles.rangeHint}>{rangeLabel}</span>
        </section>

        <section className={styles.cardsGrid}>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Net calories</div>
            <div className={styles.cardNumber}>{netCalories}</div>
            <div className={styles.macrosRow}>
              <div className={styles.macroChip}>
                <span>Food intake</span>
                <strong>{data.caloriesIntake} kcal</strong>
              </div>
              <div className={styles.macroChip}>
                <span>Resting flame</span>
                <strong>{passiveCaloriesForRange} kcal</strong>
              </div>
              <div className={styles.macroChip}>
                <span>Active burn</span>
                <strong>{data.caloriesBurned} kcal</strong>
              </div>
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
                {data.sugar} g / {sugarLimit} g
                {sugarExceeded && " over"}
              </strong>
            </div>
          </div>

{/* Passsive Calorie Burned Section */}
          <div className={styles.card}>
            <div className={styles.cardLabel}>Calories Burned</div>
            <div className={styles.macrosRow}>
              <div className={styles.macroChip}>
                <span>Resting Flame</span>
                <strong>{passiveCaloriesForRange} kcal</strong>
              </div>
              <div className={styles.macroChip}>
                <span>Active Burn</span>
                <strong>{data.caloriesBurned} kcal</strong>
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeaderRow}>
              <div className={styles.cardLabel}>Postprandial insulin</div>
              <span className={styles.chartPeak}>Peak {Math.round(insulinChart.peak)}</span>
            </div>
            <div className={styles.insulinChart}>
              <div className={styles.insulinYAxis}>
                <span>{Math.round(insulinChart.maxValue)}</span>
                <span>0</span>
              </div>
              <div className={styles.insulinPlot}>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={styles.insulinSvg}>
                  <path d={insulinChart.areaPath} className={styles.insulinArea} />
                  <path d={insulinChart.path} className={styles.insulinLine} />
                </svg>
              </div>
              <div className={styles.insulinXAxis}>
                {[0, 360, 720, 1080, 1439].map((minute) => (
                  <span key={minute}>{formatHour(minute)}</span>
                ))}
              </div>
            </div>
            {!insulinChart.hasData && (
              <div className={styles.chartEmptyHint}>Log a meal to see the response curve.</div>
            )}
          </div>

        </section>


        <section className={styles.entriesSection}>
          <h2 className={styles.sectionTitle}>{rangeLabel} log</h2>
          <p className={styles.sectionHint}>
            Use the input at the bottom to quickly log meals or exercise.
          </p>
          {loading ? (
            <div className={styles.placeholderCard}>Loading data...</div>
          ) : entries.length === 0 ? (
            <div className={styles.placeholderCard}>
              No entries yet. Log meals or exercise below to see them here.
            </div>
          ) : (
            <ul className={styles.foodList}>
              {entries.map((entry, i) => {
                if (entry.kind === "activity") {
                  return (
                    <li
                      key={`${entry.type}-${entry.timestamp ?? i}`}
                      className={`${styles.foodItem} ${styles.activityItem}`}
                    >
                      <span className={styles.entryType}>Exercise</span>
                      <span className={styles.foodName}>{entry.type}</span>
                      <span className={styles.foodQty}>
                        {entry.quantity} {entry.unit}
                      </span>
                      <span className={styles.foodMacros}>
                        {entry.calories_burned} kcal burned
                      </span>
                    </li>
                  );
                }

                return (
                  <li
                    key={`${entry.name}-${entry.timestamp ?? i}`}
                    className={`${styles.foodItem} ${styles.foodLogItem}`}
                  >
                    <span className={styles.entryType}>Food</span>
                    <span className={styles.foodName}>{entry.name}</span>
                    <span className={styles.foodQty}>
                      {entry.quantity} {entry.unit}
                    </span>
                    <span className={styles.foodMacros}>
                      {entry.calories} kcal · P {entry.protein}g · C {entry.carbs}g · F {entry.fat}g
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

    <section className={styles.footerInput}>

      <BottomInput
        onCaloriesCalculated={(data) => {
          setSummaryData((prev) => ({
            ...prev,
            calories_intake: data.calories_intake ?? prev.calories_intake,
            calories_burned: data.calories_burned ?? prev.calories_burned,
            protein: data.protein ?? prev.protein,
            carbs: data.carbs ?? prev.carbs,
            fibre: data.fibre ?? prev.fibre,
            sugar: data.sugar ?? prev.sugar,
          }));
          fetchDashboardSummary();
        }}
        logDate={selectedDate}
        />
        </section>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGate>
      <DashboardContent />
    </AuthGate>
  );
}
