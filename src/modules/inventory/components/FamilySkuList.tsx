/**
 * FamilySkuList
 * Displays child SKUs for a family item in the Variants/SKUs tab.
 * Uses the useVariants hook in family mode.
 */

import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import {
  Package,
  Loader2,
  AlertCircle,
  Trash2,
  ChevronRight,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useVariants } from '../hooks/useVariants';
import { buildDisplayName, generateVariantSku, getInventoryItemBySku } from '../services/inventoryService';
import type { InventoryItem, InventoryUnit, SkuFormData, VariantAttribute } from '../types';

interface FamilySkuListProps {
  familyId: string;
  familyItem: InventoryItem;
  userId: string;
  onSkuClick?: (sku: InventoryItem) => void;
}

export function FamilySkuList({
  familyId,
  familyItem,
  userId,
  onSkuClick,
}: FamilySkuListProps) {
  const {
    variants: skus,
    loading,
    error,
    deleteFamilySku,
    addFamilySku,
  } = useVariants(familyId, userId, true);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [templateSkuId, setTemplateSkuId] = useState('');
  const [variantValues, setVariantValues] = useState<Record<string, string>>({});
  const [skuOverride, setSkuOverride] = useState('');
  const [nameOverride, setNameOverride] = useState('');
  const [costOverride, setCostOverride] = useState<number | ''>('');
  const [structuredFunction, setStructuredFunction] = useState('');
  const [structuredKeySpecs, setStructuredKeySpecs] = useState('');
  const [structuredQualityTier, setStructuredQualityTier] = useState('');
  const [structuredBrandName, setStructuredBrandName] = useState('');
  const [skuCheckState, setSkuCheckState] = useState<'idle' | 'checking' | 'available' | 'taken' | 'error'>('idle');
  const [skuCheckMessage, setSkuCheckMessage] = useState('');

  const attrDefs = useMemo(
    () => familyItem.variantAttributeDefinitions || [],
    [familyItem.variantAttributeDefinitions],
  );

  useEffect(() => {
    if (!showAddForm) return;
    const initialValues: Record<string, string> = {};
    for (const attr of attrDefs) {
      initialValues[attr] = '';
    }
    setVariantValues(initialValues);
    setTemplateSkuId('');
    setSkuOverride('');
    setNameOverride('');
    setCostOverride('');
    setStructuredFunction(familyItem.structuredName?.function || '');
    setStructuredKeySpecs(familyItem.structuredName?.keySpecs || '');
    setStructuredQualityTier(familyItem.structuredName?.qualityTier || '');
    setStructuredBrandName(familyItem.structuredName?.brandName || '');
    setSkuCheckState('idle');
    setSkuCheckMessage('');
    setCreateError(null);
  }, [showAddForm, attrDefs, familyItem.structuredName]);

  const currentVariantSignature = useMemo(() => {
    const entries = attrDefs
      .map((key) => `${key.trim().toLowerCase()}:${(variantValues[key] || '').trim().toLowerCase()}`)
      .sort();
    return entries.join('|');
  }, [attrDefs, variantValues]);

  const hasAllVariantValues = useMemo(
    () => attrDefs.every((key) => (variantValues[key] || '').trim().length > 0),
    [attrDefs, variantValues],
  );

  const candidateSku = useMemo(() => {
    const manual = skuOverride.trim();
    if (manual) return manual;
    if (!hasAllVariantValues) return '';
    const variantAttributes: VariantAttribute[] = attrDefs.map((key) => ({
      key,
      value: (variantValues[key] || '').trim(),
    }));
    return generateVariantSku(familyItem.sku, variantAttributes);
  }, [skuOverride, hasAllVariantValues, attrDefs, variantValues, familyItem.sku]);

  const matchingSku = useMemo(() => {
    if (!currentVariantSignature) return null;
    const hasAllValues = attrDefs.every((key) => (variantValues[key] || '').trim().length > 0);
    if (!hasAllValues) return null;
    return (
      skus.find((sku) => {
        const signature = (sku.variantAttributes || [])
          .map((attr) => `${attr.key.trim().toLowerCase()}:${attr.value.trim().toLowerCase()}`)
          .sort()
          .join('|');
        return signature === currentVariantSignature;
      }) || null
    );
  }, [skus, currentVariantSignature, attrDefs, variantValues]);

  useEffect(() => {
    if (!showAddForm) return;
    if (!candidateSku) {
      setSkuCheckState('idle');
      setSkuCheckMessage('');
      return;
    }

    const duplicateInFamilyByCode = skus.some((sku) => sku.sku === candidateSku);
    if (duplicateInFamilyByCode) {
      setSkuCheckState('taken');
      setSkuCheckMessage(`SKU "${candidateSku}" already exists in this family.`);
      return;
    }

    let cancelled = false;
    setSkuCheckState('checking');
    setSkuCheckMessage('Checking SKU availability...');
    const timeoutId = setTimeout(async () => {
      try {
        const existing = await getInventoryItemBySku(candidateSku);
        if (cancelled) return;
        if (existing) {
          setSkuCheckState('taken');
          setSkuCheckMessage(`SKU "${candidateSku}" is already used by another inventory item.`);
        } else {
          setSkuCheckState('available');
          setSkuCheckMessage(`SKU "${candidateSku}" is available.`);
        }
      } catch {
        if (cancelled) return;
        setSkuCheckState('error');
        setSkuCheckMessage('Could not verify SKU availability right now.');
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [showAddForm, candidateSku, skus]);

  const applyTemplate = (template: InventoryItem | null) => {
    if (!template) {
      const resetValues: Record<string, string> = {};
      for (const attr of attrDefs) {
        resetValues[attr] = '';
      }
      setVariantValues(resetValues);
      setSkuOverride('');
      setNameOverride('');
      setCostOverride('');
      setStructuredFunction(familyItem.structuredName?.function || '');
      setStructuredKeySpecs(familyItem.structuredName?.keySpecs || '');
      setStructuredQualityTier(familyItem.structuredName?.qualityTier || '');
      setStructuredBrandName(familyItem.structuredName?.brandName || '');
      return;
    }
    const mapped: Record<string, string> = {};
    for (const attr of attrDefs) {
      const hit = (template.variantAttributes || []).find((item) => item.key === attr);
      mapped[attr] = hit?.value || '';
    }
    setVariantValues(mapped);
    // Guardrail: never carry template SKU/name directly.
    setSkuOverride('');
    setNameOverride('');
    setCostOverride(template.pricing?.costPerUnit || '');
    setStructuredFunction(template.structuredName?.function || familyItem.structuredName?.function || '');
    setStructuredKeySpecs(template.structuredName?.keySpecs || familyItem.structuredName?.keySpecs || '');
    setStructuredQualityTier(template.structuredName?.qualityTier || familyItem.structuredName?.qualityTier || '');
    setStructuredBrandName(template.structuredName?.brandName || familyItem.structuredName?.brandName || '');
  };

  const handleDelete = async (skuId: string, e: MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this SKU? This cannot be undone.')) return;
    setDeletingId(skuId);
    setDeleteError(null);
    try {
      await deleteFamilySku(skuId);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  const getCurrency = (sku: InventoryItem) =>
    sku.pricing?.currency || familyItem.pricing?.currency || 'UGX';

  const formatCost = (sku: InventoryItem) => {
    const cost = sku.pricing?.costPerUnit;
    if (!cost || cost === 0) return '--';
    const curr = getCurrency(sku);
    return `${curr} ${cost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  };

  const handleCreateSku = async () => {
    const variantAttributes: VariantAttribute[] = attrDefs
      .map((key) => ({ key, value: (variantValues[key] || '').trim() }))
      .filter((entry) => entry.value.length > 0);

    const missing = attrDefs.filter((key) => !(variantValues[key] || '').trim());
    if (missing.length > 0) {
      setCreateError(`Please provide values for: ${missing.join(', ')}`);
      return;
    }

    const structuredNameEntries = {
      function: structuredFunction.trim(),
      keySpecs: structuredKeySpecs.trim(),
      qualityTier: structuredQualityTier.trim(),
      brandName: structuredBrandName.trim(),
    };
    const structuredName = Object.fromEntries(
      Object.entries(structuredNameEntries).filter(([, value]) => value.length > 0),
    );
    const hasStructuredName = Object.keys(structuredName).length > 0;

    const structuredDisplayBase = hasStructuredName
      ? buildDisplayName({
          category: familyItem.category,
          subcategory: familyItem.subcategory,
          structuredName,
        })
      : '';
    const variantValueSuffix = variantAttributes.map((attr) => attr.value).join(' / ');
    const suggestedDisplayName = structuredDisplayBase
      ? `${structuredDisplayBase} - ${variantValueSuffix}`
      : '';

    setCreating(true);
    setCreateError(null);
    try {
      const unit = (familyItem.pricing?.unit || 'ea') as InventoryUnit;
      const payload: SkuFormData = {
        sku: skuOverride.trim(),
        name: nameOverride.trim() || '',
        displayName: suggestedDisplayName || undefined,
        description: familyItem.description || '',
        classification: familyItem.classification || 'material',
        category: familyItem.category,
        subcategory: familyItem.subcategory,
        brand: familyItem.brand,
        tags: familyItem.tags || [],
        status: 'active',
        pricing: {
          costPerUnit:
            typeof costOverride === 'number' ? costOverride : familyItem.pricing?.costPerUnit || 0,
          currency: familyItem.pricing?.currency || 'UGX',
          unit,
        },
        variantAttributes,
        // Inherit family operational parameters by default to reduce data-entry errors.
        purchaseUom: familyItem.purchaseUom,
        stockUom: familyItem.stockUom,
        consumptionUom: familyItem.consumptionUom,
        uomConversion: familyItem.uomConversion,
        dimensions: familyItem.dimensions,
        grainPattern: familyItem.grainPattern,
        itemType: familyItem.itemType,
        structuredName: hasStructuredName ? structuredName : undefined,
      };

      await addFamilySku(payload);
      setShowAddForm(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create SKU');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        <span className="ml-2 text-sm text-gray-500">Loading SKUs...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">
          {skus.length} SKU{skus.length !== 1 ? 's' : ''} in this family
        </h3>
        {!showAddForm && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20"
          >
            <Plus className="w-3.5 h-3.5" />
            Add SKU from Family Defaults
          </button>
        )}
      </div>

      {deleteError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {deleteError}
        </div>
      )}

      {showAddForm && (
        <div className="p-4 border border-indigo-200 bg-indigo-50/50 rounded-lg space-y-4">
          <div className="flex items-center gap-2 text-indigo-800">
            <Sparkles className="w-4 h-4" />
            <h4 className="text-sm font-medium">Create SKU using family naming parameters</h4>
          </div>

          {createError && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {createError}
            </div>
          )}

          {skus.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Create from existing SKU template
              </label>
              <select
                value={templateSkuId}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  setTemplateSkuId(selectedId);
                  const template = skus.find((sku) => sku.id === selectedId) || null;
                  applyTemplate(template);
                }}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary bg-white"
              >
                <option value="">None (start from family defaults)</option>
                {skus.map((sku) => (
                  <option key={sku.id} value={sku.id}>
                    {sku.displayName || sku.name} ({sku.sku})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Template copies naming and cost fields, but always requires a new unique SKU.
              </p>
            </div>
          )}

          {attrDefs.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {attrDefs.map((attr) => (
                <div key={attr}>
                  <label className="block text-xs font-medium text-gray-700 mb-1 capitalize">
                    {attr} *
                  </label>
                  <input
                    type="text"
                    value={variantValues[attr] || ''}
                    onChange={(e) =>
                      setVariantValues((prev) => ({ ...prev, [attr]: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                    placeholder={`Enter ${attr}`}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                SKU override (optional)
              </label>
              <input
                type="text"
                value={skuOverride}
                onChange={(e) => setSkuOverride(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                placeholder="Auto-generated if blank"
              />
              <p className="mt-1 text-xs text-gray-500">
                Leave blank to auto-generate a unique SKU from family + attributes.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Name override (optional)
              </label>
              <input
                type="text"
                value={nameOverride}
                onChange={(e) => setNameOverride(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                placeholder="Auto-generated if blank"
              />
            </div>
          </div>

          <div className="p-2 rounded border text-xs bg-white">
            <div className="font-medium text-gray-700">
              SKU Preview: {candidateSku || 'Complete required attributes to preview'}
            </div>
            {skuCheckMessage && (
              <p
                className={`mt-1 ${
                  skuCheckState === 'available'
                    ? 'text-green-700'
                    : skuCheckState === 'checking'
                    ? 'text-gray-500'
                    : skuCheckState === 'error'
                    ? 'text-amber-700'
                    : 'text-red-700'
                }`}
              >
                {skuCheckMessage}
              </p>
            )}
          </div>

          {matchingSku && (
            <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
              A SKU with the same variant attributes already exists: <strong>{matchingSku.sku}</strong>. Change one or more attributes.
            </div>
          )}

          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Function</label>
              <input
                type="text"
                value={structuredFunction}
                onChange={(e) => setStructuredFunction(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Key Specs</label>
              <input
                type="text"
                value={structuredKeySpecs}
                onChange={(e) => setStructuredKeySpecs(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Quality Tier</label>
              <input
                type="text"
                value={structuredQualityTier}
                onChange={(e) => setStructuredQualityTier(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Brand Name</label>
              <input
                type="text"
                value={structuredBrandName}
                onChange={(e) => setStructuredBrandName(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Cost override (optional)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={costOverride}
              onChange={(e) => setCostOverride(e.target.value ? parseFloat(e.target.value) : '')}
              className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
              placeholder={`Default: ${familyItem.pricing?.currency || 'UGX'} ${familyItem.pricing?.costPerUnit || 0}`}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={creating}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateSku}
              disabled={creating || !!matchingSku || skuCheckState === 'checking' || skuCheckState === 'taken'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Create SKU
            </button>
          </div>
        </div>
      )}

      {skus.length === 0 ? (
        <div className="text-center py-8">
          <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No SKUs found for this family.</p>
          <p className="text-xs text-gray-400 mt-1">
            SKUs are individual orderable variants under this family grouping.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
          {skus.map((sku) => (
            <div
              key={sku.id}
              className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
                onSkuClick ? 'cursor-pointer' : ''
              }`}
              onClick={() => onSkuClick?.(sku)}
            >
              {/* Icon */}
              <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />

              {/* Main info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {sku.displayName || sku.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-mono text-gray-500">{sku.sku}</span>
                  {/* Variant attribute badges */}
                  {sku.variantAttributes && sku.variantAttributes.length > 0 && (
                    <div className="flex items-center gap-1">
                      {sku.variantAttributes.map((attr, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-1.5 py-0.5 text-xs bg-indigo-50 text-indigo-700 rounded"
                        >
                          {attr.key}: {attr.value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Stock */}
              <div className="text-right flex-shrink-0">
                <p className={`text-sm font-medium ${
                  (sku.inventory?.inStock ?? 0) > 0 ? 'text-green-700' : 'text-gray-400'
                }`}>
                  {sku.inventory?.inStock ?? 0}
                </p>
                <p className="text-xs text-gray-400">in stock</p>
              </div>

              {/* Cost */}
              <div className="text-right flex-shrink-0 w-28">
                <p className="text-sm font-medium text-gray-900">{formatCost(sku)}</p>
                <p className="text-xs text-gray-400">unit cost</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={(e) => handleDelete(sku.id, e)}
                  disabled={deletingId === sku.id}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                  title="Delete SKU"
                >
                  {deletingId === sku.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
                {onSkuClick && (
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default FamilySkuList;
