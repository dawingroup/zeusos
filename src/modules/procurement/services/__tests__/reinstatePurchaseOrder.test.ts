/**
 * Tests for reinstatePurchaseOrder service function
 *
 * Validates the cancelled → draft transition, including:
 * - Happy path: cancelled PO reinstated to draft
 * - Rejection: non-cancelled PO cannot be reinstated
 * - Rejection: non-existent PO
 * - Notes appended correctly with and without reason
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDoc, updateDoc } from 'firebase/firestore';
import { reinstatePurchaseOrder } from '../purchaseOrderService';

// The Firestore mock alias in vitest.config.ts resolves to src/firebase/__mocks__/firestore.ts
// so getDoc, updateDoc, etc. are already vi.fn() instances.

const mockedGetDoc = vi.mocked(getDoc);
const mockedUpdateDoc = vi.mocked(updateDoc);

function makePOSnap(overrides: Record<string, unknown> = {}) {
  return {
    exists: () => true,
    data: () => ({
      status: 'cancelled',
      notes: '',
      supplierId: 'sup-1',
      supplierName: 'Test Supplier',
      lineItems: [],
      receivingHistory: [],
      ...overrides,
    }),
    id: 'po-123',
  };
}

describe('reinstatePurchaseOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reinstates a cancelled PO to draft with a reason', async () => {
    mockedGetDoc.mockResolvedValueOnce(makePOSnap({ status: 'cancelled', notes: 'Original note' }) as any);
    mockedUpdateDoc.mockResolvedValueOnce(undefined);

    await reinstatePurchaseOrder('po-123', 'user-1', 'Customer changed mind');

    expect(mockedUpdateDoc).toHaveBeenCalledOnce();
    const [, updatePayload] = mockedUpdateDoc.mock.calls[0];
    expect(updatePayload).toMatchObject({
      status: 'draft',
      updatedBy: 'user-1',
    });
    // Notes should contain both original and reinstatement reason
    expect((updatePayload as any).notes).toContain('[REINSTATED]');
    expect((updatePayload as any).notes).toContain('Customer changed mind');
    expect((updatePayload as any).notes).toContain('Original note');
  });

  it('reinstates with default reason when none provided', async () => {
    mockedGetDoc.mockResolvedValueOnce(makePOSnap({ status: 'cancelled', notes: '' }) as any);
    mockedUpdateDoc.mockResolvedValueOnce(undefined);

    await reinstatePurchaseOrder('po-123', 'user-1');

    const [, updatePayload] = mockedUpdateDoc.mock.calls[0];
    expect((updatePayload as any).notes).toContain('Reinstated from cancelled state');
  });

  it('throws if PO is not found', async () => {
    mockedGetDoc.mockResolvedValueOnce({
      exists: () => false,
      data: () => undefined,
      id: '',
    } as any);

    await expect(reinstatePurchaseOrder('po-missing', 'user-1')).rejects.toThrow('PO not found');
    expect(mockedUpdateDoc).not.toHaveBeenCalled();
  });

  it('throws if PO status is not cancelled', async () => {
    mockedGetDoc.mockResolvedValueOnce(makePOSnap({ status: 'approved' }) as any);

    await expect(reinstatePurchaseOrder('po-123', 'user-1')).rejects.toThrow(
      'Only cancelled POs can be reinstated',
    );
    expect(mockedUpdateDoc).not.toHaveBeenCalled();
  });

  it('throws if PO is in draft status', async () => {
    mockedGetDoc.mockResolvedValueOnce(makePOSnap({ status: 'draft' }) as any);

    await expect(reinstatePurchaseOrder('po-123', 'user-1')).rejects.toThrow(
      'Only cancelled POs can be reinstated',
    );
  });

  it('throws if PO is closed', async () => {
    mockedGetDoc.mockResolvedValueOnce(makePOSnap({ status: 'closed' }) as any);

    await expect(reinstatePurchaseOrder('po-123', 'user-1')).rejects.toThrow(
      'Only cancelled POs can be reinstated',
    );
  });

  it('preserves existing notes with newline separator', async () => {
    mockedGetDoc.mockResolvedValueOnce(
      makePOSnap({ status: 'cancelled', notes: 'Line 1\nLine 2' }) as any,
    );
    mockedUpdateDoc.mockResolvedValueOnce(undefined);

    await reinstatePurchaseOrder('po-123', 'user-1', 'Back in business');

    const [, updatePayload] = mockedUpdateDoc.mock.calls[0];
    const notes = (updatePayload as any).notes as string;
    expect(notes).toBe('Line 1\nLine 2\n[REINSTATED] Back in business');
  });
});
