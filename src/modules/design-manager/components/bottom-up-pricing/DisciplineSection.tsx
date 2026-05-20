/**
 * Discipline Section
 * Displays a discipline with its deliverables and allows CRUD on deliverables.
 */

import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type {
  PricingDisciplineEntry,
  PricingDeliverable,
  PricingDesignStage,
  StaffRole,
  BottomUpPricingConfig,
} from '../../types/bottomUpPricing';
import {
  PRICING_DISCIPLINE_LABELS,
  PRICING_DESIGN_STAGE_LABELS,
  STAFF_ROLE_LABELS,
  SUGGESTED_DELIVERABLES,
} from '../../types/bottomUpPricing';
import { getRateForRole } from '../../services/bottomUpPricingService';

interface DisciplineSectionProps {
  entry: PricingDisciplineEntry;
  config: BottomUpPricingConfig;
  disciplineTotalCost: number;
  disciplineTotalHours: number;
  onAddDeliverable: (disciplineId: string, name: string) => void;
  onUpdateDeliverable: (disciplineId: string, deliverableId: string, updates: Partial<PricingDeliverable>) => void;
  onRemoveDeliverable: (disciplineId: string, deliverableId: string) => void;
  onRemoveDiscipline: (disciplineId: string) => void;
}

const STAGE_OPTIONS: PricingDesignStage[] = ['concept', 'schematic', 'design-development', 'construction-docs'];
const ROLE_OPTIONS: StaffRole[] = ['principal', 'senior-engineer', 'mid-level-architect', 'junior-drafter'];

export function DisciplineSection({
  entry,
  config,
  disciplineTotalCost,
  disciplineTotalHours,
  onAddDeliverable,
  onUpdateDeliverable,
  onRemoveDeliverable,
  onRemoveDiscipline,
}: DisciplineSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [newDeliverableName, setNewDeliverableName] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = SUGGESTED_DELIVERABLES[entry.discipline];
  const existingNames = new Set(entry.deliverables.map((d) => d.name));
  const filteredSuggestions = suggestions.filter((s) => !existingNames.has(s));

  const handleAddDeliverable = () => {
    if (!newDeliverableName.trim()) return;
    onAddDeliverable(entry.id, newDeliverableName.trim());
    setNewDeliverableName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAddDeliverable();
  };

  const formatCurrency = (val: number) =>
    `UGX ${val.toLocaleString('en-UG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          <h3 className="text-sm font-semibold text-gray-900">
            {PRICING_DISCIPLINE_LABELS[entry.discipline]}
          </h3>
          <span className="text-xs text-gray-500">
            {entry.deliverables.length} deliverable{entry.deliverables.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500">{disciplineTotalHours.toFixed(1)} hrs</span>
          <span className="text-sm font-semibold text-gray-900">{formatCurrency(disciplineTotalCost)}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onRemoveDiscipline(entry.id); }}
            className="p-1 text-gray-400 hover:text-red-500"
            title="Remove discipline"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-3">
          {/* Deliverables Table */}
          {entry.deliverables.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                    <th className="pb-2 pr-2 font-medium">Deliverable</th>
                    <th className="pb-2 px-2 font-medium w-36">Role</th>
                    <th className="pb-2 px-2 font-medium w-40">Stage</th>
                    <th className="pb-2 px-2 font-medium w-20 text-right">Hours</th>
                    <th className="pb-2 px-2 font-medium w-20 text-right">Rate</th>
                    <th className="pb-2 px-2 font-medium w-24 text-right">Cost</th>
                    <th className="pb-2 pl-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {entry.deliverables.map((del) => {
                    const rate = getRateForRole(del.role, config);
                    const cost = del.estimatedHours * rate;
                    return (
                      <tr key={del.id} className="hover:bg-gray-50">
                        <td className="py-2 pr-2">
                          <input
                            type="text"
                            value={del.name}
                            onChange={(e) => onUpdateDeliverable(entry.id, del.id, { name: e.target.value })}
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <select
                            value={del.role}
                            onChange={(e) => onUpdateDeliverable(entry.id, del.id, { role: e.target.value as StaffRole })}
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500"
                          >
                            {ROLE_OPTIONS.map((r) => (
                              <option key={r} value={r}>{STAFF_ROLE_LABELS[r]}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-2">
                          <select
                            value={del.designStage}
                            onChange={(e) => onUpdateDeliverable(entry.id, del.id, { designStage: e.target.value as PricingDesignStage })}
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500"
                          >
                            {STAGE_OPTIONS.map((s) => (
                              <option key={s} value={s}>{PRICING_DESIGN_STAGE_LABELS[s]}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            value={del.estimatedHours || ''}
                            onChange={(e) => onUpdateDeliverable(entry.id, del.id, { estimatedHours: parseFloat(e.target.value) || 0 })}
                            min={0}
                            step={0.5}
                            placeholder="0"
                            className="w-full px-2 py-1 text-sm text-right border border-gray-200 rounded focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-2 px-2 text-right text-gray-500 text-xs">
                          UGX {rate.toLocaleString()}/hr
                        </td>
                        <td className="py-2 px-2 text-right font-medium">
                          {formatCurrency(cost)}
                        </td>
                        <td className="py-2 pl-2">
                          <button
                            onClick={() => onRemoveDeliverable(entry.id, del.id)}
                            className="p-1 text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Add Deliverable */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <div className="relative flex-1">
              <input
                type="text"
                value={newDeliverableName}
                onChange={(e) => { setNewDeliverableName(e.target.value); setShowSuggestions(true); }}
                onKeyDown={handleKeyDown}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="Add a deliverable (e.g., Floor Plans, Elevations...)"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              {showSuggestions && filteredSuggestions.length > 0 && newDeliverableName.length === 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredSuggestions.map((sug) => (
                    <button
                      key={sug}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onAddDeliverable(entry.id, sug);
                        setShowSuggestions(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 hover:text-blue-700"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleAddDeliverable}
              disabled={!newDeliverableName.trim()}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 text-sm rounded',
                newDeliverableName.trim()
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
