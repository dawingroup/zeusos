// ============================================================================
// BUDGET CREATE DIALOG
// Simple dialog for creating a new budget.
// ============================================================================

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import type { BudgetInput } from '../../types/budget.types';
import {
  BUDGET_TYPES,
  BUDGET_TYPE_LABELS,
  BUDGET_PERIODS,
  BUDGET_PERIOD_LABELS,
  type BudgetType,
  type BudgetPeriod,
} from '../../constants/budget.constants';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: BudgetInput) => Promise<void>;
}

export function BudgetCreateDialog({ open, onClose, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<BudgetType>(BUDGET_TYPES.OPERATING);
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear() + (new Date().getMonth() >= 6 ? 1 : 0));
  const [periodType, setPeriodType] = useState<BudgetPeriod>(BUDGET_PERIODS.MONTHLY);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || '',
        type,
        fiscalYear,
        periodType,
      });
      // Reset
      setName('');
      setDescription('');
      setType(BUDGET_TYPES.OPERATING);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-gray-800">New Budget</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600">Budget Name *</label>
            <input
              type="text"
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="e.g., FY2026 Operating Budget"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">Description</label>
            <textarea
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none h-16 focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Optional description..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Type</label>
              <select
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                value={type}
                onChange={e => setType(e.target.value as BudgetType)}
              >
                {Object.entries(BUDGET_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600">Fiscal Year</label>
              <select
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                value={fiscalYear}
                onChange={e => setFiscalYear(parseInt(e.target.value))}
              >
                {[2025, 2026, 2027, 2028].map(y => (
                  <option key={y} value={y}>FY{y} (Jul {y-1} – Jun {y})</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">Period</label>
            <select
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={periodType}
              onChange={e => setPeriodType(e.target.value as BudgetPeriod)}
            >
              {Object.entries(BUDGET_PERIOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
          >
            {saving ? 'Creating...' : (
              <>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Create Budget
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
