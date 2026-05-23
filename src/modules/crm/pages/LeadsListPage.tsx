/**
 * /crm — sales pipeline list view. Filter by stage/source/owner, search
 * by lead name. Defaults to the OPEN funnel (everything except WON/LOST).
 *
 * Parent-org only via Firestore rules; this page assumes the user is a
 * commercial actor.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/core/hooks/useAuth';
import { listLeads } from '../services/lead.service';
import type { Lead, LeadStage, LeadSource } from '../types/lead.types';
import { LeadStageBadge } from '../components/LeadStageBadge';

const DEFAULT_ORG_ID = 'default';

const STAGE_OPTIONS: Array<LeadStage | 'OPEN' | 'ALL'> = [
  'OPEN', 'ALL', 'PROSPECT', 'QUALIFIED', 'PITCH', 'WON', 'LOST',
];

const SOURCE_OPTIONS: Array<LeadSource | 'ALL'> = [
  'ALL', 'REFERRAL', 'INBOUND', 'OUTBOUND', 'EVENT', 'EXISTING_CLIENT', 'OTHER',
];

function formatMoney(minor: number | undefined, currency: string): string {
  if (typeof minor !== 'number') return '—';
  return `${currency} ${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
}

function formatDate(value: unknown): string {
  if (!value) return '—';
  if (typeof value === 'string') return value.slice(0, 10);
  const ts = value as { seconds?: number; toDate?: () => Date };
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString().slice(0, 10);
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000).toISOString().slice(0, 10);
  return '—';
}

export default function LeadsListPage() {
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;

  const [rows, setRows] = useState<Lead[]>([]);
  const [stageFilter, setStageFilter] = useState<LeadStage | 'OPEN' | 'ALL'>('OPEN');
  const [sourceFilter, setSourceFilter] = useState<LeadSource | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // The "OPEN" pseudo-filter fetches all stages and filters client-side
      // (we don't want to fire two parallel queries for the common case).
      const result = await listLeads({
        orgId,
        stage: stageFilter === 'OPEN' || stageFilter === 'ALL' ? undefined : stageFilter,
        source: sourceFilter === 'ALL' ? undefined : sourceFilter,
      });
      const filtered = stageFilter === 'OPEN'
        ? result.filter((l) => l.stage !== 'WON' && l.stage !== 'LOST')
        : result;
      setRows(filtered);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, [user, orgId, stageFilter, sourceFilter]);

  const visible = search.trim()
    ? rows.filter((l) => l.name.toLowerCase().includes(search.trim().toLowerCase()))
    : rows;

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Sales Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Leads, prospects, and live pitches. Convert won deals into Clients in Account Management.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            className="rounded border px-2 py-1 text-sm"
            data-testid="lead-search"
          />
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value as LeadStage | 'OPEN' | 'ALL')}
            className="rounded border px-2 py-1 text-sm"
            data-testid="lead-stage-filter"
          >
            {STAGE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === 'OPEN' ? 'Open pipeline' : s === 'ALL' ? 'All stages' : s}
              </option>
            ))}
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as LeadSource | 'ALL')}
            className="rounded border px-2 py-1 text-sm"
            data-testid="lead-source-filter"
          >
            {SOURCE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s === 'ALL' ? 'All sources' : s}</option>
            ))}
          </select>
          <Link
            to="/crm/pipeline"
            className="rounded border px-3 py-1 text-sm"
            data-testid="crm-pipeline-link"
          >
            Pipeline view
          </Link>
          <Link
            to="/crm/new"
            className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground"
            data-testid="lead-new"
          >
            + New lead
          </Link>
        </div>
      </header>

      {loading && <p className="text-sm text-muted-foreground">Loading leads…</p>}
      {error && <p className="text-sm text-destructive">Error: {error}</p>}

      {!loading && !error && visible.length === 0 && (
        <div className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
          No leads in this view. Click <strong>+ New lead</strong> to add one.
        </div>
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm" data-testid="lead-table">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2 font-medium">Lead</th>
                <th className="px-4 py-2 font-medium">Contact</th>
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2 font-medium">Stage</th>
                <th className="px-4 py-2 font-medium">Value</th>
                <th className="px-4 py-2 font-medium">Next action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((l) => (
                <tr key={l.id} className="border-t hover:bg-muted/30" data-lead-id={l.id}>
                  <td className="px-4 py-2 font-medium">
                    <Link to={`/crm/${l.id}`} className="hover:underline">{l.name}</Link>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {l.contactName || <span className="text-muted-foreground">—</span>}
                    {l.contactEmail && (
                      <span className="block text-muted-foreground">{l.contactEmail}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{l.source}</td>
                  <td className="px-4 py-2"><LeadStageBadge stage={l.stage} /></td>
                  <td className="px-4 py-2 font-medium">
                    {formatMoney(l.estimatedValueMinor, l.currency)}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {l.nextActionLabel ? (
                      <>
                        {l.nextActionLabel}
                        {l.nextActionDate && (
                          <span className="ml-1 text-muted-foreground">
                            · {formatDate(l.nextActionDate)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
