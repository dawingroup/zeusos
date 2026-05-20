/**
 * Tests for buildAssemblyInventoryRows — the inventory-table row
 * builder that feeds the I003 project-wide assembly index.
 */
import { describe, it, expect } from 'vitest';
import { buildAssemblyInventoryRows } from '../sceneScheduleSheets';

describe('buildAssemblyInventoryRows', () => {
  it('flattens cabinets → assemblies with cabinet ref + detail drawing', () => {
    const rows = buildAssemblyInventoryRows([
      {
        cabinetRef: 'C01',
        cabinetLabel: 'KB-A',
        assemblies: [
          { assemblyType: 'carcass', displayName: 'Main Carcase', partCount: 5 },
          { assemblyType: 'drawer_box', displayName: 'Top Drawer', partCount: 5 },
        ],
      },
      {
        cabinetRef: 'C02',
        cabinetLabel: 'KB-B',
        assemblies: [
          { assemblyType: 'carcass', displayName: 'Main Carcase', partCount: 6 },
        ],
      },
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[0].cabinetRef).toBe('C01');
    expect(rows[0].assemblyType).toBe('carcass');
    expect(rows[0].partCount).toBe(5);
    // Detail drawing points at the per-cabinet partDetail sheet numbering.
    expect(rows[0].detailDrawing).toMatch(/^C01-I2\d{2}$/);
    expect(rows[1].detailDrawing).toMatch(/^C01-I2\d{2}$/);
    expect(rows[2].cabinetRef).toBe('C02');
  });

  it('returns [] for no cabinets', () => {
    expect(buildAssemblyInventoryRows([])).toEqual([]);
  });

  it('skips cabinets with no assemblies without producing rows', () => {
    const rows = buildAssemblyInventoryRows([
      { cabinetRef: 'C01', cabinetLabel: 'KB-A', assemblies: [] },
    ]);
    expect(rows).toEqual([]);
  });

  it('preserves assembly order within a cabinet (drives I2xx sequence)', () => {
    const rows = buildAssemblyInventoryRows([
      {
        cabinetRef: 'C01',
        cabinetLabel: 'KB-A',
        assemblies: [
          { assemblyType: 'carcass', displayName: 'A', partCount: 1 },
          { assemblyType: 'door_assembly', displayName: 'B', partCount: 1 },
          { assemblyType: 'drawer_box', displayName: 'C', partCount: 1 },
        ],
      },
    ]);
    expect(rows.map(r => r.assemblyType)).toEqual(['carcass', 'door_assembly', 'drawer_box']);
    // I2xx sequence increments by position.
    expect(rows[0].detailDrawing).toBe('C01-I201');
    expect(rows[1].detailDrawing).toBe('C01-I202');
    expect(rows[2].detailDrawing).toBe('C01-I203');
  });
});

describe('SHEET_NUMBERING.assemblyInventory slot', () => {
  it('is I003 — after cover + contents, before sub-cover dividers', async () => {
    const { SHEET_NUMBERING } =
      await import('../../constants/workshop-viewer.constants');
    expect(SHEET_NUMBERING.assemblyInventory).toBe('I003');
  });
});
