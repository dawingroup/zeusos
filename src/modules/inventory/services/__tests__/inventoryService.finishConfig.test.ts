import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDoc, updateDoc } from 'firebase/firestore';
import { getInventoryItem, updateInventoryItem } from '../inventoryService';

const mockedGetDoc = vi.mocked(getDoc);
const mockedUpdateDoc = vi.mocked(updateDoc);

describe('inventoryService finish config regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps finish fields from Firestore into InventoryItem', async () => {
    mockedGetDoc.mockResolvedValueOnce({
      id: 'item-1',
      exists: () => true,
      data: () => ({
        sku: 'SKU-001',
        name: 'Demo Item',
        category: 'finishing',
        source: 'manual',
        tier: 'catalogue',
        pricing: { costPerUnit: 10, currency: 'UGX', unit: 'ea' },
        inventory: { inStock: 0 },
        status: 'active',
        createdBy: 'user-a',
        updatedBy: 'user-a',
        finishCategory: 'board',
        finishSubtype: 'melamine',
        linkedFinishes: [
          {
            finishId: 'fin-1',
            finishName: 'Arctic White',
            finishCode: 'MEL-AW-001',
            isDefault: true,
          },
        ],
        linkedFinishIds: ['fin-1'],
        requiredAttributes: ['thickness_mm'],
        attributeConstraints: {
          thickness_mm: [18, 25],
        },
      }),
    } as any);

    const item = await getInventoryItem('item-1');

    expect(item).not.toBeNull();
    expect(item?.finishCategory).toBe('board');
    expect(item?.finishSubtype).toBe('melamine');
    expect(item?.linkedFinishIds).toEqual(['fin-1']);
    expect(item?.linkedFinishes).toEqual([
      expect.objectContaining({
        finishId: 'fin-1',
        finishName: 'Arctic White',
        finishCode: 'MEL-AW-001',
        isDefault: true,
      }),
    ]);
    expect(item?.requiredAttributes).toEqual(['thickness_mm']);
    expect(item?.attributeConstraints).toEqual({
      thickness_mm: [18, 25],
    });
  });

  it('persists finish fields when updating an inventory item', async () => {
    // updateInventoryItem now pre-reads the doc (to detect family-membership
    // changes); mirror that with an existing-doc snapshot so the regression
    // test exercises the persist path rather than the not-found guard.
    mockedGetDoc.mockResolvedValueOnce({
      id: 'item-1',
      exists: () => true,
      data: () => ({
        sku: 'SKU-001',
        name: 'Demo Item',
        category: 'finishing',
        source: 'manual',
        tier: 'catalogue',
        status: 'active',
        pricing: { costPerUnit: 10, currency: 'UGX', unit: 'ea' },
        familyId: null,
      }),
    } as any);
    mockedUpdateDoc.mockResolvedValueOnce(undefined);

    await updateInventoryItem(
      'item-1',
      {
        finishCategory: 'board',
        finishSubtype: 'melamine',
        linkedFinishes: [
          {
            finishId: 'fin-1',
            finishName: 'Arctic White',
            finishCode: 'MEL-AW-001',
            isDefault: true,
          },
        ],
        linkedFinishIds: ['fin-1'],
        requiredAttributes: ['thickness_mm'],
        attributeConstraints: {
          thickness_mm: [18, 25],
        },
      },
      'user-1',
    );

    expect(mockedUpdateDoc).toHaveBeenCalledOnce();
    const [, payload] = mockedUpdateDoc.mock.calls[0];
    expect(payload).toMatchObject({
      finishCategory: 'board',
      finishSubtype: 'melamine',
      linkedFinishIds: ['fin-1'],
      requiredAttributes: ['thickness_mm'],
      attributeConstraints: {
        thickness_mm: [18, 25],
      },
      updatedBy: 'user-1',
    });
    expect((payload as any).linkedFinishes).toEqual([
      expect.objectContaining({
        finishId: 'fin-1',
        finishName: 'Arctic White',
        finishCode: 'MEL-AW-001',
        isDefault: true,
      }),
    ]);
  });
});
