/**
 * materialValidationService — P13/F15 contract tests.
 *
 * The validator is the single source of truth for "can the print
 * package ship?". Each test pins one of the four exception reasons
 * against the exact mapping/finish shape that should trigger it.
 *
 * The validator is pure, so no Firestore mocks — we construct
 * fixtures inline and assert on the exception list directly.
 */
import { describe, it, expect } from 'vitest';
import {
  validateMaterialMappings,
  isMaterialMappingPrintReady,
  describeMaterialException,
  assertPrintReady,
  MaterialValidationError,
  type MaterialException,
  type StockAggregate,
} from '../materialValidationService';
import type { FinishDocument } from '@/modules/inventory/types/finishLibrary';
import type { MaterialMapping } from '../materialResolverService';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Minimum valid mapping for a matched finish. Overlay-friendly. */
function mapping(overrides: Partial<MaterialMapping> = {}): MaterialMapping {
  return {
    threeDsMaterialName: 'MEL-AW-001',
    finishLibraryId: 'finish-1',
    finishName: 'Antique White',
    finishCode: 'MEL-AW-001',
    hexColor: '#faf5ef',
    category: 'board',
    subtype: 'melamine',
    pbrDefaults: { metalness: 0, roughness: 0.5 },
    confidence: 0.95,
    matchedOn: 'code',
    ...overrides,
  };
}

/** Minimum valid finish doc — Timestamp is irrelevant to the validator. */
function finish(overrides: Partial<FinishDocument> = {}): FinishDocument {
  return {
    id: 'finish-1',
    organizationId: 'org-1',
    name: 'Antique White',
    code: 'MEL-AW-001',
    category: 'board',
    subtype: 'melamine',
    availability: 'in_stock',
    tags: [],
    isActive: true,
    inventoryItemId: 'inv-1',
    createdAt: {} as unknown as FinishDocument['createdAt'],
    updatedAt: {} as unknown as FinishDocument['updatedAt'],
    ...overrides,
  };
}

const STOCK_IN: StockAggregate = { totalOnHand: 50, totalReserved: 10, totalAvailable: 40 };
const STOCK_ZERO: StockAggregate = { totalOnHand: 0, totalReserved: 0, totalAvailable: 0 };

// ---------------------------------------------------------------------------
// Happy path — fully print-ready
// ---------------------------------------------------------------------------

describe('validateMaterialMappings — happy paths', () => {
  it('returns no exceptions when every mapping resolves to a linked, stocked finish', () => {
    const result = validateMaterialMappings({
      mappings: [mapping()],
      finishById: { 'finish-1': finish() },
      stockByInventoryItemId: { 'inv-1': STOCK_IN },
    });
    expect(result).toEqual([]);
    expect(isMaterialMappingPrintReady(result)).toBe(true);
  });

  it('tolerates Map input as well as Record input', () => {
    const finishMap = new Map([['finish-1', finish()]]);
    const stockMap = new Map([['inv-1', STOCK_IN]]);
    expect(
      validateMaterialMappings({
        mappings: [mapping()],
        finishById: finishMap,
        stockByInventoryItemId: stockMap,
      }),
    ).toEqual([]);
  });

  it('skips the stock check for made-to-order finishes — zero stock is expected', () => {
    // made_to_order is the contract that stock is produced on demand, so
    // zero aggregate stock is NOT a blocking exception.
    const result = validateMaterialMappings({
      mappings: [mapping()],
      finishById: {
        'finish-1': finish({ availability: 'made_to_order' }),
      },
      stockByInventoryItemId: { 'inv-1': STOCK_ZERO },
    });
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Exception: no_finish_match
// ---------------------------------------------------------------------------

describe('validateMaterialMappings — no_finish_match', () => {
  it('flags an unmatched material (confidence=0, empty finishLibraryId)', () => {
    const result = validateMaterialMappings({
      mappings: [
        mapping({
          threeDsMaterialName: 'UNKNOWN-MAT',
          finishLibraryId: '',
          finishName: '',
          finishCode: '',
          confidence: 0,
          matchedOn: 'none',
        }),
      ],
      finishById: {},
      stockByInventoryItemId: {},
    });
    expect(result).toEqual<MaterialException[]>([
      { threeDsMaterialName: 'UNKNOWN-MAT', reason: 'no_finish_match' },
    ]);
  });

  it('flags a mapping whose finish doc was deleted after resolution', () => {
    // Mapping carries a finishLibraryId but the finish is gone from
    // the library. Same user remedy as unmatched — re-map.
    const result = validateMaterialMappings({
      mappings: [mapping({ finishLibraryId: 'finish-ghost' })],
      finishById: {},
      stockByInventoryItemId: {},
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      reason: 'no_finish_match',
      finishId: 'finish-ghost',
    });
  });
});

// ---------------------------------------------------------------------------
// Exception: missing_inventory_link (the F15 driver)
// ---------------------------------------------------------------------------

describe('validateMaterialMappings — missing_inventory_link', () => {
  it('flags a finish that has no inventoryItemId', () => {
    const result = validateMaterialMappings({
      mappings: [mapping()],
      finishById: { 'finish-1': finish({ inventoryItemId: undefined }) },
      stockByInventoryItemId: {},
    });
    expect(result).toEqual<MaterialException[]>([
      {
        threeDsMaterialName: 'MEL-AW-001',
        reason: 'missing_inventory_link',
        finishId: 'finish-1',
        finishName: 'Antique White',
        finishCode: 'MEL-AW-001',
      },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Exception: discontinued
// ---------------------------------------------------------------------------

describe('validateMaterialMappings — discontinued', () => {
  it('flags a discontinued finish even when stock is healthy', () => {
    // Discontinued is more actionable than zero_stock (pick a replacement
    // vs. wait for restock). Precedence rule: discontinued wins.
    const result = validateMaterialMappings({
      mappings: [mapping()],
      finishById: { 'finish-1': finish({ availability: 'discontinued' }) },
      stockByInventoryItemId: { 'inv-1': STOCK_IN },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      reason: 'discontinued',
      finishId: 'finish-1',
    });
  });

  it('prefers discontinued over zero_stock when both are true', () => {
    const result = validateMaterialMappings({
      mappings: [mapping()],
      finishById: { 'finish-1': finish({ availability: 'discontinued' }) },
      stockByInventoryItemId: { 'inv-1': STOCK_ZERO },
    });
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('discontinued');
  });
});

// ---------------------------------------------------------------------------
// Exception: zero_stock
// ---------------------------------------------------------------------------

describe('validateMaterialMappings — zero_stock', () => {
  it('flags a linked, in-stock-labelled finish whose aggregate is zero', () => {
    const result = validateMaterialMappings({
      mappings: [mapping()],
      finishById: { 'finish-1': finish() },
      stockByInventoryItemId: { 'inv-1': STOCK_ZERO },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      reason: 'zero_stock',
      finishId: 'finish-1',
      availableStock: 0,
    });
  });

  it('flags negative available stock as zero_stock (defensive)', () => {
    // Shouldn't happen in practice but reservations can race ahead of
    // onHand during rapid updates. Treat as blocking.
    const result = validateMaterialMappings({
      mappings: [mapping()],
      finishById: { 'finish-1': finish() },
      stockByInventoryItemId: {
        'inv-1': { totalOnHand: 5, totalReserved: 10, totalAvailable: -5 },
      },
    });
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('zero_stock');
    expect(result[0].availableStock).toBe(-5);
  });

  it('does NOT flag zero_stock when the stock aggregate is missing (loading state)', () => {
    // Caller hasn't finished fetching stock yet. The hook holds the
    // "print-ready" flag back during loading — the validator stays silent.
    const result = validateMaterialMappings({
      mappings: [mapping()],
      finishById: { 'finish-1': finish() },
      stockByInventoryItemId: {}, // no aggregate yet
    });
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Mixed scenarios
// ---------------------------------------------------------------------------

describe('validateMaterialMappings — multi-mapping scenarios', () => {
  it('emits one exception per offending mapping, preserving input order', () => {
    const result = validateMaterialMappings({
      mappings: [
        mapping({ threeDsMaterialName: 'm-ok', finishLibraryId: 'finish-1' }),
        mapping({
          threeDsMaterialName: 'm-unmatched',
          finishLibraryId: '',
          confidence: 0,
          matchedOn: 'none',
        }),
        mapping({ threeDsMaterialName: 'm-no-inv', finishLibraryId: 'finish-2' }),
        mapping({ threeDsMaterialName: 'm-zero', finishLibraryId: 'finish-3' }),
      ],
      finishById: {
        'finish-1': finish({ id: 'finish-1' }),
        'finish-2': finish({ id: 'finish-2', inventoryItemId: undefined }),
        'finish-3': finish({ id: 'finish-3', inventoryItemId: 'inv-3' }),
      },
      stockByInventoryItemId: {
        'inv-1': STOCK_IN,
        'inv-3': STOCK_ZERO,
      },
    });
    expect(result.map((e) => [e.threeDsMaterialName, e.reason])).toEqual([
      ['m-unmatched', 'no_finish_match'],
      ['m-no-inv', 'missing_inventory_link'],
      ['m-zero', 'zero_stock'],
    ]);
  });

  it('isMaterialMappingPrintReady is true iff exceptions is empty', () => {
    expect(isMaterialMappingPrintReady([])).toBe(true);
    expect(
      isMaterialMappingPrintReady([
        { threeDsMaterialName: 'x', reason: 'no_finish_match' },
      ]),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Exception copy — describeMaterialException
// ---------------------------------------------------------------------------

describe('describeMaterialException', () => {
  it('describes no_finish_match using the 3ds material name', () => {
    expect(
      describeMaterialException({ threeDsMaterialName: 'mat-X', reason: 'no_finish_match' }),
    ).toContain('mat-X');
  });

  it('describes missing_inventory_link using the finish name when present', () => {
    expect(
      describeMaterialException({
        threeDsMaterialName: 'mat-Y',
        reason: 'missing_inventory_link',
        finishId: 'f-1',
        finishName: 'Antique White',
      }),
    ).toContain('Antique White');
  });

  it('describes discontinued finishes with a replacement hint', () => {
    expect(
      describeMaterialException({
        threeDsMaterialName: 'mat-Z',
        reason: 'discontinued',
        finishName: 'Old Oak',
      }),
    ).toMatch(/discontinued/i);
  });

  it('describes zero_stock finishes plainly', () => {
    expect(
      describeMaterialException({
        threeDsMaterialName: 'mat-Z',
        reason: 'zero_stock',
        finishName: 'Blue Gloss',
        availableStock: 0,
      }),
    ).toMatch(/zero.*stock/i);
  });

  describe('assertPrintReady', () => {
    it('is a no-op when exception list is empty', () => {
      expect(() => assertPrintReady([])).not.toThrow();
    });

    it('throws MaterialValidationError carrying the exceptions', () => {
      const exceptions: MaterialException[] = [
        { threeDsMaterialName: 'mat-A', reason: 'no_finish_match' },
        {
          threeDsMaterialName: 'mat-B',
          reason: 'missing_inventory_link',
          finishId: 'f1',
          finishName: 'Walnut',
        },
      ];
      let caught: unknown;
      try {
        assertPrintReady(exceptions);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(MaterialValidationError);
      const mvErr = caught as MaterialValidationError;
      expect(mvErr.exceptions).toHaveLength(2);
      expect(mvErr.exceptions[0].reason).toBe('no_finish_match');
      expect(mvErr.message).toMatch(/2 material exceptions/);
      expect(mvErr.name).toBe('MaterialValidationError');
    });

    it('pluralizes the message correctly for a single exception', () => {
      try {
        assertPrintReady([
          { threeDsMaterialName: 'mat-A', reason: 'no_finish_match' },
        ]);
      } catch (err) {
        expect((err as Error).message).toMatch(/1 material exception\b/);
        expect((err as Error).message).not.toMatch(/exceptions\b/);
      }
    });
  });
});
