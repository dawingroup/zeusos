/**
 * Payroll Batches — monthly archive landing page.
 *
 * Lists all payroll batches across periods. Year/month filters and
 * status filter narrow the view; "New batch" hops to PayrollPage with
 * the run-payroll dialog primed. The underlying components (list,
 * status badge, action menu) already existed but were not mounted on
 * any route.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Calendar,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { PayrollBatchList } from '@/modules/hr-central/payroll/components/PayrollBatchList';
import { usePayrollBatchList } from '@/modules/hr-central/payroll/hooks/usePayrollBatch';
import { useMonthlyPayrollRuns } from '@/modules/hr-central/payroll/hooks/useMonthlyPayrollRuns';
import { GenerateMonthlyRunDialog } from '@/modules/hr-central/payroll/components/GenerateMonthlyRunDialog';
import {
  MONTHLY_RUN_STATUS_COLORS,
  MONTHLY_RUN_STATUS_LABELS,
} from '@/modules/hr-central/payroll/types/monthly-payroll-run.types';
import { BATCH_STATUS_LABELS } from '@/modules/hr-central/payroll/types/payroll-batch.types';
import type { MonthlyPayrollRun } from '@/modules/hr-central/payroll/types/monthly-payroll-run.types';
import { useSubsidiary } from '@/contexts/SubsidiaryContext';

const MONTHS = [
  { value: 0, label: 'All months' },
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export function PayrollBatchListPage() {
  const navigate = useNavigate();
  const { currentSubsidiary } = useSubsidiary();
  const thisYear = new Date().getFullYear();

  const [year, setYear] = useState<number>(thisYear);
  const [month, setMonth] = useState<number>(0); // 0 = all

  const filters = useMemo(() => ({
    ...(currentSubsidiary?.id ? { subsidiaryId: currentSubsidiary.id } : {}),
    ...(year ? { year } : {}),
    ...(month > 0 ? { month } : {}),
  }), [currentSubsidiary?.id, year, month]);

  const { batches, isLoading, refresh } = usePayrollBatchList(filters);
  const { runs: monthlyRuns } = useMonthlyPayrollRuns({ year });
  const [showGenerateRun, setShowGenerateRun] = useState(false);

  // Sub-batches are grouped under their monthly run below; only show
  // genuinely standalone batches (no monthlyRunId) in the flat list.
  const standaloneBatches = useMemo(
    () => batches.filter(b => !b.monthlyRunId),
    [batches],
  );

  // Year selector spans this year + 4 back. Roll forward as years pass.
  const yearOptions = useMemo(() => {
    const out: number[] = [];
    for (let y = thisYear + 1; y >= thisYear - 4; y--) out.push(y);
    return out;
  }, [thisYear]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/hr/payroll')} className="mb-1 -ml-2">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to current payroll
          </Button>
          <h1 className="text-2xl font-semibold text-foreground">Payroll batches</h1>
          <p className="text-sm text-muted-foreground">
            All monthly payroll runs. Click a batch to view its payslips, approval history, and payment status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowGenerateRun(true)}>
            <Layers className="w-4 h-4 mr-1.5" /> Generate monthly run
          </Button>
          <Calendar className="w-4 h-4 text-[var(--fg-tertiary)] ml-2" />
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-1.5 border border-[var(--border-default)] rounded-md text-sm"
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="px-3 py-1.5 border border-[var(--border-default)] rounded-md text-sm"
          >
            {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      </div>

      {monthlyRuns.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarRange className="w-4 h-4" />
            <span className="font-medium text-foreground">Monthly payroll runs</span>
            <span className="text-[var(--fg-tertiary)]">·</span>
            <span className="text-[var(--fg-tertiary)]">
              {monthlyRuns.length} run{monthlyRuns.length === 1 ? '' : 's'} in {year}
            </span>
          </div>
          <div className="space-y-2">
            {monthlyRuns.map(r => (
              <MonthlyRunCard key={r.id} run={r} onOpenRun={() => navigate(`/hr/payroll/monthly-runs/${r.id}`)} onOpenBatch={(bid) => navigate(`/hr/payroll/batches/${bid}`)} />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Layers className="w-4 h-4" />
          <span className="font-medium text-foreground">Standalone batches</span>
          <span className="text-[var(--fg-tertiary)]">·</span>
          <span className="text-[var(--fg-tertiary)]">
            {standaloneBatches.length} batch{standaloneBatches.length === 1 ? '' : 'es'} not part of a monthly run
          </span>
        </div>
        <PayrollBatchList
          batches={standaloneBatches}
          isLoading={isLoading}
          onCreateBatch={() => navigate('/hr/payroll?action=run')}
          onRefresh={refresh}
        />
      </div>

      <GenerateMonthlyRunDialog open={showGenerateRun} onOpenChange={setShowGenerateRun} />
    </div>
  );
}

/**
 * MonthlyRunCard — expandable row that surfaces the parent ↔ sub-batch
 * relationship that's otherwise invisible in a flat list. Click the
 * header chevron to reveal the sub-batches inline; the period label
 * and the "Open run" button both navigate to the run detail page.
 */
function MonthlyRunCard({
  run,
  onOpenRun,
  onOpenBatch,
}: {
  run: MonthlyPayrollRun;
  onOpenRun: () => void;
  onOpenBatch: (batchId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const color = MONTHLY_RUN_STATUS_COLORS[run.status];
  const subBatches = run.subBatches || [];

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[var(--fg-tertiary)] hover:text-muted-foreground"
          aria-label={expanded ? 'Collapse' : 'Expand'}
          title={expanded ? 'Collapse sub-batches' : 'Show sub-batches'}
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">{run.period}</span>
            <Badge variant="outline" className={`bg-${color}-50 text-${color}-700 border-${color}-200 text-xs`}>
              {MONTHLY_RUN_STATUS_LABELS[run.status]}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {run.subBatchCount} sub-batch{run.subBatchCount === 1 ? '' : 'es'} ·
              {' '}{run.totalEmployees} employee{run.totalEmployees === 1 ? '' : 's'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Net UGX {(run.totalNetPay || 0).toLocaleString()}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onOpenRun}>
          Open run
        </Button>
      </div>

      {expanded && (
        <div className="border-t bg-[var(--bg-sunken)]">
          {subBatches.length === 0 ? (
            <p className="px-4 py-3 text-xs text-muted-foreground italic">No sub-batches yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 pl-10">Subsidiary</th>
                  <th className="text-left px-4 py-2">Batch #</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-right px-4 py-2">Employees</th>
                  <th className="text-right px-4 py-2">Net pay</th>
                  <th className="text-right px-4 py-2">Errors</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {subBatches.map(sb => (
                  <tr key={sb.batchId} className="border-t border-[var(--border-subtle)] hover:bg-card">
                    <td className="px-4 py-2 pl-10 font-medium text-foreground flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[var(--fg-tertiary)]" />
                      {sb.subsidiaryName}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{sb.batchNumber}</td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className="capitalize text-xs">
                        {BATCH_STATUS_LABELS[sb.status] ?? sb.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-right">{sb.employeeCount}</td>
                    <td className="px-4 py-2 text-right font-mono">
                      UGX {(sb.totalNetPay || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {sb.errorCount > 0
                        ? <span className="text-red-600 font-medium">{sb.errorCount}</span>
                        : <span className="text-[var(--fg-tertiary)]">0</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button size="sm" variant="ghost" onClick={() => onOpenBatch(sb.batchId)}>
                        Open
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default PayrollBatchListPage;
