/**
 * MSA admin callables — spec §4.2.
 *
 *   upsertMsa    (create + edit while DRAFT; AM only)
 *   activateMsa  (DRAFT → ACTIVE; signed terms now binding for new SOWs)
 *
 * MSAs are the umbrella legal agreement; SOWs cannot be created without an
 * ACTIVE MSA. Status machine: DRAFT → ACTIVE → (EXPIRED | TERMINATED).
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');
const {
  assertParentOrgPrincipal,
  assertCommercialPrincipal,
  assertCommercialPrincipalForResource,
} = require('../assignment/lib/auth');
const { ulid } = require('../platform/ulid');
const { generateCode } = require('./lib/codes');

const PARENT_ORG_ID = 'zeus-group';

async function loadClient(db, clientId) {
  const snap = await db.doc(`clients/${clientId}`).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', `Client ${clientId} not found.`);
  }
  return { id: snap.id, ...snap.data() };
}

exports.upsertMsa = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  async (request) => {
    const data = request.data || {};
    const {
      id,
      clientId,
      title,
      code,
      agreementDocRef,
      effectiveFrom,
      effectiveTo,
      hasNda,
      signedByClientName,
      signedByClientAt,
      signedByParentUserId,
      signedByParentAt,
    } = data;

    if (!clientId) throw new HttpsError('invalid-argument', 'clientId is required.');
    // ADR-2026-05-25 §2.Q2 — gate on home brand of `clientId` OR parent-org.
    // assertCommercialPrincipal does the client lookup + brand check.
    const { uid } = await assertCommercialPrincipal(request.auth, clientId);
    if (!title) throw new HttpsError('invalid-argument', 'title is required.');
    if (!effectiveFrom) {
      throw new HttpsError('invalid-argument', 'effectiveFrom (ISO date) is required.');
    }

    const db = getFirestore();
    const client = await loadClient(db, clientId);

    const msaId = id || `msa_${ulid()}`;
    const ref = db.doc(`msas/${msaId}`);
    const existing = await ref.get();
    if (existing.exists) {
      const prev = existing.data();
      if (prev.status && prev.status !== 'DRAFT') {
        throw new HttpsError(
          'failed-precondition',
          `MSA ${msaId} is ${prev.status}; only DRAFT MSAs can be edited.`,
        );
      }
    }

    const payload = {
      id: msaId,
      clientId,
      parentOrgId: PARENT_ORG_ID,
      title,
      code: code || generateCode('MSA', client.code || client.name),
      agreementDocRef: agreementDocRef || null,
      effectiveFrom,
      effectiveTo: effectiveTo || null,
      hasNda: !!hasNda,
      signedByClientName: signedByClientName || null,
      signedByClientAt: signedByClientAt || null,
      signedByParentUserId: signedByParentUserId || null,
      signedByParentAt: signedByParentAt || null,
      status: existing.exists ? existing.data().status : 'DRAFT',
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
    };
    if (!existing.exists) {
      payload.createdAt = FieldValue.serverTimestamp();
      payload.createdBy = uid;
    }
    await ref.set(payload, { merge: true });
    return { id: msaId, status: payload.status };
  },
);

exports.activateMsa = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  async (request) => {
    const { msaId } = request.data || {};
    if (!msaId) throw new HttpsError('invalid-argument', 'msaId is required.');

    const db = getFirestore();
    const ref = db.doc(`msas/${msaId}`);

    // ADR-2026-05-25 §2.Q2 — resource-scoped auth. Tries parent-org
    // first (cheap), falls through to brand-direct via the doc's
    // clientId. Throws permission-denied for unauthorized callers
    // even when the doc doesn't exist (don't leak existence).
    const { uid } = await assertCommercialPrincipalForResource(request.auth, ref);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError('not-found', `MSA ${msaId} not found.`);
      const msa = snap.data();
      if (msa.status !== 'DRAFT') {
        throw new HttpsError(
          'failed-precondition',
          `MSA ${msaId} is ${msa.status}; only DRAFT MSAs can be activated.`,
        );
      }
      tx.update(ref, {
        status: 'ACTIVE',
        activatedAt: FieldValue.serverTimestamp(),
        activatedByUserId: uid,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
      });
      return { id: msaId, status: 'ACTIVE' };
    });
  },
);
