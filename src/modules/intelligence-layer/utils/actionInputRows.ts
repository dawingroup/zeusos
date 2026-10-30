/**
 * The inputs an AI-proposed action will actually run with, as label/value rows.
 *
 * A chip used to show only the model's own `summary` — "Update the supplier's
 * contact" — while `input` could name any record, recipient or amount. The
 * summary is written by the same model that may have read injected text, so a
 * person confirming it was confirming the model's description of itself
 * (a DawinOS audit finding, 2026-10). Every chip now shows these rows
 * above its run button.
 */
export interface ActionInputRow {
  key: string;
  value: string;
}

/** Longest value shown in full; the rest is cut with a count, never silently. */
export const ACTION_INPUT_MAX_CHARS = 600;

function show(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function actionInputRows(input: unknown): ActionInputRow[] {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return input === undefined || input === null ? [] : [{ key: 'input', value: clip(show(input)) }];
  }
  return Object.entries(input as Record<string, unknown>).map(([key, value]) => ({
    key,
    value: clip(show(value)),
  }));
}

function clip(text: string): string {
  if (text.length <= ACTION_INPUT_MAX_CHARS) return text;
  return `${text.slice(0, ACTION_INPUT_MAX_CHARS)}… (+${text.length - ACTION_INPUT_MAX_CHARS} more characters)`;
}
