/**
 * submitDeliverable — spec §6.1.1 / §10 (DeliverableSubmitted event).
 *
 *   IN_PROGRESS → DELIVERED   (guard: ≥1 deliverable attached)
 *   Emits DeliverableSubmitted.
 *
 * `assetIds` are foreign keys to wherever the deliverable artefacts live
 * (Drive / Storage / asset library). They're stored on the deliverable
 * subdoc for traceability — Phase 3.B doesn't verify the asset records
 * exist, only that ≥1 was attached.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');

const { assertDeliveryLead } = require('./lib/auth');
const { withIdempotency, toHttpsError } = require('../platform/idempotency');
const { appendDomainEvent } = require('../platform/outbox');
const { nextState } = require('./lib/iwo-state-machine');
const { ulid } = require('../platform/ulid');

async function runSubmitDeliverable({ db, auth, data }) {
    const { iwoId, assetIds, description, idempotencyKey } = data || {};
    if (!iwoId) throw new HttpsError('invalid-argument', 'iwoId is required.');
    if (!Array.isArray(assetIds) || assetIds.length === 0) {
      throw new HttpsError('invalid-argument', '≥1 assetId is required to submit a deliverable.');
    }

    const iwoRef = db.doc(`internal_work_orders/${iwoId}`);
    const iwoSnap0 = await iwoRef.get();
    if (!iwoSnap0.exists) throw new HttpsError('not-found', `IWO ${iwoId} not found.`);
    const { uid } = await assertDeliveryLead(auth, iwoSnap0.data().subsidiaryOrgId);

    try {
      return await withIdempotency(
        db,
        { key: idempotencyKey, endpoint: 'submitDeliverable' },
        async (tx, recordCache) => {
          const snap = await tx.get(iwoRef);
          if (!snap.exists) throw new HttpsError('not-found', `IWO ${iwoId} not found.`);
          const iwo = snap.data();
          const to = nextState(iwo.state, 'deliver');

          const delId = `del_${ulid()}`;
          const delRef = db.doc(`internal_work_orders/${iwoId}/deliverables/${delId}`);
          tx.set(delRef, {
            id: delId,
            iwoId,
            assetIds,
            description: description || null,
            submittedByUserId: uid,
            createdAt: FieldValue.serverTimestamp(),
          });

          tx.update(iwoRef, {
            state: to,
            deliveredAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });

          appendDomainEvent({
            tx, db,
            eventType: 'DeliverableSubmitted',
            aggregateType: 'IWO',
            aggregateId: iwoId,
            payload: { iwoId, deliverableId: delId, submittedByUserId: uid },
            emittedByUserId: uid,
            idempotencyKey,
          });

          const response = { id: iwoId, status: to, deliverableId: delId };
          recordCache(response);
          return response;
        },
      );
    } catch (err) {
      throw toHttpsError(err);
    }
}

exports.runSubmitDeliverable = runSubmitDeliverable;
exports.submitDeliverable = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  (request) => runSubmitDeliverable({ db: getFirestore(), auth: request.auth, data: request.data }),
);
