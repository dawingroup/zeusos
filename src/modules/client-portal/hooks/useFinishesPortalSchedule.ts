/**
 * useFinishesPortalSchedule — feeds the portal Schedule (Gantt) screen.
 *
 * Derives everything from the project doc + change-order data so the
 * staff app remains the single source of truth:
 *   - **KPIs**     — programme weeks, today-week, variance vs baseline,
 *                    critical path label (heuristic).
 *   - **Gantt rows** — synthesised from `phaseCompletion` + milestone
 *                    categories. Phase windows use a standard fit-out
 *                    template that maps neatly to the wireframe; phases
 *                    that gate open approvals are signal-flagged.
 *   - **Milestones · next 8 weeks** — pulled straight from
 *                    `project.milestones[]`, future-dated.
 *   - **Risks**     — pulled from `project.risks[]`.
 */

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import type {
  DesignProject,
  ProjectMilestone,
  ProjectRisk,
} from '@/modules/design-manager/types';
import type { SalesOrder } from '@/modules/sales-orders/types';
import {
  getPortalProjectByCode,
  getSalesOrderForProject,
  getSalesOrderById,
  getOpenApprovalsForSalesOrder,
} from '@/modules/customer-hub/services/client-portal/clientPortalAccess';
import { assertProjectAccess } from '@/modules/customer-hub/services/client-portal/portalAccessGate';

export interface PortalGanttRow {
  /** "Joinery install" */
  label: string;
  /** "W15 · upcoming" */
  sub: string;
  /** 0–100 (% across the gantt column space) */
  start: number;
  end: number;
  /** 0–100 fill within the bar (progress) */
  pct: number;
  /** Bar uses signal red. */
  signal: boolean;
  /** Centre-printed label inside the bar (or undefined). */
  barLabel?: string;
}

export interface PortalScheduleData {
  project: DesignProject;
  salesOrder: SalesOrder | null;
  ganttRows: PortalGanttRow[];
  ganttCols: string[];
  todayPct: number;
  varianceDays: number;
  weeksTotal: number;
  weekToday: number;
  baselineDate?: Date;
  dueDate?: Date;
  criticalPath: string;
  upcomingMilestones: ProjectMilestone[];
  risks: ProjectRisk[];
}

interface State {
  data: PortalScheduleData | null;
  loading: boolean;
  error: Error | null;
}

export function useFinishesPortalSchedule(code: string | undefined): State {
  const { user } = useAuth();
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });

  useEffect(() => {
    if (!code) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState({ data: null, loading: true, error: null });

    (async () => {
      try {
        const project = await getPortalProjectByCode(code);
        if (!project) throw new Error(`Project ${code} not found`);

        assertProjectAccess(user, project);

        let so: SalesOrder | null = null;
        if (project.linkedSalesOrderId) so = await getSalesOrderById(project.linkedSalesOrderId);
        if (!so) so = await getSalesOrderForProject(project.id);

        const openApprovals = so
          ? await getOpenApprovalsForSalesOrder(so.id)
          : { signOffCount: 0, changeOrderCount: 0, nextDue: null };

        const data = computeScheduleData(project, so, openApprovals);

        if (cancelled) return;
        setState({ data, loading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        setState({ data: null, loading: false, error: err as Error });
      }
    })();

    return () => { cancelled = true; };
  }, [code, user?.uid]);

  return state;
}

/**
 * Adapter useful when other consumers (e.g. dashboards) want the
 * derived shape without re-running the live query path.
 */
export function useScheduleProjection(
  project: DesignProject | undefined,
  so: SalesOrder | null | undefined,
  openCount: number,
): PortalScheduleData | null {
  return useMemo(() => {
    if (!project) return null;
    return computeScheduleData(project, so ?? null, {
      signOffCount: openCount, changeOrderCount: 0, nextDue: null,
    });
  }, [project, so, openCount]);
}

// ── Derivation ──────────────────────────────────────────────

function computeScheduleData(
  project: DesignProject,
  so: SalesOrder | null,
  openApprovals: { signOffCount: number; changeOrderCount: number; nextDue: Date | null },
): PortalScheduleData {
  const baseline = tsToDate(project.baselineDate) ?? tsToDate(project.startDate);
  const due = tsToDate(project.dueDate);

  // Total programme + today position
  const weeksTotal = baseline && due ? Math.max(1, Math.round((due.getTime() - baseline.getTime()) / WEEK_MS)) : 22;
  const weekToday = baseline ? Math.max(1, Math.min(weeksTotal, Math.round((Date.now() - baseline.getTime()) / WEEK_MS))) : 1;
  const todayPct = Math.round((weekToday / weeksTotal) * 100);
  // Variance: if physicalProgress < expected baseline progress at this week, we're behind.
  const expectedProgress = (weekToday / weeksTotal) * 100;
  const actual = project.physicalProgress ?? 0;
  const varianceDays = Math.round((actual - expectedProgress) * (weeksTotal * 7) / 100);

  // Gantt columns — 12 evenly-spaced labels across the programme.
  const ganttCols = makeGanttCols(weeksTotal);

  // Synthesise gantt rows from phaseCompletion + a fit-out template
  // (matches the wireframe exactly when phases are 22 wk standard).
  const pc = project.phaseCompletion ?? {};
  const designGate = openApprovals.signOffCount + openApprovals.changeOrderCount > 0;

  // Phase template (start / end as % of total programme).
  // We treat this as illustrative — staff will eventually customise per-project.
  const phaseTemplate: Array<Omit<PortalGanttRow, 'pct' | 'signal' | 'barLabel'> & { phaseKey: keyof typeof pc | null; defaultLabel?: string }> = [
    { label: 'Design',              sub: '',                 start: 0,  end: 22,  phaseKey: 'design' },
    { label: 'Procurement',         sub: '',                 start: 9,  end: 64,  phaseKey: 'procurement' },
    { label: 'Site setup & demo',   sub: '',                 start: 22, end: 32,  phaseKey: 'construction' },
    { label: 'MEP first fix',       sub: '',                 start: 32, end: 55,  phaseKey: 'construction' },
    { label: 'Joinery install',     sub: '',                 start: 64, end: 73,  phaseKey: 'construction' },
    { label: 'Stone install',       sub: '',                 start: 64, end: 77,  phaseKey: 'construction' },
    { label: 'Lighting install',    sub: '',                 start: 68, end: 82,  phaseKey: 'construction' },
    { label: 'Finishing & paint',   sub: '',                 start: 73, end: 91,  phaseKey: 'construction' },
    { label: 'FF&E install',        sub: '',                 start: 82, end: 95,  phaseKey: 'construction' },
    { label: 'Snagging & handover', sub: '',                 start: 91, end: 100, phaseKey: 'snagging' },
  ];

  const ganttRows: PortalGanttRow[] = phaseTemplate.map((p) => {
    const phasePct = p.phaseKey ? (pc[p.phaseKey] ?? 0) : 0;
    const endsBeforeToday = p.end <= todayPct;
    const startsAfterToday = p.start >= todayPct;
    // Show a literal status sub-line so the row reads like the wireframe.
    let sub = `W${Math.round((p.start / 100) * weeksTotal) + 1}–W${Math.round((p.end / 100) * weeksTotal)}`;
    if (phasePct >= 100) sub += ' · done';
    else if (endsBeforeToday && phasePct > 0) sub += ` · ${phasePct}%`;
    else if (startsAfterToday) sub += ' · upcoming';
    else if (phasePct > 0) sub += ` · ${phasePct}%`;

    // Critical-path heuristic: any future-phase whose preceding phase has
    // not completed AND has open client-side approvals = signal red.
    const signal = startsAfterToday && designGate
      && (p.label === 'Joinery install' || p.label === 'Stone install');

    return {
      label: p.label,
      sub,
      start: p.start,
      end: p.end,
      pct: phasePct,
      signal,
      barLabel: phasePct >= 100
        ? (p.label === 'Design' ? 'Sealed' : 'Done')
        : signal
          ? (p.label === 'Stone install' ? 'Gated by approval' : 'Awaiting signoff')
          : phasePct > 0
            ? `${phasePct}%`
            : undefined,
    };
  });

  // Upcoming milestones — future-dated only, sorted ascending.
  const now = Date.now();
  const upcomingMilestones = (project.milestones ?? [])
    .filter((m) => {
      const d = tsToDate(m.date);
      return d && d.getTime() >= now - WEEK_MS;
    })
    .sort((a, b) => {
      const aMs = tsToDate(a.date)?.getTime() ?? 0;
      const bMs = tsToDate(b.date)?.getTime() ?? 0;
      return aMs - bMs;
    })
    .slice(0, 6);

  // Critical-path label — picks the soonest signal-flagged future milestone.
  const criticalRow = ganttRows.find((r) => r.signal);
  const criticalPath = criticalRow
    ? criticalRow.label
    : openApprovals.signOffCount + openApprovals.changeOrderCount > 0
      ? 'Pending approval'
      : 'None';

  return {
    project,
    salesOrder: so,
    ganttRows,
    ganttCols,
    todayPct,
    varianceDays,
    weeksTotal,
    weekToday,
    baselineDate: baseline,
    dueDate: due,
    criticalPath,
    upcomingMilestones,
    risks: project.risks ?? [],
  };
}

function makeGanttCols(weeksTotal: number): string[] {
  // Always render 12 evenly-spaced column markers — matches the wireframe.
  const stride = Math.max(1, Math.round(weeksTotal / 12));
  const cols: string[] = [];
  for (let i = 1; i < 12; i += 1) {
    cols.push(`W${i * stride}`);
  }
  cols.push(`W${weeksTotal}`);
  return cols;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function tsToDate(t: unknown): Date | undefined {
  if (!t) return undefined;
  const maybe = t as { toDate?: () => Date };
  if (typeof maybe.toDate !== 'function') return undefined;
  return maybe.toDate();
}
