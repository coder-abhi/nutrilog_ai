"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { Flame, Plus } from "lucide-react";
import AuthGate from "../components/AuthGate";
import Header from "../components/Header";
import { useAuth } from "../context/AuthContext";
import styles from "./tracker.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type TrackerEntry = {
  date: string;
  value: number;
};

type TrackerCard = {
  id: string;
  name: string;
  value_type: "boolean" | "numeric";
  target_days_per_week: number;
  is_visible: boolean;
  entries: TrackerEntry[];
};

function toYMD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function pastDays(count: number) {
  const today = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (count - 1 - index));
    return toYMD(date);
  });
}

function weekKey(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return toYMD(date);
}

function calculateStreak(card: TrackerCard) {
  const byDate = new Map(card.entries.map((entry) => [entry.date, entry.value]));
  const completed = (date: string) => (byDate.get(date) ?? 0) > 0;
  const weeklyCounts = new Map<string, number>();

  card.entries.forEach((entry) => {
    if (entry.value <= 0) return;
    const key = weekKey(entry.date);
    weeklyCounts.set(key, (weeklyCounts.get(key) ?? 0) + 1);
  });

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 90; i += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = toYMD(date);
    const weeklyDone = (weeklyCounts.get(weekKey(dateStr)) ?? 0) >= card.target_days_per_week;
    if (weeklyDone || completed(dateStr)) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

function TrackerGraph({ card }: { card: TrackerCard }) {
  const days = pastDays(7);
  const byDate = new Map(card.entries.map((entry) => [entry.date, entry.value]));
  const values = days.map((date) => byDate.get(date) ?? 0);
  const maxValue = Math.max(1, ...values);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;

  if (card.value_type === "boolean") {
    return (
      <div className={styles.booleanGraph}>
        {days.map((date) => {
          const value = byDate.get(date) ?? 0;
          const label = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });
          return (
            <div key={date} className={styles.booleanDay}>
              <span className={value > 0 ? styles.booleanDone : styles.booleanMiss}>
                {value > 0 ? "Yes" : "No"}
              </span>
              <small>{label}</small>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={styles.barGraph} style={{ "--avg-line": `${100 - (avg / maxValue) * 100}%` } as CSSProperties}>
      <span className={styles.avgLine} />
      {days.map((date) => {
        const value = byDate.get(date) ?? 0;
        const label = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });
        return (
          <div key={date} className={styles.barSlot}>
            <div className={styles.barTrack}>
              <span className={styles.barFill} style={{ height: `${(value / maxValue) * 100}%` }} />
            </div>
            <strong>{value || ""}</strong>
            <small>{label}</small>
          </div>
        );
      })}
    </div>
  );
}

function TrackerContent() {
  const { getAuthHeaders, signOut } = useAuth();
  const [cards, setCards] = useState<TrackerCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [numericDrafts, setNumericDrafts] = useState<Record<string, string>>({});

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/tracker_cards`, { headers: { ...getAuthHeaders() } });
      if (res.status === 401) {
        signOut();
        return;
      }
      if (!res.ok) return;
      setCards(await res.json());
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, signOut]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const visibleCards = useMemo(() => cards.filter((card) => card.is_visible), [cards]);

  const setVisibility = async (card: TrackerCard, isVisible: boolean) => {
    setCards((current) => current.map((item) => item.id === card.id ? { ...item, is_visible: isVisible } : item));
    await fetch(`${API_BASE}/tracker_cards/${card.id}/visibility`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ is_visible: isVisible }),
    });
  };

  const logValue = async (card: TrackerCard, value: number) => {
    setSavingId(card.id);
    try {
      const res = await fetch(`${API_BASE}/tracker_entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ tracker_id: card.id, value }),
      });
      if (res.ok) {
        setNumericDrafts((current) => ({ ...current, [card.id]: "" }));
        fetchCards();
      }
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <section className={styles.titleRow}>
          <div>
            <h1>Tracker</h1>
            <p>Choose the habit cards you want to see and log today&apos;s value.</p>
          </div>
          <Link href="/tracker/new" className={styles.primaryAction}>
            <Plus size={18} />
            New tracker
          </Link>
        </section>

        <section className={styles.selector}>
          {cards.length === 0 ? (
            <span>No tracker cards yet.</span>
          ) : (
            cards.map((card) => (
              <label key={card.id} className={styles.selectorItem}>
                <input
                  type="checkbox"
                  checked={card.is_visible}
                  onChange={(event) => setVisibility(card, event.target.checked)}
                />
                <span>{card.name}</span>
              </label>
            ))
          )}
        </section>

        <section className={styles.grid}>
          {loading ? (
            <div className={styles.emptyState}>Loading trackers...</div>
          ) : (
            <>
              {visibleCards.map((card) => {
                const streak = calculateStreak(card);
                return (
                  <article key={card.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <div>
                        <span className={styles.typePill}>{card.value_type === "boolean" ? "Yes / No" : "Numerical"}</span>
                        <h2>{card.name}</h2>
                      </div>
                      <div className={styles.streak}>
                        <Flame size={18} />
                        <strong>{streak}</strong>
                      </div>
                    </div>
                    <p className={styles.target}>{card.target_days_per_week} days per week target</p>
                    <TrackerGraph card={card} />
                    {card.value_type === "boolean" ? (
                      <div className={styles.actions}>
                        <button type="button" onClick={() => logValue(card, 1)} disabled={savingId === card.id}>
                          Yes
                        </button>
                        <button type="button" onClick={() => logValue(card, 0)} disabled={savingId === card.id}>
                          No
                        </button>
                      </div>
                    ) : (
                      <div className={styles.numericLog}>
                        <input
                          type="number"
                          min="0"
                          placeholder="Today"
                          value={numericDrafts[card.id] ?? ""}
                          onChange={(event) => setNumericDrafts((current) => ({ ...current, [card.id]: event.target.value }))}
                        />
                        <button
                          type="button"
                          disabled={savingId === card.id || !numericDrafts[card.id]}
                          onClick={() => logValue(card, Number(numericDrafts[card.id]))}
                        >
                          Log
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
              <Link href="/tracker/new" className={styles.addCard} aria-label="Create tracker card">
                <Plus size={42} />
              </Link>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default function TrackerPage() {
  return (
    <AuthGate>
      <TrackerContent />
    </AuthGate>
  );
}
