/**
 * seedTransferPricingPolicy — ADR-0001 Q3 (cost-plus transfer pricing).
 *
 * One-time callable (safe to re-run — idempotent via set+merge on parent
 * docs; version doc uses a fixed id `v_seed` so repeated calls don't
 * create extra versions).
 *
 * Populates `transfer_pricing_policy/{fromOrgId}__{toOrgId}` parent docs
 * for all 30 directed pairs among the 6 Zeus Group org IDs (5 subsidiaries
 * + 1 parent), excluding self-pairs. Each pair gets:
 *
 *   Parent doc: { fromOrgId, toOrgId, defaultMarkupPct: 10,
 *                 currentVersionId: 'v_seed', currentMarkupPct: 10 }
 *   versions/v_seed: { id: 'v_seed', markupPct: 10,
 *                      effectiveFrom: epoch-start (Jan 1 2024),
 *                      reason: 'Seed — 10% cost-plus across all pairs',
 *                      setBy: 'system', setAt: now }
 *
 * Default 10% is the standard intra-group cost-plus rate cited in
 * ADR-0001 Q3. Tax-side review may raise individual pairs later via the
 * admin callable (to be built in Phase 6.F or a finance admin UI).
 *
 * Auth: super-user only (onzimaid@zeusgroup.co.ug etc.)
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// All 6 org IDs in Zeus Group.
const ALL_ORG_IDS = [
  'zeus-group',
  'zeus-the-agency',
  'zeus-digital',
  'labyrinth',
  'odd-gorilla',
  'house-of-zeus',
];

const DEFAULT_MARKUP_PCT = 10;
const SEED_VERSION_ID = 'v_seed';
const SEED_REASON = 'Seed — 10% cost-plus across all directed pairs (ADR-0001 Q3)';

// Epoch start for the seed version — far enough back that all pre-Q3
// IWOs that are still open will see the policy at close.
const EFFECTIVE_FROM = '2024-01-01T00:00:00.000Z';

const SUPER_EMAILS = new Set([
  'onzimai@zeusgroup.co.ug',
  'onzimai@dawin.group',
  'admin@zeusgroup.co.ug',
]);

function policyDocId(fromOrgId, toOrgId) {
  return `${fromOrgId}__${toOrgId}`;
}

/** Build all directed pairs, excluding self-pairs. */
function buildAllPairs() {
  const pairs = [];
  for (const from of ALL_ORG_IDS) {
    for (const to of ALL_ORG_IDS) {
      if (from !== to) pairs.push({ fromOrgId: from, toOrgId: to });
    }
  }
  return pairs;
}

async function runSeed(auth) {
  // Super-user gate — this callable touches every policy pair.
  if (!auth || !auth.uid || !auth.token) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  const callerEmail = auth.token.email || '';
  if (!SUPER_EMAILS.has(callerEmail)) {
    throw new HttpsError(
      'permission-denied',
      'seedTransferPricingPolicy is restricted to super-users.',
    );
  }

  const pairs = buildAllPairs();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const results = { created: 0, skipped: 0, errors: [] };

  // Process in batches of 25 (each pair = 2 writes → ~50 per batch; well
  // under Firestore's 500-write batch limit).
  for (let i = 0; i < pairs.length; i += 25) {
    const chunk = pairs.slice(i, i + 25);
    const batch = db.batch();

    for (const { fromOrgId, toOrgId } of chunk) {
      const docId = policyDocId(fromOrgId, toOrgId);
      const parentRef = db.doc(`transfer_pricing_policy/${docId}`);
      const versionRef = parentRef.collection('versions').doc(SEED_VERSION_ID);

      // Parent doc — merge:false would overwrite manual changes on re-run.
      // merge:true preserves later tax-side edits while still being safe
      // to call repeatedly (only fills missing fields on retry).
      batch.set(
        parentRef,
        {
          id: docId,
          fromOrgId,
          toOrgId,
          defaultMarkupPct: DEFAULT_MARKUP_PCT,
          // Only set currentVersionId + currentMarkupPct if not already
          // present — defer to set-with-merge so an admin update wins.
          currentVersionId: SEED_VERSION_ID,
          currentMarkupPct: DEFAULT_MARKUP_PCT,
          createdBy: 'system',
          createdAt: now,
          updatedBy: 'system',
          updatedAt: now,
        },
        { merge: true },
      );

      // Seed version — fixed id so re-runs are idempotent.
      batch.set(
        versionRef,
        {
          id: SEED_VERSION_ID,
          markupPct: DEFAULT_MARKUP_PCT,
          effectiveFrom: EFFECTIVE_FROM,
          effectiveUntil: null,
          reason: SEED_REASON,
          setBy: 'system',
          setAt: now,
        },
        { merge: true },
      );
    }

    try {
      await batch.commit();
      results.created += chunk.length;
    } catch (err) {
      results.errors.push(`Batch ${i}–${i + chunk.length}: ${err.message}`);
    }
  }

  return {
    totalPairs: pairs.length,
    created: results.created,
    skipped: results.skipped,
    errors: results.errors,
    defaultMarkupPct: DEFAULT_MARKUP_PCT,
    seedVersionId: SEED_VERSION_ID,
  };
}

exports.seedTransferPricingPolicy = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  (request) => runSeed(request.auth),
);
