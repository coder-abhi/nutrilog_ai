"use client";

import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import styles from "./BottomInput.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export type SummaryData = {
  calories_intake?: number;
  calories_burned?: number;
  protein?: number;
  carbs?: number;
  fibre?: number;
  sugar?: number;
};

type Props = {
  onCaloriesCalculated: (data: SummaryData) => void;
};

export default function BottomInput({ onCaloriesCalculated }: Props) {
  const { getAuthHeaders, signOut } = useAuth();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const calculateCalories = async () => {
    if (!input.trim()) return;
    const userText = input;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`${API_BASE}/log_input`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ sentence: userText }),
      });
      const data = await response.json();
      if (response.status === 401) {
        signOut();
        setErrorMessage("Session expired. Please sign in again.");
        return;
      }
      if (!response.ok) {
        setErrorMessage(data.detail || "Request failed");
        return;
      }
      onCaloriesCalculated(data);
      setInput("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error. Is the backend running?";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.bar}>
      {errorMessage && <p className={styles.errorText}>{errorMessage}</p>}
      <div className={styles.barRow}>
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
          <div className={styles.loaderDots}>
            <span></span>
            <span></span>
            <span></span>
          </div>
        ) : (
          "Submit"
        )}
        </button>
      </div>
    </div>
  );
}
