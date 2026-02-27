"use client";

import { useState } from "react";


type GoalValue =
  | "muscle_gain"
  | "weight_loss"
  | "skin_health"
  | "hair_growth"
  | "energy_boost"
  | "pcos";

interface Props {
  onChange: (value: GoalValue) => void;
}

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

export default function GoalSelection({ onGoalChange, onWeightChange, onTargetWeightChange, onHeightChange, currWeight, currTargetWeight, currHeight}) {
  const [selectedGoal, setSelectedGoal] = useState<GoalValue | null>(null);
  const [currentWeight, setCurrentWeight] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [height, setHeight] = useState("");

  const handleSelect = (value: GoalValue) => {
    setSelectedGoal(value);
    onGoalChange(value);
  };

  const showBodyFields =
    selectedGoal === "muscle_gain" || selectedGoal === "weight_loss";

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">
        Choose your goal
      </h2>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4">
        {GOALS.map((goal) => {
          const isActive = selectedGoal === goal.value;

          return (
            
            <button
              key={goal.value}
              type="button"
              onClick={() => handleSelect(goal.value as GoalValue)}
              className={`
                relative rounded-xl border p-4 text-left transition
                ${
                  isActive
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200 bg-white"
                }
              `}
            >
              
              <h3 className="font-medium text-gray-900 text-sm">
                {goal.title}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                {goal.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Conditional Fields */}
      {showBodyFields && (
        <div className="space-y-4 pt-2 text-black">
          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Current weight (kg)
            </label>
            <input
              type="number"
              step="0.1"
              value={currWeight}
              onChange={(e) =>  onWeightChange(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="e.g. 72"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Target weight (kg)
            </label>
            <input
              type="number"
              step="0.1"
              value={currTargetWeight}
              onChange={(e) => onTargetWeightChange(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="e.g. 78"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1">
              Height (cm)
            </label>
            <input
              type="number"
              step="0.1"
              value={currHeight}
              onChange={(e) => onHeightChange(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="e.g. 175"
            />
          </div>
        </div>
      )}
    </div>
  );
}