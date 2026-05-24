// ============================================================================
// ADD BUDGET LINE DIALOG
// Dialog for adding a new line item to a budget.
// Three source tabs: Manual | Import from Forecast | Import from Procurement
// ============================================================================

import { useState, useEffect } from 'react';
import { Plus, X, FileSpreadsheet, Wrench, Loader2, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import type { BudgetLineInput } from '../../types/budget.types';
import type { ForecastMetadata, ForecastPeriod } from '../../types/forecast.types';
import {
  ALLOCATION_METHODS,
  ALLOCATION_METHOD_LABELS,
  type AllocationMethod,
} from '../../constants/budget.constants';
import { accountService } from '../../services/accountService';
import {
  getAvailableForecasts,
  importForecastRowsToBudget,
  getPendingProcurementRequirements,
  importProcurementToBudget,
} from '../../services/budgetForecastBridge';
import type { ProcurementRequirementItem } from '../../services/budgetForecastBridge';
import { getForecastPeriods } from '../../services/forecastService';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  companyId: string;
  budgetId: string;
  userId: string;
  onClose: () => void;
  onSubmitManual: (input: BudgetLineInput) => Promise<void>;
  onImported: () => void; // callback after forecast/procurement import to refresh lines
}

type Tab = 'manual' | 'forecast' | 'procurement';

interface AccountOption {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface ForecastAccountRow {
  accountId: string;
  accountName: string;
  annualTotal: number;
  periods: number[]; // 12 months
}

function fmtCompact(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toFixed(0);
}

// ── Component ───────────────────────────────────────────────────────────────

export function AddBudgetLineDialog({
  open,
  companyId,
  budgetId,
  userId,
  onClose,
  onSubmitManual,
  onImported,
}: Props) {
  const [tab, setTab] = useState<Tab>('manual');
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);

  // Manual form state
  const [accountId, setAccountId] = useState('');
  const [annualBudget, setAnnualBudget] = useState(0);
  const [allocationMethod, setAllocationMethod] = useState<AllocationMethod>(ALLOCATION_METHODS.EQUAL);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [accountSearch, setAccountSearch] = useState('');

  // Forecast import state
  const [forecasts, setForecasts] = useState<ForecastMetadata[]>([]);
  const [forecastsLoading, setForecastsLoading] = useState(false);
  const [selectedForecastId, setSelectedForecastId] = useState<string>('');
  const [forecastAccounts, setForecastAccounts] = useState<ForecastAccountRow[]>([]);
  const [forecastAccountsLoading, setForecastAccountsLoading] = useState(false);
  const [selectedForecastAccounts, setSelectedForecastAccounts] = useState<Set<string>>(new Set());
  const [adjustmentPct, setAdjustmentPct] = useState(0);
  const [forecastImporting, setForecastImporting] = useState(false);
  const [forecastImportResult, setForecastImportResult] = useState<{ count: number } | null>(null);

  // Procurement import state
  const [procurementItems, setProcurementItems] = useState<ProcurementRequirementItem[]>([]);
  const [procurementLoading, setProcurementLoading] = useState(false);
  const [selectedProcItems, setSelectedProcItems] = useState<Set<string>>(new Set());
  const [procAccountMap, setProcAccountMap] = useState<Record<string, string>>({});
  const [procImporting, setProcImporting] = useState(false);
  const [procImportResult, setProcImportResult] = useState<{ count: number } | null>(null);

  // Load accounts (for all tabs)
  useEffect(() => {
    if (open && companyId) {
      setAccountsLoading(true);
      accountService.getAll(companyId).then(result => {
        const list = (result.accounts || result || []) as AccountOption[];
        setAccounts(list.map(a => ({
          id: a.id,
          code: a.code,
          name: a.name,
          type: a.type,
        })));
      }).catch(() => {
        setAccounts([]);
      }).finally(() => setAccountsLoading(false));
    }
  }, [open, companyId]);

  // Load forecasts when forecast tab is selected
  useEffect(() => {
    if (open && tab === 'forecast' && forecasts.length === 0 && !forecastsLoading) {
      setForecastsLoading(true);
      getAvailableForecasts(companyId)
        .then(f => {
          setForecasts(f);
          if (f.length > 0 && !selectedForecastId) {
            setSelectedForecastId(f[0].id);
          }
        })
        .catch(() => setForecasts([]))
        .finally(() => setForecastsLoading(false));
    }
  }, [open, tab, companyId, forecasts.length, forecastsLoading, selectedForecastId]);

  // Load forecast periods/accounts when a forecast is selected
  useEffect(() => {
    if (!selectedForecastId || tab !== 'forecast') return;
    setForecastAccountsLoading(true);
    setForecastAccounts([]);
    setSelectedForecastAccounts(new Set());

    getForecastPeriods(companyId, selectedForecastId)
      .then((periods: ForecastPeriod[]) => {
        // Extract unique account IDs across all periods
        const accountMap = new Map<string, number[]>();

        for (const period of periods) {
          if (period.pl?.accountValues) {
            for (const [accId, value] of Object.entries(period.pl.accountValues)) {
              if (!accountMap.has(accId)) {
                accountMap.set(accId, Array(12).fill(0));
              }
              // Find period index (simplified: use period order)
              const idx = periods.indexOf(period);
              if (idx < 12) {
                accountMap.get(accId)![idx] = value;
              }
            }
          }
        }

        // Build rows with account names from loaded accounts
        const rows: ForecastAccountRow[] = [];
        for (const [accId, periodVals] of accountMap) {
          const total = periodVals.reduce((s, v) => s + v, 0);
          if (total === 0) continue; // skip zero-value accounts
          const acct = accounts.find(a => a.id === accId);
          rows.push({
            accountId: accId,
            accountName: acct?.name || accId,
            annualTotal: total,
            periods: periodVals,
          });
        }
        rows.sort((a, b) => Math.abs(b.annualTotal) - Math.abs(a.annualTotal));
        setForecastAccounts(rows);
      })
      .catch(() => setForecastAccounts([]))
      .finally(() => setForecastAccountsLoading(false));
  }, [selectedForecastId, tab, companyId, accounts]);

  // Load procurement items when procurement tab is selected
  useEffect(() => {
    if (open && tab === 'procurement' && procurementItems.length === 0 && !procurementLoading) {
      setProcurementLoading(true);
      getPendingProcurementRequirements(companyId)
        .then(items => setProcurementItems(items))
        .catch(() => setProcurementItems([]))
        .finally(() => setProcurementLoading(false));
    }
  }, [open, tab, companyId, procurementItems.length, procurementLoading]);

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setForecastImportResult(null);
      setProcImportResult(null);
      setSelectedForecastAccounts(new Set());
      setSelectedProcItems(new Set());
    }
  }, [open]);

  if (!open) return null;

  const filteredAccounts = accounts.filter(a =>
    a.name.toLowerCase().includes(accountSearch.toLowerCase()) ||
    a.code.toLowerCase().includes(accountSearch.toLowerCase())
  );

  // ── Manual submit ─────────────────────────────────────────────────────────

  const handleManualSubmit = async () => {
    if (!accountId || annualBudget <= 0) return;
    setSaving(true);
    try {
      await onSubmitManual({
        accountId,
        annualBudget,
        allocationMethod,
        description: description.trim() || '',
      });
      setAccountId('');
      setAnnualBudget(0);
      setDescription('');
      setAccountSearch('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  // ── Forecast import ───────────────────────────────────────────────────────

  const toggleForecastAccount = (accId: string) => {
    setSelectedForecastAccounts(prev => {
      const next = new Set(prev);
      if (next.has(accId)) next.delete(accId);
      else next.add(accId);
      return next;
    });
  };

  const toggleAllForecastAccounts = () => {
    if (selectedForecastAccounts.size === forecastAccounts.length) {
      setSelectedForecastAccounts(new Set());
    } else {
      setSelectedForecastAccounts(new Set(forecastAccounts.map(r => r.accountId)));
    }
  };

  const handleForecastImport = async () => {
    if (selectedForecastAccounts.size === 0 || !selectedForecastId) return;
    setForecastImporting(true);
    try {
      const result = await importForecastRowsToBudget(
        companyId,
        {
          forecastId: selectedForecastId,
          accountIds: Array.from(selectedForecastAccounts),
          targetBudgetId: budgetId,
          adjustmentPct: adjustmentPct / 100,
        },
        userId
      );
      setForecastImportResult({ count: result.length });
      onImported();
    } catch (err) {
      alert(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setForecastImporting(false);
    }
  };

  // ── Procurement import ────────────────────────────────────────────────────

  const toggleProcItem = (id: string) => {
    setSelectedProcItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllProcItems = () => {
    if (selectedProcItems.size === procurementItems.length) {
      setSelectedProcItems(new Set());
    } else {
      setSelectedProcItems(new Set(procurementItems.map(i => i.id)));
    }
  };

  const handleProcImport = async () => {
    if (selectedProcItems.size === 0) return;

    // Validate all selected items have an account mapped
    const unmapped = Array.from(selectedProcItems).filter(id => !procAccountMap[id]);
    if (unmapped.length > 0) {
      alert(`Please assign an account to all selected items (${unmapped.length} unmapped).`);
      return;
    }

    setProcImporting(true);
    try {
      const items = Array.from(selectedProcItems).map(id => {
        const req = procurementItems.find(i => i.id === id)!;
        return {
          requirementId: id,
          accountId: procAccountMap[id],
          amount: req.estimatedCost,
          description: req.description,
        };
      });
      const result = await importProcurementToBudget(companyId, budgetId, items, userId);
      setProcImportResult({ count: result.length });
      onImported();
    } catch (err) {
      alert(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setProcImporting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-foreground">Add Budget Line</h3>
          <button onClick={onClose} className="text-[var(--fg-tertiary)] hover:text-muted-foreground p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b bg-[var(--bg-sunken)] px-4">
          {([
            { id: 'manual' as Tab, label: 'Manual', icon: Plus },
            { id: 'forecast' as Tab, label: 'From Forecast', icon: FileSpreadsheet },
            { id: 'procurement' as Tab, label: 'From Procurement', icon: Wrench },
          ]).map(t => (
            <button
              key={t.id}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-[var(--rag-blue)] text-[var(--rag-blue)]'
                  : 'border-transparent text-muted-foreground hover:text-muted-foreground'
              }`}
              onClick={() => setTab(t.id)}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* ── MANUAL TAB ─────────────────────────────────────────── */}
          {tab === 'manual' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Account *</label>
                <input
                  type="text"
                  className="mt-1 w-full border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--rag-blue)]"
                  placeholder="Search accounts..."
                  value={accountSearch}
                  onChange={e => setAccountSearch(e.target.value)}
                />
                {accountSearch && (
                  <div className="mt-1 max-h-40 overflow-y-auto border border-[var(--border-subtle)] rounded-lg">
                    {accountsLoading ? (
                      <p className="p-3 text-xs text-[var(--fg-tertiary)]">Loading...</p>
                    ) : filteredAccounts.length === 0 ? (
                      <p className="p-3 text-xs text-[var(--fg-tertiary)]">No accounts found</p>
                    ) : (
                      filteredAccounts.slice(0, 20).map(a => (
                        <button
                          key={a.id}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--rag-blue-soft)] transition-colors ${
                            accountId === a.id ? 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]' : 'text-muted-foreground'
                          }`}
                          onClick={() => {
                            setAccountId(a.id);
                            setAccountSearch(a.name);
                          }}
                        >
                          <span className="text-[10px] text-[var(--fg-tertiary)] mr-1.5">{a.code}</span>
                          {a.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
                {accountId && !accountSearch && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Selected: {accounts.find(a => a.id === accountId)?.name}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Annual Budget (UGX) *</label>
                <input
                  type="number"
                  className="mt-1 w-full border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--rag-blue)]"
                  value={annualBudget || ''}
                  onChange={e => setAnnualBudget(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Allocation Method</label>
                <select
                  className="mt-1 w-full border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--rag-blue)]"
                  value={allocationMethod}
                  onChange={e => setAllocationMethod(e.target.value as AllocationMethod)}
                >
                  {Object.entries(ALLOCATION_METHOD_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <input
                  type="text"
                  className="mt-1 w-full border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--rag-blue)]"
                  placeholder="Optional description..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  size="sm"
                  onClick={handleManualSubmit}
                  disabled={saving || !accountId || annualBudget <= 0}
                >
                  {saving ? 'Adding...' : (
                    <>
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Line
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ── FORECAST TAB ───────────────────────────────────────── */}
          {tab === 'forecast' && (
            <div className="space-y-4">
              {forecastImportResult ? (
                <div className="text-center py-8">
                  <Check className="w-10 h-10 text-[var(--rag-green)] mx-auto mb-3" />
                  <h4 className="text-sm font-semibold text-foreground mb-1">
                    Imported {forecastImportResult.count} line{forecastImportResult.count !== 1 ? 's' : ''}
                  </h4>
                  <p className="text-xs text-muted-foreground mb-4">
                    Budget lines have been created from forecast data.
                  </p>
                  <Button size="sm" variant="outline" onClick={onClose}>
                    Close
                  </Button>
                </div>
              ) : forecastsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-[var(--rag-blue)] mr-2" />
                  <span className="text-sm text-muted-foreground">Loading forecasts...</span>
                </div>
              ) : forecasts.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-8 h-8 text-[var(--fg-tertiary)] mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No forecasts found. Create a 3-Way Forecast first.
                  </p>
                </div>
              ) : (
                <>
                  {/* Forecast selector */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Select Forecast</label>
                    <select
                      className="mt-1 w-full border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--rag-blue)]"
                      value={selectedForecastId}
                      onChange={e => setSelectedForecastId(e.target.value)}
                    >
                      {forecasts.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Adjustment */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Adjustment % <span className="text-[var(--fg-tertiary)]">(e.g. -5 for 5% haircut, 10 for 10% uplift)</span>
                    </label>
                    <input
                      type="number"
                      className="mt-1 w-32 border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--rag-blue)]"
                      value={adjustmentPct}
                      onChange={e => setAdjustmentPct(parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {/* Account list */}
                  {forecastAccountsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-4 h-4 animate-spin text-[var(--rag-blue)] mr-2" />
                      <span className="text-xs text-muted-foreground">Loading forecast accounts...</span>
                    </div>
                  ) : forecastAccounts.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-xs text-[var(--fg-tertiary)]">
                        No account data in this forecast. Ensure the forecast has been calculated.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <button
                          className="text-xs text-[var(--rag-blue)] hover:text-[var(--rag-blue)]"
                          onClick={toggleAllForecastAccounts}
                        >
                          {selectedForecastAccounts.size === forecastAccounts.length ? 'Deselect all' : 'Select all'}
                        </button>
                        <span className="text-xs text-[var(--fg-tertiary)]">
                          {selectedForecastAccounts.size} of {forecastAccounts.length} selected
                        </span>
                      </div>

                      <div className="max-h-64 overflow-y-auto border border-[var(--border-subtle)] rounded-lg divide-y divide-[var(--border-subtle)]">
                        {forecastAccounts.map(row => (
                          <label
                            key={row.accountId}
                            className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[var(--rag-blue-soft)]/40 transition-colors ${
                              selectedForecastAccounts.has(row.accountId) ? 'bg-[var(--rag-blue-soft)]/60' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="rounded border-[var(--border-default)] text-[var(--rag-blue)] focus:ring-[var(--rag-blue)]"
                              checked={selectedForecastAccounts.has(row.accountId)}
                              onChange={() => toggleForecastAccount(row.accountId)}
                            />
                            <span className="flex-1 text-sm text-muted-foreground truncate">
                              {row.accountName}
                            </span>
                            <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                              {fmtCompact(row.annualTotal)}
                            </span>
                          </label>
                        ))}
                      </div>

                      <div className="flex justify-end pt-2">
                        <Button
                          size="sm"
                          onClick={handleForecastImport}
                          disabled={forecastImporting || selectedForecastAccounts.size === 0}
                        >
                          {forecastImporting ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                              Importing...
                            </>
                          ) : (
                            <>
                              <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                              Import {selectedForecastAccounts.size} Account{selectedForecastAccounts.size !== 1 ? 's' : ''}
                            </>
                          )}
                        </Button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── PROCUREMENT TAB ────────────────────────────────────── */}
          {tab === 'procurement' && (
            <div className="space-y-4">
              {procImportResult ? (
                <div className="text-center py-8">
                  <Check className="w-10 h-10 text-[var(--rag-green)] mx-auto mb-3" />
                  <h4 className="text-sm font-semibold text-foreground mb-1">
                    Imported {procImportResult.count} line{procImportResult.count !== 1 ? 's' : ''}
                  </h4>
                  <p className="text-xs text-muted-foreground mb-4">
                    Procurement requirements have been added as budget lines.
                  </p>
                  <Button size="sm" variant="outline" onClick={onClose}>
                    Close
                  </Button>
                </div>
              ) : procurementLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-[var(--rag-amber)] mr-2" />
                  <span className="text-sm text-muted-foreground">Loading procurement requirements...</span>
                </div>
              ) : procurementItems.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-8 h-8 text-[var(--fg-tertiary)] mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No pending procurement requirements found.
                  </p>
                  <p className="text-xs text-[var(--fg-tertiary)] mt-1">
                    Open procurement requirements (pending/approved/open) will appear here.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <button
                      className="text-xs text-[var(--rag-blue)] hover:text-[var(--rag-blue)]"
                      onClick={toggleAllProcItems}
                    >
                      {selectedProcItems.size === procurementItems.length ? 'Deselect all' : 'Select all'}
                    </button>
                    <span className="text-xs text-[var(--fg-tertiary)]">
                      {selectedProcItems.size} of {procurementItems.length} selected
                    </span>
                  </div>

                  <div className="max-h-80 overflow-y-auto border border-[var(--border-subtle)] rounded-lg divide-y divide-[var(--border-subtle)]">
                    {procurementItems.map(item => (
                      <div
                        key={item.id}
                        className={`px-3 py-2.5 transition-colors ${
                          selectedProcItems.has(item.id) ? 'bg-[var(--rag-amber-soft)]/60' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-0.5 rounded border-[var(--border-default)] text-[var(--rag-amber)] focus:ring-[var(--rag-amber)]"
                            checked={selectedProcItems.has(item.id)}
                            onChange={() => toggleProcItem(item.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm text-muted-foreground truncate">{item.description}</span>
                              <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                                {fmtCompact(item.estimatedCost)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--bg-sunken)] text-muted-foreground">
                                {item.category}
                              </span>
                              <span className="text-[10px] text-[var(--fg-tertiary)]">{item.status}</span>
                              {item.expectedDate && (
                                <span className="text-[10px] text-[var(--fg-tertiary)]">
                                  Due: {item.expectedDate}
                                </span>
                              )}
                            </div>

                            {/* Account mapping (shown when selected) */}
                            {selectedProcItems.has(item.id) && (
                              <div className="mt-2">
                                <select
                                  className="w-full border border-[var(--border-subtle)] rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--rag-amber)]"
                                  value={procAccountMap[item.id] || ''}
                                  onChange={e => setProcAccountMap(prev => ({
                                    ...prev,
                                    [item.id]: e.target.value,
                                  }))}
                                >
                                  <option value="">-- Assign account --</option>
                                  {accounts
                                    .filter(a => a.type === 'expense' || a.type === 'asset')
                                    .map(a => (
                                      <option key={a.id} value={a.id}>
                                        {a.code} — {a.name}
                                      </option>
                                    ))}
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      size="sm"
                      onClick={handleProcImport}
                      disabled={procImporting || selectedProcItems.size === 0}
                    >
                      {procImporting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Wrench className="w-3.5 h-3.5 mr-1" />
                          Import {selectedProcItems.size} Item{selectedProcItems.size !== 1 ? 's' : ''}
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
