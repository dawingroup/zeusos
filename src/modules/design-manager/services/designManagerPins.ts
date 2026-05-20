/**
 * Per-browser pinned projects for Design Manager ("Working on" strip).
 * Persisted in localStorage (upgrade path: sync to Firestore per user later).
 */

const STORAGE_KEY = 'dawin-dm-pinned-project-ids';
export const MAX_PINNED_PROJECTS = 8;

export function readPinnedProjectIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string' && x.length > 0);
  } catch {
    return [];
  }
}

export function writePinnedProjectIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  const unique = [...new Set(ids)].slice(0, MAX_PINNED_PROJECTS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(unique));
  } catch {
    // quota / private mode
  }
}

/** Add to front (most recent intent first); cap at MAX_PINNED_PROJECTS. */
export function mergePinToggle(current: string[], projectId: string): string[] {
  const without = current.filter((id) => id !== projectId);
  if (without.length === current.length) {
    const next = [projectId, ...without];
    return next.slice(0, MAX_PINNED_PROJECTS);
  }
  return without;
}
