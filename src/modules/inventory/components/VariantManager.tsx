/**
 * VariantManager Component
 * Manage material variants for an inventory item
 * Enhanced with category-aware attribute dropdown and type-specific value inputs
 */

import { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Loader2,
  GitBranch,
  Package,
  X,
} from 'lucide-react';
import { useVariants } from '../hooks/useVariants';
import { useVariantAttributeOptions } from '../hooks/useVariantAttributeOptions';
import { generateSku } from '../services/inventoryService';
import type { InventoryItem, InventoryItemFormData, VariantAttribute } from '../types';
import { INVENTORY_UNITS } from '../types';
import type { VariantAttributeOption } from '../utils/variantAttributeUtils';

interface VariantManagerProps {
  parentItemId: string;
  parentItem: InventoryItem;
  userId: string;
  onVariantClick?: (variant: InventoryItem) => void;
}

export function VariantManager({
  parentItemId,
  parentItem,
  userId,
  onVariantClick,
}: VariantManagerProps) {
  const { variants, loading, error, addVariant, deleteVariant } = useVariants(parentItemId, userId);
  const { attributeOptions, loading: attrLoading } = useVariantAttributeOptions(parentItem);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [attributes, setAttributes] = useState<(VariantAttribute & { customKey?: string })[]>([{ key: 'color', value: '' }]);
  const [variantName, setVariantName] = useState('');
  const [skuSuffix, setSkuSuffix] = useState('');
  const [costOverride, setCostOverride] = useState<number | ''>('');

  // Build a lookup map for attribute options
  const attrOptionMap = useMemo(() => {
    const map: Record<string, VariantAttributeOption> = {};
    for (const opt of attributeOptions) {
      map[opt.key] = opt;
    }
    return map;
  }, [attributeOptions]);

  // Group options for the dropdown
  const groupedOptions = useMemo(() => {
    const category = attributeOptions.filter(o => o.source === 'category');
    const common = attributeOptions.filter(o => o.source === 'common');
    const custom = attributeOptions.filter(o => o.source === 'custom');
    return { category, common, custom };
  }, [attributeOptions]);

  const resetForm = () => {
    setAttributes([{ key: 'color', value: '' }]);
    setVariantName('');
    setSkuSuffix('');
    setCostOverride('');
    setFormError(null);
    setShowAddForm(false);
  };

  const handleAddAttribute = () => {
    setAttributes([...attributes, { key: 'color', value: '' }]);
  };

  const handleRemoveAttribute = (index: number) => {
    if (attributes.length <= 1) return;
    setAttributes(attributes.filter((_, i) => i !== index));
  };

  const handleAttributeChange = (index: number, field: 'key' | 'value' | 'customKey', val: string) => {
    const updated = [...attributes];
    if (field === 'customKey') {
      updated[index] = { ...updated[index], customKey: val, key: '__custom__' };
    } else {
      updated[index] = { ...updated[index], [field]: val };
      // Reset value when key changes (different type may apply)
      if (field === 'key') {
        updated[index].value = '';
        updated[index].customKey = undefined;
      }
    }
    setAttributes(updated);
  };

  const handleSubmit = async () => {
    // Resolve custom keys and validate
    const validAttributes: VariantAttribute[] = attributes
      .map((a) => ({
        key: a.key === '__custom__' ? (a.customKey?.trim() || '') : a.key,
        value: a.value.trim(),
      }))
      .filter(a => a.key && a.value);

    if (validAttributes.length === 0) {
      setFormError('At least one variant attribute with a value is required');
      return;
    }

    const name = variantName.trim() || `${parentItem.name} - ${validAttributes.map(a => a.value).join(' / ')}`;
    const sku = skuSuffix.trim()
      ? `${parentItem.sku}-${skuSuffix.trim()}`
      : generateSku(name, parentItem.category);

    setSaving(true);
    setFormError(null);

    try {
      const formData: InventoryItemFormData = {
        sku,
        name,
        brand: parentItem.brand,
        classification: parentItem.classification,
        category: parentItem.category,
        subcategory: parentItem.subcategory,
        tags: [...(parentItem.tags || []), 'variant'],
        dimensions: parentItem.dimensions,
        grainPattern: parentItem.grainPattern,
        pricing: {
          costPerUnit: typeof costOverride === 'number' ? costOverride : parentItem.pricing.costPerUnit,
          currency: parentItem.pricing.currency,
          unit: parentItem.pricing.unit,
        },
        status: 'active',
        parentItemId,
        variantAttributes: validAttributes,
      };

      await addVariant(formData);
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create variant');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVariant = async (variantId: string) => {
    if (!confirm('Are you sure you want to remove this variant?')) return;
    try {
      await deleteVariant(variantId);
    } catch (err) {
      console.error('Failed to delete variant:', err);
    }
  };

  const formatCurrency = (amount: number, curr: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  /**
   * Render the value input based on the attribute type.
   */
  const renderValueInput = (attr: VariantAttribute & { customKey?: string }, index: number) => {
    const option = attrOptionMap[attr.key];

    // Custom attribute — show free-text key + value
    if (attr.key === '__custom__') {
      return (
        <div className="flex flex-1 items-center gap-1">
          <input
            type="text"
            value={attr.customKey || ''}
            onChange={(e) => handleAttributeChange(index, 'customKey', e.target.value)}
            className="w-28 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
            placeholder="Key name"
          />
          <span className="text-gray-400">=</span>
          <input
            type="text"
            value={attr.value}
            onChange={(e) => handleAttributeChange(index, 'value', e.target.value)}
            className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
            placeholder="Value"
          />
        </div>
      );
    }

    // Enum type — dropdown of allowed values
    if (option?.type === 'enum' && option.enumValues && option.enumValues.length > 0) {
      return (
        <select
          value={attr.value}
          onChange={(e) => handleAttributeChange(index, 'value', e.target.value)}
          className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
        >
          <option value="">Select {option.label}...</option>
          {option.enumValues.map((v) => (
            <option key={String(v)} value={String(v)}>
              {String(v).replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      );
    }

    // Boolean type — checkbox
    if (option?.type === 'boolean') {
      return (
        <label className="flex-1 flex items-center gap-2 px-2 py-1.5">
          <input
            type="checkbox"
            checked={attr.value === 'true'}
            onChange={(e) => handleAttributeChange(index, 'value', e.target.checked ? 'true' : 'false')}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-sm text-gray-700">{option.label}</span>
        </label>
      );
    }

    // Number type — number input
    if (option?.type === 'number') {
      return (
        <div className="flex-1 flex items-center gap-1">
          <input
            type="number"
            value={attr.value}
            onChange={(e) => handleAttributeChange(index, 'value', e.target.value)}
            className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
            placeholder={option.label}
          />
          {option.unit && (
            <span className="text-xs text-gray-500 whitespace-nowrap">{option.unit}</span>
          )}
        </div>
      );
    }

    // Default: free-text string input
    return (
      <input
        type="text"
        value={attr.value}
        onChange={(e) => handleAttributeChange(index, 'value', e.target.value)}
        className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
        placeholder={option?.label || 'Value'}
      />
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
            Material Variants
          </h3>
          <span className="text-xs text-gray-500">({variants.length})</span>
        </div>
        {!showAddForm && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Variant
          </button>
        )}
      </div>

      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {error.message}
        </div>
      )}

      {/* Add Variant Form */}
      {showAddForm && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
          <h4 className="text-xs font-medium text-gray-700">New Variant of: {parentItem.name}</h4>

          {formError && (
            <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {formError}
            </div>
          )}

          {/* Variant Attributes */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700">
              Variant Attributes *
            </label>
            {attrLoading && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading attribute options...
              </div>
            )}
            {attributes.map((attr, index) => (
              <div key={index} className="flex items-center gap-2">
                <select
                  value={attr.key}
                  onChange={(e) => handleAttributeChange(index, 'key', e.target.value)}
                  className="w-40 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                >
                  {groupedOptions.category.length > 0 && (
                    <optgroup label={`${parentItem.category || 'Category'} Attributes`}>
                      {groupedOptions.category.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Common Attributes">
                    {groupedOptions.common.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.label}
                      </option>
                    ))}
                  </optgroup>
                  {groupedOptions.custom.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {renderValueInput(attr, index)}

                {attributes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveAttribute(index)}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddAttribute}
              className="text-xs text-primary hover:underline"
            >
              + Add another attribute
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Variant Name (auto-generated if blank)
              </label>
              <input
                type="text"
                value={variantName}
                onChange={(e) => setVariantName(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                placeholder={`e.g., ${parentItem.name} - White`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                SKU Suffix (auto-generated if blank)
              </label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">{parentItem.sku}-</span>
                <input
                  type="text"
                  value={skuSuffix}
                  onChange={(e) => setSkuSuffix(e.target.value)}
                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                  placeholder="WHT"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Price Override (leave blank to inherit {formatCurrency(parentItem.pricing.costPerUnit, parentItem.pricing.currency)}/{INVENTORY_UNITS[parentItem.pricing.unit]})
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={costOverride}
              onChange={(e) => setCostOverride(e.target.value ? parseFloat(e.target.value) : '')}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
              placeholder="Same as parent"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              Create Variant
            </button>
          </div>
        </div>
      )}

      {/* Variant List */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        </div>
      ) : variants.length === 0 && !showAddForm ? (
        <div className="p-4 text-center text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-300 rounded-lg">
          <GitBranch className="w-6 h-6 text-gray-300 mx-auto mb-1" />
          No variants yet. Click "Add Variant" to create variations of this material.
        </div>
      ) : (
        <div className="space-y-2">
          {variants.map((variant) => (
            <div
              key={variant.id}
              className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 cursor-pointer"
              onClick={() => onVariantClick?.(variant)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Package className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium text-sm text-gray-900 truncate">
                    {variant.displayName || variant.name}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 flex-wrap">
                    <span className="font-mono">{variant.sku}</span>
                    {variant.variantAttributes?.map((attr, i) => (
                      <span key={i} className="inline-flex items-center px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs">
                        {attr.key}: {attr.value}
                      </span>
                    ))}
                    <span>
                      {formatCurrency(variant.pricing.costPerUnit, variant.pricing.currency)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteVariant(variant.id);
                }}
                className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                title="Remove variant"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default VariantManager;
