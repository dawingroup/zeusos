/**
 * Phase 3.F lifecycle integration test — runs against the Firestore
 * emulator.
 *
 * Prerequisites:
 *   - Java installed (Firebase emulators dep)
 *   - `npm run emulators` running (or use `npm run emulators:test`
 *     which auto-starts + auto-stops them).
 *
 * Scope:
 *   1. Seed an ACCEPTED Quote + quote_lines (multi-currency to exercise
 *      §11.6 consolidation FX) + an FX-rate snapshot for the day.
 *   2. Seed an IC invoice in the 3.B on-the-wire shape with
 *      postedToGL:false (simulates what closeWorkOrder would write).
 *      The actual onIntercompanyInvoiceCreated trigger only fires when
 *      the functions emulator is also running; this test asserts the
 *      doc-shape invariant rather than driving the trigger end-to-end.
 *   3. Call the client-side billing services in sequence:
 *        generateClientInvoiceFromQuote → DRAFT
 *        issueClientInvoice              → ISSUED + ClientInvoiceIssued
 *        recordClientPayment (half)      → PART_PAID + ClientPaymentRecorded
 *        recordClientPayment (rest)      → PAID
 *   4. Assert: invoice state machine, fx_consolidation captured, cost
 *      fields present on the internal shape, domain_events emitted.
 *
 * The Cloud Function lifecycle (assertBillingAdmin + AR-receipt GL post)
 * is covered separately by the unit tests in
 * src/modules/billing/services/__tests__/ and by manual exercise once
 * Phase 5 wires the QBO/Xero connectors.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { testEnvManager } from '../utils/test-environment';
import {
  generateClientInvoiceFromQuote,
  issueClientInvoice,
  recordClientPayment,
  getClientInvoice,
} from '@/modules/billing';
import { COLLECTIONS, BILLING_EVENTS } from '@/modules/billing';
import type { ClientInvoice } from '@/modules/billing';

const TODAY = new Date().toISOString().slice(0, 10);

beforeAll(async () => {
  await testEnvManager.initialize({ useEmulator: true });
});

beforeEach(async () => {
  await testEnvManager.reset();
});

async function seedAcceptedQuote(db: ReturnType<typeof testEnvManager.getFirestore>) {
  const quoteId = 'q-LIFECYCLE-1';
  await setDoc(doc(db, 'quotes', quoteId), {
    id: quoteId,
    sowId: 'sow-1',
    clientId: 'client-PILSNER',
    code: 'Q-2026-Q2-001',
    status: 'ACCEPTED',
    clientTotalMinor: 1_500_000, // USD 15,000 in minor (after consolidation)
    totalCostMinor: 900_000,
    currency: 'USD',
    marginFloorPct: 25,
    createdBy: 'user-AM',
    createdAt: TODAY,
    updatedAt: TODAY,
  });

  // Two lines, in DIFFERENT source currencies (UGX + KES). The §11.6
  // single-conversion at consolidation must collapse them to USD.
  await setDoc(doc(db, 'quotes', quoteId, 'quote_lines', 'ql-ug'), {
    id: 'ql-ug',
    quoteId,
    subsidiaryOrgId: 'zeus-the-agency',
    rateCardLineId: 'rcl-1',
    rateCardId: 'rc-1',
    roleCode: 'STRATEGIST',
    unit: 'HOUR',
    description: 'Zeus The Agency — strategy hours',
    qty: 40,
    costMinor: 18_500_000_00, // UGX 18.5M cost
    markupPct: 100,
    clientMinor: 37_000_000_00, // UGX 37M client-facing
    currency: 'UGX',
  });
  await setDoc(doc(db, 'quotes', quoteId, 'quote_lines', 'ql-ke'), {
    id: 'ql-ke',
    quoteId,
    subsidiaryOrgId: 'zeus-digital',
    rateCardLineId: 'rcl-2',
    rateCardId: 'rc-2',
    roleCode: 'DIGITAL_PRODUCER',
    unit: 'HOUR',
    description: 'Zeus Digital — paid media buying',
    qty: 30,
    costMinor: 322_500_00,
    markupPct: 100,
    clientMinor: 645_000_00, // KES 645,000 client-facing
    currency: 'KES',
  });

  // FX snapshot for today's consolidation.
  await setDoc(doc(db, COLLECTIONS.FX_RATES, TODAY), {
    date: TODAY,
    base: 'USD',
    rates: {
      UGX: 3700,
      KES: 129,
      USD: 1,
    },
    source: 'manual',
  });

  return { quoteId, masterJobId: 'mj-LIFECYCLE-1' };
}

describe('Phase 3.F lifecycle — Quote → ClientInvoice → ISSUED → PAID', () => {
  it('walks the full happy-path with §11.6 multi-currency consolidation', async () => {
    const db = testEnvManager.getFirestore();
    const { quoteId, masterJobId } = await seedAcceptedQuote(db);

    // ── 1. Generate from Quote ──────────────────────────────────
    const draft = await generateClientInvoiceFromQuote({
      quoteId,
      masterJobId,
      createdBy: 'user-AM',
      consolidationDate: TODAY,
    });

    expect(draft.status).toBe('DRAFT');
    expect(draft.total.currency).toBe('USD');
    expect(draft.masterJobId).toBe(masterJobId);
    expect(draft.lines).toHaveLength(2);
    // Internal fields present on the AM/Finance shape.
    for (const line of draft.lines) {
      expect(line).toHaveProperty('costMinor');
      expect(line).toHaveProperty('sourceSubsidiaryId');
    }
    // §11.6 — FX consolidation captured.
    expect(draft.fxConsolidation?.effectiveDate).toBe(TODAY);
    expect(Object.keys(draft.fxConsolidation?.rates ?? {})).toEqual(
      expect.arrayContaining(['UGX', 'KES']),
    );

    // ── 2. UNIQUE invariant — duplicate call returns same id ────
    const retry = await generateClientInvoiceFromQuote({
      quoteId,
      masterJobId,
      createdBy: 'user-AM',
      consolidationDate: TODAY,
      idempotencyKey: 'retry-key-1',
    });
    expect(retry.id).toBe(draft.id);

    // ── 3. Issue → ISSUED + outbox event ────────────────────────
    await issueClientInvoice(draft.id);
    const issuedSnap = await getClientInvoice(draft.id);
    expect(issuedSnap?.status).toBe('ISSUED');
    expect(issuedSnap?.issuedAt).toBeTruthy();

    const issuedEvents = await getDocs(
      query(
        collection(db, COLLECTIONS.DOMAIN_EVENTS),
        where('type', '==', BILLING_EVENTS.CLIENT_INVOICE_ISSUED),
      ),
    );
    expect(issuedEvents.size).toBeGreaterThanOrEqual(1);

    // ── 4. Partial payment → PART_PAID ──────────────────────────
    const half = Math.floor(draft.total.amountMinor / 2);
    await recordClientPayment(draft.id, {
      amountMinor: half,
      paymentRef: 'BANK-REF-001',
    });
    const halfSnap = await getClientInvoice(draft.id);
    expect(halfSnap?.status).toBe('PART_PAID');
    expect(halfSnap?.paidMinor).toBe(half);

    // ── 5. Final payment → PAID ─────────────────────────────────
    const rest = draft.total.amountMinor - half;
    await recordClientPayment(draft.id, {
      amountMinor: rest,
      paymentRef: 'BANK-REF-002',
    });
    const finalSnap = await getClientInvoice(draft.id);
    expect(finalSnap?.status).toBe('PAID');
    expect(finalSnap?.paidMinor).toBe(draft.total.amountMinor);
    expect(finalSnap?.paidAt).toBeTruthy();

    // ── 6. Payment outbox events ────────────────────────────────
    const paymentEvents = await getDocs(
      query(
        collection(db, COLLECTIONS.DOMAIN_EVENTS),
        where('type', '==', BILLING_EVENTS.CLIENT_PAYMENT_RECORDED),
      ),
    );
    expect(paymentEvents.size).toBe(2);
  });

  it('rejects payments that exceed the outstanding balance', async () => {
    const db = testEnvManager.getFirestore();
    const { quoteId, masterJobId } = await seedAcceptedQuote(db);
    const draft = await generateClientInvoiceFromQuote({
      quoteId,
      masterJobId,
      createdBy: 'user-AM',
      consolidationDate: TODAY,
    });
    await issueClientInvoice(draft.id);

    await expect(
      recordClientPayment(draft.id, {
        amountMinor: draft.total.amountMinor + 1,
        paymentRef: 'OVERPAY',
      }),
    ).rejects.toThrow(/exceeds outstanding balance/);
  });

  it('honours the IC invoice on-the-wire shape that 3.B writes', async () => {
    const db = testEnvManager.getFirestore();
    // Simulate what functions/src/assignment/services/intercompany.admin.js
    // writes when an IWO closes. Our client-side IC invoices page should
    // be able to read this shape unmodified.
    const icId = 'ic_iwo-TEST-1';
    await setDoc(doc(db, COLLECTIONS.INTERCOMPANY_INVOICES, icId), {
      id: icId,
      iwoId: 'iwo-TEST-1',
      masterJobId: 'mj-TEST',
      fromOrgId: 'zeus-the-agency',
      toOrgId: 'zeus-group',
      amount: { amountMinor: 5_000_000, currency: 'UGX' },
      lines: [
        {
          id: 'icl-1',
          description: 'IC settlement — IWO iwo-TEST-1',
          amountMinor: 5_000_000,
          currency: 'UGX',
        },
      ],
      taxTreatment: { kind: 'PENDING', source: 'phase-3b-deferred' },
      status: 'RAISED',
      postedToGL: false,
      isPartial: false,
      idempotencyKey: null,
      raisedAt: TODAY,
      createdAt: TODAY,
      updatedAt: TODAY,
    });

    const snap = await getDoc(doc(db, COLLECTIONS.INTERCOMPANY_INVOICES, icId));
    expect(snap.exists()).toBe(true);
    const data = snap.data() as ClientInvoice;
    expect((data as unknown as { postedToGL: boolean }).postedToGL).toBe(false);
    expect((data as unknown as { status: string }).status).toBe('RAISED');
  });
});
