/**
 * generateClientInvoice — Quote → DRAFT ClientInvoice rollup.
 *
 * Per spec §8.3. Mirrors src/modules/billing/services/
 * client-invoice-from-quote.service.ts but with the Admin SDK so the
 * UNIQUE invariant + idempotency check happen inside a single
 * Firestore transaction without the client SDK's read limits.
 *
 * UNIQUE invariant: at most one non-VOID ClientInvoice per master_job.
 * Enforced via a doc-ID lock at `client_invoices/{masterJobId}:active`
 * (matches the shape of the client-side service).
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');
const { assertBillingAdmin } = require('./lib/auth');
const { readIdempotentResponse, storeIdempotentResponse } = require('./lib/idempotency');
// Shared FX module (Phase 1.1) — single rate table for billing + finance
// consolidation. `resolveFxShared` throws a plain Error(code FX_UNAVAILABLE);
// the wrapper below preserves this callable's failed-precondition contract.
const {
  resolveFxRate: resolveFxShared,
  convertMinor,
} = require('../finance/lib/fx');

const ISSUER_ORG_ID = 'zeus-group';

/** Billing-context FX resolver: maps the shared module's FX_UNAVAILABLE
 *  failure onto the HttpsError('failed-precondition') this callable returns. */
async function resolveFxRate(db, fromCurrency, toCurrency, date) {
  try {
    return await resolveFxShared(db, fromCurrency, toCurrency, date);
  } catch (err) {
    if (err && err.code === 'FX_UNAVAILABLE') {
      throw new HttpsError('failed-precondition', err.message);
    }
    throw err;
  }
}

function jurisdictionForOrg(orgId) {
  // Same mapping as src/modules/billing/services/tax-treatment.service.ts.
  // When Phase 3.A.5 ships `organizations.{base_country}`, this gets
  // replaced with a read against that field.
  const KNOWN = ['zeus-group', 'zeus-the-agency', 'zeus-digital', 'labyrinth', 'odd-gorilla', 'house-of-zeus'];
  return KNOWN.includes(orgId) ? 'UG' : 'OTHER';
}

function domesticVATFor(j) {
  // Mirrors tax-treatment.service.ts.
  if (j === 'UG') return { type: 'STANDARD_VAT', rateBps: 1800, note: 'VAT 18% (UG domestic)' };
  if (j === 'KE') return { type: 'STANDARD_VAT', rateBps: 1600, note: 'VAT 16% (KE domestic)' };
  return { type: 'EXEMPT', rateBps: 0, note: 'Out of VAT scope' };
}

// Conservative client-friendly stripper — same allow-list as
// src/modules/billing/services/client-friendly.ts. Kept inline rather
// than required from the client bundle (Cloud Functions don't import
// TypeScript source).
function clientFriendlyDescription(raw) {
  if (!raw) return 'Professional services';
  let r = String(raw);
  const NAMES = ['Zeus The Agency', 'Zeus Digital', 'Labyrinth', 'Odd Gorilla', 'House of Zeus', 'Zeus Group'];
  for (const name of NAMES) {
    r = r.split(`${name} — `).join('').split(`${name} - `).join('').split(`${name}: `).join('').split(name).join('').trim();
  }
  const RULES = [
    [/design\s+hours?/i,                'Creative campaign development'],
    [/production\s+hours?/i,            'Production services'],
    [/media\s+(buy|buying|planning)/i,  'Media planning and buying'],
    [/pr\s+hours?/i,                    'Public relations services'],
    [/strategy\s+hours?/i,              'Strategic planning'],
    [/talent\s+booking/i,               'Talent and influencer services'],
  ];
  for (const [pattern, replacement] of RULES) {
    if (pattern.test(r)) return replacement;
  }
  return r || 'Professional services';
}

exports.generateClientInvoice = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  async (request) => {
    await assertBillingAdmin(request.auth);

    const { quoteId, masterJobId, idempotencyKey } = request.data || {};
    if (!quoteId || typeof quoteId !== 'string') {
      throw new HttpsError('invalid-argument', 'quoteId is required.');
    }
    if (!masterJobId || typeof masterJobId !== 'string') {
      throw new HttpsError('invalid-argument', 'masterJobId is required.');
    }

    const cached = await readIdempotentResponse(idempotencyKey);
    if (cached) return cached;

    const db = getFirestore();
    const quoteRef = db.doc(`quotes/${quoteId}`);
    const quoteLinesRef = db.collection(`quotes/${quoteId}/quote_lines`);
    const uniqueGuardKey = `${masterJobId}:active`;
    const guardRef = db.doc(`client_invoices/${uniqueGuardKey}`);
    const consolidationDate = new Date().toISOString().slice(0, 10);

    // Read the Quote + lines OUTSIDE the transaction (no I/O constraints,
    // and they're immutable once ACCEPTED).
    const quoteSnap = await quoteRef.get();
    if (!quoteSnap.exists) {
      throw new HttpsError('not-found', `Quote ${quoteId} not found.`);
    }
    const quote = quoteSnap.data();
    if (quote.status !== 'ACCEPTED') {
      throw new HttpsError(
        'failed-precondition',
        `Quote ${quoteId} is in status ${quote.status} — only ACCEPTED quotes can be billed.`,
      );
    }
    const linesSnap = await quoteLinesRef.get();
    const quoteLines = linesSnap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
    if (quoteLines.length === 0) {
      throw new HttpsError(
        'failed-precondition',
        `Quote ${quoteId} has no lines — refusing to generate an empty invoice.`,
      );
    }

    const taxTreatment = (() => {
      const j = jurisdictionForOrg(ISSUER_ORG_ID);
      const d = domesticVATFor(j);
      return { ...d, fromJurisdiction: j, toJurisdiction: j };
    })();

    // Multi-currency consolidation per spec §11.6: each line is in the
    // source subsidiary's currency; we convert ONCE here at the
    // consolidation date so the client invoice is monolingually in
    // `quote.currency`. FX exposure between IC settlement and client
    // payment sits with the parent. Rates captured in fxConsolidation
    // for audit.
    const clientCurrency = quote.currency;
    const usedRates = {};
    const convertedLines = [];
    let fxSource = 'manual';
    for (const l of quoteLines) {
      const lineCurrency = l.currency || clientCurrency;
      let convertedMinor = l.clientMinor || 0;
      let rate = 1;
      if (lineCurrency !== clientCurrency) {
        const { rate: r, source } = await resolveFxRate(db, lineCurrency, clientCurrency, consolidationDate);
        rate = r;
        convertedMinor = convertMinor(l.clientMinor || 0, r);
        fxSource = source;
      }
      usedRates[lineCurrency] = rate;
      convertedLines.push({
        id: l.id,
        quoteLineId: l.id,
        description: clientFriendlyDescription(l.description),
        amountMinor: convertedMinor,
        // Internal-only — must NEVER reach client-facing surfaces.
        // Stripped by toClientFacingInvoice() in the client bundle.
        costMinor: l.costMinor || 0,
        sourceSubsidiaryId: l.subsidiaryOrgId,
        // Audit trail of the original pre-conversion amount.
        sourceAmountMinor: l.clientMinor || 0,
        sourceCurrency: lineCurrency,
      });
    }

    const response = await db.runTransaction(async (tx) => {
      const guardSnap = await tx.get(guardRef);
      if (guardSnap.exists) {
        const existingId = (guardSnap.data() || {}).invoiceId;
        if (existingId) {
          const existingRef = db.doc(`client_invoices/${existingId}`);
          const existing = await tx.get(existingRef);
          if (existing.exists) {
            // Idempotent — return the active invoice unchanged.
            return { invoiceId: existing.id, status: existing.data().status, reused: true };
          }
        }
      }

      const totalMinor = convertedLines.reduce((s, l) => s + (l.amountMinor || 0), 0);

      const invoiceRef = db.collection('client_invoices').doc();
      const invoice = {
        clientId: quote.clientId,
        masterJobId,
        issuerOrgId: ISSUER_ORG_ID,
        total: { amountMinor: totalMinor, currency: clientCurrency },
        lines: convertedLines,
        taxTreatment,
        fxConsolidation: {
          effectiveDate: consolidationDate,
          rates: usedRates,
          source: fxSource,
        },
        status: 'DRAFT',
        paidMinor: 0,
        uniqueGuardKey,
        createdBy: request.auth.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      tx.set(invoiceRef, invoice);
      tx.set(guardRef, { invoiceId: invoiceRef.id, masterJobId });

      return { invoiceId: invoiceRef.id, status: 'DRAFT', reused: false };
    });

    await storeIdempotentResponse(idempotencyKey, 'generateClientInvoice', response);
    return response;
  },
);
