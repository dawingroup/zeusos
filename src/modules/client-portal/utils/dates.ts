/**
 * Date coercion helper for the client portal.
 *
 * Firestore date fields can arrive as a few different shapes depending on
 * the write path:
 *   - A real `Timestamp` instance (has `.toDate()`) — the normal path.
 *   - A plain `Date` (someone passed `new Date()` directly).
 *   - An ISO date string (Cloud Function emit, legacy migration).
 *   - A unix-ms `number` (older docs).
 *   - `undefined` / `null` (field absent).
 *
 * Calling `.toDate()` blindly on these throws `TypeError: x.toDate is not a
 * function` for every non-Timestamp case, which crashed the production
 * dashboard for projects whose `baselineDate`/`dueDate` weren't Timestamps.
 * Use `tsToDate` at every render-site that consumes a Firestore date.
 *
 * Returns `undefined` for any value that can't be turned into a real Date,
 * so call sites can fall back with `?? defaultDate` or render an em-dash.
 */
export function tsToDate(value: unknown): Date | undefined {
  if (value == null) return undefined;
  // Firestore Timestamp duck-type — toDate exists and returns a Date.
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    try {
      const d = (value as { toDate: () => Date }).toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : undefined;
    } catch {
      return undefined;
    }
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}
