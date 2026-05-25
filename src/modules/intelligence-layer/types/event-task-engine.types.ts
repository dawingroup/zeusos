/**
 * Event/Task Engine — Phase 6.E (closes v1.2 subsystem B).
 *
 * Per Addendum v1.2 §3:
 *
 *   "A BusinessEvent is the atomic unit, named <module>.<event>.
 *    It carries a typed payload, source, trigger, metadata
 *    (brand + correlationId + causationId for chain
 *    reconstruction), and a processing block recording status,
 *    generated tasks, and retries."
 *
 *   "Each EventDefinition declares its tasks: EventTaskRule[].
 *    A rule produces a task with a templated title (supporting
 *    {{payload.field}} interpolation), a P0–P3 priority, a due
 *    window, and an assignTo rule (the verb that hands off to
 *    §2.3 [the human-capital assigner])."
 *
 *   "The task lifecycle is pending_assignment → assigned →
 *    in_progress → pending_review → completed | cancelled |
 *    blocked | escalated. Each card in the assignee inbox
 *    carries a source/why-header keyed to whatever created it —
 *    so AI-generated and rule-generated tasks look uniform to
 *    the human."
 *
 * In ZeusOS we already have a working outbox: every state-changing
 * Cloud Function writes a domain_events row via appendDomainEvent
 * (Phase 3.A.5). For 6.E we treat the existing `domain_events`
 * collection AS the BusinessEvent stream and add two new
 * collections on top:
 *
 *   event_definitions/{id}    Admin-curated. Declares the rules.
 *   generated_tasks/{id}      System-written. The human inbox.
 *
 * The onDomainEventCreated trigger fans out to both (a) the
 * existing logger+processor and (b) the new task generator. Both
 * tag `processedBy[]` so reruns are idempotent and partial failures
 * are observable.
 */

import { Timestamp } from 'firebase/firestore';
import { SubsidiaryId } from '../../../core/settings/types';

// ============================================
// EventDefinition (the rule)
// ============================================

export type EventTaskPriority = 'P0' | 'P1' | 'P2' | 'P3';

/**
 * Where the task lands. Mirrors the EmployeeAssignmentService rule
 * types from v1.2 §2.3 — same vocabulary so a 6.E task can resolve
 * through the 6.A assigner once the bridge ships (6.E.2).
 *
 * For 6.E.1 only `unassigned` and `payload_field` resolve at task
 * creation time; the other 4 strategies record their RULE intent on
 * the task and are resolved when the assigner is wired (6.E.2 / 6.F).
 */
export type AssignmentRule =
  /** Drop in the unassigned pool; whoever has capacity claims. */
  | { kind: 'unassigned' }
  /** Direct lookup: copy a userId out of the event payload. */
  | { kind: 'payload_field'; field: string }
  /** Resolve via 6.A EmployeeAssignmentService — `role` strategy. */
  | { kind: 'role'; roleProfileId: string }
  /** Resolve via 6.A — `department` strategy. */
  | { kind: 'department'; departmentId: string }
  /** Resolve via 6.A — `manager` of the event's actor. */
  | { kind: 'manager_of_actor' }
  /** Resolve via 6.A — `dynamic` skills/authority criteria. */
  | { kind: 'dynamic'; criteria: Record<string, unknown> };

/**
 * Predicate the rule must satisfy before it fires. Tiny expression
 * DSL — keeps EventDefinitions data, not code. Examples:
 *
 *   { op: 'eq',       path: 'payload.tier',         value: 'TIER_1' }
 *   { op: 'gt',       path: 'payload.loopCountAfter', value: 2 }
 *   { op: 'contains', path: 'payload.excludedBrandIds', value: 'odd-gorilla' }
 *   { op: 'exists',   path: 'payload.masterJobId' }
 *
 * Multiple conditions on a rule are AND-ed; no OR support in 6.E.1
 * (split into two rules instead). Path is dot-notation walking
 * BusinessEvent fields — `payload.x`, `aggregateId`, `eventType`,
 * `emittedByUserId`.
 */
export interface EventCondition {
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'exists';
  path: string;
  value?: unknown;
}

/**
 * A single rule on an EventDefinition. Produces 0 or 1 task per event
 * (0 when conditions don't pass). Multiple rules on the same
 * definition fan out — one event can spawn multiple tasks.
 */
export interface EventTaskRule {
  /** Stable id within the definition. Embedded into the generated
   *  task as `ruleId` for audit + the idempotencyKey derivation. */
  id: string;

  /** Template — `{{payload.x}}` and `{{aggregateId}}` etc. resolve at
   *  task-creation time from the firing BusinessEvent. */
  titleTpl: string;
  descriptionTpl?: string;

  priority: EventTaskPriority;
  /** Days from event-emit to due. Optional — open-ended for tasks
   *  that should sit until claimed (e.g. "review escalation"). */
  dueInDays?: number;

  assignTo: AssignmentRule;

  /** AND'd; ALL must pass for the rule to fire. */
  conditions?: EventCondition[];

  /**
   * Optional fields the generator copies onto the GeneratedTask
   * for downstream filtering (masterJobId, iwoId, brandId). Each is
   * a template too — `{{aggregateId}}` for an IWO-aggregate event,
   * for example.
   */
  tagsTpl?: {
    masterJobId?: string;
    iwoId?: string;
    brandId?: string;
    category?: string;
  };
}

/**
 * The top-level EventDefinition document. One per (eventType,
 * subsidiary) pair if subsidiary-scoped behaviour matters; otherwise
 * `applicableSubsidiaries` is the wildcard.
 */
export interface EventDefinition {
  id: string;

  /** What this matches against BusinessEvent.eventType.
   *  e.g. 'ApprovalRungAdvanced', 'iwo.budget_exceeded'. */
  eventType: string;

  /** Human description shown in the admin event-catalogue. */
  description: string;

  /** Subsidiaries this definition applies to. ['all'] = wildcard. */
  applicableSubsidiaries?: SubsidiaryId[] | ['all'];

  /** Rules that fire when an event of this type lands. */
  tasks: EventTaskRule[];

  /** Soft-deactivate without deleting (preserves audit chains). */
  isActive: boolean;

  // Audit
  createdBy: string;
  createdAt: Timestamp;
  updatedBy: string;
  updatedAt: Timestamp;
}

// ============================================
// GeneratedTask (the inbox item)
// ============================================

export type TaskStatus =
  | 'pending_assignment'  // assignTo couldn't resolve a person; floats in inbox
  | 'assigned'            // assignedToUserId set
  | 'in_progress'         // assignee clicked "Start"
  | 'pending_review'      // assignee submitted; needs sign-off
  | 'completed'           // closed clean
  | 'cancelled'           // killed by AM / system
  | 'blocked'             // assignee marked blocked with reason
  | 'escalated';          // escalation event fired (loops back via the engine)

export interface GeneratedTask {
  id: string;

  /** Back-ref to the BusinessEvent that spawned this task. */
  sourceEventId: string;
  sourceEventType: string;

  /** Rule that spawned it (event-def-id + rule-id). */
  sourceDefinitionId: string;
  sourceRuleId: string;

  title: string;
  description?: string;
  priority: EventTaskPriority;

  status: TaskStatus;

  dueAt?: Timestamp;

  /** Set when assignTo resolves cleanly; null = pending_assignment. */
  assignedToUserId?: string;

  /** Recorded on every status transition for audit. */
  history: TaskStatusEvent[];

  /** Denormalized tags for fast inbox filtering. All from
   *  EventTaskRule.tagsTpl. */
  masterJobId?: string;
  iwoId?: string;
  brandId?: SubsidiaryId;
  category?: string;

  /**
   * Deterministic key derived from (definitionId, ruleId, sourceEventId).
   * Used to dedupe: re-processing the same event by trigger retry
   * does NOT create a second task. Stored as the doc id (or as a
   * separate field if the id is a ULID for sort).
   */
  idempotencyKey: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp;
}

export interface TaskStatusEvent {
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
  actorUserId: string;
  notes?: string;
  occurredAt: Timestamp | string;
}

// ============================================
// DTOs
// ============================================

export interface CreateEventDefinitionInput {
  eventType: string;
  description: string;
  applicableSubsidiaries?: SubsidiaryId[] | ['all'];
  tasks: EventTaskRule[];
}

// ============================================
// Pure helpers (no Firestore — safe to share with FE)
// ============================================

/**
 * Resolve a dotted path against an event-shaped object.
 *   getByPath({a:{b:1}}, 'a.b') === 1
 */
export function getByPath(obj: unknown, path: string): unknown {
  if (obj == null || !path) return undefined;
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/**
 * Evaluate a single condition against a BusinessEvent-shaped object.
 */
export function evaluateCondition(event: unknown, cond: EventCondition): boolean {
  const actual = getByPath(event, cond.path);
  switch (cond.op) {
    case 'exists':
      return actual !== undefined && actual !== null;
    case 'eq':
      return actual === cond.value;
    case 'neq':
      return actual !== cond.value;
    case 'gt':
      return typeof actual === 'number' && typeof cond.value === 'number' && actual > cond.value;
    case 'gte':
      return typeof actual === 'number' && typeof cond.value === 'number' && actual >= cond.value;
    case 'lt':
      return typeof actual === 'number' && typeof cond.value === 'number' && actual < cond.value;
    case 'lte':
      return typeof actual === 'number' && typeof cond.value === 'number' && actual <= cond.value;
    case 'contains':
      if (Array.isArray(actual)) return actual.includes(cond.value);
      if (typeof actual === 'string' && typeof cond.value === 'string') return actual.includes(cond.value);
      return false;
    default:
      return false;
  }
}

/**
 * AND across all conditions; empty/missing array is a pass.
 */
export function evaluateAllConditions(event: unknown, conditions?: EventCondition[]): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((c) => evaluateCondition(event, c));
}

/**
 * Substitute {{path.to.field}} placeholders in a template string.
 * Missing paths render as empty string (no error — templates should
 * never fail at runtime).
 */
export function interpolateTemplate(tpl: string, ctx: unknown): string {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
    const v = getByPath(ctx, path);
    return v === undefined || v === null ? '' : String(v);
  });
}
