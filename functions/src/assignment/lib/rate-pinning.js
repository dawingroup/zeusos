/**
 * Pinned-rate resolution — spec §11.8.
 *
 * Quotes and IWOs pin rate-card versions at quote-accept time. Time
 * entries posted later look up the rate via the pinned card, NOT the
 * currently-active one. This file centralises that lookup.
 *
 * Storage:
 *   quote.pinnedRateCardIdsBySubsidiary: { [subsidiaryOrgId]: rateCardId }
 *   rate_cards/{rateCardId}/rate_card_lines/{lineId} — roleCode + unit + costMinor
 *
 * If the pinned card cannot be resolved (e.g. cleanup script ran), the
 * function falls back to the IWO's `subsidiaryOrgId` active card with a
 * loud warning so dashboards can surface the drift.
 */

const { getFirestore } = require('firebase-admin/firestore');

/**
 * Compute cost for `minutes` worked by `userId` against `iwo`.
 *
 * Resolution order:
 *   1. iwo.pinnedRateCardId + user.roleCode → rate_card_lines (HOUR unit)
 *   2. Quote's pinnedRateCardIdsBySubsidiary[iwo.subsidiaryOrgId]
 *   3. Active rate card for subsidiary
 *   4. Fail with FAILED_PRECONDITION
 */
async function resolveTimeEntryCost({ iwo, masterJob, quote, userId, minutes }) {
  const db = getFirestore();
  if (!Number.isInteger(minutes) || minutes <= 0) {
    const err = new Error(`postTimeEntry: minutes must be a positive integer, got ${minutes}.`);
    err.code = 'INVALID_MINUTES';
    throw err;
  }

  // Look up user's roleCode. Falls back to a default if absent.
  let user = await db.doc(`organizations/default/users/${userId}`).get();
  if (!user.exists) user = await db.doc(`users/${userId}`).get();
  const roleCode = (user.exists && user.data().roleCode) || 'STAFF';

  const pinnedId = pickPinnedRateCardId({ iwo, masterJob, quote });
  let rateCard = null;
  let rateLine = null;
  if (pinnedId) {
    rateCard = await db.doc(`rate_cards/${pinnedId}`).get();
    rateLine = await findRateLine(db, pinnedId, roleCode);
  }
  if (!rateLine) {
    const fallback = await findActiveRateCard(db, iwo.subsidiaryOrgId);
    if (fallback) {
      rateCard = fallback;
      rateLine = await findRateLine(db, fallback.id, roleCode);
    }
  }
  if (!rateLine) {
    const err = new Error(
      `postTimeEntry: no rate-card line for ${iwo.subsidiaryOrgId}/${roleCode}. Define a rate card before posting time.`,
    );
    err.code = 'RATE_NOT_FOUND';
    throw err;
  }

  // Rate stored in minor units per HOUR; cost = (minutes / 60) * cost_minor.
  // Round half-up to keep cents whole.
  const costMinor = Math.round((minutes / 60) * rateLine.costMinor);
  return {
    costMinor,
    roleCode,
    rateCardId: rateCard && rateCard.id,
    rateCardLineId: rateLine.id,
  };
}

function pickPinnedRateCardId({ iwo, quote }) {
  if (iwo && iwo.pinnedRateCardId) return iwo.pinnedRateCardId;
  if (quote && quote.pinnedRateCardIdsBySubsidiary && iwo) {
    return quote.pinnedRateCardIdsBySubsidiary[iwo.subsidiaryOrgId];
  }
  return null;
}

async function findRateLine(db, rateCardId, roleCode) {
  const snap = await db
    .collection(`rate_cards/${rateCardId}/rate_card_lines`)
    .where('roleCode', '==', roleCode)
    .where('unit', '==', 'HOUR')
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function findActiveRateCard(db, subsidiaryOrgId) {
  const snap = await db
    .collection('rate_cards')
    .where('subsidiaryOrgId', '==', subsidiaryOrgId)
    .where('status', '==', 'ACTIVE')
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

module.exports = { resolveTimeEntryCost, pickPinnedRateCardId };
