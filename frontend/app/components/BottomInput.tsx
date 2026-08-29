"use client";

import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { API_BASE_URL } from "../lib/api";
import { logicalToYMD, toYMD } from "../lib/date";
import styles from "./BottomInput.module.css";

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
  logDate: string;
};

function getCurrentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function formatSliderTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(mins).padStart(2, "0")} ${suffix}`;
}

export default function BottomInput({ onCaloriesCalculated, logDate }: Props) {
  const { getAuthHeaders, signOut } = useAuth();
  const [input, setInput] = useState("");
  const [logTimeMinutes, setLogTimeMinutes] = useState(() => getCurrentMinutes());
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const calculateCalories = async () => {
    if (!input.trim()) return;
    const userText = input;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // If the dashboard is on its auto-detected "today" (the logical, 3-AM-shifted day),
      // send the true calendar date paired with the true clock time so the backend can
      // reconstruct a real, monotonic timestamp - otherwise a log made between midnight and
      // 3 AM would get stamped with a date one day behind reality. An explicit backdate
      // (the user picked a different date) is honored as-is.
      const eventDate = logDate === logicalToYMD() ? toYMD(new Date()) : logDate;
      const response = await fetch(`${API_BASE_URL}/log_input`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ sentence: userText, date: eventDate, log_time_minutes: logTimeMinutes }),
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
      setLogTimeMinutes(getCurrentMinutes());
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
      {input.trim() && (
        <div className={styles.timeSliderWrap}>
        <div className={styles.timeSliderHeader}>
          <span>Log time</span>
          <strong>{formatSliderTime(logTimeMinutes)}</strong>
        </div>
        <div className={styles.timeScale}>
          <span>12 AM</span>
          <span>6 AM</span>
          <span>12 PM</span>
          <span>6 PM</span>
          <span>12 AM</span>
        </div>
        <input
          type="range"
          min="0"
          max="1439"
          step="5"
          value={logTimeMinutes}
          onChange={(e) => setLogTimeMinutes(Number(e.target.value))}
          className={styles.timeSlider}
          aria-label="Log time"
        />
      </div>
      )}
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
