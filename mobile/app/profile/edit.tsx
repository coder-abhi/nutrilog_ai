import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "@/auth/AuthContext";
import { AuthGate } from "@/components/AuthGate";
import { Header } from "@/components/Header";
import { GradientScreen } from "@/components/Screen";
import { colors, shadow } from "@/styles/theme";

const activityOptions = ["sedentary", "low", "moderate", "high", "very_high"];
const genderOptions = ["male", "female"];
const goalOptions = [
  { value: "muscle_gain", label: "Muscle Gain" },
  { value: "maintain_weight", label: "Maintain Weight" },
  { value: "weight_loss", label: "Weight Loss" },
  { value: "vitamin_focus", label: "Vitamins & Vitality" },
  { value: "pcos", label: "PCOS / PCOD" },
];

export default function EditProfilePage() {
  return (
    <AuthGate>
      <EditProfileContent />
    </AuthGate>
  );
}

function EditProfileContent() {
  const router = useRouter();
  const { user, updateProfile } = useAuth();
  const [weightKg, setWeightKg] = useState(() => String(user?.weight_kg ?? ""));
  const [targetWeightKg, setTargetWeightKg] = useState(() => (user?.target_weight_kg ? String(user.target_weight_kg) : ""));
  const [heightCm, setHeightCm] = useState(() => String(user?.height_cm ?? ""));
  const [gender, setGender] = useState(() => user?.gender ?? "male");
  const [activityLevel, setActivityLevel] = useState(() => user?.activity_level ?? "moderate");
  const [goals, setGoals] = useState<string[]>(() => user?.goals ?? []);

  const toggleGoal = (value: string) => {
    setGoals((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  };
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const profileLine = useMemo(() => {
    return [weightKg ? `${weightKg} kg` : null, heightCm ? `${heightCm} cm` : null, activityLevel.replace("_", " ")].filter(Boolean).join(" · ");
  }, [activityLevel, heightCm, weightKg]);

  const saveProfile = async () => {
    setError("");
    setSaved(false);
    const parsedWeight = Number(weightKg);
    const parsedTarget = Number(targetWeightKg);
    const parsedHeight = Number(heightCm);

    if (!parsedWeight || parsedWeight <= 0) {
      setError("Enter a valid current weight.");
      return;
    }
    if (!parsedHeight || parsedHeight <= 0) {
      setError("Enter a valid height.");
      return;
    }
    if (targetWeightKg.trim() && (!parsedTarget || parsedTarget <= 0)) {
      setError("Enter a valid target weight, or leave it empty.");
      return;
    }

    setSubmitting(true);
    const result = await updateProfile({
      weight_kg: parsedWeight,
      target_weight_kg: targetWeightKg.trim() ? parsedTarget : null,
      height_cm: parsedHeight,
      gender,
      activity_level: activityLevel,
      goals,
    });
    setSubmitting(false);

    if (!result.success) {
      setError(result.error || "Could not update profile.");
      return;
    }
    setSaved(true);
  };

  return (
    <GradientScreen>
      <Header />
      <ScrollView contentContainerStyle={styles.main} keyboardShouldPersistTaps="handled">
        <View style={styles.panel}>
          <Text style={styles.kicker}>Current user</Text>
          <Text style={styles.title}>{user?.username}</Text>
          <Text style={styles.subtitle}>{profileLine}</Text>

          <View style={styles.form}>
            <Field label="Current weight" value={weightKg} onChangeText={setWeightKg} suffix="kg" keyboardType="decimal-pad" />
            <Field label="Height" value={heightCm} onChangeText={setHeightCm} suffix="cm" keyboardType="decimal-pad" />
            <MultiChoiceRow label="Goals" value={goals} options={goalOptions.map((item) => item.value)} labels={Object.fromEntries(goalOptions.map((item) => [item.value, item.label]))} onToggle={toggleGoal} />
            {(goals.includes("weight_loss") || targetWeightKg.trim()) && (
              <Field label="Target weight" value={targetWeightKg} onChangeText={setTargetWeightKg} suffix="kg" keyboardType="decimal-pad" />
            )}
            <ChoiceRow label="Gender" value={gender} options={genderOptions} onChange={setGender} />
            <ChoiceRow label="Activity level" value={activityLevel} options={activityOptions} onChange={setActivityLevel} />
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}
          {saved && <Text style={styles.success}>Profile updated.</Text>}

          <View style={styles.actions}>
            <Pressable style={[styles.primaryButton, submitting && styles.disabled]} onPress={saveProfile} disabled={submitting}>
              <Text style={styles.primaryText}>{submitting ? "Saving..." : "Save profile"}</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </GradientScreen>
  );
}

function Field({
  label,
  suffix,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  label: string;
  suffix?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput {...props} style={styles.input} placeholderTextColor="#9ca3af" />
        {!!suffix && <Text style={styles.unit}>{suffix}</Text>}
      </View>
    </View>
  );
}

function MultiChoiceRow({
  label,
  value,
  options,
  labels,
  onToggle,
}: {
  label: string;
  value: string[];
  options: string[];
  labels?: Record<string, string>;
  onToggle: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.choiceWrap}>
        {options.map((option) => {
          const active = value.includes(option);
          return (
            <Pressable key={option} style={[styles.choice, active && styles.choiceActive]} onPress={() => onToggle(option)}>
              <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{labels?.[option] ?? option.replace("_", " ")}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ChoiceRow({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  labels?: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.choiceWrap}>
        {options.map((option) => {
          const active = option === value;
          return (
            <Pressable key={option || "none"} style={[styles.choice, active && styles.choiceActive]} onPress={() => onChange(option)}>
              <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{labels?.[option] ?? option.replace("_", " ")}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  main: {
    padding: 16,
    paddingBottom: 32,
  },
  panel: {
    borderRadius: 16,
    backgroundColor: colors.panel,
    padding: 18,
    gap: 14,
    ...shadow,
  },
  kicker: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  title: {
    color: colors.ink,
    fontSize: 27,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
  },
  form: {
    gap: 13,
  },
  field: {
    gap: 6,
  },
  label: {
    color: colors.inkSoft,
    fontSize: 14,
    fontWeight: "700",
  },
  inputWrap: {
    minHeight: 47,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    backgroundColor: colors.panel,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.ink,
    fontSize: 16,
  },
  unit: {
    paddingRight: 12,
    color: colors.quiet,
    fontSize: 13,
    fontWeight: "800",
  },
  choiceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  choice: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
  },
  choiceActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  choiceText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  choiceTextActive: {
    color: colors.panel,
  },
  error: {
    overflow: "hidden",
    borderRadius: 11,
    backgroundColor: colors.redSoft,
    color: colors.red,
    padding: 10,
    fontWeight: "700",
  },
  success: {
    overflow: "hidden",
    borderRadius: 11,
    backgroundColor: colors.greenSoft,
    color: colors.green,
    padding: 10,
    fontWeight: "700",
  },
  actions: {
    gap: 10,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: colors.panel,
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  disabled: {
    opacity: 0.65,
  },
});
