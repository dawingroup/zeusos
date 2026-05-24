// ============================================================================
// BUDGET SPREADSHEET PAGE
// Replaces the mock BudgetListPage with a spreadsheet table matching the
// ForecastPage pattern. Frozen first column, collapsible account groups,
// inline-editable period cells, variance coloring.
// ============================================================================

import { useState, useCallback } from 'react';
import {
  Plus,
  RefreshCw,
  Loader2,
  Send,
  CheckCircle,
  Lock,
} from 'lucide-react';
import { Card } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Skeleton } from '@/core/components/ui/skeleton';
import { useAuth } from '@/shared/hooks/useAuth';
import { useBudgetSpreadsheet } from '../hooks/useBudgetSpreadsheet';
import {
  BudgetColumnHeaders,
  BudgetSectionRow,
  BudgetLineRow,
  GrandTotalsRow,
} from '../components/budget/BudgetTable';
import { BudgetLineDrawer } from '../components/budget/BudgetLineDrawer';
import { BudgetCreateDialog } from '../components/budget/BudgetCreateDialog';
import { AddBudgetLineDialog } from '../components/budget/AddBudgetLineDialog';
import {
  BUDGET_STATUS_LABELS,
  BUDGET_STATUS_COLORS,
} from '../constants/budget.constants';
import type { BudgetLineItem, BudgetLineUpdate, BudgetInput } from '../types/budget.types';
import { pushBudgetLineToForecast, getAvailableForecasts } from '../services/budgetForecastBridge';

const COMPANY_ID = 'dawinos';

function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toFixed(0);
}

// ── Main Page ──────────────────────────────────────────────────────────────

export function BudgetSpreadsheetPage() {
  const { user } = useAuth();

  const {
    budgets,
    selectedBudgetId,
    selectBudget,
    budget,
    groupedLines,
    grandTotals,
    fiscalMonthHeaders,
    expandedGroups,
    toggleGroup,
    isLoading,
    saving,
    error,
    createBudget,
    addLine,
    updateLine,
    deleteLine,
    editCell,
    submitForApproval,
    approve,
    activate,
    refreshBudgets,
    refreshBudget,
    refreshLines,
  } = useBudgetSpreadsheet({ companyId: COMPANY_ID });

  const [drawerLine, setDrawerLine] = useState<BudgetLineItem | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddLineDialog, setShowAddLineDialog] = useState(false);
  const [pushingToForecast, setPushingToForecast] = useState(false);

  // Create budget
  const handleCreateBudget = useCallback(async (input: BudgetInput) => {
    const newBudget = await createBudget(input);
    selectBudget(newBudget.id);
    await refreshBudgets();
  }, [createBudget, selectBudget, refreshBudgets]);

  // Save line from drawer
  const handleSaveLine = useCallback(async (lineId: string, update: BudgetLineUpdate) => {
    await updateLine(lineId, update);
    await refreshLines();
  }, [updateLine, refreshLines]);

  // Delete line from drawer
  const handleDeleteLine = useCallback(async (lineId: string) => {
    await deleteLine(lineId);
    setDrawerLine(null);
  }, [deleteLine]);

  // Row click → open drawer
  const handleRowClick = useCallback((lineId: string) => {
    const line = groupedLines
      .flatMap(g => g.lines)
      .find(l => l.id === lineId);
    if (line) setDrawerLine(line);
  }, [groupedLines]);

  // Push to forecast
  const handlePushToForecast = useCallback(async (line: BudgetLineItem) => {
    setPushingToForecast(true);
    try {
      const forecasts = await getAvailableForecasts(COMPANY_ID);
      if (forecasts.length === 0) {
        alert('No forecasts found. Create a forecast first.');
        return;
      }
      // Use the first (baseline) forecast
      await pushBudgetLineToForecast(COMPANY_ID, line, forecasts[0].id);
      alert(`Budget line "${line.accountName}" pushed to forecast "${forecasts[0].name}".`);
    } catch (err) {
      alert(`Failed to push to forecast: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setPushingToForecast(false);
    }
  }, []);

  // Loading skeleton
  if (isLoading && !budget) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  const lineCount = groupedLines.reduce((s, g) => s + g.lines.length, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {/* Budget selector */}
          <select
            className="border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm font-medium text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-blue-300 max-w-[280px]"
            value={selectedBudgetId || ''}
            onChange={e => selectBudget(e.target.value)}
          >
            {budgets.length === 0 && <option value="">No budgets</option>}
            {budgets.map(b => (
              <option key={b.id} value={b.id}>
                {b.name} (FY{b.fiscalYear})
              </option>
            ))}
          </select>

          {/* Status badge */}
          {budget && (
            <span
              className="text-[10px] px-2 py-1 rounded-full font-medium"
              style={{
                backgroundColor: `${BUDGET_STATUS_COLORS[budget.status]}20`,
                color: BUDGET_STATUS_COLORS[budget.status],
              }}
            >
              {BUDGET_STATUS_LABELS[budget.status]}
            </span>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { refreshBudget(); refreshLines(); }}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {budget && budget.status === 'draft' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => submitForApproval()}
              disabled={saving || lineCount === 0}
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Submit
            </Button>
          )}

          {budget && budget.status === 'pending_approval' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => approve()}
              disabled={saving}
              className="text-green-600 border-green-300"
            >
              <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
              Approve
            </Button>
          )}

          {budget && budget.status === 'approved' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => activate()}
              disabled={saving}
              className="text-blue-600 border-blue-300"
            >
              <Lock className="w-3.5 h-3.5 mr-1.5" />
              Activate
            </Button>
          )}

          {budget && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddLineDialog(true)}
              disabled={budget.isLocked}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Line
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New Budget
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error.message}
        </div>
      )}

      {/* KPI cards */}
      {budget && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          <Card className="p-3">
            <p className="text-[10px] font-medium text-[var(--fg-tertiary)] uppercase">Annual Budget</p>
            <p className="text-lg font-bold text-foreground tabular-nums">{formatCompact(budget.totalBudget)}</p>
          </Card>
          <Card className="p-3">
            <p className="text-[10px] font-medium text-[var(--fg-tertiary)] uppercase">Actual</p>
            <p className="text-lg font-bold text-emerald-600 tabular-nums">{formatCompact(budget.totalActual)}</p>
          </Card>
          <Card className="p-3">
            <p className="text-[10px] font-medium text-[var(--fg-tertiary)] uppercase">Committed</p>
            <p className="text-lg font-bold text-amber-600 tabular-nums">{formatCompact(budget.totalCommitted)}</p>
          </Card>
          <Card className="p-3">
            <p className="text-[10px] font-medium text-[var(--fg-tertiary)] uppercase">Available</p>
            <p className="text-lg font-bold text-muted-foreground tabular-nums">{formatCompact(budget.totalAvailable)}</p>
          </Card>
          <Card className="p-3">
            <p className="text-[10px] font-medium text-[var(--fg-tertiary)] uppercase">Line Items</p>
            <p className="text-lg font-bold text-foreground">{lineCount}</p>
          </Card>
        </div>
      )}

      {/* Spreadsheet table */}
      {budget && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[1200px]">
              <thead>
                <BudgetColumnHeaders months={fiscalMonthHeaders} />
              </thead>
              <tbody>
                {groupedLines.length === 0 ? (
                  <tr>
                    <td
                      colSpan={18}
                      className="text-center py-12 text-[var(--fg-tertiary)] text-sm"
                    >
                      No budget lines yet. Click "Add Line" to get started.
                    </td>
                  </tr>
                ) : (
                  <>
                    {groupedLines.map(group => {
                      const groupId = `budget_${group.accountType}`;
                      const isExpanded = !!expandedGroups[groupId];

                      return (
                        <BudgetSection
                          key={group.accountType}
                          group={group}
                          isExpanded={isExpanded}
                          onToggle={() => toggleGroup(groupId)}
                          onCellEdit={editCell}
                          onRowClick={handleRowClick}
                        />
                      );
                    })}
                    <GrandTotalsRow totals={grandTotals} />
                  </>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* No budget selected */}
      {!budget && !isLoading && (
        <Card className="p-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            {budgets.length === 0
              ? 'No budgets yet. Create your first budget to get started.'
              : 'Select a budget from the dropdown above.'}
          </p>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            Create Budget
          </Button>
        </Card>
      )}

      {/* Dialogs */}
      <BudgetCreateDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={handleCreateBudget}
      />

      {budget && selectedBudgetId && (
        <AddBudgetLineDialog
          open={showAddLineDialog}
          companyId={COMPANY_ID}
          budgetId={selectedBudgetId}
          userId={user?.uid || 'system'}
          onClose={() => setShowAddLineDialog(false)}
          onSubmitManual={async (input) => {
            await addLine(input);
            await refreshLines();
          }}
          onImported={() => {
            refreshLines();
          }}
        />
      )}

      {/* Drawer */}
      {drawerLine && (
        <BudgetLineDrawer
          line={drawerLine}
          onSave={handleSaveLine}
          onDelete={handleDeleteLine}
          onPushToForecast={handlePushToForecast}
          onClose={() => setDrawerLine(null)}
        />
      )}

      {/* Overlay when pushing to forecast */}
      {pushingToForecast && (
        <div className="fixed inset-0 z-40 bg-black/20 flex items-center justify-center">
          <div className="bg-card rounded-lg p-6 flex items-center gap-3 shadow-xl">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            <span className="text-sm text-muted-foreground">Pushing to forecast...</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Budget Section (group header + child rows) ─────────────────────────────

function BudgetSection({
  group,
  isExpanded,
  onToggle,
  onCellEdit,
  onRowClick,
}: {
  group: ReturnType<typeof useBudgetSpreadsheet>['groupedLines'][0];
  isExpanded: boolean;
  onToggle: () => void;
  onCellEdit: (lineId: string, periodIndex: number, value: number) => void;
  onRowClick: (lineId: string) => void;
}) {
  return (
    <>
      <BudgetSectionRow
        group={group}
        isExpanded={isExpanded}
        onToggle={onToggle}
      />
      {isExpanded &&
        group.lines.map(line => (
          <BudgetLineRow
            key={line.id}
            line={line}
            onCellEdit={onCellEdit}
            onRowClick={onRowClick}
          />
        ))}
    </>
  );
}

export default BudgetSpreadsheetPage;
