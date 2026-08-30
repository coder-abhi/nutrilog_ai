import React, { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SignedOutError, useApi } from "@/hooks/useApi";
import { colors } from "@/styles/theme";
import { formatMonthShort, toYMD } from "@/utils/date";

export type LogResult = {
  calories_intake?: number;
  calories_burned?: number;
  protein?: number;
  carbs?: number;
  fibre?: number;
  sugar?: number;
};

// Chronological through the day, so the chips read left-to-right the way meals actually happen.
const MEAL_PRESETS: { label: string; minutes: number }[] = [
  { label: "Breakfast", minutes: 8 * 60 },
  { label: "Lunch", minutes: 13 * 60 },
  { label: "Snack", minutes: 16 * 60 },
  { label: "Dinner", minutes: 20 * 60 },
  { label: "Midnight", minutes: 0 },
];

function getCurrentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

// daysAgo=0 is Today, 1 is Yesterday; anything further back shows as "DD MMM" (e.g. "28 Aug").
function formatDayLabel(daysAgo: number) {
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return `${date.getDate()} ${formatMonthShort(date.getTime())}`;
}

export function BottomLogInput({ onLogged }: { onLogged: (data: LogResult) => void }) {
  const { authedFetch } = useApi();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState("");
  const [logTimeMinutes, setLogTimeMinutes] = useState(() => getCurrentMinutes());
  const [daysAgo, setDaysAgo] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submit = async () => {
    if (!input.trim()) return;
    const userText = input;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // Always the true calendar date paired with the true clock time (not the dashboard's
      // logical/3-AM-shifted "today"), so the backend can reconstruct a real, monotonic
      // timestamp. The 3 AM tracking-day boundary is applied when the entry is later queried,
      // not when it's created. `daysAgo` (from the day stepper) shifts which calendar date
      // that is; it never affects the clock time, which comes from the meal presets below.
      const logDate = new Date();
      logDate.setDate(logDate.getDate() - daysAgo);
      const data = await authedFetch<LogResult>("/log_input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentence: userText, date: toYMD(logDate), log_time_minutes: logTimeMinutes }),
        fallbackErrorMessage: "Request failed",
      });
      onLogged(data);
      setInput("");
      setLogTimeMinutes(getCurrentMinutes());
      setDaysAgo(0);
    } catch (err) {
      if (err instanceof SignedOutError) {
        setErrorMessage("Session expired. Please sign in again.");
        return;
      }
      setErrorMessage(err instanceof Error ? err.message : "Network error.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // The bar is a normal (non-absolute) sibling below the screen's ScrollView, so it takes its
    // own space at the bottom rather than floating over content. That lets Android's own
    // windowSoftInputMode="resize" (set in app.json) shrink the whole screen - including this
    // bar's position - when the keyboard opens, without any manual height math on our side.
    // iOS has no such native resize, so it still needs KeyboardAvoidingView's "padding" behavior.
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.footerLayer}>
      <View style={[styles.footer, { marginBottom: Math.max(insets.bottom, 14) }]}>
        {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
        {!!input.trim() && (
          <View style={styles.logDetails}>
            <View style={styles.dayStepperRow}>
              <View style={styles.dayStepper}>
                <Pressable
                  style={styles.stepperArrow}
                  onPress={() => setDaysAgo((d) => d + 1)}
                  accessibilityRole="button"
                  accessibilityLabel="Log for an earlier day"
                >
                  <Text style={styles.stepperArrowText}>−</Text>
                </Pressable>
                <Text style={styles.stepperLabel}>{formatDayLabel(daysAgo)}</Text>
                <Pressable
                  style={[styles.stepperArrow, daysAgo === 0 && styles.stepperArrowDisabled]}
                  onPress={() => setDaysAgo((d) => Math.max(0, d - 1))}
                  disabled={daysAgo === 0}
                  accessibilityRole="button"
                  accessibilityLabel="Log for the next day"
                >
                  <Text style={[styles.stepperArrowText, daysAgo === 0 && styles.stepperArrowTextDisabled]}>+</Text>
                </Pressable>
              </View>
              <Pressable style={styles.nowButton} onPress={() => setLogTimeMinutes(getCurrentMinutes())} accessibilityRole="button" accessibilityLabel="Use current time">
                <Text style={styles.nowButtonText}>Now</Text>
              </Pressable>
            </View>

            <View style={styles.mealRow}>
              {MEAL_PRESETS.map((meal) => {
                const active = logTimeMinutes === meal.minutes;
                return (
                  <Pressable key={meal.label} style={[styles.mealChip, active && styles.mealChipActive]} onPress={() => setLogTimeMinutes(meal.minutes)}>
                    <Text style={[styles.mealChipText, active && styles.mealChipTextActive]} numberOfLines={1} adjustsFontSizeToFit>
                      {meal.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
        <View style={styles.row}>
          <TextInput
            value={input}
            onChangeText={setInput}
            onSubmitEditing={submit}
            placeholder="Type: I walked 5 km, I ate 2 chapatis..."
            placeholderTextColor="#6b7280"
            style={styles.input}
            returnKeyType="send"
          />
          <Pressable style={[styles.button, isLoading && styles.disabled]} onPress={submit} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#f9fafb" /> : <Text style={styles.buttonText}>Submit</Text>}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  footerLayer: {
    paddingHorizontal: 12,
  },
  footer: {
    padding: 10,
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    shadowColor: "#0f172a",
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 10,
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 12,
  },
  logDetails: {
    padding: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
    backgroundColor: colors.panel,
  },
  dayStepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dayStepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  nowButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.ink,
    backgroundColor: colors.panel,
  },
  nowButtonText: {
    color: colors.ink,
    fontWeight: "700",
    fontSize: 12,
  },
  stepperArrow: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel,
  },
  stepperArrowDisabled: {
    opacity: 0.35,
  },
  stepperArrowText: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 19,
  },
  stepperArrowTextDisabled: {
    color: colors.quiet,
  },
  stepperLabel: {
    minWidth: 84,
    textAlign: "center",
    color: colors.ink,
    fontWeight: "700",
    fontSize: 14,
  },
  mealRow: {
    flexDirection: "row",
    gap: 4,
  },
  mealChip: {
    flex: 1,
    paddingHorizontal: 2,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel,
  },
  mealChipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  mealChipText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "700",
  },
  mealChipTextActive: {
    color: colors.panel,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 47,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.panel,
    color: colors.ink,
    fontSize: 15,
  },
  button: {
    minWidth: 82,
    minHeight: 47,
    borderRadius: 6,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  buttonText: {
    color: "#f9fafb",
    fontWeight: "700",
    fontSize: 15,
  },
  disabled: {
    opacity: 0.7,
  },
});
