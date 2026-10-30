/**
 * Action queue vocabulary — how a person's open task becomes "needs you".
 * Pure: no React, no Firebase, so it is tested on its own.
 */
import type { EmployeeTask } from '@/modules/intelligence-layer/hooks/useEmployeeTaskInbox';

export type Urgency = 'blocking' | 'urgent' | 'info';

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
  task: EmployeeTask;
  urgency: Urgency;
}

/** Open, not dismissed, worst first; within a band the soonest due first. */
export function buildActionItems(tasks: EmployeeTask[], dismissed: ReadonlySet<string>, nowMs: number): ActionItem[] {
  return tasks
    .filter((t) => OPEN_STATUSES.includes(t.status) && !dismissed.has(t.id))
    .map((task) => ({ task, urgency: urgencyOf(task, nowMs) }))
    .sort((a, b) => {
      if (RANK[a.urgency] !== RANK[b.urgency]) return RANK[a.urgency] - RANK[b.urgency];
      const av = a.task.dueDate ? a.task.dueDate.getTime() : Number.POSITIVE_INFINITY;
      const bv = b.task.dueDate ? b.task.dueDate.getTime() : Number.POSITIVE_INFINITY;
      return av - bv;
    });
}
