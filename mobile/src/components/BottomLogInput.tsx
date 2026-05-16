import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/auth/AuthContext";
import { API_BASE_URL } from "@/config/api";
import { colors } from "@/styles/theme";
import { formatSliderTime } from "@/utils/date";

export type LogResult = {
  calories_intake?: number;
  calories_burned?: number;
  protein?: number;
  carbs?: number;
  fibre?: number;
  sugar?: number;
};

function getCurrentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export function BottomLogInput({ logDate, onLogged }: { logDate: string; onLogged: (data: LogResult) => void }) {
  const { getAuthHeaders, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState("");
  const [logTimeMinutes, setLogTimeMinutes] = useState(() => getCurrentMinutes());
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submit = async () => {
    if (!input.trim()) return;
    const userText = input;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/log_input`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ sentence: userText, date: logDate, log_time_minutes: logTimeMinutes }),
      });
      const data = await response.json();
      if (response.status === 401) {
        await signOut();
        setErrorMessage("Session expired. Please sign in again.");
        return;
      }
      if (!response.ok) {
        setErrorMessage(data.detail || "Request failed");
        return;
      }
      onLogged(data);
      setInput("");
      setLogTimeMinutes(getCurrentMinutes());
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Network error.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.footer, { bottom: Math.max(insets.bottom, 14) }]}>
      {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
      {!!input.trim() && (
        <View style={styles.timeBox}>
          <View style={styles.timeHeader}>
            <Text style={styles.timeLabel}>Log time</Text>
            <Text style={styles.timeValue}>{formatSliderTime(logTimeMinutes)}</Text>
          </View>
          <View style={styles.timeSteps}>
            {[0, 360, 720, 1080, 1439].map((minute) => (
              <Pressable key={minute} style={styles.timeStep} onPress={() => setLogTimeMinutes(minute)}>
                <Text style={[styles.timeStepText, Math.abs(logTimeMinutes - minute) < 120 && styles.timeStepActive]}>
                  {formatSliderTime(minute).replace(":00 ", "")}
                </Text>
              </Pressable>
            ))}
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
  );
}

const styles = StyleSheet.create({
  footer: {
    position: "absolute",
    left: 12,
    right: 12,
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
  timeBox: {
    padding: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
    backgroundColor: colors.panel,
  },
  timeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  timeLabel: {
    color: colors.muted,
    fontSize: 12,
  },
  timeValue: {
    color: colors.ink,
    fontWeight: "700",
    fontSize: 13,
  },
  timeSteps: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeStep: {
    paddingVertical: 4,
  },
  timeStepText: {
    color: colors.quiet,
    fontSize: 11,
  },
  timeStepActive: {
    color: colors.ink,
    fontWeight: "700",
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
