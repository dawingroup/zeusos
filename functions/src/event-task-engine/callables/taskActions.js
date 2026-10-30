/**
 * Task actions — the ONE write path for a person acting on a task.
 *
 * `generated_tasks` is admin-write in the rules (capability is data; every
 * transition is audited in `history[]`), so the inbox, the focus card and the
 * manager's plan editor all come through here.
 *
 *   taskAction  { taskId, action, note?, reason?, assigneeId?, outcome?, itemId?, completed? }
 *     start · complete · block · unblock · cancel · reopen · claim · assign ·
 *     submit_review · checklist
 *   createTask  { title, description?, priority?, dueAt?|dueDate?, assigneeId?, kind?,
 *                 estimateMinutes?, masterJobId?, iwoId?, brandId?, sourceModule? }
 *
 * Who may act: the assignee, the assignee's manager, the task's creator,
 * or a privileged principal (admin / parent-org). Claiming pool work needs
 * only a staff login. Mark blocked ASKS WHY — a block without a reason is
 * refused, because the reason is what reaches the person who can unblock it.
 */

const { randomUUID } = require('node:crypto');
const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');

const {
  TASKS_COLLECTION, ASSIGNED_STATUS, isOpenStatus, isTerminalStatus, normalisePriority, normaliseStatus,
  assigneeOf, historyEntry, TASK_KINDS,
} = require('../lib/taskModel');
const { reopenFields } = require('../lib/taskReopenPolicy');
const { loadDirectory, resolvePersonUid } = require('../lib/peopleDirectory');
const { endOfWorkingDayIso } = require('../lib/workingTime');
const { requireSignedIn, isPrivileged } = require('../lib/callerAuth');

const REGION = 'europe-west1';
const ACTIONS = new Set(['start', 'complete', 'block', 'unblock', 'cancel', 'reopen', 'claim', 'assign', 'submit_review', 'checklist']);
const OUTCOMES = new Set(['completed', 'approved', 'rejected']);

function str(v, max = 2000) {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
}

/** Who the caller is to this task. */
async function callerRelation(db, auth, task, deps) {
  const uid = auth.uid;
  const assignee = assigneeOf(task);
  const relation = {
    uid,
    isAssignee: Boolean(assignee) && assignee === uid,
    isCreator: task.createdBy === uid,
    isManager: false,
    privileged: await isPrivileged(auth, deps),
  };
  if (!relation.isAssignee && !relation.privileged && assignee) {
    const directory = deps.directory || (await loadDirectory(db, { includeExStaff: true }));
    const rec = directory.get(assignee);
    relation.isManager = Boolean(rec && rec.managerUid && rec.managerUid === uid);
  }
  return relation;
}

function assertAllowed(action, task, rel) {
  const anyRole = rel.isAssignee || rel.isManager || rel.privileged;
  switch (action) {
    case 'claim':
      if (task.status !== 'pending_assignment' && assigneeOf(task)) {
        throw new HttpsError('failed-precondition', 'This task already has an owner.');
      }
      return;
    case 'assign':
      if (anyRole || rel.isCreator) return;
      break;
    case 'cancel':
      if (rel.isManager || rel.privileged || rel.isCreator) return;
      if (rel.isAssignee && task.source === 'personal') return;
      break;
    case 'reopen':
      if (anyRole || rel.isCreator) return;
      break;
    default:
      if (anyRole) return;
  }
  throw new HttpsError('permission-denied', 'Only the assignee, their manager or Account Management can do that to this task.');
}

function tickChecklist(task, itemId, completed, uid, nowIso) {
  const patch = {};
  for (const field of ['checklistItems', 'aiChecklist']) {
    const items = Array.isArray(task[field]) ? task[field] : null;
    if (!items) continue;
    const idx = items.findIndex((i) => i && String(i.id) === String(itemId));
    if (idx === -1) continue;
    const next = items.map((i, n) => (n === idx ? { ...i, completed: Boolean(completed), completedAt: completed ? nowIso : null, completedBy: completed ? uid : null } : i));
    patch[field] = next;
    const done = next.filter((i) => i && i.completed).length;
    patch.checklistProgress = Math.round((done / next.length) * 100);
  }
  if (!Object.keys(patch).length) throw new HttpsError('not-found', 'No checklist item with that id.');
  return patch;
}

/** Required checklist steps still open — Mark done follows the checklist. */
function unmetRequired(task) {
  const items = [...(Array.isArray(task.checklistItems) ? task.checklistItems : []), ...(Array.isArray(task.aiChecklist) ? task.aiChecklist : [])];
  return items.filter((i) => i && i.isRequired === true && !i.completed);
}

/**
 * The transition for one action. PURE given the current task; throws
 * HttpsError on an illegal move. Returns the patch (without history).
 */
function transitionFor(action, task, input, { uid, nowIso, assignee }) {
  const status = normaliseStatus(task.status);
  const open = isOpenStatus(task.status);
  const note = str(input.note || input.reason);
  switch (action) {
    case 'start':
      if (!open || status === 'blocked') throw new HttpsError('failed-precondition', `Cannot start a ${status} task.`);
      return { status: 'in_progress', startedAt: task.startedAt || nowIso, ...(assigneeOf(task) ? {} : { assignedToUserId: uid, assignedAt: nowIso }) };
    case 'complete': {
      if (!open) throw new HttpsError('failed-precondition', `This task is already ${status}.`);
      const outcome = input.outcome && OUTCOMES.has(input.outcome) ? input.outcome : 'completed';
      const unmet = unmetRequired(task);
      if (unmet.length && input.force !== true) {
        throw new HttpsError('failed-precondition', `Finish ${unmet.length} required ${unmet.length === 1 ? 'check' : 'checks'} first: ${unmet.slice(0, 3).map((i) => i.title).join('; ')}`);
      }
      return { status: 'completed', outcome, outcomeBy: uid, outcomeAt: nowIso, completedAt: nowIso, closedBy: uid, ...(note ? { completionNote: note } : {}) };
    }
    case 'block':
      if (!open || status === 'blocked') throw new HttpsError('failed-precondition', `Cannot block a ${status} task.`);
      if (!note || note.length < 3) throw new HttpsError('invalid-argument', 'Say what is blocking this — the reason is what reaches the person who can unblock it.');
      return { status: 'blocked', blockedAt: nowIso, blockedReason: note, blockedBy: uid };
    case 'unblock':
      if (status !== 'blocked') throw new HttpsError('failed-precondition', 'This task is not blocked.');
      return { status: task.startedAt ? 'in_progress' : ASSIGNED_STATUS, unblockedAt: nowIso, lastBlockedReason: task.blockedReason || null, blockedReason: null };
    case 'cancel':
      if (!open) throw new HttpsError('failed-precondition', `This task is already ${status}.`);
      return { status: 'cancelled', outcome: 'cancelled', outcomeBy: uid, outcomeAt: nowIso, completedAt: nowIso, cancelledAt: nowIso, closedBy: uid, ...(note ? { cancelReason: note } : {}) };
    case 'reopen':
      if (!isTerminalStatus(task.status)) throw new HttpsError('failed-precondition', 'This task is still open.');
      return reopenFields(task, { by: uid, reason: note || 'reopened', nowIso });
    case 'claim':
      return { status: ASSIGNED_STATUS, assignedToUserId: uid, assignedAt: nowIso, assignedBy: uid, assignmentMethod: 'claimed', pendingAssignmentRule: null };
    case 'assign': {
      if (!assignee || !assignee.uid) throw new HttpsError('invalid-argument', 'assigneeId must name a person with a ZeusOS login.');
      const previous = assigneeOf(task);
      return {
        status: status === 'pending_assignment' ? ASSIGNED_STATUS : task.status,
        assignedToUserId: assignee.uid,
        assignedToName: assignee.name || null,
        assignedAt: nowIso,
        assignedBy: uid,
        assignmentMethod: 'manual',
        pendingAssignmentRule: null,
        ...(note ? { assignmentReason: note } : {}),
        ...(previous && previous !== assignee.uid ? { reassignedBy: uid, reassignedAt: nowIso, previousAssigneeUserId: previous } : {}),
      };
    }
    case 'submit_review':
      if (!open || status === 'blocked') throw new HttpsError('failed-precondition', `Cannot submit a ${status} task for review.`);
      return { status: 'pending_review', submittedForReviewAt: nowIso };
    case 'checklist':
      return tickChecklist(task, input.itemId, input.completed, uid, nowIso);
    default:
      throw new HttpsError('invalid-argument', `Unknown action ${action}.`);
  }
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {{uid:string, token?:object}} auth
 * @param {object} data
 * @param {{ nowIso?: string, directory?: Map, loadUserDoc?: Function, isParentOrgUser?: Function }} [deps]
 */
async function handleTaskAction(db, auth, data, deps = {}) {
  const input = data || {};
  const taskId = str(input.taskId, 400);
  const action = str(input.action, 40);
  if (!taskId) throw new HttpsError('invalid-argument', 'taskId is required.');
  if (!action || !ACTIONS.has(action)) throw new HttpsError('invalid-argument', `action must be one of ${[...ACTIONS].join(', ')}.`);
  const nowIso = deps.nowIso || new Date().toISOString();

  const ref = db.collection(TASKS_COLLECTION).doc(taskId);
  const first = await ref.get();
  if (!first.exists) throw new HttpsError('not-found', 'Task not found.');
  const rel = await callerRelation(db, auth, first.data(), deps);
  assertAllowed(action, first.data(), rel);

  let assignee = null;
  if (action === 'assign') {
    assignee = await resolvePersonUid(db, str(input.assigneeId, 200));
  }

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Task not found.');
    const task = { id: snap.id, ...snap.data() };
    const patch = transitionFor(action, task, input, { uid: auth.uid, nowIso, assignee });
    const toStatus = patch.status || task.status;
    const history = patch.history || [
      ...(Array.isArray(task.history) ? task.history : []),
      historyEntry({ fromStatus: task.status, toStatus, actorUserId: auth.uid, notes: str(input.note || input.reason) || action, nowIso }),
    ];
    tx.update(ref, { ...patch, history, updatedAt: nowIso });
    return { id: taskId, status: toStatus, action };
  });
}

async function handleCreateTask(db, auth, data, deps = {}) {
  const input = data || {};
  const title = str(input.title, 300);
  if (!title) throw new HttpsError('invalid-argument', 'title is required.');
  const nowIso = deps.nowIso || new Date().toISOString();
  const uid = auth.uid;

  let assignee = { uid, name: null };
  const forSelf = !input.assigneeId || input.assigneeId === uid;
  if (!forSelf) {
    assignee = await resolvePersonUid(db, str(input.assigneeId, 200));
    if (!assignee || !assignee.uid) throw new HttpsError('invalid-argument', 'assigneeId must name a person with a ZeusOS login.');
    if (assignee.uid !== uid && !(await isPrivileged(auth, deps))) {
      const directory = deps.directory || (await loadDirectory(db, { includeExStaff: true }));
      const rec = directory.get(assignee.uid);
      if (!rec || rec.managerUid !== uid) {
        throw new HttpsError('permission-denied', 'You can create tasks for yourself or for people who report to you.');
      }
    }
  }

  let dueAt = null;
  if (str(input.dueAt)) {
    const ms = Date.parse(input.dueAt);
    if (Number.isNaN(ms)) throw new HttpsError('invalid-argument', 'dueAt must be an ISO timestamp.');
    dueAt = new Date(ms).toISOString();
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(String(input.dueDate || ''))) {
    dueAt = endOfWorkingDayIso(input.dueDate);
  }

  const kind = TASK_KINDS.includes(input.kind) ? input.kind : 'action';
  const id = `task_manual_${randomUUID()}`;
  const self = assignee.uid === uid;
  const doc = {
    id,
    title,
    description: str(input.description, 4000),
    priority: normalisePriority(input.priority),
    status: ASSIGNED_STATUS,
    kind,
    dueAt,
    assignedToUserId: assignee.uid,
    assignedToName: assignee.name || null,
    assignedAt: nowIso,
    assignedBy: uid,
    assignmentMethod: self ? 'self' : 'manual',
    pendingAssignmentRule: null,
    sourceEventId: null,
    sourceEventType: null,
    sourceDefinitionId: null,
    sourceRuleId: null,
    sourceModule: str(input.sourceModule, 80) || (self ? 'personal' : 'manual'),
    source: self ? 'personal' : 'manual',
    entityType: str(input.entityType, 80),
    entityId: str(input.entityId, 200),
    entityName: str(input.entityName, 200),
    masterJobId: str(input.masterJobId, 200),
    iwoId: str(input.iwoId, 200),
    brandId: str(input.brandId, 80),
    category: str(input.category, 80),
    estimateMinutes: Number.isFinite(Number(input.estimateMinutes)) && Number(input.estimateMinutes) > 0 ? Math.round(Number(input.estimateMinutes)) : null,
    history: [historyEntry({ fromStatus: null, toStatus: ASSIGNED_STATUS, actorUserId: uid, notes: self ? 'added own task' : 'created by manager', nowIso })],
    idempotencyKey: id,
    createdBy: uid,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  await db.collection(TASKS_COLLECTION).doc(id).set(doc);
  return { id, status: ASSIGNED_STATUS };
}

// ─── onCall wrappers ─────────────────────────────────────────────────────────

function wrap(name, handler) {
  return onCall({ region: REGION, timeoutSeconds: 60, memory: '256MiB' }, async (request) => {
    const auth = requireSignedIn(request, 'act on tasks');
    if (!admin.apps.length) admin.initializeApp();
    try {
      return await handler(admin.firestore(), auth, request.data);
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      logger.error(`[${name}] failed`, err);
      throw new HttpsError('internal', (err && err.message) || `${name} failed`);
    }
  });
}

const taskAction = wrap('taskAction', handleTaskAction);
const createTask = wrap('createTask', handleCreateTask);

module.exports = { taskAction, createTask, handleTaskAction, handleCreateTask, transitionFor, ACTIONS };
