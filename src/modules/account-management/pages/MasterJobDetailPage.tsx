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
import { formatMinor } from '../utils/money';
import type { IWOState } from '@/modules/assignment/constants/iwo-states';

const STATE_TONE: Record<IWOState, string> = {
  DRAFT:                 'bg-slate-100 text-slate-700',
  ISSUED:                'bg-blue-100 text-blue-800',
  ACCEPTED:              'bg-cyan-100 text-cyan-800',
  REJECTED:              'bg-red-100 text-red-800',
  IN_PROGRESS:           'bg-indigo-100 text-indigo-800',
  DELIVERED:             'bg-amber-100 text-amber-900',
  ACCEPTED_INTERNALLY:   'bg-emerald-100 text-emerald-800',
  CLOSED:                'bg-slate-200 text-slate-800',
  CANCELLED:             'bg-zinc-200 text-zinc-700',
};

export default function MasterJobDetailPage() {
  const { masterJobId } = useParams<{ masterJobId: string }>();
  const { rollup, loading, masterJob } = useMasterJobRollup(masterJobId);
  const [issueOpen, setIssueOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  if (loading && !rollup) return <div className="p-6">Loading master job…</div>;
  if (!rollup || !masterJob) return <div className="p-6">Master job not found. <Link to="/master-jobs" className="text-blue-700">Back</Link></div>;

  const headroom = rollup.ceilingMinor - rollup.allocatedMinor;
  const changeOrderHref = `/clients/${masterJob.clientId}/master-jobs/${masterJob.id}/change-orders/new`;

  return (
    <div className="space-y-6 p-6" key={refreshKey}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/master-jobs" className="text-xs text-muted-foreground">← Master jobs</Link>
          <h1 className="mt-1 text-xl font-semibold">{rollup.code}</h1>
          <p className="text-sm text-muted-foreground">
            Status {rollup.status} · SOW {masterJob.sowId} · Quote {masterJob.quoteId}
          </p>
        </div>
        <button
          onClick={() => setIssueOpen(true)}
          disabled={rollup.status === 'CLOSED' || rollup.status === 'CANCELLED'}
          className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Issue Work Order
        </button>
      </header>

      <MasterJobRollupCard rollup={rollup} />

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Internal Work Orders</h2>
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
                <tr key={wo.id} className="border-t hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs">{wo.code}</td>
                  <td className="px-3 py-2">{wo.subsidiary.name}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATE_TONE[wo.status]}`}>
                      {wo.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMinor(wo.budgetMinor, wo.currency)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMinor(wo.cumulativeCostMinor, wo.currency)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMinor(wo.transferPriceMinor, wo.currency)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${wo.burnPct >= 100 ? 'text-red-700' : wo.burnPct >= 80 ? 'text-amber-700' : ''}`}>
                    {wo.burnPct.toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {rollup.clientInvoice && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Client invoice</h2>
          <div className="rounded border bg-white p-4">
            <div className="text-sm">Status: <strong>{rollup.clientInvoice.status}</strong></div>
            <div className="mt-1 tabular-nums">{formatMinor(rollup.clientInvoice.amountMinor, rollup.clientInvoice.currency)}</div>
          </div>
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
