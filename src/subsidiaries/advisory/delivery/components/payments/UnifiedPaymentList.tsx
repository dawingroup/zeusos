/**
 * UnifiedPaymentList - Filterable/sortable list of payments
 *
 * Renders the appropriate card type (IPCCard, RequisitionCard, AccountabilityCard)
 * based on payment type. Includes summary stats, filter bar, and sort controls.
 */

import { useState, useMemo } from 'react';
import { FileText, Receipt, Wallet, Search, Filter, SlidersHorizontal } from 'lucide-react';
import type { Payment, PaymentType, PaymentStatus, PaymentSummary } from '../../types/payment';
import type { IPC } from '../../types/ipc';
import type { Requisition } from '../../types/requisition';
import type { Accountability } from '../../types/accountability';
import { IPCCard } from './IPCCard';
import { RequisitionCard } from './RequisitionCard';
import { AccountabilityCard } from './AccountabilityCard';
import { PaymentCardSkeleton } from './PaymentCardSkeleton';

// ─────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────

interface UnifiedPaymentListProps {
  payments: Payment[];
  ipcs: IPC[];
  requisitions: Requisition[];
  accountabilities: Accountability[];
  summary: PaymentSummary;
  isContractorProject: boolean;
  currency?: string;
  onPaymentClick?: (paymentId: string) => void;
  loading?: boolean;
}

// ─────────────────────────────────────────────────────────────────
// FILTER TYPES
// ─────────────────────────────────────────────────────────────────

type TypeFilter = 'all' | PaymentType;
type SortDirection = 'newest' | 'oldest';

const STATUS_OPTIONS: { value: PaymentStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'processing', label: 'Processing' },
  { value: 'paid', label: 'Paid' },
  { value: 'rejected', label: 'Rejected' },
];

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'UGX',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getPaymentDate(payment: Payment): number {
  if (payment.paidAt) return payment.paidAt.toMillis();
  if (payment.submittedAt) return payment.submittedAt.toMillis();
  return payment.createdAt.toMillis();
}

// ─────────────────────────────────────────────────────────────────
// TYPE FILTER BUTTON CONFIG
// ─────────────────────────────────────────────────────────────────

interface TypeFilterButton {
  key: TypeFilter;
  label: string;
  icon: typeof FileText;
}

const TYPE_FILTER_BUTTONS: TypeFilterButton[] = [
  { key: 'all', label: 'All', icon: Filter },
  { key: 'ipc', label: 'IPCs', icon: FileText },
  { key: 'requisition', label: 'Requisitions', icon: Receipt },
  { key: 'accountability', label: 'Accountabilities', icon: Wallet },
];

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────

export function UnifiedPaymentList({
  payments,
  ipcs,
  requisitions,
  accountabilities,
  summary,
  isContractorProject: _isContractorProject,
  currency = 'UGX',
  onPaymentClick,
  loading = false,
}: UnifiedPaymentListProps) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortDirection, setSortDirection] = useState<SortDirection>('newest');

  // ── Type counts for filter badges ──────────────────────────────

  const typeCounts = useMemo(() => {
    const counts: Record<TypeFilter, number> = {
      all: payments.length,
      ipc: payments.filter(p => p.paymentType === 'ipc').length,
      requisition: payments.filter(p => p.paymentType === 'requisition').length,
      accountability: payments.filter(p => p.paymentType === 'accountability').length,
    };
    return counts;
  }, [payments]);

  // ── Filtered & sorted payments ─────────────────────────────────

  const filteredPayments = useMemo(() => {
    let result = [...payments];

    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter(p => p.paymentType === typeFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(p => p.status === statusFilter);
    }

    // Search by payment number
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(p =>
        p.paymentNumber.toLowerCase().includes(query)
      );
    }

    // Sort by date
    result.sort((a, b) => {
      const dateA = getPaymentDate(a);
      const dateB = getPaymentDate(b);
      return sortDirection === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [payments, typeFilter, statusFilter, searchQuery, sortDirection]);

  // ── Lookup maps for card rendering ─────────────────────────────

  const ipcMap = useMemo(
    () => new Map(ipcs.map(ipc => [ipc.id, ipc])),
    [ipcs]
  );

  const requisitionMap = useMemo(
    () => new Map(requisitions.map(req => [req.id, req])),
    [requisitions]
  );

  const accountabilityMap = useMemo(
    () => new Map(accountabilities.map(acc => [acc.id, acc])),
    [accountabilities]
  );

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Summary Stats Row ─────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Paid */}
        <div className="bg-white rounded-lg border border-green-200 p-4">
          <div className="text-sm font-medium text-green-700">Total Paid</div>
          <div className="mt-1 text-xl font-semibold text-green-900">
            {formatAmount(summary.totalPaid, currency)}
          </div>
        </div>

        {/* Pending */}
        <div className="bg-white rounded-lg border border-amber-200 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-amber-700">Pending</div>
            {summary.pendingCount > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                {summary.pendingCount}
              </span>
            )}
          </div>
          <div className="mt-1 text-xl font-semibold text-amber-900">
            {formatAmount(summary.totalPending, currency)}
          </div>
        </div>

        {/* Retention Held */}
        <div className="bg-white rounded-lg border border-blue-200 p-4">
          <div className="text-sm font-medium text-blue-700">Retention Held</div>
          <div className="mt-1 text-xl font-semibold text-blue-900">
            {formatAmount(summary.retentionHeld, currency)}
          </div>
        </div>

        {/* Advance Outstanding */}
        <div className="bg-white rounded-lg border border-purple-200 p-4">
          <div className="text-sm font-medium text-purple-700">Advance Outstanding</div>
          <div className="mt-1 text-xl font-semibold text-purple-900">
            {formatAmount(summary.advanceOutstanding, currency)}
          </div>
        </div>
      </div>

      {/* ── Filter Bar ────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        {/* Type filter buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {TYPE_FILTER_BUTTONS.map(btn => {
            const Icon = btn.icon;
            const isActive = typeFilter === btn.key;
            const count = typeCounts[btn.key];

            return (
              <button
                key={btn.key}
                onClick={() => setTypeFilter(btn.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {btn.label}
                <span
                  className={`ml-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs rounded-full ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Status dropdown + Search + Sort */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status dropdown */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as PaymentStatus | 'all')}
              className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <SlidersHorizontal className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Search input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by payment number..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Sort toggle */}
          <button
            onClick={() =>
              setSortDirection(prev => (prev === 'newest' ? 'oldest' : 'newest'))
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4 text-gray-500" />
            {sortDirection === 'newest' ? 'Newest First' : 'Oldest First'}
          </button>
        </div>
      </div>

      {/* ── Payment Cards ─────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-4">
          <PaymentCardSkeleton />
          <PaymentCardSkeleton />
          <PaymentCardSkeleton />
        </div>
      ) : filteredPayments.length === 0 ? (
        /* Empty state */
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No payments found</h3>
          <p className="text-sm text-gray-500">
            {searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
              ? 'Try adjusting your filters or search query.'
              : 'No payments have been created for this project yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPayments.map(payment => {
            switch (payment.paymentType) {
              case 'ipc': {
                const ipc = ipcMap.get(payment.id);
                if (!ipc) return null;
                return (
                  <IPCCard
                    key={payment.id}
                    ipc={ipc}
                    currency={currency}
                    onClick={
                      onPaymentClick
                        ? () => onPaymentClick(payment.id)
                        : undefined
                    }
                  />
                );
              }

              case 'requisition': {
                const requisition = requisitionMap.get(payment.id);
                if (!requisition) return null;
                return (
                  <RequisitionCard
                    key={payment.id}
                    requisition={requisition}
                    currency={currency}
                    onClick={
                      onPaymentClick
                        ? () => onPaymentClick(payment.id)
                        : undefined
                    }
                  />
                );
              }

              case 'accountability': {
                const accountability = accountabilityMap.get(payment.id);
                if (!accountability) return null;
                return (
                  <AccountabilityCard
                    key={payment.id}
                    accountability={accountability}
                    currency={currency}
                    onClick={
                      onPaymentClick
                        ? () => onPaymentClick(payment.id)
                        : undefined
                    }
                  />
                );
              }

              default:
                return null;
            }
          })}
        </div>
      )}
    </div>
  );
}
