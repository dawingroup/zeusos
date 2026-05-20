/**
 * FamilyForm
 * Create/edit an inventory family with variant attribute definitions
 * and a variant builder grid for generating child SKUs.
 */

import { useState } from 'react';
import { Plus, Trash2, Layers, Wand2, AlertCircle } from 'lucide-react';
import {
  createFamily,
  bulkGenerateSkus,
  generateVariantSku,
  generateVariantName,
} from '../services/inventoryService';
import type {
  FamilyFormData,
  InventoryCategory,
  InventoryClassification,
  InventoryUnit,
  VariantAttribute,
} from '../types';
import { COMMON_VARIANT_ATTRIBUTES } from '../types';
import { useCategories } from '../hooks/useCategories';

interface FamilyFormProps {
  onClose: () => void;
  onCreated?: (familyId: string) => void;
  userId: string;
  initialClassification?: InventoryClassification;
}

interface VariantRow {
  id: string;
  attributes: Record<string, string>;
  sku: string;
  name: string;
  costPerUnit: number;
}

export function FamilyForm({
  onClose,
  onCreated,
  userId,
  initialClassification,
}: FamilyFormProps) {
  const { selectableCategories } = useCategories();
  // Step tracking
  const [step, setStep] = useState<'family' | 'variants'>(
    'family',
  );

  // Family form state
  const [familyData, setFamilyData] = useState<Partial<FamilyFormData>>({
    name: '',
    classification: initialClassification || 'material',
    category: 'other',
    subcategory: '',
    description: '',
    variantAttributeDefinitions: [],
  });

  // Variant attribute definitions
  const [attrDefs, setAttrDefs] = useState<string[]>([]);
  const [newAttrDef, setNewAttrDef] = useState('');

  // Variant builder rows
  const [variantRows, setVariantRows] = useState<VariantRow[]>([]);

  // Bulk generation state
  const [bulkValues, setBulkValues] = useState<Record<string, string>>({});

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================
  // Step 1: Family Details
  // ============================================

  function addAttrDef() {
    const trimmed = newAttrDef.trim().toLowerCase();
    if (!trimmed || attrDefs.includes(trimmed)) return;
    setAttrDefs((prev) => [...prev, trimmed]);
    setNewAttrDef('');
  }

  function removeAttrDef(attr: string) {
    setAttrDefs((prev) => prev.filter((a) => a !== attr));
  }

  function proceedToVariants() {
    if (!familyData.name?.trim()) {
      setError('Family name is required');
      return;
    }
    if (attrDefs.length === 0) {
      setError('Add at least one variant attribute definition');
      return;
    }
    setError(null);
    setFamilyData((prev) => ({
      ...prev,
      variantAttributeDefinitions: attrDefs,
    }));
    setStep('variants');
  }

  // ============================================
  // Step 2: Variant Builder
  // ============================================

  function addVariantRow() {
    const attrs: Record<string, string> = {};
    attrDefs.forEach((a) => (attrs[a] = ''));
    setVariantRows((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        attributes: attrs,
        sku: '',
        name: '',
        costPerUnit: 0,
      },
    ]);
  }

  function updateVariantRow(
    rowId: string,
    field: string,
    value: string | number,
  ) {
    setVariantRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;

        const updated = { ...row };
        if (field === 'sku') {
          updated.sku = value as string;
        } else if (field === 'name') {
          updated.name = value as string;
        } else if (field === 'costPerUnit') {
          updated.costPerUnit = value as number;
        } else {
          // It's an attribute key
          updated.attributes = { ...updated.attributes, [field]: value as string };
          // Auto-generate SKU and name
          const variantAttrs: VariantAttribute[] = Object.entries(
            updated.attributes,
          ).map(([key, val]) => ({ key, value: val }));
          updated.sku = generateVariantSku(
            familyData.name || '',
            variantAttrs,
          );
          updated.name = generateVariantName(
            familyData.name || '',
            variantAttrs,
          );
        }
        return updated;
      }),
    );
  }

  function removeVariantRow(rowId: string) {
    setVariantRows((prev) => prev.filter((r) => r.id !== rowId));
  }

  /**
   * Bulk generation: parse comma-separated values per attribute
   * and generate all combinations.
   */
  function generateBulkVariants() {
    const valuesPerAttr: Record<string, string[]> = {};
    for (const attr of attrDefs) {
      const rawVal = bulkValues[attr] || '';
      const values = rawVal
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      if (values.length === 0) return;
      valuesPerAttr[attr] = values;
    }

    // Generate cartesian product
    const combinations = cartesianProduct(
      attrDefs.map((a) => valuesPerAttr[a] || ['']),
    );

    const newRows: VariantRow[] = combinations.map((combo) => {
      const attrs: Record<string, string> = {};
      attrDefs.forEach((a, i) => {
        attrs[a] = combo[i];
      });
      const variantAttrs: VariantAttribute[] = Object.entries(attrs).map(
        ([key, value]) => ({ key, value }),
      );
      return {
        id: crypto.randomUUID(),
        attributes: attrs,
        sku: generateVariantSku(familyData.name || '', variantAttrs),
        name: generateVariantName(familyData.name || '', variantAttrs),
        costPerUnit: 0,
      };
    });

    setVariantRows((prev) => [...prev, ...newRows]);
  }

  // ============================================
  // Save
  // ============================================

  async function handleSave() {
    if (variantRows.length === 0) {
      setError(
        'A family with no variants cannot be used in transactions. Add your first variant.',
      );
      return;
    }

    // Validate all rows have attribute values filled
    for (const row of variantRows) {
      const emptyAttrs = attrDefs.filter((a) => !row.attributes[a]?.trim());
      if (emptyAttrs.length > 0) {
        setError(
          `Variant "${row.name || '(unnamed)'}" is missing values for: ${emptyAttrs.join(', ')}`,
        );
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      // 1. Create family
      const familyId = await createFamily(
        {
          name: familyData.name || '',
          classification: familyData.classification || 'material',
          category: (familyData.category || 'other') as InventoryCategory,
          subcategory: familyData.subcategory,
          description: familyData.description,
          defaultUom: (familyData.defaultUom || 'ea') as InventoryUnit,
          variantAttributeDefinitions: attrDefs,
          supplierId: familyData.supplierId,
          supplierName: familyData.supplierName,
        },
        userId,
      );

      // 2. Create all variant SKUs
      const combinations = variantRows.map((row) => row.attributes);
      await bulkGenerateSkus(familyId, combinations, userId);

      onCreated?.(familyId);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create family',
      );
    } finally {
      setSaving(false);
    }
  }

  // ============================================
  // Render
  // ============================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Layers className="h-5 w-5 text-blue-500" />
        <h2 className="text-lg font-semibold text-gray-900">
          {step === 'family' ? 'New Inventory Family' : 'Add Variants'}
        </h2>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {step === 'family' && (
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Family Name *
            </label>
            <input
              type="text"
              value={familyData.name || ''}
              onChange={(e) =>
                setFamilyData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="e.g. Mahogany Timber, Executive Sofa"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Classification & Category row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Classification *
              </label>
              <select
                value={familyData.classification || 'material'}
                onChange={(e) =>
                  setFamilyData((prev) => ({
                    ...prev,
                    classification: e.target.value as InventoryClassification,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              >
                <option value="material">Raw Material</option>
                <option value="product">Finished Product</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category *
              </label>
              <select
                value={familyData.category || 'other'}
                onChange={(e) =>
                  setFamilyData((prev) => ({
                    ...prev,
                    category: e.target.value as InventoryCategory,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              >
                {selectableCategories.map((cat) => (
                    <option key={cat.slug} value={cat.slug}>
                      {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Subcategory & Description */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subcategory
              </label>
              <input
                type="text"
                value={familyData.subcategory || ''}
                onChange={(e) =>
                  setFamilyData((prev) => ({
                    ...prev,
                    subcategory: e.target.value,
                  }))
                }
                placeholder="e.g. Plywood, Hinge"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={familyData.description || ''}
                onChange={(e) =>
                  setFamilyData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Variant Attribute Definitions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Variant Attributes *
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Define which attributes differentiate variants (e.g. color,
              thickness, grade)
            </p>

            {/* Common suggestions */}
            <div className="flex flex-wrap gap-1 mb-2">
              {COMMON_VARIANT_ATTRIBUTES.filter(
                (a) => !attrDefs.includes(a),
              ).map((attr) => (
                <button
                  key={attr}
                  onClick={() => {
                    setAttrDefs((prev) => [...prev, attr]);
                  }}
                  className="px-2 py-0.5 text-xs border border-dashed border-gray-300 rounded text-gray-500 hover:border-primary hover:text-primary"
                >
                  + {attr}
                </button>
              ))}
            </div>

            {/* Current attribute definitions */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {attrDefs.map((attr) => (
                <span
                  key={attr}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded"
                >
                  {attr}
                  <button
                    onClick={() => removeAttrDef(attr)}
                    className="text-blue-400 hover:text-blue-600"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>

            {/* Add custom */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newAttrDef}
                onChange={(e) => setNewAttrDef(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addAttrDef()}
                placeholder="Custom attribute name..."
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded text-sm"
              />
              <button
                onClick={addAttrDef}
                disabled={!newAttrDef.trim()}
                className="px-3 py-1.5 text-sm text-primary border border-primary/30 rounded hover:bg-primary/5 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={proceedToVariants}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              Next: Add Variants
            </button>
          </div>
        </div>
      )}

      {step === 'variants' && (
        <div className="space-y-4">
          {/* Bulk generation */}
          <div className="p-3 bg-gray-50 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Wand2 className="h-4 w-4" />
              Bulk Generate Variants
            </div>
            <p className="text-xs text-gray-400">
              Enter comma-separated values for each attribute to auto-generate
              all combinations.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {attrDefs.map((attr) => (
                <div key={attr}>
                  <label className="text-xs text-gray-500 capitalize">
                    {attr}
                  </label>
                  <input
                    type="text"
                    value={bulkValues[attr] || ''}
                    onChange={(e) =>
                      setBulkValues((prev) => ({
                        ...prev,
                        [attr]: e.target.value,
                      }))
                    }
                    placeholder={`e.g. Black, White, Grey`}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={generateBulkVariants}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              <Wand2 className="h-3 w-3" />
              Generate Combinations
            </button>
          </div>

          {/* Manual variant table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Variants ({variantRows.length})
              </span>
              <button
                onClick={addVariantRow}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Plus className="h-3 w-3" />
                Add Row
              </button>
            </div>

            {variantRows.length === 0 && (
              <div className="flex flex-col items-center py-8 text-gray-400 bg-gray-50 rounded-lg">
                <AlertCircle className="h-5 w-5 mb-1" />
                <p className="text-sm">
                  A family with no variants cannot be used in transactions.
                </p>
                <p className="text-xs">Add your first variant above.</p>
              </div>
            )}

            {variantRows.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      {attrDefs.map((attr) => (
                        <th
                          key={attr}
                          className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                        >
                          {attr}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        SKU
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Name
                      </th>
                      <th className="px-3 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {variantRows.map((row) => (
                      <tr key={row.id}>
                        {attrDefs.map((attr) => (
                          <td key={attr} className="px-3 py-1.5">
                            <input
                              type="text"
                              value={row.attributes[attr] || ''}
                              onChange={(e) =>
                                updateVariantRow(
                                  row.id,
                                  attr,
                                  e.target.value,
                                )
                              }
                              className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                            />
                          </td>
                        ))}
                        <td className="px-3 py-1.5">
                          <input
                            type="text"
                            value={row.sku}
                            onChange={(e) =>
                              updateVariantRow(row.id, 'sku', e.target.value)
                            }
                            className="w-full px-2 py-1 border border-gray-200 rounded text-xs font-mono"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) =>
                              updateVariantRow(
                                row.id,
                                'name',
                                e.target.value,
                              )
                            }
                            className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <button
                            onClick={() => removeVariantRow(row.id)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-2">
            <button
              onClick={() => setStep('family')}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
            >
              Back
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || variantRows.length === 0}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Family & Variants'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Helpers
// ============================================

/**
 * Cartesian product of arrays.
 * cartesianProduct([["A","B"], ["1","2"]]) => [["A","1"],["A","2"],["B","1"],["B","2"]]
 */
function cartesianProduct(arrays: string[][]): string[][] {
  if (arrays.length === 0) return [[]];
  return arrays.reduce<string[][]>(
    (acc, arr) => acc.flatMap((combo) => arr.map((val) => [...combo, val])),
    [[]],
  );
}
