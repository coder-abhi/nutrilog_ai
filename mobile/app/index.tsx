import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { useAuth } from "@/auth/AuthContext";
import { AuthGate } from "@/components/AuthGate";
import { BottomLogInput } from "@/components/BottomLogInput";
import { Header } from "@/components/Header";
import { GradientScreen } from "@/components/Screen";
import { Segmented } from "@/components/Segmented";
import { API_BASE_URL } from "@/config/api";
import { colors, shadow } from "@/styles/theme";
import type { ActivityEntry, FoodEntry, SummaryData } from "@/types";
import { formatDisplayDate, formatHour, toYMD } from "@/utils/date";

type LogEntry = (FoodEntry & { kind: "food" }) | (ActivityEntry & { kind: "activity" });
type DashboardRange = "today" | "week" | "month";
type InsulinCurve = { timestamp: string | null; points: { minute: number; value: number }[] };

const emptySummary: SummaryData = {
  calories_intake: 0,
  calories_burned: 0,
  protein: 0,
  carbs: 0,
  fibre: 0,
  sugar: 0,
};

function buildSmoothPath(points: { x: number; y: number }[]) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  return (
    points.reduce((path, point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      const prev = points[index - 1];
      const midX = (prev.x + point.x) / 2;
      const midY = (prev.y + point.y) / 2;
      return `${path} Q ${prev.x} ${prev.y} ${midX} ${midY}`;
    }, "") + ` T ${points[points.length - 1].x} ${points[points.length - 1].y}`
  );
}

export default function DashboardPage() {
  return (
    <AuthGate>
      <DashboardContent />
    </AuthGate>
  );
}

function DashboardContent() {
  const { user, signOut, getAuthHeaders } = useAuth();
  const [summaryData, setSummaryData] = useState<SummaryData>(emptySummary);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [insulinCurves, setInsulinCurves] = useState<InsulinCurve[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => toYMD(new Date()));
  const [dashboardRange, setDashboardRange] = useState<DashboardRange>("today");
  const [passiveCalorie, setPassiveCalorie] = useState(0);

  const selectedRangeDays = dashboardRange === "today" ? 1 : dashboardRange === "week" ? 7 : 30;

  const fetchSummaryForDate = useCallback(
    async (date: string) => {
      if (!user?.username) return null;
      const res = await fetch(`${API_BASE_URL}/today_summary?date=${date}`, { headers: { ...getAuthHeaders() } });
      if (res.status === 401) {
        await signOut();
        return null;
      }
      if (!res.ok) return null;
      return res.json();
    },
    [getAuthHeaders, signOut, user?.username],
  );

  const fetchDashboardSummary = useCallback(async () => {
    if (!user?.username) return;
    setLoading(true);
    try {
      const end = new Date(`${selectedDate}T00:00:00`);
      const dates = Array.from({ length: selectedRangeDays }, (_, index) => {
        const date = new Date(end);
        date.setDate(end.getDate() - (selectedRangeDays - 1 - index));
        return toYMD(date);
      });
      const summaries = await Promise.all(dates.map((date) => fetchSummaryForDate(date)));
      setSummaryData(
        summaries.reduce<SummaryData>((acc, item) => {
          const summary = item?.summary ?? {};
          return {
            calories_intake: acc.calories_intake + (summary.calories_intake ?? 0),
            calories_burned: acc.calories_burned + (summary.calories_burned ?? 0),
            protein: acc.protein + (summary.protein ?? 0),
            carbs: acc.carbs + (summary.carbs ?? 0),
            fibre: acc.fibre + (summary.fibre ?? 0),
            sugar: acc.sugar + (summary.sugar ?? 0),
          };
        }, { ...emptySummary }),
      );
      setEntries(
        summaries
          .flatMap((item) => [
            ...((item?.foods ?? []).map((entry: FoodEntry) => ({ ...entry, kind: "food" as const }))),
            ...((item?.activities ?? []).map((entry: ActivityEntry) => ({ ...entry, kind: "activity" as const }))),
          ])
          .sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime()),
      );
      setInsulinCurves(summaries.flatMap((item) => item?.insulin_curves ?? []));
    } catch {
      setSummaryData(emptySummary);
      setEntries([]);
      setInsulinCurves([]);
    } finally {
      setLoading(false);
    }
  }, [fetchSummaryForDate, selectedDate, selectedRangeDays, user?.username]);

  const fetchPassiveCalorie = useCallback(async () => {
    if (!user?.username) return;
    const res = await fetch(`${API_BASE_URL}/passive_calorie_burned`, { headers: { ...getAuthHeaders() } });
    if (res.status === 401) {
      await signOut();
      return;
    }
    if (res.ok) setPassiveCalorie((await res.json()) ?? 0);
  }, [getAuthHeaders, signOut, user?.username]);

  useEffect(() => {
    fetchDashboardSummary();
    fetchPassiveCalorie();
  }, [fetchDashboardSummary, fetchPassiveCalorie]);

  const insulinChart = useMemo(() => {
    const contributions = new Map<number, number>();
    const keyMinutes = new Set<number>([0, 360, 720, 1080, 1439]);
    insulinCurves.forEach((curve) => {
      if (!curve.timestamp) return;
      const logDate = new Date(curve.timestamp);
      const baseMinute = logDate.getHours() * 60 + logDate.getMinutes();
      curve.points.forEach((point) => {
        const absoluteMinute = baseMinute + point.minute;
        if (absoluteMinute < 0 || absoluteMinute > 1439) return;
        keyMinutes.add(absoluteMinute);
        contributions.set(absoluteMinute, (contributions.get(absoluteMinute) ?? 0) + Math.max(0, point.value - 8));
      });
    });
    const series = Array.from(keyMinutes)
      .sort((a, b) => a - b)
      .map((minute) => ({ minute, value: Math.min(100, 8 + (contributions.get(minute) ?? 0)) }));
    const maxValue = Math.max(20, ...series.map((point) => point.value));
    const points = series.map((point) => ({ x: (point.minute / 1439) * 100, y: 100 - (point.value / maxValue) * 100 }));
    const path = buildSmoothPath(points);
    return {
      path,
      areaPath: path ? `${path} L 100 100 L 0 100 Z` : "",
      maxValue,
      peak: Math.max(...series.map((point) => point.value)),
      hasData: insulinCurves.some((curve) => curve.points.length > 0),
    };
  }, [insulinCurves]);

  const sugarLimit = 25 * selectedRangeDays;
  const passiveCaloriesForRange = Math.round(passiveCalorie * selectedRangeDays);
  const netCalories = summaryData.calories_intake - summaryData.calories_burned - passiveCaloriesForRange;
  const rangeLabel = dashboardRange === "today" ? "Selected day" : dashboardRange === "week" ? "Last 7 days" : "Last 30 days";
  const sugarExceeded = summaryData.sugar > sugarLimit;

  return (
    <GradientScreen>
      <Header />
      <ScrollView contentContainerStyle={styles.main} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Simple &amp; Easy Calorie Tracking</Text>
          <Text style={styles.heroSubtitle}>Track your meals, macros, and progress in one clean dashboard.</Text>
        </View>

        <View style={styles.topBar}>
          <View style={styles.datePill}>
            <Text style={styles.dateText}>{formatDisplayDate(selectedDate)}</Text>
            <TextInput value={selectedDate} onChangeText={setSelectedDate} style={styles.dateInput} placeholder="YYYY-MM-DD" />
          </View>
          <Segmented
            value={dashboardRange}
            onChange={setDashboardRange}
            options={[
              { value: "today", label: "Today" },
              { value: "week", label: "Week" },
              { value: "month", label: "Month" },
            ]}
          />
          <Text style={styles.rangeHint}>{rangeLabel}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Net calories</Text>
          <Text style={styles.cardNumber}>{netCalories}</Text>
          <View style={styles.macrosRow}>
            <Macro label="Food intake" value={`${summaryData.calories_intake} kcal`} />
            <Macro label="Resting flame" value={`${passiveCaloriesForRange} kcal`} />
            <Macro label="Active burn" value={`${summaryData.calories_burned} kcal`} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Macros</Text>
          <View style={styles.macrosRow}>
            <Macro label="Carbs" value={`${summaryData.carbs} g`} />
            <Macro label="Protein" value={`${summaryData.protein} g`} />
            <Macro label="Fibre" value={`${summaryData.fibre} g`} />
          </View>
          <View style={[styles.sugar, sugarExceeded ? styles.sugarBad : styles.sugarGood]}>
            <Text style={[styles.sugarText, sugarExceeded ? styles.sugarBadText : styles.sugarGoodText]}>Sugar</Text>
            <Text style={[styles.sugarStrong, sugarExceeded ? styles.sugarBadText : styles.sugarGoodText]}>
              {summaryData.sugar} g / {sugarLimit} g{sugarExceeded ? " over" : ""}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Calories Burned</Text>
          <View style={styles.macrosRow}>
            <Macro label="Resting Flame" value={`${passiveCaloriesForRange} kcal`} />
            <Macro label="Active Burn" value={`${summaryData.calories_burned} kcal`} />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardLabel}>Postprandial insulin</Text>
            <Text style={styles.chartPeak}>Peak {Math.round(insulinChart.peak)}</Text>
          </View>
          <View style={styles.chartRow}>
            <View style={styles.yAxis}>
              <Text style={styles.axisText}>{Math.round(insulinChart.maxValue)}</Text>
              <Text style={styles.axisText}>0</Text>
            </View>
            <View style={styles.plot}>
              <Svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%">
                <Path d={insulinChart.areaPath} fill="rgba(37,99,235,0.12)" />
                <Path d={insulinChart.path} fill="none" stroke={colors.blue} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
          </View>
          <View style={styles.xAxis}>
            {[0, 360, 720, 1080, 1439].map((minute) => (
              <Text key={minute} style={styles.axisText}>
                {formatHour(minute)}
              </Text>
            ))}
          </View>
          {!insulinChart.hasData && <Text style={styles.chartEmptyHint}>Log a meal to see the response curve.</Text>}
        </View>

        <View style={styles.entriesSection}>
          <Text style={styles.sectionTitle}>{rangeLabel} log</Text>
          <Text style={styles.sectionHint}>Use the input at the bottom to quickly log meals or exercise.</Text>
          {loading ? (
            <Text style={styles.placeholderCard}>Loading data...</Text>
          ) : entries.length === 0 ? (
            <Text style={styles.placeholderCard}>No entries yet. Log meals or exercise below to see them here.</Text>
          ) : (
            entries.map((entry, i) => (
              <View key={`${entry.kind}-${entry.timestamp ?? i}`} style={[styles.foodItem, entry.kind === "activity" ? styles.activityItem : styles.foodLogItem]}>
                <Text style={styles.entryType}>{entry.kind === "activity" ? "Exercise" : "Food"}</Text>
                <Text style={styles.foodName}>{entry.kind === "activity" ? entry.type : entry.name}</Text>
                <Text style={styles.foodQty}>
                  {entry.quantity} {entry.unit}
                </Text>
                <Text style={styles.foodMacros}>
                  {entry.kind === "activity"
                    ? `${entry.calories_burned} kcal burned`
                    : `${entry.calories} kcal · P ${entry.protein}g · C ${entry.carbs}g · F ${entry.fat}g`}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
      <BottomLogInput
        logDate={selectedDate}
        onLogged={(data) => {
          setSummaryData((prev) => ({
            ...prev,
            calories_intake: data.calories_intake ?? prev.calories_intake,
            calories_burned: data.calories_burned ?? prev.calories_burned,
            protein: data.protein ?? prev.protein,
            carbs: data.carbs ?? prev.carbs,
            fibre: data.fibre ?? prev.fibre,
            sugar: data.sugar ?? prev.sugar,
          }));
          fetchDashboardSummary();
        }}
      />
    </GradientScreen>
  );
}

function Macro({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.macroChip}>
      <Text style={styles.macroLabel}>{label}</Text>
      <Text style={styles.macroValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  main: {
    padding: 16,
    paddingBottom: 180,
    gap: 16,
  },
  hero: {
    gap: 4,
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: "800",
  },
  heroSubtitle: {
    color: colors.inkSoft,
    fontSize: 15,
  },
  topBar: {
    alignItems: "flex-start",
    gap: 12,
  },
  datePill: {
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    borderRadius: 999,
    backgroundColor: colors.panel,
    paddingHorizontal: 15,
    paddingVertical: 8,
    gap: 4,
  },
  dateText: {
    color: colors.ink,
    fontSize: 13,
  },
  dateInput: {
    color: colors.muted,
    minWidth: 110,
    padding: 0,
    fontSize: 12,
  },
  rangeHint: {
    color: colors.muted,
    fontSize: 13,
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    ...shadow,
  },
  cardLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  cardNumber: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: "700",
  },
  macrosRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  macroChip: {
    flexGrow: 1,
    flexBasis: "47%",
    minWidth: 120,
    borderRadius: 12,
    backgroundColor: "#f3f4ff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  macroLabel: {
    color: colors.muted,
    fontSize: 12,
  },
  macroValue: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  sugar: {
    marginTop: 4,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sugarGood: {
    backgroundColor: colors.greenSoft,
  },
  sugarBad: {
    backgroundColor: colors.redSoft,
  },
  sugarText: {
    fontSize: 12,
  },
  sugarStrong: {
    fontSize: 12,
    fontWeight: "700",
  },
  sugarGoodText: {
    color: colors.green,
  },
  sugarBadText: {
    color: colors.red,
  },
  cardHeaderRow: {
    gap: 4,
  },
  chartPeak: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "700",
  },
  chartRow: {
    flexDirection: "row",
    gap: 9,
    height: 132,
  },
  yAxis: {
    justifyContent: "space-between",
  },
  plot: {
    flex: 1,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#f8fafc",
  },
  xAxis: {
    marginLeft: 24,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  axisText: {
    color: colors.quiet,
    fontSize: 10,
  },
  chartEmptyHint: {
    borderRadius: 11,
    backgroundColor: "#f8fafc",
    color: colors.muted,
    padding: 8,
    fontSize: 12,
  },
  entriesSection: {
    gap: 8,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "700",
  },
  sectionHint: {
    color: colors.muted,
    fontSize: 13,
  },
  placeholderCard: {
    overflow: "hidden",
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#d1d5db",
    backgroundColor: colors.panel,
    color: colors.inkSoft,
    padding: 16,
    fontSize: 14,
  },
  foodItem: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 5,
  },
  foodLogItem: {
    backgroundColor: colors.softBlue,
    borderColor: colors.blueSoft,
  },
  activityItem: {
    backgroundColor: "#f7fdf9",
    borderColor: "#bbf7d0",
  },
  entryType: {
    alignSelf: "flex-start",
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "rgba(17,24,39,0.06)",
    color: colors.inkSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: "700",
  },
  foodName: {
    color: colors.ink,
    fontWeight: "600",
  },
  foodQty: {
    color: colors.muted,
    fontSize: 14,
  },
  foodMacros: {
    color: colors.quiet,
    fontSize: 13,
  },
});
