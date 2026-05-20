/**
 * Unit Tests: Variant SKU Generation
 *
 * Tests for generateVariantSku and generateVariantName functions
 * that auto-create SKU codes and display names for family variants.
 */

import { describe, it, expect } from 'vitest';
import {
  generateVariantSku,
  generateVariantName,
} from '@/modules/inventory/services/inventoryService';
import type { VariantAttribute } from '@/modules/inventory/types';

describe('generateVariantSku', () => {
  it('should generate SKU from family code and single attribute', () => {
    const attrs: VariantAttribute[] = [{ key: 'color', value: 'Black' }];
    const result = generateVariantSku('SOFA-EXC', attrs);
    expect(result).toBe('SOFA-EXC-BLACK');
  });

  it('should generate SKU from multiple attributes', () => {
    const attrs: VariantAttribute[] = [
      { key: 'color', value: 'Black' },
      { key: 'fabric', value: 'Linen' },
    ];
    const result = generateVariantSku('SOFA-EXC', attrs);
    expect(result).toBe('SOFA-EXC-BLACK-LINEN');
  });

  it('should handle numeric attribute values', () => {
    const attrs: VariantAttribute[] = [
      { key: 'thickness_mm', value: '25' },
      { key: 'width_mm', value: '100' },
      { key: 'grade', value: 'A' },
    ];
    const result = generateVariantSku('MAH', attrs);
    expect(result).toBe('MAH-25-100-A');
  });

  it('should strip special characters from values', () => {
    const attrs: VariantAttribute[] = [
      { key: 'size', value: '25x100mm' },
    ];
    const result = generateVariantSku('WOD', attrs);
    expect(result).toBe('WOD-25X100');
  });

  it('should truncate long attribute values to 6 chars', () => {
    const attrs: VariantAttribute[] = [
      { key: 'finish', value: 'SuperLongFinishName' },
    ];
    const result = generateVariantSku('ITEM', attrs);
    expect(result).toBe('ITEM-SUPERL');
  });

  it('should handle empty attributes', () => {
    const attrs: VariantAttribute[] = [];
    const result = generateVariantSku('ITEM', attrs);
    expect(result).toBe('ITEM-');
  });
});

describe('generateVariantName', () => {
  it('should generate name with single attribute', () => {
    const attrs: VariantAttribute[] = [{ key: 'color', value: 'Black' }];
    const result = generateVariantName('Executive Sofa', attrs);
    expect(result).toBe('Executive Sofa – Black');
  });

  it('should join multiple attributes with " / "', () => {
    const attrs: VariantAttribute[] = [
      { key: 'color', value: 'Black' },
      { key: 'fabric', value: 'Linen' },
    ];
    const result = generateVariantName('Executive Sofa', attrs);
    expect(result).toBe('Executive Sofa – Black / Linen');
  });

  it('should handle material dimensions', () => {
    const attrs: VariantAttribute[] = [
      { key: 'thickness', value: '25x100mm' },
      { key: 'grade', value: 'Grade A' },
    ];
    const result = generateVariantName('Mahogany Timber', attrs);
    expect(result).toBe('Mahogany Timber – 25x100mm / Grade A');
  });

  it('should return family name for empty attributes', () => {
    const result = generateVariantName('Test Item', []);
    expect(result).toBe('Test Item');
  });

  it('should handle single attribute with complex value', () => {
    const attrs: VariantAttribute[] = [
      { key: 'spec', value: '110° Soft-Close' },
    ];
    const result = generateVariantName('Blum Hinge', attrs);
    expect(result).toBe('Blum Hinge – 110° Soft-Close');
  });
});
