"use client";

import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import styles from "./AuthForm.module.css";

const ACTIVITY_OPTIONS = [
  { value: "sedentary", label: "Sedentary" },
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" },
  { value: "very_high", label: "Very high" },
];

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

export default function AuthForm() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [targetWeightKg, setTargetWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [gender, setGender] = useState("male");
  const [activityLevel, setActivityLevel] = useState("moderate");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("Enter username and password.");
      return;
    }
    setSubmitting(true);
    const result = await signIn(username.trim(), password);
    setSubmitting(false);
    if (result.success) return;
    setError(result.error || "Sign in failed.");
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const w = parseFloat(weightKg);
    const tw = parseFloat(targetWeightKg);
    const h = parseFloat(heightCm);
    if (!username.trim() || !password) {
      setError("Enter username and password.");
      return;
    }
    if (isNaN(w) || w <= 0 || isNaN(h) || h <= 0) {
      setError("Enter valid weight (kg) and height (cm).");
      return;
    }
    if (isNaN(tw) || tw <= 0) {
      setError("Enter valid target weight (kg).");
      return;
    }
    setSubmitting(true);
    const result = await signUp({
      username: username.trim(),
      password,
      weight_kg: w,
      target_weight_kg: tw,
      height_cm: h,
      gender,
      activity_level: activityLevel,
    });
    setSubmitting(false);
    if (result.success) return;
    setError(result.error || "Sign up failed.");
  };

  const isSignUp = mode === "signup";

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h1 className={styles.title}>Daily Log</h1>
        <p className={styles.subtitle}>
          {isSignUp ? "Create an account" : "Sign in to your account"}
        </p>

        <form
          onSubmit={isSignUp ? handleSignUp : handleSignIn}
          className={styles.form}
        >
          <label className={styles.label}>
            Username
            <input
              type="text"
              className={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoComplete="username"
            />
          </label>
          <label className={styles.label}>
            Password
            <input
              type="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
            />
          </label>

          {isSignUp && (
            <>
              <label className={styles.label}>
                Current weight (kg)
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  className={styles.input}
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  placeholder="e.g. 70"
                />
              </label>
              <label className={styles.label}>
                Target weight (kg)
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  className={styles.input}
                  value={targetWeightKg}
                  onChange={(e) => setTargetWeightKg(e.target.value)}
                  placeholder="e.g. 65"
                />
              </label>
              <label className={styles.label}>
                Height (cm)
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  className={styles.input}
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  placeholder="e.g. 170"
                />
              </label>
              <label className={styles.label}>
                Gender
                <select
                  className={styles.select}
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  {GENDER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.label}>
                Activity level
                <select
                  className={styles.select}
                  value={activityLevel}
                  onChange={(e) => setActivityLevel(e.target.value)}
                >
                  {ACTIVITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={submitting}
            >
              {submitting ? "..." : isSignUp ? "Sign up" : "Sign in"}
            </button>
            <button
              type="button"
              className={styles.switchButton}
              onClick={() => {
                setMode(isSignUp ? "signin" : "signup");
                setError("");
              }}
            >
              {isSignUp ? "Already have an account? Sign in" : "No account? Sign up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
