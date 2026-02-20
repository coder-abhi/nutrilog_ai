// app/dashboard/page.tsx
"use client";
import BottomInput from "./components/BottomInput";
import styles from "./page.module.css";
import { useState } from "react";
export default function DashboardPage() {

  // const [caloriesBurned, setCaloriesBurned] = useState(0);
  const [ summaryData, setSummaryData] = useState({
    calories_intake: 0,
    calories_burned: 0,
    protein: 0,
    carbs: 0,
    fibre: 0,
    sugar: 0
  });

    // sample daily values
  const data = {
    caloriesIntake: summaryData?.calories_intake ?? 0, 
    caloriesBurned: summaryData?.calories_burned ?? 0,
    protein: summaryData?.protein ?? 0, // grams
    carbs: summaryData?.carbs ?? 0,   // grams
    fibre: summaryData?.fibre ?? 0,    // grams
    sugar: summaryData?.sugar ?? 0     // grams
  };

  const SUGAR_LIMIT = 25;
  const sugarExceeded = (summaryData?.sugar ?? 0) > SUGAR_LIMIT;

  return (
    <div className={styles.container}>
      <h1>Daily Health Dashboard</h1>

      <section className={styles.section}>
        <h2>Calories</h2>
        <p>🍽 Intake: <strong>{data.caloriesIntake} kcal</strong></p>
        <p>🔥 Burned: <strong>{data.caloriesBurned} kcal</strong></p>
        <p>
          ⚖ Net:{" "}
          <strong>
            {data.caloriesIntake - data.caloriesBurned} kcal
          </strong>
        </p>
      </section>

      <section className={styles.section}>
        <h2>Macronutrients</h2>
        <ul>
          <li>🥩 Protein: {data.protein} g</li>
          <li>🍞 Carbs: {data.carbs} g</li>
          <li>🥦 Fibre: {data.fibre} g</li>
          <li
            className={sugarExceeded ? styles.sugarExceeded : styles.sugarOk}
          >
            🍬 Sugar: {data.sugar} g
            {sugarExceeded && ` (Limit ${SUGAR_LIMIT} g exceeded)`}
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Summary</h2>
        {sugarExceeded ? (
          <p className={styles.summaryWarning}>
            ⚠ Sugar intake is high today. Consider reducing sweets or sugary drinks.
          </p>
        ) : (
          <p className={styles.summarySuccess}>
            ✅ Sugar intake is within healthy limits.
          </p>
        )}
      </section>
      <div>
        <BottomInput onCaloriesCalculated={setSummaryData} />
      </div>
    </div>
  );
};