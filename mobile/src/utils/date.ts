export function toYMD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDisplayDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatLongDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatHour(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}${suffix}`;
}

export function formatSliderTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${String(mins).padStart(2, "0")} ${suffix}`;
}

// "YYYY-MM-DD" -> short weekday label, e.g. "Mon". Used for the last-7-days tracker graphs.
export function formatWeekday(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });
}

export function formatMonthYear(date: Date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

// Matches the weight-entries list format: "Jan 15, 2024" (no weekday).
export function formatEntryDate(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Matches the weight chart's x-axis tick format: "Jan".
export function formatMonthShort(timestamp: number) {
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short" });
}

export function pastDays(count: number) {
  const today = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (count - 1 - index));
    return toYMD(date);
  });
}
