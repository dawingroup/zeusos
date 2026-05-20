/**
 * Tests for materialCostService (P12-2).
 *
 * Covers the hydrator (which wraps `getInventoryItem`) and the pure
 * drift detector. The hydrator tests mock the inventory module so the
 * service can be exercised without a live Firestore — the pure
 * resolver underneath already has full coverage in P12-1.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Material } from '../../types/materials';
import {
  detectMaterialCostDrift,
  resolveMaterialCost,
} from '../materialCostService';

// Mock the inventory lookup. We only use `getInventoryItem` from this
// module, so the factory returns a typed stub for it and nothing else.
vi.mock('@/modules/inventory/services/inventoryService', () => ({
  getInventoryItem: vi.fn(),
}));
import { getInventoryItem } from '@/modules/inventory/services/inventoryService';
const mockGetInventoryItem = vi.mocked(getInventoryItem);

// Timestamp sentinel — the resolver never inspects it.
const TS = { _ts: true } as unknown as Material['createdAt'];

function makeMaterial(overrides: Partial<Material> = {}): Material {
  return {
    id: 'mat-1',
    code: 'MAT-001',
    name: 'Test Material',
    category: 'sheet-goods',
    status: 'active',
    tier: 'global',
    createdAt: TS,
    createdBy: 'u1',
    updatedAt: TS,
    updatedBy: 'u1',
    ...overrides,
  } as Material;
}

beforeEach(() => {
  mockGetInventoryItem.mockReset();
});

describe('resolveMaterialCost', () => {
  it('returns inventory-source when material is linked and inventory has pricing', async () => {
    // Happy path: InventoryItem is the source of truth for cost.
    // P12-2's fetchInventoryCostForMaterial requires a resolvable stockUom
    // (purchaseUom || pricing.unit) — without one it returns null and the
    // resolver falls back to material-source. The mock now mirrors a real
    // inventory item with its UoM populated.
    mockGetInventoryItem.mockResolvedValue({
      id: 'inv-1',
      purchaseUom: 'sheet',
      stockUom: 'sheet',
      pricing: { costPerUnit: 60, currency: 'UGX', unit: 'sheet' },
    } as any);

    const material = makeMaterial({
      inventoryItemId: 'inv-1',
      pricing: { unitCost: 50, currency: 'UGX', unit: 'sheet' },
    });
    const result = await resolveMaterialCost(material);

    expect(result?.source).toBe('inventory');
    expect(result?.unitCost).toBe(60);
    expect(result?.currency).toBe('UGX');
    expect(mockGetInventoryItem).toHaveBeenCalledWith('inv-1');
  });

  it('returns material-source and skips the fetch when no inventoryItemId', async () => {
    // Materials without a link shouldn't pay for a roundtrip.
    const material = makeMaterial({
      pricing: { unitCost: 40, currency: 'UGX', unit: 'sheet' },
    });
    const result = await resolveMaterialCost(material);

    expect(result?.source).toBe('material');
    expect(result?.unitCost).toBe(40);
    expect(mockGetInventoryItem).not.toHaveBeenCalled();
  });

  it('returns material-source fallback when inventory link is set but item is missing', async () => {
    // Stale FK — the linked inventory item was deleted. Fall back to
    // material pricing rather than returning null (users still want a
    // best-guess cost on the BOQ).
    mockGetInventoryItem.mockResolvedValue(null);

    const material = makeMaterial({
      inventoryItemId: 'inv-gone',
      pricing: { unitCost: 40, currency: 'UGX', unit: 'sheet' },
    });
    const result = await resolveMaterialCost(material);

    expect(result?.source).toBe('material');
    expect(result?.unitCost).toBe(40);
  });

  it('returns material-source when linked inventory has incomplete pricing', async () => {
    // Inventory item exists but its pricing wasn't populated —
    // treat the link as "not hydratable" and fall back.
    mockGetInventoryItem.mockResolvedValue({
      id: 'inv-1',
      pricing: { costPerUnit: 60 /* currency missing */ },
    } as any);

    const material = makeMaterial({
      inventoryItemId: 'inv-1',
      pricing: { unitCost: 40, currency: 'UGX', unit: 'sheet' },
    });
    const result = await resolveMaterialCost(material);

    expect(result?.source).toBe('material');
  });

  it('returns override-source when isOverride=true even if inventory has a different cost', async () => {
    // Override wins over the inventory link — mirrors the P12-1
    // resolver contract, but verified end-to-end through the hydrator.
    mockGetInventoryItem.mockResolvedValue({
      id: 'inv-1',
      pricing: { costPerUnit: 60, currency: 'UGX' },
    } as any);

    const material = makeMaterial({
      inventoryItemId: 'inv-1',
      pricing: {
        unitCost: 75,
        currency: 'UGX',
        unit: 'sheet',
        isOverride: true,
        overrideReason: 'Rush supplier quote',
      },
    });
    const result = await resolveMaterialCost(material);

    expect(result?.source).toBe('override');
    expect(result?.unitCost).toBe(75);
    expect(result?.overrideReason).toBe('Rush supplier quote');
  });

  it('returns null when no pricing, no inventory link', async () => {
    // Mid-creation material with nothing set — callers must render
    // "unknown", never 0.
    const material = makeMaterial();
    expect(await resolveMaterialCost(material)).toBeNull();
    expect(mockGetInventoryItem).not.toHaveBeenCalled();
  });
});

describe('detectMaterialCostDrift', () => {
  it('returns drift when material.pricing diverges from inventory cost', () => {
    const material = makeMaterial({
      inventoryItemId: 'inv-1',
      pricing: { unitCost: 50, currency: 'UGX', unit: 'sheet' },
    });
    const result = detectMaterialCostDrift(material, {
      costPerUnit: 60,
      currency: 'UGX',
    });

    expect(result).toEqual({
      hasDrift: true,
      materialUnitCost: 50,
      materialCurrency: 'UGX',
      inventoryUnitCost: 60,
      inventoryCurrency: 'UGX',
      delta: 10,
      currencyMismatch: false,
    });
  });

  it('returns hasDrift=false when material pricing matches inventory exactly', () => {
    const material = makeMaterial({
      inventoryItemId: 'inv-1',
      pricing: { unitCost: 60, currency: 'UGX', unit: 'sheet' },
    });
    const result = detectMaterialCostDrift(material, {
      costPerUnit: 60,
      currency: 'UGX',
    });

    expect(result?.hasDrift).toBe(false);
    expect(result?.delta).toBe(0);
  });

  it('returns null when material has no inventory link', () => {
    // No link = no drift signal possible.
    const material = makeMaterial({
      pricing: { unitCost: 50, currency: 'UGX', unit: 'sheet' },
    });
    expect(
      detectMaterialCostDrift(material, { costPerUnit: 60, currency: 'UGX' }),
    ).toBeNull();
  });

  it('returns null when isOverride=true (drift is intentional)', () => {
    // An explicit override means the operator ACCEPTED the divergence.
    // Surfacing a "drift" badge here would be noise.
    const material = makeMaterial({
      inventoryItemId: 'inv-1',
      pricing: {
        unitCost: 75,
        currency: 'UGX',
        unit: 'sheet',
        isOverride: true,
      },
    });
    expect(
      detectMaterialCostDrift(material, { costPerUnit: 60, currency: 'UGX' }),
    ).toBeNull();
  });

  it('returns null when material pricing is incomplete', () => {
    // No material unitCost to compare against — can't report drift.
    const material = makeMaterial({
      inventoryItemId: 'inv-1',
      pricing: {
        currency: 'UGX',
        unit: 'sheet',
      } as Material['pricing'],
    });
    expect(
      detectMaterialCostDrift(material, { costPerUnit: 60, currency: 'UGX' }),
    ).toBeNull();
  });

  it('flags currency mismatch distinctly from numeric drift', () => {
    // Material is in KES, inventory is in UGX — that's a data-entry
    // bug, not a price move. hasDrift is true but delta is null so
    // the UI can special-case the tooltip.
    const material = makeMaterial({
      inventoryItemId: 'inv-1',
      pricing: { unitCost: 50, currency: 'KES', unit: 'sheet' },
    });
    const result = detectMaterialCostDrift(material, {
      costPerUnit: 60,
      currency: 'UGX',
    });

    expect(result?.hasDrift).toBe(true);
    expect(result?.currencyMismatch).toBe(true);
    expect(result?.delta).toBeNull();
  });

  it('returns null when inventoryCost is null (nothing to compare against)', () => {
    const material = makeMaterial({
      inventoryItemId: 'inv-1',
      pricing: { unitCost: 50, currency: 'UGX', unit: 'sheet' },
    });
    expect(detectMaterialCostDrift(material, null)).toBeNull();
    expect(detectMaterialCostDrift(material, undefined)).toBeNull();
  });
});
