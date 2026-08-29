import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "@/auth/AuthContext";
import { AuthGate } from "@/components/AuthGate";
import { Header } from "@/components/Header";
import { PlainScreen } from "@/components/Screen";
import { API_BASE_URL } from "@/config/api";
import { colors } from "@/styles/theme";

export default function NewTrackerPage() {
  return (
    <AuthGate>
      <NewTrackerContent />
    </AuthGate>
  );
}

function NewTrackerContent() {
  const { getAuthHeaders, signOut } = useAuth();
  const [name, setName] = useState("");
  const [valueType, setValueType] = useState<"boolean" | "numeric">("boolean");
  const [targetDays, setTargetDays] = useState(7);
  const [targetValue, setTargetValue] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (valueType === "numeric" && (!targetValue || Number(targetValue) <= 0)) {
      setError("Enter a valid weekly target.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/tracker_cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(
          valueType === "numeric"
            ? { name, value_type: valueType, target_value: Number(targetValue), description }
            : { name, value_type: valueType, target_days_per_week: targetDays, description },
        ),
      });
      const data = await res.json();
      if (res.status === 401) {
        await signOut();
        return;
      }
      if (!res.ok) {
        setError(data.detail || "Could not create tracker.");
        return;
      }
      router.push("/tracker");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PlainScreen>
      <Header />
      <ScrollView contentContainerStyle={styles.main} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <View>
            <Text style={styles.title}>Create tracker card</Text>
            <Text style={styles.subtitle}>The description helps the AI recognize updates from your normal log text.</Text>
          </View>
          <Field label="Name" value={name} onChangeText={setName} placeholder="Push ups" />

          <View style={styles.fieldset}>
            <Text style={styles.legend}>Tracking type</Text>
            <Choice label="Yes / No" active={valueType === "boolean"} onPress={() => setValueType("boolean")} />
            <Choice label="Numerical" active={valueType === "numeric"} onPress={() => setValueType("numeric")} />
          </View>

          {valueType === "numeric" ? (
            <Field
              label="Weekly target"
              value={targetValue}
              onChangeText={setTargetValue}
              placeholder="e.g. 50"
              keyboardType="numeric"
            />
          ) : (
            <View style={styles.field}>
              <Text style={styles.label}>Weekly target</Text>
              <View style={styles.daysRow}>
                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                  <Pressable key={day} style={[styles.dayChip, targetDays === day && styles.dayChipActive]} onPress={() => setTargetDays(day)}>
                    <Text style={[styles.dayChipText, targetDays === day && styles.dayChipTextActive]}>{day}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <Field label="Description" value={description} onChangeText={setDescription} placeholder="Examples: pushups, push ups, did reps. Extract the number of pushups." multiline numberOfLines={4} />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.actions}>
            <Pressable style={styles.secondary} onPress={() => router.push("/tracker")}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.primary} onPress={submit} disabled={saving}>
              <Text style={styles.primaryText}>{saving ? "Creating..." : "Create"}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </PlainScreen>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput {...props} style={[styles.input, props.multiline && styles.textarea]} placeholderTextColor="#6b7280" />
    </View>
  );
}

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.choice} onPress={onPress}>
      <View style={[styles.radio, active && styles.radioActive]} />
      <Text style={styles.choiceText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  main: { padding: 16 },
  form: { backgroundColor: colors.panel, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 18, gap: 16 },
  title: { color: colors.ink, fontSize: 28, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 4, lineHeight: 20 },
  field: { gap: 6 },
  label: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 12, minHeight: 44, color: colors.ink, fontSize: 15, backgroundColor: colors.panel },
  textarea: { minHeight: 100, paddingTop: 12, textAlignVertical: "top" },
  fieldset: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, gap: 10 },
  legend: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  choice: { flexDirection: "row", alignItems: "center", gap: 8 },
  choiceText: { color: colors.ink, fontSize: 14 },
  radio: { width: 15, height: 15, borderRadius: 999, borderWidth: 1, borderColor: "#9ca3af" },
  radioActive: { borderWidth: 5, borderColor: colors.ink },
  daysRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  dayChip: { width: 35, height: 35, borderRadius: 999, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  dayChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  dayChipText: { color: colors.ink, fontWeight: "700" },
  dayChipTextActive: { color: colors.panel },
  error: { color: "#b91c1c", fontSize: 13 },
  actions: { flexDirection: "row", gap: 10 },
  secondary: { flex: 1, minHeight: 43, borderRadius: 10, borderWidth: 1, borderColor: "#d1d5db", alignItems: "center", justifyContent: "center" },
  primary: { flex: 1, minHeight: 43, borderRadius: 10, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: colors.ink, fontWeight: "800" },
  primaryText: { color: colors.panel, fontWeight: "800" },
});
