"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGate from "../../components/AuthGate";
import Header from "../../components/Header";
import { useAuth } from "../../context/AuthContext";
import styles from "./profileEdit.module.css";

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

const GOAL_OPTIONS = [
  { value: "muscle_gain", label: "Muscle Gain" },
  { value: "weight_loss", label: "Weight Loss" },
  { value: "skin_health", label: "Skin Health" },
  { value: "hair_growth", label: "Hair Growth" },
  { value: "energy_boost", label: "Energy Boost" },
  { value: "pcos", label: "PCOS / PCOD" },
];

function EditProfileContent() {
  const router = useRouter();
  const { user, updateProfile } = useAuth();
  const [weightKg, setWeightKg] = useState(() => String(user?.weight_kg ?? ""));
  const [targetWeightKg, setTargetWeightKg] = useState(() => user?.target_weight_kg ? String(user.target_weight_kg) : "");
  const [heightCm, setHeightCm] = useState(() => String(user?.height_cm ?? ""));
  const [gender, setGender] = useState(() => user?.gender ?? "male");
  const [activityLevel, setActivityLevel] = useState(() => user?.activity_level ?? "moderate");
  const [goals, setGoals] = useState<string[]>(() => user?.goals ?? []);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const toggleGoal = (value: string) => {
    setGoals((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  };

  const showTargetWeight = goals.includes("weight_loss") || targetWeightKg.trim() !== "";
  const profilePreview = useMemo(() => {
    const pieces = [
      weightKg ? `${weightKg} kg` : null,
      heightCm ? `${heightCm} cm` : null,
      activityLevel.replace("_", " "),
    ].filter(Boolean);
    return pieces.join(" · ");
  }, [activityLevel, heightCm, weightKg]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSaved(false);

    const parsedWeight = parseFloat(weightKg);
    const parsedTarget = parseFloat(targetWeightKg);
    const parsedHeight = parseFloat(heightCm);

    if (Number.isNaN(parsedWeight) || parsedWeight <= 0) {
      setError("Enter a valid current weight.");
      return;
    }
    if (Number.isNaN(parsedHeight) || parsedHeight <= 0) {
      setError("Enter a valid height.");
      return;
    }
    if (targetWeightKg.trim() && (Number.isNaN(parsedTarget) || parsedTarget <= 0)) {
      setError("Enter a valid target weight, or leave it empty.");
      return;
    }

    setSubmitting(true);
    const result = await updateProfile({
      weight_kg: parsedWeight,
      target_weight_kg: targetWeightKg.trim() ? parsedTarget : null,
      height_cm: parsedHeight,
      gender,
      activity_level: activityLevel,
      goals,
    });
    setSubmitting(false);

    if (!result.success) {
      setError(result.error || "Could not update profile.");
      return;
    }
    setSaved(true);
  };

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <section className={styles.panel}>
          <div className={styles.headingRow}>
            <div>
              <p className={styles.kicker}>Current user</p>
              <h1>{user?.username}</h1>
              <p>{profilePreview}</p>
            </div>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.field}>
              <span>Current weight</span>
              <div className={styles.inputWithUnit}>
                <input
                  type="number"
                  min="1"
                  step="0.1"
                  value={weightKg}
                  onChange={(event) => setWeightKg(event.target.value)}
                />
                <em>kg</em>
              </div>
            </label>

            <label className={styles.field}>
              <span>Height</span>
              <div className={styles.inputWithUnit}>
                <input
                  type="number"
                  min="1"
                  step="0.1"
                  value={heightCm}
                  onChange={(event) => setHeightCm(event.target.value)}
                />
                <em>cm</em>
              </div>
            </label>

            <fieldset className={styles.field}>
              <legend>Goals</legend>
              <div className={styles.checkboxGroup}>
                {GOAL_OPTIONS.map((option) => (
                  <label key={option.value} className={styles.checkboxOption}>
                    <input
                      type="checkbox"
                      checked={goals.includes(option.value)}
                      onChange={() => toggleGoal(option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {showTargetWeight && (
              <label className={styles.field}>
                <span>Target weight</span>
                <div className={styles.inputWithUnit}>
                  <input
                    type="number"
                    min="1"
                    step="0.1"
                    value={targetWeightKg}
                    onChange={(event) => setTargetWeightKg(event.target.value)}
                  />
                  <em>kg</em>
                </div>
              </label>
            )}

            <label className={styles.field}>
              <span>Gender</span>
              <select value={gender} onChange={(event) => setGender(event.target.value)}>
                {GENDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Activity level</span>
              <select value={activityLevel} onChange={(event) => setActivityLevel(event.target.value)}>
                {ACTIVITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {error && <p className={styles.error}>{error}</p>}
            {saved && <p className={styles.success}>Profile updated.</p>}

            <div className={styles.actions}>
              <button type="submit" className={styles.primaryButton} disabled={submitting}>
                {submitting ? "Saving..." : "Save profile"}
              </button>
              <button type="button" className={styles.secondaryButton} onClick={() => router.back()}>
                Cancel
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

export default function EditProfilePage() {
  return (
    <AuthGate>
      <EditProfileContent />
    </AuthGate>
  );
}
