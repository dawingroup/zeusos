/**
 * DesignItem Cost Aggregator — pure-reducer tests (P10)
 *
 * We exercise `classifyBOMCategory` and `aggregateRollup` — the latter
 * is the deterministic core of the aggregator. The Firestore-touching
 * `recomputeDesignItemRollup` is not exercised here; it's a thin
 * orchestration wrapper tested end-to-end when we next run the scene
 * service integration harness.
 */
import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  aggregateRollup,
  classifyBOMCategory,
} from '../services/designItemCostAggregator';
import type { SceneCabinet } from '../types/scene.types';
import type { ComputedBOMLine, PricingBreakdown } from '../types/constraintEngine.types';

// ── Factories ──────────────────────────────────────────────────────────

const makeBOMLine = (overrides: Partial<ComputedBOMLine> = {}): ComputedBOMLine => ({
  bomTemplateLineKey: 'k1',
  materialCategory: 'sheet',
  description: 'MDF 18mm',
  quantity: 1,
  unit: 'sheet',
  inventoryItemId: 'inv-1',
  inventoryItemName: 'MDF 18mm',
  unitCost: 100_000,
  currency: 'UGX',
  totalCost: 100_000,
  wastageApplied: 0.1,
  ...overrides,
});

const makePricing = (overrides: Partial<PricingBreakdown> = {}): PricingBreakdown => ({
  materialsCost: 100_000,
  edgeBandingCost: 0,
  hardwareCost: 0,
  laborCost: 50_000,
  overheadCost: 22_500,
  marginAmount: 43_125,
  subtotal: 215_625,
  vatAmount: 38_813,
  total: 254_438,
  currency: 'UGX',
  lineItems: [],
  ...overrides,
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

// ── classifyBOMCategory ────────────────────────────────────────────────

describe('classifyBOMCategory', () => {
  it('classifies sheet-like categories to sheet', () => {
    expect(classifyBOMCategory('sheet')).toBe('sheet');
    expect(classifyBOMCategory('board')).toBe('sheet');
    expect(classifyBOMCategory('18mm MDF')).toBe('sheet');
    expect(classifyBOMCategory('Plywood Panel')).toBe('sheet');
  });

  it('classifies edge banding before hardware (order sensitivity)', () => {
    expect(classifyBOMCategory('edge_banding')).toBe('edging');
    expect(classifyBOMCategory('edgebanding')).toBe('edging');
    expect(classifyBOMCategory('PVC edge-banding tape')).toBe('edging');
  });

  it('classifies hardware categories', () => {
    expect(classifyBOMCategory('hardware')).toBe('hardware');
    expect(classifyBOMCategory('hinge')).toBe('hardware');
    expect(classifyBOMCategory('soft-close slide')).toBe('hardware');
    expect(classifyBOMCategory('handle')).toBe('hardware');
    expect(classifyBOMCategory('cam lock')).toBe('hardware');
  });

  it('classifies timber / linear stock', () => {
    expect(classifyBOMCategory('timber')).toBe('timber');
    expect(classifyBOMCategory('solid oak')).toBe('timber');
    expect(classifyBOMCategory('linear metal bar')).toBe('linear');
    expect(classifyBOMCategory('aluminium tube')).toBe('linear');
  });

  it('defaults unknown / empty to other', () => {
    expect(classifyBOMCategory('')).toBe('other');
    expect(classifyBOMCategory(undefined)).toBe('other');
    expect(classifyBOMCategory('fabric')).toBe('other');
    expect(classifyBOMCategory('foam')).toBe('other');
  });

  it('is case-insensitive', () => {
    expect(classifyBOMCategory('SHEET_MDF')).toBe('sheet');
    expect(classifyBOMCategory('HARDWARE')).toBe('hardware');
  });
});

// ── aggregateRollup ────────────────────────────────────────────────────

describe('aggregateRollup', () => {
  it('returns null for zero cabinets', () => {
    expect(aggregateRollup([])).toBeNull();
  });

  it('sums a single cabinet correctly', () => {
    const c = makeCabinet();
    const result = aggregateRollup([c]);
    expect(result).not.toBeNull();
    expect(result!.cabinetCount).toBe(1);
    expect(result!.lockedCabinetCount).toBe(0);
    expect(result!.sheetMaterialsCost).toBe(100_000);
    expect(result!.laborCost).toBe(50_000);
    expect(result!.totalCost).toBe(254_438);
    expect(result!.costPerUnit).toBe(254_438);
    expect(result!.rolledUpFromScenes).toEqual(['scene-1']);
  });

  it('includes locked cabinets in totals and counts them separately', () => {
    const unlocked = makeCabinet({ id: 'a', isLocked: false });
    const locked = makeCabinet({ id: 'b', isLocked: true });
    const result = aggregateRollup([unlocked, locked])!;
    expect(result.cabinetCount).toBe(2);
    expect(result.lockedCabinetCount).toBe(1);
    // Totals double — locked contributions are NOT excluded.
    expect(result.totalCost).toBe(254_438 * 2);
    expect(result.sheetMaterialsCost).toBe(200_000);
  });

  it('classifies BOM lines into the right buckets', () => {
    const c = makeCabinet({
      computedBOM: [
        makeBOMLine({ materialCategory: 'sheet', totalCost: 50_000 }),
        makeBOMLine({ materialCategory: 'edge_banding', totalCost: 10_000 }),
        makeBOMLine({ materialCategory: 'hinge', totalCost: 8_000 }),
        makeBOMLine({ materialCategory: 'timber', totalCost: 30_000 }),
        makeBOMLine({ materialCategory: 'aluminium tube', totalCost: 15_000 }),
        makeBOMLine({ materialCategory: 'fabric', totalCost: 5_000 }),
      ],
    });
    const result = aggregateRollup([c])!;
    expect(result.sheetMaterialsCost).toBe(50_000);
    expect(result.edgingMaterialsCost).toBe(10_000);
    expect(result.hardwareCost).toBe(8_000);
    expect(result.timberMaterialsCost).toBe(30_000);
    expect(result.linearMaterialsCost).toBe(15_000);
    expect(result.otherMaterialsCost).toBe(5_000);
    expect(result.materialsCost).toBe(118_000);
  });

  it('spans multiple scenes and reports each contributing scene', () => {
    const a = makeCabinet({ id: 'a', sceneId: 'scene-a' });
    const b = makeCabinet({ id: 'b', sceneId: 'scene-b' });
    const c = makeCabinet({ id: 'c', sceneId: 'scene-a' });
    const result = aggregateRollup([a, b, c])!;
    expect(result.rolledUpFromScenes).toEqual(['scene-a', 'scene-b']);
    expect(result.cabinetCount).toBe(3);
  });

  it('flags mixed currencies and picks the majority', () => {
    const ugx1 = makeCabinet({ id: 'a', estimatedPrice: makePricing({ currency: 'UGX' }) });
    const ugx2 = makeCabinet({ id: 'b', estimatedPrice: makePricing({ currency: 'UGX' }) });
    const usd1 = makeCabinet({ id: 'c', estimatedPrice: makePricing({ currency: 'USD' }) });
    const result = aggregateRollup([ugx1, ugx2, usd1])!;
    expect(result.hasMixedCurrencies).toBe(true);
    expect(result.currency).toBe('UGX');
  });

  it('defaults to UGX on currency ties', () => {
    const a = makeCabinet({ id: 'a', estimatedPrice: makePricing({ currency: 'UGX' }) });
    const b = makeCabinet({ id: 'b', estimatedPrice: makePricing({ currency: 'USD' }) });
    const result = aggregateRollup([a, b])!;
    expect(result.hasMixedCurrencies).toBe(true);
    expect(result.currency).toBe('UGX');
  });

  it('handles empty computedBOM / missing estimatedPrice safely', () => {
    const c = makeCabinet({
      computedBOM: [],
      estimatedPrice: undefined as unknown as PricingBreakdown,
    });
    const result = aggregateRollup([c])!;
    expect(result.cabinetCount).toBe(1);
    expect(result.materialsCost).toBe(0);
    expect(result.totalCost).toBe(0);
    expect(result.costPerUnit).toBe(0);
    expect(result.cabinets[0].currency).toBe('UGX'); // default fallback
  });

  it('records per-cabinet drill-down rows with lock state preserved', () => {
    const a = makeCabinet({
      id: 'a',
      cabinetCode: 'KB-1',
      displayName: 'First',
      isLocked: true,
      estimatedPrice: makePricing({ total: 100 }),
    });
    const b = makeCabinet({
      id: 'b',
      cabinetCode: 'KB-2',
      displayName: 'Second',
      isLocked: false,
      estimatedPrice: makePricing({ total: 200 }),
    });
    const result = aggregateRollup([a, b])!;
    expect(result.cabinets).toHaveLength(2);
    const rowA = result.cabinets.find(r => r.cabinetId === 'a');
    const rowB = result.cabinets.find(r => r.cabinetId === 'b');
    expect(rowA?.isLocked).toBe(true);
    expect(rowA?.totalCost).toBe(100);
    expect(rowB?.isLocked).toBe(false);
    expect(rowB?.totalCost).toBe(200);
  });

  it('is pure — repeated calls with the same input produce the same output', () => {
    const cabinets = [makeCabinet({ id: 'a' }), makeCabinet({ id: 'b' })];
    const first = aggregateRollup(cabinets);
    const second = aggregateRollup(cabinets);
    expect(first).toEqual(second);
  });
});

// ── P21.8: lockedSnapshot authority ────────────────────────────────────

describe('aggregateRollup — P21.8 lockedSnapshot authority', () => {
  it('uses the frozen snapshot for locked cabinets, not the live fields', () => {
    // Live fields have been (hypothetically) edited post-lock to 999, but
    // the snapshot captured at lock moment was 100. The rollup MUST report
    // the snapshot — that's the whole point of the freeze.
    const locked = makeCabinet({
      id: 'locked',
      isLocked: true,
      computedBOM: [makeBOMLine({ totalCost: 999, materialCategory: 'sheet' })],
      estimatedPrice: makePricing({ total: 999, laborCost: 999 }),
      lockedSnapshot: {
        computedBOM: [makeBOMLine({ totalCost: 100, materialCategory: 'sheet' })],
        estimatedPrice: makePricing({ total: 100, laborCost: 50 }),
        lockedAt: Timestamp.now(),
        manufacturingOrderId: 'mo-1',
      },
    });
    const result = aggregateRollup([locked])!;
    expect(result.sheetMaterialsCost).toBe(100);
    expect(result.totalCost).toBe(100);
    expect(result.laborCost).toBe(50);
    expect(result.lockedCabinetCount).toBe(1);
    expect(result.cabinets[0].totalCost).toBe(100);
  });

  it('falls back to live fields on locked cabinets without a snapshot (legacy)', () => {
    // A pre-P21.8 locked cabinet won't have a snapshot. Behaviour should
    // degrade to the old "freeze by convention" — use the live fields.
    const legacyLocked = makeCabinet({
      id: 'legacy',
      isLocked: true,
      computedBOM: [makeBOMLine({ totalCost: 77, materialCategory: 'sheet' })],
      estimatedPrice: makePricing({ total: 77 }),
      // no lockedSnapshot
    });
    const result = aggregateRollup([legacyLocked])!;
    expect(result.sheetMaterialsCost).toBe(77);
    expect(result.totalCost).toBe(77);
    expect(result.lockedCabinetCount).toBe(1);
  });

  it('ignores the snapshot on unlocked cabinets even if one is present (stale)', () => {
    // An unlocked cabinet with a stale snapshot (e.g. from a prior
    // lock/unlock cycle where the clear didn't land) should read LIVE —
    // unlocked means "editable and not authoritative".
    const unlockedWithStaleSnap = makeCabinet({
      id: 'u',
      isLocked: false,
      computedBOM: [makeBOMLine({ totalCost: 200, materialCategory: 'sheet' })],
      estimatedPrice: makePricing({ total: 200 }),
      lockedSnapshot: {
        computedBOM: [makeBOMLine({ totalCost: 1, materialCategory: 'sheet' })],
        estimatedPrice: makePricing({ total: 1 }),
        lockedAt: Timestamp.now(),
        manufacturingOrderId: 'mo-old',
      },
    });
    const result = aggregateRollup([unlockedWithStaleSnap])!;
    expect(result.sheetMaterialsCost).toBe(200);
    expect(result.totalCost).toBe(200);
    expect(result.lockedCabinetCount).toBe(0);
  });

  it('mixes snapshot (locked) and live (unlocked) contributions correctly', () => {
    const locked = makeCabinet({
      id: 'locked',
      isLocked: true,
      computedBOM: [makeBOMLine({ totalCost: 999, materialCategory: 'sheet' })],
      estimatedPrice: makePricing({ total: 999 }),
      lockedSnapshot: {
        computedBOM: [makeBOMLine({ totalCost: 100, materialCategory: 'sheet' })],
        estimatedPrice: makePricing({ total: 100 }),
        lockedAt: Timestamp.now(),
        manufacturingOrderId: 'mo-1',
      },
    });
    const unlocked = makeCabinet({
      id: 'unlocked',
      isLocked: false,
      computedBOM: [makeBOMLine({ totalCost: 50, materialCategory: 'sheet' })],
      estimatedPrice: makePricing({ total: 50 }),
    });
    const result = aggregateRollup([locked, unlocked])!;
    // locked contributes 100 (snapshot), unlocked contributes 50 (live)
    expect(result.sheetMaterialsCost).toBe(150);
    expect(result.totalCost).toBe(150);
    expect(result.lockedCabinetCount).toBe(1);
    expect(result.cabinetCount).toBe(2);
  });
});
