/**
 * InventoryItemModal Component
 * Modal for creating and editing inventory items
 */

import { useState, useEffect, useMemo } from 'react';
import { X, Package, Save, Loader2, ChevronDown, ChevronRight, Sparkles, ArrowRightLeft } from 'lucide-react';
import {
  createInventoryItem,
  updateInventoryItem,
  getInventoryItem,
  generateSku,
  generateSmartSku,
  buildDisplayName,
  addSupplierPricing,
  removeSupplierPricing,
  setPreferredSupplier,
} from '../services/inventoryService';
import type {
  InventoryCategory,
  InventoryClassification,
  InventoryItemType,
  InventoryUnit,
  InventoryStatus,
  GrainPattern,
  SupplierInventoryPricing,
  SupplierPricingFormData,
} from '../types';
import {
  INVENTORY_UNITS,
  COMMON_THICKNESSES,
} from '../types';
import { useCategories } from '../hooks/useCategories';
import {
  EXCHANGE_RATES_TO_UGX,
  FUNCTIONAL_CURRENCY,
} from '@/modules/finance/constants/currency.constants';
import { SupplierPicker } from '@/modules/procurement/components/SupplierPicker';
import { SupplierPricingManager } from './SupplierPricingManager';
import { MaterialLinkManager } from './MaterialLinkManager';
import { recalculateStockForConversionChange } from '../services/stockLevelService';

interface InventoryItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  itemId?: string; // If provided, edit mode
  userId: string;
}

const CURRENCIES = ['UGX', 'KES', 'USD', 'EUR', 'GBP', 'AED', 'ZAR'];

export function InventoryItemModal({
  isOpen,
  onClose,
  onSaved,
  itemId,
  userId,
}: InventoryItemModalProps) {
  const { selectableCategories } = useCategories();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [classification, setClassification] = useState<InventoryClassification>('material');
  const [category, setCategory] = useState<InventoryCategory>('sheet-goods');
  const [subcategory, setSubcategory] = useState('');
  const [brand, setBrand] = useState('');
  const [supplierValue, setSupplierValue] = useState<{ supplierId: string; supplierName: string } | null>(null);
  const [shopifyProductId, setShopifyProductId] = useState('');
  const [shopifyVariantId, setShopifyVariantId] = useState('');
  const [tags, setTags] = useState('');
  const [costPerUnit, setCostPerUnit] = useState<number>(0);
  const [currency, setCurrency] = useState('UGX');
  const [unit, setUnit] = useState<InventoryUnit>('sheet');
  const [functionalCurrencyCost, setFunctionalCurrencyCost] = useState<number>(0);
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [thickness, setThickness] = useState<number | ''>('');
  const [length, setLength] = useState<number | ''>('');
  const [width, setWidth] = useState<number | ''>('');
  const [grainPattern, setGrainPattern] = useState<GrainPattern>('none');

  // Fabric / upholstery roll spec
  const [fabricRollWidth, setFabricRollWidth] = useState<number | ''>('');
  const [fabricBayLength, setFabricBayLength] = useState<number | ''>('');
  const [fabricAllowRotation, setFabricAllowRotation] = useState(false);
  const [fabricPatternRepeatLength, setFabricPatternRepeatLength] = useState<number | ''>('');
  const [fabricPatternRepeatWidth, setFabricPatternRepeatWidth] = useState<number | ''>('');

  const [status, setStatus] = useState<InventoryStatus>('active');
  const [tier, setTier] = useState<'catalogue' | 'project'>('catalogue');
  const [restockable, setRestockable] = useState(true);

  // Timber-specific volume fields
  const [costPerCubicMetre, setCostPerCubicMetre] = useState<number>(0);
  const [volumeOnHand, setVolumeOnHand] = useState<number>(0);
  const [piecesOnHand, setPiecesOnHand] = useState<number>(0);

  // UoM conversion state
  const [purchaseUom, setPurchaseUom] = useState<InventoryUnit | ''>('');
  const [stockUom, setStockUom] = useState<InventoryUnit | ''>('');
  const [consumptionUom, setConsumptionUom] = useState<InventoryUnit | ''>('');
  const [uomConversion, setUomConversion] = useState<number | ''>('');
  const [originalUomConversion, setOriginalUomConversion] = useState<number | ''>('');
  const [showUomConversion, setShowUomConversion] = useState(false);
  const [showConversionRecalcConfirm, setShowConversionRecalcConfirm] = useState(false);
  const [pendingSaveData, setPendingSaveData] = useState<Record<string, unknown> | null>(null);

  // Parametric / structured naming state
  const [itemType, setItemType] = useState<InventoryItemType>('standard');
  const [structuredFunction, setStructuredFunction] = useState('');
  const [structuredKeySpecs, setStructuredKeySpecs] = useState('');
  const [structuredQualityTier, setStructuredQualityTier] = useState('');
  const [structuredBrandName, setStructuredBrandName] = useState('');
  const [showStructuredNaming, setShowStructuredNaming] = useState(true);

  // Multi-supplier state
  const [supplierPricing, setSupplierPricing] = useState<SupplierInventoryPricing[]>([]);
  const [linkedMaterialIds, setLinkedMaterialIds] = useState<string[]>([]);

  // Computed smart SKU preview
  const smartSkuPreview = useMemo(() => {
    if (!structuredFunction && !structuredKeySpecs && !structuredQualityTier) return '';
    return generateSmartSku({
      category,
      subcategory: subcategory || undefined,
      engineeringFunction: structuredFunction || undefined,
      keySpecs: structuredKeySpecs || undefined,
      qualityTier: structuredQualityTier || undefined,
      itemType,
    });
  }, [category, subcategory, structuredFunction, structuredKeySpecs, structuredQualityTier, itemType]);

  // Computed display name preview
  const displayNamePreview = useMemo(() => {
    if (!structuredFunction && !structuredKeySpecs && !structuredQualityTier && !structuredBrandName) return '';
    return buildDisplayName({
      category,
      subcategory: subcategory || undefined,
      structuredName: {
        function: structuredFunction || undefined,
        keySpecs: structuredKeySpecs || undefined,
        qualityTier: structuredQualityTier || undefined,
        brandName: structuredBrandName || undefined,
      },
    });
  }, [category, subcategory, structuredFunction, structuredKeySpecs, structuredQualityTier, structuredBrandName]);

  // Whether the currently selected category should expose the fabric/upholstery
  // roll spec form. We accept the static 'upholstery' slug *and* any dynamic
  // Firestore category whose slug or name reads as upholstery-ish (fabric,
  // leather, vinyl, textile…) — production uses category slugs that don't
  // necessarily match the static union.
  const isUpholsteryCategory = useMemo(() => {
    if (category === 'upholstery') return true;
    const cat = selectableCategories.find((c) => c.slug === category);
    const haystack = `${cat?.slug ?? ''} ${cat?.name ?? ''} ${subcategory}`.toLowerCase();
    return /upholst|fabric|leather|vinyl|textile|cloth/.test(haystack);
  }, [category, subcategory, selectableCategories]);

  // Load existing item if editing
  useEffect(() => {
    if (isOpen && itemId) {
      loadItem();
    } else if (isOpen && !itemId) {
      resetForm();
    }
  }, [isOpen, itemId]);

  const loadItem = async () => {
    if (!itemId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const item = await getInventoryItem(itemId);
      if (item) {
        setSku(item.sku);
        setName(item.name);
        setDisplayName(item.displayName || '');
        setDescription(item.description || '');
        setClassification(item.classification || 'material');
        setCategory(item.category);
        setSubcategory(item.subcategory || '');
        setBrand(item.brand || '');
        setSupplierValue(
          item.preferredSupplierId
            ? { supplierId: item.preferredSupplierId, supplierName: item.preferredSupplierName || '' }
            : null,
        );
        setShopifyProductId(item.shopifyProductId || '');
        setShopifyVariantId(item.shopifyVariantId || '');
        setTags(item.tags?.join(', ') || '');
        setCostPerUnit(item.pricing?.costPerUnit || 0);
        setCurrency(item.pricing?.currency || 'UGX');
        setUnit(item.pricing?.unit || 'sheet');
        setExchangeRate(item.pricing?.exchangeRate || EXCHANGE_RATES_TO_UGX[item.pricing?.currency || 'UGX'] || 1);
        setFunctionalCurrencyCost(item.pricing?.functionalCurrencyCost || 0);
        setThickness(item.dimensions?.thickness || '');
        setLength(item.dimensions?.length || '');
        setWidth(item.dimensions?.width || '');
        setGrainPattern(item.grainPattern || 'none');
        setFabricRollWidth(item.fabricSpec?.rollWidth ?? '');
        setFabricBayLength(item.fabricSpec?.defaultBayLength ?? '');
        setFabricAllowRotation(item.fabricSpec?.allowRotation === true);
        setFabricPatternRepeatLength(item.fabricSpec?.patternRepeat?.length ?? '');
        setFabricPatternRepeatWidth(item.fabricSpec?.patternRepeat?.width ?? '');
        setStatus(item.status);
        setTier((item as any).tier || 'catalogue');
        setRestockable((item as any).restockable !== false);
        // Timber volume fields
        setCostPerCubicMetre((item as any).pricing?.costPerCubicMetre || 0);
        setVolumeOnHand((item as any).inventory?.volumeOnHand || 0);
        setPiecesOnHand((item as any).inventory?.piecesOnHand || 0);
        // Parametric fields
        setItemType(item.itemType || 'standard');
        setStructuredFunction(item.structuredName?.function || '');
        setStructuredKeySpecs(item.structuredName?.keySpecs || '');
        setStructuredQualityTier(item.structuredName?.qualityTier || '');
        setStructuredBrandName(item.structuredName?.brandName || '');
        setShowStructuredNaming(!!item.structuredName);
        // UoM conversion
        setPurchaseUom(item.purchaseUom || '');
        setStockUom(item.stockUom || '');
        setConsumptionUom(item.consumptionUom || '');
        setUomConversion(item.uomConversion || '');
        setOriginalUomConversion(item.uomConversion || '');
        setShowUomConversion(!!(item.purchaseUom || item.stockUom));
        // Multi-supplier data
        setSupplierPricing(item.supplierPricing || []);
        setLinkedMaterialIds(item.linkedMaterialIds || []);
      }
    } catch (err) {
      setError('Failed to load item');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSku('');
    setName('');
    setDisplayName('');
    setDescription('');
    setClassification('material');
    setCategory('sheet-goods');
    setSubcategory('');
    setBrand('');
    setSupplierValue(null);
    setShopifyProductId('');
    setShopifyVariantId('');
    setTags('');
    setCostPerUnit(0);
    setCurrency('UGX');
    setUnit('sheet');
    setFunctionalCurrencyCost(0);
    setExchangeRate(1);
    setThickness('');
    setLength('');
    setWidth('');
    setGrainPattern('none');
    setFabricRollWidth('');
    setFabricBayLength('');
    setFabricAllowRotation(false);
    setFabricPatternRepeatLength('');
    setFabricPatternRepeatWidth('');
    setStatus('active');
    setTier('catalogue');
    setRestockable(true);
    setCostPerCubicMetre(0);
    setVolumeOnHand(0);
    setPiecesOnHand(0);
    setItemType('standard');
    setStructuredFunction('');
    setStructuredKeySpecs('');
    setStructuredQualityTier('');
    setStructuredBrandName('');
    setShowStructuredNaming(false);
    setPurchaseUom('');
    setStockUom('');
    setConsumptionUom('');
    setUomConversion('');
    setShowUomConversion(false);
    setSupplierPricing([]);
    setLinkedMaterialIds([]);
    setError(null);
  };

  // Supplier pricing handlers
  const handleAddSupplierPricing = async (pricing: SupplierPricingFormData, setAsPreferred: boolean) => {
    if (!itemId) {
      // For new items, just add to local state
      const newPricing: SupplierInventoryPricing = {
        ...pricing,
        unit: unit,
        isPreferred: setAsPreferred,
        addedAt: new Date() as any, // Will be replaced with Timestamp on save
        addedBy: userId,
      };
      setSupplierPricing((prev) => {
        if (setAsPreferred) {
          return [...prev.map((sp) => ({ ...sp, isPreferred: false })), newPricing];
        }
        const existingIndex = prev.findIndex((sp) => sp.supplierId === pricing.supplierId);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = newPricing;
          return updated;
        }
        return [...prev, newPricing];
      });
      if (setAsPreferred) {
        setSupplierValue({ supplierId: pricing.supplierId, supplierName: pricing.supplierName });
      }
      return;
    }
    // For existing items, update in database
    await addSupplierPricing(itemId, pricing, userId, setAsPreferred);
    // Reload item to get updated data
    await loadItem();
  };

  const handleRemoveSupplierPricing = async (supplierId: string) => {
    if (!itemId) {
      // For new items, just remove from local state
      setSupplierPricing((prev) => prev.filter((sp) => sp.supplierId !== supplierId));
      if (supplierValue?.supplierId === supplierId) {
        setSupplierValue(null);
      }
      return;
    }
    await removeSupplierPricing(itemId, supplierId, userId);
    await loadItem();
  };

  const handleSetPreferredSupplier = async (supplierId: string) => {
    if (!itemId) {
      setSupplierPricing((prev) =>
        prev.map((sp) => ({ ...sp, isPreferred: sp.supplierId === supplierId }))
      );
      const supplier = supplierPricing.find((sp) => sp.supplierId === supplierId);
      if (supplier) {
        setSupplierValue({ supplierId: supplier.supplierId, supplierName: supplier.supplierName });
      }
      return;
    }
    await setPreferredSupplier(itemId, supplierId, userId);
    await loadItem();
  };

  const handleGenerateSku = () => {
    // Use smart SKU if structured naming fields are filled
    if (smartSkuPreview) {
      setSku(smartSkuPreview);
    } else if (name && category) {
      const newSku = generateSku(name, category);
      setSku(newSku);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    
    if (!sku.trim()) {
      setError('SKU is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Build structured name if any fields are set
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

      const formData = {
        sku: sku.trim(),
        name: name.trim(),
        displayName: displayName.trim() || undefined,
        description: description.trim() || undefined,
        brand: brand.trim() || undefined,
        classification: itemType === 'kit' ? 'kit' as const : classification,
        category,
        subcategory: subcategory.trim() || undefined,
        preferredSupplierId: supplierValue?.supplierId || undefined,
        preferredSupplierName: supplierValue?.supplierName || undefined,
        shopifyProductId: classification === 'product' && shopifyProductId.trim() ? shopifyProductId.trim() : undefined,
        shopifyVariantId: classification === 'product' && shopifyVariantId.trim() ? shopifyVariantId.trim() : undefined,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        pricing: {
          costPerUnit,
          currency,
          unit,
          functionalCurrencyCost: currency === FUNCTIONAL_CURRENCY ? costPerUnit : functionalCurrencyCost,
          exchangeRate: currency === FUNCTIONAL_CURRENCY ? 1 : exchangeRate,
          ...(category === 'solid-wood' && costPerCubicMetre > 0
            ? { costPerCubicMetre }
            : {}),
        },
        dimensions: (thickness || length || width) ? {
          thickness: typeof thickness === 'number' ? thickness : 0,
          length: typeof length === 'number' ? length : 0,
          width: typeof width === 'number' ? width : 0,
        } : undefined,
        grainPattern: grainPattern !== 'none' ? grainPattern : undefined,
        fabricSpec: isUpholsteryCategory && typeof fabricRollWidth === 'number' && fabricRollWidth > 0
          ? {
              rollWidth: fabricRollWidth,
              ...(typeof fabricBayLength === 'number' && fabricBayLength > 0
                ? { defaultBayLength: fabricBayLength }
                : {}),
              ...(fabricAllowRotation ? { allowRotation: true } : {}),
              ...(typeof fabricPatternRepeatLength === 'number' && fabricPatternRepeatLength > 0
                && typeof fabricPatternRepeatWidth === 'number' && fabricPatternRepeatWidth > 0
                ? { patternRepeat: { length: fabricPatternRepeatLength, width: fabricPatternRepeatWidth } }
                : {}),
            }
          : undefined,
        status,
        tier,
        restockable,
        ...(category === 'solid-wood'
          ? {
              inventory: {
                volumeOnHand: volumeOnHand || 0,
                piecesOnHand: piecesOnHand || 0,
              },
            }
          : {}),
        // UoM conversion
        purchaseUom: purchaseUom || undefined,
        stockUom: stockUom || undefined,
        consumptionUom: consumptionUom || undefined,
        uomConversion: (purchaseUom && stockUom && purchaseUom !== stockUom && typeof uomConversion === 'number')
          ? uomConversion
          : undefined,
        // Parametric extensions
        itemType: itemType !== 'standard' ? itemType : undefined,
        structuredName: hasStructuredName ? structuredName : undefined,
      };

      if (itemId) {
        // Check if uomConversion changed and stock might need recalculation
        const oldConv = typeof originalUomConversion === 'number' ? originalUomConversion : 0;
        const newConv = typeof uomConversion === 'number' ? uomConversion : 0;
        const conversionChanged = oldConv > 0 && newConv > 0 && oldConv !== newConv;

        if (conversionChanged) {
          // Save the item first, then ask about stock recalculation
          await updateInventoryItem(itemId, formData, userId);
          setPendingSaveData({ oldConv, newConv });
          setShowConversionRecalcConfirm(true);
          setSaving(false);
          return; // Don't close yet — show confirmation
        }

        await updateInventoryItem(itemId, formData, userId);
      } else {
        await createInventoryItem(formData, userId);
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save item');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => { if (!showConversionRecalcConfirm) onClose(); }}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              {itemId ? 'Edit Inventory Item' : 'Add Inventory Item'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
                  Basic Information
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SKU *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={sku}
                        onChange={(e) => setSku(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary focus:border-primary"
                        placeholder="e.g., SHT-MDF-18MM"
                      />
                      <button
                        type="button"
                        onClick={handleGenerateSku}
                        className="px-3 py-2 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                      >
                        Generate
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category *
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as InventoryCategory)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                    >
                      {selectableCategories.map((cat) => (
                        <option key={cat.slug} value={cat.slug}>
                          {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary focus:border-primary"
                    placeholder="e.g., MDF Board 18mm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary focus:border-primary"
                    placeholder="Optional friendly name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Subcategory
                    </label>
                    <input
                      type="text"
                      value={subcategory}
                      onChange={(e) => setSubcategory(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                      placeholder="e.g., Plain MDF"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as InventoryStatus)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                    >
                      <option value="active">Active</option>
                      <option value="discontinued">Discontinued</option>
                      <option value="out-of-stock">Out of Stock</option>
                    </select>
                  </div>
                </div>

                {/* Tier & Restockable */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tier
                    </label>
                    <select
                      value={tier}
                      onChange={(e) => setTier(e.target.value as 'catalogue' | 'project')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                    >
                      <option value="catalogue">Catalogue</option>
                      <option value="project">Project</option>
                    </select>
                  </div>
                  <div className="flex flex-col justify-center">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={restockable}
                        onChange={(e) => setRestockable(e.target.checked)}
                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                      />
                      <span className="text-sm font-medium text-gray-700">Restockable</span>
                    </label>
                    <p className="mt-1 text-xs text-gray-500 ml-6">
                      Uncheck for items with limited supplier availability
                    </p>
                  </div>
                </div>

                {/* Timber-specific volume tracking */}
                {category === 'solid-wood' && (
                  <fieldset className="border border-amber-200 rounded-lg p-4 bg-amber-50/50">
                    <legend className="text-sm font-medium text-amber-800 px-1">
                      Volume Tracking (Timber)
                    </legend>
                    <div className="grid grid-cols-3 gap-4 mt-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Cost per m&sup3;
                        </label>
                        <input
                          type="number"
                          value={costPerCubicMetre || ''}
                          onChange={(e) => setCostPerCubicMetre(Number(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                          placeholder="0"
                          min="0"
                          step="any"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Volume on hand (m&sup3;)
                        </label>
                        <input
                          type="number"
                          value={volumeOnHand || ''}
                          onChange={(e) => setVolumeOnHand(Number(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                          placeholder="0"
                          min="0"
                          step="any"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Pieces on hand
                        </label>
                        <input
                          type="number"
                          value={piecesOnHand || ''}
                          onChange={(e) => setPiecesOnHand(Number(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                          placeholder="0"
                          min="0"
                          step="1"
                        />
                      </div>
                    </div>
                  </fieldset>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Brand / Manufacturer
                    <span className="ml-1 text-xs font-normal text-amber-600">(prefer adding brands as Vendor Sources below)</span>
                  </label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                    placeholder="e.g., Nobia, Egger, Formica"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    For items with multiple suppliers, track brands via Vendor Sources instead. This avoids duplicate items per brand.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary focus:border-primary resize-none"
                    placeholder="Optional description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                    placeholder="e.g., standard, premium, imported"
                  />
                </div>
              </div>

              {/* Item Type & Structured Naming */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
                    Item Type & Naming
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowStructuredNaming(!showStructuredNaming)}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                  >
                    {showStructuredNaming ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    Structured Naming
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Item Type
                  </label>
                  <select
                    value={itemType}
                    onChange={(e) => setItemType(e.target.value as InventoryItemType)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                  >
                    <option value="standard">Standard (Default)</option>
                    <option value="engineering-parent">Engineering Parent (machining/geometry variants)</option>
                    <option value="purchasing-tier">Purchasing Tier (brand/cost variant)</option>
                    <option value="kit">Kit / Phantom Assembly (non-inventoried)</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    {itemType === 'standard' && 'Regular inventory item — sheet goods, fasteners, adhesives, etc.'}
                    {itemType === 'engineering-parent' && 'Defines a functional group (e.g., "Inset Hinge 110°"). Children are purchasing tiers.'}
                    {itemType === 'purchasing-tier' && 'A specific vendor/brand option under an engineering parent (e.g., "Blum Premium").'}
                    {itemType === 'kit' && 'Phantom assembly — groups components. Stock is tracked on components, not the kit.'}
                  </p>
                </div>

                {/* Structured Naming (collapsible) */}
                {showStructuredNaming && (
                  <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg space-y-3">
                    <p className="text-xs font-medium text-indigo-800 uppercase tracking-wide flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      Structured Name Components
                    </p>
                    <p className="text-xs text-indigo-600">
                      Name items by what they do, not who makes them. Example: &ldquo;Full Overlay — 110° Soft-Close&rdquo; rather than &ldquo;Blum CLIP top 71B3550&rdquo;. Brands are tracked per vendor source.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-indigo-700 mb-1">
                          Function
                        </label>
                        <input
                          type="text"
                          value={structuredFunction}
                          onChange={(e) => setStructuredFunction(e.target.value)}
                          className="w-full px-3 py-1.5 border border-indigo-300 rounded-lg text-sm bg-white focus:ring-1 focus:ring-indigo-500"
                          placeholder="e.g., Inset, Full Overlay"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-indigo-700 mb-1">
                          Key Specs
                        </label>
                        <input
                          type="text"
                          value={structuredKeySpecs}
                          onChange={(e) => setStructuredKeySpecs(e.target.value)}
                          className="w-full px-3 py-1.5 border border-indigo-300 rounded-lg text-sm bg-white focus:ring-1 focus:ring-indigo-500"
                          placeholder="e.g., 110° Soft-Close"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-indigo-700 mb-1">
                          Quality Tier
                        </label>
                        <select
                          value={structuredQualityTier}
                          onChange={(e) => setStructuredQualityTier(e.target.value)}
                          className="w-full px-3 py-1.5 border border-indigo-300 rounded-lg text-sm bg-white focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="">-- None --</option>
                          <option value="Economy">Economy</option>
                          <option value="Standard">Standard</option>
                          <option value="Premium">Premium</option>
                          <option value="Luxury">Luxury</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-indigo-700 mb-1">
                          Brand Name
                        </label>
                        <input
                          type="text"
                          value={structuredBrandName}
                          onChange={(e) => setStructuredBrandName(e.target.value)}
                          className="w-full px-3 py-1.5 border border-indigo-300 rounded-lg text-sm bg-white focus:ring-1 focus:ring-indigo-500"
                          placeholder="e.g., Blum, Salice, Hettich"
                        />
                      </div>
                    </div>

                    {/* Smart SKU preview */}
                    {smartSkuPreview && (
                      <div className="flex items-center justify-between p-2 bg-white rounded border border-indigo-200">
                        <div>
                          <span className="text-xs text-indigo-600 font-medium">Smart SKU: </span>
                          <span className="text-sm font-mono font-bold text-indigo-900">{smartSkuPreview}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSku(smartSkuPreview)}
                          className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
                        >
                          Use this SKU
                        </button>
                      </div>
                    )}

                    {/* Display name preview */}
                    {displayNamePreview && (
                      <div className="flex items-center justify-between p-2 bg-white rounded border border-indigo-200">
                        <div className="min-w-0">
                          <span className="text-xs text-indigo-600 font-medium">Display Name: </span>
                          <span className="text-sm text-indigo-900 truncate">{displayNamePreview}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDisplayName(displayNamePreview)}
                          className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 flex-shrink-0"
                        >
                          Use
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Classification & Supplier */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
                  Classification & Supplier
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Classification *
                    </label>
                    <select
                      value={itemType === 'kit' ? 'kit' : classification}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'kit') {
                          setItemType('kit');
                          setClassification('material');
                        } else {
                          setClassification(val as InventoryClassification);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                    >
                      <option value="material">Material (Raw / Component)</option>
                      <option value="product">Product (Finished / Sellable)</option>
                      <option value="kit">Kit (Phantom Assembly)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Preferred Supplier
                    </label>
                    <SupplierPicker
                      value={supplierValue}
                      onChange={setSupplierValue}
                      label=""
                    />
                  </div>
                </div>

                {classification === 'product' && (
                  <div className="grid grid-cols-2 gap-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-blue-800 mb-1">
                        Shopify Product ID
                      </label>
                      <input
                        type="text"
                        value={shopifyProductId}
                        onChange={(e) => setShopifyProductId(e.target.value)}
                        className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500"
                        placeholder="gid://shopify/Product/..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-blue-800 mb-1">
                        Shopify Variant ID
                      </label>
                      <input
                        type="text"
                        value={shopifyVariantId}
                        onChange={(e) => setShopifyVariantId(e.target.value)}
                        className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500"
                        placeholder="gid://shopify/ProductVariant/..."
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Multi-Supplier Pricing */}
              <SupplierPricingManager
                supplierPricing={supplierPricing}
                preferredSupplierId={supplierValue?.supplierId}
                onAddSupplier={handleAddSupplierPricing}
                onRemoveSupplier={handleRemoveSupplierPricing}
                onSetPreferred={handleSetPreferredSupplier}
                disabled={saving}
                currency={currency}
              />

              {/* Pricing */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
                  Purchase Price &amp; Cost
                </h3>

                {/* Row 1: Purchase price in supplier currency */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Purchase Price
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={costPerUnit}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCostPerUnit(val);
                        // Auto-calculate functional currency cost
                        if (currency !== FUNCTIONAL_CURRENCY) {
                          setFunctionalCurrencyCost(Math.round(val * exchangeRate));
                        } else {
                          setFunctionalCurrencyCost(val);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Purchase Currency
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => {
                        const newCurrency = e.target.value;
                        setCurrency(newCurrency);
                        const newRate = EXCHANGE_RATES_TO_UGX[newCurrency] || 1;
                        setExchangeRate(newRate);
                        if (newCurrency === FUNCTIONAL_CURRENCY) {
                          setFunctionalCurrencyCost(costPerUnit);
                        } else {
                          setFunctionalCurrencyCost(Math.round(costPerUnit * newRate));
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit
                    </label>
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value as InventoryUnit)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                    >
                      {Object.entries(INVENTORY_UNITS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 2: Functional currency cost (shown when purchase currency ≠ UGX) */}
                {currency !== FUNCTIONAL_CURRENCY && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                    <p className="text-xs font-medium text-amber-800 uppercase tracking-wide">
                      Functional Currency ({FUNCTIONAL_CURRENCY})
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-amber-800 mb-1">
                          Exchange Rate (1 {currency} = ? {FUNCTIONAL_CURRENCY})
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={exchangeRate}
                          onChange={(e) => {
                            const rate = parseFloat(e.target.value) || 0;
                            setExchangeRate(rate);
                            setFunctionalCurrencyCost(Math.round(costPerUnit * rate));
                          }}
                          className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:ring-1 focus:ring-amber-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-amber-800 mb-1">
                          Cost in {FUNCTIONAL_CURRENCY}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={functionalCurrencyCost}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setFunctionalCurrencyCost(val);
                            // Back-calculate exchange rate
                            if (costPerUnit > 0) {
                              setExchangeRate(Math.round((val / costPerUnit) * 100) / 100);
                            }
                          }}
                          className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:ring-1 focus:ring-amber-500 bg-white"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-amber-600">
                      {currency} {costPerUnit.toLocaleString()} × {exchangeRate.toLocaleString()} = {FUNCTIONAL_CURRENCY} {functionalCurrencyCost.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {/* UoM Conversion (Purchase → Stock → Consumption) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
                    Unit of Measure Conversion
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowUomConversion(!showUomConversion)}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                  >
                    {showUomConversion ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    {showUomConversion ? 'Hide' : 'Configure'}
                  </button>
                </div>

                {showUomConversion && (
                  <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg space-y-4">
                    <p className="text-xs text-teal-700">
                      Map how you <strong>buy</strong>, <strong>store</strong>, and <strong>consume</strong> this item when they differ.
                      E.g., buy in <em>boxes</em>, store as <em>each</em>, BOM draws in <em>each</em>.
                    </p>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-teal-800 mb-1">
                          Purchase UoM
                        </label>
                        <select
                          value={purchaseUom}
                          onChange={(e) => setPurchaseUom(e.target.value as InventoryUnit)}
                          className="w-full px-3 py-2 border border-teal-300 rounded-lg text-sm bg-white focus:ring-1 focus:ring-teal-500"
                        >
                          <option value="">— Same as pricing unit —</option>
                          {Object.entries(INVENTORY_UNITS).map(([key, label]) => (
                            <option key={key} value={key}>{label} ({key})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-teal-800 mb-1">
                          Stock UoM
                        </label>
                        <select
                          value={stockUom}
                          onChange={(e) => setStockUom(e.target.value as InventoryUnit)}
                          className="w-full px-3 py-2 border border-teal-300 rounded-lg text-sm bg-white focus:ring-1 focus:ring-teal-500"
                        >
                          <option value="">— Same as pricing unit —</option>
                          {Object.entries(INVENTORY_UNITS).map(([key, label]) => (
                            <option key={key} value={key}>{label} ({key})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-teal-800 mb-1">
                          Consumption UoM
                        </label>
                        <select
                          value={consumptionUom}
                          onChange={(e) => setConsumptionUom(e.target.value as InventoryUnit)}
                          className="w-full px-3 py-2 border border-teal-300 rounded-lg text-sm bg-white focus:ring-1 focus:ring-teal-500"
                        >
                          <option value="">— Same as stock unit —</option>
                          {Object.entries(INVENTORY_UNITS).map(([key, label]) => (
                            <option key={key} value={key}>{label} ({key})</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Conversion factor — shown when purchase and stock UoMs differ */}
                    {purchaseUom && stockUom && purchaseUom !== stockUom && (
                      <div className="p-3 bg-white border border-teal-200 rounded-lg">
                        <label className="block text-xs font-medium text-teal-800 mb-1">
                          Conversion Factor
                        </label>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-teal-900">1</span>
                          <span className="px-2 py-0.5 bg-teal-100 text-teal-800 rounded text-xs font-medium">
                            {INVENTORY_UNITS[purchaseUom] || purchaseUom}
                          </span>
                          <ArrowRightLeft className="w-4 h-4 text-teal-500" />
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            value={uomConversion}
                            onChange={(e) => setUomConversion(e.target.value ? parseFloat(e.target.value) : '')}
                            className="w-24 px-3 py-1.5 border border-teal-300 rounded-lg text-sm focus:ring-1 focus:ring-teal-500"
                            placeholder="e.g., 12"
                          />
                          <span className="px-2 py-0.5 bg-teal-100 text-teal-800 rounded text-xs font-medium">
                            {INVENTORY_UNITS[stockUom] || stockUom}
                          </span>
                        </div>
                        {!uomConversion && (
                          <p className="text-xs text-red-600 mt-1">
                            Conversion factor is required when purchase and stock units differ.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Summary preview */}
                    {purchaseUom && stockUom && purchaseUom !== stockUom && typeof uomConversion === 'number' && uomConversion > 0 && (
                      <p className="text-xs text-teal-700 bg-white px-3 py-2 rounded border border-teal-200">
                        When you receive <strong>1 {INVENTORY_UNITS[purchaseUom] || purchaseUom}</strong>, stock will increase by{' '}
                        <strong>{uomConversion} {INVENTORY_UNITS[stockUom] || stockUom}</strong>
                        {consumptionUom && consumptionUom !== stockUom
                          ? `, and BOM will draw in ${INVENTORY_UNITS[consumptionUom] || consumptionUom}.`
                          : '.'}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Dimensions (for sheet goods) */}
              {(category === 'sheet-goods' || category === 'solid-wood') && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
                    Dimensions (mm)
                  </h3>
                  
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Thickness
                      </label>
                      <select
                        value={thickness}
                        onChange={(e) => setThickness(e.target.value ? parseFloat(e.target.value) : '')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                      >
                        <option value="">Custom</option>
                        {COMMON_THICKNESSES.map((t) => (
                          <option key={t} value={t}>{t}mm</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Custom Thickness
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={thickness}
                        onChange={(e) => setThickness(e.target.value ? parseFloat(e.target.value) : '')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                        placeholder="mm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Length
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={length}
                        onChange={(e) => setLength(e.target.value ? parseFloat(e.target.value) : '')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                        placeholder="e.g., 2440"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Width
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={width}
                        onChange={(e) => setWidth(e.target.value ? parseFloat(e.target.value) : '')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                        placeholder="e.g., 1220"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Grain Pattern
                    </label>
                    <select
                      value={grainPattern}
                      onChange={(e) => setGrainPattern(e.target.value as GrainPattern)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                    >
                      <option value="none">None</option>
                      <option value="lengthwise">Lengthwise</option>
                      <option value="crosswise">Crosswise</option>
                      <option value="random">Random</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Fabric / Upholstery roll spec */}
              {isUpholsteryCategory && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
                      Roll Specification
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Drives nesting in the Design Manager. Roll width is fixed by the
                      manufacturer; bay length is the cut section the upholsterer takes
                      off the roll.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Roll Width (mm) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={fabricRollWidth}
                        onChange={(e) => setFabricRollWidth(e.target.value ? parseFloat(e.target.value) : '')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                        placeholder="e.g., 1400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Default Bay Length (mm)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={fabricBayLength}
                        onChange={(e) => setFabricBayLength(e.target.value ? parseFloat(e.target.value) : '')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                        placeholder="e.g., 3000"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      id="fabric-allow-rotation"
                      type="checkbox"
                      checked={fabricAllowRotation}
                      onChange={(e) => setFabricAllowRotation(e.target.checked)}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <label htmlFor="fabric-allow-rotation" className="text-sm text-gray-700">
                      Allow 90° rotation when nesting
                      <span className="text-xs text-gray-500 ml-1">
                        (leave off for fabrics with nap or directional pattern)
                      </span>
                    </label>
                  </div>

                  <div>
                    <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
                      Pattern Repeat (optional)
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Repeat Length (mm)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={fabricPatternRepeatLength}
                          onChange={(e) => setFabricPatternRepeatLength(e.target.value ? parseFloat(e.target.value) : '')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                          placeholder="along roll"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Repeat Width (mm)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={fabricPatternRepeatWidth}
                          onChange={(e) => setFabricPatternRepeatWidth(e.target.value ? parseFloat(e.target.value) : '')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
                          placeholder="across roll"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Linked Materials (only shown when editing) */}
              {itemId && (
                <MaterialLinkManager
                  inventoryItemId={itemId}
                  linkedMaterialIds={linkedMaterialIds}
                  disabled={saving}
                />
              )}
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {itemId ? 'Update' : 'Create'}
          </button>
        </div>
      </div>

      {/* UoM Conversion Recalculation Confirmation */}
      {showConversionRecalcConfirm && pendingSaveData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <ArrowRightLeft className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Recalculate Stock?</h3>
            </div>

            <p className="text-sm text-gray-600">
              The unit conversion factor changed from{' '}
              <strong>{pendingSaveData.oldConv as number}</strong> to{' '}
              <strong>{pendingSaveData.newConv as number}</strong>.
            </p>

            <p className="text-sm text-gray-600">
              Would you like to recalculate existing stock balances using the new conversion factor?
              This will proportionally adjust quantities across all warehouse locations.
            </p>

            <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
              <strong>Example:</strong> If you have 48.8 {stockUom || 'units'} on hand,
              it will become{' '}
              <strong>
                {(48.8 * (pendingSaveData.newConv as number) / (pendingSaveData.oldConv as number)).toFixed(1)} {stockUom || 'units'}
              </strong>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => {
                  setShowConversionRecalcConfirm(false);
                  setPendingSaveData(null);
                  setOriginalUomConversion(uomConversion);
                  onSaved();
                  onClose();
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Skip
              </button>
              <button
                onClick={async () => {
                  try {
                    setSaving(true);
                    await recalculateStockForConversionChange(
                      itemId!,
                      pendingSaveData.oldConv as number,
                      pendingSaveData.newConv as number,
                      userId,
                    );
                    setShowConversionRecalcConfirm(false);
                    setPendingSaveData(null);
                    setOriginalUomConversion(uomConversion);
                    onSaved();
                    onClose();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to recalculate stock');
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Recalculate Stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InventoryItemModal;
