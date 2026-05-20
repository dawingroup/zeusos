/**
 * ProgramBudgetSummary
 *
 * Table-based summary of consolidated program-level budget figures:
 * Total Budget, Spent (USD + UGX), Committed, Available,
 * Utilization %, Active Projects, Active Period, and co-investment breakdown.
 */

import { useState } from 'react';
import { Pencil, X, Loader2, DollarSign } from 'lucide-react';
import type { Money } from '../../../core/types/money';
import type { BudgetPeriod } from '../../types/budget-period';
import { BUDGET_PERIOD_STATUS_CONFIG } from '../../types/budget-period';
import type { CoInvestmentSummary } from '../../types/program-budget';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

interface CurrencyExposure {
  totalBudgetUSD: number;
  totalBudgetUGXEquivalent: number;
  totalSpentUGX: number;
  totalSpentUSDEquivalent: number;
  weightedAvgRate: number;
  fxVariance: number;
}

interface ProgramBudgetSummaryProps {
  consolidatedBudgetUSD: Money;
  consolidatedSpentUSD: Money;
  consolidatedCommittedUSD: Money;
  consolidatedAvailableUSD: Money;
  utilizationPercent: number;
  activeProjectCount: number;
  activePeriod: BudgetPeriod | null;
  currencyExposure: CurrencyExposure;
  coInvestmentSummary?: CoInvestmentSummary | null;
  onEditBudget?: (data: { amount: number; currency: string }) => Promise<void>;
  editingBudget?: boolean;
  /** USD→UGX exchange rate for showing UGX equivalents */
  latestRate?: number | null;
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

const fmtUSD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const fmtUGX = new Intl.NumberFormat('en-UG', {
  style: 'currency',
  currency: 'UGX',
  maximumFractionDigits: 0,
});

function utilizationColor(pct: number): string {
  if (pct > 90) return 'text-red-600 font-semibold';
  if (pct > 70) return 'text-amber-600 font-semibold';
  return 'text-green-600 font-semibold';
}

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────

export function ProgramBudgetSummary({
  consolidatedBudgetUSD,
  consolidatedSpentUSD,
  consolidatedCommittedUSD,
  consolidatedAvailableUSD,
  utilizationPercent,
  activeProjectCount,
  activePeriod,
  currencyExposure,
  coInvestmentSummary,
  onEditBudget,
  editingBudget = false,
  latestRate,
}: ProgramBudgetSummaryProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);

  const periodLabel = activePeriod ? activePeriod.label : 'None';
  const periodStatusCfg = activePeriod
    ? BUDGET_PERIOD_STATUS_CONFIG[activePeriod.status]
    : null;

  const hasCoInvestment = coInvestmentSummary && coInvestmentSummary.entries.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Program Budget Summary</h3>
        {onEditBudget && (
          <button
            onClick={() => setShowEditDialog(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Pencil className="w-4 h-4" />
            Edit Budget
          </button>
        )}
      </div>

      {showEditDialog && onEditBudget && (
        <EditProgramBudgetDialog
          open={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          currentAmount={consolidatedBudgetUSD.amount}
          currentCurrency={consolidatedBudgetUSD.currency}
          spent={consolidatedSpentUSD.amount}
          committed={consolidatedCommittedUSD.amount}
          onSave={async (data) => {
            await onEditBudget(data);
            setShowEditDialog(false);
          }}
          saving={editingBudget}
        />
      )}

      {/* Budget Summary Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Metric
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Value
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-gray-600">Total Budget (USD)</td>
              <td className="px-4 py-3 text-right font-semibold text-gray-900 font-mono">
                {fmtUSD.format(consolidatedBudgetUSD.amount)}
              </td>
            </tr>
            {latestRate && (
              <tr className="hover:bg-amber-50 transition-colors bg-amber-50/40">
                <td className="px-4 py-3 text-gray-500 text-xs pl-6">Total Budget (UGX equiv)</td>
                <td className="px-4 py-3 text-right font-semibold text-amber-800 font-mono text-xs">
                  {fmtUGX.format(consolidatedBudgetUSD.amount * latestRate)}
                </td>
              </tr>
            )}
            <tr className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-gray-600">Total Spent (USD)</td>
              <td className="px-4 py-3 text-right font-semibold text-gray-900 font-mono">
                {fmtUSD.format(consolidatedSpentUSD.amount)}
              </td>
            </tr>
            <tr className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-gray-600">Total Spent (UGX)</td>
              <td className="px-4 py-3 text-right font-semibold text-gray-900 font-mono">
                {fmtUGX.format(currencyExposure.totalSpentUGX)}
              </td>
            </tr>
            <tr className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-gray-600">Committed (USD)</td>
              <td className="px-4 py-3 text-right font-semibold text-amber-600 font-mono">
                {fmtUSD.format(consolidatedCommittedUSD.amount)}
              </td>
            </tr>
            <tr className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-gray-600">Available (USD)</td>
              <td className="px-4 py-3 text-right font-semibold text-blue-600 font-mono">
                {fmtUSD.format(consolidatedAvailableUSD.amount)}
              </td>
            </tr>
            {latestRate && (
              <tr className="hover:bg-amber-50 transition-colors bg-amber-50/40">
                <td className="px-4 py-3 text-gray-500 text-xs pl-6">Available (UGX equiv)</td>
                <td className={`px-4 py-3 text-right font-semibold font-mono text-xs ${consolidatedAvailableUSD.amount >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                  {fmtUGX.format(consolidatedAvailableUSD.amount * latestRate)}
                </td>
              </tr>
            )}
            <tr className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-gray-600">Utilization</td>
              <td className={`px-4 py-3 text-right font-mono ${utilizationColor(utilizationPercent)}`}>
                {utilizationPercent.toFixed(1)}%
              </td>
            </tr>
            <tr className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-gray-600">Active Projects</td>
              <td className="px-4 py-3 text-right font-semibold text-gray-900">
                {activeProjectCount}
              </td>
            </tr>
            <tr className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-gray-600">Active Period</td>
              <td className="px-4 py-3 text-right">
                <span className="font-semibold text-gray-900">{periodLabel}</span>
                {periodStatusCfg && (
                  <span
                    className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${periodStatusCfg.color} ${periodStatusCfg.bgColor}`}
                  >
                    {periodStatusCfg.label}
                  </span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Co-Investment Summary Table */}
      {hasCoInvestment && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Co-Investment Source
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rate / Ratio
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-gray-600">Donor Funding</td>
                <td className="px-4 py-3 text-right font-semibold text-blue-600 font-mono">
                  {fmtUSD.format(coInvestmentSummary.donorTotal.amount)}
                </td>
                <td className="px-4 py-3 text-right text-gray-400">—</td>
              </tr>
              <tr className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-gray-600">Client Co-Investment</td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-600 font-mono">
                  {fmtUSD.format(coInvestmentSummary.clientTotal.amount)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                  {(coInvestmentSummary.coInvestmentRatio * 100).toFixed(1)}%
                </td>
              </tr>
              {coInvestmentSummary.governmentTotal.amount > 0 && (
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-600">Government</td>
                  <td className="px-4 py-3 text-right font-semibold text-purple-600 font-mono">
                    {fmtUSD.format(coInvestmentSummary.governmentTotal.amount)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">—</td>
                </tr>
              )}
              <tr className="hover:bg-gray-50 transition-colors bg-gray-50">
                <td className="px-4 py-3 text-gray-600">Disbursement Rate</td>
                <td className="px-4 py-3 text-right text-gray-400">—</td>
                <td className={`px-4 py-3 text-right font-semibold ${
                  coInvestmentSummary.disbursementRate > 80
                    ? 'text-green-600'
                    : coInvestmentSummary.disbursementRate > 50
                      ? 'text-amber-600'
                      : 'text-red-600'
                }`}>
                  {coInvestmentSummary.disbursementRate.toFixed(1)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// EDIT PROGRAM BUDGET DIALOG (internal)
// ─────────────────────────────────────────────────────────────────

interface EditProgramBudgetDialogProps {
  open: boolean;
  onClose: () => void;
  currentAmount: number;
  currentCurrency: string;
  spent: number;
  committed: number;
  onSave: (data: { amount: number; currency: string }) => Promise<void>;
  saving: boolean;
}

function EditProgramBudgetDialog({
  open,
  onClose,
  currentAmount,
  currentCurrency,
  spent,
  committed,
  onSave,
  saving,
}: EditProgramBudgetDialogProps) {
  const [amount, setAmount] = useState(currentAmount);
  const [currency, setCurrency] = useState(currentCurrency);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const remaining = amount - spent - committed;

  const handleSave = async () => {
    if (amount <= 0) {
      setError('Budget amount must be greater than zero.');
      return;
    }
    try {
      setError(null);
      await onSave({ amount, currency });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update budget');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Edit Program Budget</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded" disabled={saving}>
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Currency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Currency</label>
            <div className="flex gap-2">
              {['USD', 'UGX'].map(c => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                    currency === c
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Total Allocated Budget ({currency})
            </label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              min={0}
              step={currency === 'UGX' ? 1000000 : 1000}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            <p className="text-xs text-gray-500 mt-1">
              {currency === 'USD' ? fmtUSD.format(amount) : fmtUGX.format(amount)}
            </p>
          </div>

          {/* Preview */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="text-xs text-gray-500 font-medium">Preview</div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Total Budget:</span>
                <span className="ml-2 font-medium">{fmtUSD.format(amount)}</span>
              </div>
              <div>
                <span className="text-gray-500">Spent:</span>
                <span className="ml-2 font-medium">{fmtUSD.format(spent)}</span>
              </div>
              <div>
                <span className="text-gray-500">Committed:</span>
                <span className="ml-2 font-medium">{fmtUSD.format(committed)}</span>
              </div>
              <div>
                <span className="text-gray-500">Remaining:</span>
                <span className={`ml-2 font-medium ${remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {fmtUSD.format(Math.abs(remaining))}
                  {remaining < 0 && ' (over)'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 border rounded-lg hover:bg-gray-100"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
