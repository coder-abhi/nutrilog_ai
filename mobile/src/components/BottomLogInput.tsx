import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SignedOutError, useApi } from "@/hooks/useApi";
import { colors } from "@/styles/theme";
import { formatSliderTime, fromDisplayMinutes, toDisplayMinutes, toYMD } from "@/utils/date";

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

export function BottomLogInput({ onLogged }: { onLogged: (data: LogResult) => void }) {
  const { authedFetch } = useApi();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState("");
  const [logTimeMinutes, setLogTimeMinutes] = useState(() => getCurrentMinutes());
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardVisible(true);
      setKeyboardHeight(event?.endCoordinates?.height ?? 0);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const submit = async () => {
    if (!input.trim()) return;
    const userText = input;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // Always the true calendar date paired with the true clock time (not the dashboard's
      // logical/3-AM-shifted "today"), so the backend can reconstruct a real, monotonic
      // timestamp. The 3 AM tracking-day boundary is applied when the entry is later queried,
      // not when it's created.
      const data = await authedFetch<LogResult>("/log_input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentence: userText, date: toYMD(new Date()), log_time_minutes: logTimeMinutes }),
        fallbackErrorMessage: "Request failed",
      });
      onLogged(data);
      setInput("");
      setLogTimeMinutes(getCurrentMinutes());
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

  // Lift the bar so it sits directly above the on-screen keyboard on both platforms.
  // Under RN's current edge-to-edge Android handling, the reported keyboard height
  // already includes the nav-bar inset, so adding insets.bottom again here would push
  // the whole bar (and its placeholder) well above the keyboard instead of resting on it.
  const restingMargin = Math.max(insets.bottom, 14);
  const footerMargin = keyboardVisible && keyboardHeight > 0 ? keyboardHeight + 8 : restingMargin;

  return (
    <KeyboardAvoidingView pointerEvents="box-none" behavior={undefined} keyboardVerticalOffset={0} style={styles.footerLayer}>
      <View style={[styles.footer, { marginBottom: footerMargin }]}>
        {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
        {!!input.trim() && (
          <View style={styles.timeBox}>
            <View style={styles.timeHeader}>
              <Text style={styles.timeLabel}>
                Log time <Text style={styles.timeHint}>(select approx time if not current time)</Text>
              </Text>
              <Pressable style={styles.nowButton} onPress={() => setLogTimeMinutes(getCurrentMinutes())}>
                <Text style={styles.nowButtonText}>{formatSliderTime(logTimeMinutes)}</Text>
                <Text style={styles.nowButtonHint}>tap for now</Text>
              </Pressable>
            </View>
            <View style={styles.timeSteps}>
              {[0, 360, 720, 1080, 1439].map((displayMinute) => {
                const minute = fromDisplayMinutes(displayMinute);
                const label = displayMinute === 0 || displayMinute === 1439 ? formatSliderTime(fromDisplayMinutes(0)) : formatSliderTime(minute);
                return (
                  <Pressable key={displayMinute} style={styles.timeStep} onPress={() => setLogTimeMinutes(minute)}>
                    <Text
                      style={[
                        styles.timeStepText,
                        Math.abs(toDisplayMinutes(logTimeMinutes) - displayMinute) < 120 && styles.timeStepActive,
                      ]}
                    >
                      {label.replace(":00 ", "")}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TimeSlider value={logTimeMinutes} onChange={setLogTimeMinutes} />
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

function TimeSlider({ value, onChange }: { value: number; onChange: (minutes: number) => void }) {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Track the last value we know about so external resets (e.g. the "now" button) stay in sync.
  const lastEmitted = useRef(value);
  lastEmitted.current = value;

  const updateFromX = (x: number) => {
    const width = trackWidthRef.current;
    if (width <= 0) return;
    const ratio = Math.min(1, Math.max(0, x / width));
    const nextDisplay = Math.round((ratio * 1439) / 5) * 5;
    const next = fromDisplayMinutes(nextDisplay);
    if (next === lastEmitted.current) return;
    lastEmitted.current = next;
    onChangeRef.current(next);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => updateFromX(evt.nativeEvent.locationX),
      onPanResponderMove: (evt) => updateFromX(evt.nativeEvent.locationX),
    }),
  ).current;

  const ratio = Math.min(1, Math.max(0, toDisplayMinutes(value) / 1439));

  return (
    <View
      style={styles.sliderTrack}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        trackWidthRef.current = w;
        setTrackWidth(w);
      }}
      {...panResponder.panHandlers}
    >
      <View pointerEvents="none" style={styles.sliderBar} />
      <View pointerEvents="none" style={[styles.sliderFill, { width: ratio * trackWidth }]} />
      <View pointerEvents="none" style={[styles.sliderThumb, { left: Math.max(0, ratio * trackWidth - 9) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  footerLayer: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 0,
    justifyContent: "flex-end",
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
    alignItems: "flex-start",
    marginBottom: 6,
  },
  timeLabel: {
    flex: 1,
    marginRight: 8,
    color: colors.muted,
    fontSize: 12,
  },
  timeHint: {
    color: colors.quiet,
    fontSize: 11,
  },
  timeValue: {
    color: colors.ink,
    fontWeight: "700",
    fontSize: 13,
  },
  nowButton: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.ink,
    backgroundColor: colors.panel,
  },
  nowButtonText: {
    color: colors.ink,
    fontWeight: "700",
    fontSize: 13,
  },
  nowButtonHint: {
    color: colors.quiet,
    fontSize: 9,
    letterSpacing: 0.3,
    textTransform: "uppercase",
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
  sliderTrack: {
    marginTop: 10,
    height: 26,
    justifyContent: "center",
  },
  sliderBar: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.line,
  },
  sliderFill: {
    position: "absolute",
    left: 0,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.ink,
  },
  sliderThumb: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: colors.ink,
    borderWidth: 2,
    borderColor: colors.panel,
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
