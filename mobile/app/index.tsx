import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";

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
import { formatDisplayDate, getCurrentMinutes, logicalDate, logicalToYMD, toYMD } from "@/utils/date";

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
  const [selectedDate] = useState(() => logicalToYMD());
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
      const value = await authedFetch<number>(`/passive_calorie_burned?local_minutes=${getCurrentMinutes()}`);
      setPassiveCalorie(value ?? 0);
      setCached(PASSIVE_CALORIE_CACHE_KEY, value ?? 0);
    } catch (err) {
      if (err instanceof SignedOutError || err instanceof ApiError) return;
      setPassiveCalorie(0);
    }
  }, [authedFetch, user?.username]);

  // The insulin graph always shows the current logical day (since 3 AM, same boundary as
  // trackers/streaks elsewhere) plus a short lookahead for the predicted curve of a just-logged
  // meal, independent of the today/week/month range picker above. Fetching 3 calendar days
  // guarantees full coverage no matter what time it is now, including right after the 3 AM
  // boundary, when "today" alone would miss most of the window.
  const fetchInsulinCurves = useCallback(async () => {
    if (!user?.username) return;
    try {
      const result = await authedFetch<{ insulin_curves: InsulinCurve[] }>(
        `/today_summary?date=${toYMD(new Date())}&days=3`,
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

  // How far past "now" the chart draws a just-logged meal's predicted rise/peak/fall (an
  // insulin curve is a simulated ~4-hour response, not a sensor reading, so almost all of a
  // fresh meal's curve is still "in the future" the instant it's logged - clipping the chart at
  // "now" would make it look like nothing happened).
  const FUTURE_LOOKAHEAD_MINUTES = 240;

  const insulinChart = useMemo(() => {
    // Window starts at 3 AM of the current logical day (the same day-boundary used for trackers
    // and streaks) plus a short lookahead, expressed as minutes-since-window-start so every point
    // (which may fall on any of the fetched calendar days) lands on one axis. "Now" therefore
    // isn't the right edge of the chart - it's marked explicitly instead. The span from 3 AM to
    // now is inherently dynamic (a few hours right after 3 AM, up to ~24h just before the next
    // 3 AM), so nothing downstream can assume a fixed width.
    const nowMs = Date.now();
    const dayStart = logicalDate(new Date(nowMs));
    dayStart.setHours(3, 0, 0, 0);
    const windowStart = dayStart.getTime();
    const NOW_MINUTE = Math.round((nowMs - windowStart) / 60000);
    const WINDOW_MINUTES = NOW_MINUTE + FUTURE_LOOKAHEAD_MINUTES;
    const BASELINE = 8;
    // The backend samples each meal's curve every 10 minutes, but different meals are logged at
    // different times, so their sample minutes don't line up with each other. Summing curves by
    // matching only exact-minute samples (as this used to) meant that at any given instant, only
    // whichever curve happened to have a sample land there contributed - other overlapping curves
    // silently dropped out, producing sharp up/down spikes that looked like bars instead of one
    // smooth line. Resampling every curve onto the same 10-minute grid via interpolation fixes that.
    const GRID_STEP_MINUTES = 10;

    // How much a single meal's curve is raising insulin above baseline at an absolute instant,
    // via linear interpolation between that curve's own points. 0 outside the curve's own span
    // (before it was logged, or after its ~4-hour response has fully played out).
    const sampleCurveExcess = (curve: InsulinCurve, atMs: number) => {
      if (!curve.timestamp || curve.points.length === 0) return 0;
      const logTime = new Date(curve.timestamp).getTime();
      const relativeMinute = (atMs - logTime) / 60000;
      const points = curve.points;
      const first = points[0];
      const last = points[points.length - 1];
      if (relativeMinute < first.minute || relativeMinute > last.minute) return 0;
      for (let i = 0; i < points.length - 1; i += 1) {
        const a = points[i];
        const b = points[i + 1];
        if (relativeMinute >= a.minute && relativeMinute <= b.minute) {
          const t = b.minute === a.minute ? 0 : (relativeMinute - a.minute) / (b.minute - a.minute);
          return Math.max(0, a.value + (b.value - a.value) * t - BASELINE);
        }
      }
      return 0;
    };

    const gridCount = Math.floor(WINDOW_MINUTES / GRID_STEP_MINUTES);
    const series = Array.from({ length: gridCount + 1 }, (_, i) => {
      const minute = Math.min(WINDOW_MINUTES, i * GRID_STEP_MINUTES);
      const atMs = windowStart + minute * 60000;
      const excess = insulinCurves.reduce((sum, curve) => sum + sampleCurveExcess(curve, atMs), 0);
      return { minute, value: Math.min(100, BASELINE + excess) };
    });
    const maxValue = Math.max(20, ...series.map((point) => point.value));
    // Insulin sits near the baseline (8) at rest; treat small deviations as "back to normal".
    const NORMAL_MAX = 14;
    const points = series.map((point) => ({
      x: normalizeToPercent(point.minute, 0, WINDOW_MINUTES),
      y: 100 - normalizeToPercent(point.value, 0, maxValue),
      normal: point.value <= NORMAL_MAX,
    }));
    const segments: { d: string; normal: boolean; future: boolean }[] = [];
    let normalMinutes = 0;
    let elapsedMinutes = 0;
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      const normal = a.normal && b.normal;
      const future = series[i].minute >= NOW_MINUTE;
      segments.push({ d: `M ${a.x} ${a.y} L ${b.x} ${b.y}`, normal, future });
      // Only the elapsed portion (up to "now") counts toward the normal% summary - the
      // lookahead is a prediction, not something that has actually happened yet.
      if (!future) {
        const segmentMinutes = Math.min(series[i + 1].minute, NOW_MINUTE) - series[i].minute;
        elapsedMinutes += segmentMinutes;
        if (normal) normalMinutes += segmentMinutes;
      }
    }
    // The window's width varies with the time of day, so ticks are just the three fixed
    // reference points rather than a fixed set of hour offsets.
    const xTicks = [
      { minute: 0, label: "3 AM" },
      { minute: NOW_MINUTE, label: "Now" },
      { minute: WINDOW_MINUTES, label: `+${Math.round(FUTURE_LOOKAHEAD_MINUTES / 60)}h` },
    ].map((tick) => ({ ...tick, pct: normalizeToPercent(tick.minute, 0, WINDOW_MINUTES) }));
    return {
      segments,
      maxValue,
      nowX: normalizeToPercent(NOW_MINUTE, 0, WINDOW_MINUTES),
      xTicks,
      peak: Math.max(...series.map((point) => point.value)),
      normalPercent: elapsedMinutes > 0 ? Math.round((normalMinutes / elapsedMinutes) * 100) : 100,
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
      <ScrollView style={styles.scroll} contentContainerStyle={styles.main} keyboardShouldPersistTaps="handled">
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
              <Text style={styles.cardLabel}>Insulin — since 3 AM</Text>
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
                    strokeDasharray={segment.future ? "3 2" : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                <Line
                  x1={insulinChart.nowX}
                  x2={insulinChart.nowX}
                  y1={0}
                  y2={100}
                  stroke={colors.quiet}
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  vectorEffect="non-scaling-stroke"
                />
              </Svg>
            </View>
          </View>
          <View style={styles.xAxis}>
            {insulinChart.xTicks.map((tick) => (
              <Text key={tick.label} style={[styles.axisText, styles.xAxisLabel, { left: `${tick.pct}%` }]}>
                {tick.label}
              </Text>
            ))}
          </View>
          <Text style={styles.chartLegend}>
            <Text style={{ color: "#16a34a" }}>Green</Text> normal · <Text style={{ color: colors.blue }}>Blue</Text> raised ·{" "}
            <Text style={{ color: colors.quiet }}>dashed</Text> predicted — watch how long a meal keeps it up
          </Text>
          {!insulinChart.hasData && (
            <Text style={styles.chartEmptyHint}>Log a meal to see how it moves your insulin since 3 AM.</Text>
          )}
        </View>

        <DashboardTrackers />
      </ScrollView>
      <BottomLogInput
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
  scroll: {
    flex: 1,
  },
  main: {
    padding: 16,
    paddingBottom: 24,
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
    height: 14,
    position: "relative",
  },
  xAxisLabel: {
    position: "absolute",
    top: 0,
    transform: [{ translateX: -14 }],
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
