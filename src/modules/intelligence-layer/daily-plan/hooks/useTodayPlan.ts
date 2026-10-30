/**
 * useTodayPlan — the signed-in person's focus plan for a day.
 *
 * Powers "Your focus today" (/tasks/today) and the Action Center strip. The
 * plan doc already carries denormalised titles and priorities, so the card
 * renders from ONE read; the live task status is watched separately so the
 * list can strike through what is already done — the moment it is done, not
 * on the next reload.
 *
 * Plans are keyed by the sign-in uid (`daily_plans/{date}_{uid}`), the same
 * key tasks are assigned under (`assignedToUserId`).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useCurrentDawinUser } from '@/core/settings';
import { useListenerRecovery } from '@/shared/hooks/useResilientSubscription';
import { CLOSED_TASK_STATUSES, nairobiDateKey, type HomePlanItem } from '../format';
import {
  acknowledgePlan,
  clearItemOutcome,
  setItemOutcome,
  submitWrapUp,
  subscribeToPlan,
} from '../services/dailyPlanService';
import { subscribeTaskStates, type TaskState } from '../services/tasksService';
import type { DailyPlan, DailyPlanActionResult, PlanItemOutcome } from '../types';

/** What went wrong loading a plan, in words the person can act on. */
export function describePlanLoadError(err: unknown): string {
  const code = String((err as { code?: unknown } | null)?.code ?? '').replace(/^firestore\//, '');
  if (code === 'permission-denied') return 'your account is not allowed to read it — ask an admin to check your access';
  if (code === 'unavailable' || code === 'deadline-exceeded') return 'the connection dropped — check your network and reload';
  return 'something went wrong reading it — reload to try again';
}

export interface TodayPlanItem extends HomePlanItem {
  currentAssignedToUserId?: string | null;
}

export function useTodayPlan(date?: string) {
  const { dawinUser } = useCurrentDawinUser();
  const uid = dawinUser?.uid ?? null;
  const planDate = date || nairobiDateKey();

  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [stateById, setStateById] = useState<Map<string, TaskState>>(new Map());
  // A plan that failed to load used to arrive as `null` — indistinguishable
  // from "no plan today". Keep the fault apart from the quiet day.
  const [loadError, setLoadError] = useState<Error | null>(null);

  // The card sits on long-lived pages, so its listeners outlive every laptop
  // sleep. One that errors on wake is closed for good; `epoch` resubscribes
  // on one capped budget.
  const { epoch, report } = useListenerRecovery([planDate, uid]);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      setPlan(null);
      return;
    }
    setLoading(true);
    let failed = false;
    const unsub = subscribeToPlan(
      planDate,
      uid,
      (p) => {
        setPlan(p);
        setLoading(false);
        if (!failed) report('plan', true);
      },
      (err) => {
        failed = true;
        setLoadError(err);
        setLoading(false);
        report('plan', false);
      },
    );
    return () => {
      unsub();
      setLoadError(null);
    };
  }, [planDate, uid, epoch, report]);

  const taskIds = useMemo(() => (plan?.items || []).map((i) => i.taskId), [plan]);
  const taskIdKey = taskIds.join(',');

  useEffect(() => {
    if (taskIds.length === 0) {
      setStateById(new Map());
      return;
    }
    const unsub = subscribeTaskStates(
      taskIds,
      (next) => {
        setStateById(next);
        report('status', true);
      },
      () => report('status', false),
    );
    return () => unsub();
    // taskIdKey is the real dependency — the array identity changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskIdKey, epoch, report]);

  const items: TodayPlanItem[] = useMemo(
    () =>
      [...(plan?.items || [])]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((item) => {
          const state = stateById.get(item.taskId);
          return {
            ...item,
            currentStatus: state?.status,
            currentAssignedToUserId: state?.assignedToUserId ?? null,
            isClosed: CLOSED_TASK_STATUSES.includes(state?.status || ''),
          };
        }),
    [plan, stateById],
  );

  const liveTask = useCallback((taskId: string) => stateById.get(taskId)?.task, [stateById]);
  const doneCount = items.filter((i) => i.isClosed || i.outcome === 'done').length;
  const problem: 'load_failed' | null = !plan && loadError ? 'load_failed' : null;

  const acknowledge = useCallback(async () => {
    if (!plan) return;
    await acknowledgePlan(plan.date);
  }, [plan]);

  const recordOutcome = useCallback(
    async (taskId: string, outcome: PlanItemOutcome, note?: string): Promise<DailyPlanActionResult> => {
      if (!plan) return { ok: false };
      const res = await setItemOutcome(plan.date, taskId, outcome, note);
      return { ok: res.ok !== false, taskLeftOpen: res.taskLeftOpen };
    },
    [plan],
  );

  const clearOutcome = useCallback(
    async (taskId: string) => {
      if (!plan) return;
      await clearItemOutcome(plan.date, taskId);
    },
    [plan],
  );

  const wrapUp = useCallback(
    async (
      outcomes: Record<string, { outcome: PlanItemOutcome; note?: string }>,
      summary?: string,
      blockers?: string,
    ) => {
      if (!plan) return { notClosed: [] as Array<{ taskId: string; title: string; reason: string }> };
      const res = await submitWrapUp(plan.date, outcomes, summary, blockers);
      return { notClosed: res.notClosed || [] };
    },
    [plan],
  );

  return {
    plan,
    items,
    date: planDate,
    uid,
    loading,
    hasPlan: Boolean(plan && (plan.items || []).length > 0),
    problem,
    problemDetail: problem === 'load_failed' ? describePlanLoadError(loadError) : null,
    doneCount,
    total: items.length,
    pct: items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0,
    acknowledged: Boolean(plan?.acknowledgedAt),
    reviewed: Boolean(plan?.reviewed),
    liveTask,
    acknowledge,
    recordOutcome,
    clearOutcome,
    wrapUp,
  };
}
