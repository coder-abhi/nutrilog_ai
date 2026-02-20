// app/components/BottomInput.tsx

"use client";

import { useState } from "react";
import styles from "./BottomInput.module.css";

export default function BottomInput({ onCaloriesCalculated }) {
//   const [text, setText] = useState("");

//   const handleSubmit = () => {
//     if (!text.trim()) return;
//     console.log("User input:", text);
//     setText("");
//   };

const [input, setInput] = useState("");
const [result, setResult] = useState<string | null>(null);
const [isLoading, setIsLoading] = useState(false);

   

    


  const calculateCalories = async () => {
    if (!input.trim()) return;
    // setResult("Calculating...");
    const userText = input;
    setInput("Analyzing ... ( "+input+" )")
    setIsLoading(true);
      try {
      const response = await fetch("http://127.0.0.1:8000/log_input", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ sentence: userText })
      });
  
      const data = await response.json();
      
      setResult(JSON.stringify(data));
      onCaloriesCalculated(data);
      setIsLoading(false);
      setInput("");
    } catch (error) {
      console.error("Error: " + error);
    }
  };
  
  return (
    <div className={styles.bar}>
      <input
        type="text"
        placeholder="Type: I walked 5 km, I ate 2 chapatis..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && calculateCalories()}
        className={styles.input}
      />

<button 
  onClick={calculateCalories} 
  className={styles.button}
  disabled={isLoading}
>
      {isLoading ? (
  <div className={styles.spinner}>
    <span></span>
    <span></span>
    <span></span>
    <span></span>
    <span></span>
  </div>
) : "Submit"}
      </button>
    </div>
  );
};
