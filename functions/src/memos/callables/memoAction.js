/**
 * `memoAction` — the ONE write path for a memo leaving the author's hands.
 *
 * Drafts are the author's (client writes under the `memos` rules); everything
 * after that moves through here, in a transaction, with a `statusHistory` row,
 * and the tasks for whoever holds the memo next are written in the same call
 * (lib/memoTasks.js). Rules refuse every client write that is not a draft edit.
 *
 *   submit       author · number minted, version written, route planned from
 *                the header, tier resolved; nothing to clear and nobody to
 *                decide → issued in the same call
 *   clear        the Through party whose turn it is · cleared | returned (note)
 *   decide       an addressee (an admin may cover), never the author · signed
 *                with the typed name; conditions verbatim on `modified`
 *   issue        approved / modified, or submitted + cleared · snapshot frozen
 *                with its content hash; a replacement retires what it supersedes
 *   filePdf      record where the rendered PDF landed (additive, once)
 *   withdraw     author or admin (issued: admin only)
 *   reopen       author · rejected → draft, version kept
 *   acknowledge  a recipient of an issued memo
 *
 * Region europe-west1 like the task-engine callables.
 */
const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');

const { requireSignedIn, isAdminCaller } = require('../../event-task-engine/lib/callerAuth');
const {
  MEMOS_COLLECTION, DECISION_OUTCOMES, canTransition, missingRequiredSections, isUnsubmittedDraft, issueRecipients,
} = require('../lib/memoModel');
const { planMemoRoute, routeFieldsForSubmit, stageAfterClearance, currentClearanceUid, canDecideMemo, isClearedForIssue } = require('../lib/memoRoute');
const { resolveMemoApproval, loadMemoRoutingConfig } = require('../lib/memoApprovalRouting');
const { allocateMemoNumber } = require('../lib/memoNumber');
const { buildIssuedSnapshot } = require('../lib/memoSnapshot');
const { syncMemoTasks } = require('../lib/memoTasks');

const REGION = 'europe-west1';
const ACTIONS = new Set(['submit', 'clear', 'decide', 'issue', 'filePdf', 'withdraw', 'reopen', 'acknowledge']);

function str(v, max = 2000) {
  if (typeof v !== 'string') return '';
  const t = v.trim();
  return t.length > max ? t.slice(0, max) : t;
}

function stripUndefined(obj) {
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = stripUndefined(v);
  return out;
}

function statusEvent(from, to, actor, at, note) {
  const e = { from: from || null, to, by: actor.uid, byName: actor.name, at };
  if (note) e.note = note;
  return e;
}

/** `users/{uid}` then `organizations/default/users/{uid}` — the directory profile, if any. */
async function loadUserProfile(db, uid) {
  for (const col of ['users', 'organizations/default/users']) {
    const snap = await db.collection(col).doc(uid).get();
    if (snap.exists) return snap.data() || {};
  }
  return null;
}

async function resolveActor(db, auth, deps) {
  const load = deps.loadUserDoc || ((uid) => loadUserProfile(db, uid));
  const profile = await load(auth.uid);
  const token = auth.token || {};
  const name = str(profile && (profile.displayName || profile.name), 200) || str(token.name, 200) || str(token.email, 200) || auth.uid;
  const email = str(profile && profile.email, 200) || str(token.email, 200) || undefined;
  return stripUndefined({ uid: auth.uid, name, email });
}

function memoRef(db, memoId) {
  return db.collection(MEMOS_COLLECTION).doc(memoId);
}

function notFound() {
  return new HttpsError('not-found', 'Memo not found.');
}

function onRoute(memo, uid) {
  return Array.isArray(memo.routeUids) && memo.routeUids.includes(uid);
}

// ── submit ──────────────────────────────────────────────────────────────────

async function submit(db, memoId, actor, ctx) {
  const { nowIso, isAdmin } = ctx;
  const pre = await memoRef(db, memoId).get();
  if (!pre.exists) throw notFound();
  const memo = pre.data();
  if (memo.status !== 'draft') throw new HttpsError('failed-precondition', `Only a draft can be submitted (this memo is ${memo.status}).`);
  if (memo.createdBy !== actor.uid && !isAdmin) throw new HttpsError('permission-denied', 'Only the author can submit a memo.');
  if (!str(memo.subject)) throw new HttpsError('failed-precondition', 'A memo needs a subject.');
  const header = memo.header || {};
  if (!Array.isArray(header.to) || !header.to.length) throw new HttpsError('failed-precondition', 'Address the memo to at least one person before submitting.');
  const missing = missingRequiredSections(memo.type, memo.sections);
  if (missing.length) throw new HttpsError('failed-precondition', `Complete the required sections before submitting: ${missing.join(', ')}.`);
  if (memo.amountMinor != null) {
    const n = Number(memo.amountMinor);
    if (!Number.isInteger(n) || n < 0) throw new HttpsError('failed-precondition', 'The amount must be a whole number of minor units.');
    if (n > 0 && !/^[A-Z]{3}$/.test(String(memo.currency || ''))) throw new HttpsError('failed-precondition', 'State the currency of the amount.');
  }

  const config = await loadMemoRoutingConfig(db);
  const resolution = resolveMemoApproval(memo, config);
  const plan = planMemoRoute(header, memo.createdBy);
  const needsDecision = resolution.required;
  const hasClearance = plan.route.clearance.length > 0;
  const routed = needsDecision || hasClearance;
  const routeFields = routed ? routeFieldsForSubmit(plan.route, needsDecision) : null;
  const approval = stripUndefined({
    required: resolution.required,
    entityType: resolution.entityType,
    bandId: resolution.bandId || undefined,
    bandLabel: resolution.bandLabel || undefined,
    bandRole: resolution.bandRole,
    impactMinimumRole: resolution.impactMinimumRole,
    typeMinimumRole: resolution.typeMinimumRole,
    effectiveRole: resolution.effectiveRole,
    roleChain: resolution.roleChain,
    raisedBy: resolution.raisedBy,
    currencyMismatch: resolution.currencyMismatch || undefined,
    evaluatedAt: nowIso,
    configVersion: config.version || 0,
    skipped: plan.skipped,
    ...(routeFields ? routeFields.approval : {}),
  });

  const result = await db.runTransaction(async (tx) => {
    const ref = memoRef(db, memoId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw notFound();
    const fresh = snap.data();
    if (fresh.status !== 'draft') throw new HttpsError('aborted', 'The memo changed while submitting — reload and try again.');
    const year = new Date(nowIso).getUTCFullYear();
    const memoNumber = fresh.memoNumber || (await allocateMemoNumber(tx, db, fresh.subsidiaryId, year, nowIso));
    const version = (Number(fresh.version) || 0) + 1;
    const nextStatus = routed ? 'submitted' : 'draft';

    tx.set(db.collection(`${MEMOS_COLLECTION}/${memoId}/versions`).doc(`v${version}`), stripUndefined({
      version,
      header: fresh.header,
      sections: fresh.sections || [],
      links: fresh.links || [],
      attachments: fresh.attachments || [],
      amountMinor: fresh.amountMinor == null ? undefined : Number(fresh.amountMinor),
      currency: fresh.currency || undefined,
      submittedBy: actor.uid,
      submittedAt: nowIso,
    }));

    const update = {
      memoNumber,
      version,
      approval,
      routeUids: routeFields ? routeFields.routeUids : [],
      returned: null,
      submittedAt: nowIso,
      updatedAt: nowIso,
      updatedBy: actor.uid,
    };
    if (nextStatus !== 'draft') {
      update.status = nextStatus;
      update.statusHistory = [...(fresh.statusHistory || []), statusEvent(fresh.status, nextStatus, actor, nowIso)];
    }
    tx.update(ref, update);
    return { before: fresh, after: { ...fresh, ...update }, memoNumber, version, status: nextStatus };
  });

  let after = result.after;
  if (routed) {
    after = (await syncMemoTasks(db, memoId, result.before, after, ctx)) || after;
    return { id: memoId, status: after.status, memoNumber: result.memoNumber, version: result.version, approval: after.approval };
  }
  // Nothing to clear and nobody to decide: numbered and issued in one go.
  const issued = await issue(db, memoId, actor, ctx);
  return { ...issued, memoNumber: result.memoNumber, version: result.version, approval };
}

// ── clear ───────────────────────────────────────────────────────────────────

async function clear(db, memoId, actor, ctx, input) {
  const { nowIso } = ctx;
  const outcome = input.outcome === 'returned' ? 'returned' : input.outcome === 'cleared' ? 'cleared' : null;
  if (!outcome) throw new HttpsError('invalid-argument', 'outcome must be "cleared" or "returned".');
  const note = str(input.note, 2000) || undefined;
  if (outcome === 'returned' && !note) throw new HttpsError('invalid-argument', 'Say why you are sending the memo back.');

  const result = await db.runTransaction(async (tx) => {
    const ref = memoRef(db, memoId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw notFound();
    const memo = snap.data();
    const due = currentClearanceUid(memo);
    if (!due) throw new HttpsError('failed-precondition', `This memo is not waiting to be cleared (it is ${memo.status}).`);
    if (due !== actor.uid) throw new HttpsError('permission-denied', 'It is not your turn to clear this memo.');
    const a = memo.approval || {};
    const clearance = stripUndefined({ uid: actor.uid, name: actor.name, outcome, note, at: nowIso });
    const clearances = [...(a.clearances || []), clearance];
    let update;
    if (outcome === 'returned') {
      const returned = { by: actor.uid, byName: actor.name, note, at: nowIso };
      update = {
        approval: { ...a, clearances },
        status: 'rejected',
        returned,
        statusHistory: [...(memo.statusHistory || []), statusEvent(memo.status, 'rejected', actor, nowIso, `Sent back: ${note}`)],
        updatedAt: nowIso,
        updatedBy: actor.uid,
      };
    } else {
      const nextIndex = (a.clearanceIndex || 0) + 1;
      const done = nextIndex >= (a.clearanceUids || []).length;
      const stage = done ? stageAfterClearance(a.required !== false) : 'clearance';
      update = { approval: { ...a, clearances, clearanceIndex: nextIndex, stage }, updatedAt: nowIso, updatedBy: actor.uid };
    }
    tx.update(ref, update);
    return { before: memo, after: { ...memo, ...update } };
  });
  const after = (await syncMemoTasks(db, memoId, result.before, result.after, ctx)) || result.after;
  const stage = outcome === 'returned' ? 'returned' : after.approval.stage;
  return { id: memoId, status: after.status, stage };
}

// ── decide ──────────────────────────────────────────────────────────────────

async function decide(db, memoId, actor, ctx, input) {
  const { nowIso, isAdmin } = ctx;
  const outcome = DECISION_OUTCOMES.includes(input.outcome) ? input.outcome : null;
  if (!outcome) throw new HttpsError('invalid-argument', 'outcome must be approved, rejected or modified.');
  const conditions = str(input.conditions, 4000) || undefined;
  if (outcome === 'modified' && !conditions) throw new HttpsError('invalid-argument', 'State the conditions when approving with modifications.');
  const signedNameTyped = str(input.signedName, 200);
  if (!signedNameTyped) throw new HttpsError('invalid-argument', 'Type your name to sign the decision.');
  const notes = str(input.notes, 2000) || undefined;

  const result = await db.runTransaction(async (tx) => {
    const ref = memoRef(db, memoId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw notFound();
    const memo = snap.data();
    if (memo.status !== 'submitted') throw new HttpsError('failed-precondition', `This memo is ${memo.status}, not awaiting a decision.`);
    if (memo.createdBy === actor.uid) throw new HttpsError('permission-denied', 'The author of a memo cannot decide it.');
    if (memo.approval && memo.approval.stage === 'clearance') throw new HttpsError('failed-precondition', 'This memo has not been cleared by everyone it goes through yet.');
    if (!canDecideMemo(memo, actor.uid, isAdmin)) throw new HttpsError('permission-denied', 'Only the people this memo is addressed to can decide it.');
    if (!canTransition(memo.status, outcome)) throw new HttpsError('failed-precondition', `Memo cannot move from '${memo.status}' to '${outcome}'.`);
    const decision = stripUndefined({
      outcome, conditions, notes, signedBy: actor.uid, signedByName: actor.name, signedNameTyped, signatureMethod: 'typed', at: nowIso,
      coveredAsAdmin: !((memo.approval && memo.approval.deciderUids) || []).includes(actor.uid) || undefined,
    });
    const update = {
      status: outcome,
      decision,
      decidedAt: nowIso,
      statusHistory: [...(memo.statusHistory || []), statusEvent(memo.status, outcome, actor, nowIso, conditions)],
      updatedAt: nowIso,
      updatedBy: actor.uid,
    };
    tx.update(ref, update);
    return { before: memo, after: { ...memo, ...update } };
  });
  await syncMemoTasks(db, memoId, result.before, result.after, ctx);
  return { id: memoId, status: result.after.status, outcome };
}

// ── issue ───────────────────────────────────────────────────────────────────

async function issue(db, memoId, actor, ctx) {
  const { nowIso, isAdmin } = ctx;
  const result = await db.runTransaction(async (tx) => {
    const ref = memoRef(db, memoId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw notFound();
    const memo = snap.data();
    if (memo.issuedSnapshot) throw new HttpsError('failed-precondition', 'This memo has already been issued.');
    if (!memo.memoNumber) throw new HttpsError('failed-precondition', 'Submit the memo before issuing it.');
    const noDecisionDraft = memo.status === 'draft' && memo.approval && memo.approval.required === false && !(memo.routeUids || []).length;
    const decided = memo.status === 'approved' || memo.status === 'modified';
    if (!(decided || isClearedForIssue(memo) || noDecisionDraft)) {
      if (memo.status === 'submitted') throw new HttpsError('failed-precondition', 'This memo is still on its route — it can be issued once it has been cleared or decided.');
      throw new HttpsError('failed-precondition', `A ${memo.status} memo cannot be issued.`);
    }
    if (!(isAdmin || memo.createdBy === actor.uid || onRoute(memo, actor.uid))) {
      throw new HttpsError('permission-denied', 'Only the author, someone on the route or an admin can issue this memo.');
    }
    // Reads before writes: the memo this one replaces.
    let oldRef = null;
    let old = null;
    if (memo.supersedes) {
      oldRef = memoRef(db, memo.supersedes);
      const oldSnap = await tx.get(oldRef);
      old = oldSnap.exists ? oldSnap.data() : null;
    }
    const issuedSnapshot = buildIssuedSnapshot(memo, { issuedAt: nowIso, issuedBy: actor.uid });
    const update = {
      status: 'issued',
      issuedSnapshot,
      issuedAt: nowIso,
      statusHistory: [...(memo.statusHistory || []), statusEvent(memo.status, 'issued', actor, nowIso)],
      updatedAt: nowIso,
      updatedBy: actor.uid,
    };
    tx.update(ref, update);
    let superseded = null;
    if (old && canTransition(old.status, 'superseded')) {
      tx.update(oldRef, {
        status: 'superseded',
        supersededBy: memoId,
        statusHistory: [...(old.statusHistory || []), statusEvent(old.status, 'superseded', actor, nowIso, `Superseded by ${memo.memoNumber}`)],
        updatedAt: nowIso,
        updatedBy: actor.uid,
      });
      superseded = memo.supersedes;
    }
    return { before: memo, after: { ...memo, ...update }, superseded };
  });
  await syncMemoTasks(db, memoId, result.before, result.after, ctx);
  return { id: memoId, status: 'issued', contentHash: result.after.issuedSnapshot.contentHash, superseded: result.superseded };
}

// ── filePdf ─────────────────────────────────────────────────────────────────

async function filePdf(db, memoId, actor, ctx, input) {
  const { nowIso, isAdmin } = ctx;
  const storagePath = str(input.storagePath, 500);
  const url = str(input.url, 2000);
  if (!storagePath || !url) throw new HttpsError('invalid-argument', 'storagePath and url are required.');
  await db.runTransaction(async (tx) => {
    const ref = memoRef(db, memoId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw notFound();
    const memo = snap.data();
    if (memo.status !== 'issued' || !memo.issuedSnapshot) throw new HttpsError('failed-precondition', 'Only an issued memo files a PDF.');
    if (!(isAdmin || memo.createdBy === actor.uid || onRoute(memo, actor.uid))) throw new HttpsError('permission-denied', 'Only the author, someone on the route or an admin can file the PDF.');
    if (memo.issuedSnapshot.pdfStoragePath && !isAdmin) throw new HttpsError('failed-precondition', 'The PDF for this memo is already filed.');
    tx.update(ref, {
      issuedSnapshot: { ...memo.issuedSnapshot, pdfStoragePath: storagePath, pdfUrl: url, pdfFiledAt: nowIso, pdfFiledBy: actor.uid },
      updatedAt: nowIso,
      updatedBy: actor.uid,
    });
  });
  return { id: memoId, status: 'issued', pdfUrl: url };
}

// ── withdraw / reopen / acknowledge ─────────────────────────────────────────

async function withdraw(db, memoId, actor, ctx, input) {
  const { nowIso, isAdmin } = ctx;
  const note = str(input.note, 2000) || undefined;
  const result = await db.runTransaction(async (tx) => {
    const ref = memoRef(db, memoId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw notFound();
    const memo = snap.data();
    if (!canTransition(memo.status, 'withdrawn')) throw new HttpsError('failed-precondition', `A ${memo.status} memo cannot be withdrawn.`);
    if (isUnsubmittedDraft(memo)) throw new HttpsError('failed-precondition', 'An unsubmitted draft is deleted, not withdrawn.');
    const author = memo.createdBy === actor.uid;
    if (memo.status === 'issued' && !isAdmin) throw new HttpsError('permission-denied', 'Only an admin can withdraw an issued memo.');
    if (!author && !isAdmin) throw new HttpsError('permission-denied', 'Only the author or an admin can withdraw a memo.');
    const update = {
      status: 'withdrawn',
      withdrawnAt: nowIso,
      statusHistory: [...(memo.statusHistory || []), statusEvent(memo.status, 'withdrawn', actor, nowIso, note)],
      updatedAt: nowIso,
      updatedBy: actor.uid,
    };
    tx.update(ref, update);
    return { before: memo, after: { ...memo, ...update } };
  });
  await syncMemoTasks(db, memoId, result.before, result.after, ctx);
  return { id: memoId, status: 'withdrawn' };
}

async function reopen(db, memoId, actor, ctx) {
  const { nowIso, isAdmin } = ctx;
  await db.runTransaction(async (tx) => {
    const ref = memoRef(db, memoId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw notFound();
    const memo = snap.data();
    if (!canTransition(memo.status, 'draft')) throw new HttpsError('failed-precondition', `A ${memo.status} memo cannot be reopened as a draft.`);
    if (memo.createdBy !== actor.uid && !isAdmin) throw new HttpsError('permission-denied', 'Only the author can reopen a memo.');
    tx.update(ref, {
      status: 'draft',
      statusHistory: [...(memo.statusHistory || []), statusEvent(memo.status, 'draft', actor, nowIso)],
      updatedAt: nowIso,
      updatedBy: actor.uid,
    });
  });
  return { id: memoId, status: 'draft' };
}

async function acknowledge(db, memoId, actor, ctx) {
  const { nowIso } = ctx;
  const result = await db.runTransaction(async (tx) => {
    const ref = memoRef(db, memoId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw notFound();
    const memo = snap.data();
    if (memo.status !== 'issued') throw new HttpsError('failed-precondition', 'Only an issued memo can be acknowledged.');
    const recipient = issueRecipients(memo).some((r) => r.uid === actor.uid) || (memo.distributionUids || []).includes(actor.uid);
    if (!recipient) throw new HttpsError('permission-denied', 'This memo was not sent to you.');
    if (memo.acknowledgements && memo.acknowledgements[actor.uid]) return { before: memo, after: memo, already: true };
    const acknowledgements = { ...(memo.acknowledgements || {}), [actor.uid]: { name: actor.name, at: nowIso, method: 'in_app' } };
    const update = { acknowledgements, updatedAt: nowIso, updatedBy: actor.uid };
    tx.update(ref, update);
    return { before: memo, after: { ...memo, ...update }, already: false };
  });
  if (!result.already) await syncMemoTasks(db, memoId, result.before, result.after, ctx);
  return { id: memoId, status: 'issued', acknowledgedAt: result.already ? result.after.acknowledgements[actor.uid].at : nowIso };
}

// ── dispatcher ──────────────────────────────────────────────────────────────

async function handleMemoAction(db, auth, data, deps = {}) {
  const input = data || {};
  const action = str(input.action, 40);
  if (!ACTIONS.has(action)) throw new HttpsError('invalid-argument', `Unknown memo action "${action}".`);
  const memoId = str(input.memoId, 200);
  if (!memoId) throw new HttpsError('invalid-argument', 'memoId is required.');

  const nowIso = deps.nowIso || new Date().toISOString();
  const isAdmin = await isAdminCaller(auth, { loadUserDoc: deps.loadUserDoc || ((uid) => loadUserProfile(db, uid)) });
  const actor = await resolveActor(db, auth, deps);
  const ctx = { nowIso, isAdmin, logger: deps.logger || logger };

  switch (action) {
    case 'submit': return submit(db, memoId, actor, ctx);
    case 'clear': return clear(db, memoId, actor, ctx, input);
    case 'decide': return decide(db, memoId, actor, ctx, input);
    case 'issue': return issue(db, memoId, actor, ctx);
    case 'filePdf': return filePdf(db, memoId, actor, ctx, input);
    case 'withdraw': return withdraw(db, memoId, actor, ctx, input);
    case 'reopen': return reopen(db, memoId, actor, ctx);
    case 'acknowledge': return acknowledge(db, memoId, actor, ctx);
    default: throw new HttpsError('invalid-argument', `Unknown memo action "${action}".`);
  }
}

const memoAction = onCall({ region: REGION, timeoutSeconds: 60, memory: '256MiB' }, async (request) => {
  const auth = requireSignedIn(request, 'act on memos');
  if (!admin.apps.length) admin.initializeApp();
  try {
    return await handleMemoAction(admin.firestore(), auth, request.data);
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error('[memoAction] failed', err);
    throw new HttpsError('internal', (err && err.message) || 'memoAction failed');
  }
});

module.exports = { memoAction, handleMemoAction, ACTIONS };
