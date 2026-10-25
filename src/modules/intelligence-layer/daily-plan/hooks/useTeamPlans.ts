/**
 * useTeamPlans — every plan a manager has to review for a date.
 *
 * A manager sees the plans that name them (`managerUid`) merged with their
 * direct reports, so a person with no plan still shows as a row — that gap is
 * half of what the review exists to catch. A parent-org principal sees every
 * plan for the date, across managers.
 */

import { useEffect, useMemo, useState } from 'react';

import { useResilientSubscription } from '@/shared/hooks/useResilientSubscription';
import { subscribeAllPlansForDate, subscribeTeamPlans } from '../services/dailyPlanService';
import type { DailyPlan } from '../types';
import { useDirectReports, type DirectReport } from './useDirectReports';

export interface TeamPlanRow {
  person: DirectReport;
  plan: DailyPlan | null;
}

/** A row for a plan whose person is not among the manager's reports (parent-org view). */
function personFromPlan(plan: DailyPlan): DirectReport {
  return {
    id: plan.assigneeEmployeeId || plan.assigneeUid,
    uid: plan.assigneeUid,
    name: plan.assigneeName || 'Unnamed',
    subsidiaryId: plan.subsidiaryId ?? null,
    managerEmployeeId: plan.managerEmployeeId ?? null,
  };
}

export function useTeamPlans(date: string) {
  const { reports, isFallback, loading: loadingTeam, managerUid, isParentOrg, reload } = useDirectReports();
  const [plans, setPlans] = useState<DailyPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoadingPlans(true);
  }, [date, managerUid, isParentOrg]);

  useResilientSubscription(
    (health) => {
      if (!managerUid) return;
      let failed = false;
      const onChange = (next: DailyPlan[]) => {
        if (failed) return;
        setPlans(next);
        setLoadingPlans(false);
        setError(null);
        health.ok();
      };
      const onError = (err: Error) => {
        failed = true;
        setError(err);
        setLoadingPlans(false);
        health.fail();
      };
      const unsub = isParentOrg
        ? subscribeAllPlansForDate(date, onChange, onError)
        : subscribeTeamPlans(managerUid, date, onChange, onError);
      return () => unsub();
    },
    [managerUid, date, isParentOrg],
  );

  const rows: TeamPlanRow[] = useMemo(() => {
    const byUid = new Map(plans.map((p) => [p.assigneeUid, p]));
    const out: TeamPlanRow[] = reports.map((person) => ({
      person,
      plan: person.uid ? byUid.get(person.uid) ?? null : null,
    }));
    const seen = new Set(reports.map((r) => r.uid).filter(Boolean));
    // Plans for people outside the reports list (a parent-org view, or a
    // reporting line HR has not filled in yet) are still shown.
    for (const plan of plans) {
      if (seen.has(plan.assigneeUid)) continue;
      if (plan.assigneeUid === managerUid) continue; // my own plan is not my team's
      out.push({ person: personFromPlan(plan), plan });
      seen.add(plan.assigneeUid);
    }
    return out.sort((a, b) => a.person.name.localeCompare(b.person.name));
  }, [reports, plans, managerUid]);

  const withPlans = rows.filter((r) => r.plan);
  const reviewed = withPlans.filter((r) => r.plan?.reviewed).length;

  return {
    rows,
    isFallback,
    isParentOrg,
    managerUid,
    loading: loadingTeam || loadingPlans,
    error,
    total: withPlans.length,
    reviewed,
    pending: withPlans.length - reviewed,
    reload,
  };
}
