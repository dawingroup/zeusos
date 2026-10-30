/**
 * Memo tasks — a memo goes to the people it is addressed to, through the
 * people it names under Through, and never back to its author. Each step is
 * ONE task in `generated_tasks` (Phase 6.E vocabulary) with a deterministic
 * id, so the step's task is completed by the same key when the memo moves on.
 *
 *   memo_clear:{memoId}:{uid}     the current Through party (kind review)
 *   memo_approval:{memoId}:{uid}  each addressee while at decision (kind approval)
 *   memo_returned:{memoId}:{v}    the author: version v was sent back (kind notify)
 *   memo_ack:{memoId}:{uid}       an issued memo reached them (kind notify)
 *
 * Mirror of the keys: src/modules/memos/utils/memoTasks.ts (lockstep-tested).
 *
 * `syncMemoTasks(db, memoId, before, after)` is run by the memoAction
 * callable after every transition; it never throws (the memo write stands).
 */
const { logger } = require('firebase-functions');
const { TASKS_COLLECTION, ASSIGNED_STATUS, isTerminalStatus, historyEntry, systemCloseFields } = require('../../event-task-engine/lib/taskModel');
const { MEMOS_COLLECTION, issueRecipients, memoLabel } = require('./memoModel');
const { holderKey } = require('./memoRoute');
const { isAtLeastAsSenior, resolveMemoApproval, loadMemoRoutingConfig } = require('./memoApprovalRouting');

const SYSTEM_ACTOR = 'system:memo-routing';
const OUTCOME_LABEL = { approved: 'approved', rejected: 'not approved', modified: 'approved with conditions' };
// Most senior first: who may be asked when nobody holds the band's tier.
const WIDENED_CHAIN = ['owner', 'admin', 'manager'];
const HOURS = 3600000;

function clearDedupeKey(memoId, uid) { return `memo_clear:${memoId}:${uid}`; }
function approvalDedupeKey(memoId, uid) { return `memo_approval:${memoId}:${uid}`; }
function returnedDedupeKey(memoId, version) { return `memo_returned:${memoId}:${version}`; }
function ackDedupeKey(memoId, uid) { return `memo_ack:${memoId}:${uid}`; }

/** Deterministic, URL-safe task id for a memo step. */
function memoTaskId(dedupeKey) {
  return `memo__${String(dedupeKey).replace(/:/g, '__')}`;
}

// ── task writes ─────────────────────────────────────────────────────────────

/**
 * Create the task for a step, or re-open it when the same step comes round
 * again (a returned memo resubmitted to the same clearer). An open task for
 * the key is left as it is.
 */
async function upsertMemoTask(db, input, nowIso) {
  const id = memoTaskId(input.dedupeKey);
  const ref = db.collection(TASKS_COLLECTION).doc(id);
  const snap = await ref.get();
  const existing = snap.exists ? snap.data() : null;
  if (existing && !isTerminalStatus(existing.status)) return { id, created: false, reopened: false };

  if (existing) {
    await ref.update({
      status: ASSIGNED_STATUS,
      title: input.title,
      description: input.description,
      priority: input.priority,
      dueAt: input.dueAt || null,
      assignedToUserId: input.assignedToUserId,
      assignedToName: input.assignedToName || null,
      outcome: null,
      outcomeBy: null,
      outcomeAt: null,
      completedAt: null,
      closedBy: null,
      autoClosedAt: null,
      autoClosedReason: null,
      reopenedAt: nowIso,
      metadata: input.metadata || {},
      history: [
        ...(Array.isArray(existing.history) ? existing.history : []),
        historyEntry({ fromStatus: existing.status, toStatus: ASSIGNED_STATUS, actorUserId: SYSTEM_ACTOR, notes: 'memo came round again', nowIso }),
      ],
      updatedAt: nowIso,
    });
    return { id, created: false, reopened: true };
  }

  await ref.set({
    id,
    title: input.title,
    description: input.description,
    priority: input.priority,
    status: ASSIGNED_STATUS,
    kind: input.kind,
    dueAt: input.dueAt || null,
    assignedToUserId: input.assignedToUserId,
    assignedToName: input.assignedToName || null,
    assignedAt: nowIso,
    assignedBy: SYSTEM_ACTOR,
    assignmentMethod: 'rule',
    pendingAssignmentRule: null,
    sourceEventId: null,
    sourceEventType: null,
    sourceDefinitionId: null,
    sourceRuleId: null,
    sourceModule: 'memos',
    source: 'memo',
    entityType: 'memo',
    entityId: input.memoId,
    entityName: input.entityName || null,
    masterJobId: null,
    iwoId: null,
    brandId: input.brandId || null,
    category: 'memo',
    estimateMinutes: input.estimateMinutes || null,
    metadata: input.metadata || {},
    history: [historyEntry({ fromStatus: null, toStatus: ASSIGNED_STATUS, actorUserId: SYSTEM_ACTOR, notes: input.reason || 'memo step', nowIso })],
    idempotencyKey: input.dedupeKey,
    createdBy: SYSTEM_ACTOR,
    createdAt: nowIso,
    updatedAt: nowIso,
  });
  return { id, created: true, reopened: false };
}

async function completeMemoTask(db, dedupeKey, note, nowIso) {
  const ref = db.collection(TASKS_COLLECTION).doc(memoTaskId(dedupeKey));
  const snap = await ref.get();
  if (!snap.exists) return false;
  const task = snap.data();
  if (isTerminalStatus(task.status)) return false;
  await ref.update(systemCloseFields(task, { status: 'completed', outcome: 'completed', reason: note, closedBy: SYSTEM_ACTOR, nowIso }));
  return true;
}

// ── directory lookups ───────────────────────────────────────────────────────

const USER_COLLECTIONS = ['users', 'organizations/default/users'];

/** Directory globalRole for an auth uid; null when unknown. Best effort. */
async function directoryRoleForUid(db, uid) {
  if (!uid) return null;
  for (const col of USER_COLLECTIONS) {
    try {
      const snap = await db.collection(col).doc(uid).get();
      if (snap.exists && snap.data().globalRole) return snap.data().globalRole;
    } catch { /* fall through */ }
  }
  try {
    const q = await db.collection('users').where('uid', '==', uid).limit(1).get();
    if (!q.empty && q.docs[0].data().globalRole) return q.docs[0].data().globalRole;
  } catch { /* unknown */ }
  return null;
}

/**
 * The first active person holding one of `roles`, in role order, sorted by
 * email so repeated runs pick the same person. Never one of `excludeUids`.
 */
async function findUserByGlobalRole(db, roles, { excludeUids = [] } = {}) {
  for (const role of roles) {
    const seen = new Set();
    const people = [];
    for (const col of USER_COLLECTIONS) {
      let snap;
      try { snap = await db.collection(col).where('globalRole', '==', role).get(); } catch { continue; }
      for (const d of snap.docs) {
        const u = d.data() || {};
        const uid = u.uid || d.id;
        if (seen.has(uid) || excludeUids.includes(uid) || u.isActive === false) continue;
        seen.add(uid);
        people.push({ uid, name: u.displayName || u.name || u.email || uid, email: u.email || null });
      }
    }
    people.sort((a, b) => String(a.email || '').localeCompare(String(b.email || '')));
    if (people.length) return { ...people[0], matchedRole: role };
  }
  return null;
}

// ── route by role / tier stamp ──────────────────────────────────────────────

function memoRef(db, memoId) {
  return db.collection(MEMOS_COLLECTION).doc(memoId);
}

/**
 * Nobody addressable under To: pick a decider by the tier's role chain,
 * excluding the author — widened down to manager when only the author holds
 * the tier; nobody at all → `approval.unroutable`. Returns the updated memo
 * when it wrote one, else null.
 */
async function routeByRole(db, memoId, memo, nowIso) {
  const a = memo.approval || {};
  if (a.required === false || (a.deciderUids || []).length || a.unroutable) return null;

  const config = await loadMemoRoutingConfig(db);
  const resolution = resolveMemoApproval(memo, config);
  const chain = resolution.roleChain || a.roleChain || ['manager', 'admin', 'owner'];
  let picked = await findUserByGlobalRole(db, chain, { excludeUids: [memo.createdBy] });
  if (!picked) {
    const below = WIDENED_CHAIN.filter((r) => !chain.includes(r));
    if (below.length) picked = await findUserByGlobalRole(db, below, { excludeUids: [memo.createdBy] });
  }
  if (!picked) {
    const approval = { ...a, unroutable: 'Nobody under To has a ZeusOS login, and nobody other than the author holds a manager role or above' };
    await memoRef(db, memoId).update({ approval, updatedAt: nowIso });
    logger.warn('[MemoRouting] no decider other than the author', { memoId, chain });
    return { ...memo, approval };
  }
  const party = { uid: picked.uid, name: picked.name };
  if (picked.email) party.email = picked.email;
  const approval = {
    ...a,
    route: { ...(a.route || { source: 'role', clearance: [] }), deciders: [party] },
    deciderUids: [picked.uid],
    routedTo: { uid: picked.uid, name: picked.name, email: picked.email || null, matchedRole: picked.matchedRole || null },
  };
  const routeUids = [...new Set([...(memo.routeUids || []), picked.uid])];
  await memoRef(db, memoId).update({ approval, routeUids, updatedAt: nowIso });
  logger.info('[MemoRouting] nobody addressable under To — decider picked by role', { memoId, matchedRole: picked.matchedRole });
  return { ...memo, approval, routeUids };
}

/** Stamp each decider's directory role against the tier the memo calls for. */
async function stampTier(db, memoId, memo, nowIso) {
  const a = memo.approval || {};
  if (a.required === false || a.deciderRoles || !(a.deciderUids || []).length) return memo;
  const roles = {};
  for (const uid of a.deciderUids) roles[uid] = await directoryRoleForUid(db, uid);
  const tier = a.effectiveRole;
  const tierMet = tier ? a.deciderUids.every((uid) => roles[uid] && isAtLeastAsSenior(roles[uid], tier)) : null;
  const approval = { ...a, deciderRoles: roles, tierMet };
  await memoRef(db, memoId).update({ approval, updatedAt: nowIso });
  if (tierMet === false) logger.warn('[MemoRouting] memo addressed below the tier it calls for', { memoId, tier, roles });
  return { ...memo, approval };
}

// ── the task for whoever holds the memo ─────────────────────────────────────

function partyName(memo, uid) {
  const r = (memo.approval && memo.approval.route) || {};
  const p = [...(r.clearance || []), ...(r.deciders || [])].find((x) => x.uid === uid);
  return (p && p.name) || '';
}

function amountLabel(memo) {
  if (!(Number(memo.amountMinor) > 0)) return '';
  return ` (${memo.currency || ''} ${Number(memo.amountMinor).toLocaleString('en-US')} minor units)`;
}

function dueIn(nowIso, hours) {
  return new Date(Date.parse(nowIso) + hours * HOURS).toISOString();
}

async function assignClearance(db, memoId, memo, uid, nowIso) {
  const a = memo.approval || {};
  const i = a.clearanceIndex || 0;
  const total = (a.clearanceUids || []).length;
  const next = i + 1 < total
    ? `then to ${partyName(memo, a.clearanceUids[i + 1]) || 'the next person'}`
    : a.required === false ? 'then it is issued' : 'then to the people it is addressed to';
  await upsertMemoTask(db, {
    memoId,
    dedupeKey: clearDedupeKey(memoId, uid),
    title: `Clear memo ${memoLabel(memo)}`,
    description: `${memo.createdByName || 'A colleague'} sent a ${memo.type} memo through you — "${memo.subject}". `
      + `Read it and clear it, or send it back to the author with a reason (${next}).`,
    priority: memo.impact === 'high' ? 'P1' : 'P2',
    kind: 'review',
    dueAt: dueIn(nowIso, 48),
    assignedToUserId: uid,
    assignedToName: partyName(memo, uid),
    entityName: memo.subject,
    brandId: memo.subsidiaryId || null,
    estimateMinutes: 15,
    reason: 'memo at clearance',
    metadata: { memoNumber: memo.memoNumber || null, step: i + 1, steps: total, actorUid: memo.createdBy || null },
  }, nowIso);
}

async function assignDecision(db, memoId, memo, nowIso) {
  const a = memo.approval || {};
  const others = (a.deciderUids || []).length > 1 ? ' Any one of the people it is addressed to may decide.' : '';
  const cleared = (a.clearances || []).filter((c) => c.outcome === 'cleared').map((c) => c.name);
  const through = cleared.length ? ` Cleared by ${cleared.join(', ')}.` : '';
  for (const uid of a.deciderUids || []) {
    await upsertMemoTask(db, {
      memoId,
      dedupeKey: approvalDedupeKey(memoId, uid),
      title: `Decide memo ${memoLabel(memo)}`,
      description: `${memo.createdByName || 'A colleague'} addressed a ${memo.type} memo${amountLabel(memo)} to you — "${memo.subject}".${through} `
        + `Open the memo to approve, approve with conditions, or decline; your decision is signed on the memo itself.${others}`,
      priority: memo.impact === 'high' ? 'P1' : 'P2',
      kind: 'approval',
      dueAt: dueIn(nowIso, 48),
      assignedToUserId: uid,
      assignedToName: partyName(memo, uid),
      entityName: memo.subject,
      brandId: memo.subsidiaryId || null,
      estimateMinutes: 20,
      reason: 'memo awaiting decision',
      metadata: {
        memoNumber: memo.memoNumber || null,
        type: memo.type,
        category: memo.category,
        impact: memo.impact,
        amountMinor: Number(memo.amountMinor) || 0,
        currency: memo.currency || null,
        effectiveRole: a.effectiveRole || null,
        routeSource: (a.route && a.route.source) || null,
        actorUid: memo.createdBy || null,
      },
    }, nowIso);
  }
}

async function syncHolderTasks(db, memoId, before, after, nowIso) {
  const was = holderKey(before);
  const now = holderKey(after);
  if (was === now) return;
  const b = (before && before.status === 'submitted' && before.approval) || null;
  if (b && b.stage === 'clearance') {
    const prev = (b.clearanceUids || [])[b.clearanceIndex || 0];
    if (prev) await completeMemoTask(db, clearDedupeKey(memoId, prev), 'Cleared', nowIso);
  }
  const a = after.approval || {};
  if (a.stage === 'clearance') {
    const uid = (a.clearanceUids || [])[a.clearanceIndex || 0];
    if (uid) await assignClearance(db, memoId, after, uid, nowIso);
  } else if (a.stage === 'decision') {
    await assignDecision(db, memoId, after, nowIso);
  }
  logger.info('[MemoRouting] memo moved on', { memoId, from: was, to: now });
}

// ── leaving submitted ───────────────────────────────────────────────────────

async function closeRoute(db, memoId, before, after, nowIso) {
  const a = (before && before.approval) || {};
  // submit clears `returned`, so one that appears on this write is new.
  const returned = after.status === 'rejected' && after.returned && !(before && before.returned) ? after.returned : null;
  const decided = !returned && ['approved', 'rejected', 'modified'].includes(after.status);
  const decision = (decided && after.decision) || {};
  const note = returned ? `Sent back by ${returned.byName}`
    : after.status === 'withdrawn' ? 'Memo withdrawn'
      : after.status === 'issued' ? 'Memo issued'
        : `Memo ${OUTCOME_LABEL[decision.outcome] || after.status} by ${decision.signedByName || decision.signedBy || 'unknown'}`;

  for (const uid of a.clearanceUids || []) await completeMemoTask(db, clearDedupeKey(memoId, uid), note, nowIso);
  for (const uid of a.deciderUids || []) await completeMemoTask(db, approvalDedupeKey(memoId, uid), note, nowIso);

  if (returned && after.createdBy) {
    await upsertMemoTask(db, {
      memoId,
      dedupeKey: returnedDedupeKey(memoId, after.version || 0),
      title: `Memo sent back ${memoLabel(after)}`,
      description: `${returned.byName} sent your memo "${after.subject}" back: ${returned.note}. Reopen it as a draft, revise and resubmit.`,
      priority: 'P2',
      kind: 'notify',
      dueAt: dueIn(nowIso, 24),
      assignedToUserId: after.createdBy,
      assignedToName: after.createdByName || '',
      entityName: after.subject,
      brandId: after.subsidiaryId || null,
      reason: 'memo sent back',
      metadata: { memoNumber: after.memoNumber || null, returnedBy: returned.by, actorUid: returned.by || null },
    }, nowIso);
  }

  // Audit: was the signer at least as senior as the tier asked for?
  const required = after.approval && after.approval.effectiveRole;
  if (decided && required && decision.signedBy) {
    const role = await directoryRoleForUid(db, decision.signedBy);
    const check = role && isAtLeastAsSenior(role, required) ? 'ok' : 'junior';
    await memoRef(db, memoId).update({ approval: { ...(after.approval || {}), seniorityCheck: check, signerRole: role || null }, updatedAt: nowIso });
    if (check === 'junior') logger.warn('[MemoRouting] memo decided by a signer junior to the routed tier', { memoId, required, role });
  }
}

// ── issue ───────────────────────────────────────────────────────────────────

async function notifyRecipients(db, memoId, memo, nowIso) {
  for (const r of issueRecipients(memo)) {
    const mustAck = r.requiresAck;
    await upsertMemoTask(db, {
      memoId,
      dedupeKey: ackDedupeKey(memoId, r.uid),
      title: mustAck ? `Acknowledge memo ${memoLabel(memo)}` : `Memo issued ${memoLabel(memo)}`,
      description: mustAck
        ? `${memo.createdByName || 'The author'} issued a ${memo.type} memo addressed to you. Read it and acknowledge it on the memo.`
        : r.role === 'to'
          ? `${memo.createdByName || 'The author'} issued a ${memo.type} memo addressed to you.`
          : `${memo.createdByName || 'The author'} issued a ${memo.type} memo and copied you.`,
      priority: mustAck && memo.impact === 'high' ? 'P2' : 'P3',
      kind: 'notify',
      dueAt: mustAck ? dueIn(nowIso, 72) : null,
      assignedToUserId: r.uid,
      assignedToName: r.name,
      entityName: memo.subject,
      brandId: memo.subsidiaryId || null,
      estimateMinutes: 5,
      reason: 'memo issued',
      metadata: { memoNumber: memo.memoNumber || null, requiresAck: mustAck, role: r.role, actorUid: memo.createdBy || null },
    }, nowIso);
  }
}

async function closeAckTasks(db, memoId, before, after, nowIso) {
  const was = new Set(Object.keys((before && before.acknowledgements) || {}));
  for (const uid of Object.keys((after && after.acknowledgements) || {})) {
    if (was.has(uid)) continue;
    const name = (after.acknowledgements[uid] && after.acknowledgements[uid].name) || uid;
    await completeMemoTask(db, ackDedupeKey(memoId, uid), `Acknowledged by ${name}`, nowIso);
  }
}

// ── entry point ─────────────────────────────────────────────────────────────

/**
 * Bring the tasks in line with a memo transition. Returns the memo as it
 * stands after any route-by-role / tier writes. Never throws.
 */
async function syncMemoTasks(db, memoId, before, after, deps = {}) {
  const nowIso = deps.nowIso || new Date().toISOString();
  const log = deps.logger || logger;
  let memo = after;
  try {
    if (!memo) return null;
    if (memo.status === 'submitted') {
      const routed = await routeByRole(db, memoId, memo, nowIso);
      if (routed) memo = routed;
      await syncHolderTasks(db, memoId, before, memo, nowIso);
      memo = await stampTier(db, memoId, memo, nowIso);
    } else if (before && before.status === 'submitted') {
      await closeRoute(db, memoId, before, memo, nowIso);
    }
    if ((!before || before.status !== 'issued') && memo.status === 'issued') {
      await notifyRecipients(db, memoId, memo, nowIso);
    }
    if (memo.status === 'issued') {
      await closeAckTasks(db, memoId, before, memo, nowIso);
    }
  } catch (err) {
    log.error(`[MemoRouting] ${memoId} task sync failed: ${err && err.message}`);
  }
  return memo;
}

module.exports = {
  SYSTEM_ACTOR,
  clearDedupeKey,
  approvalDedupeKey,
  returnedDedupeKey,
  ackDedupeKey,
  memoTaskId,
  upsertMemoTask,
  completeMemoTask,
  directoryRoleForUid,
  findUserByGlobalRole,
  syncMemoTasks,
};
