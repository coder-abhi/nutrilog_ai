"use client";

import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import styles from "./AuthForm.module.css";
import GoalSelection, { type GoalValue } from "./GoalSelection";


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

const DEFAULT_PROFILE = {
  weightKg: 70,
  targetWeightKg: null as number | null,
  heightCm: 170,
};

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

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedGoal, setSelectedGoal] = useState<GoalValue | null>(null);

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

    if (step === 1) {
      if (!username.trim() || !password) {
        setError("Enter username and password.");
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      setStep(2);
      return;
    }

    const w = parseFloat(weightKg);
    const tw = parseFloat(targetWeightKg);
    const h = parseFloat(heightCm);

    if (weightKg && (isNaN(w) || w <= 0)) {
      setError("Enter a valid weight (kg), or leave it empty.");
      return;
    }

    if (heightCm && (isNaN(h) || h <= 0)) {
      setError("Enter a valid height (cm), or leave it empty.");
      return;
    }

    if (selectedGoal === "weight_loss" && targetWeightKg && (isNaN(tw) || tw <= 0)) {
      setError("Enter a valid target weight (kg), or leave it empty.");
      return;
    }

    setSubmitting(true);

    const result = await signUp({
      username: username.trim(),
      password,
      weight_kg: weightKg ? w : DEFAULT_PROFILE.weightKg,
      target_weight_kg: selectedGoal === "weight_loss" && targetWeightKg ? tw : DEFAULT_PROFILE.targetWeightKg,
      height_cm: heightCm ? h : DEFAULT_PROFILE.heightCm,
      gender,
      activity_level: activityLevel,
      goal: selectedGoal ?? "",
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
          {(!isSignUp || step === 1) && (
            <>
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
            </>
          )}

          {isSignUp && step === 1 && (
            <>
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

          {isSignUp && step === 2 && (
            <GoalSelection 
            selectedGoal={selectedGoal}
            onGoalChange={setSelectedGoal} 
            onWeightChange = {setWeightKg} 
            onTargetWeightChange = {setTargetWeightKg}
            onHeightChange = {setHeightCm}
            currWeight = {weightKg}
            currTargetWeight = {targetWeightKg}
            currHeight = {heightCm}
            />
          )}

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={submitting}
            >
              {submitting
                ? "..."
                : isSignUp
                  ? step === 1
                    ? "Next"
                    : "Complete Sign up"
                  : "Sign in"}
            </button>
            {isSignUp && step === 2 && (
              <div className={styles.secondaryActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => {
                    setError("");
                    setStep(1);
                  }}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className={styles.secondaryButton}
                  disabled={submitting}
                >
                  Skip for now
                </button>
              </div>
            )}
            <button
              type="button"
              className={styles.switchButton}
              onClick={() => {
                setMode(isSignUp ? "signin" : "signup");
                setError("");
                setStep(1);
                setSelectedGoal(null);
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
