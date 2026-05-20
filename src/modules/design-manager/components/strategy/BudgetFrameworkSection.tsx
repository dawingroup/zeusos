/**
 * Budget Framework Section Component
 * Tier selection and priority ranking
 */

import { useState } from 'react';
import { Plus, X, GripVertical } from 'lucide-react';

interface BudgetFrameworkSectionProps {
  budget: {
    tier: 'economy' | 'standard' | 'premium' | 'luxury';
    priorities: string[];
  };
  onUpdate: (budget: BudgetFrameworkSectionProps['budget']) => void;
}

const TIERS = [
  { value: 'economy', label: 'Economy', description: 'Cost-focused, standard finishes' },
  { value: 'standard', label: 'Standard', description: 'Balanced quality and value' },
  { value: 'premium', label: 'Premium', description: 'High-quality materials and finishes' },
  { value: 'luxury', label: 'Luxury', description: 'Top-tier, bespoke everything' },
];

export function BudgetFrameworkSection({ budget, onUpdate }: BudgetFrameworkSectionProps) {
  // Safety check: provide default values if undefined
  const safeBudget = budget || { tier: 'standard' as const, priorities: [] };

  const [newPriority, setNewPriority] = useState('');

  const addPriority = () => {
    if (!newPriority.trim()) return;
    onUpdate({ ...safeBudget,priorities: [...safeBudget.priorities, newPriority.trim()] });
    setNewPriority('');
  };

  const removePriority = (index: number) => {
    onUpdate({ ...safeBudget,priorities: safeBudget.priorities.filter((_, i) => i !== index) });
  };

  const movePriority = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= safeBudget.priorities.length) return;
    const newPriorities = [...safeBudget.priorities];
    const [removed] = newPriorities.splice(fromIndex, 1);
    newPriorities.splice(toIndex, 0, removed);
    onUpdate({ ...safeBudget,priorities: newPriorities });
  };

  return (
    <div className="space-y-4">
      {/* Tier Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Budget Tier</label>
        <div className="grid grid-cols-2 gap-2">
          {TIERS.map((tier) => (
            <button
              key={tier.value}
              onClick={() => onUpdate({ ...safeBudget,tier: tier.value as any })}
              className={`p-3 rounded-lg border-2 text-left transition-all ${
                safeBudget.tier === tier.value
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className={`font-medium ${safeBudget.tier === tier.value ? 'text-green-700' : 'text-gray-900'}`}>
                {tier.label}
              </p>
              <p className="text-xs text-gray-500">{tier.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Priority Ranking */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Priorities (drag to reorder)
        </label>
        <div className="space-y-2 mb-2">
          {safeBudget.priorities.map((priority, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg group"
            >
              <div className="flex flex-col">
                <button
                  onClick={() => movePriority(index, index - 1)}
                  disabled={index === 0}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                >
                  <GripVertical className="w-4 h-4 rotate-180" />
                </button>
                <button
                  onClick={() => movePriority(index, index + 1)}
                  disabled={index === safeBudget.priorities.length - 1}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                >
                  <GripVertical className="w-4 h-4" />
                </button>
              </div>
              <span className="w-6 h-6 flex items-center justify-center bg-green-100 text-green-700 rounded-full text-xs font-medium">
                {index + 1}
              </span>
              <span className="flex-1 text-sm text-gray-700">{priority}</span>
              <button
                onClick={() => removePriority(index)}
                className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPriority()}
            placeholder="Add a priority..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <button
            onClick={addPriority}
            className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
