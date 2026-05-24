/**
 * advanceApprovalRung + rejectApprovalRung — Phase 6.D CFns
 * (Addendum v1.1 §7 / change C5).
 *
 *   advanceApprovalRung(iwoId, idempotencyKey?)
 *     Moves the IWO's approvalChain.currentRung to the next ladder
 *     position. On terminal rung, sets `complete=true` and emits
 *     InternalApprovalGranted; otherwise emits ApprovalRungAdvanced.
 *
 *   rejectApprovalRung(iwoId, notes, idempotencyKey?)
 *     Reverts approvalChain.currentRung to ladder[0]. Preserves
 *     history so the rejection loop is observable for cycle-time
 *     analytics. Emits ApprovalRungRejected.
 *
 * Both delegate to advanceRung / rejectRung in services/approval-
 * ladder.service.js (the pure-Firestore logic with transaction support).
 *
 * Auth: PARENT-org principal (Account-Mgmt / Traffic). Per-rung RBAC
 * enforcement (only ECDs can approve the ECD rung, etc.) joins through
 * the role_assignment + role_profile collections from Phase 6.A and
 * lands in Phase 6.D.2 follow-up. For 6.D the gate is parent-org only.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');

const { assertParentOrgPrincipal } = require('./lib/auth');
const { withIdempotency, toHttpsError } = require('../platform/idempotency');
const { advanceRung, rejectRung } = require('./services/approval-ladder.service');

async function runAdvanceApprovalRung({ db, auth, data }) {
  const { uid } = await assertParentOrgPrincipal(auth);
  const { iwoId, actorRoleProfileId, idempotencyKey } = data || {};
  if (!iwoId) throw new HttpsError('invalid-argument', 'iwoId is required.');

  const iwoRef = db.doc(`internal_work_orders/${iwoId}`);

  try {
    return await withIdempotency(
      db,
      { key: idempotencyKey, endpoint: 'advanceApprovalRung' },
      async (tx, recordCache) => {
        const result = await advanceRung({
          tx, db, iwoRef,
          actorUserId: uid,
          actorRoleProfileId: actorRoleProfileId || null,
          nowIso: new Date().toISOString(),
        });
        const response = {
          id: iwoId,
          rung: result.rung,
          terminal: result.terminal,
        };
        recordCache(response);
        return response;
      },
    );
  } catch (err) {
    throw toHttpsError(err);
  }
}

async function runRejectApprovalRung({ db, auth, data }) {
  const { uid } = await assertParentOrgPrincipal(auth);
  const { iwoId, notes, actorRoleProfileId, idempotencyKey } = data || {};
  if (!iwoId) throw new HttpsError('invalid-argument', 'iwoId is required.');
  if (!notes || typeof notes !== 'string' || !notes.trim()) {
    throw new HttpsError('invalid-argument', 'notes is required for a rejection.');
  }

  const iwoRef = db.doc(`internal_work_orders/${iwoId}`);

  try {
    return await withIdempotency(
      db,
      { key: idempotencyKey, endpoint: 'rejectApprovalRung' },
      async (tx, recordCache) => {
        const result = await rejectRung({
          tx, db, iwoRef,
          actorUserId: uid,
          actorRoleProfileId: actorRoleProfileId || null,
          notes,
          nowIso: new Date().toISOString(),
        });
        const response = {
          id: iwoId,
          rejectingRung: result.rejectingRung,
          returnedToRung: result.returnedToRung,
          loopCount: result.loopCount,
        };
        recordCache(response);
        return response;
      },
    );
  } catch (err) {
    throw toHttpsError(err);
  }
}

exports.runAdvanceApprovalRung = runAdvanceApprovalRung;
exports.runRejectApprovalRung = runRejectApprovalRung;

exports.advanceApprovalRung = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  (request) => runAdvanceApprovalRung({ db: getFirestore(), auth: request.auth, data: request.data }),
);

exports.rejectApprovalRung = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  (request) => runRejectApprovalRung({ db: getFirestore(), auth: request.auth, data: request.data }),
);
