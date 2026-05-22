/**
 * issueWorkOrder — spec §7.1 (atomic 7-step sequence) + §9.1 (API).
 *
 * Caller (must be a PARENT-org / Account-Management principal) issues a
 * new IWO for `masterJobId` to `iwoInput.subsidiaryOrgId`. The seven steps
 * run inside ONE Firestore transaction:
 *
 *   1. Resolve MasterJob (must exist; status ∈ OPEN/DELIVERING).
 *   2. Verify the linked Quote is ACCEPTED, the SOW is ACTIVE.
 *   3. Headroom: allocated_minor + budget ≤ ceiling_minor. Else
 *      CEILING_EXCEEDED (HttpsError 'aborted' / mapped 409 at client).
 *   4. Create the IWO in DRAFT.
 *   5. Place a BudgetHold(HELD) for the budget amount and increment
 *      master_job.allocated_minor in the SAME txn (closes the
 *      double-allocation race — spec §11.1).
 *   6. Validate + attach the HandoffPacket (spec §7.3). Failure →
 *      HANDOFF_PACKET_INCOMPLETE (422).
 *   7. Transition the IWO DRAFT → ISSUED and emit IWOIssued via the
 *      transactional outbox.
 *
 * Error codes (spec §9.1):
 *   - CEILING_EXCEEDED          (HttpsError 'aborted', 409 at HTTP layer)
 *   - COMMERCIAL_SCOPE_REQUIRED ('permission-denied', 403)
 *   - HANDOFF_PACKET_INCOMPLETE ('failed-precondition', 422)
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');

const { assertParentOrgPrincipal } = require('./lib/auth');
const { withIdempotency, toHttpsError } = require('../platform/idempotency');
const { appendDomainEvent } = require('../platform/outbox');
const { ulid } = require('../platform/ulid');
const budgetHold = require('./services/budget-hold.service');
const {
  validateHandoffPacket,
  assertHandoffPacketValid,
} = require('./services/handoff-packet.validator');

/**
 * Pure-ish runner — extracted from the onCall wrapper so unit tests can
 * inject a stub Firestore. The wrapper at the bottom is a 3-line shim.
 */
async function runIssueWorkOrder({ db, auth, data }) {
    const { uid } = await assertParentOrgPrincipal(auth);

    const { masterJobId, iwoInput } = data || {};
    if (!masterJobId || typeof masterJobId !== 'string') {
      throw new HttpsError('invalid-argument', 'masterJobId is required.');
    }
    if (!iwoInput || typeof iwoInput !== 'object') {
      throw new HttpsError('invalid-argument', 'iwoInput is required.');
    }
    const {
      subsidiaryOrgId,
      budgetMinor,
      transferPriceMinor,
      currency,
      handoffPacket,
      idempotencyKey,
      code,
    } = iwoInput;
    if (!subsidiaryOrgId) {
      throw new HttpsError('invalid-argument', 'iwoInput.subsidiaryOrgId required.');
    }
    if (!Number.isInteger(budgetMinor) || budgetMinor <= 0) {
      throw new HttpsError('invalid-argument', 'iwoInput.budgetMinor must be a positive integer.');
    }
    if (!Number.isInteger(transferPriceMinor) || transferPriceMinor <= 0) {
      throw new HttpsError('invalid-argument', 'iwoInput.transferPriceMinor must be a positive integer.');
    }
    if (!currency) {
      throw new HttpsError('invalid-argument', 'iwoInput.currency required.');
    }

    // Validate the handoff packet OUTSIDE the txn (it requires Firestore
    // reads to confirm comms_owner is a parent-org user, which is fine
    // before the txn — the txn rechecks state once held).
    const mjSnap0 = await db.doc(`master_jobs/${masterJobId}`).get();
    if (!mjSnap0.exists) throw new HttpsError('not-found', `MasterJob ${masterJobId} not found.`);
    const masterJob0 = mjSnap0.data();
    let sow0 = null;
    if (masterJob0.sowId) {
      const sowSnap = await db.doc(`sows/${masterJob0.sowId}`).get();
      if (sowSnap.exists) sow0 = sowSnap.data();
    }
    const packetCheck = await validateHandoffPacket({
      packet: handoffPacket,
      iwo: { budgetMinor },
      sow: sow0,
    });
    try {
      assertHandoffPacketValid(packetCheck);
    } catch (err) {
      throw toHttpsError(err);
    }

    try {
      return await withIdempotency(
        db,
        { key: idempotencyKey, endpoint: 'issueWorkOrder' },
        async (tx, recordCache) => {
          // 1. Resolve MasterJob inside the txn (re-read to lock).
          const mjRef = db.doc(`master_jobs/${masterJobId}`);
          const mjSnap = await tx.get(mjRef);
          if (!mjSnap.exists) throw new HttpsError('not-found', `MasterJob ${masterJobId} not found.`);
          const mj = mjSnap.data();
          if (mj.status !== 'OPEN' && mj.status !== 'DELIVERING') {
            throw new HttpsError(
              'failed-precondition',
              `MasterJob ${masterJobId} is ${mj.status}; cannot issue IWOs.`,
            );
          }
          if (mj.currency && mj.currency !== currency) {
            throw new HttpsError(
              'failed-precondition',
              `Currency mismatch: MasterJob is ${mj.currency}, IWO requested ${currency}.`,
            );
          }

          // 2. Verify Quote is ACCEPTED, SOW is ACTIVE.
          if (!mj.quoteId) {
            throw new HttpsError('failed-precondition', `MasterJob ${masterJobId} has no linked quote.`);
          }
          const quoteSnap = await tx.get(db.doc(`quotes/${mj.quoteId}`));
          if (!quoteSnap.exists) {
            throw new HttpsError('failed-precondition', `Quote ${mj.quoteId} not found.`);
          }
          if (quoteSnap.data().status !== 'ACCEPTED') {
            throw new HttpsError(
              'failed-precondition',
              `Quote ${mj.quoteId} is ${quoteSnap.data().status}; must be ACCEPTED to issue IWOs.`,
            );
          }
          if (mj.sowId) {
            const sowSnap = await tx.get(db.doc(`sows/${mj.sowId}`));
            if (sowSnap.exists && sowSnap.data().status !== 'ACTIVE') {
              throw new HttpsError(
                'failed-precondition',
                `SOW ${mj.sowId} is ${sowSnap.data().status}; must be ACTIVE.`,
              );
            }
          }

          // 3. Headroom check.
          const allocatedBefore = mj.allocatedMinor || 0;
          const allocatedAfter = allocatedBefore + budgetMinor;
          if (allocatedAfter > mj.ceilingMinor) {
            const err = new Error(
              `CEILING_EXCEEDED: allocating ${budgetMinor} would push allocated_minor from ${allocatedBefore} to ${allocatedAfter}, past ceiling ${mj.ceilingMinor}.`,
            );
            err.code = 'CEILING_EXCEEDED';
            err.details = {
              ceilingMinor: mj.ceilingMinor,
              allocatedBefore,
              wouldAllocateMinor: allocatedAfter,
            };
            throw err;
          }

          // 4. Create the IWO in DRAFT.
          const iwoId = `iwo_${ulid()}`;
          const iwoCode = code || `IWO-${(subsidiaryOrgId || 'SUB').toUpperCase()}-${iwoId.slice(-8).toUpperCase()}`;
          const iwoRef = db.doc(`internal_work_orders/${iwoId}`);
          tx.set(iwoRef, {
            id: iwoId,
            masterJobId,
            subsidiaryOrgId,
            code: iwoCode,
            state: 'DRAFT',
            budgetMinor,
            transferPriceMinor,
            currency,
            cumulativeCostMinor: 0,
            quoteId: mj.quoteId,
            pinnedRateCardId: (quoteSnap.data().pinnedRateCardIdsBySubsidiary &&
              quoteSnap.data().pinnedRateCardIdsBySubsidiary[subsidiaryOrgId]) || null,
            issuedByUserId: uid,
            idempotencyKey: idempotencyKey || null,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });

          // 5. Place BudgetHold + increment master_job.allocated_minor.
          const holdId = budgetHold.hold({
            tx, db,
            masterJobId,
            iwoId,
            amountMinor: budgetMinor,
            currency,
          });
          tx.update(mjRef, {
            allocatedMinor: allocatedAfter,
            // OPEN → DELIVERING on first issued IWO.
            status: mj.status === 'OPEN' ? 'DELIVERING' : mj.status,
            updatedAt: FieldValue.serverTimestamp(),
          });

          // 6. Attach the validated handoff packet.
          const packetRef = db.doc(`internal_work_orders/${iwoId}/handoff_packet/packet`);
          tx.set(packetRef, {
            iwoId,
            briefMd: handoffPacket.briefMd,
            milestones: handoffPacket.milestones,
            acceptanceCriteria: handoffPacket.acceptanceCriteria,
            clientContextMd: handoffPacket.clientContextMd || null,
            commsOwnerUserId: handoffPacket.commsOwnerUserId,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });

          // 7. DRAFT → ISSUED + emit IWOIssued.
          tx.update(iwoRef, {
            state: 'ISSUED',
            budgetHoldId: holdId,
            issuedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          appendDomainEvent({
            tx, db,
            eventType: 'IWOIssued',
            aggregateType: 'IWO',
            aggregateId: iwoId,
            payload: {
              iwoId,
              masterJobId,
              subsidiaryOrgId,
              budgetMinor,
              transferPriceMinor,
              currency,
              issuedByUserId: uid,
              allocatedAfterMinor: allocatedAfter,
            },
            emittedByUserId: uid,
            idempotencyKey,
          });

          const response = {
            id: iwoId,
            status: 'ISSUED',
            masterJobId,
            budgetHoldId: holdId,
            allocatedAfterMinor: allocatedAfter,
          };
          recordCache(response);
          return response;
        },
      );
    } catch (err) {
      throw toHttpsError(err);
    }
}

exports.runIssueWorkOrder = runIssueWorkOrder;
exports.issueWorkOrder = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  (request) => runIssueWorkOrder({
    db: getFirestore(),
    auth: request.auth,
    data: request.data,
  }),
);
