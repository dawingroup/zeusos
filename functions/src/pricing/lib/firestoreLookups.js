/**
 * Firestore-backed lookups for the pricing engine. The pure compute in
 * `computePricing.js` accepts these as injected dependencies so the unit
 * tests can swap in stubs.
 */

const { getFirestore } = require('firebase-admin/firestore');

/**
 * Resolve the ACTIVE rate card for a subsidiary as-of a given date and
 * return a `lookupRate` function bound to it. The same rate card is reused
 * across all lines for that subsidiary, so the calling CFn can pin its id
 * onto the resulting Quote per §11.8.
 *
 * PHASE 3.A.5 PLACEHOLDER: this assumes `rate_cards` lives at the root.
 * 3.A.5's canonical path is `organizations/{subsidiary}/rate_cards/{id}`.
 * Re-point when 3.A.5 lands.
 */
async function buildRateLookup({ subsidiaryIds, asOf = new Date() }) {
  const db = getFirestore();
  const cardsBySubsidiary = new Map();
  const linesByKey = new Map();

  for (const subsidiaryId of subsidiaryIds) {
    const snap = await db
      .collection('rate_cards')
      .where('orgId', '==', subsidiaryId)
      .where('status', '==', 'ACTIVE')
      .limit(1)
      .get();
    if (snap.empty) {
      throw new Error(`No ACTIVE rate card for subsidiary ${subsidiaryId} as-of ${asOf.toISOString()}.`);
    }
    const card = { id: snap.docs[0].id, ...snap.docs[0].data() };
    cardsBySubsidiary.set(subsidiaryId, card);

    const linesSnap = await db.collection(`rate_cards/${card.id}/rate_card_lines`).get();
    for (const lineDoc of linesSnap.docs) {
      const line = { id: lineDoc.id, ...lineDoc.data() };
      const key = `${subsidiaryId}:${line.roleCode}:${line.unit}`;
      linesByKey.set(key, { ...line, rateCardId: card.id });
    }
  }

  function lookupRate({ subsidiaryOrgId, roleCode, unit }) {
    const key = `${subsidiaryOrgId}:${roleCode}:${unit}`;
    const line = linesByKey.get(key);
    if (!line) {
      throw new Error(`No rate-card line for ${key} on ACTIVE card.`);
    }
    return {
      rateCardId: line.rateCardId,
      rateCardLineId: line.id,
      costMinor: line.costMinor,
      currency: line.currency,
    };
  }

  return { lookupRate, cardsBySubsidiary };
}

/**
 * Build a markup-policy lookup. PHASE 3.A.5 PLACEHOLDER: until the markup
 * policy lives in Firestore, this mirrors `src/modules/pricing/__stub__/markupPolicy.stub.ts`.
 * Keep in sync; 3.A.5 will replace both with a `markup_policy/{id}`
 * Firestore lookup.
 */
function buildMarkupLookup() {
  const TABLE = [
    { subsidiaryId: 'zeus-the-agency', clientId: '*', markupPct: 35 },
    { subsidiaryId: 'zeus-digital',    clientId: '*', markupPct: 40 },
    { subsidiaryId: 'labyrinth',       clientId: '*', markupPct: 45 },
    { subsidiaryId: 'odd-gorilla',     clientId: '*', markupPct: 45 },
    { subsidiaryId: 'house-of-zeus',   clientId: '*', markupPct: 50 },
  ];
  return function lookupMarkup({ subsidiaryOrgId, clientId }) {
    const direct = TABLE.find(e => e.subsidiaryId === subsidiaryOrgId && e.clientId === clientId);
    if (direct) return direct.markupPct;
    const wildcard = TABLE.find(e => e.subsidiaryId === subsidiaryOrgId && e.clientId === '*');
    if (wildcard) return wildcard.markupPct;
    throw new Error(`No markup policy entry for subsidiary=${subsidiaryOrgId} client=${clientId}`);
  };
}

module.exports = { buildRateLookup, buildMarkupLookup };
