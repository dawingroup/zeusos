/**
 * closeWorkOrder — spec §6.1.1 / §8.3 / §11.7.
 *
 *   ACCEPTED_INTERNALLY → CLOSED
 *   - BudgetHold LOCKED → SETTLED
 *   - Raises Inter-Company Invoice at `transferPriceMinor`
 *     (deterministic doc id `ic_${iwoId}` → spec §4.5 UNIQUE iwo_id;
 *      concurrent retries collide on the same key)
 *   - Emits IWOClosed + InterCompanyInvoiceRaised
 *
 * Idempotent at the endpoint level (cached response on duplicate
 * Idempotency-Key) AND at the IC-invoice level (UNIQUE iwo_id). The
 * §11.7 duplicate-billing test verifies that two retries return the
 * same IC invoice id.
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
const { PARENT_ORG_ID } = require('./lib/auth');

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

          // Raise the IC invoice (deterministic id; idempotent on iwoId).
          const ic = await raiseIcInvoice({
            tx, db,
            iwo,
            iwoId,
            amountMinor: iwo.transferPriceMinor,
            isPartial: false,
            idempotencyKey,
          });

          tx.update(iwoRef, {
            state: to,
            closedAt: FieldValue.serverTimestamp(),
            closedByUserId: uid,
            interCompanyInvoiceId: ic.id,
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
            },
            emittedByUserId: uid,
            idempotencyKey,
          });
          if (!ic.existed) {
            appendDomainEvent({
              tx, db,
              eventType: 'InterCompanyInvoiceRaised',
              aggregateType: 'InterCompanyInvoice',
              aggregateId: ic.id,
              payload: {
                intercompanyInvoiceId: ic.id,
                iwoId,
                fromOrgId: iwo.subsidiaryOrgId,
                toOrgId: PARENT_ORG_ID,
                amountMinor: iwo.transferPriceMinor,
                currency: iwo.currency,
              },
              emittedByUserId: uid,
              idempotencyKey,
            });
          }

          const response = {
            id: iwoId,
            status: to,
            interCompanyInvoiceId: ic.id,
            icInvoiceAlreadyExisted: ic.existed,
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
