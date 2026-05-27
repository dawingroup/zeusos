/**
 * ChangeOrder admin callables — spec §4.2 / §11.4.
 *
 *   upsertChangeOrder    (create + edit DRAFT COs; AM only)
 *   approveChangeOrder   (DRAFT → APPROVED; atomically applies deltaMinor
 *                         to the parent SOW's ceilingMinor)
 *   rejectChangeOrder    (DRAFT → REJECTED; reason required)
 *
 * Spec §11.4 — Mid-flight scope change:
 *   "A change order amends the SOW ceiling; the pricing engine produces a
 *    revised/added quote; new or enlarged work orders are issued.
 *    In-progress orders are never silently enlarged — the budget cap only
 *    moves through an approved change order."
 *
 * The atomicity guarantee is critical: the CO's `APPROVED` write and the
 * SOW's `ceilingMinor` adjustment happen in ONE Firestore transaction.
 * Concurrent CO approvals against the same SOW serialize through the
 * SOW doc.
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

exports.upsertChangeOrder = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  async (request) => {
    const data = request.data || {};
    const { id, sowId, code, deltaMinor, reason } = data;

    if (!sowId) throw new HttpsError('invalid-argument', 'sowId is required.');
    if (!Number.isInteger(deltaMinor) || deltaMinor === 0) {
      throw new HttpsError('invalid-argument', 'deltaMinor must be a non-zero integer.');
    }
    if (!reason || typeof reason !== 'string') {
      throw new HttpsError('invalid-argument', 'reason is required.');
    }

    const db = getFirestore();
    // ADR-2026-05-25 §2.Q2 — resource-scoped auth against the parent
    // SOW. `data` carries the SOW doc so we don't re-read.
    const sowRef = db.doc(`sows/${sowId}`);
    const { uid, data: sow } = await assertCommercialPrincipalForResource(request.auth, sowRef);
    if (sow.status !== 'ACTIVE') {
      throw new HttpsError(
        'failed-precondition',
        `Parent SOW must be ACTIVE to draft a change order (currently ${sow.status}).`,
      );
    }

    const coId = id || `co_${ulid()}`;
    const ref = db.doc(`change_orders/${coId}`);
    const existing = await ref.get();
    if (existing.exists && existing.data().status !== 'DRAFT') {
      throw new HttpsError(
        'failed-precondition',
        `ChangeOrder ${coId} is ${existing.data().status}; only DRAFT COs can be edited.`,
      );
    }

    const payload = {
      id: coId,
      sowId,
      clientId: sow.clientId,
      code: code || generateCode('CO', sow.code || sowId),
      deltaMinor,
      currency: sow.currency,
      reason,
      status: existing.exists ? existing.data().status : 'DRAFT',
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
    };
    if (!existing.exists) {
      payload.createdAt = FieldValue.serverTimestamp();
      payload.createdBy = uid;
    }
    await ref.set(payload, { merge: true });
    return { id: coId, status: payload.status };
  },
);

exports.approveChangeOrder = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  async (request) => {
    const { changeOrderId } = request.data || {};
    if (!changeOrderId) {
      throw new HttpsError('invalid-argument', 'changeOrderId is required.');
    }

    const db = getFirestore();
    const coRef = db.doc(`change_orders/${changeOrderId}`);

    // ADR-2026-05-25 §2.Q2 — resource-scoped assert.
    const { uid } = await assertCommercialPrincipalForResource(request.auth, coRef);

    return db.runTransaction(async (tx) => {
      const coSnap = await tx.get(coRef);
      if (!coSnap.exists) {
        throw new HttpsError('not-found', `ChangeOrder ${changeOrderId} not found.`);
      }
      const co = coSnap.data();
      if (co.status !== 'DRAFT') {
        throw new HttpsError(
          'failed-precondition',
          `ChangeOrder ${changeOrderId} is ${co.status}; only DRAFT COs can be approved.`,
        );
      }
      const sowRef = db.doc(`sows/${co.sowId}`);
      const sowSnap = await tx.get(sowRef);
      if (!sowSnap.exists) {
        throw new HttpsError('not-found', `Parent SOW ${co.sowId} not found.`);
      }
      const sow = sowSnap.data();
      if (sow.status !== 'ACTIVE') {
        throw new HttpsError(
          'failed-precondition',
          `Parent SOW ${co.sowId} is ${sow.status}; cannot apply CO.`,
        );
      }
      const newCeiling = (sow.ceilingMinor || 0) + co.deltaMinor;
      if (newCeiling <= 0) {
        throw new HttpsError(
          'failed-precondition',
          `Applying CO would reduce SOW ceiling to ${newCeiling}; ceiling must remain positive.`,
        );
      }

      // Apply atomically.
      tx.update(sowRef, {
        ceilingMinor: newCeiling,
        lastChangeOrderId: changeOrderId,
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.update(coRef, {
        status: 'APPROVED',
        approvedByUserId: uid,
        approvedAt: FieldValue.serverTimestamp(),
        appliedCeilingMinorAfter: newCeiling,
        updatedAt: FieldValue.serverTimestamp(),
      });
      // Push the new ceiling down onto every OPEN / DELIVERING master_job
      // for this SOW. The §11.1 headroom check on `issueWorkOrder` reads
      // `master_job.ceilingMinor`, so without this push the new headroom
      // never materialises.
      // NB: scan-then-update inside a txn is acceptable here because the
      // SOW typically has 0–3 master jobs in flight. If that grows we
      // promote this to a fanout task via outbox.
      // We can't do collection queries inside a Firestore transaction in
      // the Admin SDK without `tx.get(query)` — supported, so this is
      // safe.
      const mjQuery = db.collection('master_jobs')
        .where('sowId', '==', co.sowId);
      const mjSnap = await tx.get(mjQuery);
      mjSnap.forEach((doc) => {
        const mj = doc.data();
        if (mj.status === 'CLOSED' || mj.status === 'CANCELLED') return;
        tx.update(doc.ref, {
          ceilingMinor: (mj.ceilingMinor || 0) + co.deltaMinor,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      return {
        id: changeOrderId,
        status: 'APPROVED',
        appliedCeilingMinorAfter: newCeiling,
      };
    });
  },
);

exports.rejectChangeOrder = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  async (request) => {
    const { changeOrderId, reason } = request.data || {};
    if (!changeOrderId) {
      throw new HttpsError('invalid-argument', 'changeOrderId is required.');
    }
    if (!reason) {
      throw new HttpsError('invalid-argument', 'reason is required.');
    }
    const db = getFirestore();
    const ref = db.doc(`change_orders/${changeOrderId}`);

    // ADR-2026-05-25 §2.Q2 — resource-scoped assert.
    const { uid } = await assertCommercialPrincipalForResource(request.auth, ref);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError('not-found', `ChangeOrder ${changeOrderId} not found.`);
      const co = snap.data();
      if (co.status !== 'DRAFT') {
        throw new HttpsError(
          'failed-precondition',
          `ChangeOrder ${changeOrderId} is ${co.status}; only DRAFT COs can be rejected.`,
        );
      }
      tx.update(ref, {
        status: 'REJECTED',
        rejectedByUserId: uid,
        rejectedAt: FieldValue.serverTimestamp(),
        rejectionReason: reason,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { id: changeOrderId, status: 'REJECTED' };
    });
  },
);
