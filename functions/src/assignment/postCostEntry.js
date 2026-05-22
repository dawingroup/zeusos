/**
 * postCostEntry — spec §4.4 / §6.1.1 / §11.2.
 *
 *   POST /v1/work-orders/{iwoId}/cost-entries
 *   { kind ∈ {VENDOR,MEDIA_SPEND,EXPENSE}, amount, isPassThrough }
 *
 * Same burn check + threshold-cross handling as `postTimeEntry`. `amount`
 * is provided directly (no rate-card lookup); pass-through costs (e.g.
 * media spend re-billed at cost) still count toward the IWO budget cap
 * unless the caller flags them — the spec leaves cap behavior on
 * pass-through implementation-defined, so we err on the side of safety
 * and include them in cumulative.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');

const { assertSubsidiaryAccessOrParent } = require('./lib/auth');
const { withIdempotency, toHttpsError } = require('../platform/idempotency');
const { appendDomainEvent } = require('../platform/outbox');
const { burnCheck } = require('./lib/burn-check');
const { ulid } = require('../platform/ulid');

const COST_KINDS = new Set(['VENDOR', 'MEDIA_SPEND', 'EXPENSE']);

async function runPostCostEntry({ db, auth, data }) {
    const { iwoId, kind, amount, isPassThrough, idempotencyKey, description } = data || {};
    if (!iwoId) throw new HttpsError('invalid-argument', 'iwoId is required.');
    if (!COST_KINDS.has(kind)) {
      throw new HttpsError('invalid-argument', `kind must be one of ${[...COST_KINDS].join(',')}.`);
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new HttpsError('invalid-argument', 'amount must be a positive integer (minor units).');
    }

    const iwoRef = db.doc(`internal_work_orders/${iwoId}`);
    const iwoSnap0 = await iwoRef.get();
    if (!iwoSnap0.exists) throw new HttpsError('not-found', `IWO ${iwoId} not found.`);
    await assertSubsidiaryAccessOrParent(auth, iwoSnap0.data().subsidiaryOrgId);

    try {
      return await withIdempotency(
        db,
        { key: idempotencyKey, endpoint: 'postCostEntry' },
        async (tx, recordCache) => {
          const snap = await tx.get(iwoRef);
          if (!snap.exists) throw new HttpsError('not-found', `IWO ${iwoId} not found.`);
          const iwo = snap.data();
          if (iwo.state !== 'IN_PROGRESS') {
            throw new HttpsError(
              'failed-precondition',
              `Cannot post cost on IWO in state ${iwo.state}. Must be IN_PROGRESS.`,
            );
          }

          const check = burnCheck({
            previousCumulativeMinor: iwo.cumulativeCostMinor || 0,
            entryAmountMinor: amount,
            budgetMinor: iwo.budgetMinor,
            thresholdAlreadyCrossed80: !!iwo.thresholdCrossed80,
          });
          if (!check.ok) {
            const err = new Error(check.error.message);
            err.code = check.error.code;
            err.details = check.error.details;
            throw err;
          }

          const ceId = `ce_${ulid()}`;
          const ceRef = db.doc(`internal_work_orders/${iwoId}/cost_entries/${ceId}`);
          tx.set(ceRef, {
            id: ceId,
            iwoId,
            kind,
            amountMinor: amount,
            isPassThrough: !!isPassThrough,
            description: description || null,
            postedByUserId: auth.uid,
            createdAt: FieldValue.serverTimestamp(),
          });

          const iwoUpdate = {
            cumulativeCostMinor: check.newCumulative,
            updatedAt: FieldValue.serverTimestamp(),
          };
          if (check.crossed80) iwoUpdate.thresholdCrossed80 = true;
          if (check.crossed100) iwoUpdate.thresholdCrossed100 = true;
          tx.update(iwoRef, iwoUpdate);

          if (check.crossed80) {
            appendDomainEvent({
              tx, db,
              eventType: 'BudgetThresholdCrossed',
              aggregateType: 'IWO',
              aggregateId: iwoId,
              payload: {
                iwoId,
                thresholdPct: 80,
                cumulativeMinor: check.newCumulative,
                budgetMinor: iwo.budgetMinor,
              },
              emittedByUserId: auth.uid,
              idempotencyKey,
            });
          }
          if (check.crossed100) {
            appendDomainEvent({
              tx, db,
              eventType: 'BudgetThresholdCrossed',
              aggregateType: 'IWO',
              aggregateId: iwoId,
              payload: {
                iwoId,
                thresholdPct: 100,
                cumulativeMinor: check.newCumulative,
                budgetMinor: iwo.budgetMinor,
              },
              emittedByUserId: auth.uid,
              idempotencyKey,
            });
          }

          const response = {
            id: ceId,
            amountMinor: amount,
            cumulativeMinor: check.newCumulative,
            budgetMinor: iwo.budgetMinor,
          };
          recordCache(response);
          return response;
        },
      );
    } catch (err) {
      throw toHttpsError(err);
    }
}

exports.runPostCostEntry = runPostCostEntry;
exports.postCostEntry = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  (request) => runPostCostEntry({ db: getFirestore(), auth: request.auth, data: request.data }),
);
