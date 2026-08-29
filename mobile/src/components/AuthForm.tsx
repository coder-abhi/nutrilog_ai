import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "@/auth/AuthContext";
import { GradientScreen } from "@/components/Screen";
import { colors, shadow } from "@/styles/theme";
import { validatePositiveNumber } from "@/utils/validation";

type GoalValue = "muscle_gain" | "maintain_weight" | "weight_loss" | "vitamin_focus" | "pcos";

const activityOptions = ["sedentary", "low", "moderate", "high", "very_high"];
const activityHints: Record<string, string> = {
  sedentary: "Barely any walking (under ~1 km/day), no sport or gym.",
  low: "Light week — a sport, walk or workout roughly once a week.",
  moderate: "Gym, sport or a long walk ~3x a week, or ~8k steps most days.",
  high: "Training hard 5-6x a week, or a physically demanding job.",
  very_high: "Intense training most days or heavy manual labour.",
};
const genderOptions = ["male", "female"];
const goals: { value: GoalValue; title: string }[] = [
  { value: "muscle_gain", title: "Muscle Gain" },
  { value: "maintain_weight", title: "Maintain Weight" },
  { value: "weight_loss", title: "Weight Loss" },
  { value: "vitamin_focus", title: "Vitamins & Vitality" },
  { value: "pcos", title: "PCOS / PCOD" },
];

export function AuthForm() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [step, setStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState("male");
  const [activityLevel, setActivityLevel] = useState("moderate");
  const [selectedGoals, setSelectedGoals] = useState<GoalValue[]>([]);
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
    if (isSignUp && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (isSignUp && step === 1 && !skipProfile) {
      setStep(2);
      return;
    }
    const parsedWeight = Number(weightKg);
    const parsedTargetWeight = Number(targetWeightKg);
    const parsedHeight = Number(heightCm);
    const weightError = validatePositiveNumber(weightKg, "weight (kg)", { optional: true });
    if (weightError) {
      setError(weightError);
      return;
    }
    const heightError = validatePositiveNumber(heightCm, "height (cm)", { optional: true });
    if (heightError) {
      setError(heightError);
      return;
    }
    if (selectedGoals.includes("weight_loss")) {
      const targetWeightError = validatePositiveNumber(targetWeightKg, "target weight (kg)", { optional: true });
      if (targetWeightError) {
        setError(targetWeightError);
        return;
      }
    }
    setSubmitting(true);
    const result = isSignUp
      ? await signUp({
          username: username.trim(),
          password,
          weight_kg: weightKg ? parsedWeight : 70,
          target_weight_kg: selectedGoals.includes("weight_loss") && targetWeightKg ? parsedTargetWeight : null,
          height_cm: heightCm ? parsedHeight : 170,
          gender,
          activity_level: activityLevel,
          goals: selectedGoals,
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
              <ChoiceRow
                label="Activity level"
                value={activityLevel}
                options={activityOptions}
                onChange={setActivityLevel}
                hint={activityHints[activityLevel]}
              />
            </>
          )}

          {isSignUp && step === 2 && (
            <View style={styles.goalPanel}>
              <Text style={styles.heading}>Choose your goals</Text>
              <Text style={styles.goalSub}>Optional. Pick as many as apply, or skip and fill them later.</Text>
              <View style={styles.goalGrid}>
                {goals.map((goal) => {
                  const active = selectedGoals.includes(goal.value);
                  return (
                    <Pressable
                      key={goal.value}
                      style={[styles.goalCard, active && styles.goalCardActive]}
                      onPress={() =>
                        setSelectedGoals((current) =>
                          active ? current.filter((value) => value !== goal.value) : [...current, goal.value],
                        )
                      }
                    >
                      <Text style={styles.goalTitle}>{goal.title}</Text>
                      {active && <View style={styles.activeDot} />}
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.bodyPanel}>
                <Field label="Current weight optional" value={weightKg} onChangeText={setWeightKg} placeholder="e.g. 72" suffix="kg" keyboardType="decimal-pad" />
                <HeightField valueCm={heightCm} onChangeCm={setHeightCm} />
                {selectedGoals.includes("weight_loss") && (
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
              setSelectedGoals([]);
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

function HeightField({ valueCm, onChangeCm }: { valueCm: string; onChangeCm: (cm: string) => void }) {
  const [unit, setUnit] = useState<"cm" | "ft">("cm");
  const [feet, setFeet] = useState("");
  const [inches, setInches] = useState("");

  const switchUnit = (next: "cm" | "ft") => {
    if (next === unit) return;
    if (next === "ft") {
      const cm = Number(valueCm);
      if (Number.isFinite(cm) && cm > 0) {
        const totalInches = cm / 2.54;
        setFeet(String(Math.floor(totalInches / 12)));
        setInches(String(Math.round(totalInches % 12)));
      }
    }
    setUnit(next);
  };

  const applyImperial = (nextFeet: string, nextInches: string) => {
    setFeet(nextFeet);
    setInches(nextInches);
    const f = Number(nextFeet) || 0;
    const i = Number(nextInches) || 0;
    onChangeCm(f > 0 || i > 0 ? String(Math.round((f * 12 + i) * 2.54)) : "");
  };

  return (
    <View style={styles.field}>
      <View style={styles.heightHeader}>
        <Text style={styles.label}>Height optional</Text>
        <View style={styles.unitToggle}>
          {(["cm", "ft"] as const).map((option) => (
            <Pressable
              key={option}
              style={[styles.unitOption, unit === option && styles.unitOptionActive]}
              onPress={() => switchUnit(option)}
            >
              <Text style={[styles.unitOptionText, unit === option && styles.unitOptionTextActive]}>
                {option === "cm" ? "cm" : "ft / in"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {unit === "cm" ? (
        <View style={styles.inputWrap}>
          <TextInput
            value={valueCm}
            onChangeText={onChangeCm}
            placeholder="e.g. 175"
            placeholderTextColor="#9ca3af"
            keyboardType="decimal-pad"
            style={styles.input}
          />
          <Text style={styles.unit}>cm</Text>
        </View>
      ) : (
        <View style={styles.heightImperialRow}>
          <View style={[styles.inputWrap, styles.heightImperialItem]}>
            <TextInput
              value={feet}
              onChangeText={(text) => applyImperial(text, inches)}
              placeholder="5"
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
              style={styles.input}
            />
            <Text style={styles.unit}>ft</Text>
          </View>
          <View style={[styles.inputWrap, styles.heightImperialItem]}>
            <TextInput
              value={inches}
              onChangeText={(text) => applyImperial(feet, text)}
              placeholder="9"
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
              style={styles.input}
            />
            <Text style={styles.unit}>in</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function ChoiceRow({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  hint?: string;
}) {
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
      {!!hint && <Text style={styles.choiceHint}>{hint}</Text>}
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
  heightHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  unitToggle: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    overflow: "hidden",
  },
  unitOption: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  unitOptionActive: {
    backgroundColor: colors.ink,
  },
  unitOptionText: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "600",
  },
  unitOptionTextActive: {
    color: colors.panel,
  },
  heightImperialRow: {
    flexDirection: "row",
    gap: 10,
  },
  heightImperialItem: {
    flex: 1,
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
  choiceHint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
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
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: "center",
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
