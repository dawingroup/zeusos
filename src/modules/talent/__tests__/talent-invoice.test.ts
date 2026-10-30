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
vi.mock('@/core/services/firebase/config', () => ({ app: {} }));

// Approval is a callable since routing v2 / ADR-2026-10-25 — the client no
// longer writes APPROVED. `httpsCallable` hands back this spy.
const mockApproveCallable = vi.fn();
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(() => mockApproveCallable),
}));

const mockGetDoc = vi.fn();
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockAddDoc = vi.fn();

const mockBatchUpdate = vi.fn();
const mockBatchSet    = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
const mockWriteBatch  = vi.fn(() => ({
  update: mockBatchUpdate,
  set:    mockBatchSet,
  commit: mockBatchCommit,
}));

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
  writeBatch:      mockWriteBatch,
}));

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function makeInvoice(status: TalentInvoice['status']): TalentInvoice {
  return {
    id: 'inv-001',
    talentProfileId: 'talent-001',
    orgId: 'org-default',
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
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-wire writeBatch mock after clearAllMocks resets the return value.
    mockWriteBatch.mockReturnValue({
      update: mockBatchUpdate,
      set:    mockBatchSet,
      commit: mockBatchCommit,
    });
  });

  it('is a server decision: calls the approveTalentInvoice callable and writes nothing from the client', async () => {
    mockApproveCallable.mockResolvedValueOnce({ data: { id: 'inv-001', status: 'APPROVED', level: 1, complete: true, pendingLevel: null, bandId: 'lead', signaturesRequired: 1 } });

    const { approveTalentInvoice } = await import('../services/talent-invoice.service');
    const result = await approveTalentInvoice('inv-001', 'looks right');

    expect(mockApproveCallable).toHaveBeenCalledWith({ invoiceId: 'inv-001', note: 'looks right' });
    expect(result.status).toBe('APPROVED');
    expect(result.complete).toBe(true);
    // ADR-2026-10-25: no client write enters APPROVED, no client-emitted outbox event.
    expect(mockWriteBatch).not.toHaveBeenCalled();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it('reports a partial signature for a multi-level plan', async () => {
    mockApproveCallable.mockResolvedValueOnce({ data: { id: 'inv-001', status: 'SUBMITTED', level: 1, complete: false, pendingLevel: 2, bandId: 'group', signaturesRequired: 2 } });

    const { approveTalentInvoice, describeApprovalProgress } = await import('../services/talent-invoice.service');
    const result = await approveTalentInvoice('inv-001');
    expect(mockApproveCallable).toHaveBeenCalledWith({ invoiceId: 'inv-001' });
    expect(result.complete).toBe(false);
    expect(describeApprovalProgress(result, 'inv-001')).toBe('Signed level 1 of 2 for inv-001 — awaiting level 2.');
    expect(describeApprovalProgress({ id: 'x', status: 'APPROVED', complete: true }, 'inv-001')).toBe('Approved: inv-001');
  });

  it('surfaces the server refusal (raiser, under tier, wrong status) as the thrown error', async () => {
    mockApproveCallable.mockRejectedValueOnce(Object.assign(new Error('You raised this — someone else has to approve it.'), { code: 'functions/permission-denied' }));

    const { approveTalentInvoice } = await import('../services/talent-invoice.service');
    await expect(approveTalentInvoice('inv-001')).rejects.toThrow(/You raised this/);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
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
