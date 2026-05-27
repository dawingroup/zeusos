/**
 * Transfer Pricing Policy lookup — Q3 (ADR-0001).
 *
 * Server-side companion to src/modules/contracts/types/transfer-pricing-policy.types.ts.
 *
 * Two functions:
 *
 *   lookupMarkupPct(db, fromOrgId, toOrgId, atDate)
 *     Returns the active markupPct for the pair at the given date,
 *     or null when no policy exists. Reads the parent doc and (when
 *     present) walks the most-recent versions/{ulid} that started
 *     on or before atDate.
 *
 *   computeEffectiveTransferPrice({ db, iwo, atDate })
 *     End-to-end helper for closeWorkOrder. Computes
 *     `cumulativeCostMinor × (1 + markupPct / 100)` using the
 *     policy in effect at atDate; falls back to
 *     `iwo.transferPriceMinor` (set at issue) when no policy
 *     exists for the pair (back-compat).
 *
 * Currently hard-codes `toOrgId = PARENT_ORG_ID` at the call site
 * — see callers in closeWorkOrder. Brand-direct (Q2) lookups that
 * route to the commercial-owner brand land in the Q3.2 follow-up,
 * once Q2 (#98) merges.
 */

const TRANSFER_PRICING_POLICY_COLLECTION = 'transfer_pricing_policy';

function policyId(fromOrgId, toOrgId) {
  return `${fromOrgId}__${toOrgId}`;
}

function toMs(t) {
  if (t == null) return null;
  if (typeof t === 'string') {
    const ms = Date.parse(t);
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof t === 'object') {
    if (typeof t.toMillis === 'function') return t.toMillis();
    if (typeof t.seconds === 'number') return t.seconds * 1000;
  }
  return null;
}

/**
 * Look up the active markupPct for (fromOrgId, toOrgId) at atDate.
 * Returns the markupPct (number) on hit; null when no parent doc
 * exists for the pair.
 *
 * Resolution order:
 *   1. Walk versions/{*} ordered by effectiveFrom DESC. First one
 *      whose effectiveFrom ≤ atDate AND (effectiveUntil > atDate
 *      OR effectiveUntil is null) wins.
 *   2. If no version matches but parent has currentMarkupPct, use it.
 *   3. If parent has defaultMarkupPct, use it.
 *   4. Return null.
 *
 * @param {object} db - Firestore instance (or stub).
 * @param {string} fromOrgId
 * @param {string} toOrgId
 * @param {Date|string|null} atDate - defaults to now.
 * @returns {Promise<number|null>}
 */
async function lookupMarkupPct(db, fromOrgId, toOrgId, atDate = null) {
  if (!fromOrgId || !toOrgId) return null;
  const pairId = policyId(fromOrgId, toOrgId);
  const parentRef = db.doc(`${TRANSFER_PRICING_POLICY_COLLECTION}/${pairId}`);
  const parentSnap = await parentRef.get();
  if (!parentSnap.exists) return null;
  const parent = parentSnap.data();

  const atMs = atDate ? (toMs(atDate) || Date.now()) : Date.now();

  // Walk versions for an effective-dated match.
  const versionsSnap = await parentRef.collection('versions').get();
  if (!versionsSnap.empty) {
    const versions = versionsSnap.docs.map((d) => d.data());
    // Filter to versions whose effectiveFrom ≤ atDate AND (effectiveUntil
    // > atDate OR no effectiveUntil). Pick the one with the latest
    // effectiveFrom — that's the most-specific match.
    const eligible = versions.filter((v) => {
      const fromMs = toMs(v.effectiveFrom);
      if (fromMs == null || fromMs > atMs) return false;
      const untilMs = toMs(v.effectiveUntil);
      if (untilMs != null && untilMs <= atMs) return false;
      return true;
    });
    if (eligible.length > 0) {
      eligible.sort((a, b) => (toMs(b.effectiveFrom) || 0) - (toMs(a.effectiveFrom) || 0));
      return typeof eligible[0].markupPct === 'number' ? eligible[0].markupPct : null;
    }
  }

  // Fall through to denormalized current + default.
  if (typeof parent.currentMarkupPct === 'number') return parent.currentMarkupPct;
  if (typeof parent.defaultMarkupPct === 'number') return parent.defaultMarkupPct;
  return null;
}

/**
 * Apply cost-plus markup. Pure — same shape as the TS helper.
 */
function applyMarkup(cumulativeCostMinor, markupPct) {
  if (!Number.isFinite(cumulativeCostMinor) || cumulativeCostMinor <= 0) return 0;
  const safe = Number.isFinite(markupPct) ? markupPct : 0;
  return Math.round(cumulativeCostMinor * (1 + safe / 100));
}

/**
 * High-level helper used by closeWorkOrder. Looks up policy for
 * (subsidiaryOrgId → toOrgId), applies cost-plus, returns the
 * effective transfer price + an audit trail.
 *
 * Falls back to `iwo.transferPriceMinor` (the value set at issue
 * time) when:
 *   - No policy exists for the pair (pre-Q3 IWOs / unsynced pairs).
 *   - Policy markup lookup returns null.
 *   - cumulativeCostMinor is 0 (no cost-plus to apply).
 *
 * @returns {{
 *   amountMinor: number,
 *   source: 'policy' | 'issue-time-fallback' | 'zero-cost-fallback',
 *   markupPct: number|null,
 *   cumulativeCostMinor: number,
 * }}
 */
async function computeEffectiveTransferPrice({
  db, iwo, toOrgId, atDate = null,
}) {
  const cumulativeCostMinor = Number(iwo.cumulativeCostMinor) || 0;
  const issueTimePrice = Number(iwo.transferPriceMinor) || 0;

  // Zero-cost IWO — no work was logged. Honour issue-time price (it
  // may represent a flat-fee IWO with no time entries).
  if (cumulativeCostMinor === 0) {
    return {
      amountMinor: issueTimePrice,
      source: 'zero-cost-fallback',
      markupPct: null,
      cumulativeCostMinor: 0,
    };
  }

  const markupPct = await lookupMarkupPct(db, iwo.subsidiaryOrgId, toOrgId, atDate);
  if (markupPct == null) {
    return {
      amountMinor: issueTimePrice,
      source: 'issue-time-fallback',
      markupPct: null,
      cumulativeCostMinor,
    };
  }

  return {
    amountMinor: applyMarkup(cumulativeCostMinor, markupPct),
    source: 'policy',
    markupPct,
    cumulativeCostMinor,
  };
}

module.exports = {
  lookupMarkupPct,
  applyMarkup,
  computeEffectiveTransferPrice,
  policyId,
  TRANSFER_PRICING_POLICY_COLLECTION,
};
