/**
 * IC transfer-pricing markup resolver — per
 * [ADR-2026-05-25 §2.Q3](../../../docs/ADR-2026-05-25-commercial-model.md).
 *
 *   resolveIcMarkupPct(db, receivingOrgId)
 *     -> Number — whole-percentage points (15, not 0.15).
 *
 * Lookup order:
 *   1. `organizations/{receivingOrgId}.icMarkupPct` (per-brand override)
 *   2. `engine_config/global.icMarkupPctDefault` (group default)
 *   3. `DEFAULT_IC_MARKUP_PCT` constant (15)
 *
 * The applied pct is persisted on each `intercompany_invoices/{id}.appliedMarkupPct`
 * for audit (so changing the default later doesn't retroactively rewrite
 * historical IC invoices).
 */

/** Hard fallback when neither the org nor engine_config has a value. */
const DEFAULT_IC_MARKUP_PCT = 15;

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} receivingOrgId — the sub-brand receiving work from another
 *   brand (i.e. the one whose icMarkupPct override applies).
 * @returns {Promise<number>}
 */
async function resolveIcMarkupPct(db, receivingOrgId) {
  if (!receivingOrgId) return DEFAULT_IC_MARKUP_PCT;

  try {
    const orgSnap = await db.doc(`organizations/${receivingOrgId}`).get();
    if (orgSnap.exists) {
      const raw = orgSnap.data().icMarkupPct;
      if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
        return raw;
      }
    }
  } catch {
    /* swallow — fall through to engine_config */
  }

  try {
    const engineSnap = await db.doc('engine_config/global').get();
    if (engineSnap.exists) {
      const raw = engineSnap.data().icMarkupPctDefault;
      if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
        return raw;
      }
    }
  } catch {
    /* swallow — fall through to constant */
  }

  return DEFAULT_IC_MARKUP_PCT;
}

/**
 * Apply a markup percentage to a cost-base amount (minor units).
 * Rounds half-up to the nearest minor unit. Markup is whole-pct.
 */
function applyMarkup(costMinor, markupPct) {
  if (!Number.isFinite(costMinor) || costMinor < 0) return 0;
  if (!Number.isFinite(markupPct) || markupPct < 0) return costMinor;
  return Math.round(costMinor * (1 + markupPct / 100));
}

module.exports = {
  DEFAULT_IC_MARKUP_PCT,
  resolveIcMarkupPct,
  applyMarkup,
};
