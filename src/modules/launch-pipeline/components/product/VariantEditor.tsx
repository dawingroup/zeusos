/**
 * VariantEditor
 * UI for managing product variants with option-based generation
 */

import { useState } from 'react';
import { Plus, Trash2, Package } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import type { ProductVariant } from '../../types/product.types';

interface VariantEditorProps {
  variants: ProductVariant[];
  onChange: (variants: ProductVariant[]) => void;
  basePrice?: number;
}

interface ProductOption {
  name: string;
  values: string[];
}

function generateId() {
  return `var_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function VariantEditor({ variants, onChange, basePrice = 0 }: VariantEditorProps) {
  const [options, setOptions] = useState<ProductOption[]>(() => {
    // Infer options from existing variants
    if (variants.length === 0) return [];
    const optionNames = new Set<string>();
    variants.forEach(v => {
      Object.keys(v.options || {}).forEach(k => optionNames.add(k));
    });
    return Array.from(optionNames).map(name => ({
      name,
      values: [...new Set(variants.map(v => v.options[name]).filter(Boolean))],
    }));
  });

  const [newOptionName, setNewOptionName] = useState('');
  const [newOptionValues, setNewOptionValues] = useState('');

  const addOption = () => {
    if (!newOptionName.trim() || !newOptionValues.trim()) return;
    const values = newOptionValues.split(',').map(v => v.trim()).filter(Boolean);
    if (values.length === 0) return;

    const updatedOptions = [...options, { name: newOptionName.trim(), values }];
    setOptions(updatedOptions);
    setNewOptionName('');
    setNewOptionValues('');

    // Auto-generate variants from option combinations
    generateVariants(updatedOptions);
  };

  const removeOption = (index: number) => {
    const updatedOptions = options.filter((_, i) => i !== index);
    setOptions(updatedOptions);
    if (updatedOptions.length === 0) {
      onChange([]);
    } else {
      generateVariants(updatedOptions);
    }
  };

  const generateVariants = (opts: ProductOption[]) => {
    if (opts.length === 0) {
      onChange([]);
      return;
    }

    // Generate cartesian product of all option values
    const combinations = opts.reduce<Record<string, string>[]>(
      (acc, option) => {
        if (acc.length === 0) {
          return option.values.map(v => ({ [option.name]: v }));
        }
        return acc.flatMap(combo =>
          option.values.map(v => ({ ...combo, [option.name]: v }))
        );
      },
      []
    );

    // Preserve existing variant data where possible
    const newVariants: ProductVariant[] = combinations.map(combo => {
      const title = Object.values(combo).join(' / ');
      const existing = variants.find(v => v.title === title);
      return {
        id: existing?.id || generateId(),
        title,
        sku: existing?.sku || '',
        price: existing?.price || basePrice,
        compareAtPrice: existing?.compareAtPrice,
        inventoryQuantity: existing?.inventoryQuantity || 0,
        weight: existing?.weight,
        weightUnit: existing?.weightUnit,
        options: combo,
        imageUrl: existing?.imageUrl,
      };
    });

    onChange(newVariants);
  };

  const updateVariant = (index: number, fields: Partial<ProductVariant>) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], ...fields };
    onChange(updated);
  };

  const removeVariant = (index: number) => {
    onChange(variants.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Package className="w-4 h-4 text-gray-500" />
        <h4 className="text-sm font-medium text-gray-900">Variants</h4>
      </div>

      {/* Option Definitions */}
      <div className="space-y-2">
        {options.map((opt, idx) => (
          <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-sm">
            <span className="font-medium text-gray-700 min-w-[80px]">{opt.name}:</span>
            <div className="flex flex-wrap gap-1 flex-1">
              {opt.values.map((val, vi) => (
                <span key={vi} className="px-2 py-0.5 bg-white border rounded text-gray-600 text-xs">
                  {val}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => removeOption(idx)}
              className="p-1 text-red-500 hover:bg-red-50 rounded"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Add Option */}
      {options.length < 3 && (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Option Name</label>
            <input
              type="text"
              value={newOptionName}
              onChange={(e) => setNewOptionName(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="e.g., Size, Material"
            />
          </div>
          <div className="flex-[2]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Values (comma-separated)</label>
            <input
              type="text"
              value={newOptionValues}
              onChange={(e) => setNewOptionValues(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="e.g., Small, Medium, Large"
            />
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addOption} className="min-h-[34px]">
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add
          </Button>
        </div>
      )}

      {/* Variant Table */}
      {variants.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Variant</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Inventory</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {variants.map((variant, idx) => (
                  <tr key={variant.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900">{variant.title}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={variant.price || ''}
                        onChange={(e) => updateVariant(idx, { price: parseFloat(e.target.value) || 0 })}
                        className="w-24 px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/20"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={variant.sku}
                        onChange={(e) => updateVariant(idx, { sku: e.target.value })}
                        className="w-28 px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/20"
                        placeholder="SKU"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        value={variant.inventoryQuantity}
                        onChange={(e) => updateVariant(idx, { inventoryQuantity: parseInt(e.target.value) || 0 })}
                        className="w-20 px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/20"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => removeVariant(idx)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {variants.length === 0 && options.length === 0 && (
        <p className="text-sm text-gray-500">
          Add options (e.g., Size, Material) to generate variants, or the product will publish as a single variant.
        </p>
      )}
    </div>
  );
}

export default VariantEditor;
