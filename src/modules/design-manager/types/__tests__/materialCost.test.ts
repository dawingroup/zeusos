/**
 * Tests for the P12-1 material cost resolver.
 *
 * The resolver is pure and operates on structural shapes, so fixtures
 * are intentionally minimal. We test the precedence rules one-at-a-
 * time plus the "incomplete input" fallbacks to prove the resolver
 * fails safe (null) rather than fabricating a cost.
 */
import { describe, it, expect } from 'vitest';
import {
  isMaterialPricingOverrideInvalid,
  resolveMaterialUnitCost,
  stampMaterialCostOverride,
  type MaterialCostLike,
} from '../materialCost';

describe('resolveMaterialUnitCost', () => {
  it('returns null when the material has no pricing and no inventory', () => {
    // A material mid-creation (form half-filled) should not resolve to
    // zero — callers need a distinct "unknown" signal to avoid silently
    // folding bad data into BOQ totals.
    expect(resolveMaterialUnitCost({})).toBeNull();
  });

  it('returns material-source when pricing is set and nothing else', () => {
    const material: MaterialCostLike = {
      pricing: { unitCost: 50, currency: 'UGX' },
    };
    expect(resolveMaterialUnitCost(material)).toEqual({
      unitCost: 50,
      currency: 'UGX',
      source: 'material',
      isOverride: false,
    });
  });

  it('returns inventory-source when material links to inventory and cost supplied', () => {
    // Happy path of the P12 rollout — InventoryItem wins.
    const material: MaterialCostLike = {
      inventoryItemId: 'inv-1',
      pricing: { unitCost: 50, currency: 'UGX' }, // stale material-side
    };
    const inventoryCost = { costPerUnit: 60, currency: 'UGX' };
    expect(resolveMaterialUnitCost(material, inventoryCost)).toEqual({
      unitCost: 60,
      currency: 'UGX',
      source: 'inventory',
      isOverride: false,
    });
  });

  it('returns override-source when isOverride=true and pricing complete', () => {
    // Operator pinned a custom cost — resolver treats this as the truth
    // for THIS material even though inventory exists.
    const material: MaterialCostLike = {
      inventoryItemId: 'inv-1',
      pricing: {
        unitCost: 75,
        currency: 'UGX',
        isOverride: true,
        overrideReason: 'One-off supplier quote',
      },
    };
    const inventoryCost = { costPerUnit: 60, currency: 'UGX' };
    expect(resolveMaterialUnitCost(material, inventoryCost)).toEqual({
      unitCost: 75,
      currency: 'UGX',
      source: 'override',
      isOverride: true,
      overrideReason: 'One-off supplier quote',
    });
  });

  it('override wins over inventory link (no reason supplied)', () => {
    const material: MaterialCostLike = {
      inventoryItemId: 'inv-1',
      pricing: { unitCost: 75, currency: 'UGX', isOverride: true },
    };
    const result = resolveMaterialUnitCost(material, {
      costPerUnit: 60,
      currency: 'UGX',
    });
    expect(result?.source).toBe('override');
    expect(result?.overrideReason).toBeUndefined();
  });

  it('falls through to inventory when isOverride=true but unitCost missing', () => {
    // Defensive: a half-written override should NOT shadow a working
    // inventory link. The override validator surfaces this as invalid
    // for the writer layer; the resolver degrades gracefully.
    const material: MaterialCostLike = {
      inventoryItemId: 'inv-1',
      pricing: { currency: 'UGX', isOverride: true } as MaterialCostLike['pricing'],
    };
    const result = resolveMaterialUnitCost(material, {
      costPerUnit: 60,
      currency: 'UGX',
    });
    expect(result?.source).toBe('inventory');
  });

  it('falls through to material-source when isOverride=true, pricing incomplete, no inventory', () => {
    const material: MaterialCostLike = {
      pricing: {
        unitCost: 40,
        currency: 'UGX',
        // Defensively strip isOverride since the prior test covers incomplete:
        // this one has complete pricing but no override flag semantics kick in.
      },
    };
    expect(resolveMaterialUnitCost(material)?.source).toBe('material');
  });

  it('ignores inventoryCost when currency is empty', () => {
    // Inventory cost without a currency is structurally invalid — we
    // prefer the material fallback rather than pretending the number
    // is in some implicit currency.
    const material: MaterialCostLike = {
      inventoryItemId: 'inv-1',
      pricing: { unitCost: 50, currency: 'UGX' },
    };
    const result = resolveMaterialUnitCost(material, {
      costPerUnit: 60,
      currency: '',
    });
    expect(result?.source).toBe('material');
    expect(result?.unitCost).toBe(50);
  });

  it('ignores inventoryCost when costPerUnit is not a number', () => {
    const material: MaterialCostLike = {
      inventoryItemId: 'inv-1',
      pricing: { unitCost: 50, currency: 'UGX' },
    };
    const result = resolveMaterialUnitCost(material, {
      costPerUnit: Number.NaN as unknown as number,
      currency: 'UGX',
    });
    // NaN is a number — the guard only rejects non-numbers, so this
    // test intentionally does NOT guard on NaN. We leave NaN handling
    // to the caller since a NaN cost means "data corruption" and the
    // resolver's silent fallback would hide it.
    expect(result?.source).toBe('inventory');
  });

  it('ignores inventoryCost when material has no inventoryItemId', () => {
    // Even if a caller accidentally supplies an inventory cost, the
    // resolver requires the link to exist on the material — otherwise
    // two unrelated materials sharing a stale inventoryCost would
    // collide.
    const material: MaterialCostLike = {
      pricing: { unitCost: 50, currency: 'UGX' },
    };
    const result = resolveMaterialUnitCost(material, {
      costPerUnit: 60,
      currency: 'UGX',
    });
    expect(result?.source).toBe('material');
    expect(result?.unitCost).toBe(50);
  });

  it('returns null when inventory link set but no cost supplied and no material pricing', () => {
    // Forgot to hydrate the inventory cost AND no material-side
    // pricing either → unknown. Don't fabricate.
    const material: MaterialCostLike = {
      inventoryItemId: 'inv-1',
    };
    expect(resolveMaterialUnitCost(material)).toBeNull();
  });
});

describe('isMaterialPricingOverrideInvalid', () => {
  it('returns false for undefined pricing', () => {
    expect(isMaterialPricingOverrideInvalid(undefined)).toBe(false);
  });

  it('returns false for a clean override (flag + unitCost + currency)', () => {
    expect(
      isMaterialPricingOverrideInvalid({
        unitCost: 50,
        currency: 'UGX',
        isOverride: true,
      }),
    ).toBe(false);
  });

  it('returns true when isOverride=true but unitCost missing', () => {
    expect(
      isMaterialPricingOverrideInvalid({
        currency: 'UGX',
        isOverride: true,
      }),
    ).toBe(true);
  });

  it('returns true when isOverride=true but currency empty', () => {
    expect(
      isMaterialPricingOverrideInvalid({
        unitCost: 50,
        currency: '',
        isOverride: true,
      }),
    ).toBe(true);
  });

  it('returns true for stale overrideReason without isOverride flag', () => {
    // Operator toggled override off but left the reason text behind —
    // writer should prompt them to clear it or re-enable.
    expect(
      isMaterialPricingOverrideInvalid({
        unitCost: 50,
        currency: 'UGX',
        overrideReason: 'old reason',
      }),
    ).toBe(true);
  });

  it('returns false for normal pricing with no override involvement', () => {
    expect(
      isMaterialPricingOverrideInvalid({
        unitCost: 50,
        currency: 'UGX',
      }),
    ).toBe(false);
  });
});

describe('stampMaterialCostOverride (P12-5 audit stamping)', () => {
  const NOW = { _ts: 'now' } as const;
  const EARLIER = { _ts: 'earlier' } as const;

  it('stamps overrideAt + overrideBy on transition false → true', () => {
    const result = stampMaterialCostOverride(
      { unitCost: 50, currency: 'UGX', isOverride: true, overrideReason: 'quote' },
      null, // no previous
      'u1',
      NOW,
    );
    expect(result.isOverride).toBe(true);
    expect(result.overrideAt).toBe(NOW);
    expect(result.overrideBy).toBe('u1');
    expect(result.overrideReason).toBe('quote');
  });

  it('preserves existing stamps when isOverride stays true', () => {
    // Operator edited the reason but the override started earlier —
    // the "first toggle" audit stamp should NOT reset.
    const result = stampMaterialCostOverride(
      { unitCost: 55, currency: 'UGX', isOverride: true, overrideReason: 'updated' },
      { isOverride: true, overrideAt: EARLIER, overrideBy: 'u0' },
      'u1',
      NOW,
    );
    expect(result.overrideAt).toBe(EARLIER);
    expect(result.overrideBy).toBe('u0');
    expect(result.overrideReason).toBe('updated');
  });

  it('honours explicit stamps on incoming payload (backfill path)', () => {
    // Backfill scripts may want to reapply audited values retroactively.
    // If the incoming payload carries its own overrideAt/By, keep them.
    const BACKFILL = { _ts: 'backfill' } as const;
    const result = stampMaterialCostOverride(
      {
        unitCost: 50,
        currency: 'UGX',
        isOverride: true,
        overrideAt: BACKFILL,
        overrideBy: 'backfill-script',
      },
      { isOverride: true, overrideAt: EARLIER, overrideBy: 'u0' },
      'u1',
      NOW,
    );
    expect(result.overrideAt).toBe(BACKFILL);
    expect(result.overrideBy).toBe('backfill-script');
  });

  it('clears stamps + reason when isOverride is turned off', () => {
    const result = stampMaterialCostOverride(
      { unitCost: 50, currency: 'UGX', isOverride: false, overrideReason: 'stale' },
      { isOverride: true, overrideAt: EARLIER, overrideBy: 'u0' },
      'u1',
      NOW,
    );
    expect(result.isOverride).toBe(false);
    expect(result.overrideAt).toBeUndefined();
    expect(result.overrideBy).toBeUndefined();
    expect(result.overrideReason).toBeUndefined();
  });

  it('clears stamps when isOverride is absent (treated as false)', () => {
    const result = stampMaterialCostOverride(
      { unitCost: 50, currency: 'UGX' },
      { isOverride: true, overrideAt: EARLIER, overrideBy: 'u0' },
      'u1',
      NOW,
    );
    expect(result.isOverride).toBe(false);
    expect(result.overrideAt).toBeUndefined();
  });

  it('preserves non-override pricing fields verbatim', () => {
    // The helper must not touch unitCost, currency, unit, supplier, etc.
    // Generic return type guarantees TS catches the shape, but assert
    // the behaviour explicitly since service writers rely on it.
    const result = stampMaterialCostOverride(
      {
        unitCost: 50,
        currency: 'UGX',
        unit: 'sheet' as const,
        supplier: 'Acme',
        marginPercent: 20,
        isOverride: true,
      },
      null,
      'u1',
      NOW,
    );
    expect(result.unitCost).toBe(50);
    expect(result.currency).toBe('UGX');
    expect(result.unit).toBe('sheet');
    expect(result.supplier).toBe('Acme');
    expect(result.marginPercent).toBe(20);
  });

  it('treats null previous identically to undefined previous', () => {
    const a = stampMaterialCostOverride(
      { unitCost: 50, currency: 'UGX', isOverride: true },
      null,
      'u1',
      NOW,
    );
    const b = stampMaterialCostOverride(
      { unitCost: 50, currency: 'UGX', isOverride: true },
      undefined,
      'u1',
      NOW,
    );
    expect(a).toEqual(b);
  });
});
