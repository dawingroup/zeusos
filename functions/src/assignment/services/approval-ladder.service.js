/**
 * ECD Approval Ladder — Phase 6.D server impl (closes Addendum v1.1 §7 / C5).
 *
 * The chain lifecycle on each IWO:
 *
 *   initApprovalChain     called by submitDeliverable when the IWO
 *                         transitions IN_PROGRESS → DELIVERED. Reads
 *                         the IWO's tier, picks the ladder, writes
 *                         the initial { currentRung: ladder[0],
 *                         history: [INIT], complete: false }.
 *
 *   advanceRung           called by advanceApprovalRungFn. Moves
 *                         currentRung to nextRung(ladder). On terminal,
 *                         sets complete=true and emits
 *                         InternalApprovalGranted; otherwise emits
 *                         ApprovalRungAdvanced.
 *
 *   rejectRung            called by rejectApprovalRungFn. Resets
 *                         currentRung to ladder[0] (work goes back
 *                         to the originator with structured notes).
 *                         Emits ApprovalRungRejected. The history
 *                         keeps every prior pass so cycle-time
 *                         analytics see the loop.
 *
 *   isApprovalGranted     pure predicate. acceptInternalRequestRevision
 *                         consults this before allowing the DELIVERED
 *                         → ACCEPTED_INTERNALLY transition.
 *
 * Capability is data — see v1.2 §6.3. The route's RoleProfile.
 * taskCapabilities controls who can `canApprove` on
 * `creative.internal_approval_requested` at each rung. Phase 6.D ships
 * the ladder skeleton + outbox events; per-rung RBAC enforcement is a
 * 6.D.2 follow-up (joins through hr-central.role_assignment).
 */

const { HttpsError } = require('firebase-functions/v2/https');
const { appendDomainEvent } = require('../../platform/outbox');

const FULL_LADDER = ['DESIGNER', 'AD', 'STUDIO_MGR', 'ACD', 'CD', 'ECD'];

const LADDER_BY_TIER = {
  TIER_1: ['DESIGNER', 'AD', 'STUDIO_MGR', 'ACD', 'CD', 'ECD'],
  TIER_2: ['DESIGNER', 'ACD', 'CD', 'ECD'],
  TIER_3: ['STUDIO_MGR', 'CD'],
};

/**
 * Pick the ladder for a given tier. Falls back to FULL_LADDER when
 * tier is unknown — preserves safety (no auto-skip of rungs when
 * intent is unclear).
 */
function ladderForTier(tier) {
  if (!tier) return FULL_LADDER;
  return LADDER_BY_TIER[tier] || FULL_LADDER;
}

/**
 * Find the next rung after `rung` in `ladder`, or null if terminal /
 * not found.
 */
function nextRung(ladder, rung) {
  const idx = ladder.indexOf(rung);
  if (idx < 0 || idx === ladder.length - 1) return null;
  return ladder[idx + 1];
}

function isTerminalRung(ladder, rung) {
  return ladder.length > 0 && ladder[ladder.length - 1] === rung;
}

/**
 * True iff the chain has reached its terminal rung AND been GRANTED.
 * Read by acceptInternalRequestRevision as the gate.
 */
function isApprovalGranted(chain) {
  if (!chain) return false;
  return chain.complete === true;
}

/**
 * Build the initial chain object for a freshly-DELIVERED IWO.
 * Returns the object the caller should write — the caller does the
 * Firestore mutation inside its own transaction.
 */
function buildInitialChain({ tier, actorUserId, nowIso }) {
  const ladder = ladderForTier(tier);
  const initEvent = {
    sequenceNumber: 1,
    rung: ladder[0],
    action: 'INIT',
    actorUserId,
    occurredAt: nowIso || new Date().toISOString(),
  };
  return {
    ladder,
    currentRung: ladder[0],
    history: [initEvent],
    complete: false,
    tierAtOpen: tier || null,
    initializedAt: nowIso || new Date().toISOString(),
  };
}

/**
 * Advance the chain one rung. Mutates the IWO's `approvalChain` field
 * inside the caller's transaction + emits ApprovalRungAdvanced. On
 * terminal rung, sets `complete=true` and emits InternalApprovalGranted
 * instead.
 *
 * Throws HttpsError when:
 *   - IWO has no approvalChain (it's not at DELIVERED)
 *   - chain is already complete (terminal rung GRANTED)
 *
 * @returns {{ rung, terminal: boolean }}
 */
async function advanceRung({ tx, db, iwoRef, actorUserId, actorRoleProfileId, nowIso }) {
  const snap = await tx.get(iwoRef);
  if (!snap.exists) throw new HttpsError('not-found', 'IWO not found.');
  const iwo = snap.data();
  const chain = iwo.approvalChain;
  if (!chain) {
    throw new HttpsError(
      'failed-precondition',
      'IWO is not at DELIVERED — no approval chain to advance.',
    );
  }
  if (chain.complete) {
    throw new HttpsError(
      'failed-precondition',
      'Approval chain already complete (InternalApprovalGranted fired).',
    );
  }

  const ladder = Array.isArray(chain.ladder) ? chain.ladder : FULL_LADDER;
  const cur = chain.currentRung;
  const isTerminal = isTerminalRung(ladder, cur);

  const seq = (chain.history?.length || 0) + 1;
  const occurredAt = nowIso || new Date().toISOString();

  if (isTerminal) {
    // Terminal-rung approve → GRANTED.
    const grantedEvent = {
      sequenceNumber: seq,
      rung: cur,
      action: 'GRANTED',
      actorUserId,
      actorRoleProfileId: actorRoleProfileId || null,
      occurredAt,
    };
    const nextChain = {
      ...chain,
      complete: true,
      completedAt: occurredAt,
      history: [...(chain.history || []), grantedEvent],
    };
    tx.update(iwoRef, {
      approvalChain: nextChain,
      updatedAt: occurredAt,
    });
    appendDomainEvent({
      tx, db,
      eventType: 'InternalApprovalGranted',
      aggregateType: 'IWO',
      aggregateId: iwoRef.id,
      payload: {
        iwoId: iwoRef.id,
        masterJobId: iwo.masterJobId,
        terminalRung: cur,
        actorUserId,
        ladder,
        loopCount: chain.history.filter((h) => h.action === 'REJECT').length,
      },
    });
    return { rung: cur, terminal: true };
  }

  // Non-terminal → ADVANCE to next rung.
  const next = nextRung(ladder, cur);
  if (!next) {
    // Defensive — shouldn't happen given isTerminal check above.
    throw new HttpsError('internal', 'Ladder corrupt: no next rung from non-terminal.');
  }
  const advanceEvent = {
    sequenceNumber: seq,
    rung: cur,           // event records the rung that APPROVED (i.e. who passed)
    action: 'ADVANCE',
    actorUserId,
    actorRoleProfileId: actorRoleProfileId || null,
    occurredAt,
  };
  const nextChain = {
    ...chain,
    currentRung: next,
    history: [...(chain.history || []), advanceEvent],
  };
  tx.update(iwoRef, {
    approvalChain: nextChain,
    updatedAt: occurredAt,
  });
  appendDomainEvent({
    tx, db,
    eventType: 'ApprovalRungAdvanced',
    aggregateType: 'IWO',
    aggregateId: iwoRef.id,
    payload: {
      iwoId: iwoRef.id,
      masterJobId: iwo.masterJobId,
      fromRung: cur,
      toRung: next,
      actorUserId,
      ladder,
    },
  });
  return { rung: next, terminal: false };
}

/**
 * Reject the current rung. The chain resets to `ladder[0]` (work
 * returns to the originator) but the history is preserved — the
 * rejection-loop is observable in cycle-time analytics.
 *
 * `notes` is REQUIRED — every rejection carries structured commentary
 * so the originator knows what to revise. Stored on the REJECT event.
 *
 * @returns {{ rejectingRung, returnedToRung, loopCount }}
 */
async function rejectRung({ tx, db, iwoRef, actorUserId, actorRoleProfileId, notes, nowIso }) {
  if (!notes || typeof notes !== 'string' || !notes.trim()) {
    throw new HttpsError('invalid-argument', 'Rejection requires `notes`.');
  }

  const snap = await tx.get(iwoRef);
  if (!snap.exists) throw new HttpsError('not-found', 'IWO not found.');
  const iwo = snap.data();
  const chain = iwo.approvalChain;
  if (!chain) {
    throw new HttpsError(
      'failed-precondition',
      'IWO is not at DELIVERED — no approval chain to reject.',
    );
  }
  if (chain.complete) {
    throw new HttpsError(
      'failed-precondition',
      'Approval chain already complete (post-GRANTED reject is not allowed).',
    );
  }

  const ladder = Array.isArray(chain.ladder) ? chain.ladder : FULL_LADDER;
  const rejectingRung = chain.currentRung;
  const returnedTo = ladder[0];

  const seq = (chain.history?.length || 0) + 1;
  const occurredAt = nowIso || new Date().toISOString();
  const rejectEvent = {
    sequenceNumber: seq,
    rung: rejectingRung,
    action: 'REJECT',
    actorUserId,
    actorRoleProfileId: actorRoleProfileId || null,
    notes,
    occurredAt,
  };

  const nextChain = {
    ...chain,
    currentRung: returnedTo,
    history: [...(chain.history || []), rejectEvent],
  };
  tx.update(iwoRef, {
    approvalChain: nextChain,
    updatedAt: occurredAt,
  });

  // loopCount BEFORE this reject — useful for "is this a hotspot?"
  const priorLoops = chain.history.filter((h) => h.action === 'REJECT').length;

  appendDomainEvent({
    tx, db,
    eventType: 'ApprovalRungRejected',
    aggregateType: 'IWO',
    aggregateId: iwoRef.id,
    payload: {
      iwoId: iwoRef.id,
      masterJobId: iwo.masterJobId,
      rejectingRung,
      returnedToRung: returnedTo,
      actorUserId,
      notes,
      loopCountAfter: priorLoops + 1,
      ladder,
    },
  });

  return {
    rejectingRung,
    returnedToRung: returnedTo,
    loopCount: priorLoops + 1,
  };
}

module.exports = {
  FULL_LADDER,
  LADDER_BY_TIER,
  ladderForTier,
  nextRung,
  isTerminalRung,
  isApprovalGranted,
  buildInitialChain,
  advanceRung,
  rejectRung,
};
