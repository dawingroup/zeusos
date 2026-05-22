/**
 * onIntercompanyInvoiceCreated — Firestore trigger that posts to GL.
 *
 * Phase 3.B (functions/src/assignment/closeWorkOrder.js +
 * functions/src/assignment/services/intercompany.admin.js) raises the
 * IC invoice with `postedToGL: false` and explicitly defers GL posting
 * to this consumer. We:
 *
 *   1. Build two balanced journal entries (subsidiary AR/Revenue +
 *      parent Cost/AP). Same allocation as src/modules/billing/
 *      services/gl-adapter.service.ts#buildICJournalEntries.
 *   2. Write both legs atomically to gl_postings/ via the
 *      Firestore-audit adapter (Admin SDK).
 *   3. Update the IC invoice with postedToGL:true, status:'POSTED',
 *      glPostingIds[], postedAt.
 *
 * QBO/Xero integration is deferred to Phase 5 — the
 * src/modules/billing/services/gl-adapter.qbo.ts skeleton will be
 * promoted to functions/ when that lands.
 *
 * Idempotency: each leg's idempotencyKey is `IC_INVOICE:{id}:leg`; a
 * retry of the trigger finds the existing posting and short-circuits.
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const GL_POSTINGS = 'gl_postings';
const IC_INVOICES = 'intercompany_invoices';

function buildLegs(invoiceId, fromOrgId, toOrgId, amountMinor, currency, memo, date) {
  const idKey = `IC_INVOICE:${invoiceId}`;
  return [
    {
      entityOrgId: fromOrgId,
      sourceDocType: 'INTERCOMPANY_INVOICE',
      sourceDocId: invoiceId,
      date,
      currency,
      memo,
      idempotencyKey: `${idKey}:subsidiary`,
      lines: [
        { accountCode: '1200', debitMinor:  amountMinor, memo: 'IC AR — receivable from parent' },
        { accountCode: '4000', creditMinor: amountMinor, memo: 'IC Revenue — services rendered' },
      ],
    },
    {
      entityOrgId: toOrgId,
      sourceDocType: 'INTERCOMPANY_INVOICE',
      sourceDocId: invoiceId,
      date,
      currency,
      memo,
      idempotencyKey: `${idKey}:parent`,
      lines: [
        { accountCode: '5000', debitMinor:  amountMinor, memo: 'IC Cost — services received' },
        { accountCode: '2000', creditMinor: amountMinor, memo: 'IC AP — payable to subsidiary' },
      ],
    },
  ];
}

function assertBalanced(entry) {
  let d = 0, c = 0;
  for (const l of entry.lines) { d += l.debitMinor || 0; c += l.creditMinor || 0; }
  if (d !== c) throw new Error(`Unbalanced GL entry for ${entry.sourceDocId}: ${d} ≠ ${c}`);
  if (d === 0) throw new Error(`Zero GL entry for ${entry.sourceDocId}`);
}

async function postLeg(db, entry) {
  // Idempotency: short-circuit if a posting with this key already exists.
  const dup = await db.collection(GL_POSTINGS)
    .where('idempotencyKey', '==', entry.idempotencyKey)
    .limit(1)
    .get();
  if (!dup.empty) return dup.docs[0].id;

  assertBalanced(entry);

  const ref = await db.collection(GL_POSTINGS).add({
    entityOrgId: entry.entityOrgId,
    sourceDocType: entry.sourceDocType,
    sourceDocId: entry.sourceDocId,
    adapter: 'firestore-audit',
    status: 'POSTED',
    lines: entry.lines,
    currency: entry.currency,
    memo: entry.memo,
    idempotencyKey: entry.idempotencyKey,
    postedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

exports.onIntercompanyInvoiceCreated = onDocumentCreated(
  {
    document: `${IC_INVOICES}/{icId}`,
    region: 'europe-west1',
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const invoice = snap.data() || {};
    const invoiceId = snap.id;

    if (invoice.postedToGL === true) {
      // Someone else (e.g. backfill script) already posted.
      return;
    }
    const amountMinor = invoice?.amount?.amountMinor ?? 0;
    const currency = invoice?.amount?.currency;
    if (!amountMinor || !currency || !invoice.fromOrgId || !invoice.toOrgId) {
      // Malformed — leave for manual investigation rather than crash-loop.
      console.warn('[onIntercompanyInvoiceCreated] missing required fields, skipping', {
        invoiceId,
        hasAmount: !!invoice.amount,
        hasFrom: !!invoice.fromOrgId,
        hasTo: !!invoice.toOrgId,
      });
      return;
    }

    const date = new Date().toISOString().slice(0, 10);
    const memo = `IC settlement — IWO ${invoice.iwoId || '(unknown)'}`;

    const legs = buildLegs(
      invoiceId,
      invoice.fromOrgId,
      invoice.toOrgId,
      amountMinor,
      currency,
      memo,
      date,
    );

    const db = getFirestore();
    let subPosting, parentPosting;
    try {
      subPosting = await postLeg(db, legs[0]);
      parentPosting = await postLeg(db, legs[1]);
    } catch (err) {
      console.error('[onIntercompanyInvoiceCreated] GL post failed, leaving postedToGL=false', {
        invoiceId,
        error: err?.message ?? String(err),
      });
      return;
    }

    await db.doc(`${IC_INVOICES}/${invoiceId}`).update({
      postedToGL: true,
      status: 'POSTED',
      glPostingIds: [subPosting, parentPosting],
      postedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.info('[onIntercompanyInvoiceCreated] posted IC invoice to GL', {
      invoiceId,
      subPosting,
      parentPosting,
    });
  },
);
