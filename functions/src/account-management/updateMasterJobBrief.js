/**
 * updateMasterJobBrief — Phase 6.UI.D.1 callable.
 *
 * Updates `master_jobs/{id}.campaign.brief` with the co-authored brief
 * fields captured by the AM intake form: documentDeliveredAt,
 * verbalBriefingAt, authorContributions[], plus the legacy fields
 * (objectives, kpis, deliverablesSummary, etc.).
 *
 * Rules block all direct client writes on master_jobs (rules:3500),
 * so this callable is the single write path for the brief from the
 * UI. Auth gated on `assertParentOrgPrincipal`.
 *
 * Idempotency: the call is not idempotent by design — each invocation
 * overwrites the brief subdoc. The `validateBrief()` helper on the
 * frontend surfaces co-authorship + cadence warnings inline, but the
 * callable does not gate on those (the rule is advisory).
 *
 * The contribution list is allowed to grow append-only by the UI; the
 * callable simply persists whatever array the client sends. If callers
 * want strict append-only semantics, they should fetch first and merge.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');
const { assertParentOrgPrincipal } = require('../assignment/lib/auth');

const ALLOWED_BRIEF_FIELDS = new Set([
  'tier',
  'objectives',
  'targetAudience',
  'kpis',
  'deliverablesSummary',
  'budgetUGX',
  'deadline',
  'briefedAt',
  'documentDeliveredAt',
  'verbalBriefingAt',
  'authorContributions',
]);

function sanitizeBriefPatch(input) {
  const out = {};
  for (const key of Object.keys(input || {})) {
    if (ALLOWED_BRIEF_FIELDS.has(key)) {
      out[key] = input[key];
    }
  }
  return out;
}

async function runUpdateMasterJobBrief({
  db,
  auth,
  data,
  assertAuth = assertParentOrgPrincipal,
}) {
  const { uid } = await assertAuth(auth);
  const { masterJobId, brief } = data || {};
  if (!masterJobId || typeof masterJobId !== 'string') {
    throw new HttpsError('invalid-argument', 'masterJobId is required.');
  }
  if (!brief || typeof brief !== 'object') {
    throw new HttpsError('invalid-argument', 'brief object is required.');
  }

  const patch = sanitizeBriefPatch(brief);
  const mjRef = db.doc(`master_jobs/${masterJobId}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(mjRef);
    if (!snap.exists) {
      throw new HttpsError('not-found', `MasterJob ${masterJobId} not found.`);
    }
    const mj = snap.data();
    const existingCampaign = mj.campaign || {};
    const existingBrief = existingCampaign.brief || {};

    const nowIso = new Date().toISOString();
    const mergedBrief = {
      ...existingBrief,
      ...patch,
      // Track the last brief edit for cycle-time analytics.
      updatedBy: uid,
      updatedAt: nowIso,
    };

    tx.update(mjRef, {
      campaign: { ...existingCampaign, brief: mergedBrief },
      updatedAt: nowIso,
    });
  });

  return { masterJobId, updated: true };
}

exports.runUpdateMasterJobBrief = runUpdateMasterJobBrief;
exports.updateMasterJobBrief = onCall(
  { cors: ALLOWED_ORIGINS },
  (request) => runUpdateMasterJobBrief({
    db: getFirestore(),
    auth: request.auth,
    data: request.data,
  }),
);
