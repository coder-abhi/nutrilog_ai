// app/dashboard/page.tsx
// import BottomInput from "../app/components/BottomInput"; // import the BottomInput component
import BottomInput from "./components/BottomInput";
import BottomInput2 from "./components/BottomInput2";
export default function DashboardPage() {
  // sample daily values
  const data = {
    caloriesIntake: 2100, 
    caloriesBurned: 650,
    protein: 110, // grams
    carbs: 260,   // grams
    fibre: 32,    // grams
    sugar: 38     // grams
  };

  const SUGAR_LIMIT = 25;
  const sugarExceeded = data.sugar > SUGAR_LIMIT;

  return (
    <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1>Daily Health Dashboard</h1>

      <section style={{ marginTop: "1.5rem" }}>
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

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Macronutrients</h2>
        <ul>
          <li>🥩 Protein: {data.protein} g</li>
          <li>🍞 Carbs: {data.carbs} g</li>
          <li>🥦 Fibre: {data.fibre} g</li>
          <li
            style={{
              color: sugarExceeded ? "red" : "green",
              fontWeight: "bold"
            }}
          >
            🍬 Sugar: {data.sugar} g
            {sugarExceeded && ` (Limit ${SUGAR_LIMIT} g exceeded)`}
          </li>
        </ul>
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h2>Summary</h2>
        {sugarExceeded ? (
          <p style={{ color: "red" }}>
            ⚠ Sugar intake is high today. Consider reducing sweets or sugary drinks.
          </p>
        ) : (
          <p style={{ color: "green" }}>
            ✅ Sugar intake is within healthy limits.
          </p>
        )}
      </section>
      <div>
        <BottomInput />
        {/* <BottomInput2 /> */}
      </div>
    </div>
  );
};