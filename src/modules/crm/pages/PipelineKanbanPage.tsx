/**
 * /crm/pipeline — column-per-stage view of open leads, plus weighted
 * value summary per stage.
 *
 * No drag-and-drop yet (Phase 5 candidate); stage changes happen on the
 * detail page. The columns are read-only summaries.
 */

import { useEffect, useState } from 'react';
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
