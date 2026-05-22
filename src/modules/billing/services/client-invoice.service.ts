/**
 * Client Invoice service — generate, issue, record payment.
 *
 * SCOPE (standalone slice): the public API is shaped exactly as Phase
 * 3.B/3.D will need it (`generateClientInvoice`, `issueClientInvoice`,
 * `recordClientPayment`). Today the Quote roll-up step accepts a hand-
 * crafted payload; once 3.C ships the Quote module, that payload is
 * built from the accepted Quote inside this function.
 *
 * The UNIQUE invariant (one non-void client invoice per master_job) is
 * enforced via a doc-ID lock at `client_invoices/{masterJobId}:active`
 * combined with a Firestore transaction. Idempotency keys reuse the
 * same lock — duplicate calls return the existing invoice.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  ClientInvoice,
  ClientInvoiceLineInternal,
  ClientInvoiceStatus,
  ClientPaymentInput,
} from '../types/client-invoice.types';
import type { Money } from '../types/money.types';
import { COLLECTIONS, BILLING_EVENTS } from '../constants/collections';
import {
  jurisdictionForOrg,
  taxTreatmentFor,
} from './tax-treatment.service';
import { getEffectiveRate, convertMinor } from './fx-rate.service';

export interface GenerateClientInvoiceInput {
  masterJobId: string;
  clientId: string;
  /** Currency the CLIENT will be billed in. Lines may be in different
   *  source currencies — the service converts each via the date's FX
   *  snapshot (§14.11 row 11.6). */
  clientCurrency: Money['currency'];
  /** Source lines — each carries its own source-currency totals. The
   *  service converts to clientCurrency at the consolidation date. */
  lines: Array<{
    id: string;
    quoteLineId?: string;
    description: string;
    sourceAmountMinor: number;
    sourceCurrency: Money['currency'];
    costMinor: number;
    sourceSubsidiaryId: string;
  }>;
  createdBy: string;
  /** Optional override for the FX consolidation date — defaults to today. */
  consolidationDate?: string;
  /** Idempotency-Key from the caller. Phase 3.B will pass the
   *  Cloud-Function callable's incoming header here. */
  idempotencyKey?: string;
}

/**
 * Generate (but do not issue) a client invoice. UNIQUE on
 * (masterJobId, status != VOID). Retries return the existing draft.
 */
export async function generateClientInvoice(
  input: GenerateClientInvoiceInput,
): Promise<ClientInvoice> {
  const uniqueGuardKey = `${input.masterJobId}:active`;
  const guardRef = doc(db, COLLECTIONS.CLIENT_INVOICES, uniqueGuardKey);
  const consolidationDate =
    input.consolidationDate ?? new Date().toISOString().slice(0, 10);

  // Pre-compute FX-converted lines outside the txn (txns can't await
  // arbitrary I/O), then write atomically.
  const usedRates: Partial<Record<Money['currency'], number>> = {};
  const convertedLines: ClientInvoiceLineInternal[] = [];
  for (const src of input.lines) {
    const { rate } = await getEffectiveRate(src.sourceCurrency, input.clientCurrency, {
      effectiveDate: consolidationDate,
    });
    usedRates[src.sourceCurrency] = rate;
    convertedLines.push({
      id: src.id,
      quoteLineId: src.quoteLineId,
      description: src.description,
      amountMinor: convertMinor(src.sourceAmountMinor, rate),
      costMinor: src.costMinor,
      sourceSubsidiaryId: src.sourceSubsidiaryId,
    });
  }
  const totalMinor = convertedLines.reduce((s, l) => s + l.amountMinor, 0);

  const taxTreatment = taxTreatmentFor(
    jurisdictionForOrg('zeus-group'),
    // We don't know the client's jurisdiction here yet — Phase 3.A.5
    // adds `clients/{id}.country`. Until then assume same-jurisdiction
    // domestic VAT, which is the safer default for audit.
    jurisdictionForOrg('zeus-group'),
  );

  return runTransaction(db, async (txn) => {
    const guardSnap = await txn.get(guardRef);
    if (guardSnap.exists()) {
      const existingId = (guardSnap.data() as { invoiceId: string }).invoiceId;
      const existingRef = doc(db, COLLECTIONS.CLIENT_INVOICES, existingId);
      const existing = await txn.get(existingRef);
      if (existing.exists()) {
        const existingDoc = existing.data() as ClientInvoice;
        // Idempotency: same key → return same invoice unchanged.
        if (
          input.idempotencyKey &&
          existingDoc.uniqueGuardKey === uniqueGuardKey
        ) {
          // Spread first so the doc's own id (if present) is overridden
          // by the canonical `existing.id` from the Firestore reference.
          return { ...existingDoc, id: existing.id };
        }
        // Otherwise the UNIQUE constraint is already taken by an
        // active invoice — fail loudly per §11.7.
        throw new Error(
          `[client-invoice] Active client invoice already exists for ` +
            `master job ${input.masterJobId}: ${existing.id}`,
        );
      }
    }

    const invoiceRef = doc(collection(db, COLLECTIONS.CLIENT_INVOICES));
    const invoice: Omit<ClientInvoice, 'id'> = {
      clientId: input.clientId,
      masterJobId: input.masterJobId,
      issuerOrgId: 'zeus-group',
      total: { amountMinor: totalMinor, currency: input.clientCurrency },
      lines: convertedLines,
      taxTreatment,
      fxConsolidation: {
        effectiveDate: consolidationDate,
        rates: usedRates as Record<Money['currency'], number>,
        source: 'manual',
      },
      status: 'DRAFT',
      paidMinor: 0,
      uniqueGuardKey,
      createdBy: input.createdBy,
      createdAt: serverTimestamp() as unknown as string,
      updatedAt: serverTimestamp() as unknown as string,
    };
    txn.set(invoiceRef, invoice);
    txn.set(guardRef, { invoiceId: invoiceRef.id, masterJobId: input.masterJobId });
    return { id: invoiceRef.id, ...invoice };
  });
}

/**
 * Promote DRAFT → ISSUED. Emits ClientInvoiceIssued.
 */
export async function issueClientInvoice(invoiceId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.CLIENT_INVOICES, invoiceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error(`Client invoice ${invoiceId} not found`);
  const invoice = snap.data() as ClientInvoice;
  if (invoice.status !== 'DRAFT') {
    throw new Error(
      `[client-invoice] Cannot issue from status ${invoice.status} — must be DRAFT`,
    );
  }
  await updateDoc(ref, {
    status: 'ISSUED' satisfies ClientInvoiceStatus,
    issuedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  // Outbox.
  await setDoc(
    doc(collection(db, COLLECTIONS.DOMAIN_EVENTS)),
    {
      type: BILLING_EVENTS.CLIENT_INVOICE_ISSUED,
      subjectType: 'CLIENT_INVOICE',
      subjectId: invoiceId,
      masterJobId: invoice.masterJobId,
      clientId: invoice.clientId,
      issuedAt: serverTimestamp(),
    },
  );
}

/**
 * Record a (partial or full) client payment. ISSUED/PART_PAID → PAID
 * or PART_PAID.
 */
export async function recordClientPayment(
  invoiceId: string,
  input: ClientPaymentInput,
): Promise<void> {
  await runTransaction(db, async (txn) => {
    const ref = doc(db, COLLECTIONS.CLIENT_INVOICES, invoiceId);
    const snap = await txn.get(ref);
    if (!snap.exists()) throw new Error(`Client invoice ${invoiceId} not found`);
    const invoice = snap.data() as ClientInvoice;
    if (invoice.status === 'DRAFT' || invoice.status === 'VOID') {
      throw new Error(
        `[client-invoice] Cannot record payment on status ${invoice.status}`,
      );
    }
    const newPaid = invoice.paidMinor + input.amountMinor;
    if (newPaid > invoice.total.amountMinor) {
      throw new Error(
        `[client-invoice] Payment ${input.amountMinor} exceeds outstanding balance`,
      );
    }
    const nextStatus: ClientInvoiceStatus =
      newPaid >= invoice.total.amountMinor ? 'PAID' : 'PART_PAID';

    txn.update(ref, {
      paidMinor: newPaid,
      status: nextStatus,
      paidAt: nextStatus === 'PAID' ? serverTimestamp() : invoice.paidAt ?? null,
      updatedAt: serverTimestamp(),
    });

    // Outbox.
    txn.set(doc(collection(db, COLLECTIONS.DOMAIN_EVENTS)), {
      type: BILLING_EVENTS.CLIENT_PAYMENT_RECORDED,
      subjectType: 'CLIENT_INVOICE',
      subjectId: invoiceId,
      amountMinor: input.amountMinor,
      paymentRef: input.paymentRef,
      paidStatus: nextStatus,
      recordedAt: serverTimestamp(),
    });
  });
}

export async function getClientInvoice(id: string): Promise<ClientInvoice | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.CLIENT_INVOICES, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<ClientInvoice, 'id'>) };
}

export async function listClientInvoices(filters: {
  clientId?: string;
  status?: ClientInvoiceStatus;
  masterJobId?: string;
} = {}): Promise<ClientInvoice[]> {
  const constraints = [];
  if (filters.clientId)    constraints.push(where('clientId', '==', filters.clientId));
  if (filters.status)      constraints.push(where('status', '==', filters.status));
  if (filters.masterJobId) constraints.push(where('masterJobId', '==', filters.masterJobId));
  const q = constraints.length
    ? query(collection(db, COLLECTIONS.CLIENT_INVOICES), ...constraints)
    : query(collection(db, COLLECTIONS.CLIENT_INVOICES));
  const snap = await getDocs(q);
  return snap.docs
    // The `{masterJobId}:active` guard docs aren't real invoices.
    .filter((d) => !d.id.endsWith(':active'))
    .map((d) => ({ id: d.id, ...(d.data() as Omit<ClientInvoice, 'id'>) }));
}
