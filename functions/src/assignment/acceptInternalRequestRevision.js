/**
 * acceptInternal + requestRevision — spec §6.1.1 / §11.10.
 *
 *   acceptInternal(iwoId)
 *     DELIVERED → ACCEPTED_INTERNALLY
 *     Guard: every required acceptance criterion has `signedByUserId` set
 *     (signed by an AM user). AM-only authority.
 *
 *   requestRevision(iwoId, criteriaFailures[])
 *     DELIVERED → IN_PROGRESS
 *     AM-only. Sends the IWO back to delivery; required criteria stay
 *     marked unsigned. `criteriaFailures` is a list of criterion ids
 *     that were rejected, stored on the IWO for the delivery side to read.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');

const { assertParentOrgPrincipal } = require('./lib/auth');
const { withIdempotency, toHttpsError } = require('../platform/idempotency');
const { nextState } = require('./lib/iwo-state-machine');

async function runAcceptInternal({ db, auth, data }) {
    const { uid } = await assertParentOrgPrincipal(auth);
    const { iwoId, idempotencyKey } = data || {};
    if (!iwoId) throw new HttpsError('invalid-argument', 'iwoId is required.');

    const iwoRef = db.doc(`internal_work_orders/${iwoId}`);

    try {
      return await withIdempotency(
        db,
        { key: idempotencyKey, endpoint: 'acceptInternal' },
        async (tx, recordCache) => {
          const snap = await tx.get(iwoRef);
          if (!snap.exists) throw new HttpsError('not-found', `IWO ${iwoId} not found.`);
          const iwo = snap.data();
          const to = nextState(iwo.state, 'accept_internal');

          // Verify all required acceptance criteria are signed.
          const packetRef = db.doc(`internal_work_orders/${iwoId}/handoff_packet/packet`);
          const packetSnap = await tx.get(packetRef);
          if (!packetSnap.exists) {
            throw new HttpsError('failed-precondition', 'Handoff packet missing — cannot accept_internal.');
          }
          const packet = packetSnap.data();
          const requiredUnsigned = (packet.acceptanceCriteria || []).filter(
            (c) => c && c.required === true && !c.signedByUserId,
          );
          if (requiredUnsigned.length > 0) {
            throw new HttpsError(
              'failed-precondition',
              `acceptInternal blocked: ${requiredUnsigned.length} required acceptance criteria not yet signed.`,
              { unsignedIds: requiredUnsigned.map((c) => c.id) },
            );
          }

          tx.update(iwoRef, {
            state: to,
            acceptedInternallyByUserId: uid,
            acceptedInternallyAt: FieldValue.serverTimestamp(),
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

async function runRequestRevision({ db, auth, data }) {
    const { uid } = await assertParentOrgPrincipal(auth);
    const { iwoId, criteriaFailures, idempotencyKey } = data || {};
    if (!iwoId) throw new HttpsError('invalid-argument', 'iwoId is required.');
    if (!Array.isArray(criteriaFailures) || criteriaFailures.length === 0) {
      throw new HttpsError('invalid-argument', 'criteriaFailures[] must contain ≥1 criterion id.');
    }

    const iwoRef = db.doc(`internal_work_orders/${iwoId}`);

    try {
      return await withIdempotency(
        db,
        { key: idempotencyKey, endpoint: 'requestRevision' },
        async (tx, recordCache) => {
          const snap = await tx.get(iwoRef);
          if (!snap.exists) throw new HttpsError('not-found', `IWO ${iwoId} not found.`);
          const iwo = snap.data();
          const to = nextState(iwo.state, 'request_revision');

          // Unsign any matching criteria — keeps the AM ↔ delivery loop honest.
          const packetRef = db.doc(`internal_work_orders/${iwoId}/handoff_packet/packet`);
          const packetSnap = await tx.get(packetRef);
          if (packetSnap.exists) {
            const packet = packetSnap.data();
            const updated = (packet.acceptanceCriteria || []).map((c) => {
              if (c && criteriaFailures.indexOf(c.id) !== -1) {
                const { signedByUserId: _drop1, signedAt: _drop2, ...rest } = c;
                return { ...rest };
              }
              return c;
            });
            tx.update(packetRef, {
              acceptanceCriteria: updated,
              updatedAt: FieldValue.serverTimestamp(),
            });
          }

          tx.update(iwoRef, {
            state: to,
            lastRevisionRequestedAt: FieldValue.serverTimestamp(),
            lastRevisionRequestedBy: uid,
            lastRevisionFailures: criteriaFailures,
            updatedAt: FieldValue.serverTimestamp(),
          });
          const response = { id: iwoId, status: to, failures: criteriaFailures };
          recordCache(response);
          return response;
        },
      );
    } catch (err) {
      throw toHttpsError(err);
    }
}

exports.runAcceptInternal = runAcceptInternal;
exports.runRequestRevision = runRequestRevision;
exports.acceptInternal = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  (request) => runAcceptInternal({ db: getFirestore(), auth: request.auth, data: request.data }),
);
exports.requestRevision = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  (request) => runRequestRevision({ db: getFirestore(), auth: request.auth, data: request.data }),
);
