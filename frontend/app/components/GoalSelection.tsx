"use client";

import styles from "./GoalSelection.module.css";


export type GoalValue =
  | "muscle_gain"
  | "weight_loss"
  | "skin_health"
  | "hair_growth"
  | "energy_boost"
  | "pcos";

const GOALS = [
  {
    value: "muscle_gain",
    title: "Muscle Gain",
    description: "Track protein and strength nutrients",
  },
  {
    value: "weight_loss",
    title: "Weight Loss",
    description: "Track calories and fat burn",
  },
  {
    value: "skin_health",
    title: "Skin Health",
    description: "Track Vitamin C, E and hydration",
  },
  {
    value: "hair_growth",
    title: "Hair Growth",
    description: "Track biotin, B12 and iron",
  },
  {
    value: "energy_boost",
    title: "Energy Boost",
    description: "Track iron, B vitamins and complex carbs",
  },
  {
    value: "pcos",
    title: "PCOS / PCOD",
    description: "Track blood sugar and hormone balance",
  },
];

type GoalSelectionProps = {
  selectedGoals: GoalValue[];
  onGoalChange: (values: GoalValue[]) => void;
  onWeightChange: (value: string) => void;
  onTargetWeightChange: (value: string) => void;
  onHeightChange: (value: string) => void;
  currWeight: string;
  currTargetWeight: string;
  currHeight: string;
};

export default function GoalSelection({
  selectedGoals,
  onGoalChange,
  onWeightChange,
  onTargetWeightChange,
  onHeightChange,
  currWeight,
  currTargetWeight,
  currHeight,
}: GoalSelectionProps) {
  const handleSelect = (value: GoalValue) => {
    onGoalChange(selectedGoals.includes(value) ? selectedGoals.filter((goal) => goal !== value) : [...selectedGoals, value]);
  };

  return (
    <div className={styles.goalPanel}>
      <h2 className={styles.heading}>
        Choose your goals
      </h2>
      <p className={styles.subheading}>
        Optional. Pick as many as apply, or skip and fill them later.
      </p>

      <div className={styles.goalGrid}>
        {GOALS.map((goal) => {
          const isActive = selectedGoals.includes(goal.value as GoalValue);

          return (
            <button
              key={goal.value}
              type="button"
              onClick={() => handleSelect(goal.value as GoalValue)}
              className={`${styles.goalCard} ${isActive ? styles.goalCardActive : ""}`}
              aria-pressed={isActive}
            >
              <span className={styles.goalTitle}>
                {goal.title}
              </span>
              <p className={styles.goalDescription}>
                {goal.description}
              </p>
            </button>
          );
        })}
      </div>

      <div className={styles.bodyPanel}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              Current weight <span>optional</span>
            </span>
            <span className={styles.fieldControl}>
              <input
                type="number"
                step="0.1"
                value={currWeight}
                onChange={(e) => onWeightChange(e.target.value)}
                className={styles.fieldInput}
                placeholder="e.g. 72"
              />
              <span className={styles.unit}>kg</span>
            </span>
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              Height <span>optional</span>
            </span>
            <span className={styles.fieldControl}>
              <input
                type="number"
                step="0.1"
                value={currHeight}
                onChange={(e) => onHeightChange(e.target.value)}
                className={styles.fieldInput}
                placeholder="e.g. 175"
              />
              <span className={styles.unit}>cm</span>
            </span>
          </label>

        {selectedGoals.includes("weight_loss") && (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>
              Target weight <span>optional</span>
            </span>
            <span className={styles.fieldControl}>
              <input
                type="number"
                step="0.1"
                value={currTargetWeight}
                onChange={(e) => onTargetWeightChange(e.target.value)}
                className={styles.fieldInput}
                placeholder="e.g. 68"
              />
              <span className={styles.unit}>kg</span>
            </span>
          </label>
        )}
      </div>
    </div>
  );
}
