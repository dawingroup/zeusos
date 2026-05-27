/**
 * SOW admin callables — spec §4.2 / §6.2 / §8.2.
 *
 *   upsertSow              (create + edit while DRAFT; AM only)
 *   submitSowForApproval   (DRAFT → PENDING_APPROVAL)
 *   approveSow             (PENDING_APPROVAL → ACTIVE; emits SowActivated)
 *   cancelSow              (any non-CLOSED → CANCELLED)
 *
 * SOWs sit under an ACTIVE MSA and carry the immovable budget ceiling.
 * Spec §8.2 — "No master job opens without an ACTIVE SOW." Raising the
 * ceiling later requires a ChangeOrder (`changeOrderAdmin.js`).
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');
const {
  assertParentOrgPrincipal,
  assertCommercialPrincipal,
  assertCommercialPrincipalForResource,
} = require('../assignment/lib/auth');
const { appendDomainEvent } = require('../platform/outbox');
const { ulid } = require('../platform/ulid');
const { generateCode } = require('./lib/codes');

const VALID_CURRENCIES = ['UGX', 'USD', 'KES', 'EUR', 'GBP'];
const VALID_TYPES = ['RETAINER', 'PROJECT'];

async function loadMsa(db, msaId) {
  const snap = await db.doc(`msas/${msaId}`).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', `MSA ${msaId} not found.`);
  }
  return { id: snap.id, ...snap.data() };
}

exports.upsertSow = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  async (request) => {
    const data = request.data || {};
    const {
      id,
      msaId,
      title,
      code,
      type,
      scopeDocRef,
      ceilingMinor,
      currency,
      startDate,
      endDate,
      briefTier,
    } = data;

    if (!msaId) throw new HttpsError('invalid-argument', 'msaId is required.');
    if (!title) throw new HttpsError('invalid-argument', 'title is required.');
    if (!type || !VALID_TYPES.includes(type)) {
      throw new HttpsError('invalid-argument', `type must be one of ${VALID_TYPES.join(', ')}.`);
    }
    if (!Number.isInteger(ceilingMinor) || ceilingMinor <= 0) {
      throw new HttpsError('invalid-argument', 'ceilingMinor must be a positive integer.');
    }
    if (!currency || !VALID_CURRENCIES.includes(currency)) {
      throw new HttpsError('invalid-argument', `currency must be one of ${VALID_CURRENCIES.join(', ')}.`);
    }

    const db = getFirestore();
    // ADR-2026-05-25 §2.Q2 — gate via the MSA's doc; resource-scoped
    // assert throws permission-denied for unauthorized callers even
    // when the MSA doesn't exist (preserves §7.4 boundary).
    const msaRef = db.doc(`msas/${msaId}`);
    const { uid, data: msa } = await assertCommercialPrincipalForResource(request.auth, msaRef);
    // SOWs can be drafted under a DRAFT MSA, but cannot be SUBMITTED for
    // approval until the MSA is ACTIVE. Enforced in `submitSowForApproval`.

    const sowId = id || `sow_${ulid()}`;
    const ref = db.doc(`sows/${sowId}`);
    const existing = await ref.get();
    if (existing.exists) {
      const prev = existing.data();
      if (prev.status && prev.status !== 'DRAFT') {
        throw new HttpsError(
          'failed-precondition',
          `SOW ${sowId} is ${prev.status}; only DRAFT SOWs can be edited.`,
        );
      }
    }

    const payload = {
      id: sowId,
      msaId,
      clientId: msa.clientId,
      title,
      code: code || generateCode('SOW', msa.code || msaId),
      type,
      scopeDocRef: scopeDocRef || null,
      ceilingMinor,
      currency,
      startDate: startDate || null,
      endDate: endDate || null,
      briefTier: briefTier || null,
      status: existing.exists ? existing.data().status : 'DRAFT',
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
    };
    if (!existing.exists) {
      payload.createdAt = FieldValue.serverTimestamp();
      payload.createdBy = uid;
    }
    await ref.set(payload, { merge: true });
    return { id: sowId, status: payload.status };
  },
);

exports.submitSowForApproval = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  async (request) => {
    const { sowId } = request.data || {};
    if (!sowId) throw new HttpsError('invalid-argument', 'sowId is required.');

    const db = getFirestore();
    const ref = db.doc(`sows/${sowId}`);

    // ADR-2026-05-25 §2.Q2 — resource-scoped assert.
    const { uid } = await assertCommercialPrincipalForResource(request.auth, ref);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError('not-found', `SOW ${sowId} not found.`);
      const sow = snap.data();
      if (sow.status !== 'DRAFT') {
        throw new HttpsError(
          'failed-precondition',
          `SOW ${sowId} is ${sow.status}; only DRAFT SOWs can be submitted.`,
        );
      }
      // Parent MSA must be ACTIVE.
      const msaSnap = await tx.get(db.doc(`msas/${sow.msaId}`));
      if (!msaSnap.exists || msaSnap.data().status !== 'ACTIVE') {
        throw new HttpsError(
          'failed-precondition',
          `Parent MSA ${sow.msaId} must be ACTIVE before submitting SOWs.`,
        );
      }
      tx.update(ref, {
        status: 'PENDING_APPROVAL',
        submittedForApprovalAt: FieldValue.serverTimestamp(),
        submittedForApprovalByUserId: uid,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
      });
      return { id: sowId, status: 'PENDING_APPROVAL' };
    });
  },
);

exports.approveSow = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  async (request) => {
    const { sowId } = request.data || {};
    if (!sowId) throw new HttpsError('invalid-argument', 'sowId is required.');

    const db = getFirestore();
    const ref = db.doc(`sows/${sowId}`);

    // ADR-2026-05-25 §2.Q2 — resource-scoped assert.
    const { uid } = await assertCommercialPrincipalForResource(request.auth, ref);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError('not-found', `SOW ${sowId} not found.`);
      const sow = snap.data();
      if (sow.status !== 'PENDING_APPROVAL') {
        throw new HttpsError(
          'failed-precondition',
          `SOW ${sowId} is ${sow.status}; only PENDING_APPROVAL SOWs can be approved.`,
        );
      }
      tx.update(ref, {
        status: 'ACTIVE',
        approvedByUserId: uid,
        approvedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
      });
      // Spec §10 — SowActivated event unlocks MasterJob creation (consumed
      // by openMasterJobOnQuoteAccepted indirectly via the SOW lookup).
      appendDomainEvent({
        tx, db,
        eventType: 'SowActivated',
        aggregateType: 'SOW',
        aggregateId: sowId,
        payload: {
          sowId,
          msaId: sow.msaId,
          clientId: sow.clientId,
          ceilingMinor: sow.ceilingMinor,
          currency: sow.currency,
          approvedByUserId: uid,
        },
        emittedByUserId: uid,
      });
      return { id: sowId, status: 'ACTIVE' };
    });
  },
);

exports.cancelSow = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  async (request) => {
    const { sowId, reason } = request.data || {};
    if (!sowId) throw new HttpsError('invalid-argument', 'sowId is required.');
    if (!reason || typeof reason !== 'string') {
      throw new HttpsError('invalid-argument', 'reason is required to cancel a SOW.');
    }
    const db = getFirestore();
    const ref = db.doc(`sows/${sowId}`);

    // ADR-2026-05-25 §2.Q2 — resource-scoped assert.
    const { uid } = await assertCommercialPrincipalForResource(request.auth, ref);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError('not-found', `SOW ${sowId} not found.`);
      const sow = snap.data();
      if (sow.status === 'CLOSED' || sow.status === 'CANCELLED') {
        throw new HttpsError(
          'failed-precondition',
          `SOW ${sowId} is ${sow.status}; cannot cancel.`,
        );
      }
      tx.update(ref, {
        status: 'CANCELLED',
        cancelledAt: FieldValue.serverTimestamp(),
        cancelledByUserId: uid,
        cancelReason: reason,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
      });
      return { id: sowId, status: 'CANCELLED' };
    });
  },
);
