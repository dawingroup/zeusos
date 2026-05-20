/**
 * Tests for enrichHardwareSchedule — materials library resolution
 * + sorting + sorted-filter invariant.
 */
import { describe, it, expect } from 'vitest';
import {
  enrichHardwareSchedule,
  hardwareInventoryIds,
} from '../hardwareScheduleEnricher';
import type { HardwareScheduleEntry } from '../../types/mdp.types';
import type { ResolvedInventoryItem } from '../scheduleLibraryResolvers';

function entry(over: Partial<HardwareScheduleEntry> = {}): HardwareScheduleEntry {
  return {
    hardwareName: over.hardwareName ?? 'Hinge 110°',
    inventoryItemId: over.inventoryItemId ?? 'inv-hinge',
    quantity: over.quantity ?? 2,
    perUnit: over.perUnit ?? 'pcs',
    boringRequired: over.boringRequired ?? false,
    ...over,
  };
}

function resolver(
  rows: Record<string, ResolvedInventoryItem>,
) {
  return (id: string) => rows[id];
}

describe('hardwareInventoryIds', () => {
  it('returns unique non-blank ids', () => {
    const ids = hardwareInventoryIds([
      entry({ inventoryItemId: 'a' }),
      entry({ inventoryItemId: 'a' }),
      entry({ inventoryItemId: 'b' }),
      entry({ inventoryItemId: '' }),
    ]);
    expect(ids.sort()).toEqual(['a', 'b']);
  });

  it('returns [] for empty input', () => {
    expect(hardwareInventoryIds([])).toEqual([]);
  });
});

describe('enrichHardwareSchedule — resolution', () => {
  it('carries SKU / brand / supplier / cost from the library into each row', () => {
    const rows = enrichHardwareSchedule(
      [entry({ inventoryItemId: 'inv-hinge' })],
      resolver({
        'inv-hinge': {
          id: 'inv-hinge', sku: 'HNG-110-SS',
          name: 'Blum Clip-on Hinge 110°',
          category: 'hardware', subcategory: 'hinges',
          brand: 'Blum', supplier: 'Metroline',
          unitCost: 12500, currency: 'UGX', unit: 'pcs',
        },
      }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].resolved).toBe(true);
    expect(rows[0].sku).toBe('HNG-110-SS');
    expect(rows[0].resolvedName).toBe('Blum Clip-on Hinge 110°');
    expect(rows[0].brand).toBe('Blum');
    expect(rows[0].supplier).toBe('Metroline');
    expect(rows[0].unitCost).toBe(12500);
    expect(rows[0].currency).toBe('UGX');
  });

  it('marks rows with no library match as unresolved', () => {
    const rows = enrichHardwareSchedule([
      entry({ inventoryItemId: 'missing' }),
    ]);
    expect(rows[0].resolved).toBe(false);
    expect(rows[0].sku).toBeUndefined();
    // Raw hardware name still surfaces so the schedule row isn't blank.
    expect(rows[0].hardwareName).toBe('Hinge 110°');
  });

  it('treats entries with blank inventoryItemId as unresolved without calling the resolver', () => {
    let callCount = 0;
    const rows = enrichHardwareSchedule(
      [entry({ inventoryItemId: '' })],
      () => { callCount++; return undefined; },
    );
    expect(callCount).toBe(0);
    expect(rows[0].resolved).toBe(false);
  });
});

describe('enrichHardwareSchedule — sorting', () => {
  it('resolved rows sort before unresolved, then by category / subcategory / name', () => {
    const rows = enrichHardwareSchedule(
      [
        entry({ inventoryItemId: 'a', hardwareName: 'Alpha' }),
        entry({ inventoryItemId: 'z', hardwareName: 'Zeta' }),
        entry({ inventoryItemId: 'missing', hardwareName: 'Orphan' }),
        entry({ inventoryItemId: 'm', hardwareName: 'Mike' }),
      ],
      resolver({
        a: { id: 'a', sku: 'A-001', name: 'Alpha Hinge', category: 'hardware', subcategory: 'hinges', unit: 'pcs' },
        z: { id: 'z', sku: 'Z-001', name: 'Zeta Runner', category: 'hardware', subcategory: 'runners', unit: 'pcs' },
        m: { id: 'm', sku: 'M-001', name: 'Mike Handle', category: 'hardware', subcategory: 'handles', unit: 'pcs' },
      }),
    );
    const names = rows.map(r => r.resolvedName ?? r.hardwareName);
    // Resolved first, grouped by subcategory alphabetically (handles,
    // hinges, runners), then unresolved.
    expect(names).toEqual(['Mike Handle', 'Alpha Hinge', 'Zeta Runner', 'Orphan']);
    expect(rows[3].resolved).toBe(false);
  });
});

describe('enrichHardwareSchedule — scope guarantee', () => {
  it('returns exactly the same number of rows as input (no library contamination)', () => {
    // The resolver carries an ENTRY NOT IN the input hardware schedule.
    // The enricher must not magically add it.
    const rows = enrichHardwareSchedule(
      [entry({ inventoryItemId: 'a' })],
      resolver({
        a: { id: 'a', sku: 'A-001', name: 'Alpha', unit: 'pcs' },
        // `z` is in the library but not referenced by the scene.
        z: { id: 'z', sku: 'Z-001', name: 'Zeta', unit: 'pcs' },
      }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].sku).toBe('A-001');
  });
});
