import type { TrackerCard } from "@/types";
import { toYMD } from "@/utils/date";

export function weekKey(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return toYMD(date);
}

export function calculateStreak(card: TrackerCard) {
  const byDate = new Map(card.entries.map((entry) => [entry.date, entry.value]));
  // Boolean trackers target a number of days/week; numeric trackers target a total
  // quantity/week (e.g. 50 pushups). Both reduce to "does this week's total reach the target",
  // since boolean entries are always 0/1.
  const weeklyTotals = new Map<string, number>();
  card.entries.forEach((entry) => {
    const key = weekKey(entry.date);
    weeklyTotals.set(key, (weeklyTotals.get(key) ?? 0) + entry.value);
  });
  const target = card.value_type === "numeric" ? card.target_value ?? 0 : card.target_days_per_week;

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 90; i += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = toYMD(date);
    const weeklyDone = target > 0 && (weeklyTotals.get(weekKey(dateStr)) ?? 0) >= target;
    if (weeklyDone || (byDate.get(dateStr) ?? 0) > 0) streak += 1;
    else break;
  }
  return streak;
}
