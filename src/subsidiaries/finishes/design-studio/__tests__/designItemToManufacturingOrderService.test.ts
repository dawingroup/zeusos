/**
 * DesignItem → MO service — pure-reducer tests (P3)
 *
 * Covers `flattenCabinetsToBOM` and `filterCabinets`. The Firestore-
 * touching `createMOFromDesignItem` orchestrator is validated in the
 * scene-service integration harness (next pass).
 */
import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  flattenCabinetsToBOM,
  filterCabinets,
} from '../services/designItemToManufacturingOrderService';
import type { SceneCabinet } from '../types/scene.types';
import type { ComputedBOMLine, PricingBreakdown } from '../types/constraintEngine.types';

// ── Factories ──────────────────────────────────────────────────────────

const makeBOMLine = (overrides: Partial<ComputedBOMLine> = {}): ComputedBOMLine => ({
  bomTemplateLineKey: 'k1',
  materialCategory: 'sheet',
  description: 'MDF 18mm',
  quantity: 1,
  unit: 'sheet',
  inventoryItemId: 'inv-mdf-18',
  inventoryItemName: 'MDF 18mm',
  unitCost: 100_000,
  currency: 'UGX',
  totalCost: 100_000,
  wastageApplied: 0.1,
  ...overrides,
});

const makePricing = (): PricingBreakdown => ({
  materialsCost: 100_000,
  edgeBandingCost: 0,
  hardwareCost: 0,
  laborCost: 0,
  overheadCost: 0,
  marginAmount: 0,
  subtotal: 100_000,
  vatAmount: 0,
  total: 100_000,
  currency: 'UGX',
  lineItems: [],
});

const makeCabinet = (overrides: Partial<SceneCabinet> = {}): SceneCabinet => ({
  id: 'cab-1',
  sceneId: 'scene-1',
  pddId: 'pdd-1',
  cabinetCode: 'KB600-A',
  displayName: 'Kitchen Base 600',
  configuration: {},
  finishSelections: {},
  position: { x: 0, y: 0, z: 0 },
  rotation: 0,
  anchorPoint: 'bottom_back_left',
  glbUrl: '',
  thumbnailUrl: '',
  assemblies: [],
  computedBOM: [makeBOMLine()],
  estimatedPrice: makePricing(),
  isLocked: false,
  sequence: 0,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  ...overrides,
});

// ── flattenCabinetsToBOM ───────────────────────────────────────────────

describe('flattenCabinetsToBOM', () => {
  it('returns an empty BOM for zero cabinets', () => {
    const { bom, currency, hasMixedCurrencies, unresolvedCount } =
      flattenCabinetsToBOM([]);
    expect(bom).toEqual([]);
    expect(currency).toBe('UGX'); // default
    expect(hasMixedCurrencies).toBe(false);
    expect(unresolvedCount).toBe(0);
  });

  it('collapses identical inventory items across cabinets', () => {
    const a = makeCabinet({
      id: 'a',
      computedBOM: [
        makeBOMLine({ inventoryItemId: 'inv-mdf-18', quantity: 2, totalCost: 200_000 }),
        makeBOMLine({ inventoryItemId: 'inv-hinge', materialCategory: 'hinge', quantity: 4, totalCost: 40_000 }),
      ],
    });
    const b = makeCabinet({
      id: 'b',
      computedBOM: [
        makeBOMLine({ inventoryItemId: 'inv-mdf-18', quantity: 3, totalCost: 300_000 }),
        makeBOMLine({ inventoryItemId: 'inv-hinge', materialCategory: 'hinge', quantity: 2, totalCost: 20_000 }),
      ],
    });
    const { bom } = flattenCabinetsToBOM([a, b]);
    expect(bom).toHaveLength(2);
    const mdf = bom.find(e => e.inventoryItemId === 'inv-mdf-18')!;
    const hinge = bom.find(e => e.inventoryItemId === 'inv-hinge')!;
    expect(mdf.quantityRequired).toBe(5);
    expect(mdf.totalCost).toBe(500_000);
    expect(mdf.unitCost).toBe(100_000); // weighted average: 500k / 5
    expect(hinge.quantityRequired).toBe(6);
    expect(hinge.totalCost).toBe(60_000);
    expect(hinge.unitCost).toBe(10_000);
  });

  it('produces a weighted-average unitCost when line unitCosts differ', () => {
    const c = makeCabinet({
      computedBOM: [
        makeBOMLine({ inventoryItemId: 'inv-x', quantity: 1, totalCost: 100 }),
        makeBOMLine({ inventoryItemId: 'inv-x', quantity: 3, totalCost: 600 }),
      ],
    });
    const { bom } = flattenCabinetsToBOM([c]);
    expect(bom).toHaveLength(1);
    expect(bom[0].quantityRequired).toBe(4);
    expect(bom[0].totalCost).toBe(700);
    expect(bom[0].unitCost).toBe(175); // 700 / 4
  });

  it('keeps BOM lines without inventoryItemId as unresolved (grouped by description)', () => {
    const c = makeCabinet({
      computedBOM: [
        makeBOMLine({
          inventoryItemId: '',
          inventoryItemName: '',
          description: 'Custom gasket',
          quantity: 2,
          totalCost: 5000,
        }),
        makeBOMLine({
          inventoryItemId: '',
          inventoryItemName: '',
          description: 'Custom gasket',
          quantity: 3,
          totalCost: 7500,
        }),
        makeBOMLine({
          inventoryItemId: '',
          inventoryItemName: '',
          description: 'Mystery foam',
          quantity: 1,
          totalCost: 2000,
        }),
      ],
    });
    const { bom, unresolvedCount } = flattenCabinetsToBOM([c]);
    expect(unresolvedCount).toBe(3);
    // two unresolved entries, grouped by description
    expect(bom).toHaveLength(2);
    const gasket = bom.find(e => e.itemName === 'Custom gasket')!;
    expect(gasket.quantityRequired).toBe(5);
    expect(gasket.totalCost).toBe(12_500);
  });

  it('emits BOM entries in deterministic order for stable writes', () => {
    const c1 = makeCabinet({
      computedBOM: [
        makeBOMLine({ inventoryItemId: 'z' }),
        makeBOMLine({ inventoryItemId: 'a' }),
        makeBOMLine({ inventoryItemId: 'm' }),
      ],
    });
    const c2 = makeCabinet({
      id: 'c2',
      computedBOM: [
        makeBOMLine({ inventoryItemId: 'a' }),
        makeBOMLine({ inventoryItemId: 'm' }),
        makeBOMLine({ inventoryItemId: 'z' }),
      ],
    });
    const r1 = flattenCabinetsToBOM([c1]);
    const r2 = flattenCabinetsToBOM([c2]);
    expect(r1.bom.map(e => e.inventoryItemId)).toEqual(['a', 'm', 'z']);
    expect(r2.bom.map(e => e.inventoryItemId)).toEqual(['a', 'm', 'z']);
  });

  it('flags mixed currencies but still returns a single-currency majority', () => {
    const a = makeCabinet({
      computedBOM: [
        makeBOMLine({ inventoryItemId: 'x', currency: 'UGX' }),
        makeBOMLine({ inventoryItemId: 'y', currency: 'UGX' }),
      ],
    });
    const b = makeCabinet({
      id: 'b',
      computedBOM: [makeBOMLine({ inventoryItemId: 'z', currency: 'USD' })],
    });
    const { currency, hasMixedCurrencies } = flattenCabinetsToBOM([a, b]);
    expect(hasMixedCurrencies).toBe(true);
    expect(currency).toBe('UGX'); // majority
  });

  it('defaults to UGX on currency ties', () => {
    const a = makeCabinet({
      computedBOM: [makeBOMLine({ inventoryItemId: 'x', currency: 'UGX' })],
    });
    const b = makeCabinet({
      id: 'b',
      computedBOM: [makeBOMLine({ inventoryItemId: 'y', currency: 'USD' })],
    });
    const { currency, hasMixedCurrencies } = flattenCabinetsToBOM([a, b]);
    expect(hasMixedCurrencies).toBe(true);
    expect(currency).toBe('UGX');
  });

  it('is pure — same input yields equal output', () => {
    const cabs = [makeCabinet({ id: 'a' }), makeCabinet({ id: 'b' })];
    const r1 = flattenCabinetsToBOM(cabs);
    const r2 = flattenCabinetsToBOM(cabs);
    expect(r1).toEqual(r2);
  });

  it('carries category + unit from the first occurrence of each item', () => {
    const c = makeCabinet({
      computedBOM: [
        makeBOMLine({
          inventoryItemId: 'inv-x',
          materialCategory: 'sheet',
          unit: 'sheet',
          quantity: 1,
          totalCost: 100,
        }),
        makeBOMLine({
          inventoryItemId: 'inv-x',
          materialCategory: 'board', // should NOT override
          unit: 'piece',
          quantity: 1,
          totalCost: 100,
        }),
      ],
    });
    const { bom } = flattenCabinetsToBOM([c]);
    expect(bom[0].category).toBe('sheet');
    expect(bom[0].unit).toBe('sheet');
  });
});

// ── filterCabinets ─────────────────────────────────────────────────────

describe('filterCabinets', () => {
  const cabs = [
    makeCabinet({ id: 'c1', sceneId: 's1' }),
    makeCabinet({ id: 'c2', sceneId: 's1' }),
    makeCabinet({ id: 'c3', sceneId: 's2' }),
    makeCabinet({ id: 'c4', sceneId: 's2' }),
    makeCabinet({ id: 'c5', sceneId: 's3' }),
  ];

  it('returns the full list when no filters are given', () => {
    expect(filterCabinets(cabs).map(c => c.id)).toEqual([
      'c1',
      'c2',
      'c3',
      'c4',
      'c5',
    ]);
  });

  it('filters by sceneIds alone', () => {
    const r = filterCabinets(cabs, ['s1']);
    expect(r.map(c => c.id)).toEqual(['c1', 'c2']);
  });

  it('filters by cabinetIds alone', () => {
    const r = filterCabinets(cabs, undefined, ['c3', 'c5']);
    expect(r.map(c => c.id)).toEqual(['c3', 'c5']);
  });

  it('unions sceneIds and cabinetIds', () => {
    // all of scene s1 + one cabinet from s2
    const r = filterCabinets(cabs, ['s1'], ['c3']);
    expect(r.map(c => c.id).sort()).toEqual(['c1', 'c2', 'c3']);
  });

  it('treats empty arrays the same as missing filters', () => {
    const r = filterCabinets(cabs, [], []);
    expect(r).toHaveLength(5);
  });

  it('does not mutate the input array', () => {
    const snap = cabs.map(c => c.id);
    filterCabinets(cabs, ['s1']);
    expect(cabs.map(c => c.id)).toEqual(snap);
  });
});
