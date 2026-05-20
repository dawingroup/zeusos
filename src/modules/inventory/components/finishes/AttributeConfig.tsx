/**
 * AttributeConfig Component
 * Dynamic attribute configuration for a product's finish category.
 * Shows available attributes as a checklist, with constraint editors
 * for checked attributes.
 */

import { Loader2 } from 'lucide-react';
import type { FinishCategory } from '../../types';
import { useFinishAttributes } from '../../hooks/useFinishAttributes';

interface AttributeConfigProps {
  organizationId: string;
  category: FinishCategory;
  requiredAttributes: string[];
  attributeConstraints: Record<string, (string | number | boolean)[]>;
  onRequiredChange: (requiredAttributes: string[]) => void;
  onConstraintsChange: (constraints: Record<string, (string | number | boolean)[]>) => void;
}

export function AttributeConfig({
  organizationId,
  category,
  requiredAttributes,
  attributeConstraints,
  onRequiredChange,
  onConstraintsChange,
}: AttributeConfigProps) {
  const { attributes, loading } = useFinishAttributes(organizationId, category);

  const handleToggleRequired = (key: string) => {
    if (requiredAttributes.includes(key)) {
      onRequiredChange(requiredAttributes.filter(k => k !== key));
      // Also remove constraints for unchecked attributes
      const newConstraints = { ...attributeConstraints };
      delete newConstraints[key];
      onConstraintsChange(newConstraints);
    } else {
      onRequiredChange([...requiredAttributes, key]);
    }
  };

  const handleConstraintChange = (key: string, values: (string | number | boolean)[]) => {
    if (values.length === 0) {
      const newConstraints = { ...attributeConstraints };
      delete newConstraints[key];
      onConstraintsChange(newConstraints);
    } else {
      onConstraintsChange({ ...attributeConstraints, [key]: values });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading attributes...
      </div>
    );
  }

  if (attributes.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-4">
        No attribute definitions found for this category. Seed default attributes from the Finish Library page.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700">
        Required Attributes
        <span className="font-normal text-gray-500 ml-1">
          (check which dimensions define a unique variant)
        </span>
      </p>

      <div className="space-y-2">
        {attributes.map(attr => {
          const isRequired = requiredAttributes.includes(attr.key);
          const constraints = attributeConstraints[attr.key] || [];

          return (
            <div key={attr.key} className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center gap-3">
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={isRequired}
                  onChange={() => handleToggleRequired(attr.key)}
                  className="w-4 h-4 text-blue-600 rounded"
                  id={`attr-${attr.key}`}
                />
                <label htmlFor={`attr-${attr.key}`} className="flex-1 cursor-pointer">
                  <span className="text-sm font-medium text-gray-900">{attr.label}</span>
                  <span className="text-xs text-gray-400 ml-2 font-mono">{attr.key}</span>
                  {attr.unit && <span className="text-xs text-gray-400 ml-1">({attr.unit})</span>}
                  {attr.required && <span className="text-xs text-amber-600 ml-2">category-required</span>}
                </label>
                <span className="text-xs text-gray-400 capitalize">{attr.type}</span>
              </div>

              {/* Constraint editor — only shown for checked attributes with enum values */}
              {isRequired && attr.type === 'enum' && attr.enumValues && (
                <div className="mt-2 pl-7">
                  <p className="text-xs text-gray-500 mb-1">
                    Constrain allowed values (leave empty for all):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {attr.enumValues.map(val => {
                      const isSelected = constraints.includes(val);
                      return (
                        <button
                          key={String(val)}
                          type="button"
                          onClick={() => {
                            const newValues = isSelected
                              ? constraints.filter(v => v !== val)
                              : [...constraints, val];
                            handleConstraintChange(attr.key, newValues);
                          }}
                          className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                            isSelected
                              ? 'bg-blue-100 border-blue-300 text-blue-700'
                              : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {String(val)}
                        </button>
                      );
                    })}
                  </div>
                  {constraints.length > 0 && (
                    <p className="text-xs text-blue-600 mt-1">
                      Constrained to: {constraints.join(', ')}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
