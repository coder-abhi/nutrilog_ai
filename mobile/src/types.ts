export type User = {
  username: string;
  weight_kg: number;
  target_weight_kg?: number | null;
  height_cm: number;
  gender: string;
  activity_level: string;
  goal: string;
};

export type SummaryData = {
  calories_intake: number;
  calories_burned: number;
  protein: number;
  carbs: number;
  fibre: number;
  sugar: number;
};

export type FoodEntry = {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  sugar: number;
  timestamp?: string | null;
};

export type ActivityEntry = {
  type: string;
  quantity: number;
  unit: string;
  calories_burned: number;
  timestamp?: string | null;
};

export type TrackerEntry = {
  date: string;
  value: number;
};

export type TrackerCard = {
  id: string;
  name: string;
  value_type: "boolean" | "numeric";
  target_days_per_week: number;
  description: string;
  is_visible: boolean;
  entries: TrackerEntry[];
};
