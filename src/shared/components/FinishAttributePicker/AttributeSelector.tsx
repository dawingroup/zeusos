/**
 * AttributeSelector Component
 * Dynamic attribute inputs driven by attribute definitions.
 * Respects attributeConstraints to limit selectable values.
 */

import type { AttributeDefinition } from '@/modules/inventory/types';

interface AttributeSelectorProps {
  attributes: AttributeDefinition[];
  values: Record<string, string | number | boolean>;
  constraints?: Record<string, (string | number | boolean)[]>;
  onChange: (key: string, value: string | number | boolean) => void;
}

export function AttributeSelector({
  attributes,
  values,
  constraints,
  onChange,
}: AttributeSelectorProps) {
  if (attributes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700">Select Attributes</p>

      <div className="grid grid-cols-2 gap-3">
        {attributes.map(attr => {
          const value = values[attr.key];
          const constrainedValues = constraints?.[attr.key];
          const effectiveEnumValues = constrainedValues && attr.enumValues
            ? attr.enumValues.filter(v => constrainedValues.includes(v))
            : attr.enumValues;

          return (
            <div key={attr.key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {attr.label}
                {attr.required && <span className="text-red-500 ml-0.5">*</span>}
                {attr.unit && <span className="text-gray-400 ml-1">({attr.unit})</span>}
              </label>

              {/* Enum type → Select */}
              {attr.type === 'enum' && effectiveEnumValues && (
                <select
                  value={value !== undefined ? String(value) : ''}
                  onChange={e => {
                    const val = e.target.value;
                    // Try to parse as number if the enum values are numeric
                    const numVal = Number(val);
                    onChange(attr.key, !isNaN(numVal) && val !== '' ? numVal : val);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  {effectiveEnumValues.map(ev => (
                    <option key={String(ev)} value={String(ev)}>{String(ev)}</option>
                  ))}
                </select>
              )}

              {/* Number type → Number input */}
              {attr.type === 'number' && (
                <input
                  type="number"
                  value={value !== undefined ? String(value) : ''}
                  onChange={e => onChange(attr.key, e.target.value ? Number(e.target.value) : '')}
                  min={attr.validationMin}
                  max={attr.validationMax}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder={attr.defaultValue !== undefined ? String(attr.defaultValue) : ''}
                />
              )}

              {/* Boolean type → Switch/Checkbox */}
              {attr.type === 'boolean' && (
                <div className="flex items-center gap-2 py-2">
                  <button
                    type="button"
                    onClick={() => onChange(attr.key, !(value ?? attr.defaultValue ?? false))}
                    className={`
                      relative w-10 h-5 rounded-full transition-colors
                      ${value ? 'bg-blue-600' : 'bg-gray-300'}
                    `}
                  >
                    <span className={`
                      absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform
                      ${value ? 'left-5' : 'left-0.5'}
                    `} />
                  </button>
                  <span className="text-sm text-gray-600">
                    {value ? 'Yes' : 'No'}
                  </span>
                </div>
              )}

              {/* String type → Text input */}
              {attr.type === 'string' && (
                <input
                  type="text"
                  value={value !== undefined ? String(value) : ''}
                  onChange={e => onChange(attr.key, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder={attr.defaultValue !== undefined ? String(attr.defaultValue) : ''}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
