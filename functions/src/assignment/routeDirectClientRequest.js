/**
 * routeDirectClientRequest — spec §7.4 Layer 3.
 *
 * The "subsidiary never quotes" boundary's workflow rule: when a
 * subsidiary receives a direct client request (deviation §5.1), the
 * ONLY available action is to hand it to Account Management. There is
 * no UI affordance or API path to answer the client with a price.
 *
 * This callable is what the subsidiary-side `RouteToAMButton` invokes.
 * It writes two things atomically in one transaction:
 *
 *   1. An intake item under
 *      `master_jobs/{masterJobId}/intake/{intakeId}` — a typed inbox
 *      row the AM dashboard renders (Phase 3.D / AM Intake Queue).
 *      When `masterJobId` isn't known yet (a brand-new client ask),
 *      the intake lands under `intake_unassigned/{intakeId}` instead
 *      and AM triages it onto a master job.
 *
 *   2. A `DirectClientRequestRouted` event in the outbox so downstream
 *      consumers (notifications, audit log, AM dashboard counters)
 *      pick it up.
 *
 * Anyone with subsidiary access can call this — the boundary rule is
 * the *opposite* of the pricing-admin rule: subsidiary users SHOULD be
 * able to route; parent-org users wouldn't normally need to (they own
 * client comms directly), but we don't reject them either, so an AM
 * actor logging a relayed request from elsewhere works too.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');

const { loadUserDoc } = require('./lib/auth');
const { withIdempotency, toHttpsError } = require('../platform/idempotency');
const { appendDomainEvent } = require('../platform/outbox');
const { ulid } = require('../platform/ulid');

async function runRouteDirectClientRequest({ db, auth, data }) {
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const {
    receivingSubsidiaryOrgId,
    routedToUserId,
    masterJobId,
    clientId,
    note,
    idempotencyKey,
  } = data || {};

  if (!receivingSubsidiaryOrgId || typeof receivingSubsidiaryOrgId !== 'string') {
    throw new HttpsError('invalid-argument', 'receivingSubsidiaryOrgId is required.');
  }
  if (!routedToUserId || typeof routedToUserId !== 'string') {
    throw new HttpsError('invalid-argument', 'routedToUserId is required.');
  }
  if (!clientId || typeof clientId !== 'string') {
    throw new HttpsError('invalid-argument', 'clientId is required.');
  }
  if (!note || typeof note !== 'string' || note.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'note is required and must be non-empty.');
  }
  // masterJobId is optional; when omitted, the intake is "unassigned".

  // Confirm the caller actually exists; we don't reject by role because
  // the boundary rule wants subsidiary users to be the primary callers.
  const user = await loadUserDoc(auth.uid);
  if (!user) {
    throw new HttpsError('permission-denied', 'Caller has no user profile.');
  }

  try {
    return await withIdempotency(
      db,
      { key: idempotencyKey, endpoint: 'routeDirectClientRequest' },
      async (tx, recordCache) => {
        const intakeId = `intake_${ulid()}`;
        const intakeDocPath = masterJobId
          ? `master_jobs/${masterJobId}/intake/${intakeId}`
          : `intake_unassigned/${intakeId}`;
        const intakeRef = db.doc(intakeDocPath);

        tx.set(intakeRef, {
          id: intakeId,
          source: 'DIRECT_CLIENT_REQUEST',
          receivingSubsidiaryOrgId,
          routedToUserId,
          routedByUserId: auth.uid,
          clientId,
          masterJobId: masterJobId || null,
          note: note.trim(),
          status: 'PENDING_AM_REVIEW',
          createdAt: FieldValue.serverTimestamp(),
        });

        appendDomainEvent({
          tx, db,
          eventType: 'DirectClientRequestRouted',
          aggregateType: 'MasterJob',
          aggregateId: masterJobId || clientId,
          payload: {
            receivingSubsidiaryOrgId,
            routedToUserId,
            masterJobId: masterJobId || undefined,
            clientId,
            note: note.trim(),
          },
          emittedByUserId: auth.uid,
          idempotencyKey,
        });

        const response = { intakeId };
        recordCache(response);
        return response;
      },
    );
  } catch (err) {
    throw toHttpsError(err);
  }
}

exports.runRouteDirectClientRequest = runRouteDirectClientRequest;
exports.routeDirectClientRequest = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  (request) =>
    runRouteDirectClientRequest({
      db: getFirestore(),
      auth: request.auth,
      data: request.data,
    }),
);
