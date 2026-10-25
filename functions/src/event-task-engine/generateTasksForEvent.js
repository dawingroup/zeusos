/**
 * generateTasksForEvent — Phase 6.E (closes v1.2 subsystem B).
 *
 * Called from the onDomainEventCreated trigger for every new outbox
 * row. Loads matching EventDefinitions, evaluates each rule against
 * the event, and writes a GeneratedTask per rule that fires.
 *
 * Idempotency: each task's id is derived from
 * `${definitionId}__${ruleId}__${sourceEventId}`. Re-processing the
 * same event (trigger retry, replay) does not create duplicate tasks —
 * the second `set` overwrites the first with identical content.
 *
 * Assignment resolution:
 *   - `unassigned`     → assignedToUserId left null; task floats
 *                        in the pool (anyone with capacity can claim).
 *   - `payload_field`  → copy a userId straight out of event.payload.
 *   - `role` / `department` / `manager_of_actor` / `dynamic`
 *                      → recorded as `pendingAssignmentRule` on the
 *                        task; resolved by EmployeeAssignmentService
 *                        bridge (6.E.2 follow-up). Status stays
 *                        `pending_assignment` until then.
 */

const {
  evaluateAllConditions,
  interpolateTemplate,
  getByPath,
} = require('./lib/expression');
const { ASSIGNED_STATUS, normalisePriority, historyEntry } = require('./lib/taskModel');
const { entityTypeForAggregate } = require('./lib/entityResolution');
const { resolveKind } = require('./lib/taskKind');
const { addWorkingHours } = require('./lib/workingTime');

const TASKS_COLLECTION = 'generated_tasks';
const DEFINITIONS_COLLECTION = 'event_definitions';

/**
 * Resolve `assignTo` against the firing event. Returns:
 *   { userId: string|null, pendingRule?: AssignmentRule }
 *
 * Direct strategies (unassigned, payload_field) return a userId or
 * null synchronously. Deferred strategies (role/department/manager/
 * dynamic) return null + pendingRule so the assigner can resolve later.
 */
function resolveAssignment(assignTo, event) {
  if (!assignTo || typeof assignTo !== 'object') {
    return { userId: null };
  }
  switch (assignTo.kind) {
    case 'unassigned':
      return { userId: null };

    case 'payload_field': {
      const v = getByPath(event, assignTo.field);
      return { userId: typeof v === 'string' && v ? v : null };
    }

    case 'role':
    case 'department':
    case 'manager_of_actor':
    case 'dynamic':
      return { userId: null, pendingRule: assignTo };

    default:
      return { userId: null };
  }
}

/** The record's human name, from whatever the payload calls it. */
function subjectFor(payload) {
  for (const key of ['entityName', 'title', 'name', 'code', 'iwoCode', 'jobCode', 'jobName', 'clientName', 'invoiceNumber', 'quoteNumber']) {
    const v = payload && payload[key];
    if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 200);
  }
  return null;
}

/**
 * Compute deterministic dedupe key for the (definition, rule, event) triple.
 * Sanitised for Firestore doc ids (no slashes, ≤ 1500 bytes).
 */
function taskIdFor(definitionId, ruleId, sourceEventId) {
  return `task_${definitionId}__${ruleId}__${sourceEventId}`
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .slice(0, 1400);
}

/**
 * For one event + one definition, evaluate all rules and emit tasks
 * for those that pass conditions.
 *
 * Returns the list of task ids written (for observability).
 */
async function emitTasksForDefinition({ db, event, definition, nowIso }) {
  const ids = [];
  if (!definition.isActive) return ids;
  if (!Array.isArray(definition.tasks)) return ids;

  for (const rule of definition.tasks) {
    if (!rule || typeof rule !== 'object' || !rule.id) continue;
    if (!evaluateAllConditions(event, rule.conditions)) continue;

    const title = interpolateTemplate(rule.titleTpl || '(untitled)', event);
    const description = rule.descriptionTpl
      ? interpolateTemplate(rule.descriptionTpl, event)
      : null;

    const tags = rule.tagsTpl || {};
    const interpolatedTags = {
      masterJobId: tags.masterJobId ? interpolateTemplate(tags.masterJobId, event) || null : null,
      iwoId: tags.iwoId ? interpolateTemplate(tags.iwoId, event) || null : null,
      brandId: tags.brandId ? interpolateTemplate(tags.brandId, event) || null : null,
      category: tags.category ? interpolateTemplate(tags.category, event) || null : null,
    };

    const assignment = resolveAssignment(rule.assignTo, event);
    const status = assignment.userId ? ASSIGNED_STATUS : 'pending_assignment';

    // Due: `dueInHours` counts WORKING hours (08:00–17:00 Nairobi, Mon–Fri —
    // lib/workingTime.js) so an evening event is not overdue by breakfast;
    // `dueInDays` stays calendar days for open-ended work.
    const emitMs = event.emittedAt && typeof event.emittedAt === 'string'
      ? Date.parse(event.emittedAt)
      : (event.emittedAt && typeof event.emittedAt.toMillis === 'function' ? event.emittedAt.toMillis() : Date.parse(nowIso));
    let dueAt = null;
    if (typeof rule.dueInHours === 'number' && rule.dueInHours >= 0) {
      dueAt = new Date(addWorkingHours(emitMs, rule.dueInHours)).toISOString();
    } else if (typeof rule.dueInDays === 'number' && rule.dueInDays >= 0) {
      dueAt = new Date(emitMs + rule.dueInDays * 24 * 60 * 60 * 1000).toISOString();
    }

    const id = taskIdFor(definition.id, rule.id, event.id);
    const ref = db.collection(TASKS_COLLECTION).doc(id);

    // Create, never overwrite: a replayed event must not reset a task someone
    // has already started, blocked or finished. The id is the dedupe key.
    const existing = await ref.get();
    if (existing.exists) {
      ids.push(id);
      continue;
    }

    const payload = event.payload || {};
    const entityType = entityTypeForAggregate(event.aggregateType);
    const subject = subjectFor(payload);

    const taskDoc = {
      id,
      sourceEventId: event.id,
      sourceEventType: event.eventType,
      sourceDefinitionId: definition.id,
      sourceRuleId: rule.id,
      sourceActorUserId: event.emittedByUserId || null,
      sourceModule: rule.sourceModule || definition.module || entityType || 'events',
      source: 'event',
      title,
      description,
      priority: normalisePriority(rule.priority),
      kind: resolveKind(rule, event.eventType),
      status,
      dueAt,
      assignedToUserId: assignment.userId,
      assignedToName: null,
      assignedAt: assignment.userId ? nowIso : null,
      assignedBy: assignment.userId ? 'system:event-task-engine' : null,
      pendingAssignmentRule: assignment.pendingRule || null,
      history: [historyEntry({
        fromStatus: null,
        toStatus: status,
        actorUserId: 'system:event-task-engine',
        notes: `created from ${event.eventType} via ${definition.id}/${rule.id}`,
        nowIso,
      })],
      entityType,
      entityId: event.aggregateId || null,
      entityName: subject,
      rung: payload.toRung != null ? payload.toRung : null,
      estimateMinutes: typeof rule.estimateMinutes === 'number' && rule.estimateMinutes > 0 ? rule.estimateMinutes : null,
      masterJobId: interpolatedTags.masterJobId,
      iwoId: interpolatedTags.iwoId,
      brandId: interpolatedTags.brandId,
      category: interpolatedTags.category,
      idempotencyKey: id,                   // task id IS the idempotency key
      createdBy: 'system:event-task-engine',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await ref.set(taskDoc, { merge: false });
    ids.push(id);
  }
  return ids;
}

/**
 * Main entry — called by onDomainEventCreated trigger.
 *
 * `event` is the BusinessEvent doc shape from domain_events (id +
 * eventType + payload + aggregateType + aggregateId + emittedAt +
 * emittedByUserId).
 *
 * Returns { taskIds: string[], matchedDefinitions: number } for the
 * trigger to log + tag processedBy.
 */
async function generateTasksForEvent({ db, event, nowIso }) {
  if (!event || !event.eventType) {
    return { taskIds: [], matchedDefinitions: 0 };
  }
  const now = nowIso || new Date().toISOString();

  // Load definitions matching this eventType. `isActive` is filtered
  // in-memory below to avoid needing a 2-field composite index for
  // every (eventType, isActive) pair.
  const snap = await db
    .collection(DEFINITIONS_COLLECTION)
    .where('eventType', '==', event.eventType)
    .get();

  if (snap.empty) {
    return { taskIds: [], matchedDefinitions: 0 };
  }

  const allIds = [];
  let matched = 0;
  for (const doc of snap.docs) {
    const def = { id: doc.id, ...doc.data() };
    if (!def.isActive) continue;
    matched += 1;
    const ids = await emitTasksForDefinition({ db, event, definition: def, nowIso: now });
    allIds.push(...ids);
  }
  return { taskIds: allIds, matchedDefinitions: matched };
}

module.exports = {
  generateTasksForEvent,
  emitTasksForDefinition,
  resolveAssignment,
  taskIdFor,
  subjectFor,
  TASKS_COLLECTION,
  DEFINITIONS_COLLECTION,
};
