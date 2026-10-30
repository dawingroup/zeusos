/**
 * Competitor archive (docs/MARKET_INTELLIGENCE_DATA_MODEL_AUDIT_2026_10.md, D-3).
 *
 * The client never hard-deletes a competitor: it stamps `archived: true`
 * with who, when and why, and lists hide the row in memory (a
 * `where('archived', '!=', true)` would exclude documents that lack the
 * field — every one written before this shipped). A hard delete is
 * admin-only in the rules and cascades server-side (`onCompetitorDeleted`).
 */

export interface ArchiveStamp {
  archived?: boolean;
  archivedAt?: unknown;
  archivedBy?: string | null;
  archivedByName?: string | null;
  archiveReason?: string | null;
}

export function isArchivedCompetitor(c: ArchiveStamp | null | undefined): boolean {
  return c?.archived === true;
}

/** The rows a list shows: archived ones only when asked for. */
export function visibleCompetitors<T extends ArchiveStamp>(list: readonly T[], includeArchived = false): T[] {
  return includeArchived ? [...list] : list.filter((c) => !isArchivedCompetitor(c));
}

/** The fields an archive writes (the caller adds its Timestamp and `updatedAt`). */
export function archiveFields(reason: string, actor?: { id: string; name?: string | null }): Required<Pick<ArchiveStamp, 'archived' | 'archivedBy' | 'archivedByName' | 'archiveReason'>> {
  return {
    archived: true,
    archivedBy: actor?.id ?? null,
    archivedByName: actor?.name ?? null,
    archiveReason: reason.trim() || null,
  };
}

/** The fields a restore clears. */
export const RESTORE_FIELDS = {
  archived: false,
  archivedAt: null,
  archivedBy: null,
  archivedByName: null,
  archiveReason: null,
} as const;
