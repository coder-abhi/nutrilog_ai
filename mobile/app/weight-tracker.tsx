import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";

import { useAuth } from "@/auth/AuthContext";
import { AuthGate } from "@/components/AuthGate";
import { Header } from "@/components/Header";
import { GradientScreen } from "@/components/Screen";
import { Segmented } from "@/components/Segmented";
import { SignedOutError, useApi } from "@/hooks/useApi";
import { colors, formErrorText, shadow } from "@/styles/theme";
import { evenXPosition, normalizeToPercent } from "@/utils/chart";
import { formatEntryDate, formatMonthShort, toYMD } from "@/utils/date";
import { validatePositiveNumber } from "@/utils/validation";

type WeightEntry = { value_kg: number; recorded_at: string | null };
type RangeKey = "year" | "all";

const ranges: { value: RangeKey; label: string; days?: number }[] = [
  { value: "year", label: "Year", days: 365 },
  { value: "all", label: "All time" },
];

export default function WeightTrackerPage() {
  return (
    <AuthGate>
      <WeightTrackerContent />
    </AuthGate>
  );
}

function WeightTrackerContent() {
  const { user } = useAuth();
  const { authedFetch } = useApi();
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [logWeightValue, setLogWeightValue] = useState("");
  const [logWeightDate, setLogWeightDate] = useState(() => toYMD(new Date()));
  const [viewRange, setViewRange] = useState<RangeKey>("year");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchWeights = useCallback(async () => {
    if (!user?.username) return;
    setLoadError(null);
    try {
      const data = await authedFetch<WeightEntry[]>("/weight_entries", {
        fallbackErrorMessage: "Could not load weight entries.",
      });
      setEntries(data);
    } catch (err) {
      if (err instanceof SignedOutError) return;
      setEntries([]);
      setLoadError(err instanceof Error ? err.message : "Could not load weight entries.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, user?.username]);

  useEffect(() => {
    fetchWeights();
  }, [fetchWeights]);

  const normalized = useMemo(
    () =>
      entries
        .map((entry, index) => {
          const time = entry.recorded_at ? new Date(entry.recorded_at).getTime() : Number.NaN;
          return { ...entry, sortTime: Number.isNaN(time) ? index : time, hasDate: !Number.isNaN(time) };
        })
        .sort((a, b) => a.sortTime - b.sortTime),
    [entries],
  );
  const visible = useMemo(() => {
    const range = ranges.find((item) => item.value === viewRange);
    if (!range?.days) return normalized;
    const cutoff = Date.now() - range.days * 86400000;
    return normalized.filter((entry) => entry.hasDate && entry.sortTime >= cutoff);
  }, [normalized, viewRange]);

  const latest = normalized[normalized.length - 1];
  const currentWeightKg = latest?.value_kg ?? user?.weight_kg ?? 0;
  const targetWeightKg = user?.target_weight_kg && user.target_weight_kg > 0 ? user.target_weight_kg : Math.max(0, currentWeightKg - 5);
  const values = visible.map((entry) => entry.value_kg);
  const max = values.length ? Math.max(...values) + 5 : currentWeightKg + 5;
  const min = values.length ? Math.max(0, Math.min(...values) - 5) : Math.max(0, currentWeightKg - 5);
  const points = visible
    .map((entry, index) => `${evenXPosition(index, visible.length)},${100 - normalizeToPercent(entry.value_kg, min, max)}`)
    .join(" ");
  const targetY = 100 - normalizeToPercent(targetWeightKg, min, max);

  const xTicks = useMemo(() => {
    if (visible.length === 0) return [];
    const tickCount = Math.min(6, visible.length);
    const seen = new Set<number>();
    const ticks: { pct: number; label: string }[] = [];
    for (let i = 0; i < tickCount; i++) {
      const idx = tickCount === 1 ? visible.length - 1 : Math.round((i * (visible.length - 1)) / (tickCount - 1));
      if (seen.has(idx)) continue;
      seen.add(idx);
      const entry = visible[idx];
      if (!entry.hasDate) continue;
      const pct = evenXPosition(idx, visible.length);
      ticks.push({ pct, label: formatMonthShort(entry.sortTime) });
    }
    return ticks;
  }, [visible]);

  const logWeight = async () => {
    const validationError = validatePositiveNumber(logWeightValue, "weight (kg)");
    if (validationError) {
      setError(validationError);
      return;
    }
    const value = Number(logWeightValue);
    setSubmitting(true);
    setError(null);
    try {
      await authedFetch("/weight_entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value_kg: value, recorded_at: logWeightDate || undefined }),
        fallbackErrorMessage: "Failed to log weight.",
      });
      setLogWeightValue("");
      setLogWeightDate(toYMD(new Date()));
      fetchWeights();
    } catch (err) {
      if (err instanceof SignedOutError) return;
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GradientScreen>
      <Header />
      <ScrollView contentContainerStyle={styles.main} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Crush Your Weight Goals</Text>
          <Text style={styles.heroSubtitle}>Visualize your progress and stay on track with a clean, simple weight tracker.</Text>
        </View>
        <View style={styles.summaryRow}>
          <Summary label="Current Weight" value={loading ? "..." : `${currentWeightKg.toFixed(1)} kg`} />
          <Summary label="Target Weight" value={`${targetWeightKg.toFixed(1)} kg`} />
        </View>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Log weight</Text>
          <View style={styles.formRow}>
            <Field label="Weight (kg)" value={logWeightValue} onChangeText={setLogWeightValue} placeholder="e.g. 70" keyboardType="decimal-pad" />
            <Field label="Date" value={logWeightDate} onChangeText={setLogWeightDate} placeholder="YYYY-MM-DD" />
            <Pressable style={styles.button} onPress={logWeight} disabled={submitting}>
              <Text style={styles.buttonText}>{submitting ? "..." : "Log weight"}</Text>
            </Pressable>
          </View>
          {!!error && <Text style={styles.error}>{error}</Text>}
        </View>
        <View style={styles.card}>
          <View style={styles.chartHeader}>
            <Text style={styles.sectionTitle}>Weight Tracker</Text>
            <Segmented value={viewRange} onChange={setViewRange} options={ranges.map(({ value, label }) => ({ value, label }))} />
          </View>
          {visible.length ? (
            <View style={styles.chartGrid}>
              <View style={styles.yAxis}>
                {[max, (max + min) / 2, min].map((label, index) => (
                  <Text key={index} style={styles.axisText}>
                    {label.toFixed(1)} kg
                  </Text>
                ))}
              </View>
              <View style={styles.plotWrap}>
                <View style={styles.plot}>
                  <Svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none">
                    {targetY >= 0 && targetY <= 100 && <Line x1="0" x2="100" y1={targetY} y2={targetY} stroke="#22c55e" strokeWidth="0.6" strokeDasharray="2 2" />}
                    <Polyline points={points} fill="none" stroke={colors.blue} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    {visible.map((entry, index) => (
                      <Circle
                        key={`${entry.recorded_at ?? "point"}-${index}`}
                        cx={evenXPosition(index, visible.length)}
                        cy={100 - normalizeToPercent(entry.value_kg, min, max)}
                        r="1.5"
                        fill={colors.blue}
                        stroke="#fff"
                        strokeWidth="0.8"
                      />
                    ))}
                  </Svg>
                </View>
                <View style={styles.xAxis}>
                  {xTicks.map((tick, index) => (
                    <Text key={index} style={[styles.axisText, styles.xAxisLabel, { left: `${tick.pct}%` }]}>
                      {tick.label}
                    </Text>
                  ))}
                </View>
              </View>
            </View>
          ) : (
            <Text style={styles.emptyChart}>No entries in this range yet.</Text>
          )}
        </View>
        <View style={styles.entriesSection}>
          <Text style={styles.sectionTitle}>Weight entries</Text>
          {loading ? (
            <Text style={styles.meta}>Loading...</Text>
          ) : loadError ? (
            <Text style={styles.meta} accessibilityRole="alert">{loadError}</Text>
          ) : entries.length === 0 ? (
            <Text style={styles.meta}>No weight entries yet. Your profile weight ({user?.weight_kg ?? "-"} kg) is used until you add entries via the API.</Text>
          ) : (
            entries.map((entry, i) => (
              <View key={`${entry.recorded_at ?? "na"}-${i}`} style={styles.entryRow}>
                <Text style={styles.entryWeight}>{entry.value_kg.toFixed(1)} kg</Text>
                <Text style={styles.meta}>{formatEntryDate(entry.recorded_at)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </GradientScreen>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput {...props} style={styles.input} placeholderTextColor="#6b7280" />
    </View>
  );
}

const styles = StyleSheet.create({
  main: { padding: 16, gap: 16, paddingBottom: 32 },
  hero: { gap: 4 },
  heroTitle: { color: colors.ink, fontSize: 30, fontWeight: "800" },
  heroSubtitle: { color: "#1f2937", fontSize: 15, lineHeight: 21 },
  summaryRow: { gap: 16 },
  summaryCard: { backgroundColor: colors.panel, borderRadius: 16, padding: 18, ...shadow },
  summaryLabel: { color: colors.inkSoft, fontSize: 12, letterSpacing: 0.9, textTransform: "uppercase", fontWeight: "700" },
  summaryValue: { color: "#0b1120", fontSize: 27, fontWeight: "700", marginTop: 6 },
  card: { backgroundColor: colors.panel, borderRadius: 18, padding: 16, gap: 12, ...shadow },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  formRow: { gap: 12 },
  field: { gap: 4 },
  fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  input: { minHeight: 43, borderRadius: 8, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, color: colors.ink, fontSize: 16 },
  button: { alignSelf: "flex-start", borderRadius: 8, backgroundColor: colors.ink, paddingHorizontal: 16, paddingVertical: 10 },
  buttonText: { color: "#f9fafb", fontWeight: "600" },
  error: formErrorText,
  chartHeader: { gap: 12, alignItems: "flex-start" },
  chartGrid: { height: 240, flexDirection: "row", gap: 10 },
  yAxis: { justifyContent: "space-between", paddingVertical: 2 },
  axisText: { color: colors.muted, fontSize: 11 },
  plotWrap: { flex: 1 },
  plot: { flex: 1, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: colors.line, backgroundColor: "#f8fafc" },
  xAxis: { height: 18, marginTop: 4 },
  xAxisLabel: { position: "absolute", top: 0, transform: [{ translateX: -14 }] },
  emptyChart: { overflow: "hidden", borderRadius: 14, borderWidth: 1, borderStyle: "dashed", borderColor: "#d1d5db", padding: 24, color: colors.muted, textAlign: "center" },
  entriesSection: { gap: 8 },
  entryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.line },
  entryWeight: { color: "#0b1120", fontWeight: "600" },
  meta: { color: colors.inkSoft, fontSize: 14 },
});
