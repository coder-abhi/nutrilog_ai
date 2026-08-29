"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { Check, Flame, Pencil, Plus, X } from "lucide-react";
import AuthGate from "../components/AuthGate";
import Header from "../components/Header";
import { useAuth } from "../context/AuthContext";
import { API_BASE_URL } from "../lib/api";
import { logicalDate, logicalToYMD, toYMD } from "../lib/date";
import styles from "./tracker.module.css";

type TrackerEntry = {
  date: string;
  value: number;
};

type TrackerCard = {
  id: string;
  name: string;
  value_type: "boolean" | "numeric";
  target_days_per_week: number;
  target_value: number | null;
  description: string;
  is_visible: boolean;
  entries: TrackerEntry[];
};

type EditDraft = {
  name: string;
  target_days_per_week: number;
  target_value: string;
  description: string;
};

function pastDays(count: number) {
  const today = logicalDate();
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
  // Boolean trackers target a number of days/week; numeric trackers target a total
  // quantity/week (e.g. 50 pushups). Both reduce to "does this week's total reach the target",
  // since boolean entries are always 0/1.
  const weeklyTotals = new Map<string, number>();
  card.entries.forEach((entry) => {
    const key = weekKey(entry.date);
    weeklyTotals.set(key, (weeklyTotals.get(key) ?? 0) + entry.value);
  });
  const target = card.value_type === "numeric" ? card.target_value ?? 0 : card.target_days_per_week;

  let streak = 0;
  const today = logicalDate();
  for (let i = 0; i < 90; i += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = toYMD(date);
    const weeklyDone = target > 0 && (weeklyTotals.get(weekKey(dateStr)) ?? 0) >= target;
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
  const maxValue = Math.max(1, ...values, Math.ceil(values.reduce((sum, value) => sum + value, 0) / values.length));
  const roundedMax = Math.max(1, Math.ceil(maxValue / 5) * 5);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const avgTop = 100 - (avg / roundedMax) * 100;
  const yTicks = [roundedMax, roundedMax / 2, 0].map((value) => Number.isInteger(value) ? value : Number(value.toFixed(1)));

  if (card.value_type === "boolean") {
    return (
      <div className={styles.booleanGraph}>
        {days.map((date) => {
          const value = byDate.get(date) ?? 0;
          const label = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });
          return (
            <div key={date} className={styles.booleanDay}>
              <span className={value > 0 ? styles.booleanDone : styles.booleanMiss}>
                {value > 0 ? <Check size={19} strokeWidth={3} /> : <X size={19} strokeWidth={3} />}
              </span>
              <small>{label}</small>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={styles.numericGraph}>
      <div className={styles.yAxis} aria-hidden="true">
        {yTicks.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
      <div className={styles.plotWrap}>
        <div className={styles.plotArea} style={{ "--avg-line": `${avgTop}%` } as CSSProperties}>
          <span className={styles.avgLine} />
          <span className={styles.avgLabel}>{avg.toFixed(avg >= 10 || avg === 0 ? 0 : 1)}</span>
          {days.map((date) => {
            const value = byDate.get(date) ?? 0;
            return (
              <div key={date} className={styles.barSlot}>
                <span className={styles.barFill} style={{ height: `${(value / roundedMax) * 100}%` }} />
                <strong>{value || ""}</strong>
              </div>
            );
          })}
        </div>
        <div className={styles.xAxis}>
          {days.map((date) => (
            <span key={date}>
              {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" })}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function makeEditDraft(card: TrackerCard): EditDraft {
  return {
    name: card.name,
    target_days_per_week: card.target_days_per_week,
    target_value: card.target_value ? String(card.target_value) : "",
    description: card.description ?? "",
  };
}

function CardEditForm({
  draft,
  valueType,
  onChange,
  onCancel,
  onSave,
  saving,
}: {
  draft: EditDraft;
  valueType: "boolean" | "numeric";
  onChange: (draft: EditDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className={styles.editForm}>
      <label>
        <span>Name</span>
        <input value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} />
      </label>
      {valueType === "numeric" ? (
        <label>
          <span>Weekly target</span>
          <input
            type="number"
            min="1"
            step="1"
            placeholder="e.g. 50"
            value={draft.target_value}
            onChange={(event) => onChange({ ...draft, target_value: event.target.value })}
          />
        </label>
      ) : (
        <label>
          <span>Weekly target</span>
          <select
            value={draft.target_days_per_week}
            onChange={(event) => onChange({ ...draft, target_days_per_week: Number(event.target.value) })}
          >
            {[1, 2, 3, 4, 5, 6, 7].map((day) => (
              <option key={day} value={day}>
                {day} {day === 1 ? "day" : "days"} per week
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        <span>Description</span>
        <textarea
          rows={3}
          value={draft.description}
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
        />
      </label>
      <div className={styles.editActions}>
        <button type="button" className={styles.secondaryButton} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" onClick={onSave} disabled={saving || !draft.name.trim()}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

function TrackerContent() {
  const { getAuthHeaders, signOut } = useAuth();
  const [cards, setCards] = useState<TrackerCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [numericDrafts, setNumericDrafts] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, EditDraft>>({});
  const [error, setError] = useState<string | null>(null);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/tracker_cards`, { headers: { ...getAuthHeaders() } });
      if (res.status === 401) {
        signOut();
        return;
      }
      if (!res.ok) throw new Error("Could not load trackers.");
      setCards(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load trackers.");
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, signOut]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const visibleCards = useMemo(() => cards.filter((card) => card.is_visible), [cards]);

  const setVisibility = async (card: TrackerCard, isVisible: boolean) => {
    setError(null);
    setCards((current) => current.map((item) => item.id === card.id ? { ...item, is_visible: isVisible } : item));
    try {
      const res = await fetch(`${API_BASE_URL}/tracker_cards/${card.id}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ is_visible: isVisible }),
      });
      if (res.status === 401) {
        signOut();
        return;
      }
      if (!res.ok) throw new Error("Could not update tracker visibility.");
    } catch (err) {
      setCards((current) => current.map((item) => item.id === card.id ? { ...item, is_visible: card.is_visible } : item));
      setError(err instanceof Error ? err.message : "Could not update tracker visibility.");
    }
  };

  const logValue = async (card: TrackerCard, value: number) => {
    if (!Number.isFinite(value) || value < 0) {
      setError("Enter a valid non-negative value.");
      return;
    }
    setSavingId(card.id);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/tracker_entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ tracker_id: card.id, value, date: logicalToYMD() }),
      });
      if (res.status === 401) {
        signOut();
        return;
      }
      if (res.ok) {
        setNumericDrafts((current) => ({ ...current, [card.id]: "" }));
        fetchCards();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Could not log tracker value.");
      }
    } catch {
      setError("Could not log tracker value.");
    } finally {
      setSavingId(null);
    }
  };

  const startEditing = (card: TrackerCard) => {
    setEditingId(card.id);
    setEditDrafts((current) => ({ ...current, [card.id]: current[card.id] ?? makeEditDraft(card) }));
  };

  const saveCard = async (card: TrackerCard) => {
    const draft = editDrafts[card.id];
    if (!draft?.name.trim()) return;
    if (card.value_type === "numeric" && (!draft.target_value || Number(draft.target_value) <= 0)) {
      setError("Enter a valid weekly target.");
      return;
    }
    setSavingId(card.id);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/tracker_cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(
          card.value_type === "numeric"
            ? { name: draft.name, target_value: Number(draft.target_value), description: draft.description }
            : { name: draft.name, target_days_per_week: draft.target_days_per_week, description: draft.description },
        ),
      });
      if (res.status === 401) {
        signOut();
        return;
      }
      if (res.ok) {
        const updated = await res.json();
        setCards((current) => current.map((item) => item.id === card.id ? { ...item, ...updated, entries: item.entries } : item));
        setEditingId(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Could not update tracker.");
      }
    } catch {
      setError("Could not update tracker.");
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

        {error && <div className={styles.emptyState} role="alert">{error}</div>}

        <section className={styles.grid}>
          {loading ? (
            <div className={styles.emptyState}>Loading trackers...</div>
          ) : (
            <>
              {visibleCards.map((card) => {
                const streak = calculateStreak(card);
                const isEditing = editingId === card.id;
                const draft = editDrafts[card.id] ?? makeEditDraft(card);
                return (
                  <article key={card.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <div>
                        <span className={styles.typePill}>{card.value_type === "boolean" ? "Binary" : "Numerical"}</span>
                        <h2>{card.name}</h2>
                      </div>
                      <div className={styles.cardTools}>
                        <button
                          type="button"
                          className={styles.iconButton}
                          onClick={() => startEditing(card)}
                          aria-label={`Edit ${card.name}`}
                          title="Edit tracker"
                        >
                          <Pencil size={17} />
                        </button>
                        <div className={styles.streak}>
                          <Flame size={18} />
                          <strong>{streak}</strong>
                        </div>
                      </div>
                    </div>
                    {isEditing ? (
                      <CardEditForm
                        draft={draft}
                        valueType={card.value_type}
                        onChange={(nextDraft) => setEditDrafts((current) => ({ ...current, [card.id]: nextDraft }))}
                        onCancel={() => setEditingId(null)}
                        onSave={() => saveCard(card)}
                        saving={savingId === card.id}
                      />
                    ) : (
                      <>
                        <p className={styles.target}>
                          {card.value_type === "numeric" ? `${card.target_value} per week target` : `${card.target_days_per_week} days per week target`}
                        </p>
                        <TrackerGraph card={card} />
                        {card.value_type === "boolean" ? (
                          <div className={styles.actions}>
                            <button
                              type="button"
                              onClick={() => logValue(card, 1)}
                              disabled={savingId === card.id}
                              aria-label={`Mark ${card.name} done today`}
                              title="Done today"
                            >
                              <Check size={20} strokeWidth={3} />
                            </button>
                            <button
                              type="button"
                              onClick={() => logValue(card, 0)}
                              disabled={savingId === card.id}
                              aria-label={`Mark ${card.name} not done today`}
                              title="Not done today"
                            >
                              <X size={20} strokeWidth={3} />
                            </button>
                          </div>
                        ) : (
                          <div className={styles.numericLog}>
                            <input
                              type="number"
                              min="0"
                              placeholder="Add today"
                              value={numericDrafts[card.id] ?? ""}
                              onChange={(event) => setNumericDrafts((current) => ({ ...current, [card.id]: event.target.value }))}
                            />
                            <button
                              type="button"
                              disabled={savingId === card.id || !numericDrafts[card.id]}
                              onClick={() => logValue(card, Number(numericDrafts[card.id]))}
                            >
                              Add
                            </button>
                          </div>
                        )}
                      </>
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
