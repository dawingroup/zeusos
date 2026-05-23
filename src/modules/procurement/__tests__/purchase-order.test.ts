/**
 * Unit tests — Purchase Order service (Phase 4.1 procurement viewer).
 *
 * Covers:
 *   - listPurchaseOrders orgId guard (spec §7.4)
 *   - buildPurchaseOrderId deterministic id helper
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/shared/services/firebase', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc:        vi.fn(),
  getDoc:     vi.fn(),
  getDocs:    vi.fn(),
  query:      vi.fn(),
  where:      vi.fn(),
  orderBy:    vi.fn(),
  limit:      vi.fn(),
}));

import { listPurchaseOrders } from '../services/purchase-order.service';
import { buildPurchaseOrderId } from '../types/purchase-order.types';

describe('listPurchaseOrders orgId guard', () => {
  it('throws when orgId is empty (spec §7.4 commercial gravity)', async () => {
    await expect(listPurchaseOrders({ orgId: '' })).rejects.toThrow(
      /orgId filter is required/,
    );
  });

  it('throws when called without filters at all (default orgId is "")', async () => {
    // No type-error directive needed — listPurchaseOrders has a default
    // filters arg ({ orgId: '' }), so the no-arg call is type-valid but
    // the empty orgId triggers the runtime guard.
    await expect(listPurchaseOrders()).rejects.toThrow();
  });
});

describe('buildPurchaseOrderId', () => {
  it('builds talent PO id with po_talent_ prefix', () => {
    expect(buildPurchaseOrderId('TALENT_FREELANCER', 'inv001')).toBe('po_talent_inv001');
  });

  it('builds media PO id with po_media_ prefix', () => {
    expect(buildPurchaseOrderId('MEDIA_SUPPLIER', 'msinv099')).toBe('po_media_msinv099');
  });

  it('builds vendor PO id with po_vendor_ prefix', () => {
    expect(buildPurchaseOrderId('VENDOR_OTHER', 'vinv001')).toBe('po_vendor_vinv001');
  });

  it('is deterministic — same inputs always produce same id', () => {
    const id1 = buildPurchaseOrderId('TALENT_FREELANCER', 'inv-deterministic');
    const id2 = buildPurchaseOrderId('TALENT_FREELANCER', 'inv-deterministic');
    expect(id1).toBe(id2);
  });
});
