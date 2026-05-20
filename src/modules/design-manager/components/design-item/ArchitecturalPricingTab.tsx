/**
 * Architectural Pricing Tab
 * Manages time tracking and fixed costs for architectural drawings
 */

import { useState } from 'react';
import { Plus, Trash2, Clock, Receipt, Calculator } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type {
  DesignItem,
  ArchitecturalPricing,
  ArchitecturalTimeEntry,
  ArchitecturalFixedCost,
  DesignStage,
} from '../../types';
import { DISCIPLINE_LABELS, DEFAULT_DISCIPLINE_RATES } from '../../types';
import { STAGE_LABELS } from '../../utils/formatting';

export interface ArchitecturalPricingTabProps {
  item: DesignItem;
  projectId: string;
  userId: string;
  onUpdate: (updates: Partial<ArchitecturalPricing>) => Promise<void>;
  readOnly?: boolean;
}

const FIXED_COST_CATEGORIES = [
  { value: 'site-visit', label: 'Site Visit' },
  { value: 'geotechnical', label: 'Geotechnical Survey' },
  { value: 'survey', label: 'Land Survey' },
  { value: 'consultant', label: 'Consultant Fee' },
  { value: 'regulatory', label: 'Regulatory/Municipal' },
  { value: 'printing', label: 'Printing/Plotting' },
  { value: 'other', label: 'Other' },
] as const;

const ARCHITECTURAL_STAGES: DesignStage[] = [
  'arch-brief',
  'arch-schematic',
  'arch-development',
  'arch-construction-docs',
  'arch-approved',
];

export function ArchitecturalPricingTab({
  item,
  projectId: _projectId,
  userId: _userId,
  onUpdate,
  readOnly = false,
}: ArchitecturalPricingTabProps) {
  // projectId and userId are available via props for future use (e.g., audit logging)
  void _projectId;
  void _userId;
  const pricing = item.architectural;
  const [showTimeEntryForm, setShowTimeEntryForm] = useState(false);
  const [showFixedCostForm, setShowFixedCostForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Time entry form state
  const [timeDate, setTimeDate] = useState(new Date().toISOString().split('T')[0]);
  const [timeHours, setTimeHours] = useState('');
  const [timeDescription, setTimeDescription] = useState('');
  const [timeStaffMember, setTimeStaffMember] = useState('');
  const [timeStage, setTimeStage] = useState<DesignStage>(item.currentStage);

  // Fixed cost form state
  const [costCategory, setCostCategory] = useState<ArchitecturalFixedCost['category']>('site-visit');
  const [costDescription, setCostDescription] = useState('');
  const [costAmount, setCostAmount] = useState('');
  const [costVendor, setCostVendor] = useState('');
  const [costInvoiceRef, setCostInvoiceRef] = useState('');

  if (!pricing) {
    return (
      <div className="p-6 text-center text-gray-500">
        Pricing data not available for this item.
      </div>
    );
  }

  const handleAddTimeEntry = async () => {
    if (!timeHours || parseFloat(timeHours) <= 0) return;

    setSaving(true);
    try {
      const newEntry: ArchitecturalTimeEntry = {
        id: `time-${Date.now()}`,
        discipline: pricing.discipline,
        date: { seconds: new Date(timeDate).getTime() / 1000, nanoseconds: 0 } as any,
        hours: parseFloat(timeHours),
        rate: pricing.hourlyRate,
        description: timeDescription,
        staffMember: timeStaffMember || undefined,
        stage: timeStage,
      };

      const updatedEntries = [...(pricing.timeEntries || []), newEntry];
      const totalHours = updatedEntries.reduce((sum, e) => sum + e.hours, 0);
      const totalLaborCost = updatedEntries.reduce((sum, e) => sum + (e.hours * e.rate), 0);
      const totalCost = totalLaborCost + (pricing.totalFixedCosts || 0);

      await onUpdate({
        timeEntries: updatedEntries,
        totalHours,
        totalLaborCost,
        totalCost,
      });

      // Reset form
      setTimeHours('');
      setTimeDescription('');
      setTimeStaffMember('');
      setShowTimeEntryForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTimeEntry = async (entryId: string) => {
    setSaving(true);
    try {
      const updatedEntries = (pricing.timeEntries || []).filter(e => e.id !== entryId);
      const totalHours = updatedEntries.reduce((sum, e) => sum + e.hours, 0);
      const totalLaborCost = updatedEntries.reduce((sum, e) => sum + (e.hours * e.rate), 0);
      const totalCost = totalLaborCost + (pricing.totalFixedCosts || 0);

      await onUpdate({
        timeEntries: updatedEntries,
        totalHours,
        totalLaborCost,
        totalCost,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddFixedCost = async () => {
    if (!costAmount || parseFloat(costAmount) <= 0 || !costDescription) return;

    setSaving(true);
    try {
      const newCost: ArchitecturalFixedCost = {
        id: `cost-${Date.now()}`,
        category: costCategory,
        description: costDescription,
        amount: parseFloat(costAmount),
        currency: pricing.currency || 'ZAR',
        vendor: costVendor || undefined,
        invoiceRef: costInvoiceRef || undefined,
        date: { seconds: Date.now() / 1000, nanoseconds: 0 } as any,
      };

      const updatedCosts = [...(pricing.fixedCosts || []), newCost];
      const totalFixedCosts = updatedCosts.reduce((sum, c) => sum + c.amount, 0);
      const totalCost = (pricing.totalLaborCost || 0) + totalFixedCosts;

      await onUpdate({
        fixedCosts: updatedCosts,
        totalFixedCosts,
        totalCost,
      });

      // Reset form
      setCostDescription('');
      setCostAmount('');
      setCostVendor('');
      setCostInvoiceRef('');
      setShowFixedCostForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFixedCost = async (costId: string) => {
    setSaving(true);
    try {
      const updatedCosts = (pricing.fixedCosts || []).filter(c => c.id !== costId);
      const totalFixedCosts = updatedCosts.reduce((sum, c) => sum + c.amount, 0);
      const totalCost = (pricing.totalLaborCost || 0) + totalFixedCosts;

      await onUpdate({
        fixedCosts: updatedCosts,
        totalFixedCosts,
        totalCost,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateHourlyRate = async (newRate: number) => {
    setSaving(true);
    try {
      // Recalculate labor cost with new rate for future entries
      await onUpdate({
        hourlyRate: newRate,
      });
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    return date.toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Pricing Summary</h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Discipline</p>
            <p className="text-sm font-medium text-gray-900">{DISCIPLINE_LABELS[pricing.discipline]}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Hourly Rate</p>
            <p className="text-sm font-medium text-gray-900">{formatCurrency(pricing.hourlyRate)}/hr</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total Hours</p>
            <p className="text-sm font-medium text-gray-900">{pricing.totalHours?.toFixed(1) || '0.0'} hrs</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Revisions</p>
            <p className="text-sm font-medium text-gray-900">{pricing.revisionCount || 0}</p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-blue-200">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Labor Cost</span>
            <span className="text-sm font-medium">{formatCurrency(pricing.totalLaborCost || 0)}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Fixed Costs</span>
            <span className="text-sm font-medium">{formatCurrency(pricing.totalFixedCosts || 0)}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-blue-200">
            <span className="text-base font-semibold text-gray-900">Total Cost</span>
            <span className="text-xl font-bold text-blue-600">{formatCurrency(pricing.totalCost || 0)}</span>
          </div>
        </div>
      </div>

      {/* Hourly Rate Setting */}
      {!readOnly && (
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Hourly Rate</h4>
              <p className="text-xs text-gray-500">
                Default rate for {DISCIPLINE_LABELS[pricing.discipline]}: {formatCurrency(DEFAULT_DISCIPLINE_RATES[pricing.discipline])}/hr
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">R</span>
              <input
                type="number"
                value={pricing.hourlyRate}
                onChange={(e) => handleUpdateHourlyRate(parseFloat(e.target.value) || 0)}
                className="w-24 px-2 py-1 text-right border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                min="0"
                step="50"
              />
              <span className="text-sm text-gray-500">/hr</span>
            </div>
          </div>
        </div>
      )}

      {/* Time Entries Section */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400" />
            <h4 className="text-sm font-semibold text-gray-900">Time Entries</h4>
            <span className="text-xs text-gray-500">({pricing.timeEntries?.length || 0})</span>
          </div>
          {!readOnly && (
            <button
              onClick={() => setShowTimeEntryForm(!showTimeEntryForm)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Add Time
            </button>
          )}
        </div>

        {/* Time Entry Form */}
        {showTimeEntryForm && (
          <div className="p-4 bg-gray-50 border-b border-gray-200 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                <input
                  type="date"
                  value={timeDate}
                  onChange={(e) => setTimeDate(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Hours</label>
                <input
                  type="number"
                  value={timeHours}
                  onChange={(e) => setTimeHours(e.target.value)}
                  placeholder="0.0"
                  step="0.5"
                  min="0"
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Stage</label>
                <select
                  value={timeStage}
                  onChange={(e) => setTimeStage(e.target.value as DesignStage)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                >
                  {ARCHITECTURAL_STAGES.map(stage => (
                    <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Staff (optional)</label>
                <input
                  type="text"
                  value={timeStaffMember}
                  onChange={(e) => setTimeStaffMember(e.target.value)}
                  placeholder="Name"
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <input
                type="text"
                value={timeDescription}
                onChange={(e) => setTimeDescription(e.target.value)}
                placeholder="What was done?"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowTimeEntryForm(false)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTimeEntry}
                disabled={saving || !timeHours}
                className={cn(
                  'px-3 py-1.5 text-sm text-white rounded',
                  saving || !timeHours ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
                )}
              >
                {saving ? 'Adding...' : 'Add Entry'}
              </button>
            </div>
          </div>
        )}

        {/* Time Entries List */}
        <div className="divide-y divide-gray-100">
          {(!pricing.timeEntries || pricing.timeEntries.length === 0) ? (
            <div className="p-6 text-center text-sm text-gray-500">
              No time entries yet. Add time to track work on this drawing.
            </div>
          ) : (
            pricing.timeEntries.map((entry) => (
              <div key={entry.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{entry.hours}h</span>
                    <span className="text-xs text-gray-500">@ {formatCurrency(entry.rate)}/hr</span>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">{STAGE_LABELS[entry.stage]}</span>
                  </div>
                  <p className="text-sm text-gray-600">{entry.description || 'No description'}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                    <span>{formatDate(entry.date)}</span>
                    {entry.staffMember && <span>- {entry.staffMember}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900">
                    {formatCurrency(entry.hours * entry.rate)}
                  </span>
                  {!readOnly && (
                    <button
                      onClick={() => handleDeleteTimeEntry(entry.id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Fixed Costs Section */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-gray-400" />
            <h4 className="text-sm font-semibold text-gray-900">Fixed Costs</h4>
            <span className="text-xs text-gray-500">({pricing.fixedCosts?.length || 0})</span>
          </div>
          {!readOnly && (
            <button
              onClick={() => setShowFixedCostForm(!showFixedCostForm)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Add Cost
            </button>
          )}
        </div>

        {/* Fixed Cost Form */}
        {showFixedCostForm && (
          <div className="p-4 bg-gray-50 border-b border-gray-200 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                <select
                  value={costCategory}
                  onChange={(e) => setCostCategory(e.target.value as ArchitecturalFixedCost['category'])}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                >
                  {FIXED_COST_CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Amount (R)</label>
                <input
                  type="number"
                  value={costAmount}
                  onChange={(e) => setCostAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="100"
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Vendor (optional)</label>
                <input
                  type="text"
                  value={costVendor}
                  onChange={(e) => setCostVendor(e.target.value)}
                  placeholder="Company name"
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <input
                  type="text"
                  value={costDescription}
                  onChange={(e) => setCostDescription(e.target.value)}
                  placeholder="What is this cost for?"
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Invoice Ref (optional)</label>
                <input
                  type="text"
                  value={costInvoiceRef}
                  onChange={(e) => setCostInvoiceRef(e.target.value)}
                  placeholder="INV-001"
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowFixedCostForm(false)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFixedCost}
                disabled={saving || !costAmount || !costDescription}
                className={cn(
                  'px-3 py-1.5 text-sm text-white rounded',
                  saving || !costAmount || !costDescription ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
                )}
              >
                {saving ? 'Adding...' : 'Add Cost'}
              </button>
            </div>
          </div>
        )}

        {/* Fixed Costs List */}
        <div className="divide-y divide-gray-100">
          {(!pricing.fixedCosts || pricing.fixedCosts.length === 0) ? (
            <div className="p-6 text-center text-sm text-gray-500">
              No fixed costs yet. Add project costs like site visits, surveys, and consultant fees.
            </div>
          ) : (
            pricing.fixedCosts.map((cost) => (
              <div key={cost.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 bg-gray-100 rounded capitalize">
                      {cost.category.replace('-', ' ')}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{cost.description}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                    {cost.vendor && <span>{cost.vendor}</span>}
                    {cost.invoiceRef && <span>- Ref: {cost.invoiceRef}</span>}
                    {cost.date && <span>- {formatDate(cost.date)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900">
                    {formatCurrency(cost.amount)}
                  </span>
                  {!readOnly && (
                    <button
                      onClick={() => handleDeleteFixedCost(cost.id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default ArchitecturalPricingTab;
