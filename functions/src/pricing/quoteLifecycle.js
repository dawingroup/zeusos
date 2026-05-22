/**
 * Quote lifecycle callables — spec §6.2.
 *
 *   issueQuote   (DRAFT → ISSUED, margin floor re-checked, QuoteIssued emitted)
 *   acceptQuote  (ISSUED → ACCEPTED, QuoteAccepted emitted — 3.D opens MasterJob)
 *   voidQuote    (any non-ACCEPTED → VOID)
 *
 * All three callables enforce the §7.4 commercial-scope boundary via
 * `assertPricingAdmin`. All emit a domain event into the `domain_events`
 * outbox (PHASE 3.A.5 PLACEHOLDER — 3.A.5 introduces the dispatcher).
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');

const { assertPricingAdmin } = require('./lib/auth');
const { computePricedQuote, PricingError } = require('./lib/computePricing');
const { buildRateLookup, buildMarkupLookup } = require('./lib/firestoreLookups');

async function emitDomainEvent(db, type, aggregateId, payload, emittedBy) {
  // PHASE 3.A.5 PLACEHOLDER: 3.A.5 introduces the canonical
  // `domain_events/{eventId}` outbox + dispatcher. For now we append.
  await db.collection('domain_events').add({
    type,
    aggregateId,
    payload,
    emittedBy,
    occurredAt: FieldValue.serverTimestamp(),
  });
}

async function repriceForFloorRecheck(quote, lines) {
  const subsidiaryIds = [...new Set(lines.map(l => l.subsidiaryOrgId))];
  const { lookupRate } = await buildRateLookup({ subsidiaryIds });
  const lookupMarkup = buildMarkupLookup();
  return computePricedQuote({
    sowId: quote.sowId,
    clientId: quote.clientId || quote.sowId,
    lines: lines.map(l => ({
      subsidiaryOrgId: l.subsidiaryOrgId,
      roleCode: l.roleCode,
      unit: l.unit,
      qty: l.qty,
    })),
    marginFloorPct: quote.marginFloorPct || 25,
    lookupRate,
    lookupMarkup,
  });
}

// ─────────────────────────────────────────────────────────────────
// issueQuote
// ─────────────────────────────────────────────────────────────────

exports.issueQuote = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  async (request) => {
    const { isOverrideEligible } = await assertPricingAdmin(request.auth, { allowOverride: true });
    const { quoteId, overrideFloor } = request.data || {};
    if (!quoteId) throw new HttpsError('invalid-argument', 'quoteId is required.');

    const db = getFirestore();
    const quoteRef = db.doc(`quotes/${quoteId}`);
    const linesRef = db.collection(`quotes/${quoteId}/quote_lines`);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(quoteRef);
      if (!snap.exists) throw new HttpsError('not-found', `Quote ${quoteId} not found.`);
      const quote = snap.data();
      if (quote.status !== 'DRAFT') {
        throw new HttpsError('failed-precondition', `Cannot issue quote in status ${quote.status}.`);
      }
      const linesSnap = await linesRef.get();
      const lines = linesSnap.docs.map(d => d.data());
      if (!lines.length) throw new HttpsError('failed-precondition', 'Cannot issue an empty quote.');

      // Re-check margin floor against current rate cards. The cost basis on
      // each line is preserved from the original pricing (the rate-card
      // version is pinned per §11.8); we still recompute to defend against
      // mid-draft tampering.
      let priced;
      try {
        priced = await repriceForFloorRecheck(quote, lines);
      } catch (err) {
        if (err instanceof PricingError) throw new HttpsError('failed-precondition', err.message);
        throw err;
      }
      if (!priced.meetsFloor && !(overrideFloor && isOverrideEligible)) {
        throw new HttpsError(
          'failed-precondition',
          `MARGIN_BELOW_FLOOR: ${priced.marginPct.toFixed(2)}% < ${priced.marginFloorPct}%.`,
        );
      }

      tx.update(quoteRef, {
        status: 'ISSUED',
        issuedAt: FieldValue.serverTimestamp(),
        issuedByUserId: request.auth.uid,
        marginPctAtIssue: priced.marginPct,
        clientTotalMinor: priced.totalClientMinor,
        totalCostMinor: priced.totalCostMinor,
        ...(overrideFloor && !priced.meetsFloor
          ? { marginFloorOverride: { by: request.auth.uid, reason: request.data.overrideReason || 'unspecified', at: FieldValue.serverTimestamp() } }
          : {}),
        updatedAt: FieldValue.serverTimestamp(),
      });
      await emitDomainEvent(db, 'QuoteIssued', quoteId, {
        sowId: quote.sowId,
        clientTotalMinor: priced.totalClientMinor,
        marginPct: priced.marginPct,
      }, request.auth.uid);

      return { quoteId, status: 'ISSUED', marginPct: priced.marginPct };
    });
  },
);

// ─────────────────────────────────────────────────────────────────
// acceptQuote
// ─────────────────────────────────────────────────────────────────

exports.acceptQuote = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  async (request) => {
    await assertPricingAdmin(request.auth);
    const { quoteId, acceptedBy, acceptedByClientName } = request.data || {};
    if (!quoteId) throw new HttpsError('invalid-argument', 'quoteId is required.');

    const db = getFirestore();
    const quoteRef = db.doc(`quotes/${quoteId}`);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(quoteRef);
      if (!snap.exists) throw new HttpsError('not-found', `Quote ${quoteId} not found.`);
      const quote = snap.data();
      if (quote.status !== 'ISSUED') {
        throw new HttpsError('failed-precondition', `Cannot accept quote in status ${quote.status}.`);
      }
      tx.update(quoteRef, {
        status: 'ACCEPTED',
        acceptedAt: FieldValue.serverTimestamp(),
        acceptedBy: acceptedBy || request.auth.uid,
        acceptedByClientName: acceptedByClientName || null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      // 3.D consumes this to open the MasterJob.
      await emitDomainEvent(db, 'QuoteAccepted', quoteId, {
        sowId: quote.sowId,
        clientTotalMinor: quote.clientTotalMinor,
        acceptedBy: acceptedBy || request.auth.uid,
      }, request.auth.uid);
      return { quoteId, status: 'ACCEPTED' };
    });
  },
);

// ─────────────────────────────────────────────────────────────────
// voidQuote
// ─────────────────────────────────────────────────────────────────

exports.voidQuote = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  async (request) => {
    await assertPricingAdmin(request.auth);
    const { quoteId, reason } = request.data || {};
    if (!quoteId) throw new HttpsError('invalid-argument', 'quoteId is required.');
    if (!reason || typeof reason !== 'string') {
      throw new HttpsError('invalid-argument', 'reason is required.');
    }

    const db = getFirestore();
    const quoteRef = db.doc(`quotes/${quoteId}`);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(quoteRef);
      if (!snap.exists) throw new HttpsError('not-found', `Quote ${quoteId} not found.`);
      const quote = snap.data();
      if (quote.status === 'ACCEPTED') {
        throw new HttpsError('failed-precondition', 'Cannot void an ACCEPTED quote (raise a change order instead).');
      }
      if (quote.status === 'VOID') {
        throw new HttpsError('failed-precondition', 'Quote is already VOID.');
      }
      tx.update(quoteRef, {
        status: 'VOID',
        voidedAt: FieldValue.serverTimestamp(),
        voidedReason: reason,
        updatedAt: FieldValue.serverTimestamp(),
      });
      await emitDomainEvent(db, 'QuoteVoided', quoteId, { reason }, request.auth.uid);
      return { quoteId, status: 'VOID' };
    });
  },
);
