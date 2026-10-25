/**
 * Daily plan service — every read of `daily_plans` and every write (through
 * the `dailyPlanAction` callable) goes through here.
 *
 * The collection has two very different writers and the callable keeps them
 * apart: a MANAGER shapes the plan (items, order, day goal, reviewed), the
 * ASSIGNEE reports on it (acknowledge, wrap up, per-item outcome) and may not
 * add or drop a commitment. This module keeps the two sets of calls visibly
 * apart so a UI never accidentally sends a manager-shaped write from a staff
 * surface.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';

import { db } from '@/shared/services/firebase/firestore';
import type { DailyPlan, DailyPlanItem, PlanItemOutcome } from '../types';
import { dailyPlanActionFn, type DailyPlanActionResponse } from './taskEngineFunctions';

export const PLANS_COLLECTION = 'daily_plans';

/** Doc id — one plan per person per day, so every read is a point read. */
export function planDocId(date: string, assigneeUid: string): string {
  return `${date}_${assigneeUid}`;
}

function toPlan(id: string, data: Record<string, unknown>): DailyPlan {
  // Defaults first, doc second — a plan written before a field existed must
  // still render rather than crash the focus card.
  return {
    id,
    items: [],
    reviewed: false,
    status: 'draft',
    source: 'system',
    ...(data as object),
  } as unknown as DailyPlan;
}

// ─── Reads ───────────────────────────────────────────────────────────────────

/** Live subscription to one person's plan for a date. */
export function subscribeToPlan(
  date: string,
  assigneeUid: string,
  onChange: (plan: DailyPlan | null) => void,
  onError?: (err: Error) => void,
): () => void {
  const ref = doc(db, PLANS_COLLECTION, planDocId(date, assigneeUid));
  return onSnapshot(
    ref,
    (snap) => onChange(snap.exists() ? toPlan(snap.id, snap.data()) : null),
    (err) => {
      console.warn('[dailyPlanService] plan subscription failed:', err);
      onError?.(err as Error);
      onChange(null);
    },
  );
}

/** Every plan a manager owns for a date. */
export function subscribeTeamPlans(
  managerUid: string,
  date: string,
  onChange: (plans: DailyPlan[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(
    collection(db, PLANS_COLLECTION),
    where('managerUid', '==', managerUid),
    where('date', '==', date),
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => toPlan(d.id, d.data()))),
    (err) => {
      console.warn('[dailyPlanService] team plans subscription failed:', err);
      onError?.(err as Error);
      onChange([]);
    },
  );
}

/** Every plan for a date, across every manager — the parent-org view. */
export function subscribeAllPlansForDate(
  date: string,
  onChange: (plans: DailyPlan[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(collection(db, PLANS_COLLECTION), where('date', '==', date));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => toPlan(d.id, d.data()))),
    (err) => {
      console.warn('[dailyPlanService] all-plans subscription failed:', err);
      onError?.(err as Error);
      onChange([]);
    },
  );
}

/** One-shot fetch — used by the plan editor for "yesterday". */
export async function fetchPlan(date: string, assigneeUid: string): Promise<DailyPlan | null> {
  const snap = await getDoc(doc(db, PLANS_COLLECTION, planDocId(date, assigneeUid)));
  return snap.exists() ? toPlan(snap.id, snap.data()) : null;
}

/** A person's recent plans, newest first — the raw material for the reliability strip. */
export async function fetchRecentPlans(assigneeUid: string, days = 10): Promise<DailyPlan[]> {
  const q = query(
    collection(db, PLANS_COLLECTION),
    where('assigneeUid', '==', assigneeUid),
    orderBy('date', 'desc'),
    fsLimit(days),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => toPlan(d.id, d.data()));
}

// ─── Writes (through the callable) ───────────────────────────────────────────

async function call(req: Parameters<typeof dailyPlanActionFn>[0]): Promise<DailyPlanActionResponse> {
  const res = await dailyPlanActionFn(req);
  return res.data;
}

// Assignee

/** "I have seen today's plan." A separate act from opening the page. */
export function acknowledgePlan(date: string): Promise<DailyPlanActionResponse> {
  return call({ action: 'acknowledge', date });
}

/**
 * Record what happened to one item. `done` closes the task FIRST; when the
 * task cannot be closed the response carries `taskLeftOpen` and the item is
 * not marked done.
 */
export function setItemOutcome(date: string, taskId: string, outcome: PlanItemOutcome, note?: string): Promise<DailyPlanActionResponse> {
  return call({ action: 'setItemOutcome', date, taskId, outcome, ...(note ? { note } : {}) });
}

/** Take back an outcome — "Reopen" on a carried or blocked item. */
export function clearItemOutcome(date: string, taskId: string): Promise<DailyPlanActionResponse> {
  return call({ action: 'clearItemOutcome', date, taskId });
}

/** End-of-day wrap-up: outcomes + the 2-line "what moved today". */
export function submitWrapUp(
  date: string,
  outcomes: Record<string, { outcome: PlanItemOutcome; note?: string }>,
  summary?: string,
  blockers?: string,
): Promise<DailyPlanActionResponse> {
  return call({ action: 'wrapUp', date, outcomes, summary, blockers });
}

// Manager

export function createEmptyPlan(date: string, assigneeUid: string, assigneeName?: string | null): Promise<DailyPlanActionResponse> {
  return call({ action: 'createEmptyPlan', date, assigneeUid, ...(assigneeName ? { assigneeName } : {}) });
}

/** Replace the item list. Orders are renumbered server-side; thin items are denormalised from the task. */
export function savePlanItems(date: string, assigneeUid: string, items: Array<Partial<DailyPlanItem> & { taskId: string }>): Promise<DailyPlanActionResponse> {
  return call({ action: 'saveItems', date, assigneeUid, items });
}

export function savePlanNotes(date: string, assigneeUid: string, extras: { dayGoal?: string; managerNote?: string }): Promise<DailyPlanActionResponse> {
  return call({ action: 'saveNotes', date, assigneeUid, ...extras });
}

/** The evening review itself. Closes the manager's review task once every plan is reviewed. */
export function markReviewed(date: string, assigneeUid: string, extras: { dayGoal?: string; managerNote?: string } = {}): Promise<DailyPlanActionResponse> {
  return call({ action: 'markReviewed', date, assigneeUid, ...extras });
}
