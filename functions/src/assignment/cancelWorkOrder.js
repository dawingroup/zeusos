/**
 * cancelWorkOrder — spec §6.1.1 / §11.5.
 *
 *   (any active) → CANCELLED   (AM authority)
 *
 * Behavior depends on whether work was already incurred:
 *   - cumulativeCostMinor == 0  → full release. BudgetHold HELD/LOCKED →
 *                                  RELEASED. No IC invoice.
 *   - cumulativeCostMinor > 0   → partial settle. The IWO's transfer-price
 *                                  share for incurred cost is computed
 *                                  pro-rata against the budget and IC-
 *                                  invoiced; remainder RELEASED.
 *
 * In both cases MasterJob.allocatedMinor is decremented by the released
 * portion so the freed budget becomes available for a re-issued IWO
 * (spec §11.5).
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');

const { assertParentOrgPrincipal, PARENT_ORG_ID } = require('./lib/auth');
const { withIdempotency, toHttpsError } = require('../platform/idempotency');
const { appendDomainEvent } = require('../platform/outbox');
const { nextState, isActive } = require('./lib/iwo-state-machine');
const budgetHold = require('./services/budget-hold.service');
const { raiseIcInvoice } = require('./services/intercompany.admin');

async function runCancelWorkOrder({ db, auth, data }) {
    const { uid } = await assertParentOrgPrincipal(auth);
    const { iwoId, reason, idempotencyKey } = data || {};
    if (!iwoId) throw new HttpsError('invalid-argument', 'iwoId is required.');
    if (!reason || typeof reason !== 'string') {
      throw new HttpsError('invalid-argument', 'reason is required.');
    }

    const iwoRef = db.doc(`internal_work_orders/${iwoId}`);

    try {
      return await withIdempotency(
        db,
        { key: idempotencyKey, endpoint: 'cancelWorkOrder' },
        async (tx, recordCache) => {
          const snap = await tx.get(iwoRef);
          if (!snap.exists) throw new HttpsError('not-found', `IWO ${iwoId} not found.`);
          const iwo = snap.data();
          if (!isActive(iwo.state)) {
            throw new HttpsError(
              'failed-precondition',
              `Cannot cancel IWO in state ${iwo.state}; only active IWOs may be cancelled.`,
            );
          }
          const to = nextState(iwo.state, 'cancel');

          const holdRef = db.collection('budget_holds').doc(iwo.budgetHoldId);
          const holdSnap = await tx.get(holdRef);

          const cumulative = iwo.cumulativeCostMinor || 0;
          let icId = null;
          let icAlreadyExisted = false;
          let settledMinor = 0;
          let releasedMinor = iwo.budgetMinor;

          if (cumulative > 0) {
            // §11.5 — partial settle. Compute pro-rata transfer price for
            // incurred cost. transferPrice / budget × cumulative.
            const proRataTransfer = Math.round(
              (iwo.transferPriceMinor * cumulative) / iwo.budgetMinor,
            );
            const ic = await raiseIcInvoice({
              tx, db,
              iwo,
              iwoId,
              amountMinor: proRataTransfer,
              isPartial: true,
              idempotencyKey,
            });
            icId = ic.id;
            icAlreadyExisted = ic.existed;

            const split = budgetHold.settlePartial({
              tx, db,
              holdId: iwo.budgetHoldId,
              holdSnap,
              settledMinor: cumulative, // budget-side settle = the slice spent
            });
            settledMinor = split.settledMinor;
            releasedMinor = split.releasedMinor;
          } else {
            budgetHold.release({ tx, db, holdId: iwo.budgetHoldId, holdSnap });
            settledMinor = 0;
            releasedMinor = iwo.budgetMinor;
          }

          // Decrement master_job.allocatedMinor by the released portion.
          const mjRef = db.doc(`master_jobs/${iwo.masterJobId}`);
          const mjSnap = await tx.get(mjRef);
          if (mjSnap.exists) {
            const prev = mjSnap.data().allocatedMinor || 0;
            tx.update(mjRef, {
              allocatedMinor: Math.max(0, prev - releasedMinor),
              updatedAt: FieldValue.serverTimestamp(),
            });
          }

          tx.update(iwoRef, {
            state: to,
            cancelledAt: FieldValue.serverTimestamp(),
            cancelledByUserId: uid,
            cancelReason: reason,
            interCompanyInvoiceId: icId,
            updatedAt: FieldValue.serverTimestamp(),
          });

          if (icId && !icAlreadyExisted) {
            appendDomainEvent({
              tx, db,
              eventType: 'InterCompanyInvoiceRaised',
              aggregateType: 'InterCompanyInvoice',
              aggregateId: icId,
              payload: {
                intercompanyInvoiceId: icId,
                iwoId,
                fromOrgId: iwo.subsidiaryOrgId,
                toOrgId: PARENT_ORG_ID,
                amountMinor: Math.round(
                  (iwo.transferPriceMinor * cumulative) / iwo.budgetMinor,
                ),
                currency: iwo.currency,
              },
              emittedByUserId: uid,
              idempotencyKey,
            });
          }

          const response = {
            id: iwoId,
            status: to,
            settledMinor,
            releasedMinor,
            interCompanyInvoiceId: icId,
          };
          recordCache(response);
          return response;
        },
      );
    } catch (err) {
      throw toHttpsError(err);
    }
}

exports.runCancelWorkOrder = runCancelWorkOrder;
exports.cancelWorkOrder = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  (request) => runCancelWorkOrder({ db: getFirestore(), auth: request.auth, data: request.data }),
);
