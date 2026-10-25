/**
 * Closing tasks whose linked record has already been dealt with. Shared by the
 * hygiene run and the domain-event trigger (which closes an entity's tasks the
 * moment the event announcing its decision lands — otherwise the approver's
 * task waits for the next sweep and sits on their Today list after they had
 * decided). `db` is passed in.
 */

const { TASKS_COLLECTION, OPEN_STATUSES, systemCloseFields } = require('./taskModel');
const { resolveEntity, autoCloseAllowed } = require('./entityResolution');

const AUDIT_COLLECTION = 'agent_audit_entries';
const AGENT_ID = 'ZA-010';

/**
 * Terminal write shared by the resolved and orphan paths and the stale sweep.
 */
async function closeTask(db, taskSnap, { status, outcome, reason, closedBy, trigger = 'scheduled', nowIso }) {
  const task = taskSnap.data();
  await taskSnap.ref.update(systemCloseFields(task, { status, outcome, reason, closedBy, nowIso }));
  try {
    await db.collection(AUDIT_COLLECTION).add({
      agentId: AGENT_ID,
      toolId: 'task.auto_close',
      trigger,
      outputSummary: `Auto-closed task ${taskSnap.id} (${task.title || 'untitled'}): ${reason}`,
      outcome: 'ok',
      inputSnapshot: { taskId: taskSnap.id, entityType: task.entityType || null, entityId: task.entityId || null },
      outputSnapshot: { status, outcome, reason },
      errorMessage: null,
      createdAt: nowIso || new Date().toISOString(),
    });
  } catch (_) {
    // The close is the record; the audit row is best-effort.
  }
}

/**
 * Close every open task on one record that the record has resolved. Only
 * tasks the sweeps would close are touched (same predicate), so this never
 * closes anything the hourly run would have left open. Returns the count.
 */
async function closeResolvedTasksForEntity(db, { entityType, entityId, nowIso, trigger = 'domain_event' }) {
  if (!entityType || !entityId) return 0;
  const snap = await db
    .collection(TASKS_COLLECTION)
    .where('entityType', '==', entityType)
    .where('entityId', '==', entityId)
    .where('status', 'in', [...OPEN_STATUSES])
    .get();

  let closed = 0;
  const cache = new Map();
  for (const taskSnap of snap.docs) {
    const task = { id: taskSnap.id, ...taskSnap.data() };
    if (!autoCloseAllowed(task)) continue;
    const state = await resolveEntity(db, task, { cache });
    if (state !== 'resolved') continue;
    await closeTask(db, taskSnap, {
      status: 'completed',
      outcome: 'completed',
      reason: 'entity_resolved',
      closedBy: 'system:auto-close',
      trigger,
      nowIso,
    });
    closed += 1;
  }
  return closed;
}

module.exports = { AGENT_ID, closeTask, closeResolvedTasksForEntity };
