/**
 * excludeConflicted — ADR-2026-05-25 §2.Q4 named-competitor model.
 *
 * Replaces the Phase 6.B no-op stub and the (retired) Phase 6.C
 * category-based matcher. The new algorithm:
 *
 *   1. Pull the requesting client's competitor list from
 *      `client_competitors` (where clientId == requestedClientId).
 *   2. If no competitors listed → no-op (firewall doesn't trigger).
 *   3. For each candidate brand still in the running:
 *      a. Query that brand's OPEN/IN_PROGRESS `internal_work_orders`.
 *      b. Map each IWO to its master_job's clientId.
 *      c. If any of those clientIds appears on the requesting
 *         client's competitor list → mark the brand `conflicted`
 *         with rejectionReason `CONFLICTED` and capture WHICH
 *         competitor pinned it (for the risk-event payload).
 *   4. If any brand was excluded, emit `ConflictExclusivityRisk`
 *      transactionally with the routing decision (when tx is
 *      passed) or in a fresh micro-txn otherwise. The event
 *      payload identifies the competitor(s) that caused each
 *      exclusion so reviewers can audit "why did routing tighten?"
 *
 * The matcher consults `master_jobs` to bridge IWO → client; this
 * is the cheap lookup pattern since OPEN IWOs per brand are small
 * (typically <50 at any moment). Categories are NOT consulted by
 * routing — they survive as a reporting overlay only.
 *
 * @param {{
 *   db: FirebaseFirestore.Firestore|object,
 *   candidates: Array<{
 *     brandId: string,
 *     hasCapability: boolean,
 *     conflicted: boolean,
 *     openIwoCount: number,
 *     availability: number,
 *     rejectionReason: string|null,
 *   }>,
 *   accountId?: string,            // the requesting client's id
 *   masterJobId?: string,           // forwarded into the risk event
 *   tx?: FirebaseFirestore.Transaction,
 * }} args
 * @returns {Promise<{
 *   walledBrandIds: string[],
 *   listedCompetitorIds: string[],
 *   walledCompetitorByBrand: Record<string, string[]>,
 * }>}
 */
async function excludeConflicted({ db, candidates, accountId, masterJobId, tx } = {}) {
  const emptyResult = {
    walledBrandIds: [],
    listedCompetitorIds: [],
    walledCompetitorByBrand: {},
  };

  if (!Array.isArray(candidates) || candidates.length === 0) return emptyResult;
  if (!accountId) return emptyResult; // can't evaluate the firewall

  // Step 1 — pull the requesting client's competitor list.
  const competitorsSnap = await db
    .collection('client_competitors')
    .where('clientId', '==', accountId)
    .get();
  const listedCompetitorIds = [];
  competitorsSnap.forEach((doc) => {
    listedCompetitorIds.push(doc.data().competitorClientId);
  });
  if (listedCompetitorIds.length === 0) return emptyResult;

  const stillInTheRunning = candidates.filter((c) => c.rejectionReason === null);
  if (stillInTheRunning.length === 0) {
    return { ...emptyResult, listedCompetitorIds };
  }

  // Step 3 — for each candidate brand, query their open IWOs and map
  // each to a clientId via master_jobs lookup. Iterate sequentially;
  // brand counts are small and parallel reads complicate the stub.
  const walledBrandIds = [];
  const walledCompetitorByBrand = {};

  const competitorIdSet = new Set(listedCompetitorIds);

  for (const candidate of stillInTheRunning) {
    // OPEN IWOs for this brand. We approximate "currently serving"
    // by IWOs not in CLOSED / CANCELLED / REJECTED state. Since
    // Firestore '!=' / 'not-in' is limited, we fetch by brand and
    // filter in memory — counts are small.
    const iwoSnap = await db
      .collection('internal_work_orders')
      .where('subsidiaryOrgId', '==', candidate.brandId)
      .get();

    const conflictingCompetitors = new Set();
    for (const iwoDoc of iwoSnap.docs) {
      const iwo = iwoDoc.data();
      const state = iwo.state;
      if (state === 'CLOSED' || state === 'CANCELLED' || state === 'REJECTED') continue;
      const mjId = iwo.masterJobId;
      if (!mjId) continue;
      const mjSnap = await db.doc(`master_jobs/${mjId}`).get();
      if (!mjSnap.exists) continue;
      const servedClientId = mjSnap.data().clientId;
      if (!servedClientId) continue;
      if (competitorIdSet.has(servedClientId)) {
        conflictingCompetitors.add(servedClientId);
      }
    }

    if (conflictingCompetitors.size > 0) {
      candidate.conflicted = true;
      candidate.rejectionReason = 'CONFLICTED';
      walledBrandIds.push(candidate.brandId);
      walledCompetitorByBrand[candidate.brandId] = Array.from(conflictingCompetitors);
    }
  }

  // Step 4 — emit the risk event if any brand was walled. Even one
  // exclusion is enough signal for Conflict Sentinel + reporting.
  if (walledBrandIds.length > 0 && masterJobId) {
    try {
      const { appendDomainEvent } = require('../platform/outbox');
      const payload = {
        requestedClientId: accountId,
        listedCompetitorIds,
        walledBrandIds,
        walledCompetitorByBrand,
        masterJobId,
      };
      if (tx) {
        appendDomainEvent({
          tx,
          db,
          eventType: 'ConflictExclusivityRisk',
          aggregateType: 'MasterJob',
          aggregateId: masterJobId,
          payload,
        });
      } else {
        await db.runTransaction(async (innerTx) => {
          appendDomainEvent({
            tx: innerTx,
            db,
            eventType: 'ConflictExclusivityRisk',
            aggregateType: 'MasterJob',
            aggregateId: masterJobId,
            payload,
          });
        });
      }
    } catch (err) {
      // Outbox failure must not block routing — the exclusion is
      // already applied; log and continue.
      // eslint-disable-next-line no-console
      console.error('excludeConflicted: outbox emit failed', err);
    }
  }

  return {
    walledBrandIds,
    listedCompetitorIds,
    walledCompetitorByBrand,
  };
}

module.exports = { excludeConflicted };
