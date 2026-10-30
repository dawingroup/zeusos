/**
 * Action queue vocabulary — how a person's open work becomes "needs you".
 * Pure: no React, no Firebase, so the rules are tested on their own.
 *
 * Two sources share one card shape: the person's open tasks and the approvals
 * inbox. Each card lands on the RECORD that needs the action, never a list
 * (`resolveTaskTarget`, `approvalRowHref`).
 */
import { approvalRowHref } from '@/modules/approvals/approvalRowHref';
import type { ApprovalItem } from '@/modules/approvals/types';
import type { EmployeeTask } from '@/modules/intelligence-layer/hooks/useEmployeeTaskInbox';
import { resolveTaskTarget } from '@/modules/intelligence-layer/utils/actionTarget';
import { canCompleteFromList } from '@/modules/intelligence-layer/utils/listCompletion';

export type Urgency = 'blocking' | 'urgent' | 'info';
export type ActionType = 'approval' | 'directive' | 'blocker';

export const URGENCY: Record<Urgency, { label: string; color: string; soft: string; pill: string }> = {
  blocking: { label: 'Blocking', color: 'var(--rag-red)', soft: 'var(--rag-red-soft)', pill: 'red' },
  urgent: { label: 'Urgent', color: 'var(--rag-amber)', soft: 'var(--rag-amber-soft)', pill: 'amber' },
  info: { label: 'For info', color: 'var(--rag-blue)', soft: 'var(--rag-blue-soft)', pill: 'blue' },
};

const OPEN_STATUSES: EmployeeTask['status'][] = ['pending', 'in_progress', 'blocked'];
const RANK: Record<Urgency, number> = { blocking: 0, urgent: 1, info: 2 };

/** Derive urgency from a task's priority + due date. */
export function urgencyOf(t: EmployeeTask, nowMs: number): Urgency {
  const overdue = t.dueDate ? t.dueDate.getTime() < nowMs : false;
  const dueSoon = t.dueDate ? t.dueDate.getTime() - nowMs < 24 * 60 * 60 * 1000 : false;
  if (t.priority === 'P0' || t.status === 'blocked' || overdue) return 'blocking';
  if (t.priority === 'P1' || dueSoon) return 'urgent';
  return 'info';
}

export function ageLabel(d?: Date, nowMs = Date.now()): string {
  if (!d) return '';
  const mins = Math.max(0, Math.round((nowMs - d.getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

export interface ActionItem {
  id: string;
  type: ActionType;
  urgency: Urgency;
  title: string;
  /** Where it came from, in a few words. */
  context: string;
  age: string;
  /** Where selecting the card takes you: the record, or the task when it must be read first. */
  go: string;
  goLabel: string;
  /** The task itself, when `go` is the record. */
  contextGo?: string;
  /** Set when one click may close it (`canCompleteFromList`). */
  completeTaskId?: string;
  /** Sort key within an urgency band; soonest first. */
  dueMs: number;
}

function taskType(t: EmployeeTask): ActionType {
  if (t.status === 'blocked') return 'blocker';
  return t.kind === 'approval' || t.kind === 'review' ? 'approval' : 'directive';
}

export function taskToAction(t: EmployeeTask, nowMs: number): ActionItem {
  const target = resolveTaskTarget(t);
  return {
    id: `task:${t.id}`,
    type: taskType(t),
    urgency: urgencyOf(t, nowMs),
    title: t.title,
    context: [t.sourceModule, t.entityName].filter(Boolean).join(' · '),
    age: ageLabel(t.createdAt, nowMs),
    go: target.go,
    goLabel: target.goLabel,
    contextGo: target.contextGo,
    completeTaskId: canCompleteFromList(t) ? t.id : undefined,
    dueMs: t.dueDate ? t.dueDate.getTime() : Number.POSITIVE_INFINITY,
  };
}

const APPROVAL_URGENCY: Record<ApprovalItem['urgency'], Urgency> = {
  critical: 'blocking',
  high: 'urgent',
  medium: 'info',
  low: 'info',
};

/** An approval is decided on its record, so the card only ever opens it. Null when it cannot name one. */
export function approvalToAction(a: ApprovalItem): ActionItem | null {
  const go = approvalRowHref(a);
  if (!go) return null;
  return {
    id: `approval:${a.id}`,
    type: 'approval',
    urgency: APPROVAL_URGENCY[a.urgency],
    title: a.title,
    context: a.entity.ref ?? '',
    age: '',
    go,
    goLabel: 'Review',
    dueMs: Number.POSITIVE_INFINITY,
  };
}

export interface ActionSources {
  tasks: EmployeeTask[];
  approvals: ApprovalItem[];
}

/** Open, not dismissed, worst first; within a band the soonest due first. */
export function buildActionItems({ tasks, approvals }: ActionSources, dismissed: ReadonlySet<string>, nowMs: number): ActionItem[] {
  const fromTasks = tasks.filter((t) => OPEN_STATUSES.includes(t.status)).map((t) => taskToAction(t, nowMs));
  const fromApprovals = approvals.map(approvalToAction).filter((a): a is ActionItem => a !== null);
  return [...fromTasks, ...fromApprovals]
    .filter((i) => !dismissed.has(i.id))
    .sort((a, b) => RANK[a.urgency] - RANK[b.urgency] || a.dueMs - b.dueMs);
}
