/**
 * StockAdjustmentDetail
 * Read-only detail view with approval actions and audit trail.
 */

import { useCallback } from 'react';
import { ArrowLeft, Undo2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/core/components/ui/card';
import { AdjustmentStatusBadge } from './AdjustmentStatusBadge';
import { AdjustmentTypeBadge } from './AdjustmentTypeBadge';
import { AdjustmentApprovalActions } from './AdjustmentApprovalActions';
import { StockAdjustmentLineItems } from './StockAdjustmentLineItems';
import { QBOSyncStatusIndicator } from './QBOSyncStatusIndicator';
import {
  useApproveStockAdjustment,
  useRejectStockAdjustment,
  useCancelStockAdjustment,
} from '../../hooks/useStockAdjustments';
import type { StockAdjustment } from '../../types/stockAdjustment';

interface StockAdjustmentDetailProps {
  adjustment: StockAdjustment;
  userId: string;
}

export function StockAdjustmentDetail({
  adjustment,
  userId,
}: StockAdjustmentDetailProps) {
  const navigate = useNavigate();
  const approveMutation = useApproveStockAdjustment();
  const rejectMutation = useRejectStockAdjustment();
  const cancelMutation = useCancelStockAdjustment();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 })
      .format(amount);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '—';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-UG', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const handleApprove = useCallback(async () => {
    try {
      await approveMutation.mutateAsync({ id: adjustment.id, userId });
    } catch (err) {
      const msg = (err as Error).message || '';
      if (msg.includes('already approved') || msg.includes('Only submitted')) {
        // Adjustment was auto-approved by cloud function — just reload
        window.location.reload();
      } else {
        console.error('Approve failed:', err);
        alert(`Approval failed: ${msg}`);
      }
    }
  }, [adjustment.id, userId, approveMutation]);

  const handleReject = useCallback(async (reason: string) => {
    await rejectMutation.mutateAsync({ id: adjustment.id, userId, reason });
  }, [adjustment.id, userId, rejectMutation]);

  const handleCancel = useCallback(async () => {
    if (window.confirm('Are you sure you want to cancel this adjustment?')) {
      await cancelMutation.mutateAsync({ id: adjustment.id, userId });
    }
  }, [adjustment.id, userId, cancelMutation]);

  const handleReverse = useCallback(() => {
    const reversedLines = adjustment.lineItems.map(line => ({
      ...line,
      direction: line.direction === 'increase' ? 'decrease' as const : 'increase' as const,
    }));
    navigate('/inventory/adjustments/new', {
      state: {
        defaultValues: {
          adjustmentType: adjustment.adjustmentType,
          lineItems: reversedLines,
          reason: `Reversal of ${adjustment.adjustmentNumber}`,
          referenceType: 'other' as const,
          referenceId: adjustment.id,
          referenceNumber: adjustment.adjustmentNumber,
        },
      },
    });
  }, [adjustment, navigate]);

  const auditEntries: Array<{ label: string; date: any; actor: string; style: string }> = [
    { label: 'Created', date: adjustment.createdAt, actor: adjustment.createdBy, style: 'bg-gray-100 text-gray-700 border-gray-200' },
  ];
  if (adjustment.submittedAt) {
    auditEntries.push({ label: 'Submitted', date: adjustment.submittedAt, actor: adjustment.submittedBy || '', style: 'bg-yellow-50 text-yellow-700 border-yellow-200' });
  }
  if (adjustment.approvedAt) {
    auditEntries.push({
      label: adjustment.isAutoApproved ? 'Auto-Approved' : 'Approved',
      date: adjustment.approvedAt,
      actor: adjustment.approvedBy || '',
      style: 'bg-green-50 text-green-700 border-green-200',
    });
  }
  if (adjustment.rejectedAt) {
    auditEntries.push({ label: 'Rejected', date: adjustment.rejectedAt, actor: adjustment.rejectedBy || '', style: 'bg-red-50 text-red-700 border-red-200' });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/inventory/adjustments')} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <h1 className="text-2xl font-bold tracking-tight flex-1">
          {adjustment.adjustmentNumber || 'Stock Adjustment'}
        </h1>
        <AdjustmentStatusBadge status={adjustment.status} />
      </div>

      {/* Rejection alert */}
      {adjustment.status === 'rejected' && adjustment.rejectionReason && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>Rejected:</strong> {adjustment.rejectionReason}
        </div>
      )}

      {/* Approval Actions */}
      {adjustment.status === 'submitted' && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardContent className="px-4 py-3">
            <p className="text-sm font-semibold mb-2">Awaiting Approval</p>
            <AdjustmentApprovalActions
              onApprove={handleApprove}
              onReject={handleReject}
              approving={approveMutation.isPending}
              rejecting={rejectMutation.isPending}
            />
          </CardContent>
        </Card>
      )}

      {/* Details Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Type</p>
              <div className="mt-0.5"><AdjustmentTypeBadge type={adjustment.adjustmentType} /></div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="text-sm">{formatDate(adjustment.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created By</p>
              <p className="text-sm">{adjustment.createdBy}</p>
            </div>
            {adjustment.submittedAt && (
              <div>
                <p className="text-xs text-muted-foreground">Submitted</p>
                <p className="text-sm">{formatDate(adjustment.submittedAt)}</p>
              </div>
            )}
            {adjustment.approvedAt && (
              <div>
                <p className="text-xs text-muted-foreground">Approved</p>
                <p className="text-sm">{formatDate(adjustment.approvedAt)}</p>
              </div>
            )}
            {adjustment.referenceNumber && (
              <div>
                <p className="text-xs text-muted-foreground">Reference</p>
                <p className="text-sm">{adjustment.referenceNumber}</p>
              </div>
            )}
            {adjustment.isAutoApproved && (
              <div className="flex items-end">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Auto-Approved</Badge>
              </div>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Reason</p>
            <p className="text-sm">{adjustment.reason}</p>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line Items ({adjustment.lineCount})</CardTitle>
        </CardHeader>
        <CardContent>
          <StockAdjustmentLineItems
            lineItems={adjustment.lineItems}
            onChange={() => {}}
            adjustmentType={adjustment.adjustmentType}
            readOnly
          />
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Value Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-8">
            <div>
              <p className="text-xs text-muted-foreground">Total Increase</p>
              <p className="text-lg font-semibold text-green-600">+{formatCurrency(adjustment.totalIncreaseValue)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Decrease</p>
              <p className="text-lg font-semibold text-red-600">-{formatCurrency(adjustment.totalDecreaseValue)}</p>
            </div>
            <div className="border-l pl-8">
              <p className="text-xs text-muted-foreground">Net Impact</p>
              <p className={`text-lg font-bold ${adjustment.netValueImpact >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {adjustment.netValueImpact >= 0 ? '+' : ''}{formatCurrency(adjustment.netValueImpact)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* QBO Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            QuickBooks Sync
            <QBOSyncStatusIndicator
              status={adjustment.qboSyncStatus}
              error={adjustment.qboSyncError}
              journalEntryId={adjustment.qboJournalEntryId}
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {adjustment.qboJournalEntryId && (
            <p className="text-sm text-muted-foreground">Journal Entry ID: {adjustment.qboJournalEntryId}</p>
          )}
          {adjustment.qboSyncError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 mt-1">
              {adjustment.qboSyncError}
            </div>
          )}
          {!adjustment.qboJournalEntryId && !adjustment.qboSyncError && (
            <p className="text-sm text-muted-foreground">No QBO journal entry yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Audit Trail */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit Trail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {auditEntries.map((entry, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <Badge variant="outline" className={`min-w-[100px] justify-center ${entry.style}`}>
                {entry.label}
              </Badge>
              <span className="text-sm">{formatDate(entry.date)}</span>
              <span className="text-sm text-muted-foreground">{entry.actor}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Actions Footer */}
      <div className="flex justify-end gap-2 pb-8">
        {adjustment.status === 'approved' && (
          <Button variant="outline" onClick={handleReverse} className="gap-1.5">
            <Undo2 className="h-4 w-4" />
            Reverse Adjustment
          </Button>
        )}
        {(adjustment.status === 'draft' || adjustment.status === 'submitted') && (
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={cancelMutation.isPending}
            className="border-red-300 text-red-700 hover:bg-red-50"
          >
            Cancel Adjustment
          </Button>
        )}
      </div>
    </div>
  );
}
