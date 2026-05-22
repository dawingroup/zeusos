/**
 * closeWorkOrder — spec §6.1.1 / §8.3 / §11.7 / §11.9.
 *
 *   ACCEPTED_INTERNALLY → CLOSED
 *   - BudgetHold LOCKED → SETTLED
 *   - Settlement path depends on the receiving subsidiary's legal
 *     status (`organizations/{subId}.is_legal_entity`):
 *
 *       is_legal_entity === true  (default):
 *         Raise Inter-Company Invoice at `transferPriceMinor`
 *         (deterministic doc id `ic_${iwoId}` → spec §4.5 UNIQUE
 *         iwo_id; concurrent retries collide on the same key).
 *         Emit IWOClosed + InterCompanyInvoiceRaised.
 *
 *       is_legal_entity === false (spec §11.9):
 *         Record an intra-entity cost allocation at
 *         `cost_allocations/ca_${iwoId}`. No IC invoice — the cost
 *         and revenue belong to one set of books. Emit IWOClosed +
 *         IntraEntityCostAllocated.
 *
 * Idempotent at the endpoint level (cached response on duplicate
 * Idempotency-Key) AND at the settlement-doc level (UNIQUE iwo_id on
 * both `intercompany_invoices` and `cost_allocations`). The §11.7
 * duplicate-billing test covers the IC path; §11.9 covers the
 * allocation path.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');

const { assertParentOrgPrincipal } = require('./lib/auth');
const { withIdempotency, toHttpsError } = require('../platform/idempotency');
const { appendDomainEvent } = require('../platform/outbox');
const { nextState } = require('./lib/iwo-state-machine');
const budgetHold = require('./services/budget-hold.service');
const { raiseIcInvoice, IC_INVOICES } = require('./services/intercompany.admin');
const { recordCostAllocation } = require('./services/cost-allocation.admin');
const { PARENT_ORG_ID } = require('./lib/auth');

/**
 * Returns true if the receiving sub is configured as a separate legal
 * entity (the default). Missing `is_legal_entity` is treated as true
 * to preserve pre-§11.9 behavior for orgs that haven't been migrated.
 */
async function readSubsidiaryIsLegalEntity(tx, db, subsidiaryOrgId) {
  const orgRef = db.doc(`organizations/${subsidiaryOrgId}`);
  const orgSnap = await tx.get(orgRef);
  if (!orgSnap.exists) return true;
  const flag = orgSnap.data().is_legal_entity;
  return flag !== false;
}

async function runCloseWorkOrder({ db, auth, data }) {
    const { uid } = await assertParentOrgPrincipal(auth);
    const { iwoId, idempotencyKey } = data || {};
    if (!iwoId) throw new HttpsError('invalid-argument', 'iwoId is required.');

    const iwoRef = db.doc(`internal_work_orders/${iwoId}`);

    try {
      return await withIdempotency(
        db,
        { key: idempotencyKey, endpoint: 'closeWorkOrder' },
        async (tx, recordCache) => {
          const snap = await tx.get(iwoRef);
          if (!snap.exists) throw new HttpsError('not-found', `IWO ${iwoId} not found.`);
          const iwo = snap.data();
          const to = nextState(iwo.state, 'close');

          const holdRef = db.collection('budget_holds').doc(iwo.budgetHoldId);
          const holdSnap = await tx.get(holdRef);
          budgetHold.settle({ tx, db, holdId: iwo.budgetHoldId, holdSnap });

          // Spec §11.9 — settlement path branches on the receiving
          // subsidiary's legal status. Read it inside the txn so a
          // concurrent flip can't desynchronise the IWO and its
          // settlement record.
          const isLegalEntity = await readSubsidiaryIsLegalEntity(
            tx, db, iwo.subsidiaryOrgId,
          );

          let settlementId = null;
          let settlementExisted = false;
          let settlementKind = null;
          if (isLegalEntity) {
            // IC-invoice path (default — Spec §4.5 / §8.3).
            const ic = await raiseIcInvoice({
              tx, db,
              iwo,
              iwoId,
              amountMinor: iwo.transferPriceMinor,
              isPartial: false,
              idempotencyKey,
            });
            settlementId = ic.id;
            settlementExisted = ic.existed;
            settlementKind = 'INTER_COMPANY_INVOICE';
          } else {
            // Intra-entity allocation path (Spec §11.9).
            const ca = await recordCostAllocation({
              tx, db,
              iwo,
              iwoId,
              amountMinor: iwo.transferPriceMinor,
              isPartial: false,
              idempotencyKey,
            });
            settlementId = ca.id;
            settlementExisted = ca.existed;
            settlementKind = 'INTRA_ENTITY_ALLOCATION';
          }

          tx.update(iwoRef, {
            state: to,
            closedAt: FieldValue.serverTimestamp(),
            closedByUserId: uid,
            // Keep `interCompanyInvoiceId` populated on the IC path so
            // §11.7 retries + downstream readers don't need to know
            // about §11.9. On the allocation path we set the sibling
            // field instead.
            interCompanyInvoiceId: isLegalEntity ? settlementId : null,
            costAllocationId: isLegalEntity ? null : settlementId,
            settlementKind,
            updatedAt: FieldValue.serverTimestamp(),
          });

          appendDomainEvent({
            tx, db,
            eventType: 'IWOClosed',
            aggregateType: 'IWO',
            aggregateId: iwoId,
            payload: {
              iwoId,
              closedByUserId: uid,
              finalCostMinor: iwo.cumulativeCostMinor || 0,
              settlementKind,
            },
            emittedByUserId: uid,
            idempotencyKey,
          });
          if (!settlementExisted) {
            if (isLegalEntity) {
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
                  amountMinor: iwo.transferPriceMinor,
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
                  amountMinor: iwo.transferPriceMinor,
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
            settlementKind,
            interCompanyInvoiceId: isLegalEntity ? settlementId : null,
            costAllocationId: isLegalEntity ? null : settlementId,
            icInvoiceAlreadyExisted: isLegalEntity && settlementExisted,
            costAllocationAlreadyExisted: !isLegalEntity && settlementExisted,
          };
          recordCache(response);
          return response;
        },
      );
    } catch (err) {
      throw toHttpsError(err);
    }
}

exports.runCloseWorkOrder = runCloseWorkOrder;
exports.closeWorkOrder = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  (request) => runCloseWorkOrder({ db: getFirestore(), auth: request.auth, data: request.data }),
);
