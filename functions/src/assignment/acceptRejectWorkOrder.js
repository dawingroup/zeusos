/**
 * acceptWorkOrder + rejectWorkOrder — spec §6.1.1 / §9.2.
 *
 * acceptWorkOrder(iwoId)            ISSUED → ACCEPTED
 *                                   BudgetHold HELD → LOCKED
 *                                   IWOAccepted event
 * rejectWorkOrder(iwoId, reason)    ISSUED → REJECTED
 *                                   BudgetHold HELD → RELEASED
 *                                   MasterJob.allocatedMinor -= IWO.budgetMinor
 *                                   IWORejected event
 *
 * Both require the caller to be a delivery lead of the receiving sub.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');

const { assertDeliveryLead } = require('./lib/auth');
const { withIdempotency, toHttpsError } = require('../platform/idempotency');
const { appendDomainEvent } = require('../platform/outbox');
const { nextState } = require('./lib/iwo-state-machine');
const budgetHold = require('./services/budget-hold.service');

async function runAcceptWorkOrder({ db, auth, data }) {
    const { iwoId, idempotencyKey } = data || {};
    if (!iwoId) throw new HttpsError('invalid-argument', 'iwoId is required.');

    const iwoRef = db.doc(`internal_work_orders/${iwoId}`);
    const iwoSnap0 = await iwoRef.get();
    if (!iwoSnap0.exists) throw new HttpsError('not-found', `IWO ${iwoId} not found.`);
    const sub = iwoSnap0.data().subsidiaryOrgId;
    const { uid } = await assertDeliveryLead(auth, sub);

    try {
      return await withIdempotency(
        db,
        { key: idempotencyKey, endpoint: 'acceptWorkOrder' },
        async (tx, recordCache) => {
          const snap = await tx.get(iwoRef);
          if (!snap.exists) throw new HttpsError('not-found', `IWO ${iwoId} not found.`);
          const iwo = snap.data();
          const to = nextState(iwo.state, 'accept'); // throws if illegal

          const holdRef = db.collection('budget_holds').doc(iwo.budgetHoldId);
          const holdSnap = await tx.get(holdRef);
          budgetHold.lock({ tx, db, holdId: iwo.budgetHoldId, holdSnap });

          tx.update(iwoRef, {
            state: to,
            acceptedByUserId: uid,
            acceptedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          appendDomainEvent({
            tx, db,
            eventType: 'IWOAccepted',
            aggregateType: 'IWO',
            aggregateId: iwoId,
            payload: { iwoId, acceptedByUserId: uid },
            emittedByUserId: uid,
            idempotencyKey,
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

async function runRejectWorkOrder({ db, auth, data }) {
    const { iwoId, reason, idempotencyKey } = data || {};
    if (!iwoId) throw new HttpsError('invalid-argument', 'iwoId is required.');
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      throw new HttpsError('invalid-argument', 'reason is required and must be non-empty.');
    }

    const iwoRef = db.doc(`internal_work_orders/${iwoId}`);
    const iwoSnap0 = await iwoRef.get();
    if (!iwoSnap0.exists) throw new HttpsError('not-found', `IWO ${iwoId} not found.`);
    const sub = iwoSnap0.data().subsidiaryOrgId;
    const { uid } = await assertDeliveryLead(auth, sub);

    try {
      return await withIdempotency(
        db,
        { key: idempotencyKey, endpoint: 'rejectWorkOrder' },
        async (tx, recordCache) => {
          const snap = await tx.get(iwoRef);
          if (!snap.exists) throw new HttpsError('not-found', `IWO ${iwoId} not found.`);
          const iwo = snap.data();
          const to = nextState(iwo.state, 'reject');

          const holdRef = db.collection('budget_holds').doc(iwo.budgetHoldId);
          const holdSnap = await tx.get(holdRef);
          budgetHold.release({ tx, db, holdId: iwo.budgetHoldId, holdSnap });

          // Decrement master_job.allocated_minor.
          const mjRef = db.doc(`master_jobs/${iwo.masterJobId}`);
          const mjSnap = await tx.get(mjRef);
          if (mjSnap.exists) {
            const prev = mjSnap.data().allocatedMinor || 0;
            tx.update(mjRef, {
              allocatedMinor: Math.max(0, prev - iwo.budgetMinor),
              updatedAt: FieldValue.serverTimestamp(),
            });
          }

          tx.update(iwoRef, {
            state: to,
            rejectedByUserId: uid,
            rejectedAt: FieldValue.serverTimestamp(),
            rejectionReason: reason,
            updatedAt: FieldValue.serverTimestamp(),
          });
          appendDomainEvent({
            tx, db,
            eventType: 'IWORejected',
            aggregateType: 'IWO',
            aggregateId: iwoId,
            payload: { iwoId, reason, rejectedByUserId: uid },
            emittedByUserId: uid,
            idempotencyKey,
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

exports.runAcceptWorkOrder = runAcceptWorkOrder;
exports.runRejectWorkOrder = runRejectWorkOrder;
exports.acceptWorkOrder = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  (request) => runAcceptWorkOrder({ db: getFirestore(), auth: request.auth, data: request.data }),
);
exports.rejectWorkOrder = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  (request) => runRejectWorkOrder({ db: getFirestore(), auth: request.auth, data: request.data }),
);
