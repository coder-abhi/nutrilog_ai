import type { TrackerCard } from "@/types";
import { pastDays } from "@/utils/date";

// Sample tracker cards shown to a brand-new account that hasn't created any trackers yet, so
// the empty tracker screen demonstrates what the feature looks like instead of just being
// blank. These are synthetic client-side data only - they're never sent to or read from the
// backend, and are identified by id so the UI can keep them read-only.
const DEMO_PUSHUPS_ID = "demo-pushups";
const DEMO_WAKE_UP_ID = "demo-wake-up-early";

const DEMO_IDS: ReadonlySet<string> = new Set([DEMO_PUSHUPS_ID, DEMO_WAKE_UP_ID]);

export function isDemoTrackerId(id: string): boolean {
  return DEMO_IDS.has(id);
}

export function getDemoTrackerCards(): TrackerCard[] {
  const days = pastDays(7);
  const pushupCounts = [20, 0, 25, 30, 0, 15, 10];
  const wakeDone = [1, 1, 0, 1, 1, 0, 1];
  return [
    {
      id: DEMO_PUSHUPS_ID,
      name: "Push ups",
      value_type: "numeric",
      target_days_per_week: 7,
      target_value: 100,
      description: "Example tracker - create your own below to start logging real data.",
      is_visible: true,
      entries: days.map((date, index) => ({ date, value: pushupCounts[index] })),
    },
    {
      id: DEMO_WAKE_UP_ID,
      name: "Wake up early",
      value_type: "boolean",
      target_days_per_week: 5,
      target_value: null,
      description: "Example tracker - create your own below to start logging real data.",
      is_visible: true,
      entries: days.map((date, index) => ({ date, value: wakeDone[index] })),
    },
  ];
}
