/**
 * Payroll Batch Detail page.
 *
 * Wires the existing PayrollBatchDetail component to the route, the
 * single-batch hook, and the auth context. Renders the new Employees
 * tab via a child component (the original component leaves that tab
 * as a stub).
 */

import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AlertCircle, CalendarRange, Loader2 } from 'lucide-react';
import { Badge } from '@/core/components/ui/badge';
import { Button } from '@/core/components/ui/button';
import { PayrollBatchDetail } from '@/modules/hr-central/payroll/components/PayrollBatchDetail';
import { BatchEmployeesPanel } from '@/modules/hr-central/payroll/components/BatchEmployeesPanel';
import { usePayrollBatch } from '@/modules/hr-central/payroll/hooks/usePayrollBatch';
import { useSubsidiaries } from '@/modules/hr-central/payroll/hooks/useSubsidiaries';
import {
  downloadBatchPayslipsHTML,
  DEFAULT_HTML_COMPANY_INFO,
} from '@/modules/hr-central/payroll/services/payslip-generator.service';
import { useAuth, useCurrentUserId } from '@/contexts/AuthContext';

export function PayrollBatchDetailPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = useCurrentUserId();
  const userName = user?.displayName || user?.email || 'Unknown';
  const userRole = 'Manager'; // TODO: derive from claims when role system lands

  const {
    batch,
    payrolls,
    isLoading,
    error,
    calculationProgress,
    isCalculating,
    calculate,
    recalculate,
    submitForReview,
    approve,
    reject,
    returnBatch,
    processPayments,
    reverse,
  } = usePayrollBatch(batchId, userId, userName, userRole);
  const { nameMap: subsidiaryNames } = useSubsidiaries();

  const handleDownloadPayslips = () => {
    if (!batch || payrolls.length === 0) return;
    downloadBatchPayslipsHTML(
      payrolls,
      DEFAULT_HTML_COMPANY_INFO,
      `Batch-Payslips-${batch.batchNumber}.html`,
      subsidiaryNames,
    );
  };

  if (isLoading && !batch) {
    return (
      <div className="py-16 flex items-center justify-center text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading batch…
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-200 bg-red-50 text-red-800 rounded p-4 text-sm flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5" />
        <div>
          <div className="font-medium">Couldn't load this batch</div>
          <div className="text-xs mt-0.5">{error}</div>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => navigate('/hr/payroll/batches')}>
            Back to batches
          </Button>
        </div>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p>Batch not found.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/hr/payroll/batches')}>
          Back to batches
        </Button>
      </div>
    );
  }

  const parentRunId = batch.monthlyRunId;
  const parentPeriod = batch.year && batch.month
    ? `${batch.year}-${String(batch.month).padStart(2, '0')}`
    : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {parentRunId ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/hr/payroll/monthly-runs/${parentRunId}`)}
              className="-ml-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Monthly run {parentPeriod}
            </Button>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
              <CalendarRange className="w-3 h-3 mr-1" />
              Sub-batch of monthly run
            </Badge>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => navigate('/hr/payroll/batches')} className="-ml-2">
            <ArrowLeft className="w-4 h-4 mr-1" /> All batches
          </Button>
        )}
      </div>

      <PayrollBatchDetail
        batch={batch}
        isCalculating={isCalculating}
        calculationProgress={calculationProgress ?? undefined}
        onCalculate={calculate}
        onRecalculate={recalculate}
        onSubmitForReview={submitForReview}
        onApprove={approve}
        onReject={reject}
        onReturn={returnBatch}
        onProcessPayment={processPayments}
        onDownloadPayslips={handleDownloadPayslips}
        onDownloadReport={() => { /* wired in next iteration */ }}
        onReverse={reverse}
      />

      {/* The Employees tab in PayrollBatchDetail is a stub; we render
          the real list below, taking advantage of the payrolls already
          fetched by the same hook. */}
      <BatchEmployeesPanel payrolls={payrolls} batchSubsidiaryId={batch.subsidiaryId} />
    </div>
  );
}

export default PayrollBatchDetailPage;
