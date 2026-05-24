/**
 * /crm/pipeline — column-per-stage view of open leads, plus weighted
 * value summary per stage.
 *
 * No drag-and-drop yet (Phase 5 candidate); stage changes happen on the
 * detail page. The columns are read-only summaries.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/core/hooks/useAuth';
import { listLeads } from '../services/lead.service';
import type { Lead, LeadStage } from '../types/lead.types';
import { LeadCard } from '../components/LeadCard';
import { STAGE_LABEL } from '../components/LeadStageBadge';

const DEFAULT_ORG_ID = 'default';

const PIPELINE_STAGES: LeadStage[] = ['PROSPECT', 'QUALIFIED', 'PITCH', 'WON'];

function formatMoney(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
}

export default function PipelineKanbanPage() {
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;

  const [rows, setRows] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError(null);
    listLeads({ orgId })
      .then(setRows)
      .catch((err) => setError(String((err as Error).message)))
      .finally(() => setLoading(false));
  }, [user, orgId]);

  // Group by stage. WON column shows current-month closes; LOST is hidden
  // from the Kanban (visible only in the list view filter).
  const byStage = PIPELINE_STAGES.reduce<Record<LeadStage, Lead[]>>((acc, s) => {
    acc[s] = rows.filter((l) => l.stage === s);
    return acc;
  }, {} as Record<LeadStage, Lead[]>);

  // ── Funnel KPIs ────────────────────────────────────────────────────
  // Weighted pipeline value sums expected value of OPEN leads only
  // (PROSPECT/QUALIFIED/PITCH). Win-rate uses leads closed in the last 90
  // days; closing date is a stored Firestore Timestamp serverSide so we
  // accept either a Date-like object or an ISO string.
  const kpis = useMemo(() => {
    const open = rows.filter((l) => l.stage !== 'WON' && l.stage !== 'LOST');
    const weightedByCurrency = new Map<string, number>();
    for (const lead of open) {
      const v = lead.estimatedValueMinor ?? 0;
      const p = lead.probability ?? 0;
      weightedByCurrency.set(
        lead.currency,
        (weightedByCurrency.get(lead.currency) ?? 0) + v * p,
      );
    }

    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const closedRecently = rows.filter((l) => {
      if (l.stage !== 'WON' && l.stage !== 'LOST') return false;
      const c = l.closedAt as unknown;
      if (!c) return false;
      const ts = c as { seconds?: number; toDate?: () => Date };
      let ms: number | undefined;
      if (typeof c === 'string') ms = Date.parse(c);
      else if (typeof ts.toDate === 'function') ms = ts.toDate().getTime();
      else if (typeof ts.seconds === 'number') ms = ts.seconds * 1000;
      return typeof ms === 'number' && ms >= ninetyDaysAgo;
    });
    const wonRecently = closedRecently.filter((l) => l.stage === 'WON').length;
    const lostRecently = closedRecently.filter((l) => l.stage === 'LOST').length;
    const winRate = closedRecently.length
      ? wonRecently / closedRecently.length
      : null;

    return {
      openCount: open.length,
      weightedByCurrency,
      wonRecently,
      lostRecently,
      winRate,
      closedSampleSize: closedRecently.length,
    };
  }, [rows]);

  // Currency assumption: the Kanban shows totals only when all leads in
  // a column share the same currency. Otherwise we render "—" and count.
  function columnTotal(leads: Lead[]): { label: string; subtitle: string } {
    if (leads.length === 0) return { label: '—', subtitle: 'no leads' };
    const currencies = new Set(leads.map((l) => l.currency));
    if (currencies.size > 1) {
      return { label: 'mixed', subtitle: `${leads.length} leads, multiple currencies` };
    }
    const currency = leads[0].currency;
    const total = leads.reduce((sum, l) => sum + (l.estimatedValueMinor ?? 0), 0);
    const weighted = leads.reduce(
      (sum, l) => sum + ((l.estimatedValueMinor ?? 0) * (l.probability ?? 0)),
      0,
    );
    return {
      label: formatMoney(total, currency),
      subtitle: `weighted: ${formatMoney(weighted, currency)} · ${leads.length} leads`,
    };
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Open leads grouped by funnel stage. Move leads between stages from the detail page.
          </p>
        </div>
        <Link to="/crm" className="rounded border px-3 py-1 text-sm" data-testid="crm-list-link">
          List view
        </Link>
      </header>

      {loading && <p className="text-sm text-muted-foreground">Loading pipeline…</p>}
      {error && <p className="text-sm text-destructive">Error: {error}</p>}

      {!loading && !error && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="funnel-kpis">
          <div className="rounded border bg-card p-3">
            <p className="text-xs uppercase text-muted-foreground">Open leads</p>
            <p className="mt-1 text-2xl font-semibold" data-testid="kpi-open-count">
              {kpis.openCount}
            </p>
            <p className="text-xs text-muted-foreground">across {PIPELINE_STAGES.length - 1} open stages</p>
          </div>

          <div className="rounded border bg-card p-3">
            <p className="text-xs uppercase text-muted-foreground">Weighted pipeline</p>
            {kpis.weightedByCurrency.size === 0 && (
              <p className="mt-1 text-2xl font-semibold">—</p>
            )}
            {kpis.weightedByCurrency.size > 0 && (
              <ul className="mt-1 space-y-0.5" data-testid="kpi-weighted">
                {Array.from(kpis.weightedByCurrency.entries()).map(([ccy, total]) => (
                  <li key={ccy} className="font-semibold">
                    {formatMoney(total, ccy)}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">value × probability, by currency</p>
          </div>

          <div className="rounded border bg-card p-3">
            <p className="text-xs uppercase text-muted-foreground">Win rate · 90d</p>
            <p className="mt-1 text-2xl font-semibold" data-testid="kpi-win-rate">
              {kpis.winRate === null ? '—' : `${Math.round(kpis.winRate * 100)}%`}
            </p>
            <p className="text-xs text-muted-foreground">
              {kpis.closedSampleSize === 0
                ? 'no leads closed yet'
                : `${kpis.wonRecently} won / ${kpis.lostRecently} lost`}
            </p>
          </div>

          <div className="rounded border bg-card p-3">
            <p className="text-xs uppercase text-muted-foreground">Closed · 90d</p>
            <p className="mt-1 text-2xl font-semibold">{kpis.closedSampleSize}</p>
            <p className="text-xs text-muted-foreground">leads moved to WON or LOST</p>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4" data-testid="kanban-board">
          {PIPELINE_STAGES.map((stage) => {
            const leads = byStage[stage];
            const totals = columnTotal(leads);
            return (
              <div key={stage} className="rounded border bg-muted/20 p-3" data-stage={stage}>
                <header className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold">{STAGE_LABEL[stage]}</h2>
                  <span className="text-xs text-muted-foreground">{leads.length}</span>
                </header>
                <div className="mb-3 rounded bg-card p-2 text-xs">
                  <p className="font-semibold">{totals.label}</p>
                  <p className="text-muted-foreground">{totals.subtitle}</p>
                </div>
                <div className="space-y-2">
                  {leads.map((l) => (
                    <LeadCard key={l.id} lead={l} />
                  ))}
                  {leads.length === 0 && (
                    <p className="rounded border border-dashed p-3 text-center text-xs text-muted-foreground">
                      Empty
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
