/**
 * ECD Approval Ladder — Phase 6.D unit tests.
 *   cd functions && node --test __tests__/assignment/approval-ladder.test.js
 *
 * Covers:
 *   - buildInitialChain shape (tier-driven ladder depth)
 *   - advanceRung non-terminal → ApprovalRungAdvanced
 *   - advanceRung terminal → InternalApprovalGranted + complete=true
 *   - rejectRung → returns to ladder[0] + preserves history
 *   - rejectRung requires notes
 *   - advance/reject blocked after complete=true
 *   - rejection-loop count increments
 *   - acceptInternal gated on chain.complete
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  makeFirestore,
  patchAuthForTests,
  auth,
} = require('./_seed-helpers');

patchAuthForTests();

const {
  FULL_LADDER,
  LADDER_BY_TIER,
  ladderForTier,
  buildInitialChain,
  advanceRung,
  rejectRung,
  isApprovalGranted,
} = require('../../src/assignment/services/approval-ladder.service');
const { runAcceptInternal } = require('../../src/assignment/acceptInternalRequestRevision');

// ----- ladder picker --------------------------------------------------

test('ladderForTier: TIER_1 → 6 rungs, TIER_2 → 4, TIER_3 → 2', () => {
  assert.equal(ladderForTier('TIER_1').length, 6);
  assert.equal(ladderForTier('TIER_2').length, 4);
  assert.equal(ladderForTier('TIER_3').length, 2);
});

test('ladderForTier: unknown / missing → defaults to FULL_LADDER', () => {
  assert.deepEqual(ladderForTier(null), FULL_LADDER);
  assert.deepEqual(ladderForTier(undefined), FULL_LADDER);
  assert.deepEqual(ladderForTier('TIER_99'), FULL_LADDER);
});

// ----- buildInitialChain ----------------------------------------------

test('buildInitialChain: TIER_1 starts at DESIGNER, full ladder copied', () => {
  const chain = buildInitialChain({
    tier: 'TIER_1',
    actorUserId: 'user-am-1',
    nowIso: '2026-05-24T10:00:00Z',
  });
  assert.deepEqual(chain.ladder, LADDER_BY_TIER.TIER_1);
  assert.equal(chain.currentRung, 'DESIGNER');
  assert.equal(chain.complete, false);
  assert.equal(chain.tierAtOpen, 'TIER_1');
  assert.equal(chain.history.length, 1);
  assert.equal(chain.history[0].action, 'INIT');
  assert.equal(chain.history[0].rung, 'DESIGNER');
});

test('buildInitialChain: TIER_3 starts at STUDIO_MGR (collapsed ladder)', () => {
  const chain = buildInitialChain({ tier: 'TIER_3', actorUserId: 'u1' });
  assert.deepEqual(chain.ladder, ['STUDIO_MGR', 'CD']);
  assert.equal(chain.currentRung, 'STUDIO_MGR');
});

// ----- advanceRung ----------------------------------------------------

async function seedDeliveredIwo(db, { iwoId, tier = 'TIER_2' } = {}) {
  const chain = buildInitialChain({ tier, actorUserId: 'system' });
  await db.doc(`internal_work_orders/${iwoId}`).set({
    id: iwoId,
    masterJobId: `mj-${iwoId}`,
    state: 'DELIVERED',
    subsidiaryOrgId: 'zeus-the-agency',
    approvalChain: chain,
  });
  return chain;
}

test('advanceRung non-terminal → ApprovalRungAdvanced + moves to next rung', async () => {
  const { db } = makeFirestore();
  await seedDeliveredIwo(db, { iwoId: 'iwo-1', tier: 'TIER_2' });
  const iwoRef = db.doc('internal_work_orders/iwo-1');

  await db.runTransaction(async (tx) => {
    const r = await advanceRung({
      tx, db, iwoRef,
      actorUserId: 'user-designer',
      nowIso: '2026-05-24T11:00:00Z',
    });
    assert.equal(r.terminal, false);
    assert.equal(r.rung, 'ACD');                    // TIER_2: DESIGNER → ACD
  });

  const fresh = (await iwoRef.get()).data();
  assert.equal(fresh.approvalChain.currentRung, 'ACD');
  assert.equal(fresh.approvalChain.complete, false);

  // outbox: ApprovalRungAdvanced emitted
  const events = (await db.collection('domain_events').get()).docs.map((d) => d.data());
  const e = events.find((x) => x.eventType === 'ApprovalRungAdvanced');
  assert.ok(e);
  assert.equal(e.payload.fromRung, 'DESIGNER');
  assert.equal(e.payload.toRung, 'ACD');
});

test('advanceRung terminal → InternalApprovalGranted + complete=true', async () => {
  const { db } = makeFirestore();
  // Tier 3 ladder is just STUDIO_MGR → CD. We pre-advance to CD.
  const chain = buildInitialChain({ tier: 'TIER_3', actorUserId: 'system' });
  chain.currentRung = 'CD';                          // pretend we already advanced past STUDIO_MGR
  await db.doc('internal_work_orders/iwo-2').set({
    id: 'iwo-2', masterJobId: 'mj-2', state: 'DELIVERED', approvalChain: chain,
  });
  const iwoRef = db.doc('internal_work_orders/iwo-2');

  await db.runTransaction(async (tx) => {
    const r = await advanceRung({ tx, db, iwoRef, actorUserId: 'user-cd' });
    assert.equal(r.terminal, true);
    assert.equal(r.rung, 'CD');
  });

  const fresh = (await iwoRef.get()).data();
  assert.equal(fresh.approvalChain.complete, true);
  assert.ok(fresh.approvalChain.completedAt);

  const events = (await db.collection('domain_events').get()).docs.map((d) => d.data());
  const granted = events.find((e) => e.eventType === 'InternalApprovalGranted');
  assert.ok(granted);
  assert.equal(granted.payload.terminalRung, 'CD');
  assert.equal(granted.payload.loopCount, 0);
});

test('advanceRung after complete → failed-precondition', async () => {
  const { db } = makeFirestore();
  const chain = buildInitialChain({ tier: 'TIER_3', actorUserId: 'system' });
  chain.complete = true;
  chain.currentRung = 'CD';
  await db.doc('internal_work_orders/iwo-3').set({
    id: 'iwo-3', masterJobId: 'mj-3', state: 'DELIVERED', approvalChain: chain,
  });
  const iwoRef = db.doc('internal_work_orders/iwo-3');

  await assert.rejects(
    () => db.runTransaction((tx) => advanceRung({ tx, db, iwoRef, actorUserId: 'u' })),
    /already complete/,
  );
});

test('advanceRung when no approvalChain → failed-precondition', async () => {
  const { db } = makeFirestore();
  await db.doc('internal_work_orders/iwo-bare').set({
    id: 'iwo-bare', state: 'ISSUED', masterJobId: 'mj-bare',
  });
  const iwoRef = db.doc('internal_work_orders/iwo-bare');
  await assert.rejects(
    () => db.runTransaction((tx) => advanceRung({ tx, db, iwoRef, actorUserId: 'u' })),
    /not at DELIVERED/,
  );
});

// ----- rejectRung -----------------------------------------------------

test('rejectRung → returns to ladder[0], preserves history, emits event', async () => {
  const { db } = makeFirestore();
  const chain = buildInitialChain({ tier: 'TIER_1', actorUserId: 'system' });
  chain.currentRung = 'CD';                          // we're 4 rungs in
  await db.doc('internal_work_orders/iwo-4').set({
    id: 'iwo-4', masterJobId: 'mj-4', state: 'DELIVERED', approvalChain: chain,
  });
  const iwoRef = db.doc('internal_work_orders/iwo-4');

  await db.runTransaction(async (tx) => {
    const r = await rejectRung({
      tx, db, iwoRef,
      actorUserId: 'user-cd',
      notes: 'Layout proportions feel cramped — give headline more breathing room.',
    });
    assert.equal(r.rejectingRung, 'CD');
    assert.equal(r.returnedToRung, 'DESIGNER');     // TIER_1 ladder[0]
    assert.equal(r.loopCount, 1);
  });

  const fresh = (await iwoRef.get()).data();
  assert.equal(fresh.approvalChain.currentRung, 'DESIGNER');
  assert.equal(fresh.approvalChain.complete, false);
  assert.equal(fresh.approvalChain.history.length, 2);   // INIT + REJECT

  const events = (await db.collection('domain_events').get()).docs.map((d) => d.data());
  const rej = events.find((e) => e.eventType === 'ApprovalRungRejected');
  assert.ok(rej);
  assert.equal(rej.payload.rejectingRung, 'CD');
  assert.equal(rej.payload.loopCountAfter, 1);
  assert.match(rej.payload.notes, /breathing room/);
});

test('rejectRung requires notes', async () => {
  const { db } = makeFirestore();
  await seedDeliveredIwo(db, { iwoId: 'iwo-5' });
  const iwoRef = db.doc('internal_work_orders/iwo-5');
  await assert.rejects(
    () => db.runTransaction((tx) => rejectRung({ tx, db, iwoRef, actorUserId: 'u', notes: '   ' })),
    /requires `notes`/,
  );
});

test('rejection-loop count increments across multiple rejects', async () => {
  const { db } = makeFirestore();
  await seedDeliveredIwo(db, { iwoId: 'iwo-6', tier: 'TIER_2' });
  const iwoRef = db.doc('internal_work_orders/iwo-6');

  // Reject twice
  await db.runTransaction((tx) => rejectRung({
    tx, db, iwoRef, actorUserId: 'u1', notes: 'first miss',
  }));
  await db.runTransaction((tx) => rejectRung({
    tx, db, iwoRef, actorUserId: 'u2', notes: 'second miss',
  }));

  const events = (await db.collection('domain_events').get()).docs
    .map((d) => d.data())
    .filter((e) => e.eventType === 'ApprovalRungRejected');
  assert.equal(events.length, 2);
  assert.equal(events.find((e) => e.payload.loopCountAfter === 1).payload.notes, 'first miss');
  assert.equal(events.find((e) => e.payload.loopCountAfter === 2).payload.notes, 'second miss');
});

// ----- acceptInternal gate --------------------------------------------

test('acceptInternal: gated when approvalChain not yet granted', async () => {
  const { db } = makeFirestore();
  // Seed IWO at DELIVERED with an in-flight chain (currentRung=DESIGNER, not complete).
  const chain = buildInitialChain({ tier: 'TIER_2', actorUserId: 'system' });
  await db.doc('internal_work_orders/iwo-gate-1').set({
    id: 'iwo-gate-1',
    masterJobId: 'mj-gate-1',
    state: 'DELIVERED',
    subsidiaryOrgId: 'zeus-the-agency',
    approvalChain: chain,
  });
  await db.doc('internal_work_orders/iwo-gate-1/handoff_packet/packet').set({
    acceptanceCriteria: [{ id: 'c1', required: true, signedByUserId: 'am-user' }],
  });

  await assert.rejects(
    () => runAcceptInternal({
      db,
      auth: auth.am,
      data: { iwoId: 'iwo-gate-1' },
    }),
    /ECD approval ladder not yet granted/,
  );
});

test('acceptInternal: passes when approvalChain.complete=true', async () => {
  const { db } = makeFirestore();
  const chain = buildInitialChain({ tier: 'TIER_2', actorUserId: 'system' });
  chain.complete = true;
  chain.currentRung = 'ECD';
  chain.completedAt = '2026-05-24T12:00:00Z';
  await db.doc('internal_work_orders/iwo-gate-2').set({
    id: 'iwo-gate-2',
    masterJobId: 'mj-gate-2',
    state: 'DELIVERED',
    subsidiaryOrgId: 'zeus-the-agency',
    approvalChain: chain,
  });
  await db.doc('internal_work_orders/iwo-gate-2/handoff_packet/packet').set({
    acceptanceCriteria: [{ id: 'c1', required: true, signedByUserId: 'am-user' }],
  });

  const r = await runAcceptInternal({
    db,
    auth: { uid: 'am-1', token: { isParentOrg: true } },
    data: { iwoId: 'iwo-gate-2' },
  });
  assert.equal(r.status, 'ACCEPTED_INTERNALLY');
});

test('acceptInternal: legacy IWO without approvalChain → not gated (back-compat)', async () => {
  const { db } = makeFirestore();
  // Legacy IWO created pre-6.D has no approvalChain.
  await db.doc('internal_work_orders/iwo-legacy').set({
    id: 'iwo-legacy',
    masterJobId: 'mj-legacy',
    state: 'DELIVERED',
    subsidiaryOrgId: 'zeus-the-agency',
  });
  await db.doc('internal_work_orders/iwo-legacy/handoff_packet/packet').set({
    acceptanceCriteria: [{ id: 'c1', required: true, signedByUserId: 'am' }],
  });

  const r = await runAcceptInternal({
    db,
    auth: { uid: 'am-1', token: { isParentOrg: true } },
    data: { iwoId: 'iwo-legacy' },
  });
  assert.equal(r.status, 'ACCEPTED_INTERNALLY');
});

// ----- isApprovalGranted predicate ------------------------------------

test('isApprovalGranted: false on null, in-flight, false flag; true on complete', () => {
  assert.equal(isApprovalGranted(null), false);
  assert.equal(isApprovalGranted(undefined), false);
  assert.equal(isApprovalGranted({ complete: false }), false);
  assert.equal(isApprovalGranted({ complete: true }), true);
});
