import { Feather } from "@expo/vector-icons";
import { Link } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "@/auth/AuthContext";
import { AuthGate } from "@/components/AuthGate";
import { Header } from "@/components/Header";
import { PlainScreen } from "@/components/Screen";
import { API_BASE_URL } from "@/config/api";
import { colors, shadow } from "@/styles/theme";
import type { TrackerCard } from "@/types";
import { toYMD } from "@/utils/date";

type EditDraft = {
  name: string;
  target_days_per_week: number;
  description: string;
};

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
    if (weeklyDone || (byDate.get(dateStr) ?? 0) > 0) streak += 1;
    else break;
  }
  return streak;
}

function makeEditDraft(card: TrackerCard): EditDraft {
  return {
    name: card.name,
    target_days_per_week: card.target_days_per_week,
    description: card.description ?? "",
  };
}

export default function TrackerPage() {
  return (
    <AuthGate>
      <TrackerContent />
    </AuthGate>
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

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/tracker_cards`, { headers: { ...getAuthHeaders() } });
      if (res.status === 401) {
        await signOut();
        return;
      }
      if (res.ok) setCards(await res.json());
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, signOut]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const visibleCards = useMemo(() => cards.filter((card) => card.is_visible), [cards]);

  const setVisibility = async (card: TrackerCard, isVisible: boolean) => {
    setCards((current) => current.map((item) => (item.id === card.id ? { ...item, is_visible: isVisible } : item)));
    await fetch(`${API_BASE_URL}/tracker_cards/${card.id}/visibility`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ is_visible: isVisible }),
    });
  };

  const logValue = async (card: TrackerCard, value: number) => {
    setSavingId(card.id);
    try {
      const res = await fetch(`${API_BASE_URL}/tracker_entries`, {
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

  const startEditing = (card: TrackerCard) => {
    setEditingId(card.id);
    setEditDrafts((current) => ({ ...current, [card.id]: current[card.id] ?? makeEditDraft(card) }));
  };

  const saveCard = async (card: TrackerCard) => {
    const draft = editDrafts[card.id];
    if (!draft?.name.trim()) return;
    setSavingId(card.id);
    try {
      const res = await fetch(`${API_BASE_URL}/tracker_cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(draft),
      });
      if (res.status === 401) {
        await signOut();
        return;
      }
      if (res.ok) {
        const updated = await res.json();
        setCards((current) => current.map((item) => (item.id === card.id ? { ...item, ...updated, entries: item.entries } : item)));
        setEditingId(null);
      }
    } finally {
      setSavingId(null);
    }
  };

  return (
    <PlainScreen>
      <Header />
      <ScrollView contentContainerStyle={styles.main} keyboardShouldPersistTaps="handled">
        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <Text style={styles.title}>Tracker</Text>
            <Text style={styles.subtitle}>Choose the habit cards you want to see and log today's value.</Text>
          </View>
          <Link href="/tracker/new" asChild>
            <Pressable style={styles.primaryAction}>
              <Feather name="plus" size={18} color="#fff" />
              <Text style={styles.primaryActionText}>New tracker</Text>
            </Pressable>
          </Link>
        </View>

        <View style={styles.selector}>
          {cards.length === 0 ? (
            <Text style={styles.selectorEmpty}>No tracker cards yet.</Text>
          ) : (
            cards.map((card) => (
              <Pressable key={card.id} style={styles.selectorItem} onPress={() => setVisibility(card, !card.is_visible)}>
                <View style={[styles.checkbox, card.is_visible && styles.checkboxActive]}>
                  {card.is_visible && <Feather name="check" size={12} color="#fff" />}
                </View>
                <Text style={styles.selectorText}>{card.name}</Text>
              </Pressable>
            ))
          )}
        </View>

        <View style={styles.grid}>
          {loading ? (
            <Text style={styles.emptyState}>Loading trackers...</Text>
          ) : (
            <>
              {visibleCards.map((card) => {
                const streak = calculateStreak(card);
                const isEditing = editingId === card.id;
                const draft = editDrafts[card.id] ?? makeEditDraft(card);
                return (
                  <View key={card.id} style={styles.card}>
                    <View style={styles.cardTop}>
                      <View style={styles.cardTitleWrap}>
                        <Text style={styles.typePill}>{card.value_type === "boolean" ? "Binary" : "Numerical"}</Text>
                        <Text style={styles.cardTitle}>{card.name}</Text>
                      </View>
                      <View style={styles.cardTools}>
                        <Pressable style={styles.iconButton} onPress={() => startEditing(card)}>
                          <Feather name="edit-2" size={17} color={colors.ink} />
                        </Pressable>
                        <View style={styles.streak}>
                          <Feather name="zap" size={17} color={colors.orange} />
                          <Text style={styles.streakText}>{streak}</Text>
                        </View>
                      </View>
                    </View>

                    {isEditing ? (
                      <EditForm
                        draft={draft}
                        saving={savingId === card.id}
                        onChange={(nextDraft) => setEditDrafts((current) => ({ ...current, [card.id]: nextDraft }))}
                        onCancel={() => setEditingId(null)}
                        onSave={() => saveCard(card)}
                      />
                    ) : (
                      <>
                        <Text style={styles.target}>{card.target_days_per_week} days per week target</Text>
                        <TrackerGraph card={card} />
                        {card.value_type === "boolean" ? (
                          <View style={styles.actions}>
                            <Pressable style={styles.actionButton} onPress={() => logValue(card, 1)} disabled={savingId === card.id}>
                              <Feather name="check" size={20} color="#fff" />
                            </Pressable>
                            <Pressable style={styles.actionButton} onPress={() => logValue(card, 0)} disabled={savingId === card.id}>
                              <Feather name="x" size={20} color="#fff" />
                            </Pressable>
                          </View>
                        ) : (
                          <View style={styles.numericLog}>
                            <TextInput
                              value={numericDrafts[card.id] ?? ""}
                              onChangeText={(value) => setNumericDrafts((current) => ({ ...current, [card.id]: value }))}
                              placeholder="Add today"
                              placeholderTextColor="#6b7280"
                              keyboardType="numeric"
                              style={styles.numericInput}
                            />
                            <Pressable style={styles.numericButton} onPress={() => logValue(card, Number(numericDrafts[card.id]))} disabled={savingId === card.id || !numericDrafts[card.id]}>
                              <Text style={styles.numericButtonText}>Add</Text>
                            </Pressable>
                          </View>
                        )}
                      </>
                    )}
                  </View>
                );
              })}
              <Link href="/tracker/new" asChild>
                <Pressable style={styles.addCard}>
                  <Feather name="plus" size={42} color={colors.ink} />
                </Pressable>
              </Link>
            </>
          )}
        </View>
      </ScrollView>
    </PlainScreen>
  );
}

function TrackerGraph({ card }: { card: TrackerCard }) {
  const days = pastDays(7);
  const byDate = new Map(card.entries.map((entry) => [entry.date, entry.value]));

  if (card.value_type === "boolean") {
    return (
      <View style={styles.booleanGraph}>
        {days.map((date) => {
          const value = byDate.get(date) ?? 0;
          const label = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });
          return (
            <View key={date} style={styles.booleanDay}>
              <View style={value > 0 ? styles.booleanDone : styles.booleanMiss}>
                <Feather name={value > 0 ? "check" : "x"} size={19} color={value > 0 ? colors.green : "#64748b"} />
              </View>
              <Text style={styles.axisTiny}>{label}</Text>
            </View>
          );
        })}
      </View>
    );
  }

  const values = days.map((date) => byDate.get(date) ?? 0);
  const roundedMax = Math.max(1, Math.ceil(Math.max(1, ...values) / 5) * 5);
  return (
    <View style={styles.barGraph}>
      {days.map((date) => {
        const value = byDate.get(date) ?? 0;
        const label = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });
        return (
          <View key={date} style={styles.barDay}>
            <View style={styles.barSlot}>
              {!!value && <Text style={styles.barValue}>{value}</Text>}
              <View style={[styles.barFill, { height: `${Math.max(2, (value / roundedMax) * 100)}%` }]} />
            </View>
            <Text style={styles.axisTiny}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function EditForm({
  draft,
  onChange,
  onCancel,
  onSave,
  saving,
}: {
  draft: EditDraft;
  onChange: (draft: EditDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <View style={styles.editForm}>
      <EditField label="Name" value={draft.name} onChangeText={(name) => onChange({ ...draft, name })} />
      <View style={styles.editField}>
        <Text style={styles.editLabel}>Weekly target</Text>
        <View style={styles.daysRow}>
          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
            <Pressable key={day} style={[styles.dayChip, draft.target_days_per_week === day && styles.dayChipActive]} onPress={() => onChange({ ...draft, target_days_per_week: day })}>
              <Text style={[styles.dayChipText, draft.target_days_per_week === day && styles.dayChipTextActive]}>{day}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <EditField label="Description" value={draft.description} onChangeText={(description) => onChange({ ...draft, description })} multiline />
      <View style={styles.editActions}>
        <Pressable style={styles.editSecondary} onPress={onCancel}>
          <Text style={styles.editSecondaryText}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.editPrimary} onPress={onSave} disabled={saving || !draft.name.trim()}>
          <Text style={styles.editPrimaryText}>{saving ? "Saving..." : "Save"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function EditField(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.editField}>
      <Text style={styles.editLabel}>{props.label}</Text>
      <TextInput {...props} style={[styles.editInput, props.multiline && styles.editTextarea]} placeholderTextColor="#6b7280" />
    </View>
  );
}

const styles = StyleSheet.create({
  main: { padding: 16, gap: 16, paddingBottom: 32 },
  titleRow: { gap: 16 },
  titleCopy: { gap: 4 },
  title: { color: colors.ink, fontSize: 30, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  primaryAction: { minHeight: 40, borderRadius: 12, backgroundColor: colors.ink, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 14 },
  primaryActionText: { color: colors.panel, fontWeight: "700" },
  selector: { flexDirection: "row", flexWrap: "wrap", gap: 9, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel },
  selectorEmpty: { color: colors.muted },
  selectorItem: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 11, paddingVertical: 7 },
  selectorText: { color: colors.ink, fontSize: 13 },
  checkbox: { width: 16, height: 16, borderRadius: 4, borderWidth: 1, borderColor: "#9ca3af", alignItems: "center", justifyContent: "center" },
  checkboxActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  grid: { gap: 16 },
  emptyState: { minHeight: 140, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, color: colors.muted, textAlign: "center", textAlignVertical: "center", padding: 24 },
  card: { minHeight: 304, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 16, gap: 12, ...shadow },
  addCard: { minHeight: 120, backgroundColor: colors.panel, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  cardTitleWrap: { flex: 1 },
  typePill: { color: colors.blue, fontSize: 11, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  cardTitle: { marginTop: 6, color: colors.ink, fontSize: 19, fontWeight: "700" },
  cardTools: { flexDirection: "row", alignItems: "center", gap: 7 },
  iconButton: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  streak: { minWidth: 64, height: 36, borderRadius: 999, backgroundColor: colors.orangeSoft, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  streakText: { color: colors.orange, fontWeight: "800" },
  target: { color: colors.muted, fontSize: 14 },
  booleanGraph: { flexDirection: "row", gap: 6, minHeight: 96, alignItems: "flex-end" },
  booleanDay: { flex: 1, alignItems: "center", gap: 6 },
  booleanDone: { width: "100%", minHeight: 53, borderRadius: 10, backgroundColor: "#dcfce7", alignItems: "center", justifyContent: "center" },
  booleanMiss: { width: "100%", minHeight: 53, borderRadius: 10, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  axisTiny: { color: "#64748b", fontSize: 10 },
  barGraph: { flexDirection: "row", gap: 7, minHeight: 126, alignItems: "flex-end" },
  barDay: { flex: 1, alignItems: "center", gap: 6 },
  barSlot: { height: 100, width: "100%", justifyContent: "flex-end", alignItems: "stretch", borderBottomWidth: 1, borderBottomColor: colors.line },
  barFill: { minHeight: 2, borderTopLeftRadius: 8, borderTopRightRadius: 8, backgroundColor: colors.blue },
  barValue: { color: colors.ink, fontSize: 11, textAlign: "center" },
  actions: { flexDirection: "row", gap: 8, marginTop: "auto" },
  actionButton: { flex: 1, minHeight: 38, borderRadius: 10, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  numericLog: { flexDirection: "row", gap: 8, marginTop: "auto" },
  numericInput: { flex: 1, minHeight: 38, borderRadius: 10, borderWidth: 1, borderColor: "#d1d5db", paddingHorizontal: 12, color: colors.ink },
  numericButton: { minWidth: 86, minHeight: 38, borderRadius: 10, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  numericButtonText: { color: colors.panel, fontWeight: "800" },
  editForm: { gap: 11 },
  editField: { gap: 5 },
  editLabel: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  editInput: { minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: "#d1d5db", paddingHorizontal: 12, color: colors.ink },
  editTextarea: { minHeight: 88, paddingTop: 10, textAlignVertical: "top" },
  daysRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  dayChip: { width: 33, height: 33, borderRadius: 999, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  dayChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  dayChipText: { color: colors.ink, fontWeight: "700" },
  dayChipTextActive: { color: colors.panel },
  editActions: { flexDirection: "row", gap: 8 },
  editSecondary: { flex: 1, minHeight: 38, borderRadius: 10, borderWidth: 1, borderColor: "#d1d5db", alignItems: "center", justifyContent: "center" },
  editPrimary: { flex: 1, minHeight: 38, borderRadius: 10, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  editSecondaryText: { color: colors.ink, fontWeight: "800" },
  editPrimaryText: { color: colors.panel, fontWeight: "800" },
});
