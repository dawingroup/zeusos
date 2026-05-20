// ============================================================================
// SAVINGS TRACKER PAGE
// Balance card, rate config, allocation history, withdrawal requests
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
  PiggyBank,
  RefreshCw,
  ArrowUp,
  AlertTriangle,
} from 'lucide-react';
import { useSavings } from '../hooks/useSavings';
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

export function SavingsTrackerPage() {
  useAuth();
  const companyId = 'dawinos'; // From company context

  const {
    position,
    history,
    isLoading,
    error,
    refresh,
    requestWithdrawal,
    approveWithdrawal,
  } = useSavings({ companyId });

  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawReason, setWithdrawReason] = useState('');

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || !withdrawReason.trim()) return;
    await requestWithdrawal(amount, withdrawReason.trim());
    setShowWithdraw(false);
    setWithdrawAmount('');
    setWithdrawReason('');
  };

  if (isLoading && !position) {
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
          <PiggyBank className="w-5 h-5 text-cyan-600" />
          <h2 className="text-xl font-bold text-gray-900">Savings Tracker</h2>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowWithdraw(true)}
          >
            <ArrowUp className="w-4 h-4 mr-1.5" />
            Withdraw
          </Button>
          <Button variant="outline" size="sm" onClick={() => refresh()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Balance Cards */}
      <KPIGrid cols={3}>
        <KPICard
          label="Current Balance"
          value={formatUGX(position?.totalBalance || 0)}
        />
        <KPICard
          label="Total Allocated"
          value={formatUGX(position?.totalAllocated || 0)}
          trend="up"
          delta="all-time deposits"
        />
        <KPICard
          label="Total Withdrawn"
          value={formatUGX(position?.totalWithdrawn || 0)}
          delta="all-time withdrawals"
        />
      </KPIGrid>

      {/* History Table */}
      <Card>
        <div className="px-4 pt-4 pb-2">
          <h3 className="text-sm font-semibold text-gray-900">Savings History</h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell className="text-sm">{formatDate(entry.date)}</TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      entry.type === 'allocation' ? 'bg-green-50 text-green-700'
                        : entry.type === 'withdrawal' ? 'bg-red-50 text-red-700'
                          : 'bg-gray-50 text-gray-600'
                    }`}>
                      {entry.type}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600 max-w-[250px] truncate">
                    {entry.note}
                  </TableCell>
                  <TableCell className={`text-right text-sm font-medium ${
                    entry.amount >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {entry.amount >= 0 ? '+' : ''}{formatUGX(entry.amount)}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {formatUGX(entry.runningBalance)}
                  </TableCell>
                  <TableCell>
                    {entry.status === 'pending_approval' ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-amber-600">Pending</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-6 px-2 text-green-600"
                          onClick={() => approveWithdrawal(entry.id)}
                        >
                          Approve
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">{entry.status || 'completed'}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {history.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-400">
                    No savings history yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Withdrawal Dialog */}
      {showWithdraw && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="p-5 w-full max-w-md">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Request Withdrawal</h4>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Amount (UGX)</label>
                <Input
                  type="number"
                  placeholder="e.g. 5,000,000"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Reason</label>
                <Input
                  placeholder="Reason for withdrawal..."
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                />
              </div>
              <p className="text-xs text-gray-400">
                Available: {formatUGX(position?.totalBalance || 0)}
              </p>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowWithdraw(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleWithdraw}
                disabled={!withdrawAmount || !withdrawReason.trim()}
              >
                Submit Request
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default SavingsTrackerPage;
