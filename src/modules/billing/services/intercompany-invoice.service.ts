/**
 * Inter-Company Invoice service.
 *
 * SCOPE (standalone slice): pure CRUD plus a `raiseFromIWOClose()`
 * function shaped to be the body of the Cloud-Function trigger that
 * Phase 3.B will add. Today the function can be called manually from
 * the IC invoices page; once IWOs exist, the `onIWOClosed` Firestore
 * trigger will invoke it.
 */

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  InterCompanyInvoice,
  InterCompanyInvoiceLine,
  InterCompanyInvoiceStatus,
} from '../types/intercompany-invoice.types';
import type { Money } from '../types/money.types';
import { COLLECTIONS, BILLING_EVENTS } from '../constants/collections';
import {
  jurisdictionForOrg,
  taxTreatmentFor,
} from './tax-treatment.service';
import {
  buildICJournalEntries,
  resolveAdapter,
} from './gl-adapter.service';

export interface RaiseFromIWOClosedInput {
  iwoId: string;
  masterJobId: string;
  fromOrgId: string;
  toOrgId: string;            // expected to be 'zeus-group'
  amount: Money;              // iwo.transfer_price_minor + iwo.currency
  lines: InterCompanyInvoiceLine[];
  /** Phase 3.B passes the IWO-close idempotency-key from the trigger
   *  event so retries are deduplicated. */
  idempotencyKey: string;
}

/**
 * Raise an Inter-Company Invoice when an IWO closes. Idempotent on
 * `idempotencyKey` — if a prior invoice was raised with the same key,
 * the existing one is returned unchanged.
 *
 * This is the body that Phase 3.B's `onIWOClosed` trigger will call.
 */
export async function raiseFromIWOClosed(
  input: RaiseFromIWOClosedInput,
): Promise<InterCompanyInvoice> {
  // Idempotency check first (§14.11 row 11.7).
  const existing = await findByIdempotencyKey(input.idempotencyKey);
  if (existing) return existing;

  const taxTreatment = taxTreatmentFor(
    jurisdictionForOrg(input.fromOrgId),
    jurisdictionForOrg(input.toOrgId),
  );

  const payload: Omit<InterCompanyInvoice, 'id'> = {
    fromOrgId: input.fromOrgId,
    toOrgId: input.toOrgId,
    iwoId: input.iwoId,
    masterJobId: input.masterJobId,
    amount: input.amount,
    lines: input.lines,
    taxTreatment,
    status: 'RAISED',
    postedToGL: false,
    idempotencyKey: input.idempotencyKey,
    raisedAt: serverTimestamp() as unknown as string,
  };

  const ref = await addDoc(collection(db, COLLECTIONS.INTERCOMPANY_INVOICES), payload);
  const invoice: InterCompanyInvoice = { id: ref.id, ...payload };

  // Post to both GLs. Until 3.B lands the atomic two-leg primitive, we
  // post sequentially and only set `postedToGL: true` once both succeed.
  await postBothLegs(invoice);

  // Emit the domain event so reporting / notifications can pick it up.
  // Phase 3.B will move this to the transactional outbox.
  await addDoc(collection(db, COLLECTIONS.DOMAIN_EVENTS), {
    type: BILLING_EVENTS.INTERCOMPANY_INVOICE_RAISED,
    subjectType: 'INTERCOMPANY_INVOICE',
    subjectId: invoice.id,
    fromOrgId: invoice.fromOrgId,
    toOrgId: invoice.toOrgId,
    raisedAt: serverTimestamp(),
  });

  return invoice;
}

async function postBothLegs(invoice: InterCompanyInvoice): Promise<void> {
  const [subEntry, parentEntry] = buildICJournalEntries({
    invoiceId: invoice.id,
    fromOrgId: invoice.fromOrgId,
    toOrgId: invoice.toOrgId,
    amountMinor: invoice.amount.amountMinor,
    currency: invoice.amount.currency,
    memo: `IC settlement — IWO ${invoice.iwoId || '(manual)'}`,
  });

  const subAdapter = await resolveAdapter(invoice.fromOrgId);
  const parentAdapter = await resolveAdapter(invoice.toOrgId);

  let subPosted: string | null = null;
  let parentPosted: string | null = null;
  try {
    const subResult = await subAdapter.postJournal(subEntry);
    subPosted = subResult.remoteRef;
    const parentResult = await parentAdapter.postJournal(parentEntry);
    parentPosted = parentResult.remoteRef;
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.error('[ic-invoice] GL post failed — leaving postedToGL=false', err);
    }
    return;
  }

  await updateDoc(doc(db, COLLECTIONS.INTERCOMPANY_INVOICES, invoice.id), {
    postedToGL: true,
    status: 'POSTED' satisfies InterCompanyInvoiceStatus,
    glPostingIds: [subPosted, parentPosted],
    postedAt: serverTimestamp(),
  });
}

export async function findByIdempotencyKey(
  key: string,
): Promise<InterCompanyInvoice | null> {
  if (!key) return null;
  const q = query(
    collection(db, COLLECTIONS.INTERCOMPANY_INVOICES),
    where('idempotencyKey', '==', key),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<InterCompanyInvoice, 'id'>) };
}

export async function getInterCompanyInvoice(
  id: string,
): Promise<InterCompanyInvoice | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.INTERCOMPANY_INVOICES, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<InterCompanyInvoice, 'id'>) };
}

export async function listInterCompanyInvoices(filters: {
  fromOrgId?: string;
  status?: InterCompanyInvoiceStatus;
} = {}): Promise<InterCompanyInvoice[]> {
  const constraints = [];
  if (filters.fromOrgId) constraints.push(where('fromOrgId', '==', filters.fromOrgId));
  if (filters.status)    constraints.push(where('status', '==', filters.status));
  const q = constraints.length
    ? query(collection(db, COLLECTIONS.INTERCOMPANY_INVOICES), ...constraints)
    : query(collection(db, COLLECTIONS.INTERCOMPANY_INVOICES));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<InterCompanyInvoice, 'id'>),
  }));
}
