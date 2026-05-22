/**
 * signAcceptanceCriterion — AM-side gate for `accept_internal`.
 *
 * `acceptInternal` (spec §6.1.1, §11.10) is guarded by the rule that
 * every required acceptance criterion on the IWO's handoff packet must
 * carry a `signedByUserId`. The packet itself is `write: if false` in
 * firestore.rules — only Cloud Functions may mutate it. This callable
 * lets an AM principal sign one criterion at a time so the DeliverableReview
 * queue page can render checkboxes that flow back to the canonical doc.
 *
 * Spec authority: AM-only (assertParentOrgPrincipal). The IWO state must
 * be DELIVERED for signing to make sense; we accept ACCEPTED_INTERNALLY
 * too so re-signs (e.g. supplementary criteria post-acceptance) succeed
 * without further state change.
 *
 * Phase 3.D scope. Companion to `acceptInternalRequestRevision.js`.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');

const { assertParentOrgPrincipal } = require('./lib/auth');

exports.signAcceptanceCriterion = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  async (request) => {
    const { uid } = await assertParentOrgPrincipal(request.auth);
    const { iwoId, criterionId, sign = true } = request.data || {};
    if (!iwoId) throw new HttpsError('invalid-argument', 'iwoId is required.');
    if (!criterionId) throw new HttpsError('invalid-argument', 'criterionId is required.');

    const db = getFirestore();
    const iwoRef = db.doc(`internal_work_orders/${iwoId}`);
    const packetRef = db.doc(`internal_work_orders/${iwoId}/handoff_packet/packet`);

    return db.runTransaction(async (tx) => {
      const iwoSnap = await tx.get(iwoRef);
      if (!iwoSnap.exists) throw new HttpsError('not-found', `IWO ${iwoId} not found.`);
      const iwo = iwoSnap.data();
      if (iwo.state !== 'DELIVERED' && iwo.state !== 'ACCEPTED_INTERNALLY') {
        throw new HttpsError(
          'failed-precondition',
          `IWO ${iwoId} is ${iwo.state}; only DELIVERED IWOs can be signed off.`,
        );
      }
      const packetSnap = await tx.get(packetRef);
      if (!packetSnap.exists) {
        throw new HttpsError('failed-precondition', 'Handoff packet missing.');
      }
      const packet = packetSnap.data();
      const criteria = Array.isArray(packet.acceptanceCriteria) ? packet.acceptanceCriteria : [];
      let matched = false;
      const updated = criteria.map((c) => {
        if (!c || c.id !== criterionId) return c;
        matched = true;
        if (sign) {
          return {
            ...c,
            signedByUserId: uid,
            signedAt: new Date().toISOString(),
          };
        }
        // Unsign — strip the signedByUserId / signedAt fields.
        const { signedByUserId: _u, signedAt: _t, ...rest } = c;
        return rest;
      });
      if (!matched) {
        throw new HttpsError('not-found', `Criterion ${criterionId} not found on IWO ${iwoId}.`);
      }
      tx.update(packetRef, {
        acceptanceCriteria: updated,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { iwoId, criterionId, signed: !!sign, signedByUserId: sign ? uid : null };
    });
  },
);
