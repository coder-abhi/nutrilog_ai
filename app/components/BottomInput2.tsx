"use client";

import { useState } from "react";

export default function BottomInput2() {
  const [result, setResult] = useState(null);
  const [input, setInput] = useState("");

  const CalorieChecker = () => {
    

  
    const calculateCalories = async () => {
      const response = await fetch("http://127.0.0.1:8000/calories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ sentence: input })
      });
  
      const data = await response.json();
      setResult(data);
    };
  }

  return (
    <div>

{result && <p>Calories burned: {result}</p>}
      <input
        type="text"
        placeholder="Type: I walked 5 km, I ate 2 chapatis..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && CalorieChecker()}
      />
      <button onClick={CalorieChecker}>Submit</button>
    </div>
  );
}