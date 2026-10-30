/**
 * Who owns a task whose rule named a role, a department or "the actor's
 * manager" rather than a person (`pendingAssignmentRule`, written by
 * generateTasksForEvent when it cannot resolve a uid synchronously).
 *
 * The rule: a task goes to the role it names; if nobody holds that role it
 * goes to the owner, who can reassign it. It never sits unowned for long —
 * DawinOS audit 2026-09-11: 237 of 309 open tasks had no owner because the
 * role nobody held was never retried.
 *
 *   role            role_assignment where roleProfileId == X and status active
 *                   → employees → uids; brand-matched when the task carries a
 *                   brandId; least loaded first.
 *   department      employees.position.departmentId == X; same ranking.
 *   manager_of_actor the event actor's manager (directory).
 *   dynamic         the owner (criteria resolution is a later phase).
 *
 * `db` passed in; the directory and role assignments are loaded once per run.
 */

const { TASKS_COLLECTION, ACTIVE_STATUSES, ASSIGNED_STATUS, assigneeOf, historyEntry } = require('./taskModel');
const { loadDirectory, findOwnerUser } = require('./peopleDirectory');
const { deescalatedPriority } = require('./taskPriority');

const ROLE_ASSIGNMENTS_COLLECTION = 'role_assignment';

async function loadRoleAssignments(db) {
  const snap = await db.collection(ROLE_ASSIGNMENTS_COLLECTION).where('status', '==', 'active').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Open-task count per uid, for least-loaded ranking. */
async function loadWorkload(db) {
  const counts = new Map();
  for (const status of ACTIVE_STATUSES) {
    const snap = await db.collection(TASKS_COLLECTION).where('status', '==', status).limit(1000).get();
    for (const d of snap.docs) {
      const uid = assigneeOf(d.data());
      if (uid) counts.set(uid, (counts.get(uid) || 0) + 1);
    }
  }
  return counts;
}

/** Least loaded first; ties by uid so repeated runs pick the same person. */
function rankCandidates(uids, workload) {
  return [...new Set(uids.filter(Boolean))].sort((a, b) => {
    const la = workload.get(a) || 0;
    const lb = workload.get(b) || 0;
    return la !== lb ? la - lb : a.localeCompare(b);
  });
}

/** Everyone in the directory (by employee id) → their uid. */
function uidsOfEmployees(employeeIds, directory) {
  return employeeIds.map((id) => {
    const rec = directory.get(id);
    return rec && rec.uid ? rec.uid : null;
  });
}

function brandMatches(task, directory, uid) {
  if (!task.brandId) return true;
  const rec = directory.get(uid);
  return !rec || !rec.subsidiaryId || rec.subsidiaryId === task.brandId;
}

/**
 * Decide the assignee for one pending task. PURE given the loaded context.
 * @returns {{ uid: string, method: string } | null}
 */
function pickAssignee(task, { directory, roleAssignments, workload, owner, actorUid }) {
  const rule = task.pendingAssignmentRule || {};
  const prefer = (uids) => {
    const inBrand = rankCandidates(uids.filter((u) => brandMatches(task, directory, u)), workload);
    if (inBrand.length) return inBrand[0];
    const any = rankCandidates(uids, workload);
    return any[0] || null;
  };

  switch (rule.kind) {
    case 'role': {
      const roleId = rule.roleProfileId || rule.role;
      if (roleId) {
        const employeeIds = roleAssignments.filter((a) => a.roleProfileId === roleId).map((a) => a.employeeId);
        const fromProfiles = [...directory.values()].filter((r) => r.roleProfileId === roleId && r.employeeId).map((r) => r.employeeId);
        const uid = prefer(uidsOfEmployees([...employeeIds, ...fromProfiles], directory));
        if (uid) return { uid, method: 'role' };
      }
      break;
    }
    case 'department': {
      if (rule.departmentId) {
        const seen = new Set();
        const uids = [];
        for (const rec of directory.values()) {
          if (rec.departmentId === rule.departmentId && rec.uid && !seen.has(rec.uid)) {
            seen.add(rec.uid);
            uids.push(rec.uid);
          }
        }
        const uid = prefer(uids);
        if (uid) return { uid, method: 'department' };
      }
      break;
    }
    case 'manager_of_actor': {
      const actor = actorUid ? directory.get(actorUid) : null;
      if (actor && actor.managerUid) return { uid: actor.managerUid, method: 'manager_of_actor' };
      break;
    }
    default:
      break;
  }
  if (owner && owner.uid) return { uid: owner.uid, method: 'owner_fallback' };
  return null;
}

/**
 * Resolve every `pending_assignment` task. Returns { scanned, assigned, left }.
 */
async function resolvePendingAssignments(db, { nowIso, directory: dir = null, logger = console } = {}) {
  const now = nowIso || new Date().toISOString();
  const snap = await db.collection(TASKS_COLLECTION).where('status', '==', 'pending_assignment').limit(500).get();
  const summary = { scanned: snap.size, assigned: 0, left: 0, byMethod: {} };
  if (snap.empty) return summary;

  const [directory, roleAssignments, workload, owner] = await Promise.all([
    dir || loadDirectory(db),
    loadRoleAssignments(db),
    loadWorkload(db),
    findOwnerUser(db),
  ]);

  for (const d of snap.docs) {
    const task = { id: d.id, ...d.data() };
    try {
      const actorUid = task.sourceActorUserId || (task.sourceEvent && task.sourceEvent.emittedByUserId) || null;
      const pick = pickAssignee(task, { directory, roleAssignments, workload, owner, actorUid });
      if (!pick) {
        summary.left += 1;
        await d.ref.update({ assignmentAttempts: (Number(task.assignmentAttempts) || 0) + 1, lastAssignmentAttemptAt: now, updatedAt: now });
        continue;
      }
      const rec = directory.get(pick.uid);
      const patch = {
        status: ASSIGNED_STATUS,
        assignedToUserId: pick.uid,
        assignedToName: (rec && rec.name) || null,
        assignedAt: now,
        assignedBy: 'system:assignment-sweep',
        assignmentMethod: pick.method,
        history: [
          ...(Array.isArray(task.history) ? task.history : []),
          historyEntry({ fromStatus: task.status, toStatus: ASSIGNED_STATUS, actorUserId: 'system:assignment-sweep', notes: `assigned via ${pick.method}`, nowIso: now }),
        ],
        updatedAt: now,
      };
      const lower = deescalatedPriority(task);
      if (lower) patch.priority = lower;
      await d.ref.update(patch);
      workload.set(pick.uid, (workload.get(pick.uid) || 0) + 1);
      summary.assigned += 1;
      summary.byMethod[pick.method] = (summary.byMethod[pick.method] || 0) + 1;
    } catch (err) {
      summary.left += 1;
      logger.warn('[assignmentSweep] task failed', { taskId: d.id, error: err.message });
    }
  }
  return summary;
}

module.exports = {
  ROLE_ASSIGNMENTS_COLLECTION,
  loadRoleAssignments,
  loadWorkload,
  rankCandidates,
  pickAssignee,
  resolvePendingAssignments,
};
