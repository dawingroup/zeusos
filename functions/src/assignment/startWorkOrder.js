/**
 * startWorkOrder — spec §6.1.1.
 *
 *   ACCEPTED → IN_PROGRESS
 *
 * No guard beyond the state transition. Caller = delivery lead.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');

const { assertDeliveryLead } = require('./lib/auth');
const { withIdempotency, toHttpsError } = require('../platform/idempotency');
const { nextState } = require('./lib/iwo-state-machine');

async function runStartWorkOrder({ db, auth, data }) {
    const { iwoId, idempotencyKey } = data || {};
    if (!iwoId) throw new HttpsError('invalid-argument', 'iwoId is required.');

    const iwoRef = db.doc(`internal_work_orders/${iwoId}`);
    const iwoSnap0 = await iwoRef.get();
    if (!iwoSnap0.exists) throw new HttpsError('not-found', `IWO ${iwoId} not found.`);
    const sub = iwoSnap0.data().subsidiaryOrgId;
    await assertDeliveryLead(auth, sub);

    try {
      return await withIdempotency(
        db,
        { key: idempotencyKey, endpoint: 'startWorkOrder' },
        async (tx, recordCache) => {
          const snap = await tx.get(iwoRef);
          if (!snap.exists) throw new HttpsError('not-found', `IWO ${iwoId} not found.`);
          const iwo = snap.data();
          const to = nextState(iwo.state, 'start');
          tx.update(iwoRef, {
            state: to,
            startedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          const response = { id: iwoId, status: to };
          recordCache(response);
          return response;
        },
      );
    } catch (err) {
      throw toHttpsError(err);
    }
}

exports.runStartWorkOrder = runStartWorkOrder;
exports.startWorkOrder = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  (request) => runStartWorkOrder({ db: getFirestore(), auth: request.auth, data: request.data }),
);
