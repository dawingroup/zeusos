/**
 * /master-jobs/:masterJobId — the §9.4 MasterJobRollup view.
 *
 * Header: code · status · ceiling · allocated · margin · client total.
 * IWO grid: per-row state badge + budget + cumulative + transfer + burn%.
 * Client invoice card if exists.
 * "Issue Work Order" button → IssueIWODialog.
 */

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMasterJobRollup } from '@/modules/assignment/hooks/useMasterJobRollup';
import { MasterJobRollupCard } from '../components/MasterJobRollupCard';
import { IssueIWODialog } from '../components/IssueIWODialog';
import { BriefIntakeForm } from '../components/BriefIntakeForm';
import { CesTable } from '../components/CesTable';
import { BackBar, Pill, SideCard, MetaRow } from '@/shared/components/refresh';
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
  const navigate = useNavigate();
  const { masterJobId } = useParams<{ masterJobId: string }>();
  const { rollup, loading, masterJob } = useMasterJobRollup(masterJobId);
  const [issueOpen, setIssueOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState<Tab>('overview');

  if (loading && !rollup) return <div style={{ padding: 'var(--pad-page)', color: 'var(--fg-tertiary)' }}>Loading master job…</div>;
  if (!rollup || !masterJob) return <div style={{ padding: 'var(--pad-page)' }}>Master job not found. <Link to="/master-jobs" className="text-[var(--rag-blue)]">Back</Link></div>;

  const headroom = rollup.ceilingMinor - rollup.allocatedMinor;
  const changeOrderHref = `/clients/${masterJob.clientId}/master-jobs/${masterJob.id}/change-orders/new`;
  const closed = rollup.status === 'CLOSED' || rollup.status === 'CANCELLED';
  const statusTone = rollup.status === 'OPEN' ? 'green' : closed ? 'neutral' : 'blue';

  return (
    <div style={{ padding: 'var(--pad-page)' }} key={refreshKey} data-testid="master-job-detail-page">
      <BackBar label="Master jobs" onBack={() => navigate('/master-jobs')} />

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Master job</div>
          <h1 className="display" data-testid="master-job-code">{rollup.code}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            <Pill tone={statusTone}><span data-testid="master-job-status">{rollup.status}</span></Pill>
            <span className="mono" style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>SOW {masterJob.sowId}</span>
            <span className="mono" style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>Quote {masterJob.quoteId}</span>
          </div>
        </div>
        <button
          data-testid="issue-work-order"
          onClick={() => setIssueOpen(true)}
          disabled={closed}
          className="btn btn-accept"
        >
          Issue Work Order
        </button>
      </div>

      {/* Phase 6.UI.D — tabbed surface (Overview · Brief · CES · IWOs).
          Quote + Reporting tabs deferred. */}
      <nav style={{ borderBottom: '1px solid var(--border-subtle)', marginBottom: 20 }} aria-label="Master job tabs">
        <ul className="flex gap-1 -mb-px">
          {TAB_DEFS.map((t) => (
            <li key={t.id}>
              <button
                data-testid={t.testId}
                onClick={() => setTab(t.id)}
                className={cn(
                  'inline-block px-3.5 py-2.5 text-[13px] border-b-2 transition-colors',
                  tab === t.id
                    ? 'border-[var(--zeus-red)] text-[var(--fg-primary)] font-semibold'
                    : 'border-transparent text-[var(--fg-tertiary)] font-medium hover:text-[var(--fg-primary)]',
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
            <SideCard title="Client invoice">
              <MetaRow label="Status" value={<strong>{rollup.clientInvoice.status}</strong>} />
              <MetaRow
                label="Amount"
                value={<span className="tabular">{formatMinor(rollup.clientInvoice.amountMinor, rollup.clientInvoice.currency)}</span>}
              />
            </SideCard>
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
            <div className="card card-pad" style={{ borderStyle: 'dashed', textAlign: 'center', color: 'var(--fg-tertiary)', fontSize: 13 }}>
              No IWOs issued yet. Click "Issue Work Order" to allocate a slice of the ceiling to one subsidiary.
            </div>
          )}
          {rollup.workOrders.length > 0 && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>IWO</th>
                    <th>Subsidiary</th>
                    <th>State</th>
                    <th style={{ textAlign: 'right' }}>Budget</th>
                    <th style={{ textAlign: 'right' }}>Cumulative cost</th>
                    <th style={{ textAlign: 'right' }}>Transfer price</th>
                    <th style={{ textAlign: 'right' }}>Burn</th>
                  </tr>
                </thead>
                <tbody>
                  {rollup.workOrders.map((wo) => (
                    <tr key={wo.id} data-testid={`mj-iwo-row-${wo.id}`}>
                      <td className="mono" style={{ fontSize: 12 }} data-testid={`mj-iwo-row-${wo.id}-code`}>{wo.code}</td>
                      <td>{wo.subsidiary.name}</td>
                      <td>
                        <span
                          data-testid={`mj-iwo-row-${wo.id}-state`}
                          className={`rounded px-2 py-0.5 text-xs font-medium ${STATE_TONE[wo.status]}`}
                        >
                          {wo.status}
                        </span>
                      </td>
                      <td className="tabular" style={{ textAlign: 'right' }}>{formatMinor(wo.budgetMinor, wo.currency)}</td>
                      <td className="tabular" style={{ textAlign: 'right' }}>{formatMinor(wo.cumulativeCostMinor, wo.currency)}</td>
                      <td className="tabular" style={{ textAlign: 'right' }}>{formatMinor(wo.transferPriceMinor, wo.currency)}</td>
                      <td
                        data-testid={`mj-iwo-row-${wo.id}-burn`}
                        className="tabular"
                        style={{
                          textAlign: 'right',
                          color: wo.burnPct >= 100 ? 'var(--rag-red)' : wo.burnPct >= 80 ? 'var(--rag-amber)' : undefined,
                        }}
                      >
                        {wo.burnPct.toFixed(0)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
