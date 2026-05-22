/**
 * cancelWorkOrder — spec §6.1.1 / §11.5 / §11.9.
 *
 *   (any active) → CANCELLED   (AM authority)
 *
 * Behavior depends on whether work was already incurred AND on the
 * receiving subsidiary's legal status:
 *
 *   - cumulativeCostMinor == 0  → full release. BudgetHold HELD/LOCKED →
 *                                  RELEASED. No settlement record.
 *   - cumulativeCostMinor > 0   → partial settle. The IWO's transfer-
 *                                  price share for incurred cost is
 *                                  computed pro-rata against the budget
 *                                  and recorded as:
 *                                    is_legal_entity=true (default) →
 *                                      partial IC invoice + IC event.
 *                                    is_legal_entity=false (§11.9) →
 *                                      partial cost_allocation + Intra-
 *                                      Entity event.
 *                                  Remainder RELEASED in either case.
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
const { recordCostAllocation } = require('./services/cost-allocation.admin');

async function readSubsidiaryIsLegalEntity(tx, db, subsidiaryOrgId) {
  const orgRef = db.doc(`organizations/${subsidiaryOrgId}`);
  const orgSnap = await tx.get(orgRef);
  if (!orgSnap.exists) return true;
  const flag = orgSnap.data().is_legal_entity;
  return flag !== false;
}

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
          let settlementId = null;
          let settlementExisted = false;
          let settlementKind = null;
          let settledMinor = 0;
          let releasedMinor = iwo.budgetMinor;

          if (cumulative > 0) {
            // §11.5 — partial settle. Compute pro-rata transfer price for
            // incurred cost. transferPrice / budget × cumulative.
            const proRataTransfer = Math.round(
              (iwo.transferPriceMinor * cumulative) / iwo.budgetMinor,
            );

            // §11.9 — branch on sub.is_legal_entity inside the txn.
            const isLegalEntity = await readSubsidiaryIsLegalEntity(
              tx, db, iwo.subsidiaryOrgId,
            );
            if (isLegalEntity) {
              const ic = await raiseIcInvoice({
                tx, db,
                iwo,
                iwoId,
                amountMinor: proRataTransfer,
                isPartial: true,
                idempotencyKey,
              });
              settlementId = ic.id;
              settlementExisted = ic.existed;
              settlementKind = 'INTER_COMPANY_INVOICE';
            } else {
              const ca = await recordCostAllocation({
                tx, db,
                iwo,
                iwoId,
                amountMinor: proRataTransfer,
                isPartial: true,
                idempotencyKey,
              });
              settlementId = ca.id;
              settlementExisted = ca.existed;
              settlementKind = 'INTRA_ENTITY_ALLOCATION';
            }

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
            // Mirror closeWorkOrder's denormalised shape — exactly one
            // of the two settlement-id fields is non-null when a partial
            // settlement happened; both null on full-release cancels.
            interCompanyInvoiceId:
              settlementKind === 'INTER_COMPANY_INVOICE' ? settlementId : null,
            costAllocationId:
              settlementKind === 'INTRA_ENTITY_ALLOCATION' ? settlementId : null,
            settlementKind,
            updatedAt: FieldValue.serverTimestamp(),
          });

          if (settlementId && !settlementExisted) {
            const proRataTransfer = Math.round(
              (iwo.transferPriceMinor * cumulative) / iwo.budgetMinor,
            );
            if (settlementKind === 'INTER_COMPANY_INVOICE') {
              appendDomainEvent({
                tx, db,
                eventType: 'InterCompanyInvoiceRaised',
                aggregateType: 'InterCompanyInvoice',
                aggregateId: settlementId,
                payload: {
                  intercompanyInvoiceId: settlementId,
                  iwoId,
                  fromOrgId: iwo.subsidiaryOrgId,
                  toOrgId: PARENT_ORG_ID,
                  amountMinor: proRataTransfer,
                  currency: iwo.currency,
                },
                emittedByUserId: uid,
                idempotencyKey,
              });
            } else {
              appendDomainEvent({
                tx, db,
                eventType: 'IntraEntityCostAllocated',
                aggregateType: 'CostAllocation',
                aggregateId: settlementId,
                payload: {
                  costAllocationId: settlementId,
                  iwoId,
                  subsidiaryOrgId: iwo.subsidiaryOrgId,
                  amountMinor: proRataTransfer,
                  currency: iwo.currency,
                },
                emittedByUserId: uid,
                idempotencyKey,
              });
            }
          }

          const response = {
            id: iwoId,
            status: to,
            settledMinor,
            releasedMinor,
            settlementKind,
            interCompanyInvoiceId:
              settlementKind === 'INTER_COMPANY_INVOICE' ? settlementId : null,
            costAllocationId:
              settlementKind === 'INTRA_ENTITY_ALLOCATION' ? settlementId : null,
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
