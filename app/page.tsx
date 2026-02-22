"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import AuthGate from "./components/AuthGate";
import BottomInput from "./components/BottomInput";
import styles from "./page.module.css";
import { useAuth } from "./context/AuthContext";

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

function DashboardContent() {
  const { user, signOut, getAuthHeaders } = useAuth();
  const [summaryData, setSummaryData] = useState({
    calories_intake: 0,
    calories_burned: 0,
    protein: 0,
    carbs: 0,
    fibre: 0,
    sugar: 0
  });
  const [foods, setFoods] = useState<FoodEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTodaySummary = useCallback(async () => {
    if (!user?.username) return;
    try {
      const res = await fetch(`${API_BASE}/today_summary`, {
        headers: { ...getAuthHeaders() },
      });
      if (res.status === 401) {
        signOut();
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setSummaryData({
        calories_intake: data.summary?.calories_intake ?? 0,
        calories_burned: data.summary?.calories_burned ?? 0,
        protein: data.summary?.protein ?? 0,
        carbs: data.summary?.carbs ?? 0,
        fibre: data.summary?.fibre ?? 0,
        sugar: data.summary?.sugar ?? 0,
      });
      setFoods(data.foods ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user?.username, getAuthHeaders, signOut]);

  useEffect(() => {
    fetchTodaySummary();
  }, [fetchTodaySummary]);

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
          <span className={styles.userName}>{user?.username}</span>
          <button type="button" onClick={signOut} className={styles.signOut}>
            Sign out
          </button>
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
            Use the input at the bottom to quickly log meals or exercise.
          </p>
          {loading ? (
            <div className={styles.placeholderCard}>Loading today&apos;s data...</div>
          ) : foods.length === 0 ? (
            <div className={styles.placeholderCard}>
              No entries yet. Log meals or exercise below to see them here.
            </div>
          ) : (
            <ul className={styles.foodList}>
              {foods.map((f, i) => (
                <li key={`${f.name}-${f.timestamp ?? i}`} className={styles.foodItem}>
                  <span className={styles.foodName}>{f.name}</span>
                  <span className={styles.foodQty}>
                    {f.quantity} {f.unit}
                  </span>
                  <span className={styles.foodMacros}>
                    {f.calories} kcal · P {f.protein}g · C {f.carbs}g · F {f.fat}g
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

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
          fetchTodaySummary();
        }}
      />
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