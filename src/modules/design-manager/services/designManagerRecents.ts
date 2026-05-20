/**
 * LocalStorage-backed "recent projects" for Design Manager (resume work quickly).
 */

const STORAGE_KEY = 'dawin-dm-recent-projects';
const MAX_RECENTS = 8;

export interface DesignManagerRecentEntry {
  id: string;
  name: string;
  code: string;
  visitedAt: number;
}

function safeParse(raw: string | null): DesignManagerRecentEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x) =>
          x &&
          typeof x === 'object' &&
          typeof (x as { id?: string }).id === 'string' &&
          typeof (x as { name?: string }).name === 'string' &&
          typeof (x as { code?: string }).code === 'string' &&
          typeof (x as { visitedAt?: number }).visitedAt === 'number',
      )
      .map((x) => ({
        id: (x as DesignManagerRecentEntry).id,
        name: (x as DesignManagerRecentEntry).name,
        code: (x as DesignManagerRecentEntry).code,
        visitedAt: (x as DesignManagerRecentEntry).visitedAt,
      }));
  } catch {
    return [];
  }
}

export function readDesignManagerRecents(): DesignManagerRecentEntry[] {
  if (typeof window === 'undefined') return [];
  return safeParse(localStorage.getItem(STORAGE_KEY));
}

export function recordDesignManagerRecent(row: { id: string; name: string; code: string }): void {
  if (typeof window === 'undefined') return;
  const prev = readDesignManagerRecents().filter((e) => e.id !== row.id);
  const next: DesignManagerRecentEntry[] = [
    { id: row.id, name: row.name, code: row.code, visitedAt: Date.now() },
    ...prev,
  ].slice(0, MAX_RECENTS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // quota / private mode
  }
}
