import { describe, expect, it } from 'vitest';

import { approvalRowHref } from '../approvalRowHref';
import {
  projectChangeOrder,
  projectIwo,
  projectMediaSupplierInvoice,
  projectQuote,
  projectSow,
  projectTalentInvoice,
} from '../approvalsProjection';
import type { ApprovalItem, ApprovalKind } from '../types';

const NOW = Date.UTC(2026, 9, 25);

/**
 * One fully-populated fixture per kind, built THROUGH the projectors so the
 * test also proves each projector hands the href resolver the ids it needs.
 */
function fixtures(): Record<ApprovalKind, ApprovalItem> {
  return {
    ecd_rung: projectIwo(
      { id: 'iwo1', state: 'DELIVERED', approvalChain: { currentRung: 'CD', complete: false, history: [] } },
      NOW,
    )!,
    iwo_internal_acceptance: projectIwo({ id: 'iwo2', state: 'DELIVERED' }, NOW)!,
    sow_approval: projectSow({ id: 'sow1', clientId: 'c1', msaId: 'm1', status: 'PENDING_APPROVAL' }, NOW)!,
    change_order: projectChangeOrder(
      { id: 'co1', clientId: 'c1', msaId: 'm1', sowId: 'sow1', status: 'DRAFT', deltaMinor: 1 },
      NOW,
    )!,
    quote_awaiting_client: projectQuote({ id: 'q1', clientId: 'c1', status: 'ISSUED' }, NOW)!,
    talent_invoice: projectTalentInvoice({ id: 't1', status: 'SUBMITTED' }, NOW)!,
    media_supplier_invoice: projectMediaSupplierInvoice({ id: 'mi1', mediaPlanId: 'mp1', status: 'SUBMITTED' }, NOW)!,
  };
}

describe('approvalRowHref', () => {
  it('resolves EVERY kind the projectors emit to a routed page (no dead rows)', () => {
    const all = fixtures();
    for (const [kind, item] of Object.entries(all) as Array<[ApprovalKind, ApprovalItem]>) {
      expect(approvalRowHref(item), `kind ${kind} must link somewhere`).toEqual(expect.any(String));
    }
  });

  it('points at the record pages the rest of the app uses', () => {
    const f = fixtures();
    expect(approvalRowHref(f.ecd_rung)).toBe('/delivery/iwo/iwo1');
    expect(approvalRowHref(f.iwo_internal_acceptance)).toBe('/delivery/iwo/iwo2');
    expect(approvalRowHref(f.sow_approval)).toBe('/clients/c1/msas/m1/sows/sow1');
    expect(approvalRowHref(f.change_order)).toBe('/clients/c1/msas/m1/sows/sow1/change-orders/co1');
    expect(approvalRowHref(f.quote_awaiting_client)).toBe('/pricing/quotes/q1');
    expect(approvalRowHref(f.talent_invoice)).toBe('/talent/invoices');
    expect(approvalRowHref(f.media_supplier_invoice)).toBe('/media/mp1');
  });

  it('falls back to the nearest routed ancestor when a denormalised id is missing', () => {
    const noMsa = projectSow({ id: 'sow1', clientId: 'c1', status: 'PENDING_APPROVAL' }, NOW)!;
    expect(approvalRowHref(noMsa)).toBe('/clients/c1');

    const coNoSow = projectChangeOrder({ id: 'co1', clientId: 'c1', msaId: 'm1', status: 'DRAFT' }, NOW)!;
    expect(approvalRowHref(coNoSow)).toBe('/clients/c1');

    const coNoClient = projectChangeOrder({ id: 'co1', status: 'DRAFT' }, NOW)!;
    expect(approvalRowHref(coNoClient)).toBeNull();

    const mediaNoPlan = projectMediaSupplierInvoice({ id: 'mi1', status: 'SUBMITTED' }, NOW)!;
    expect(approvalRowHref(mediaNoPlan)).toBe('/media');
  });

  it('URL-encodes ids', () => {
    const item = projectIwo({ id: 'iwo/with slash', state: 'DELIVERED' }, NOW)!;
    expect(approvalRowHref(item)).toBe('/delivery/iwo/iwo%2Fwith%20slash');
  });
});
