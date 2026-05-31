// ============================================================================
// EXPENDITURE QUEUE PAGE
// Grouped & flat views, commitment badges, cost breakdown drawer, cross-links
// ============================================================================

import { useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Skeleton } from '@/core/components/ui/skeleton';
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
  ArrowLeft,
  ListOrdered,
  Search,
  ArrowUpDown,
  RefreshCw,
  X,
  AlertTriangle,
  Filter,
  ChevronDown,
  ChevronRight,
  LayoutList,
  FolderKanban,
} from 'lucide-react';
import { useExpenditureQueue } from '../hooks/useExpenditureQueue';
import type { ProjectGroup, SortField } from '../hooks/useExpenditureQueue';
import {
  ExpenditureScoreCard,
  TierBadge,
  CommitmentBadge,
  CostBreakdownPanel,
  CrossLinksPanel,
  formatUGX,
} from '../components/optimizer/ExpenditureScoreCard';
import {
  PRIORITY_TIER_LABELS,
  PRIORITY_TIER_COLORS,
  EXPENDITURE_CATEGORY_LABELS,
} from '../constants/optimizer.constants';
import type { PriorityTier, ExpenditureCategory, ExpenditureItem, CommitmentLevel } from '../types/optimizer.types';
import { useAuth } from '@/shared/hooks/useAuth';

function formatDate(ts: unknown): string {
  if (!ts) return '—';
  if (ts instanceof Date) return ts.toLocaleDateString('en-UG', { month: 'short', day: 'numeric' });
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts) {
    return (ts as { toDate: () => Date }).toDate().toLocaleDateString('en-UG', { month: 'short', day: 'numeric' });
  }
  return String(ts);
}

const TIER_OPTIONS: PriorityTier[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'DEFERRABLE'];
const CATEGORY_OPTIONS: ExpenditureCategory[] = [
  'materials', 'subcontractor', 'labor', 'equipment', 'transport',
  'statutory', 'rent', 'utilities', 'professional_fees', 'overhead',
  'loan_repayment', 'savings', 'other',
];

// ────────────────────────────────────────────────────────────────────────────
// TABLE ROW (shared between flat and grouped views)
// ────────────────────────────────────────────────────────────────────────────

function ExpenditureRow({
  item,
  onSelect,
  onApprove,
  onDefer,
}: {
  item: ExpenditureItem;
  onSelect: (id: string) => void;
  onApprove: (id: string) => void;
  onDefer: (id: string) => void;
}) {
  const isProjected = item.commitmentLevel === 'projected';

  return (
    <TableRow
      className={`cursor-pointer hover:bg-[var(--bg-sunken)] ${isProjected ? 'opacity-70 border-l-2 border-l-amber-300' : ''}`}
      onClick={() => onSelect(item.id)}
    >
      <TableCell>
        <span
          className="text-sm font-bold"
          style={{ color: PRIORITY_TIER_COLORS[item.priorityTier] }}
        >
          {item.compositeScore.toFixed(0)}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <TierBadge tier={item.priorityTier} />
          {item.commitmentLevel && <CommitmentBadge level={item.commitmentLevel} />}
          {item.isOutsourcedPO && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded bg-[var(--rag-blue-soft)] text-[var(--rag-blue)] border border-[var(--rag-blue)]">
              OPO
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div>
          <p className="text-sm text-foreground truncate max-w-[250px]">{item.description}</p>
          {item.vendor && (
            <p className="text-xs text-[var(--fg-tertiary)]">{item.vendor}</p>
          )}
        </div>
      </TableCell>
      <TableCell>
        <span className="text-xs text-muted-foreground">
          {EXPENDITURE_CATEGORY_LABELS[item.category] || item.category}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <span className="text-sm font-medium">{formatUGX(item.amountUGX)}</span>
      </TableCell>
      <TableCell>
        <span className="text-xs text-muted-foreground">{formatDate(item.latestDate)}</span>
      </TableCell>
      <TableCell>
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2 text-[var(--rag-green)] hover:text-[var(--rag-green)]"
            onClick={() => onApprove(item.id)}
          >
            Approve
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2 text-muted-foreground hover:text-muted-foreground"
            onClick={() => onDefer(item.id)}
          >
            Defer
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// GROUPED VIEW — Collapsible project groups
// ────────────────────────────────────────────────────────────────────────────

function GroupedView({
  groups,
  onSelectItem,
  onApprove,
  onDefer,
  onApproveAll,
  onDeferAll,
}: {
  groups: ProjectGroup[];
  onSelectItem: (id: string) => void;
  onApprove: (id: string) => void;
  onDefer: (id: string) => void;
  onApproveAll: (items: ExpenditureItem[]) => void;
  onDeferAll: (items: ExpenditureItem[]) => void;
}) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(groups.slice(0, 3).map(g => g.projectId))
  );

  const toggleGroup = useCallback((projectId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }, []);

  return (
    <div className="space-y-3">
      {groups.map(group => {
        const isExpanded = expandedGroups.has(group.projectId);
        const isProjected = group.commitmentLevel === 'projected';

        return (
          <Card
            key={group.projectId}
            className={`overflow-hidden ${isProjected ? 'border-dashed border-[var(--rag-amber)]' : ''}`}
          >
            {/* Group Header */}
            <button
              className={`flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-[var(--bg-sunken)] transition-colors ${isProjected ? 'bg-[var(--rag-amber-soft)]/50' : ''}`}
              onClick={() => toggleGroup(group.projectId)}
            >
              {isExpanded
                ? <ChevronDown className="w-4 h-4 text-[var(--fg-tertiary)] flex-shrink-0" />
                : <ChevronRight className="w-4 h-4 text-[var(--fg-tertiary)] flex-shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground truncate">
                    {group.projectName}
                  </span>
                  <CommitmentBadge level={group.commitmentLevel} />
                  <TierBadge tier={group.highestTier} />
                </div>
                {group.projectApprovalStatus && (
                  <span className="text-xs text-[var(--fg-tertiary)]">Status: {group.projectApprovalStatus}</span>
                )}
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <span className="text-xs text-muted-foreground">{group.itemCount} items</span>
                <span className="text-sm font-semibold text-foreground">{formatUGX(group.totalAmount)}</span>
              </div>
            </button>

            {/* Project-level actions */}
            <div className="flex items-center gap-2 px-4 pb-2 -mt-1" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2.5 text-[var(--rag-green)] hover:text-[var(--rag-green)] hover:bg-[var(--rag-green-soft)]"
                onClick={() => onApproveAll(group.items)}
              >
                Approve All ({group.itemCount})
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2.5 text-muted-foreground hover:text-muted-foreground"
                onClick={() => onDeferAll(group.items)}
              >
                Defer All
              </Button>
            </div>

            {/* Group Items */}
            {isExpanded && (
              <div className="border-t border-[var(--border-subtle)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Score</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead className="w-28">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.items.map(item => (
                      <ExpenditureRow
                        key={item.id}
                        item={item}
                        onSelect={onSelectItem}
                        onApprove={onApprove}
                        onDefer={onDefer}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        );
      })}

      {groups.length === 0 && (
        <Card className="p-8 text-center text-[var(--fg-tertiary)]">
          No expenditures match your filters
        </Card>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ────────────────────────────────────────────────────────────────────────────

export function ExpenditureQueuePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  useAuth();
  const companyId = 'zeus-group'; // From company context

  const initialTier = searchParams.get('tier') as PriorityTier | null;

  const {
    filteredItems,
    groupedItems,
    totalCount,
    filteredCount,
    totalAmount,
    tierCounts,
    filters,
    updateFilter,
    clearFilters,
    sortField,
    setSortField,
    toggleSortDirection,
    selectItem,
    selectedItem,
    viewMode,
    setViewMode,
    isLoading,
    error,
    refresh,
    approveItem,
    deferItem,
  } = useExpenditureQueue({
    companyId,
    initialFilters: initialTier ? { priorityTier: initialTier } : {},
  });

  const [showFilters, setShowFilters] = useState(!!initialTier);
  const [deferringId, setDeferringId] = useState<string | null>(null);
  const [deferReason, setDeferReason] = useState('');
  const [batchDeferIds, setBatchDeferIds] = useState<string[]>([]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      toggleSortDirection();
    } else {
      setSortField(field);
    }
  }, [sortField, setSortField, toggleSortDirection]);

  const handleDefer = useCallback(async () => {
    if (!deferReason.trim()) return;
    const reason = deferReason.trim();

    if (batchDeferIds.length > 0) {
      // Batch defer all items in the group
      for (const id of batchDeferIds) {
        await deferItem(id, reason);
      }
      setBatchDeferIds([]);
    } else if (deferringId) {
      await deferItem(deferringId, reason);
    }

    setDeferringId(null);
    setDeferReason('');
  }, [deferringId, deferReason, deferItem, batchDeferIds]);

  const handleDeferClick = useCallback((id: string) => {
    setDeferringId(id);
  }, []);

  const handleApproveAll = useCallback(async (items: ExpenditureItem[]) => {
    for (const item of items) {
      await approveItem(item.id);
    }
  }, [approveItem]);

  const handleDeferAll = useCallback((items: ExpenditureItem[]) => {
    // Store all IDs for batch defer — use first ID to trigger the dialog
    // and store the rest for sequential processing
    setBatchDeferIds(items.map(i => i.id));
    setDeferringId(items[0]?.id || null);
  }, []);

  if (isLoading && !filteredItems.length) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/finance/cash')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <ListOrdered className="w-5 h-5 text-[var(--rag-amber)]" />
          <h2 className="text-xl font-bold text-foreground">Expenditure Queue</h2>
          <span className="text-sm text-[var(--fg-tertiary)]">
            {filteredCount} of {totalCount} items
          </span>
        </div>
        <div className="flex gap-2">
          {/* View mode toggle */}
          <div className="flex border border-[var(--border-subtle)] rounded-md overflow-hidden">
            <button
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs ${viewMode === 'grouped' ? 'bg-[var(--bg-sunken)] text-foreground' : 'text-muted-foreground hover:text-muted-foreground'}`}
              onClick={() => setViewMode('grouped')}
              title="Group by project"
            >
              <FolderKanban className="w-3.5 h-3.5" />
              Grouped
            </button>
            <button
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs ${viewMode === 'flat' ? 'bg-[var(--bg-sunken)] text-foreground' : 'text-muted-foreground hover:text-muted-foreground'}`}
              onClick={() => setViewMode('flat')}
              title="Flat list"
            >
              <LayoutList className="w-3.5 h-3.5" />
              Flat
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-1.5" />
            Filters
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-[var(--rag-red-soft)] text-[var(--rag-red)] rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Tier Summary */}
      <div className="flex gap-2 flex-wrap">
        {TIER_OPTIONS.map(tier => {
          const count = tierCounts[tier] || 0;
          const isActive = filters.priorityTier === tier;
          return (
            <button
              key={tier}
              onClick={() => updateFilter('priorityTier', isActive ? undefined : tier)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                ${isActive
                  ? 'border-current shadow-sm'
                  : 'border-[var(--border-subtle)] hover:border-[var(--border-default)]'}
              `}
              style={isActive ? { color: PRIORITY_TIER_COLORS[tier], borderColor: PRIORITY_TIER_COLORS[tier] } : {}}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: PRIORITY_TIER_COLORS[tier] }}
              />
              {PRIORITY_TIER_LABELS[tier]} ({count})
            </button>
          );
        })}
        {(filters.priorityTier || filters.category || filters.commitmentLevel || filters.searchTerm) && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-muted-foreground"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Search</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[var(--fg-tertiary)]" />
                <Input
                  placeholder="Description, vendor..."
                  value={filters.searchTerm || ''}
                  onChange={(e) => updateFilter('searchTerm', e.target.value || undefined)}
                  className="pl-8 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Category</label>
              <select
                value={filters.category || ''}
                onChange={(e) => updateFilter('category', (e.target.value || undefined) as ExpenditureCategory | undefined)}
                className="w-full h-9 px-3 border border-[var(--border-subtle)] rounded-md text-sm"
              >
                <option value="">All Categories</option>
                {CATEGORY_OPTIONS.map(cat => (
                  <option key={cat} value={cat}>{EXPENDITURE_CATEGORY_LABELS[cat]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Commitment</label>
              <select
                value={filters.commitmentLevel || ''}
                onChange={(e) => updateFilter('commitmentLevel', (e.target.value || undefined) as CommitmentLevel | undefined)}
                className="w-full h-9 px-3 border border-[var(--border-subtle)] rounded-md text-sm"
              >
                <option value="">All Levels</option>
                <option value="committed">Committed</option>
                <option value="probable">Probable</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Min Amount (UGX)</label>
              <Input
                type="number"
                placeholder="0"
                value={filters.minAmount ?? ''}
                onChange={(e) => updateFilter('minAmount', e.target.value ? Number(e.target.value) : undefined)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Max Amount (UGX)</label>
              <Input
                type="number"
                placeholder="∞"
                value={filters.maxAmount ?? ''}
                onChange={(e) => updateFilter('maxAmount', e.target.value ? Number(e.target.value) : undefined)}
                className="text-sm"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Content — Grouped or Flat */}
      {viewMode === 'grouped' ? (
        <GroupedView
          groups={groupedItems}
          onSelectItem={(id) => selectItem(id)}
          onApprove={approveItem}
          onDefer={handleDeferClick}
          onApproveAll={handleApproveAll}
          onDeferAll={handleDeferAll}
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort('compositeScore')}
                  >
                    <span className="flex items-center gap-1">
                      Score
                      {sortField === 'compositeScore' && (
                        <ArrowUpDown className="w-3 h-3" />
                      )}
                    </span>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort('category')}
                  >
                    <span className="flex items-center gap-1">
                      Category
                      {sortField === 'category' && <ArrowUpDown className="w-3 h-3" />}
                    </span>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-right"
                    onClick={() => handleSort('amountUGX')}
                  >
                    <span className="flex items-center gap-1 justify-end">
                      Amount
                      {sortField === 'amountUGX' && <ArrowUpDown className="w-3 h-3" />}
                    </span>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort('latestDate')}
                  >
                    <span className="flex items-center gap-1">
                      Due
                      {sortField === 'latestDate' && <ArrowUpDown className="w-3 h-3" />}
                    </span>
                  </TableHead>
                  <TableHead className="w-28">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map(item => (
                  <ExpenditureRow
                    key={item.id}
                    item={item}
                    onSelect={(id) => selectItem(id)}
                    onApprove={approveItem}
                    onDefer={handleDeferClick}
                  />
                ))}
                {filteredItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-[var(--fg-tertiary)]">
                      No expenditures match your filters
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Footer */}
          {filteredItems.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-subtle)] text-xs text-muted-foreground">
              <span>{filteredCount} items</span>
              <span>Total: {formatUGX(totalAmount)}</span>
            </div>
          )}
        </Card>
      )}

      {/* Footer for grouped view */}
      {viewMode === 'grouped' && filteredItems.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{groupedItems.length} projects / {filteredCount} items</span>
          <span>Total: {formatUGX(totalAmount)}</span>
        </div>
      )}

      {/* Detail Drawer */}
      <Sheet open={!!selectedItem} onOpenChange={() => selectItem(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Expenditure Detail</SheetTitle>
          </SheetHeader>
          {selectedItem && (
            <div className="mt-4 space-y-6">
              {/* Score Card */}
              <ExpenditureScoreCard item={selectedItem} />

              {/* Cost Breakdown */}
              {selectedItem.costBreakdown && selectedItem.costBreakdown.totalPureCost > 0 && (
                <div className="border border-[var(--border-subtle)] rounded-lg p-4">
                  <CostBreakdownPanel breakdown={selectedItem.costBreakdown} />
                </div>
              )}

              {/* Cross-Links */}
              {selectedItem.crossLinks && (
                <div className="border border-[var(--border-subtle)] rounded-lg p-4">
                  <CrossLinksPanel crossLinks={selectedItem.crossLinks} />
                </div>
              )}

              {/* Metadata */}
              <div className="space-y-2">
                <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details</h5>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Source</span>
                  <span className="font-medium">{selectedItem.sourceType}</span>
                </div>
                {selectedItem.projectName && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Project</span>
                    <span className="font-medium">{selectedItem.projectName}</span>
                  </div>
                )}
                {selectedItem.vendor && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Vendor</span>
                    <span className="font-medium">{selectedItem.vendor}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium">{selectedItem.status}</span>
                </div>
                {selectedItem.commitmentLevel && (
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-muted-foreground">Commitment</span>
                    <CommitmentBadge level={selectedItem.commitmentLevel} />
                  </div>
                )}
                {selectedItem.isOutsourcedPO && (
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-muted-foreground">Outsourced PO</span>
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded bg-[var(--rag-blue-soft)] text-[var(--rag-blue)] border border-[var(--rag-blue)]">
                      OPO
                    </span>
                  </div>
                )}
                {selectedItem.projectApprovalStatus && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Project Status</span>
                    <span className="font-medium capitalize">{selectedItem.projectApprovalStatus}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-[var(--rag-green)] hover:bg-[var(--rag-green)] text-white"
                  onClick={() => {
                    approveItem(selectedItem.id);
                    selectItem(null);
                  }}
                >
                  Approve
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setDeferringId(selectedItem.id);
                    selectItem(null);
                  }}
                >
                  Defer
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Defer Reason Dialog */}
      {deferringId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="p-5 w-full max-w-md">
            <h4 className="text-sm font-semibold text-foreground mb-3">
              {batchDeferIds.length > 1 ? `Defer ${batchDeferIds.length} Expenditures` : 'Defer Expenditure'}
            </h4>
            <Input
              placeholder="Reason for deferring..."
              value={deferReason}
              onChange={(e) => setDeferReason(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2 mt-3 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setDeferringId(null); setDeferReason(''); setBatchDeferIds([]); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleDefer} disabled={!deferReason.trim()}>
                Confirm Defer
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default ExpenditureQueuePage;
