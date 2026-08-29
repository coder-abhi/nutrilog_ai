import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { useAuth } from "@/auth/AuthContext";
import { AuthGate } from "@/components/AuthGate";
import { BottomLogInput } from "@/components/BottomLogInput";
import { DashboardTrackers } from "@/components/DashboardTrackers";
import { Header } from "@/components/Header";
import { GradientScreen } from "@/components/Screen";
import { Segmented } from "@/components/Segmented";
import { SignedOutError, useApi } from "@/hooks/useApi";
import { colors, shadow } from "@/styles/theme";
import type { SummaryData } from "@/types";
import { ApiError } from "@/utils/apiClient";
import { getCached, setCached } from "@/utils/cache";
import { normalizeToPercent } from "@/utils/chart";
import { INSULIN_CURVES_CACHE_KEY, PASSIVE_CALORIE_CACHE_KEY, dashboardSummaryCacheKey } from "@/utils/cacheKeys";
import { formatDisplayDate, toYMD } from "@/utils/date";

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

export default function DashboardPage() {
  return (
    <AuthGate>
      <DashboardContent />
    </AuthGate>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const { authedFetch } = useApi();
  const [summaryData, setSummaryData] = useState<SummaryData>(emptySummary);
  const [insulinCurves, setInsulinCurves] = useState<InsulinCurve[]>([]);
  const [selectedDate] = useState(() => toYMD(new Date()));
  const [dashboardRange, setDashboardRange] = useState<DashboardRange>("today");
  const [passiveCalorie, setPassiveCalorie] = useState(0);

  const selectedRangeDays = dashboardRange === "today" ? 1 : dashboardRange === "week" ? 7 : 30;

  const fetchSummaryForRange = useCallback(
    async (date: string, days: number) => {
      if (!user?.username) return null;
      return authedFetch<{ summary: SummaryData }>(`/today_summary?date=${date}&days=${days}`, {
        fallbackErrorMessage: "Could not load dashboard data.",
      });
    },
    [authedFetch, user?.username],
  );

  const fetchDashboardSummary = useCallback(async () => {
    if (!user?.username) return;
    try {
      const result = await fetchSummaryForRange(selectedDate, selectedRangeDays);
      if (!result) return;
      setSummaryData({ ...emptySummary, ...result.summary });
      setCached(dashboardSummaryCacheKey(selectedDate, selectedRangeDays), result.summary);
    } catch (err) {
      if (err instanceof SignedOutError) return;
      setSummaryData(emptySummary);
    }
  }, [fetchSummaryForRange, selectedDate, selectedRangeDays, user?.username]);

  const fetchPassiveCalorie = useCallback(async () => {
    if (!user?.username) return;
    try {
      const value = await authedFetch<number>("/passive_calorie_burned");
      setPassiveCalorie(value ?? 0);
      setCached(PASSIVE_CALORIE_CACHE_KEY, value ?? 0);
    } catch (err) {
      if (err instanceof SignedOutError || err instanceof ApiError) return;
      setPassiveCalorie(0);
    }
  }, [authedFetch, user?.username]);

  // The insulin graph always shows a rolling last-24-hours window, independent of the
  // today/week/month range picker above. Fetching 2 calendar days (today + yesterday)
  // guarantees full 24h coverage even right after midnight, when "today" alone would miss
  // most of the window.
  const fetchInsulinCurves = useCallback(async () => {
    if (!user?.username) return;
    try {
      const result = await authedFetch<{ insulin_curves: InsulinCurve[] }>(
        `/today_summary?date=${toYMD(new Date())}&days=2`,
        { fallbackErrorMessage: "Could not load insulin data." },
      );
      const curves = result?.insulin_curves ?? [];
      setInsulinCurves(curves);
      setCached(INSULIN_CURVES_CACHE_KEY, curves);
    } catch (err) {
      if (err instanceof SignedOutError) return;
      setInsulinCurves([]);
    }
  }, [authedFetch, user?.username]);

  // Paint the last cached response immediately (returning users see data with no delay,
  // even if the backend is cold-starting), then refresh from the network in the background.
  useEffect(() => {
    let active = true;
    (async () => {
      const cached = await getCached<SummaryData>(dashboardSummaryCacheKey(selectedDate, selectedRangeDays));
      if (cached && active) setSummaryData({ ...emptySummary, ...cached });
      fetchDashboardSummary();
    })();
    return () => {
      active = false;
    };
  }, [fetchDashboardSummary, selectedDate, selectedRangeDays]);

  useEffect(() => {
    let active = true;
    (async () => {
      const cached = await getCached<number>(PASSIVE_CALORIE_CACHE_KEY);
      if (cached != null && active) setPassiveCalorie(cached);
      fetchPassiveCalorie();
    })();
    return () => {
      active = false;
    };
  }, [fetchPassiveCalorie]);

  useEffect(() => {
    let active = true;
    (async () => {
      const cached = await getCached<InsulinCurve[]>(INSULIN_CURVES_CACHE_KEY);
      if (cached && active) setInsulinCurves(cached);
      fetchInsulinCurves();
    })();
    return () => {
      active = false;
    };
  }, [fetchInsulinCurves]);

  const insulinChart = useMemo(() => {
    // Rolling last-24-hours window ending now, expressed as minutes-since-window-start (0-1440)
    // so every point (which may fall on either of the two fetched calendar days) lands on one axis.
    const windowEnd = Date.now();
    const windowStart = windowEnd - 24 * 60 * 60 * 1000;
    const WINDOW_MINUTES = 24 * 60;
    const contributions = new Map<number, number>();
    const keyMinutes = new Set<number>([0, 360, 720, 1080, WINDOW_MINUTES]);
    insulinCurves.forEach((curve) => {
      if (!curve.timestamp) return;
      const logTime = new Date(curve.timestamp).getTime();
      curve.points.forEach((point) => {
        const absoluteMs = logTime + point.minute * 60000;
        if (absoluteMs < windowStart || absoluteMs > windowEnd) return;
        const minute = Math.round((absoluteMs - windowStart) / 60000);
        keyMinutes.add(minute);
        contributions.set(minute, (contributions.get(minute) ?? 0) + Math.max(0, point.value - 8));
      });
    });
    const series = Array.from(keyMinutes)
      .sort((a, b) => a - b)
      .map((minute) => ({ minute, value: Math.min(100, 8 + (contributions.get(minute) ?? 0)) }));
    const maxValue = Math.max(20, ...series.map((point) => point.value));
    // Insulin sits near the baseline (8) at rest; treat small deviations as "back to normal".
    const NORMAL_MAX = 14;
    const points = series.map((point) => ({
      x: normalizeToPercent(point.minute, 0, WINDOW_MINUTES),
      y: 100 - normalizeToPercent(point.value, 0, maxValue),
      normal: point.value <= NORMAL_MAX,
    }));
    const segments: { d: string; normal: boolean }[] = [];
    let normalMinutes = 0;
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      const normal = a.normal && b.normal;
      segments.push({ d: `M ${a.x} ${a.y} L ${b.x} ${b.y}`, normal });
      if (normal) normalMinutes += series[i + 1].minute - series[i].minute;
    }
    const totalMinutes = series.length > 1 ? series[series.length - 1].minute - series[0].minute : 0;
    return {
      segments,
      maxValue,
      peak: Math.max(...series.map((point) => point.value)),
      normalPercent: totalMinutes > 0 ? Math.round((normalMinutes / totalMinutes) * 100) : 100,
      hasData: insulinCurves.some((curve) => curve.points.length > 0),
    };
  }, [insulinCurves]);

  const sugarLimit = 25 * selectedRangeDays;
  const passiveCaloriesForRange = Math.round(passiveCalorie * selectedRangeDays);
  const netCalories = summaryData.calories_intake - summaryData.calories_burned - passiveCaloriesForRange;
  const sugarExceeded = summaryData.sugar > sugarLimit;
  const netCaloriesColor = netCalories < 0 ? colors.green : netCalories > 500 ? colors.red : colors.ink;

  return (
    <GradientScreen>
      <Header />
      <ScrollView contentContainerStyle={styles.main} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <View style={styles.datePill}>
            <Text style={styles.dateText}>{formatDisplayDate(selectedDate)}</Text>
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
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Net calories</Text>
          <Text style={[styles.cardNumber, { color: netCaloriesColor }]}>{netCalories}</Text>
          <View style={styles.macrosRow}>
            <Macro label="Passive burn" value={`- ${passiveCaloriesForRange} kcal`} />
            <Macro label="Active burn" value={`- ${summaryData.calories_burned} kcal`} />
            <Macro label="Food intake" value={`+ ${summaryData.calories_intake} kcal`} />
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
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderTop}>
              <Text style={styles.cardLabel}>Insulin — last 24 hours</Text>
              <View style={styles.insulinNormalBadge}>
                <Feather name="zap" size={13} color={colors.green} />
                <Text style={styles.insulinNormalText}>{insulinChart.normalPercent}% normal</Text>
              </View>
            </View>
            <Text style={styles.chartPeak}>Peak {Math.round(insulinChart.peak)}</Text>
          </View>
          <View style={styles.chartRow}>
            <View style={styles.yAxis}>
              <Text style={styles.axisText}>{Math.round(insulinChart.maxValue)}</Text>
              <Text style={styles.axisText}>0</Text>
            </View>
            <View style={styles.plot}>
              <Svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%">
                {insulinChart.segments.map((segment, index) => (
                  <Path
                    key={index}
                    d={segment.d}
                    fill="none"
                    stroke={segment.normal ? "#16a34a" : colors.blue}
                    strokeWidth={1}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </Svg>
            </View>
          </View>
          <View style={styles.xAxis}>
            {["-24h", "-18h", "-12h", "-6h", "Now"].map((label) => (
              <Text key={label} style={styles.axisText}>
                {label}
              </Text>
            ))}
          </View>
          <Text style={styles.chartLegend}>
            <Text style={{ color: "#16a34a" }}>Green</Text> normal · <Text style={{ color: colors.blue }}>Blue</Text> raised — watch how long a meal keeps it up
          </Text>
          {!insulinChart.hasData && (
            <Text style={styles.chartEmptyHint}>Log a meal to see how it moves your insulin over the last 24 hours.</Text>
          )}
        </View>

        <DashboardTrackers />
      </ScrollView>
      <BottomLogInput
        logDate={selectedDate}
        onLogged={() => {
          fetchDashboardSummary();
          fetchInsulinCurves();
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    columnGap: 8,
    rowGap: 8,
  },
  datePill: {
    flexShrink: 1,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    borderRadius: 999,
    backgroundColor: colors.panel,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  dateText: {
    color: colors.ink,
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
  cardHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  insulinNormalBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: colors.greenSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  insulinNormalText: {
    color: colors.green,
    fontSize: 12,
    fontWeight: "700",
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
  chartLegend: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
  },
});
