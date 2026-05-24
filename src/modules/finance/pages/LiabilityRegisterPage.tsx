// ============================================================================
// LIABILITY REGISTER PAGE
// Upcoming liabilities timeline, statutory calendar, payment tracker
// ============================================================================

import { useState } from 'react';
import { Card } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Skeleton } from '@/core/components/ui/skeleton';
import { KPIGrid, KPICard } from '@/shared/components/data-display';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/core/components/ui/table';
import {
  Scale,
  RefreshCw,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import { useLiabilities } from '../hooks/useLiabilities';
import { LIABILITY_TYPE_LABELS } from '../constants/optimizer.constants';
import { useAuth } from '@/shared/hooks/useAuth';

function formatUGX(value: number): string {
  return `UGX ${Math.abs(value).toLocaleString('en-UG')}`;
}

function formatDate(ts: unknown): string {
  if (!ts) return '—';
  if (ts instanceof Date) return ts.toLocaleDateString('en-UG', { month: 'short', day: 'numeric', year: 'numeric' });
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts) {
    return (ts as { toDate: () => Date }).toDate().toLocaleDateString('en-UG', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return String(ts);
}

export function LiabilityRegisterPage() {
  useAuth();
  const companyId = 'dawinos'; // From company context

  const {
    liabilities,
    upcoming,
    overdue,
    statutoryDeadlines,
    totalOutstanding,
    isLoading,
    error,
    refresh,
    markPaid,
  } = useLiabilities({ companyId });

  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payReference, setPayReference] = useState('');

  const handlePay = async () => {
    if (!payingId || !payAmount) return;
    await markPaid(payingId, parseFloat(payAmount), payReference);
    setPayingId(null);
    setPayAmount('');
    setPayReference('');
  };

  if (isLoading && !liabilities.length) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Scale className="w-5 h-5 text-pink-600" />
          <h2 className="text-xl font-bold text-foreground">Liability Register</h2>
        </div>
        <Button variant="outline" size="sm" onClick={() => refresh()} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <KPIGrid cols={3}>
        <KPICard
          label="Total Outstanding"
          value={formatUGX(totalOutstanding)}
          delta={`${liabilities.length} active liabilities`}
        />
        <KPICard
          label="Overdue"
          value={overdue.length}
          trend={overdue.length > 0 ? 'down' : 'flat'}
          delta={formatUGX(overdue.reduce((s, l) => s + (l.amountRemaining || 0), 0))}
        />
        <KPICard
          label="Due in 30 Days"
          value={upcoming.length}
          trend={upcoming.length > 0 ? 'down' : 'flat'}
          delta={formatUGX(upcoming.reduce((s, l) => s + (l.amountRemaining || 0), 0))}
        />
      </KPIGrid>

      {/* Overdue Alert */}
      {overdue.length > 0 && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">
              {overdue.length} overdue liabilit{overdue.length > 1 ? 'ies' : 'y'}
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              {overdue.map(l => l.description).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Statutory Calendar */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[var(--fg-tertiary)]" />
          Uganda Statutory Deadlines
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {statutoryDeadlines.map(deadline => (
            <div
              key={deadline.type}
              className={`p-3 rounded-lg border ${
                deadline.daysUntilDue <= 3 ? 'border-red-200 bg-red-50'
                  : deadline.daysUntilDue <= 7 ? 'border-amber-200 bg-amber-50'
                    : 'border-[var(--border-subtle)]'
              }`}
            >
              <p className="text-sm font-semibold text-foreground">{deadline.description}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Due: {deadline.nextDueDate.toLocaleDateString('en-UG', { month: 'short', day: 'numeric' })}
              </p>
              <div className="flex items-center gap-1 mt-1">
                {deadline.daysUntilDue <= 0 ? (
                  <span className="text-xs font-medium text-red-600">Overdue!</span>
                ) : (
                  <span className={`text-xs font-medium ${
                    deadline.daysUntilDue <= 3 ? 'text-red-600'
                      : deadline.daysUntilDue <= 7 ? 'text-amber-600'
                        : 'text-green-600'
                  }`}>
                    {deadline.daysUntilDue} day{deadline.daysUntilDue !== 1 ? 's' : ''} left
                  </span>
                )}
              </div>
              <p className="text-[10px] text-[var(--fg-tertiary)] mt-1">
                Late penalty: {deadline.penaltyRatePercent}%/month
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Liabilities Table */}
      <Card>
        <div className="px-4 pt-4 pb-2">
          <h3 className="text-sm font-semibold text-foreground">Active Liabilities</h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {liabilities.map(liability => {
                const dueDate = liability.nextDueDate instanceof Date
                  ? liability.nextDueDate
                  : liability.nextDueDate && typeof liability.nextDueDate === 'object' && 'toDate' in liability.nextDueDate
                    ? (liability.nextDueDate as { toDate: () => Date }).toDate()
                    : null;
                const isOverdue = dueDate ? dueDate < new Date() : false;

                return (
                  <TableRow key={liability.id} className={isOverdue ? 'bg-red-50/30' : ''}>
                    <TableCell>
                      <span className="text-xs bg-[var(--bg-sunken)] text-muted-foreground px-1.5 py-0.5 rounded">
                        {LIABILITY_TYPE_LABELS[liability.type] || liability.type}
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-foreground truncate max-w-[200px]">{liability.description}</p>
                      {liability.vendorName && (
                        <p className="text-xs text-[var(--fg-tertiary)]">{liability.vendorName}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">{formatUGX(liability.totalAmount)}</TableCell>
                    <TableCell className="text-right text-sm text-green-600">{formatUGX(liability.amountPaid || 0)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatUGX(liability.amountRemaining || 0)}</TableCell>
                    <TableCell>
                      <span className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                        {formatDate(liability.nextDueDate)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                        liability.priority === 'statutory' ? 'bg-red-50 text-red-700'
                          : liability.priority === 'contractual' ? 'bg-orange-50 text-orange-700'
                            : 'bg-[var(--bg-sunken)] text-muted-foreground'
                      }`}>
                        {liability.priority || 'operational'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 px-2 text-green-600 hover:text-green-700"
                        onClick={() => {
                          setPayingId(liability.id);
                          setPayAmount(String(liability.amountRemaining || ''));
                        }}
                      >
                        Pay
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {liabilities.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-[var(--fg-tertiary)]">
                    No active liabilities
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Pay Dialog */}
      {payingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="p-5 w-full max-w-md">
            <h4 className="text-sm font-semibold text-foreground mb-3">Record Payment</h4>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Amount (UGX)</label>
                <Input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Reference</label>
                <Input
                  placeholder="Payment reference..."
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setPayingId(null); setPayAmount(''); setPayReference(''); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={handlePay} disabled={!payAmount}>
                Record Payment
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default LiabilityRegisterPage;
