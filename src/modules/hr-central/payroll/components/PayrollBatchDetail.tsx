/**
 * Payroll Batch Detail Component
 * DawinOS HR Central - Payroll Module
 * 
 * Displays detailed view of a payroll batch with summary, employee list,
 * approval history, and action buttons.
 */

import React, { useState } from 'react';
import {
  Play,
  Send,
  CheckCircle,
  XCircle,
  RotateCcw,
  CreditCard,
  FileText,
  Download,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';

import {
  PayrollBatch,
  BatchCalculationProgress
} from '../types/payroll-batch.types';
import { formatCurrency } from '../utils/tax-calculator';
import { KPIGrid, KPICard } from '@/shared/components/data-display';

// ============================================================================
// Types
// ============================================================================

interface PayrollBatchDetailProps {
  batch: PayrollBatch;
  isCalculating: boolean;
  calculationProgress?: BatchCalculationProgress;
  onCalculate: () => void;
  onRecalculate: () => void;
  onSubmitForReview: () => void;
  onApprove: (comments?: string) => void;
  onReject: (comments: string) => void;
  onReturn: (comments: string) => void;
  onProcessPayment: () => void;
  onDownloadPayslips: () => void;
  onDownloadReport: () => void;
  /** Optional — when provided, a Reverse button appears for paid batches.
   *  Confirmed with a reason prompt before firing. */
  onReverse?: (reason: string) => void;
}

// ============================================================================
// Tab Panel Component
// ============================================================================

interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div className={value !== index ? 'hidden' : ''}>
    {value === index && children}
  </div>
);

// ============================================================================
// Approval Dialog Component
// ============================================================================

interface ApprovalDialogProps {
  isOpen: boolean;
  action: 'approve' | 'reject' | 'return';
  onClose: () => void;
  onConfirm: (comments: string) => void;
}

const ApprovalDialog: React.FC<ApprovalDialogProps> = ({
  isOpen,
  action,
  onClose,
  onConfirm
}) => {
  const [comments, setComments] = useState('');

  if (!isOpen) return null;

  const titles = {
    approve: 'Approve Payroll Batch',
    reject: 'Reject Payroll Batch',
    return: 'Return Payroll Batch'
  };

  const buttonColors = {
    approve: 'bg-green-600 hover:bg-green-700',
    reject: 'bg-red-600 hover:bg-red-700',
    return: 'bg-yellow-600 hover:bg-yellow-700'
  };

  const handleConfirm = () => {
    onConfirm(comments);
    setComments('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">{titles[action]}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <div className="p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Comments {action !== 'approve' && <span className="text-red-500">*</span>}
          </label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder={action === 'approve' ? 'Optional comments...' : 'Please provide a reason...'}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex justify-end gap-3 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={action !== 'approve' && !comments.trim()}
            className={`px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed ${buttonColors[action]}`}
          >
            Confirm {action.charAt(0).toUpperCase() + action.slice(1)}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Progress Bar Component
// ============================================================================

interface ProgressBarProps {
  progress: BatchCalculationProgress;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  const percentage = progress.total > 0 
    ? Math.round((progress.completed / progress.total) * 100) 
    : 0;

  return (
    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-blue-700">
          Calculating: {progress.currentEmployee || 'Starting...'}
        </span>
        <span className="text-sm text-blue-600">{percentage}%</span>
      </div>
      <div className="w-full bg-blue-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="mt-2 text-xs text-blue-600">
        {progress.completed} of {progress.total} completed
        {progress.failed > 0 && (
          <span className="text-red-600 ml-2">• {progress.failed} failed</span>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const PayrollBatchDetail: React.FC<PayrollBatchDetailProps> = ({
  batch,
  isCalculating,
  calculationProgress,
  onCalculate,
  onRecalculate,
  onSubmitForReview,
  onApprove,
  onReject,
  onReturn,
  onProcessPayment,
  onDownloadPayslips,
  onDownloadReport,
  onReverse
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | 'return'>('approve');
  const [showPaymentDetails, setShowPaymentDetails] = useState(true);
  const [confirmReverseOpen, setConfirmReverseOpen] = useState(false);
  const [reverseReason, setReverseReason] = useState('');

  const handleApprovalClick = (action: 'approve' | 'reject' | 'return') => {
    setApprovalAction(action);
    setApprovalDialogOpen(true);
  };

  const handleApprovalConfirm = (comments: string) => {
    if (approvalAction === 'approve') {
      onApprove(comments);
    } else if (approvalAction === 'reject') {
      onReject(comments);
    } else {
      onReturn(comments);
    }
    setApprovalDialogOpen(false);
  };

  // Action permissions
  const canCalculate = batch.status === 'draft';
  const canSubmit = batch.status === 'calculated' && batch.errorCount === 0;
  const canApprove = ['hr_review', 'finance_review', 'ceo_review'].includes(batch.status);
  const canProcessPayment = batch.status === 'approved';
  const canDownload = batch.status === 'paid';
  const canReverse = batch.status === 'paid' && !!onReverse;
  // Regenerate is offered for any pre-approval state. Once approved or
  // paid, the batch must be cancelled / reversed first.
  const canRecalculate = ['calculated', 'hr_review', 'finance_review', 'ceo_review'].includes(batch.status);
  const [confirmRegenOpen, setConfirmRegenOpen] = useState(false);

  // Format period
  const periodLabel = new Date(batch.year, batch.month - 1).toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{batch.batchNumber}</h1>
            <p className="text-gray-500 mt-1">
              {batch.subsidiaryName} • {periodLabel}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {canCalculate && (
              <button
                onClick={onCalculate}
                disabled={isCalculating}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Play className="h-4 w-4" />
                {isCalculating ? 'Calculating...' : 'Calculate'}
              </button>
            )}

            {canRecalculate && (
              <button
                onClick={() => setConfirmRegenOpen(true)}
                disabled={isCalculating}
                className="flex items-center gap-2 px-4 py-2 border border-amber-300 bg-amber-50 text-amber-800 rounded-md hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Recalculate all payslips with the latest salary, attendance, and overtime data. Resets approval state."
              >
                <RotateCcw className="h-4 w-4" />
                {isCalculating ? 'Regenerating...' : 'Regenerate'}
              </button>
            )}

            {canSubmit && (
              <button
                onClick={onSubmitForReview}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Send className="h-4 w-4" />
                Submit for Review
              </button>
            )}
            
            {canApprove && (
              <>
                <button
                  onClick={() => handleApprovalClick('approve')}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  <CheckCircle className="h-4 w-4" />
                  Approve
                </button>
                <button
                  onClick={() => handleApprovalClick('return')}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                  Return
                </button>
                <button
                  onClick={() => handleApprovalClick('reject')}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
              </>
            )}
            
            {canProcessPayment && (
              <button
                onClick={onProcessPayment}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <CreditCard className="h-4 w-4" />
                Process Payment
              </button>
            )}
            
            {canDownload && (
              <>
                <button
                  onClick={onDownloadPayslips}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  Download Payslips
                </button>
                <button
                  onClick={onDownloadReport}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Download Report
                </button>
              </>
            )}

            {canReverse && (
              <button
                onClick={() => { setReverseReason(''); setConfirmReverseOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 border border-red-300 bg-red-50 text-red-700 rounded-md hover:bg-red-100 transition-colors"
                title="Unwind this paid batch — restores loan / advance / installment balances. PAYE / NSSF already filed must be corrected separately."
              >
                <RotateCcw className="h-4 w-4" />
                Reverse
              </button>
            )}
          </div>
        </div>

        {/* Calculation Progress */}
        {isCalculating && calculationProgress && (
          <ProgressBar progress={calculationProgress} />
        )}

        {/* Errors Alert */}
        {batch.errorCount > 0 && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-red-800">
                {batch.errorCount} employee(s) could not be processed
              </p>
              <p className="text-sm text-red-600 mt-1">
                Please review and fix the errors before submitting.
              </p>
              {batch.errors && batch.errors.length > 0 && (
                <ul className="mt-3 space-y-1 max-h-60 overflow-y-auto text-xs text-red-700 font-mono">
                  {batch.errors.map((e, i) => (
                    <li key={`${e.employeeId}-${i}`} className="border-l-2 border-red-300 pl-2">
                      <span className="font-sans font-medium">{e.employeeName || e.employeeId}</span>
                      {' — '}{e.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <KPIGrid cols={4}>
        <KPICard label="Employees" value={batch.employeeCount} />
        <KPICard label="Total Gross" value={formatCurrency(batch.totalGross)} />
        <KPICard label="Total Deductions" value={formatCurrency(batch.totalDeductions)} />
        <KPICard label="Total Net Pay" value={formatCurrency(batch.totalNetPay)} />
      </KPIGrid>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {['Summary', 'Employees', 'Approval History'].map((tab, index) => (
              <button
                key={tab}
                onClick={() => setActiveTab(index)}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === index
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Summary Tab */}
          <TabPanel value={activeTab} index={0}>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Statutory Deductions */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Statutory Deductions</h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">PAYE</span>
                    <span className="font-medium">{formatCurrency(batch.totalPAYE)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">NSSF (Employee)</span>
                    <span className="font-medium">{formatCurrency(batch.totalNSSFEmployee)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">NSSF (Employer)</span>
                    <span className="font-medium">{formatCurrency(batch.totalNSSFEmployer)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">LST</span>
                    <span className="font-medium">{formatCurrency(batch.totalLST)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Status */}
              <div>
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setShowPaymentDetails(!showPaymentDetails)}
                >
                  <h3 className="font-semibold text-gray-900">Payment Status</h3>
                  {showPaymentDetails ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </div>
                
                {showPaymentDetails && (
                  <div className="mt-4 space-y-3">
                    {batch.paymentBatches.length === 0 ? (
                      <p className="text-gray-500 text-sm">No payment batches created yet.</p>
                    ) : (
                      batch.paymentBatches.map((pb) => (
                        <div 
                          key={pb.id} 
                          className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-gray-900">
                                {pb.paymentMethod.replace('_', ' ').toUpperCase()}
                                {pb.bankName && ` - ${pb.bankName}`}
                              </p>
                              <p className="text-sm text-gray-500">
                                {pb.employeeCount} employees
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-gray-900">
                                {formatCurrency(pb.totalAmount)}
                              </p>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                pb.status === 'completed' 
                                  ? 'bg-green-100 text-green-800'
                                  : pb.status === 'failed'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {pb.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </TabPanel>

          {/* Employees Tab */}
          <TabPanel value={activeTab} index={1}>
            <p className="text-gray-500">
              Employee list will be loaded here with payroll details for each employee.
            </p>
          </TabPanel>

          {/* Approval History Tab */}
          <TabPanel value={activeTab} index={2}>
            {batch.approvalRecords.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No approval history yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  Approval records will appear here once the batch is submitted for review.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {batch.approvalRecords.map((record) => (
                  <div 
                    key={record.id}
                    className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg"
                  >
                    <div className={`p-2 rounded-full ${
                      record.action === 'approved' 
                        ? 'bg-green-100' 
                        : record.action === 'rejected'
                        ? 'bg-red-100'
                        : 'bg-yellow-100'
                    }`}>
                      {record.action === 'approved' ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : record.action === 'rejected' ? (
                        <XCircle className="h-5 w-5 text-red-600" />
                      ) : (
                        <RotateCcw className="h-5 w-5 text-yellow-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {record.level.toUpperCase()} {record.action}
                      </p>
                      <p className="text-sm text-gray-500">
                        {record.approverName} ({record.approverRole})
                      </p>
                      <p className="text-sm text-gray-400">
                        {new Date(record.timestamp).toLocaleString()}
                      </p>
                      {record.comments && (
                        <p className="mt-2 text-sm text-gray-600 italic">
                          "{record.comments}"
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabPanel>
        </div>
      </div>

      {/* Approval Dialog */}
      <ApprovalDialog
        isOpen={approvalDialogOpen}
        action={approvalAction}
        onClose={() => setApprovalDialogOpen(false)}
        onConfirm={handleApprovalConfirm}
      />

      {/* Regenerate confirmation */}
      {confirmRegenOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-amber-100 flex-shrink-0">
                <RotateCcw className="h-5 w-5 text-amber-700" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Regenerate this payroll?</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Recalculation will pull the <em>latest</em> data from these sources.
                  If anything's missing, fix it first, then come back and confirm.
                </p>
              </div>
            </div>

            <div className="border border-gray-200 rounded-md divide-y divide-gray-100 text-sm">
              <a
                href={`/hr/payroll?period=${batch.year}-${String(batch.month).padStart(2, '0')}&tab=attendance`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-3 py-2 hover:bg-gray-50"
              >
                <div>
                  <div className="font-medium text-gray-900">Attendance</div>
                  <div className="text-xs text-gray-500">Absences and unpaid leave reduce gross pay this period.</div>
                </div>
                <span className="text-xs text-blue-600 font-medium">Edit →</span>
              </a>
              <a
                href="/hr/payroll?tab=advances"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-3 py-2 hover:bg-gray-50"
              >
                <div>
                  <div className="font-medium text-gray-900">Salary advances</div>
                  <div className="text-xs text-gray-500">Active advances auto-deduct their monthly installment.</div>
                </div>
                <span className="text-xs text-blue-600 font-medium">Manage →</span>
              </a>
              <a
                href="/hr/employees"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-3 py-2 hover:bg-gray-50"
              >
                <div>
                  <div className="font-medium text-gray-900">Allowances &amp; salary</div>
                  <div className="text-xs text-gray-500">Open an employee → Compensation to add/update allowances.</div>
                </div>
                <span className="text-xs text-blue-600 font-medium">Open →</span>
              </a>
              <a
                href={`/hr/payroll?period=${batch.year}-${String(batch.month).padStart(2, '0')}&tab=overtime`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-3 py-2 hover:bg-gray-50"
              >
                <div>
                  <div className="font-medium text-gray-900">Overtime</div>
                  <div className="text-xs text-gray-500">Only approved overtime entries are picked up.</div>
                </div>
                <span className="text-xs text-blue-600 font-medium">Review →</span>
              </a>
            </div>

            <div className="text-xs text-gray-500 space-y-1">
              <p>
                Status will reset to <span className="font-medium">Calculated</span>
                {batch.status !== 'calculated' && (
                  <> (currently <span className="font-medium">{batch.status.replace(/_/g, ' ')}</span> — any approvals so far must be re-issued)</>
                )}.
              </p>
              <p>
                Payslips update in place — no duplicates. Prior approval records stay as audit trail.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmRegenOpen(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmRegenOpen(false);
                  onRecalculate();
                }}
                className="px-4 py-2 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700"
              >
                Yes, regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reverse confirmation */}
      {confirmReverseOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-red-100 flex-shrink-0">
                <RotateCcw className="h-5 w-5 text-red-700" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Reverse this paid batch?</h3>
                <p className="text-sm text-gray-600 mt-1">
                  This unwinds the batch and restores every loan, advance and installment-deduction
                  balance it touched. After reversal you can regenerate the batch to produce
                  corrected payslips.
                </p>
              </div>
            </div>

            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
              <p className="font-medium mb-1">Statutory remittances are NOT reversed.</p>
              <p>
                PAYE / NSSF / LST already filed with URA and NSSF must be corrected through their
                amendment channels. This action only restores the internal balances and payslip
                state — not external filings.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700">
                Reason (required, kept in status history)
              </label>
              <textarea
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                className="mt-1 block w-full text-sm border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                rows={3}
                placeholder="e.g. Overtime entries for John D. were missing; need a corrected batch."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmReverseOpen(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                disabled={!reverseReason.trim() || !onReverse}
                onClick={() => {
                  const reason = reverseReason.trim();
                  if (!reason || !onReverse) return;
                  setConfirmReverseOpen(false);
                  onReverse(reason);
                }}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Yes, reverse
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollBatchDetail;
