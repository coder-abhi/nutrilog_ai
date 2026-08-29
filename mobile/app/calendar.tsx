import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AuthGate } from "@/components/AuthGate";
import { Header } from "@/components/Header";
import { GradientScreen } from "@/components/Screen";
import { SignedOutError, useApi } from "@/hooks/useApi";
import { colors, shadow } from "@/styles/theme";
import type { ActivityEntry, FoodEntry, SummaryData } from "@/types";
import { formatLongDate, formatMonthYear, logicalToYMD } from "@/utils/date";

const daysHeader = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type DaySummary = {
  summary: SummaryData;
  foods: FoodEntry[];
  activities: ActivityEntry[];
};

function getDaysInMonth(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const grid: (number | null)[] = [];
  for (let i = 0; i < first.getDay(); i += 1) grid.push(null);
  for (let d = 1; d <= last.getDate(); d += 1) grid.push(d);
  while (grid.length < 42) grid.push(null);
  return grid;
}

export default function CalendarPage() {
  return (
    <AuthGate>
      <CalendarContent />
    </AuthGate>
  );
}

function CalendarContent() {
  const { authedFetch } = useApi();
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => logicalToYMD());
  const [daySummary, setDaySummary] = useState<DaySummary | null>(null);
  const [loading, setLoading] = useState(true);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = formatMonthYear(viewDate);

  const fetchDaySummary = useCallback(
    async (dateStr: string) => {
      setLoading(true);
      setDaySummary(null);
      try {
        const data = await authedFetch<DaySummary>(`/today_summary?date=${dateStr}`);
        setDaySummary(data);
      } catch (err) {
        if (err instanceof SignedOutError) return;
        setDaySummary(null);
      } finally {
        setLoading(false);
      }
    },
    [authedFetch],
  );

  useEffect(() => {
    fetchDaySummary(selectedDate);
  }, [fetchDaySummary, selectedDate]);

  return (
    <GradientScreen>
      <Header />
      <ScrollView contentContainerStyle={styles.main}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Stay Consistent and Get Results</Text>
          <Text style={styles.heroSubtitle}>See your streaks and macros over the month in a clean calendar view.</Text>
        </View>

        <View style={styles.shell}>
          <View style={styles.dateSwitcher}>
            <Pressable style={styles.chevronBtn} onPress={() => setViewDate(new Date(year, month - 1))}>
              <Text style={styles.chevronText}>‹</Text>
            </Pressable>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <Pressable style={styles.chevronBtn} onPress={() => setViewDate(new Date(year, month + 1))}>
              <Text style={styles.chevronText}>›</Text>
            </Pressable>
          </View>

          <View style={styles.calendarGrid}>
            {daysHeader.map((day) => (
              <Text key={day} style={styles.dayLabel}>
                {day[0]}
              </Text>
            ))}
            {getDaysInMonth(year, month).map((day, index) => {
              if (day === null) return <View key={`empty-${index}`} style={styles.dayCellEmpty} />;
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const selected = dateStr === selectedDate;
              const today = dateStr === logicalToYMD();
              return (
                <Pressable
                  key={dateStr}
                  style={[styles.dayCell, selected && styles.dayCellSelected, today && styles.dayCellToday, selected && today && styles.dayCellSelectedToday]}
                  onPress={() => setSelectedDate(dateStr)}
                >
                  <Text style={[styles.dayText, selected && styles.dayTextSelected, today && !selected && styles.dayTextToday]}>{day}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.selectedDateLabel}>Selected: {formatLongDate(selectedDate)}</Text>

          {loading ? (
            <Text style={styles.entryMeta}>Loading...</Text>
          ) : daySummary ? (
            <>
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Calories</Text>
                  <Text style={styles.statValue}>{daySummary.summary.calories_intake}</Text>
                  <Text style={styles.statSub}>
                    Food · {daySummary.summary.calories_intake} · Exercise · {daySummary.summary.calories_burned}
                  </Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Macros</Text>
                  <Text style={styles.statSub}>
                    Carbs {daySummary.summary.carbs}g · Protein {daySummary.summary.protein}g · Fat (from foods below)
                  </Text>
                </View>
              </View>

              <View style={styles.entriesSection}>
                <Text style={styles.sectionTitle}>Meals on this day</Text>
                {daySummary.foods.length === 0 ? (
                  <Text style={styles.entryMeta}>No food logged for this date.</Text>
                ) : (
                  daySummary.foods.map((entry, i) => (
                    <View key={`${entry.name}-${i}`} style={styles.entryCard}>
                      <Text style={styles.entryTitle}>{entry.name}</Text>
                      <Text style={styles.entryMacros}>
                        Calories {entry.calories} · Carbs {entry.carbs}g · Protein {entry.protein}g · Fat {entry.fat}g
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </>
          ) : (
            <Text style={styles.entryMeta}>Could not load data for this date.</Text>
          )}
        </View>
      </ScrollView>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  main: { padding: 16, gap: 18, paddingBottom: 32 },
  hero: { gap: 4 },
  heroTitle: { color: colors.ink, fontSize: 30, fontWeight: "800" },
  heroSubtitle: { color: "#1f2937", fontSize: 15, lineHeight: 21 },
  shell: { backgroundColor: colors.panel, borderRadius: 20, padding: 16, gap: 16, ...shadow },
  dateSwitcher: { flexDirection: "row", alignItems: "center", gap: 8 },
  chevronBtn: { width: 26, height: 26, borderRadius: 999, backgroundColor: colors.line, alignItems: "center", justifyContent: "center" },
  chevronText: { color: colors.ink, fontSize: 17, lineHeight: 19 },
  monthLabel: { color: colors.ink, fontWeight: "600", fontSize: 16 },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 6 },
  dayLabel: { width: `${100 / 7}%`, textAlign: "center", color: colors.inkSoft, fontSize: 11 },
  dayCell: { width: `${100 / 7}%`, alignItems: "center", justifyContent: "center" },
  dayCellEmpty: { width: `${100 / 7}%`, height: 38 },
  dayText: { width: 38, height: 38, borderRadius: 999, overflow: "hidden", backgroundColor: "#f3f4f6", color: colors.ink, textAlign: "center", lineHeight: 38, fontSize: 13 },
  dayCellSelected: {},
  dayTextSelected: { backgroundColor: colors.ink, color: colors.panel },
  dayCellToday: {},
  dayTextToday: { borderWidth: 2, borderColor: colors.blue, backgroundColor: colors.blueSoft, color: "#1e40af", fontWeight: "600" },
  dayCellSelectedToday: {},
  selectedDateLabel: { color: colors.inkSoft, fontSize: 14 },
  statsRow: { gap: 12 },
  statCard: { backgroundColor: "#f9fafb", borderRadius: 14, padding: 14, gap: 3 },
  statLabel: { color: colors.inkSoft, fontSize: 12, fontWeight: "700", letterSpacing: 0.9, textTransform: "uppercase" },
  statValue: { color: "#0b1120", fontSize: 19, fontWeight: "700" },
  statSub: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  entriesSection: { gap: 8 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  entryMeta: { color: colors.quiet, fontSize: 14 },
  entryCard: { borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 13, gap: 4 },
  entryTitle: { color: colors.ink, fontSize: 14 },
  entryMacros: { color: colors.ink, fontSize: 13, lineHeight: 19 },
});
