/**
 * Unit Tests: Transaction Guard
 *
 * Tests for validateTransactableItem utility that prevents
 * transactions against family/parent inventory records.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateTransactableItem,
  checkTransactable,
  InventoryTransactionError,
} from '@/modules/inventory/services/transactionGuard';
import type { InventoryItem } from '@/modules/inventory/types';
import { Timestamp } from 'firebase/firestore';

// Mock the inventoryService
vi.mock('@/modules/inventory/services/inventoryService', () => ({
  getInventoryItem: vi.fn(),
}));

import { getInventoryItem } from '@/modules/inventory/services/inventoryService';
const mockedGetItem = vi.mocked(getInventoryItem);

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'test-id',
    sku: 'TEST-SKU',
    name: 'Test Item',
    category: 'hardware',
    tags: [],
    source: 'manual',
    tier: 'catalogue',
    pricing: { costPerUnit: 100, currency: 'UGX', unit: 'ea' },
    inventory: { inStock: 10 },
    status: 'active',
    isFamily: false,
    isOrderable: true,
    isBomSelectable: true,
    familyId: null,
    createdAt: Timestamp.now(),
    createdBy: 'user',
    updatedAt: Timestamp.now(),
    updatedBy: 'user',
    ...overrides,
  };
}

describe('validateTransactableItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pass validation for a valid active SKU', async () => {
    const item = makeItem();
    mockedGetItem.mockResolvedValue(item);

    const result = await validateTransactableItem('test-id');
    expect(result).toEqual(item);
  });

  it('should pass for a flat item (no family)', async () => {
    const item = makeItem({ familyId: null, isFamily: false });
    mockedGetItem.mockResolvedValue(item);

    const result = await validateTransactableItem('test-id');
    expect(result.id).toBe('test-id');
  });

  it('should throw ITEM_NOT_FOUND for non-existent ID', async () => {
    mockedGetItem.mockResolvedValue(null);

    await expect(validateTransactableItem('non-existent')).rejects.toThrow(
      InventoryTransactionError,
    );
    await expect(validateTransactableItem('non-existent')).rejects.toMatchObject({
      code: 'ITEM_NOT_FOUND',
    });
  });

  it('should throw PARENT_ITEM_NOT_TRANSACTABLE for family record', async () => {
    const family = makeItem({
      isFamily: true,
      isOrderable: false,
      name: 'Mahogany Timber',
    });
    mockedGetItem.mockResolvedValue(family);

    await expect(validateTransactableItem('family-id')).rejects.toThrow(
      InventoryTransactionError,
    );
    try {
      await validateTransactableItem('family-id');
    } catch (err) {
      expect(err).toBeInstanceOf(InventoryTransactionError);
      const txErr = err as InventoryTransactionError;
      expect(txErr.code).toBe('PARENT_ITEM_NOT_TRANSACTABLE');
      expect(txErr.message).toContain('Mahogany Timber');
      expect(txErr.message).toContain('Select a specific variant');
    }
  });

  it('should throw ITEM_NOT_ORDERABLE for non-orderable item', async () => {
    const item = makeItem({ isOrderable: false, isFamily: false });
    mockedGetItem.mockResolvedValue(item);

    await expect(validateTransactableItem('test-id')).rejects.toMatchObject({
      code: 'ITEM_NOT_ORDERABLE',
    });
  });

  it('should throw ITEM_NOT_ACTIVE for inactive SKU', async () => {
    const item = makeItem({ status: 'discontinued' });
    mockedGetItem.mockResolvedValue(item);

    await expect(validateTransactableItem('test-id')).rejects.toMatchObject({
      code: 'ITEM_NOT_ACTIVE',
    });
  });

  it('should throw ITEM_NOT_BOM_SELECTABLE in BOM context', async () => {
    const item = makeItem({ isBomSelectable: false });
    mockedGetItem.mockResolvedValue(item);

    await expect(validateTransactableItem('test-id', 'bom')).rejects.toMatchObject({
      code: 'ITEM_NOT_BOM_SELECTABLE',
    });
  });

  it('should pass for non-BOM-selectable item in PO context', async () => {
    const item = makeItem({ isBomSelectable: false });
    mockedGetItem.mockResolvedValue(item);

    // PO context doesn't check isBomSelectable
    const result = await validateTransactableItem('test-id', 'po');
    expect(result.id).toBe('test-id');
  });

  it('should check family before orderable (family error takes precedence)', async () => {
    const family = makeItem({ isFamily: true, isOrderable: false });
    mockedGetItem.mockResolvedValue(family);

    await expect(validateTransactableItem('test-id')).rejects.toMatchObject({
      code: 'PARENT_ITEM_NOT_TRANSACTABLE',
    });
  });
});

describe('checkTransactable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return valid: true for transactable item', async () => {
    mockedGetItem.mockResolvedValue(makeItem());

    const result = await checkTransactable('test-id');
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.item.id).toBe('test-id');
    }
  });

  it('should return valid: false with error for family record', async () => {
    mockedGetItem.mockResolvedValue(makeItem({ isFamily: true, isOrderable: false }));

    const result = await checkTransactable('test-id');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.code).toBe('PARENT_ITEM_NOT_TRANSACTABLE');
    }
  });
});
