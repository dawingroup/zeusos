/**
 * Date utilities for the advisory delivery module.
 *
 * Firestore returns Timestamp objects, not JS Dates. Passing a Timestamp
 * directly to `new Date()` throws "RangeError: Invalid time value".
 * Use `toJsDate` anywhere a project/document field might be a Timestamp.
 */

/** Anything Firestore might store for a date field at runtime */
type DateLike = Date | { toDate: () => Date } | string | number | null | undefined;

/**
 * Safely convert a Firestore Timestamp, JS Date, string, or number to a Date.
 * Returns `null` if the value is absent or cannot be parsed.
 */
export function toJsDate(value: DateLike): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && 'toDate' in value) return value.toDate();
  const d = new Date(value as string | number);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format a date-like value as "D Mon YYYY" (en-GB short).
 * Returns `fallback` (default "N/A") if the value is missing or invalid.
 */
export function fmtDate(value: DateLike, fallback = 'N/A'): string {
  const d = toJsDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
