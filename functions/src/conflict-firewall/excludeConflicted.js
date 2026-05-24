/**
 * excludeConflicted — Phase 6.C v2 (ADR-0001 Q4 + v1.1 C3).
 *
 * SUPERSEDES the v1 Category-model implementation. Per ADR-0001 Q4,
 * Zeus leadership chose the named-competitor-list model over category
 * exclusivity. This function walks the requesting client's
 * `client_competitors` edge, then for each competitor checks which
 * brand(s) are serving them via OPEN IWOs, and excludes those brands.
 *
 * Algorithm:
 *
 *   1. Read client_competitors WHERE clientId == requestingClientId.
 *      No competitors → no exclusions.
 *
 *   2. For each candidate brand still in the running:
 *        Read open IWOs at this brand.
 *        For each open IWO, lookup the master_job and check whether
 *        master_job.clientId is in the competitor set. If yes → wall
 *        the brand and stop checking more IWOs.
 *
 *   3. If any walled brands → emit ConflictExclusivityRisk with the
 *      walled-by-brand → competitor mapping for Account Mgmt review.
 *
 * Mutates the candidates array in place (matches the v1 contract:
 * `conflicted: true`, `rejectionReason: 'CONFLICTED'`).
 *
 * Cost note: O(brands × open_iwos_at_brand × 1 mj-read), with
 * de-duped mj reads. Q2 PR (Client.commercialOwnerOrgId) will let
 * this collapse to a composite-index query per (brand, competitor)
 * pair against master_jobs — see ADR-0001 Q2.
 *
 * Idempotent. No state writes other than the optional risk event.
 *
 * @param {{
 *   db: FirebaseFirestore.Firestore|object,
 *   candidates: Array<{ brandId, hasCapability, conflicted,
 *                       openIwoCount, availability, rejectionReason }>,
 *   accountId?: string,          // v1 alias — preserved for back-compat
 *   requestingClientId?: string, // canonical name; same as accountId
 *   accountCategory?: string,    // v1 alias — IGNORED in v2 (no-op)
 *   masterJobId?: string,
 *   tx?: FirebaseFirestore.Transaction,
 * }} args
 * @returns {Promise<{ walledBrandIds: string[], walledByBrand: object }>}
 */
async function excludeConflicted({
  db, candidates,
  accountId, requestingClientId,
  // accountCategory intentionally ignored (v1 → v2 deprecation)
  masterJobId, tx,
} = {}) {
  const requesterId = requestingClientId || accountId || null;

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return { walledBrandIds: [], walledByBrand: {} };
  }
  if (!requesterId) {
    // No requesting client → firewall not evaluable.
    return { walledBrandIds: [], walledByBrand: {} };
  }

  const stillInTheRunning = candidates.filter((c) => c.rejectionReason === null);
  if (stillInTheRunning.length === 0) {
    return { walledBrandIds: [], walledByBrand: {} };
  }

  // 1. Read competitor list for the requesting client.
  const competitorsSnap = await db
    .collection('client_competitors')
    .where('clientId', '==', requesterId)
    .get();

  const competitorIds = [];
  competitorsSnap.forEach((doc) => {
    const d = doc.data();
    if (d && d.competitorClientId) competitorIds.push(d.competitorClientId);
  });
  if (competitorIds.length === 0) {
    return { walledBrandIds: [], walledByBrand: {} };
  }

  // 2. For each candidate brand, check whether any competitor is
  //    being served via an open IWO at this brand. State filter is
  //    applied in-memory (rather than via Firestore `in` query) so
  //    the same code runs against the unit-test stub.
  const OPEN_IWO_STATES = new Set([
    'ISSUED', 'ACCEPTED', 'IN_PROGRESS', 'REVISION_REQUESTED', 'DELIVERED',
  ]);
  const walledBrandIds = [];
  const walledByBrand = {};      // brandId → competitorId that caused the wall

  for (const c of stillInTheRunning) {
    let walledByCompetitor = null;

    const iwoSnap = await db
      .collection('internal_work_orders')
      .where('subsidiaryOrgId', '==', c.brandId)
      .get();

    if (!iwoSnap || iwoSnap.size === 0) continue;

    // De-dupe masterJobId reads (multiple IWOs often share an mj),
    // and filter to OPEN states in-memory.
    const seenMjs = new Set();
    for (const iwoDoc of iwoSnap.docs) {
      const iwo = iwoDoc.data();
      if (!iwo || !iwo.masterJobId) continue;
      if (!OPEN_IWO_STATES.has(iwo.state)) continue;
      if (seenMjs.has(iwo.masterJobId)) continue;
      seenMjs.add(iwo.masterJobId);

      const mjSnap = await db.doc(`master_jobs/${iwo.masterJobId}`).get();
      if (!mjSnap.exists) continue;
      const mj = mjSnap.data();
      if (!mj || !mj.clientId) continue;

      if (competitorIds.includes(mj.clientId)) {
        walledByCompetitor = mj.clientId;
        break;
      }
    }

    if (walledByCompetitor) {
      c.conflicted = true;
      c.rejectionReason = 'CONFLICTED';
      walledBrandIds.push(c.brandId);
      walledByBrand[c.brandId] = walledByCompetitor;
    }
  }

  // 3. Emit risk event if any brand was walled.
  if (walledBrandIds.length > 0 && masterJobId) {
    try {
      const { appendDomainEvent } = require('../platform/outbox');
      const payload = {
        requestedClientId: requesterId,
        listedCompetitorIds: competitorIds,
        walledBrandIds,
        walledCompetitorByBrand: walledByBrand,
        masterJobId,
      };
      if (tx) {
        appendDomainEvent({
          tx, db,
          eventType: 'ConflictExclusivityRisk',
          aggregateType: 'MasterJob',
          aggregateId: masterJobId,
          payload,
        });
      } else {
        await db.runTransaction(async (innerTx) => {
          appendDomainEvent({
            tx: innerTx, db,
            eventType: 'ConflictExclusivityRisk',
            aggregateType: 'MasterJob',
            aggregateId: masterJobId,
            payload,
          });
        });
      }
    } catch (err) {
      // Outbox failure must not block routing — the wall is still
      // applied (mutation above already ran). Log + continue.
      // eslint-disable-next-line no-console
      console.error('excludeConflicted: outbox emit failed', err);
    }
  }

  return { walledBrandIds, walledByBrand };
}

module.exports = { excludeConflicted };
