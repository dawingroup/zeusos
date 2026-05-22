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

const ISSUER_ORG_ID = 'zeus-group';

// Seed FX cross-rates (vs UGX). Mirrors EXCHANGE_RATES_TO_UGX in
// src/modules/finance/constants/currency.constants.ts. Used when the
// fx_rates/{date} snapshot is missing — Phase 5 wires the daily writer.
const SEED_FX_TO_UGX = {
  UGX: 1,
  USD: 3700,
  EUR: 4000,
  GBP: 4600,
  AED: 1000,
  KES: 29,
  ZAR: 205,
};

/**
 * Resolve the rate to convert `from` → `to` for a given consolidation
 * date. Tries `fx_rates/{date}` first, falls back to seeded cross-rates
 * via UGX. Same-currency short-circuits to 1.0.
 *
 * Mirrors src/modules/billing/services/fx-rate.service.ts#getEffectiveRate.
 */
async function resolveFxRate(db, fromCurrency, toCurrency, date) {
  if (fromCurrency === toCurrency) return { rate: 1, source: 'manual' };

  const snap = await db.doc(`fx_rates/${date}`).get();
  if (snap.exists) {
    const data = snap.data() || {};
    const base = data.base;
    const rates = data.rates || {};
    const fromVsBase = fromCurrency === base ? 1 : rates[fromCurrency];
    const toVsBase   = toCurrency   === base ? 1 : rates[toCurrency];
    if (fromVsBase != null && toVsBase != null && fromVsBase !== 0) {
      return { rate: toVsBase / fromVsBase, source: data.source || 'manual' };
    }
  }

  // Fallback — cross via UGX.
  const fromUgx = SEED_FX_TO_UGX[fromCurrency];
  const toUgx   = SEED_FX_TO_UGX[toCurrency];
  if (fromUgx == null || toUgx == null || toUgx === 0) {
    throw new HttpsError(
      'failed-precondition',
      `FX rate unavailable: ${fromCurrency} → ${toCurrency} on ${date}. ` +
        'Seed cross-rates do not cover one of these currencies. ' +
        'Post the rate to fx_rates/{YYYY-MM-DD} or extend SEED_FX_TO_UGX.',
    );
  }
  return { rate: fromUgx / toUgx, source: 'manual' };
}

function convertMinor(amountMinor, rate) {
  return Math.round(amountMinor * rate);
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
