/**
 * Enum → label. The one place a snake_case / kebab-case / camelCase value
 * becomes something a person reads.
 *
 * Chips, table cells and PDF cells that print `in_progress` or
 * `revision_requested` with CSS `capitalize` doing nothing about the
 * underscore are the defect this removes. `enumLabel(value, LABELS)` uses the
 * module's explicit map when it has one and humanises otherwise, so the raw
 * slug never reaches the screen either way.
 */

/** 'in_progress' | 'in-progress' | 'inProgress' → 'In Progress' */
export function humanizeEnum(value: string): string {
  const spaced = value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!spaced) return '';
  return spaced
    .split(' ')
    .map((w) => (w === w.toUpperCase() && w.length <= 3 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

/**
 * Label for an enum value: the module's map first, humanised fallback
 * second, `fallback` (default "—") when the value is empty.
 */
export function enumLabel<K extends string>(
  value: K | string | null | undefined,
  labels?: Partial<Record<K, string>> | Record<string, string>,
  fallback = '—',
): string {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const hit = (labels as Record<string, string> | undefined)?.[value];
  return hit ?? humanizeEnum(value);
}

/** Derive a default label map from a tone/style map's keys. */
export function labelsFromTones<K extends string>(tones: Record<K, unknown>): Record<K, string> {
  return Object.fromEntries((Object.keys(tones) as K[]).map((k) => [k, humanizeEnum(k)])) as Record<K, string>;
}
