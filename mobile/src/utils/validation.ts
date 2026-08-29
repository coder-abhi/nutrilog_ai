// Validates a numeric text-input value that must be a positive number.
// Pass `optional: true` for fields where an empty value is valid (e.g. an optional profile
// field) — in that case only a non-empty, non-positive value is rejected.
export function validatePositiveNumber(value: string, label: string, options: { optional?: boolean } = {}): string | null {
  if (!value) {
    return options.optional ? null : `Enter a valid ${label}.`;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return options.optional ? `Enter a valid ${label}, or leave it empty.` : `Enter a valid ${label}.`;
  }
  return null;
}
