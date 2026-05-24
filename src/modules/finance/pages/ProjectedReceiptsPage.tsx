// ============================================================================
// PROJECTED RECEIPTS PAGE
// Predicted income view — counterpart to the Expenditure Queue
// ============================================================================

import { useState } from 'react';
import { Card } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Skeleton } from '@/core/components/ui/skeleton';
import { Label } from '@/core/components/ui/label';
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/core/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/core/components/ui/dialog';
import {
  Landmark,
  Search,
  ArrowUpDown,
  RefreshCw,
  X,
  AlertTriangle,
  Filter,
  CheckCircle2,
  Clock,
  CircleDot,
  FileCheck,
  Ban,
  DollarSign,
} from 'lucide-react';
import { useProjectedReceipts } from '../hooks/useProjectedReceipts';
import type { ReceiptSortField } from '../hooks/useProjectedReceipts';
import { formatUGX } from '../components/optimizer/ExpenditureScoreCard';
import { optimizerService } from '../services/optimizerService';
import type { ProjectedReceipt, ConfidenceLevel } from '../types/optimizer.types';

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

function formatDate(ts: unknown): string {
  if (!ts) return '—';
  if (ts instanceof Date) return ts.toLocaleDateString('en-UG', { month: 'short', day: 'numeric', year: 'numeric' });
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts) {
    return (ts as { toDate: () => Date }).toDate().toLocaleDateString('en-UG', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return String(ts);
}

function getDaysUntilDue(receipt: ProjectedReceipt): number | null {
  if (!receipt.expectedDate) return null;
  const expected = receipt.expectedDate instanceof Date
    ? receipt.expectedDate
    : (receipt.expectedDate as unknown as { toDate: () => Date }).toDate();
  const diffMs = expected.getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

// ────────────────────────────────────────────────────────────────────────────
// INLINE BADGE COMPONENTS
// ────────────────────────────────────────────────────────────────────────────

const CONFIDENCE_STYLES: Record<ConfidenceLevel, { label: string; bg: string; text: string }> = {
  confirmed: { label: 'Confirmed', bg: 'bg-green-50', text: 'text-green-700' },
  probable: { label: 'Probable', bg: 'bg-amber-50', text: 'text-amber-700' },
  possible: { label: 'Possible', bg: 'bg-blue-50', text: 'text-blue-600' },
};

function ConfidenceBadge({ level, score }: { level: ConfidenceLevel; score?: number }) {
  const style = CONFIDENCE_STYLES[level] || CONFIDENCE_STYLES.possible;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
      {score !== undefined && <span className="opacity-60">({score})</span>}
    </span>
  );
}

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  projected: { label: 'Projected', bg: 'bg-[var(--bg-sunken)]', text: 'text-muted-foreground' },
  invoiced: { label: 'Invoiced', bg: 'bg-blue-50', text: 'text-blue-700' },
  overdue: { label: 'Overdue', bg: 'bg-red-50', text: 'text-red-700' },
  received: { label: 'Received', bg: 'bg-green-50', text: 'text-green-700' },
  cancelled: { label: 'Cancelled', bg: 'bg-[var(--bg-sunken)]', text: 'text-[var(--fg-tertiary)]' },
};

function ReceiptStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.projected;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  project_milestone: 'Project Milestone',
  project_final: 'Project / Deal',
  shopify_order: 'Shopify Order',
  qbo_invoice: 'QBO Invoice',
};

// ────────────────────────────────────────────────────────────────────────────
// TABLE ROW
// ────────────────────────────────────────────────────────────────────────────

function ReceiptRow({
  item,
  onSelect,
}: {
  item: ProjectedReceipt;
  onSelect: (id: string) => void;
}) {
  const days = getDaysUntilDue(item);

  return (
    <TableRow
      className="cursor-pointer hover:bg-[var(--bg-sunken)]"
      onClick={() => onSelect(item.id)}
    >
      <TableCell>
        <div>
          <p className="text-sm font-medium text-foreground truncate max-w-[220px]">
            {item.sourceName || 'Untitled Project'}
          </p>
          <p className="text-xs text-muted-foreground truncate max-w-[220px]">
            {item.customerName || 'No client assigned'}
          </p>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-xs text-muted-foreground">
          {SOURCE_TYPE_LABELS[item.sourceType] || item.sourceType}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <span className="text-sm font-medium">{formatUGX(item.amount)}</span>
      </TableCell>
      <TableCell>
        <span className="text-xs text-muted-foreground">{formatDate(item.expectedDate)}</span>
      </TableCell>
      <TableCell>
        <ConfidenceBadge level={item.confidenceLevel} score={item.confidenceScore} />
      </TableCell>
      <TableCell>
        <ReceiptStatusBadge status={item.status} />
      </TableCell>
      <TableCell>
        {days !== null && (
          <span className={`text-xs font-medium ${
            days < 0 ? 'text-red-600' : days <= 7 ? 'text-amber-600' : 'text-muted-foreground'
          }`}>
            {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`}
          </span>
        )}
      </TableCell>
    </TableRow>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ────────────────────────────────────────────────────────────────────────────

export default function ProjectedReceiptsPage() {
  const companyId = 'dawinos'; // From company context

  const {
    filteredItems,
    selectedItem,
    totalCount,
    filteredCount,
    summary,
    filters,
    updateFilter,
    clearFilters,
    sortField,
    setSortField,
    toggleSortDirection,
    selectItem,
    isLoading,
    refresh,
  } = useProjectedReceipts({ companyId });

  const [showFilters, setShowFilters] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ProjectedReceipt | null>(null);
  const [confirmAmount, setConfirmAmount] = useState('');
  const [confirmDate, setConfirmDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openConfirmDialog = (receipt: ProjectedReceipt) => {
    setConfirmAmount(String(receipt.amount));
    setConfirmDate(new Date().toISOString().split('T')[0]);
    setConfirmDialog(receipt);
  };

  const handleConfirmReceipt = async () => {
    if (!confirmDialog) return;
    setIsSubmitting(true);
    try {
      await optimizerService.confirmReceipt(
        companyId,
        confirmDialog.id,
        Number(confirmAmount) || confirmDialog.amount,
        confirmDate ? new Date(confirmDate) : new Date(),
      );
      setConfirmDialog(null);
      selectItem(null);
      refresh();
    } catch (err) {
      console.error('Failed to confirm receipt:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkInvoiced = async (receipt: ProjectedReceipt) => {
    try {
      await optimizerService.markReceiptInvoiced(companyId, receipt.id);
      selectItem(null);
      refresh();
    } catch (err) {
      console.error('Failed to mark invoiced:', err);
    }
  };

  const handleCancelReceipt = async (receipt: ProjectedReceipt) => {
    try {
      await optimizerService.cancelReceipt(companyId, receipt.id);
      selectItem(null);
      refresh();
    } catch (err) {
      console.error('Failed to cancel receipt:', err);
    }
  };

  const SORT_OPTIONS: { field: ReceiptSortField; label: string }[] = [
    { field: 'expectedDate', label: 'Date' },
    { field: 'amount', label: 'Amount' },
    { field: 'confidenceScore', label: 'Confidence' },
    { field: 'sourceType', label: 'Source' },
  ];

  const hasActiveFilters = Boolean(
    filters.confidenceLevel || filters.status || filters.sourceType ||
    filters.searchTerm || filters.minAmount || filters.maxAmount
  );

  const filteredTotal = filteredItems.reduce((s, i) => s + i.amount, 0);

  // ── Loading State ──
  if (isLoading && totalCount === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Landmark className="h-5 w-5 text-green-600" />
          <div>
            <h2 className="text-lg font-semibold">Projected Receipts</h2>
            <p className="text-xs text-[var(--fg-tertiary)]">
              {filteredCount} of {totalCount} items
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showFilters ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-1" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 bg-blue-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
                !
              </span>
            )}
          </Button>

          {/* Sort Toggle */}
          <div className="flex items-center gap-1">
            {SORT_OPTIONS.map(opt => (
              <Button
                key={opt.field}
                variant={sortField === opt.field ? 'secondary' : 'ghost'}
                size="sm"
                className="text-xs h-7 px-2"
                onClick={() => {
                  if (sortField === opt.field) toggleSortDirection();
                  else setSortField(opt.field);
                }}
              >
                {opt.label}
                {sortField === opt.field && <ArrowUpDown className="h-3 w-3 ml-0.5" />}
              </Button>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <KPIGrid cols={4}>
        <KPICard
          label={
            <span className="inline-flex items-center gap-1.5">
              <Landmark className="h-3 w-3" /> Total Projected
            </span>
          }
          value={formatUGX(summary.totalProjected)}
          delta={`${totalCount} expected payments`}
        />
        <KPICard
          label={
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3 text-green-500" /> Confirmed
            </span>
          }
          value={formatUGX(summary.confirmedAmount)}
          trend="up"
          delta={`${summary.confidenceCounts.confirmed} items`}
        />
        <KPICard
          label={
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-amber-500" /> Probable
            </span>
          }
          value={formatUGX(summary.probableAmount)}
          delta={`${summary.confidenceCounts.probable} items`}
        />
        <KPICard
          label={
            <span className="inline-flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 text-red-500" /> Overdue
            </span>
          }
          value={summary.overdueCount}
          trend={summary.overdueCount > 0 ? 'down' : 'flat'}
          delta="Payments past expected date"
        />
      </KPIGrid>

      {/* ── Confidence Level Pills ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['confirmed', 'probable', 'possible'] as ConfidenceLevel[]).map(level => {
          const isActive = filters.confidenceLevel === level;
          const style = CONFIDENCE_STYLES[level];
          const count = summary.confidenceCounts[level] || 0;
          return (
            <button
              key={level}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? `${style.bg} ${style.text} ring-2 ring-offset-1 ring-current`
                  : 'bg-[var(--bg-sunken)] text-muted-foreground hover:bg-[var(--bg-sunken)]'
              }`}
              onClick={() => updateFilter('confidenceLevel', isActive ? undefined : level)}
            >
              <CircleDot className="h-3 w-3" />
              {style.label} ({count})
            </button>
          );
        })}
        {hasActiveFilters && (
          <button
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-muted-foreground hover:bg-[var(--bg-sunken)]"
            onClick={clearFilters}
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      {/* ── Filter Panel ── */}
      {showFilters && (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--fg-tertiary)]" />
              <Input
                placeholder="Search customer or source..."
                value={filters.searchTerm || ''}
                onChange={(e) => updateFilter('searchTerm', e.target.value || undefined)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            {/* Status */}
            <select
              className="h-9 rounded-md border border-[var(--border-subtle)] bg-card px-3 text-sm"
              value={filters.status || ''}
              onChange={(e) => updateFilter('status', (e.target.value || undefined) as ProjectedReceipt['status'] | undefined)}
            >
              <option value="">All Statuses</option>
              <option value="projected">Projected</option>
              <option value="invoiced">Invoiced</option>
              <option value="overdue">Overdue</option>
              <option value="received">Received</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {/* Source Type */}
            <select
              className="h-9 rounded-md border border-[var(--border-subtle)] bg-card px-3 text-sm"
              value={filters.sourceType || ''}
              onChange={(e) => updateFilter('sourceType', (e.target.value || undefined) as ProjectedReceipt['sourceType'] | undefined)}
            >
              <option value="">All Sources</option>
              <option value="project_milestone">Project Milestone</option>
              <option value="project_final">Project / Deal</option>
              <option value="shopify_order">Shopify Order</option>
              <option value="qbo_invoice">QBO Invoice</option>
            </select>

            {/* Amount Range */}
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Min"
                value={filters.minAmount ?? ''}
                onChange={(e) => updateFilter('minAmount', e.target.value ? Number(e.target.value) : undefined)}
                className="h-9 text-sm"
              />
              <Input
                type="number"
                placeholder="Max"
                value={filters.maxAmount ?? ''}
                onChange={(e) => updateFilter('maxAmount', e.target.value ? Number(e.target.value) : undefined)}
                className="h-9 text-sm"
              />
            </div>
          </div>
        </Card>
      )}

      {/* ── Table ── */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[220px]">Project / Client</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Expected</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24">Days</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.map(item => (
              <ReceiptRow key={item.id} item={item} onSelect={selectItem} />
            ))}
            {filteredItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-[var(--fg-tertiary)]">
                  {hasActiveFilters
                    ? 'No receipts match your filters'
                    : 'No projected receipts found'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Footer */}
        {filteredItems.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-muted-foreground">
            <span>{filteredCount} items</span>
            <span className="font-medium text-muted-foreground">Total: {formatUGX(filteredTotal)}</span>
          </div>
        )}
      </Card>

      {/* ── Detail Drawer ── */}
      <Sheet open={!!selectedItem} onOpenChange={() => selectItem(null)}>
        <SheetContent className="w-[400px] sm:w-[480px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Receipt Detail</SheetTitle>
          </SheetHeader>

          {selectedItem && (
            <div className="mt-6 space-y-6">
              {/* Receipt Info */}
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-[var(--fg-tertiary)] uppercase tracking-wide">Customer</p>
                  <p className="text-sm font-medium">{selectedItem.customerName || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--fg-tertiary)] uppercase tracking-wide">Source</p>
                  <p className="text-sm">{selectedItem.sourceName}</p>
                  <p className="text-xs text-[var(--fg-tertiary)]">
                    {SOURCE_TYPE_LABELS[selectedItem.sourceType] || selectedItem.sourceType}
                  </p>
                </div>
                <div className="flex gap-6">
                  <div>
                    <p className="text-xs text-[var(--fg-tertiary)] uppercase tracking-wide">Amount</p>
                    <p className="text-lg font-bold">{formatUGX(selectedItem.amount)}</p>
                    <p className="text-xs text-[var(--fg-tertiary)]">{selectedItem.currency}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--fg-tertiary)] uppercase tracking-wide">Expected</p>
                    <p className="text-sm font-medium">{formatDate(selectedItem.expectedDate)}</p>
                    {(() => {
                      const days = getDaysUntilDue(selectedItem);
                      if (days === null) return null;
                      return (
                        <p className={`text-xs font-medium ${
                          days < 0 ? 'text-red-600' : days <= 7 ? 'text-amber-600' : 'text-muted-foreground'
                        }`}>
                          {days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? 'Due today' : `In ${days} days`}
                        </p>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Confidence */}
              <div className="border-t pt-4 space-y-2">
                <p className="text-xs text-[var(--fg-tertiary)] uppercase tracking-wide">Confidence</p>
                <div className="flex items-center gap-3">
                  <ConfidenceBadge level={selectedItem.confidenceLevel} />
                  <span className="text-sm text-muted-foreground">Score: {selectedItem.confidenceScore}/100</span>
                </div>
                <div className="w-full bg-[var(--bg-sunken)] rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      selectedItem.confidenceScore >= 70 ? 'bg-green-500'
                        : selectedItem.confidenceScore >= 40 ? 'bg-amber-500'
                        : 'bg-blue-400'
                    }`}
                    style={{ width: `${selectedItem.confidenceScore}%` }}
                  />
                </div>
              </div>

              {/* Status */}
              <div className="border-t pt-4 space-y-2">
                <p className="text-xs text-[var(--fg-tertiary)] uppercase tracking-wide">Status</p>
                <ReceiptStatusBadge status={selectedItem.status} />
                {selectedItem.actualReceivedDate && (
                  <div className="mt-2">
                    <p className="text-xs text-[var(--fg-tertiary)]">Received on</p>
                    <p className="text-sm">{formatDate(selectedItem.actualReceivedDate)}</p>
                    {selectedItem.actualAmount !== undefined && (
                      <p className="text-sm font-medium">
                        Actual: {formatUGX(selectedItem.actualAmount)}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Actions — only show for active receipts */}
              {selectedItem.status !== 'received' && selectedItem.status !== 'cancelled' && (
                <div className="border-t pt-4 space-y-3">
                  <p className="text-xs text-[var(--fg-tertiary)] uppercase tracking-wide">Actions</p>
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => openConfirmDialog(selectedItem)}
                    >
                      <DollarSign className="h-4 w-4 mr-1.5" />
                      Confirm Receipt
                    </Button>
                    {selectedItem.status === 'projected' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMarkInvoiced(selectedItem)}
                      >
                        <FileCheck className="h-4 w-4 mr-1.5" />
                        Mark as Invoiced
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleCancelReceipt(selectedItem)}
                    >
                      <Ban className="h-4 w-4 mr-1.5" />
                      Cancel Receipt
                    </Button>
                  </div>
                </div>
              )}

              {/* Milestone (if present) */}
              {selectedItem.milestoneId && (
                <div className="border-t pt-4 space-y-2">
                  <p className="text-xs text-[var(--fg-tertiary)] uppercase tracking-wide">Milestone</p>
                  <p className="text-sm font-medium">{selectedItem.milestoneName || selectedItem.milestoneId}</p>
                  {selectedItem.milestoneCompletionPercent !== undefined && (
                    <div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Completion</span>
                        <span>{selectedItem.milestoneCompletionPercent}%</span>
                      </div>
                      <div className="w-full bg-[var(--bg-sunken)] rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-blue-500"
                          style={{ width: `${selectedItem.milestoneCompletionPercent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Metadata */}
              <div className="border-t pt-4 space-y-2">
                <p className="text-xs text-[var(--fg-tertiary)] uppercase tracking-wide">Details</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[var(--fg-tertiary)]">Source ID</span>
                    <p className="text-muted-foreground truncate">{selectedItem.sourceId}</p>
                  </div>
                  <div>
                    <span className="text-[var(--fg-tertiary)]">Subsidiary</span>
                    <p className="text-muted-foreground">{selectedItem.subsidiaryId}</p>
                  </div>
                  <div>
                    <span className="text-[var(--fg-tertiary)]">Created</span>
                    <p className="text-muted-foreground">{formatDate(selectedItem.createdAt)}</p>
                  </div>
                  <div>
                    <span className="text-[var(--fg-tertiary)]">Updated</span>
                    <p className="text-muted-foreground">{formatDate(selectedItem.updatedAt)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Confirm Receipt Dialog ── */}
      <Dialog open={!!confirmDialog} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Confirm Cash Receipt</DialogTitle>
          </DialogHeader>
          {confirmDialog && (
            <div className="space-y-4 py-2">
              <div className="bg-[var(--bg-sunken)] rounded-lg p-3 space-y-1">
                <p className="text-sm font-medium">{confirmDialog.sourceName}</p>
                <p className="text-xs text-muted-foreground">{confirmDialog.customerName || 'No client'}</p>
                <p className="text-xs text-[var(--fg-tertiary)]">Expected: {formatUGX(confirmDialog.amount)}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-amount">Actual Amount Received (UGX)</Label>
                <Input
                  id="confirm-amount"
                  type="number"
                  value={confirmAmount}
                  onChange={(e) => setConfirmAmount(e.target.value)}
                  placeholder="Enter amount received"
                />
                {Number(confirmAmount) !== confirmDialog.amount && Number(confirmAmount) > 0 && (
                  <p className="text-xs text-amber-600">
                    {Number(confirmAmount) > confirmDialog.amount ? 'Over' : 'Under'} expected by{' '}
                    {formatUGX(Math.abs(Number(confirmAmount) - confirmDialog.amount))}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-date">Date Received</Label>
                <Input
                  id="confirm-date"
                  type="date"
                  value={confirmDate}
                  onChange={(e) => setConfirmDate(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleConfirmReceipt}
              disabled={isSubmitting || !confirmAmount}
            >
              {isSubmitting ? 'Confirming...' : 'Confirm Receipt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
