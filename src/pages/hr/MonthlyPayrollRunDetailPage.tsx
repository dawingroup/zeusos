/**
 * Monthly Payroll Run — detail page.
 *
 * Shows the parent run, aggregate totals, sub-batch table (one row per
 * subsidiary), and bulk-action buttons that fan an action out across
 * every applicable sub-batch.
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Building2,
  Calculator,
  CheckCircle2,
  CreditCard,
  FileSpreadsheet,
  Loader2,
  Send,
  XCircle,
} from 'lucide-react';

import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Card, CardContent } from '@/core/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/core/components/ui/table';

import { useMonthlyPayrollRun } from '@/modules/hr-central/payroll/hooks/useMonthlyPayrollRuns';
import { IntercompanyRechargeDialog } from '@/modules/hr-central/payroll/components/IntercompanyRechargeDialog';
import {
  MONTHLY_RUN_STATUS_COLORS,
  MONTHLY_RUN_STATUS_LABELS,
} from '@/modules/hr-central/payroll/types/monthly-payroll-run.types';
import { BATCH_STATUS_LABELS } from '@/modules/hr-central/payroll/types/payroll-batch.types';

function formatUGX(n: number): string {
  return `UGX ${(n || 0).toLocaleString()}`;
}

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object' && v !== null && 'toDate' in v && typeof (v as { toDate?: () => Date }).toDate === 'function') {
    try { return (v as { toDate: () => Date }).toDate(); } catch { return null; }
  }
  if (typeof v === 'object' && v !== null && 'seconds' in v) {
    return new Date(Number((v as { seconds: number }).seconds) * 1000);
  }
  if (typeof v === 'string' || typeof v === 'number') return new Date(v);
  return null;
}

export function MonthlyPayrollRunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const { run, loading, error, calculateAll, submitAll, approveAll, payAll, cancelAll } =
    useMonthlyPayrollRun(runId);

  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rechargeOpen, setRechargeOpen] = useState(false);

  const wrap = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading monthly run…
      </div>
    );
  }
  if (error || !run) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/hr/payroll/batches')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to batches
        </Button>
        <div className="text-sm text-[var(--rag-red)]">{error || 'Monthly run not found.'}</div>
      </div>
    );
  }

  const statusColor = MONTHLY_RUN_STATUS_COLORS[run.status];

  // Stage gates for bulk-action affordances
  const hasDraft = run.subBatches.some(s => s.status === 'draft');
  const hasCalculated = run.subBatches.some(s => s.status === 'calculated');
  const hasHrReview = run.subBatches.some(s => s.status === 'hr_review');
  const hasFinanceReview = run.subBatches.some(s => s.status === 'finance_review');
  const hasCeoReview = run.subBatches.some(s => s.status === 'ceo_review');
  const hasApproved = run.subBatches.some(s => s.status === 'approved');
  const hasOpen = run.subBatches.some(
    s => !['paid', 'cancelled', 'reversed'].includes(s.status as string),
  );

  const paymentDate = toDate(run.paymentDate);
  const createdAt = toDate(run.createdAt);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/hr/payroll/batches')}
            className="mb-1 -ml-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to batches
          </Button>
          <h1 className="text-2xl font-semibold text-foreground">
            Monthly run · {run.period}
          </h1>
          <p className="text-sm text-muted-foreground">
            {run.subBatchCount} sub-batch{run.subBatchCount === 1 ? '' : 'es'} ·
            {' '}{run.totalEmployees} employee{run.totalEmployees === 1 ? '' : 's'} ·
            {' '}created {createdAt ? format(createdAt, 'd MMM yyyy, HH:mm') : '—'}
            {run.createdByName ? ` by ${run.createdByName}` : ''}
          </p>
        </div>
        <Badge variant="outline" className={`bg-${statusColor}-50 text-${statusColor}-700 border-${statusColor}-200`}>
          {MONTHLY_RUN_STATUS_LABELS[run.status]}
        </Badge>
      </div>

      {/* Aggregate totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total Gross</p>
          <p className="text-lg font-semibold">{formatUGX(run.totalGross)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total Net Pay</p>
          <p className="text-lg font-semibold">{formatUGX(run.totalNetPay)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">PAYE + NSSF + LST</p>
          <p className="text-lg font-semibold">
            {formatUGX(run.totalPAYE + run.totalNSSFEmployee + run.totalLST)}
          </p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Payment date</p>
          <p className="text-lg font-semibold">
            {paymentDate ? format(paymentDate, 'd MMM yyyy') : '—'}
          </p>
        </CardContent></Card>
      </div>

      {/* Bulk actions */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium mr-2">Bulk actions</span>

          <Button
            size="sm"
            variant="default"
            disabled={!hasDraft || !!busy}
            onClick={() => wrap('calc', calculateAll)}
          >
            {busy === 'calc'
              ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              : <Calculator className="h-4 w-4 mr-1.5" />}
            Calculate all
          </Button>

          <Button
            size="sm"
            variant="secondary"
            disabled={!hasCalculated || !!busy}
            onClick={() => wrap('submit', submitAll)}
          >
            {busy === 'submit'
              ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              : <Send className="h-4 w-4 mr-1.5" />}
            Submit all for review
          </Button>

          <Button
            size="sm"
            variant="secondary"
            disabled={!hasHrReview || !!busy}
            onClick={() => wrap('approve-hr', () => approveAll('hr'))}
          >
            {busy === 'approve-hr'
              ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
            HR approve all
          </Button>

          <Button
            size="sm"
            variant="secondary"
            disabled={!hasFinanceReview || !!busy}
            onClick={() => wrap('approve-finance', () => approveAll('finance'))}
          >
            {busy === 'approve-finance'
              ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
            Finance approve all
          </Button>

          <Button
            size="sm"
            variant="secondary"
            disabled={!hasCeoReview || !!busy}
            onClick={() => wrap('approve-ceo', () => approveAll('ceo'))}
          >
            {busy === 'approve-ceo'
              ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
            CEO approve all
          </Button>

          <Button
            size="sm"
            variant="default"
            disabled={!hasApproved || !!busy}
            onClick={() => wrap('pay', payAll)}
          >
            {busy === 'pay'
              ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              : <CreditCard className="h-4 w-4 mr-1.5" />}
            Mark all paid
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setRechargeOpen(true)}
          >
            <FileSpreadsheet className="h-4 w-4 mr-1.5" />
            Intercompany recharge
          </Button>

          <Button
            size="sm"
            variant="ghost"
            disabled={!hasOpen || !!busy}
            onClick={() => {
              const reason = window.prompt('Reason for cancelling all sub-batches?');
              if (reason !== null) wrap('cancel', () => cancelAll(reason));
            }}
            className="text-[var(--rag-red)] hover:text-[var(--rag-red)]"
          >
            {busy === 'cancel'
              ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              : <XCircle className="h-4 w-4 mr-1.5" />}
            Cancel all
          </Button>
        </CardContent>
      </Card>

      {actionError && (
        <div className="text-sm text-[var(--rag-red)] bg-[var(--rag-red-soft)] border border-[var(--rag-red)] rounded-md p-3">
          {actionError}
        </div>
      )}

      {/* Sub-batch table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Subsidiary</TableHead>
                <TableHead>Batch #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Employees</TableHead>
                <TableHead className="text-right">Net Pay</TableHead>
                <TableHead className="text-right">Errors</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {run.subBatches.map(sb => (
                <TableRow key={sb.batchId}>
                  <TableCell className="font-medium flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    {sb.subsidiaryName}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{sb.batchNumber}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {BATCH_STATUS_LABELS[sb.status] ?? sb.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{sb.employeeCount}</TableCell>
                  <TableCell className="text-right">{formatUGX(sb.totalNetPay)}</TableCell>
                  <TableCell className="text-right">
                    {sb.errorCount > 0
                      ? <span className="text-[var(--rag-red)] font-medium">{sb.errorCount}</span>
                      : <span className="text-muted-foreground">0</span>}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/hr/payroll/batches/${sb.batchId}`)}
                    >
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <IntercompanyRechargeDialog
        open={rechargeOpen}
        onClose={() => setRechargeOpen(false)}
        year={run.year}
        month={run.month}
        hostSubsidiaryIds={run.subBatches.map(sb => sb.subsidiaryId)}
      />
    </div>
  );
}

export default MonthlyPayrollRunDetailPage;
