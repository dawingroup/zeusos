/**
 * Strip undefined values at any depth — Firestore rejects them.
 * Preserves arrays, Dates, and Firestore Timestamps (objects with `.toDate()`).
 */
export const stripUndefined = (obj: Record<string, any>): Record<string, any> => {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && typeof v.toDate !== 'function') {
      clean[k] = stripUndefined(v);
    } else {
      clean[k] = v;
    }
  }
  return clean;
};
