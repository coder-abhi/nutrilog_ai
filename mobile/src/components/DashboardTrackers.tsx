import { Feather } from "@expo/vector-icons";
import { Link } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/auth/AuthContext";
import { API_BASE_URL } from "@/config/api";
import { colors, shadow } from "@/styles/theme";
import type { TrackerCard } from "@/types";
import { toYMD } from "@/utils/date";
import { calculateStreak } from "@/utils/streak";

const DOUBLE_TAP_MS = 300;

function pastDays(count: number) {
  const today = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (count - 1 - index));
    return toYMD(date);
  });
}

export function DashboardTrackers() {
  const { getAuthHeaders, signOut } = useAuth();
  const [cards, setCards] = useState<TrackerCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ cardId: string; date: string; original: number; draft: number } | null>(null);
  const lastTapRef = useRef<Record<string, number>>({});

  const fetchCards = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/tracker_cards`, { headers: { ...getAuthHeaders() } });
      if (res.status === 401) {
        await signOut();
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

  const visibleCards = useMemo(
    () =>
      cards
        .filter((card) => card.is_visible)
        .map((card) => ({ card, streak: calculateStreak(card) }))
        .sort((a, b) => b.streak - a.streak),
    [cards],
  );

  const postEntry = async (cardId: string, value: number, date: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/tracker_entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ tracker_id: cardId, value, date }),
      });
      if (res.status === 401) {
        await signOut();
        return;
      }
      if (res.ok) {
        fetchCards();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "Could not update tracker entry.");
      }
    } catch {
      setError("Could not update tracker entry.");
    }
  };

  const handleCellActivate = (cellKey: string, onActivate: () => void) => {
    const now = Date.now();
    const last = lastTapRef.current[cellKey] ?? 0;
    if (now - last < DOUBLE_TAP_MS) {
      lastTapRef.current[cellKey] = 0;
      onActivate();
    } else {
      lastTapRef.current[cellKey] = now;
    }
  };

  const adjustDraft = (delta: number) =>
    setEditor((current) => (current ? { ...current, draft: Math.max(0, current.draft + delta) } : current));

  const submitEditor = () => {
    if (!editor) return;
    if (editor.draft !== editor.original) {
      postEntry(editor.cardId, editor.draft - editor.original, editor.date);
    }
    setEditor(null);
  };

  if (loading) return null;
  if (visibleCards.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>
          Active trackers <Text style={styles.sectionHint}>(double tap or hold to edit)</Text>
        </Text>
        <Link href="/tracker" asChild>
          <Pressable>
            <Text style={styles.manageLink}>Manage</Text>
          </Pressable>
        </Link>
      </View>
      {!!error && <Text style={styles.errorState}>{error}</Text>}
      {visibleCards.map(({ card, streak }) => {
        const days = pastDays(7);
        const byDate = new Map(card.entries.map((entry) => [entry.date, entry.value]));
        return (
          <View key={card.id} style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>{card.name}</Text>
              <View style={styles.streak}>
                <Feather name="zap" size={12} color={colors.orange} />
                <Text style={styles.streakText}>{streak}</Text>
              </View>
            </View>
            <View style={styles.row}>
              {days.map((date) => {
                const value = byDate.get(date) ?? 0;
                const label = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1);
                const cellKey = `${card.id}-${date}`;
                const isEditing = editor?.cardId === card.id && editor?.date === date;

                if (card.value_type === "boolean") {
                  const toggle = () => postEntry(card.id, value > 0 ? 0 : 1, date);
                  return (
                    <View key={date} style={styles.dayCol}>
                      <Pressable
                        style={[styles.boolCell, value > 0 ? styles.boolCellDone : styles.boolCellMiss]}
                        onPress={() => handleCellActivate(cellKey, toggle)}
                        onLongPress={toggle}
                        accessibilityRole="button"
                        accessibilityLabel={`${card.name} on ${date}, ${value > 0 ? "done" : "not done"}`}
                      >
                        <Feather name={value > 0 ? "check" : "x"} size={13} color={value > 0 ? colors.green : "#94a3b8"} />
                      </Pressable>
                      <Text style={styles.dayLabel}>{label}</Text>
                    </View>
                  );
                }

                const shownValue = isEditing && editor ? editor.draft : value;
                const openEditor = () => setEditor({ cardId: card.id, date, original: value, draft: value });

                return (
                  <View key={date} style={styles.dayCol}>
                    <Pressable
                      style={[styles.numCell, isEditing && styles.numCellEditing]}
                      onPress={() => handleCellActivate(cellKey, openEditor)}
                      onLongPress={openEditor}
                      accessibilityRole="button"
                      accessibilityLabel={`${card.name} on ${date}, value ${shownValue}`}
                    >
                      <Text style={styles.numCellText}>{shownValue}</Text>
                    </Pressable>
                    <Text style={styles.dayLabel}>{label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}

      <Modal visible={!!editor} transparent animationType="fade" onRequestClose={submitEditor}>
        <Pressable style={styles.editorBackdrop} onPress={submitEditor}>
          <Pressable style={styles.editorCard} onPress={() => {}}>
            <Pressable
              style={styles.editorStep}
              onPress={() => adjustDraft(-1)}
              accessibilityRole="button"
              accessibilityLabel="Decrease value"
            >
              <Text style={styles.editorStepText}>−</Text>
            </Pressable>
            <View style={styles.editorValueWrap}>
              <Text style={styles.editorValue}>{editor?.draft ?? 0}</Text>
              <Text style={styles.editorHint}>tap outside to save</Text>
            </View>
            <Pressable
              style={styles.editorStep}
              onPress={() => adjustDraft(1)}
              accessibilityRole="button"
              accessibilityLabel="Increase value"
            >
              <Text style={styles.editorStepText}>+</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "700" },
  sectionHint: { color: colors.quiet, fontSize: 12, fontWeight: "500" },
  manageLink: { color: colors.blue, fontSize: 13, fontWeight: "600" },
  errorState: { borderRadius: 10, backgroundColor: colors.redSoft, color: colors.red, padding: 10, fontSize: 12, fontWeight: "700" },
  card: { backgroundColor: colors.panel, borderRadius: 14, padding: 12, gap: 8, ...shadow },
  cardTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  cardTitle: { color: colors.ink, fontSize: 14, fontWeight: "700", flexShrink: 1 },
  streak: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 999,
    backgroundColor: colors.orangeSoft,
  },
  streakText: { color: colors.orange, fontSize: 12, fontWeight: "800" },
  row: { flexDirection: "row", gap: 6 },
  dayCol: { flex: 1, alignItems: "center", gap: 4 },
  dayLabel: { color: colors.quiet, fontSize: 10 },
  boolCell: { width: "100%", height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  boolCellDone: { backgroundColor: "#dcfce7" },
  boolCellMiss: { backgroundColor: "#f1f5f9" },
  numCell: { width: "100%", height: 30, borderRadius: 8, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  numCellEditing: { borderWidth: 2, borderColor: colors.blue, backgroundColor: colors.blueSoft },
  numCellText: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  editorBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  editorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    backgroundColor: colors.panel,
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingVertical: 20,
    ...shadow,
  },
  editorStep: {
    width: 54,
    height: 54,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.blue,
  },
  editorStepText: { color: "#fff", fontSize: 26, fontWeight: "800" },
  editorValueWrap: { minWidth: 76, alignItems: "center", gap: 3 },
  editorValue: { color: colors.ink, fontSize: 32, fontWeight: "800" },
  editorHint: { color: colors.quiet, fontSize: 10 },
});
