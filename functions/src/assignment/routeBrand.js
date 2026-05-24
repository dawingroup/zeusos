/**
 * routeBrand — onCall wrapper around runRouteBrand (Phase 6.B).
 *
 * Per Addendum v1.1 §8: routing is a recommendation surface; Traffic
 * confirms or overrides before issueWorkOrder runs. This callable:
 *   1. Asserts the caller is a parent-org / Traffic principal.
 *   2. Invokes runRouteBrand to compute the proposal + audit-trail.
 *   3. Emits `RoutingBrandProposed` via the outbox so the agent /
 *      Traffic queue can consume.
 *   4. Returns the result to the caller for Traffic confirmation.
 *
 * Override path: Traffic posts a different brand back via
 * issueWorkOrder; the override is naturally captured by the IWO's
 * subsidiaryOrgId !== this proposal's proposedBrandId.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');

const { assertParentOrgPrincipal } = require('./lib/auth');
const { appendDomainEvent } = require('../platform/outbox');
const { ulid } = require('../platform/ulid');
const { runRouteBrand } = require('./services/route-brand.service');

/**
 * Pure-ish runner — extracted from the onCall wrapper so unit tests
 * can inject a stub Firestore. Mirrors the issueWorkOrder pattern.
 */
async function runRouteBrandWithEmit({ db, auth, data }) {
  const { uid } = await assertParentOrgPrincipal(auth);

  const input = data || {};
  const result = await runRouteBrand({ db, input });

  // Emit the proposal event regardless of whether we found a winner —
  // a NO_ELIGIBLE_BRAND result is itself valuable signal for Traffic
  // (manual routing required).
  const proposalId = `routing_${ulid()}`;
  await db.runTransaction(async (tx) => {
    appendDomainEvent({
      tx,
      db,
      eventType: 'RoutingBrandProposed',
      aggregateType: 'master_job',
      aggregateId: input.masterJobId,
      payload: {
        proposalId,
        proposedBrandId: result.proposedBrandId,
        requiredCapability: input.requiredCapability,
        tier: result.tierApplied,
        accountRegion: input.accountRegion || null,
        accountCategory: input.accountCategory || null,
        geographyPreferenceApplied: result.geographyPreferenceApplied,
        reasonNoCandidate: result.reasonNoCandidate,
        // Slim the candidate list — only rejection reasons + availability.
        candidates: result.candidates.map((c) => ({
          brandId: c.brandId,
          openIwoCount: c.openIwoCount,
          availability: c.availability,
          rejectionReason: c.rejectionReason,
        })),
        proposedByUserId: uid,
      },
    });
  });

  return { ...result, proposalId };
}

exports.runRouteBrandWithEmit = runRouteBrandWithEmit;

exports.routeBrand = onCall(
  { cors: ALLOWED_ORIGINS },
  (request) => runRouteBrandWithEmit({
    db: getFirestore(),
    auth: request.auth,
    data: request.data,
  })
);
