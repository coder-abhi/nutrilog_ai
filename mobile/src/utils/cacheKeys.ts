// Shared cache keys so screens reading the same data (e.g. the dashboard and the tracker
// screen both showing tracker cards) hit one cached copy instead of fetching independently.
export const TRACKER_CARDS_CACHE_KEY = "tracker_cards";

export const PASSIVE_CALORIE_CACHE_KEY = "passive_calorie_burned";

export const INSULIN_CURVES_CACHE_KEY = "insulin_curves_last_24h";

export function dashboardSummaryCacheKey(date: string, days: number) {
  return `today_summary:${date}:${days}`;
}
