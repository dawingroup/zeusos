/**
 * Estimation Bridge Tests
 *
 * Verifies the bridge delegates to Design Manager's getMaterialUnitCost
 * and doesn't contain its own pricing logic.
 */
import { describe, it, expect, vi } from 'vitest';

// Mock the Design Manager pricing service
vi.mock('@/modules/design-manager/services/materialPricingService', () => ({
  getMaterialUnitCost: vi.fn().mockResolvedValue({
    cost: 32000,
    source: 'inventory',
    currency: 'UGX',
    confidence: 'high',
  }),
}));

import { computePricingFromBOM } from '../services/estimationBridge.service';
import { getMaterialUnitCost } from '@/modules/design-manager/services/materialPricingService';
import type { ComputedBOMLine } from '../types/constraintEngine.types';
import type { ProductDefinitionDocument } from '../types/productDefinition.types';

describe('estimationBridge', () => {
  const mockPDD = {
    pricingConfig: {
      currencyOverride: 'UGX',
      overheadPercent: 15,
      marginPercent: 25,
      taxConfig: { vatApplicable: true },
    },
  } as unknown as ProductDefinitionDocument;

  const mockBOM: ComputedBOMLine[] = [
    {
      bomTemplateLineKey: 'board_18mm',
      materialCategory: 'board_18mm',
      description: 'Board 18mm (m2)',
      quantity: 2.5,
      unit: 'm2',
      inventoryItemId: 'inv-001',
      inventoryItemName: 'MDF 18mm',
      unitCost: 0, // Will be filled by bridge
      currency: 'UGX',
      totalCost: 0,
      wastageApplied: 5,
    },
  ];

  it('calls getMaterialUnitCost for lines with zero cost', async () => {
    const result = await computePricingFromBOM(mockPDD, mockBOM);

    expect(getMaterialUnitCost).toHaveBeenCalledWith(
      'MDF 18mm',
      18,
      'global',
    );
    expect(result.materialsCost).toBe(2.5 * 32000); // quantity * cost from mock
  });

  it('does not contain hardcoded labor rates', async () => {
    const result = await computePricingFromBOM(mockPDD, mockBOM);
    // Labor should be 0 — Design Manager handles labor via processing costs
    expect(result.laborCost).toBe(0);
  });

  it('applies overhead and margin from PDD config', async () => {
    const result = await computePricingFromBOM(mockPDD, mockBOM);
    const materialsCost = 2.5 * 32000;
    const overhead = materialsCost * 0.15;
    const beforeMargin = materialsCost + overhead;
    const margin = beforeMargin * 0.25;
    const subtotal = beforeMargin + margin;
    const vat = subtotal * 0.18;

    expect(result.overheadCost).toBeCloseTo(overhead);
    expect(result.marginAmount).toBeCloseTo(margin);
    expect(result.subtotal).toBeCloseTo(subtotal);
    expect(result.vatAmount).toBeCloseTo(vat);
    expect(result.total).toBeCloseTo(subtotal + vat);
  });
});
