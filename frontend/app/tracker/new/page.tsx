"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import AuthGate from "../../components/AuthGate";
import Header from "../../components/Header";
import { useAuth } from "../../context/AuthContext";
import { API_BASE_URL } from "../../lib/api";
import styles from "./newTracker.module.css";

function NewTrackerContent() {
  const router = useRouter();
  const { getAuthHeaders, signOut } = useAuth();
  const [name, setName] = useState("");
  const [valueType, setValueType] = useState<"boolean" | "numeric">("boolean");
  const [targetDays, setTargetDays] = useState(7);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/tracker_cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          name,
          value_type: valueType,
          target_days_per_week: targetDays,
          description,
        }),
      });
      const data = await res.json();
      if (res.status === 401) {
        signOut();
        return;
      }
      if (!res.ok) {
        setError(data.detail || "Could not create tracker.");
        return;
      }
      router.push("/tracker");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <form className={styles.form} onSubmit={submit}>
          <div>
            <h1>Create tracker card</h1>
            <p>The description helps the AI recognize updates from your normal log text.</p>
          </div>

          <label className={styles.field}>
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Push ups" />
          </label>

          <fieldset className={styles.fieldset}>
            <legend>Tracking type</legend>
            <label>
              <input
                type="radio"
                name="valueType"
                checked={valueType === "boolean"}
                onChange={() => setValueType("boolean")}
              />
              Yes / No
            </label>
            <label>
              <input
                type="radio"
                name="valueType"
                checked={valueType === "numeric"}
                onChange={() => setValueType("numeric")}
              />
              Numerical
            </label>
          </fieldset>

          <label className={styles.field}>
            <span>Weekly target</span>
            <select value={targetDays} onChange={(event) => setTargetDays(Number(event.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                <option key={day} value={day}>
                  {day} {day === 1 ? "day" : "days"} per week
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Examples: pushups, push ups, did reps. Extract the number of pushups."
              rows={4}
            />
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={() => router.push("/tracker")}>
              Cancel
            </button>
            <button type="submit" disabled={saving}>
              {saving ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default function NewTrackerPage() {
  return (
    <AuthGate>
      <NewTrackerContent />
    </AuthGate>
  );
}
