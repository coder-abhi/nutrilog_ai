// Maps a value into this app's 0-100 SVG viewBox coordinate space given a min/max range.
// A degenerate range (min === max) falls back to a span of 1 to avoid dividing by zero.
export function normalizeToPercent(value: number, min: number, max: number): number {
  const span = max - min || 1;
  return ((value - min) / span) * 100;
}

// Evenly spaces `count` points across the 0-100 x-axis; a single point sits at the midpoint.
export function evenXPosition(index: number, count: number): number {
  if (count <= 1) return 50;
  return (index / (count - 1)) * 100;
}
