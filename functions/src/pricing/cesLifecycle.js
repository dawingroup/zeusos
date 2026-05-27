/**
 * CES (Cost Estimate Sheet) lifecycle — Phase 6.D server impl
 * (closes Addendum v1.1 §8 / change C7).
 *
 * Two CFns:
 *
 *   postCesLineItem(masterJobId, lineItem)
 *     Append a line item to master_jobs/{id}.ces.lineItems[].
 *     Bumps totalMinor + updatedAt. Rejected if ces.signedOff (the
 *     sheet is frozen — open a new line-removal CFn for changes,
 *     deferred to 6.D.2).
 *
 *   signOffCes(masterJobId)
 *     Freeze the sheet. Sets signedOff=true, signedOffByUserId,
 *     signedOffAt. After sign-off priceQuote enforces the floor.
 *
 * Auth: PARENT-org principal (Account-Mgmt / Finance). Per-AM
 * authorization (only the master job's accountManagerUserId can
 * sign off) is a 6.D.2 follow-up — for now any parent-org user can.
 *
 * No outbox events for CES line items (too granular). The downstream
 * QuoteSubFloorWarning (also 6.D.2) fires from priceQuote when the
 * client-facing total comes in below the CES-derived floor.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');

const { assertParentOrgPrincipal } = require('../assignment/lib/auth');
const { withIdempotency, toHttpsError } = require('../platform/idempotency');
const { ulid } = require('../platform/ulid');

async function runPostCesLineItem({ db, auth, data }) {
  const { uid } = await assertParentOrgPrincipal(auth);
  const { masterJobId, lineItem, idempotencyKey } = data || {};

  if (!masterJobId) throw new HttpsError('invalid-argument', 'masterJobId is required.');
  if (!lineItem || typeof lineItem !== 'object') {
    throw new HttpsError('invalid-argument', 'lineItem object is required.');
  }
  const { category, description, amountMinor, currency } = lineItem;
  if (!category) throw new HttpsError('invalid-argument', 'lineItem.category is required.');
  if (!description) throw new HttpsError('invalid-argument', 'lineItem.description is required.');
  if (typeof amountMinor !== 'number' || amountMinor < 0) {
    throw new HttpsError('invalid-argument', 'lineItem.amountMinor must be a non-negative number.');
  }
  if (!currency) throw new HttpsError('invalid-argument', 'lineItem.currency is required.');

  const mjRef = db.doc(`master_jobs/${masterJobId}`);

  try {
    return await withIdempotency(
      db,
      { key: idempotencyKey, endpoint: 'postCesLineItem' },
      async (tx, recordCache) => {
        const snap = await tx.get(mjRef);
        if (!snap.exists) throw new HttpsError('not-found', `MasterJob ${masterJobId} not found.`);
        const mj = snap.data();

        const existingCes = mj.ces || {
          lineItems: [],
          totalMinor: 0,
          currency,
          signedOff: false,
        };

        if (existingCes.signedOff) {
          throw new HttpsError(
            'failed-precondition',
            'CES is signed off — line items are frozen. Open a change-order CES instead.',
          );
        }

        // Currency must match the existing CES currency if any line items
        // exist, to avoid mixing UGX + USD totals.
        if (existingCes.lineItems.length > 0 && existingCes.currency !== currency) {
          throw new HttpsError(
            'invalid-argument',
            `Currency mismatch: existing CES is in ${existingCes.currency}, line item is ${currency}.`,
          );
        }

        const nowIso = new Date().toISOString();
        const fullLine = {
          id: lineItem.id || `cesli_${ulid()}`,
          category,
          description,
          quantity: lineItem.quantity || null,
          unit: lineItem.unit || null,
          amountMinor,
          currency,
          freelancerId: lineItem.freelancerId || null,
          supplierId: lineItem.supplierId || null,
          notes: lineItem.notes || null,
          addedBy: uid,
          addedAt: nowIso,
        };

        const newTotal = (existingCes.totalMinor || 0) + amountMinor;

        const nextCes = {
          lineItems: [...(existingCes.lineItems || []), fullLine],
          totalMinor: newTotal,
          currency,
          signedOff: false,
          marginFloorPct: existingCes.marginFloorPct,
          updatedAt: nowIso,
        };
        tx.update(mjRef, {
          ces: nextCes,
          updatedAt: nowIso,
        });

        const response = {
          masterJobId,
          lineItemId: fullLine.id,
          newTotalMinor: newTotal,
          currency,
        };
        recordCache(response);
        return response;
      },
    );
  } catch (err) {
    throw toHttpsError(err);
  }
}

async function runSignOffCes({ db, auth, data }) {
  const { uid } = await assertParentOrgPrincipal(auth);
  const { masterJobId, marginFloorPct, idempotencyKey } = data || {};

  if (!masterJobId) throw new HttpsError('invalid-argument', 'masterJobId is required.');

  const mjRef = db.doc(`master_jobs/${masterJobId}`);

  try {
    return await withIdempotency(
      db,
      { key: idempotencyKey, endpoint: 'signOffCes' },
      async (tx, recordCache) => {
        const snap = await tx.get(mjRef);
        if (!snap.exists) throw new HttpsError('not-found', `MasterJob ${masterJobId} not found.`);
        const mj = snap.data();

        const ces = mj.ces;
        if (!ces) {
          throw new HttpsError(
            'failed-precondition',
            'No CES on this master job — post line items first via postCesLineItem.',
          );
        }
        if (!Array.isArray(ces.lineItems) || ces.lineItems.length === 0) {
          throw new HttpsError(
            'failed-precondition',
            'CES has no line items — add ≥ 1 before signing off.',
          );
        }
        if (ces.signedOff) {
          // Idempotent path — sign-off is harmless to redo if the cache missed.
          return { masterJobId, signedOff: true, alreadySignedOff: true };
        }

        const nowIso = new Date().toISOString();
        const nextCes = {
          ...ces,
          signedOff: true,
          signedOffByUserId: uid,
          signedOffAt: nowIso,
          updatedAt: nowIso,
        };
        if (typeof marginFloorPct === 'number') {
          nextCes.marginFloorPct = marginFloorPct;
        }
        tx.update(mjRef, {
          ces: nextCes,
          updatedAt: nowIso,
        });

        const response = {
          masterJobId,
          signedOff: true,
          totalMinor: ces.totalMinor,
          currency: ces.currency,
          marginFloorPct: typeof marginFloorPct === 'number' ? marginFloorPct : (ces.marginFloorPct || null),
        };
        recordCache(response);
        return response;
      },
    );
  } catch (err) {
    throw toHttpsError(err);
  }
}

exports.runPostCesLineItem = runPostCesLineItem;
exports.runSignOffCes = runSignOffCes;

exports.postCesLineItem = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  (request) => runPostCesLineItem({ db: getFirestore(), auth: request.auth, data: request.data }),
);

exports.signOffCes = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  (request) => runSignOffCes({ db: getFirestore(), auth: request.auth, data: request.data }),
);
