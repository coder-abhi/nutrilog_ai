import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "@/auth/AuthContext";
import { GradientScreen } from "@/components/Screen";
import { colors, shadow } from "@/styles/theme";

type GoalValue = "muscle_gain" | "weight_loss" | "skin_health" | "hair_growth" | "energy_boost" | "pcos";

const activityOptions = ["sedentary", "low", "moderate", "high", "very_high"];
const genderOptions = ["male", "female", "other"];
const goals: { value: GoalValue; title: string; description: string }[] = [
  { value: "muscle_gain", title: "Muscle Gain", description: "Track protein and strength nutrients" },
  { value: "weight_loss", title: "Weight Loss", description: "Track calories and fat burn" },
  { value: "skin_health", title: "Skin Health", description: "Track Vitamin C, E and hydration" },
  { value: "hair_growth", title: "Hair Growth", description: "Track biotin, B12 and iron" },
  { value: "energy_boost", title: "Energy Boost", description: "Track iron, B vitamins and complex carbs" },
  { value: "pcos", title: "PCOS / PCOD", description: "Track blood sugar and hormone balance" },
];

export function AuthForm() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [step, setStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState("male");
  const [activityLevel, setActivityLevel] = useState("moderate");
  const [selectedGoal, setSelectedGoal] = useState<GoalValue | null>(null);
  const [weightKg, setWeightKg] = useState("");
  const [targetWeightKg, setTargetWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isSignUp = mode === "signup";

  const submit = async (skipProfile = false) => {
    setError("");
    if (!username.trim() || !password) {
      setError("Enter username and password.");
      return;
    }
    if (isSignUp && step === 1 && !skipProfile) {
      setStep(2);
      return;
    }
    setSubmitting(true);
    const result = isSignUp
      ? await signUp({
          username: username.trim(),
          password,
          weight_kg: weightKg ? Number(weightKg) : 70,
          target_weight_kg: selectedGoal === "weight_loss" && targetWeightKg ? Number(targetWeightKg) : null,
          height_cm: heightCm ? Number(heightCm) : 170,
          gender,
          activity_level: activityLevel,
          goal: selectedGoal ?? "",
        })
      : await signIn(username.trim(), password);
    setSubmitting(false);
    if (!result.success) setError(result.error || "Request failed.");
  };

  return (
    <GradientScreen>
      <ScrollView contentContainerStyle={styles.wrapper} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Daily Log</Text>
          <Text style={styles.subtitle}>{isSignUp ? "Create an account" : "Sign in to your account"}</Text>

          {(!isSignUp || step === 1) && (
            <>
              <Field label="Username" value={username} onChangeText={setUsername} placeholder="Username" />
              <Field label="Password" value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />
            </>
          )}

          {isSignUp && step === 1 && (
            <>
              <ChoiceRow label="Gender" value={gender} options={genderOptions} onChange={setGender} />
              <ChoiceRow label="Activity level" value={activityLevel} options={activityOptions} onChange={setActivityLevel} />
            </>
          )}

          {isSignUp && step === 2 && (
            <View style={styles.goalPanel}>
              <Text style={styles.heading}>Choose your goal</Text>
              <Text style={styles.goalSub}>Optional. Add the details you know now, or skip and fill them later.</Text>
              <View style={styles.goalGrid}>
                {goals.map((goal) => {
                  const active = selectedGoal === goal.value;
                  return (
                    <Pressable
                      key={goal.value}
                      style={[styles.goalCard, active && styles.goalCardActive]}
                      onPress={() => setSelectedGoal(active ? null : goal.value)}
                    >
                      <Text style={styles.goalTitle}>{goal.title}</Text>
                      <Text style={styles.goalDescription}>{goal.description}</Text>
                      {active && <View style={styles.activeDot} />}
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.bodyPanel}>
                <Field label="Current weight optional" value={weightKg} onChangeText={setWeightKg} placeholder="e.g. 72" suffix="kg" keyboardType="decimal-pad" />
                <Field label="Height optional" value={heightCm} onChangeText={setHeightCm} placeholder="e.g. 175" suffix="cm" keyboardType="decimal-pad" />
                {selectedGoal === "weight_loss" && (
                  <Field label="Target weight optional" value={targetWeightKg} onChangeText={setTargetWeightKg} placeholder="e.g. 68" suffix="kg" keyboardType="decimal-pad" />
                )}
              </View>
            </View>
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Pressable style={[styles.primaryButton, submitting && styles.disabled]} onPress={() => submit()} disabled={submitting}>
            <Text style={styles.primaryText}>{submitting ? "..." : isSignUp ? (step === 1 ? "Next" : "Complete Sign up") : "Sign in"}</Text>
          </Pressable>

          {isSignUp && step === 2 && (
            <View style={styles.secondaryActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setStep(1)}>
                <Text style={styles.secondaryText}>Back</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => submit(true)} disabled={submitting}>
                <Text style={styles.secondaryText}>Skip for now</Text>
              </Pressable>
            </View>
          )}

          <Pressable
            style={styles.switchButton}
            onPress={() => {
              setMode(isSignUp ? "signin" : "signup");
              setStep(1);
              setError("");
              setSelectedGoal(null);
            }}
          >
            <Text style={styles.switchText}>{isSignUp ? "Already have an account? Sign in" : "No account? Sign up"}</Text>
          </Pressable>
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

function ChoiceRow({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.choiceWrap}>
        {options.map((option) => {
          const active = option === value;
          return (
            <Pressable key={option} style={[styles.choice, active && styles.choiceActive]} onPress={() => onChange(option)}>
              <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{option.replace("_", " ")}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    borderRadius: 16,
    backgroundColor: colors.panel,
    padding: 24,
    gap: 14,
    ...shadow,
  },
  title: {
    textAlign: "center",
    fontSize: 24,
    fontWeight: "800",
    color: colors.ink,
  },
  subtitle: {
    textAlign: "center",
    color: colors.muted,
    fontSize: 15,
    marginBottom: 8,
  },
  field: {
    gap: 6,
  },
  label: {
    color: colors.inkSoft,
    fontSize: 14,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  inputWrap: {
    minHeight: 45,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
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
    fontWeight: "700",
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
  },
  choiceActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  choiceText: {
    color: colors.ink,
    fontSize: 13,
  },
  choiceTextActive: {
    color: colors.panel,
  },
  goalPanel: {
    gap: 12,
  },
  heading: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "700",
  },
  goalSub: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  goalGrid: {
    gap: 10,
  },
  goalCard: {
    minHeight: 86,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 14,
    backgroundColor: colors.panel,
  },
  goalCardActive: {
    borderColor: "#16a34a",
    backgroundColor: "#f0fdf4",
  },
  activeDot: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#16a34a",
  },
  goalTitle: {
    color: colors.ink,
    fontWeight: "700",
    fontSize: 14,
  },
  goalDescription: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
  bodyPanel: {
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(22,163,74,0.2)",
    backgroundColor: "#f8fafc",
  },
  error: {
    color: "#b91c1c",
    fontSize: 14,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: "#f9fafb",
    fontWeight: "600",
    fontSize: 16,
  },
  disabled: {
    opacity: 0.7,
  },
  secondaryActions: {
    flexDirection: "row",
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 45,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  secondaryText: {
    color: colors.ink,
    fontWeight: "600",
  },
  switchButton: {
    padding: 8,
  },
  switchText: {
    color: colors.muted,
    textDecorationLine: "underline",
    textAlign: "center",
  },
});
