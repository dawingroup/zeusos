/**
 * Minor-unit money formatting + parsing for the AM UI.
 *
 * Every commercial number on disk is a minor-unit integer (UGX cents = 1,
 * USD cents = 0.01 — see spec §12 NFRs "Multi-currency"). Rendering
 * happens through these helpers so the UI never reads/writes the major
 * unit directly.
 */

export function formatMinor(minor: number | undefined | null, currency?: string): string {
  if (minor == null || !Number.isFinite(minor)) return '—';
  const major = minor / 100;
  const formatted = major.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${currency} ${formatted}` : formatted;
}

export function parseMajorToMinor(major: string): number | null {
  if (!major) return null;
  const cleaned = major.replace(/,/g, '').trim();
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
