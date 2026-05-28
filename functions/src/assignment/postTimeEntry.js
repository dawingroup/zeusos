/**
 * postTimeEntry — spec §6.1.1 / §9.3 / §11.2 / §11.8.
 *
 *   POST /v1/work-orders/{iwoId}/time-entries
 *   { userId, minutes, entryDate }
 *
 *   201 → { id, costMinor, cumulativeMinor, budgetMinor }
 *   422 → BUDGET_EXCEEDED if cumulative > budget
 *
 * Cost = minutes × rate, where rate is resolved against the rate-card
 * version pinned at quote-accept time (spec §11.8). Hard block at 100% of
 * budget; soft event at 80% (BudgetThresholdCrossed).
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');

const { assertSubsidiaryAccessOrParent } = require('./lib/auth');
const { withIdempotency, toHttpsError } = require('../platform/idempotency');
const { appendDomainEvent } = require('../platform/outbox');
const { burnCheck } = require('./lib/burn-check');
const { resolveTimeEntryCost } = require('./lib/rate-pinning');
const { ulid } = require('../platform/ulid');

async function runPostTimeEntry({ db, auth, data }) {
    const { iwoId, userId, minutes, entryDate, idempotencyKey } = data || {};
    if (!iwoId) throw new HttpsError('invalid-argument', 'iwoId is required.');
    if (!userId) throw new HttpsError('invalid-argument', 'userId is required.');
    if (!Number.isInteger(minutes) || minutes <= 0) {
      throw new HttpsError('invalid-argument', 'minutes must be a positive integer.');
    }
    if (!entryDate) throw new HttpsError('invalid-argument', 'entryDate is required.');

    const iwoRef = db.doc(`internal_work_orders/${iwoId}`);
    const iwoSnap0 = await iwoRef.get();
    if (!iwoSnap0.exists) throw new HttpsError('not-found', `IWO ${iwoId} not found.`);
    const iwo0 = iwoSnap0.data();
    await assertSubsidiaryAccessOrParent(auth, iwo0.subsidiaryOrgId);

    // Pre-compute cost outside the txn (uses queries that don't compose
    // with `runTransaction` reads — rate cards rarely change mid-txn).
    let quote = null;
    if (iwo0.quoteId) {
      const qs = await db.doc(`quotes/${iwo0.quoteId}`).get();
      quote = qs.exists ? qs.data() : null;
    }
    let cost;
    try {
      cost = await resolveTimeEntryCost({
        iwo: iwo0,
        quote,
        userId,
        minutes,
      });
    } catch (err) {
      throw new HttpsError('failed-precondition', err.message || String(err));
    }

    try {
      return await withIdempotency(
        db,
        { key: idempotencyKey, endpoint: 'postTimeEntry' },
        async (tx, recordCache) => {
          const snap = await tx.get(iwoRef);
          if (!snap.exists) throw new HttpsError('not-found', `IWO ${iwoId} not found.`);
          const iwo = snap.data();
          if (iwo.state !== 'IN_PROGRESS') {
            throw new HttpsError(
              'failed-precondition',
              `Cannot post time on IWO in state ${iwo.state}. Must be IN_PROGRESS.`,
            );
          }

          const check = burnCheck({
            previousCumulativeMinor: iwo.cumulativeCostMinor || 0,
            entryAmountMinor: cost.costMinor,
            budgetMinor: iwo.budgetMinor,
            thresholdAlreadyCrossed80: !!iwo.thresholdCrossed80,
          });
          if (!check.ok) {
            const err = new Error(check.error.message);
            err.code = check.error.code;
            err.details = check.error.details;
            throw err;
          }

          const teId = `te_${ulid()}`;
          const teRef = db.doc(`internal_work_orders/${iwoId}/time_entries/${teId}`);
          tx.set(teRef, {
            id: teId,
            iwoId,
            userId,
            minutes,
            costMinor: cost.costMinor,
            roleCode: cost.roleCode,
            rateCardId: cost.rateCardId,
            rateCardLineId: cost.rateCardLineId,
            entryDate,
            // Denormalised from the parent IWO so the brand-scoped
            // team-time view (Phase 5.D depth) can run a collection-group
            // query filtered by `subsidiaryOrgId` without a per-doc
            // get() in rules (which would blow the 20-access-call limit
            // on a large collection-group query). The firestore.rules
            // read clause matches this field directly.
            subsidiaryOrgId: iwo.subsidiaryOrgId,
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
            id: teId,
            costMinor: cost.costMinor,
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

exports.runPostTimeEntry = runPostTimeEntry;
exports.postTimeEntry = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  (request) => runPostTimeEntry({ db: getFirestore(), auth: request.auth, data: request.data }),
);
