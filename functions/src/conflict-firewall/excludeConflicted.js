/**
 * excludeConflicted — Phase 6.C real impl (replaces 6.B stub).
 *
 * For each candidate brand that's still in the running (no prior
 * rejection), query `conflict_walls` for rows matching:
 *
 *   servingOrgId == candidate.brandId  AND
 *   categoryId   == requestedCategory  AND
 *   clientId     != requestedClientId
 *
 * If any row exists, the brand is walled — it's already serving a
 * competitor in the same category. Mark the candidate `conflicted` +
 * set `rejectionReason = 'CONFLICTED'`.
 *
 * Mutates the candidates array in place (matches the 6.B contract:
 * the stub had no return value).
 *
 * No-op when `accountCategory` is not provided — the firewall can
 * only be evaluated when the request declares the category being
 * routed. The caller (routeBrand) is responsible for passing this
 * from master_job.account.category or per-IWO input.
 *
 * Bonus: if 2+ candidates are excluded by walls in the SAME category,
 * the routing pressure is real — emits `ConflictExclusivityRisk` via
 * the outbox so reporting + the Conflict Sentinel (ZA-004, Phase 6.F)
 * can surface the breach risk to Account Mgmt. The emission is
 * transactional with the caller (passed `tx` arg when emitting).
 *
 * @param {{
 *   db: FirebaseFirestore.Firestore|object,
 *   candidates: Array<{
 *     brandId: string,
 *     hasCapability: boolean,
 *     conflicted: boolean,
 *     openIwoCount: number,
 *     availability: number,
 *     rejectionReason: string|null
 *   }>,
 *   accountId?: string,
 *   accountCategory?: string,
 *   masterJobId?: string,           // forwarded into the risk event
 *   tx?: FirebaseFirestore.Transaction,  // optional — if provided, the
 *                                        // risk event is appended in
 *                                        // the same tx as the routing
 *                                        // decision; otherwise emitted
 *                                        // in a fresh microtx.
 * }} args
 * @returns {Promise<{ walledBrandIds: string[], walledClientIds: string[] }>}
 *          For tests + observability — the same data also lives on the
 *          mutated `candidates` array.
 */
async function excludeConflicted({ db, candidates, accountId, accountCategory, masterJobId, tx } = {}) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return { walledBrandIds: [], walledClientIds: [] };
  }
  if (!accountCategory) {
    // No category declared → firewall not evaluable.
    return { walledBrandIds: [], walledClientIds: [] };
  }

  const stillInTheRunning = candidates.filter((c) => c.rejectionReason === null);
  if (stillInTheRunning.length === 0) {
    return { walledBrandIds: [], walledClientIds: [] };
  }

  const walledBrandIds = [];
  const walledClientIds = new Set();

  // Per-brand walls lookup. Firestore doesn't support OR across
  // multiple `where` clauses with `!=` in 2nd-gen, so we issue one
  // query per candidate brand. With ≤5 candidates this is cheap.
  for (const c of stillInTheRunning) {
    const snap = await db
      .collection('conflict_walls')
      .where('servingOrgId', '==', c.brandId)
      .where('categoryId', '==', accountCategory)
      .get();

    const otherClientWalls = [];
    snap.forEach((doc) => {
      const w = doc.data();
      if (w.clientId !== accountId) otherClientWalls.push(w);
    });

    if (otherClientWalls.length > 0) {
      c.conflicted = true;
      c.rejectionReason = 'CONFLICTED';
      walledBrandIds.push(c.brandId);
      otherClientWalls.forEach((w) => walledClientIds.add(w.clientId));
    }
  }

  // Emit risk event if at least one brand was walled — even one
  // exclusion is enough signal for Conflict Sentinel + reporting.
  // Skip when we don't have a masterJobId (no aggregate to attach
  // the event to — used by unit tests that exercise the pure logic).
  if (walledBrandIds.length > 0 && masterJobId) {
    try {
      const { appendDomainEvent } = require('../platform/outbox');
      const payload = {
        categoryId: accountCategory,
        requestedClientId: accountId || null,
        walledClientIds: Array.from(walledClientIds),
        excludedBrandIds: walledBrandIds,
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
      // Outbox failure must not block routing — the wall is still
      // applied (mutation above already ran). Log and continue.
      // eslint-disable-next-line no-console
      console.error('excludeConflicted: outbox emit failed', err);
    }
  }

  return {
    walledBrandIds,
    walledClientIds: Array.from(walledClientIds),
  };
}

module.exports = { excludeConflicted };
