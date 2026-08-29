export function toYMD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// The tracking day rolls over at 3 AM, not midnight, so a late night logged at 1 AM still
// counts toward the previous day instead of starting a new (mostly empty) one. Mirrors
// DAY_WINDOW_START_MINUTES in the mobile app and DAY_START_HOUR in the backend.
export const DAY_START_HOUR = 3;

export function logicalDate(date: Date = new Date()): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (date.getHours() < DAY_START_HOUR) result.setDate(result.getDate() - 1);
  return result;
}

export function logicalToYMD(date: Date = new Date()) {
  return toYMD(logicalDate(date));
}

export function getCurrentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

// Reframes a "minutes since midnight" value (0-1439) as "minutes since the 3 AM day start"
// (also 0-1439, wrapping), so a day-relative chart lines up with the 3 AM tracking-day boundary
// instead of midnight.
export function toDisplayMinutes(actualMinutes: number) {
  return (actualMinutes - DAY_START_HOUR * 60 + 1440) % 1440;
}

export function fromDisplayMinutes(displayMinutes: number) {
  return (displayMinutes + DAY_START_HOUR * 60) % 1440;
}
