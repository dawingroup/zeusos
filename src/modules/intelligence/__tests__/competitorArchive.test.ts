/**
 * Competitor archive (audit 2026-10, D-3): archived rows leave lists in
 * memory, the stamp says who / why, and a restore clears every field.
 */
import { describe, expect, it } from 'vitest';

import { RESTORE_FIELDS, archiveFields, isArchivedCompetitor, visibleCompetitors } from '../utils/competitorArchive';

describe('competitor archive', () => {
  const rows = [
    { id: 'a', name: 'Acme' },
    { id: 'b', name: 'Beta', archived: true, archivedAt: 'x' },
    { id: 'c', name: 'Gamma', archived: false },
  ];

  it('hides archived rows unless asked for — rows lacking the field count as live', () => {
    expect(visibleCompetitors(rows).map((r) => r.id)).toEqual(['a', 'c']);
    expect(visibleCompetitors(rows, true).map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(isArchivedCompetitor(undefined)).toBe(false);
    expect(isArchivedCompetitor({ archived: true })).toBe(true);
  });

  it('archiveFields stamps who and why; blank reason and missing actor are null, never undefined', () => {
    expect(archiveFields('Out of market', { id: 'u1', name: 'Dana' })).toEqual({
      archived: true,
      archivedBy: 'u1',
      archivedByName: 'Dana',
      archiveReason: 'Out of market',
    });
    expect(archiveFields('   ')).toEqual({ archived: true, archivedBy: null, archivedByName: null, archiveReason: null });
  });

  it('a restore clears every archive field', () => {
    expect(Object.keys(RESTORE_FIELDS).sort()).toEqual(['archiveReason', 'archived', 'archivedAt', 'archivedBy', 'archivedByName']);
    expect(RESTORE_FIELDS.archived).toBe(false);
  });
});
