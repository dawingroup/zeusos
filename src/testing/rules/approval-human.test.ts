/**
 * ADR-2026-10-25 — approvals need a human (rules layer).
 *
 * The supplier-spend collections (talent / media invoices, manual purchase
 * orders) move money out of the group. The client may still reject, pay and
 * edit them, but:
 *   • it may NOT move an invoice INTO APPROVED — that is the approval
 *     callables' door (routing v2 signature ladder);
 *   • whoever is recorded as `approvedBy` must be the caller, and the caller
 *     must not be the person who raised the record.
 *
 * Run against the Firestore emulator: `npm run test:rules:emulated`.
 */

import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, updateDoc } from 'firebase/firestore';

import { bootstrap, teardown, seedFixtures, PARENT_ADMIN_UID, SUBSIDIARY_USER_UID } from './setup';

let env: RulesTestEnvironment;

const INV_OTHER = 'ti_raised_by_someone_else';
const INV_SELF = 'ti_raised_by_parent_admin';
const PO_SELF = 'po_raised_by_parent_admin';
const PO_OTHER = 'po_raised_by_someone_else';

beforeAll(async () => {
  env = await bootstrap();
});

afterAll(async () => {
  await teardown();
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedFixtures(env);
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const invoice = (createdBy: string) => ({
      talentProfileId: 'tp_1',
      masterJobId: 'mj_1',
      orgId: 'zeus-group',
      amountMinor: 5_000_000,
      currency: 'KES',
      status: 'SUBMITTED',
      createdBy,
      createdAt: '2026-10-20T00:00:00.000Z',
    });
    await db.doc(`talent_invoices/${INV_OTHER}`).set(invoice(SUBSIDIARY_USER_UID));
    await db.doc(`talent_invoices/${INV_SELF}`).set(invoice(PARENT_ADMIN_UID));
    await db.doc(`media_supplier_invoices/${INV_OTHER}`).set({ ...invoice(SUBSIDIARY_USER_UID), supplierOrgId: 'sup_1', mediaPlanId: 'mp_1' });
    const po = (raisedBy: string) => ({
      kind: 'VENDOR_OTHER',
      sourceInvoiceId: 'manual',
      amountMinor: 1_000_000,
      currency: 'KES',
      masterJobId: 'mj_1',
      status: 'OPEN',
      postedToGL: false,
      raisedBy,
    });
    await db.doc(`purchase_orders/${PO_SELF}`).set(po(PARENT_ADMIN_UID));
    await db.doc(`purchase_orders/${PO_OTHER}`).set(po('some-other-admin-uid'));
  });
});

const parentDb = () => env.authenticatedContext(PARENT_ADMIN_UID, { email: 'pricing-admin@zeusgroup.test' }).firestore();
const subDb = () => env.authenticatedContext(SUBSIDIARY_USER_UID, { email: 'subsidiary-user@zeusgroup.test' }).firestore();

describe('talent_invoices — approval is CFn-only; the raiser is never the approver', () => {
  it('a parent-org admin cannot move an invoice INTO APPROVED from the client', async () => {
    await assertFails(updateDoc(doc(parentDb(), 'talent_invoices', INV_OTHER), { status: 'APPROVED', approvedBy: PARENT_ADMIN_UID }));
  });

  it('a parent-org admin can still reject, pay-after-approval, and edit', async () => {
    await assertSucceeds(
      updateDoc(doc(parentDb(), 'talent_invoices', INV_OTHER), { status: 'REJECTED', rejectedBy: PARENT_ADMIN_UID, rejectionReason: 'Duplicate' }),
    );
    await assertSucceeds(updateDoc(doc(parentDb(), 'talent_invoices', INV_SELF), { notes: 'checked against contract' }));
  });

  it('approvedBy, when written, must be the caller…', async () => {
    await assertFails(updateDoc(doc(parentDb(), 'talent_invoices', INV_OTHER), { approvedBy: 'someone-else-uid' }));
    await assertSucceeds(updateDoc(doc(parentDb(), 'talent_invoices', INV_OTHER), { approvedBy: PARENT_ADMIN_UID }));
  });

  it('…and the caller may not be the person who raised the invoice', async () => {
    await assertFails(updateDoc(doc(parentDb(), 'talent_invoices', INV_SELF), { approvedBy: PARENT_ADMIN_UID }));
  });

  it('a subsidiary principal cannot update an invoice at all', async () => {
    await assertFails(updateDoc(doc(subDb(), 'talent_invoices', INV_OTHER), { notes: 'x' }));
  });
});

describe('media_supplier_invoices — same shape', () => {
  it('cannot enter APPROVED from the client; can be rejected', async () => {
    await assertFails(updateDoc(doc(parentDb(), 'media_supplier_invoices', INV_OTHER), { status: 'APPROVED', approvedBy: PARENT_ADMIN_UID }));
    await assertSucceeds(
      updateDoc(doc(parentDb(), 'media_supplier_invoices', INV_OTHER), { status: 'REJECTED', rejectedBy: PARENT_ADMIN_UID, rejectionReason: 'Rate mismatch' }),
    );
  });
});

describe('purchase_orders (manual VENDOR_OTHER) — the raiser is never the approver', () => {
  it('an admin may record themselves as approver on a PO someone else raised', async () => {
    await assertSucceeds(updateDoc(doc(parentDb(), 'purchase_orders', PO_OTHER), { approvedBy: PARENT_ADMIN_UID }));
  });

  it('an admin may NOT approve the PO they raised, nor name another approver', async () => {
    await assertFails(updateDoc(doc(parentDb(), 'purchase_orders', PO_SELF), { approvedBy: PARENT_ADMIN_UID }));
    await assertFails(updateDoc(doc(parentDb(), 'purchase_orders', PO_OTHER), { approvedBy: 'some-other-admin-uid' }));
  });

  it('edits that do not touch approvedBy still pass', async () => {
    await assertSucceeds(updateDoc(doc(parentDb(), 'purchase_orders', PO_SELF), { notes: 'venue deposit' }));
  });
});
