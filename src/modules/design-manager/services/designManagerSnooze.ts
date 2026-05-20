/**
 * Hide projects from the default dashboard list until a date (localStorage).
 */

const STORAGE_KEY = 'dawin-dm-snooze-projects';

export interface SnoozeRecord {
  projectId: string;
  untilMs: number;
}

function readRaw(): SnoozeRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x) =>
          x &&
          typeof x === 'object' &&
          typeof (x as SnoozeRecord).projectId === 'string' &&
          typeof (x as SnoozeRecord).untilMs === 'number',
      )
      .map((x) => ({ projectId: (x as SnoozeRecord).projectId, untilMs: (x as SnoozeRecord).untilMs }));
  } catch {
    return [];
  }
}

function writeRaw(records: SnoozeRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    /* quota / private mode */
  }
}

/** Drop expired entries and persist. */
export function pruneAndReadSnoozes(nowMs: number = Date.now()): SnoozeRecord[] {
  const all = readRaw();
  const kept = all.filter((r) => r.untilMs > nowMs);
  if (kept.length !== all.length) {
    writeRaw(kept);
  }
  return kept;
}

export function buildSnoozeUntilMap(nowMs: number = Date.now()): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of pruneAndReadSnoozes(nowMs)) {
    m.set(r.projectId, r.untilMs);
  }
  return m;
}

export function snoozeProjectForDays(projectId: string, days: number, nowMs: number = Date.now()): void {
  const untilMs = nowMs + Math.max(1, days) * 86_400_000;
  const prev = pruneAndReadSnoozes(nowMs).filter((r) => r.projectId !== projectId);
  writeRaw([...prev, { projectId, untilMs }]);
}

export function clearProjectSnooze(projectId: string): void {
  const now = Date.now();
  const next = pruneAndReadSnoozes(now).filter((r) => r.projectId !== projectId);
  writeRaw(next);
}

export function countActiveSnoozes(snoozeUntilByProject: Map<string, number>, nowMs: number = Date.now()): number {
  let n = 0;
  for (const until of snoozeUntilByProject.values()) {
    if (until > nowMs) n += 1;
  }
  return n;
}
