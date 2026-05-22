/**
 * Unit tests — Talent Invoice module (Phase 4).
 *
 * Covers:
 *   - approveTalentInvoice: only SUBMITTED → APPROVED
 *   - rejectTalentInvoice: only SUBMITTED → REJECTED
 *   - markTalentInvoicePaid: REJECTED → PAID throws; APPROVED → PAID succeeds
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TalentInvoice } from '../types/talent-invoice.types';

// ─────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────

vi.mock('@/shared/services/firebase', () => ({ db: {} }));

const mockGetDoc = vi.fn();
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockAddDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection:      vi.fn(() => ({ __kind: 'collection' })),
  doc:             vi.fn((_db, coll, id) => ({ __kind: 'doc', __id: id, id, __path: `${coll}/${id}` })),
  addDoc:          mockAddDoc,
  getDoc:          mockGetDoc,
  getDocs:         vi.fn(),
  updateDoc:       mockUpdateDoc,
  query:           vi.fn(),
  where:           vi.fn(),
  orderBy:         vi.fn(),
  serverTimestamp: vi.fn(() => '__SERVER_TS__'),
  setDoc:          mockSetDoc,
}));

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function makeInvoice(status: TalentInvoice['status']): TalentInvoice {
  return {
    id: 'inv-001',
    talentProfileId: 'talent-001',
    amountMinor: 2_000_000_00, // 2,000,000 UGX
    currency: 'UGX',
    invoiceStorageRef: 'invoices/2026/INV-001.pdf',
    status,
    createdBy: 'talent-001',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

function mockGetInvoice(invoice: TalentInvoice) {
  mockGetDoc.mockResolvedValueOnce({
    exists: () => true,
    id: invoice.id,
    data: () => invoice,
  });
}

// ─────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────

describe('approveTalentInvoice', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('transitions SUBMITTED → APPROVED and emits domain event', async () => {
    mockGetInvoice(makeInvoice('SUBMITTED'));

    const { approveTalentInvoice } = await import('../services/talent-invoice.service');
    await approveTalentInvoice('inv-001', 'am-user');

    expect(mockUpdateDoc).toHaveBeenCalledOnce();
    const [, payload] = mockUpdateDoc.mock.calls[0];
    expect(payload.status).toBe('APPROVED');
    expect(payload.approvedBy).toBe('am-user');

    // Domain event written.
    expect(mockSetDoc).toHaveBeenCalledOnce();
    const [, eventPayload] = mockSetDoc.mock.calls[0];
    expect(eventPayload.type).toBe('TALENT_INVOICE_APPROVED');
  });

  it('throws when invoice is APPROVED (not SUBMITTED)', async () => {
    mockGetInvoice(makeInvoice('APPROVED'));

    const { approveTalentInvoice } = await import('../services/talent-invoice.service');
    await expect(approveTalentInvoice('inv-001', 'am-user')).rejects.toThrow(
      /Can only approve SUBMITTED/,
    );
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('throws when invoice is REJECTED', async () => {
    mockGetInvoice(makeInvoice('REJECTED'));

    const { approveTalentInvoice } = await import('../services/talent-invoice.service');
    await expect(approveTalentInvoice('inv-001', 'am-user')).rejects.toThrow(
      /Can only approve SUBMITTED/,
    );
  });
});

describe('rejectTalentInvoice', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('transitions SUBMITTED → REJECTED with reason', async () => {
    mockGetInvoice(makeInvoice('SUBMITTED'));

    const { rejectTalentInvoice } = await import('../services/talent-invoice.service');
    await rejectTalentInvoice('inv-001', 'am-user', 'Invoice does not match PO scope');

    expect(mockUpdateDoc).toHaveBeenCalledOnce();
    const [, payload] = mockUpdateDoc.mock.calls[0];
    expect(payload.status).toBe('REJECTED');
    expect(payload.rejectionReason).toBe('Invoice does not match PO scope');
  });

  it('throws when invoice is already APPROVED', async () => {
    mockGetInvoice(makeInvoice('APPROVED'));

    const { rejectTalentInvoice } = await import('../services/talent-invoice.service');
    await expect(rejectTalentInvoice('inv-001', 'am-user', 'reason')).rejects.toThrow(
      /Can only reject SUBMITTED/,
    );
  });
});

describe('markTalentInvoicePaid', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('transitions APPROVED → PAID', async () => {
    mockGetInvoice(makeInvoice('APPROVED'));

    const { markTalentInvoicePaid } = await import('../services/talent-invoice.service');
    await markTalentInvoicePaid('inv-001');

    expect(mockUpdateDoc).toHaveBeenCalledOnce();
    const [, payload] = mockUpdateDoc.mock.calls[0];
    expect(payload.status).toBe('PAID');
  });

  it('REJECTED invoice cannot transition to PAID', async () => {
    mockGetInvoice(makeInvoice('REJECTED'));

    const { markTalentInvoicePaid } = await import('../services/talent-invoice.service');
    await expect(markTalentInvoicePaid('inv-001')).rejects.toThrow(
      /REJECTED invoice cannot be marked PAID/,
    );
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('SUBMITTED invoice cannot be marked PAID directly', async () => {
    mockGetInvoice(makeInvoice('SUBMITTED'));

    const { markTalentInvoicePaid } = await import('../services/talent-invoice.service');
    await expect(markTalentInvoicePaid('inv-001')).rejects.toThrow(
      /must be APPROVED before marking PAID/,
    );
  });
});
