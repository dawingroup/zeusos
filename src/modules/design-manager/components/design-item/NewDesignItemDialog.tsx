/**
 * New Design Item Dialog
 * Dialog for creating a new design item
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { createDesignItem } from '../../services/firestore';
import type { DesignCategory, DesignItem, ArchitecturalDiscipline } from '../../types';
import { DISCIPLINE_LABELS, DEFAULT_DISCIPLINE_RATES } from '../../types';
import { CATEGORY_LABELS } from '../../utils/formatting';
import {
  CONSTRUCTION_CATEGORY_LABELS,
  createDefaultConstructionPricing,
  PRICING_METHOD_LABELS,
  type ConstructionCategory,
  type ConstructionPricingMethod,
} from '../../types/deliverables';

export interface NewDesignItemDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectCode: string;
  userId: string;
}

const categories: DesignCategory[] = ['casework', 'furniture', 'millwork', 'doors', 'fixtures', 'specialty', 'architectural'];
const priorities = ['low', 'medium', 'high', 'urgent'] as const;
const sourcingTypes: Array<DesignItem['sourcingType']> = ['MANUFACTURED', 'PROCURED', 'ARCHITECTURAL', 'CONSTRUCTION'];

const disciplines: ArchitecturalDiscipline[] = ['architectural', 'structural', 'mep', 'landscaping', 'furniture-millwork'];
const constructionCategories: ConstructionCategory[] = ['electrical', 'plumbing', 'tiling', 'painting', 'gypsum', 'fitout', 'hvac', 'flooring', 'ceiling', 'other'];

export function NewDesignItemDialog({
  open,
  onClose,
  projectId,
  projectCode,
  userId
}: NewDesignItemDialogProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<DesignCategory>('casework');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [sourcingType, setSourcingType] = useState<DesignItem['sourcingType']>('MANUFACTURED');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Architectural-specific fields (minimal - pricing is in detail page)
  const [discipline, setDiscipline] = useState<ArchitecturalDiscipline>('architectural');
  const [drawingNumber, setDrawingNumber] = useState('');

  // Construction-specific fields
  const [constructionCategory, setConstructionCategory] = useState<ConstructionCategory>('other');
  const [constructionPricingMethod, setConstructionPricingMethod] = useState<ConstructionPricingMethod>('measured');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Item name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Determine initial stage based on sourcing type
      const initialStage = (() => {
        switch (sourcingType) {
          case 'PROCURED':
            return 'procure-identify';
          case 'ARCHITECTURAL':
            return 'arch-brief';
          case 'CONSTRUCTION':
            return 'const-scope';
          default:
            return 'concept';
        }
      })();

      // Prepare minimal architectural data (pricing is managed in detail page)
      const architecturalData = sourcingType === 'ARCHITECTURAL'
        ? {
            discipline,
            ...(drawingNumber ? { drawingNumber } : {}),
            hourlyRate: DEFAULT_DISCIPLINE_RATES[discipline],
            timeEntries: [],
            totalHours: 0,
            totalLaborCost: 0,
            fixedCosts: [],
            totalFixedCosts: 0,
            totalCost: 0,
            currency: 'ZAR',
            revisionCount: 0,
          }
        : undefined;

      // Prepare construction data (pricing is managed in detail page)
      const constructionData = sourcingType === 'CONSTRUCTION'
        ? createDefaultConstructionPricing(constructionCategory, 'UGX', constructionPricingMethod)
        : undefined;

      await createDesignItem(projectId, {
        name: name.trim(),
        category: sourcingType === 'ARCHITECTURAL' ? 'architectural' : category,
        description: description.trim(),
        priority,
        projectCode,
        sourcingType,
        currentStage: initialStage,
        ...(dueDate ? { dueDate: { seconds: new Date(dueDate).getTime() / 1000, nanoseconds: 0 } } : {}),
        ...(architecturalData ? { architectural: architecturalData } : {}),
        ...(constructionData ? { construction: constructionData } : {}),
      } as any, userId);

      // Reset and close
      setName('');
      setCategory('casework');
      setDescription('');
      setPriority('medium');
      setSourcingType('MANUFACTURED');
      setDueDate('');
      setDiscipline('architectural');
      setDrawingNumber('');
      setConstructionCategory('other');
      setConstructionPricingMethod('measured');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create item');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl w-full mx-4 max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">New Design Item</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Item Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent"
              placeholder={sourcingType === 'ARCHITECTURAL' ? 'e.g., Ground Floor Plan' : 'e.g., Kitchen Island Unit'}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sourcing Type <span className="text-red-500">*</span>
            </label>
            <select
              value={sourcingType}
              onChange={(e) => setSourcingType(e.target.value as DesignItem['sourcingType'])}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent"
            >
              {sourcingTypes.map((st) => (
                <option key={st} value={st}>
                  {st === 'MANUFACTURED' ? 'Custom Furniture/Millwork' :
                   st === 'PROCURED' ? 'Procured Item' :
                   st === 'ARCHITECTURAL' ? 'Design Document' :
                   st === 'CONSTRUCTION' ? 'Construction Item' : st}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {sourcingType === 'MANUFACTURED'
                ? 'Item will be made in-house through design & production stages'
                : sourcingType === 'PROCURED'
                  ? 'Item will be sourced externally through procurement stages'
                  : sourcingType === 'ARCHITECTURAL'
                    ? 'Design document: Brief → Schematic → Development → Const. Docs → Approved'
                    : 'Construction work: Scope → Spec → Quote → Approve → In Progress → Inspection → Complete'}
            </p>
          </div>

          {/* Category - only for non-architectural items */}
          {sourcingType !== 'ARCHITECTURAL' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as DesignCategory)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent"
              >
                {categories.filter(cat => cat !== 'architectural').map((cat) => (
                  <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                ))}
              </select>
            </div>
          )}

          {/* Architectural Drawing Fields - simplified, no pricing */}
          {sourcingType === 'ARCHITECTURAL' && (
            <div className="space-y-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
              <h3 className="text-sm font-semibold text-indigo-900">Document Details</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Discipline <span className="text-red-500">*</span>
                </label>
                <select
                  value={discipline}
                  onChange={(e) => setDiscipline(e.target.value as ArchitecturalDiscipline)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent"
                >
                  {disciplines.map((d) => (
                    <option key={d} value={d}>{DISCIPLINE_LABELS[d]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Drawing Number
                </label>
                <input
                  type="text"
                  value={drawingNumber}
                  onChange={(e) => setDrawingNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent"
                  placeholder="e.g., A-101"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Optional. Can be assigned later.
                </p>
              </div>

              <p className="text-xs text-indigo-700 bg-indigo-100 p-2 rounded">
                Pricing, time tracking, and project costs are managed in the Pricing tab after creation.
              </p>
            </div>
          )}

          {/* Construction Item Fields */}
          {sourcingType === 'CONSTRUCTION' && (
            <div className="space-y-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
              <h3 className="text-sm font-semibold text-amber-900">Construction Details</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Construction Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={constructionCategory}
                  onChange={(e) => setConstructionCategory(e.target.value as ConstructionCategory)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent"
                >
                  {constructionCategories.map((cat) => (
                    <option key={cat} value={cat}>{CONSTRUCTION_CATEGORY_LABELS[cat]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pricing Method
                </label>
                <select
                  value={constructionPricingMethod}
                  onChange={(e) => setConstructionPricingMethod(e.target.value as ConstructionPricingMethod)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent"
                >
                  {(Object.entries(PRICING_METHOD_LABELS) as [ConstructionPricingMethod, string][]).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <p className="text-xs text-amber-700 bg-amber-100 p-2 rounded">
                Pricing, contractor info, and scope of work are managed in the Pricing tab after creation.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as typeof priority)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent"
            >
              {priorities.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">
              Optional target completion date for this item
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent resize-none"
              placeholder={sourcingType === 'ARCHITECTURAL'
                ? 'Brief description of the drawing scope...'
                : 'Brief description of the design item...'}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={cn(
                'px-4 py-2 text-sm font-medium text-white rounded-lg',
                loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-[#1d1d1f] hover:bg-[#424245]'
              )}
            >
              {loading ? 'Creating...' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NewDesignItemDialog;
