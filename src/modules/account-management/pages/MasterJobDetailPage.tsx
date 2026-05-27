/**
 * /master-jobs/:masterJobId — the §9.4 MasterJobRollup view.
 *
 * Header: code · status · ceiling · allocated · margin · client total.
 * IWO grid: per-row state badge + budget + cumulative + transfer + burn%.
 * Client invoice card if exists.
 * "Issue Work Order" button → IssueIWODialog.
 */

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMasterJobRollup } from '@/modules/assignment/hooks/useMasterJobRollup';
import { MasterJobRollupCard } from '../components/MasterJobRollupCard';
import { IssueIWODialog } from '../components/IssueIWODialog';
import { BriefIntakeForm } from '../components/BriefIntakeForm';
import { CesTable } from '../components/CesTable';
import { formatMinor } from '../utils/money';
import type { IWOState } from '@/modules/assignment/constants/iwo-states';
import { cn } from '@/shared/lib/utils';

type Tab = 'overview' | 'brief' | 'ces' | 'iwos';

const TAB_DEFS: { id: Tab; label: string; testId: string }[] = [
  { id: 'overview', label: 'Overview', testId: 'mj-tab-overview' },
  { id: 'brief',    label: 'Brief',    testId: 'mj-tab-brief' },
  { id: 'ces',      label: 'CES',      testId: 'mj-tab-ces' },
  { id: 'iwos',     label: 'IWOs',     testId: 'mj-tab-iwos' },
];

const STATE_TONE: Record<IWOState, string> = {
  DRAFT:                 'bg-[var(--bg-sunken)] text-muted-foreground',
  ISSUED:                'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
  ACCEPTED:              'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
  REJECTED:              'bg-[var(--rag-red-soft)] text-[var(--rag-red)]',
  IN_PROGRESS:           'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
  DELIVERED:             'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]',
  ACCEPTED_INTERNALLY:   'bg-[var(--rag-green-soft)] text-[var(--rag-green)]',
  CLOSED:                'bg-[var(--bg-sunken)] text-foreground',
  CANCELLED:             'bg-[var(--bg-sunken)] text-muted-foreground',
};

export default function MasterJobDetailPage() {
  const { masterJobId } = useParams<{ masterJobId: string }>();
  const { rollup, loading, masterJob } = useMasterJobRollup(masterJobId);
  const [issueOpen, setIssueOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState<Tab>('overview');

  if (loading && !rollup) return <div className="p-6">Loading master job…</div>;
  if (!rollup || !masterJob) return <div className="p-6">Master job not found. <Link to="/master-jobs" className="text-[var(--rag-blue)]">Back</Link></div>;

  const headroom = rollup.ceilingMinor - rollup.allocatedMinor;
  const changeOrderHref = `/clients/${masterJob.clientId}/master-jobs/${masterJob.id}/change-orders/new`;

  return (
    <div className="space-y-6 p-6" key={refreshKey} data-testid="master-job-detail-page">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/master-jobs" className="text-xs text-muted-foreground">← Master jobs</Link>
          <h1 className="mt-1 text-xl font-semibold" data-testid="master-job-code">{rollup.code}</h1>
          <p className="text-sm text-muted-foreground">
            Status <span data-testid="master-job-status">{rollup.status}</span> · SOW {masterJob.sowId} · Quote {masterJob.quoteId}
          </p>
        </div>
        <button
          data-testid="issue-work-order"
          onClick={() => setIssueOpen(true)}
          disabled={rollup.status === 'CLOSED' || rollup.status === 'CANCELLED'}
          className="rounded bg-[var(--rag-green)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--rag-green)] disabled:opacity-50"
        >
          Issue Work Order
        </button>
      </header>

      {/* Phase 6.UI.D — tabbed surface (Overview · Brief · CES · IWOs).
          Quote + Reporting tabs deferred. */}
      <nav className="border-b border-[var(--border-default)]" aria-label="Master job tabs">
        <ul className="flex gap-1 -mb-px">
          {TAB_DEFS.map((t) => (
            <li key={t.id}>
              <button
                data-testid={t.testId}
                onClick={() => setTab(t.id)}
                className={cn(
                  'inline-block px-3 py-2 text-[13px] font-medium border-b-2 transition-colors',
                  tab === t.id
                    ? 'border-[var(--accent)] text-[var(--accent)]'
                    : 'border-transparent text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]',
                )}
              >
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {tab === 'overview' && (
        <div className="space-y-6">
          <MasterJobRollupCard rollup={rollup} />
          {rollup.clientInvoice && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Client invoice</h2>
              <div className="rounded border bg-card p-4">
                <div className="text-sm">Status: <strong>{rollup.clientInvoice.status}</strong></div>
                <div className="mt-1 tabular-nums">{formatMinor(rollup.clientInvoice.amountMinor, rollup.clientInvoice.currency)}</div>
              </div>
            </section>
          )}
        </div>
      )}

      {tab === 'brief' && (
        <BriefIntakeForm
          masterJobId={masterJob.id}
          brief={masterJob.campaign?.brief}
          onSaved={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {tab === 'ces' && (
        <CesTable
          masterJob={masterJob}
          linkedQuoteTotalMinor={masterJob.clientTotalMinor}
        />
      )}

      {tab === 'iwos' && (
        <section data-testid="mj-tab-iwos-panel">
          {rollup.workOrders.length === 0 && (
            <div className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
              No IWOs issued yet. Click "Issue Work Order" to allocate a slice of the ceiling to one subsidiary.
            </div>
          )}
          {rollup.workOrders.length > 0 && (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2">IWO</th>
                  <th className="px-3 py-2">Subsidiary</th>
                  <th className="px-3 py-2">State</th>
                  <th className="px-3 py-2 text-right">Budget</th>
                  <th className="px-3 py-2 text-right">Cumulative cost</th>
                  <th className="px-3 py-2 text-right">Transfer price</th>
                  <th className="px-3 py-2 text-right">Burn</th>
                </tr>
              </thead>
              <tbody>
                {rollup.workOrders.map(wo => (
                  <tr key={wo.id} className="border-t hover:bg-[var(--bg-sunken)]" data-testid={`mj-iwo-row-${wo.id}`}>
                    <td className="px-3 py-2 font-mono text-xs" data-testid={`mj-iwo-row-${wo.id}-code`}>{wo.code}</td>
                    <td className="px-3 py-2">{wo.subsidiary.name}</td>
                    <td className="px-3 py-2">
                      <span
                        data-testid={`mj-iwo-row-${wo.id}-state`}
                        className={`rounded px-2 py-0.5 text-xs font-medium ${STATE_TONE[wo.status]}`}>
                        {wo.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMinor(wo.budgetMinor, wo.currency)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMinor(wo.cumulativeCostMinor, wo.currency)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMinor(wo.transferPriceMinor, wo.currency)}</td>
                    <td
                      data-testid={`mj-iwo-row-${wo.id}-burn`}
                      className={`px-3 py-2 text-right tabular-nums ${wo.burnPct >= 100 ? 'text-[var(--rag-red)]' : wo.burnPct >= 80 ? 'text-[var(--rag-amber)]' : ''}`}>
                      {wo.burnPct.toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {issueOpen && (
        <IssueIWODialog
          masterJob={masterJob}
          headroomMinor={headroom}
          changeOrderHref={changeOrderHref}
          onClose={() => setIssueOpen(false)}
          onIssued={() => {
            setIssueOpen(false);
            setRefreshKey(k => k + 1);
          }}
        />
      )}
    </div>
  );
}
