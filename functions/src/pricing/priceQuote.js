/**
 * priceQuote(sowId, lines[]) — spec §8.1 (authoritative).
 *
 * Pulls the ACTIVE rate card per subsidiary, applies the governed markup
 * via `markupPolicy(subsidiary, sow.client)`, computes `client_minor`, and
 * enforces the margin floor (default 25%). Rejects with `MARGIN_BELOW_FLOOR`
 * unless the caller asserted `overrideFloor` (owners only — see auth.js).
 *
 * The compute itself is the pure `computePricedQuote` shared with the
 * client; this function is the thin Firestore + auth wrapper.
 *
 * PHASE 3.A.5 PLACEHOLDER: SOW lookup is best-effort. If `sows/{sowId}`
 * doesn't exist yet (3.A.5 introduces it), the function falls back to
 * treating `clientId` as the sowId for markup-policy resolution.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');

const { computePricedQuote, PricingError } = require('./lib/computePricing');
const { buildRateLookup, buildMarkupLookup } = require('./lib/firestoreLookups');
const { assertPricingAdmin } = require('./lib/auth');

const DEFAULT_MARGIN_FLOOR_PCT = 25;

exports.priceQuote = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  async (request) => {
    const { isOverrideEligible } = await assertPricingAdmin(request.auth, { allowOverride: true });

    const { sowId, lines, marginFloorPct, overrideFloor } = request.data || {};

    if (!sowId || typeof sowId !== 'string') {
      throw new HttpsError('invalid-argument', 'sowId is required.');
    }
    if (!Array.isArray(lines) || lines.length === 0) {
      throw new HttpsError('invalid-argument', 'lines[] must be a non-empty array.');
    }

    const db = getFirestore();
    let clientId = null;
    try {
      const sowDoc = await db.doc(`sows/${sowId}`).get();
      if (sowDoc.exists) {
        clientId = sowDoc.data().clientId || null;
        if (sowDoc.data().status !== 'ACTIVE' && sowDoc.data().status !== 'DRAFT' && sowDoc.data().status !== 'PENDING_APPROVAL') {
          // Spec §8.2: priceQuote may run against DRAFT/PENDING SOWs (an AM is
          // exploring scope) but not CLOSED/CANCELLED.
          throw new HttpsError('failed-precondition', `Cannot price against SOW in status ${sowDoc.data().status}.`);
        }
      }
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      // PHASE 3.A.5: sows collection may not exist yet; fall through.
    }

    if (!clientId) {
      // Phase 3.A.5 placeholder fallback — accept clientId on the request itself.
      clientId = request.data.clientId || sowId;
    }

    const subsidiaryIds = [...new Set(lines.map(l => l.subsidiaryOrgId))];
    let lookupRate, cardsBySubsidiary;
    try {
      ({ lookupRate, cardsBySubsidiary } = await buildRateLookup({ subsidiaryIds }));
    } catch (err) {
      throw new HttpsError('failed-precondition', err.message || String(err));
    }
    const lookupMarkup = buildMarkupLookup();

    let priced;
    try {
      priced = computePricedQuote({
        sowId,
        clientId,
        lines,
        marginFloorPct: typeof marginFloorPct === 'number' ? marginFloorPct : DEFAULT_MARGIN_FLOOR_PCT,
        lookupRate,
        lookupMarkup,
      });
    } catch (err) {
      if (err instanceof PricingError) {
        throw new HttpsError('failed-precondition', err.message);
      }
      throw err;
    }

    if (!priced.meetsFloor && !(overrideFloor && isOverrideEligible)) {
      throw new HttpsError(
        'failed-precondition',
        `MARGIN_BELOW_FLOOR: ${priced.marginPct.toFixed(2)}% < floor ${priced.marginFloorPct}%. ` +
          (overrideFloor
            ? 'Override requires owner role.'
            : 'Pass overrideFloor=true (owner role only) to issue below floor.'),
      );
    }

    return {
      ...priced,
      pinnedRateCardIdsBySubsidiary: Object.fromEntries(
        [...cardsBySubsidiary.entries()].map(([s, c]) => [s, c.id]),
      ),
    };
  },
);
