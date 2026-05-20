/**
 * Edit Budget Dialog - Modal to update budget total, contingency, and currency
 */

import { useState, useEffect } from 'react';
import { X, Loader2, DollarSign } from 'lucide-react';
import type { ProjectBudget } from '../../types/project-budget';
import { formatBudgetAmount } from '../../types/project-budget';

interface EditBudgetDialogProps {
  open: boolean;
  onClose: () => void;
  currentBudget: ProjectBudget;
  onSave: (updates: Partial<ProjectBudget>) => Promise<void>;
  saving: boolean;
}

export function EditBudgetDialog({
  open,
  onClose,
  currentBudget,
  onSave,
  saving,
}: EditBudgetDialogProps) {
  const [totalBudget, setTotalBudget] = useState(currentBudget.totalBudget);
  const [contingencyPercent, setContingencyPercent] = useState(currentBudget.contingencyPercent);
  const [currency, setCurrency] = useState<'UGX' | 'USD'>(currentBudget.currency);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setTotalBudget(currentBudget.totalBudget);
      setContingencyPercent(currentBudget.contingencyPercent);
      setCurrency(currentBudget.currency);
      setError(null);
    }
  }, [open, currentBudget]);

  if (!open) return null;

  const remaining = totalBudget - currentBudget.spent - currentBudget.committed;
  const contingencyAmount = totalBudget * (contingencyPercent / 100);

  const handleSave = async () => {
    if (totalBudget <= 0) {
      setError('Total budget must be greater than zero');
      return;
    }
    if (contingencyPercent < 0 || contingencyPercent > 50) {
      setError('Contingency must be between 0% and 50%');
      return;
    }

    try {
      setError(null);
      const updates: Partial<ProjectBudget> = {
        totalBudget,
        contingencyPercent,
        currency,
        remaining: totalBudget - currentBudget.spent - currentBudget.committed,
        variance: totalBudget - currentBudget.spent - currentBudget.committed,
      };

      // Recalculate variance status based on utilization
      const utilizationPct = totalBudget > 0
        ? ((currentBudget.spent + currentBudget.committed) / totalBudget) * 100
        : 0;
      if (utilizationPct < 90) {
        updates.varianceStatus = 'under';
      } else if (utilizationPct <= 100) {
        updates.varianceStatus = 'on_track';
      } else {
        updates.varianceStatus = 'over';
      }

      await onSave(updates);
      onClose();
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
            <DollarSign className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-gray-900">Edit Budget</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
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
              {(['UGX', 'USD'] as const).map(c => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                    currency === c
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Total Budget */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Total Budget ({currency})
            </label>
            <input
              type="number"
              value={totalBudget}
              onChange={e => setTotalBudget(Number(e.target.value))}
              min={0}
              step={100000}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="text-xs text-gray-500 mt-1">
              {formatBudgetAmount(totalBudget, currency)}
            </p>
          </div>

          {/* Contingency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Contingency Percentage
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={contingencyPercent}
                onChange={e => setContingencyPercent(Number(e.target.value))}
                min={0}
                max={50}
                step={0.5}
                className="w-24 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <span className="text-sm text-gray-500">%</span>
              <span className="text-xs text-gray-400">
                = {formatBudgetAmount(contingencyAmount, currency)}
              </span>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="text-xs text-gray-500 font-medium">Preview</div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Total Budget:</span>
                <span className="ml-2 font-medium">{formatBudgetAmount(totalBudget, currency)}</span>
              </div>
              <div>
                <span className="text-gray-500">Spent:</span>
                <span className="ml-2 font-medium">{formatBudgetAmount(currentBudget.spent, currency)}</span>
              </div>
              <div>
                <span className="text-gray-500">Committed:</span>
                <span className="ml-2 font-medium">{formatBudgetAmount(currentBudget.committed, currency)}</span>
              </div>
              <div>
                <span className="text-gray-500">Remaining:</span>
                <span className={`ml-2 font-medium ${remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatBudgetAmount(Math.abs(remaining), currency)}
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
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
