/**
 * InventoryItemDetail Component
 * Slide-over panel showing full item details with stock, cost history, and movements
 */

import { useState, useEffect } from 'react';
import {
  X,
  Package,
  Edit2,
  AlertCircle,
  Loader2,
  Tag,
  DollarSign,
  Box,
  Layers,
  Warehouse,
  ArrowRightLeft,
  TrendingUp,
  History,
  Building2,
  GitBranch,
  Sparkles,
  Palette,
  Trash2,
  Unlock,
} from 'lucide-react';
import { ReclassifyAsVariantDialog } from './ReclassifyAsVariantDialog';
import { ConvertToFamilyDialog } from './ConvertToFamilyDialog';
import { DeleteMaterialDialog } from './DeleteMaterialDialog';
import { UnreserveStockDialog } from './UnreserveStockDialog';
import {
  getInventoryItem,
  addSupplierPricing,
  removeSupplierPricing,
  setPreferredSupplier,
} from '../services/inventoryService';
import SupplierPricingManager from './SupplierPricingManager';
import { useStockLevels } from '../hooks/useStockLevels';
import { useWarehouses } from '../hooks/useWarehouses';
import { useSubsidiary } from '@/contexts/SubsidiaryContext';
import { useAuth } from '@/contexts/AuthContext';
import type { InventoryItem, InventoryUnit } from '../types';
import { INVENTORY_SOURCE_LABELS, INVENTORY_UNITS } from '../types';
import { useCategories } from '../hooks/useCategories';
import CostHistoryChart from './CostHistoryChart';
import StockMovementHistory from './StockMovementHistory';
import StockTransferDialog from './StockTransferDialog';
import { SupplierCostAnalysis } from './SupplierCostAnalysis';
import { VariantManager } from './VariantManager';
import { FamilyOverviewCard } from './FamilyOverviewCard';
import { FamilySkuList } from './FamilySkuList';
import { AIEnhancementPanel } from './AIEnhancementPanel';
import { LinkedMaterialsTab } from './LinkedMaterialsTab';
import { VendorSourceManager } from './VendorSourceManager';
import { KitBuilder } from './KitBuilder';
import { ProductFinishConfig } from './finishes/ProductFinishConfig';
import { updateInventoryItem } from '../services/inventoryService';
import { recalculateStockForConversionChange } from '../services/stockLevelService';
import type { VendorSource } from '../types';
import { Timestamp } from 'firebase/firestore';
import { getItemDisplayName } from '../utils/structuredNameDisplay';

type DetailTab = 'overview' | 'materials' | 'suppliers' | 'variants' | 'stock' | 'cost-history' | 'movements' | 'finishes';

/** Inline-editable UoM conversion section for the detail panel */
function UomConversionSection({ item, onUpdated }: { item: InventoryItem; onUpdated: () => Promise<void> }) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [purchaseUom, setPurchaseUom] = useState<InventoryUnit | ''>(item.purchaseUom || '');
  const [stockUom, setStockUom] = useState<InventoryUnit | ''>(item.stockUom || '');
  const [consumptionUom, setConsumptionUom] = useState<InventoryUnit | ''>(item.consumptionUom || '');
  const [uomConversion, setUomConversion] = useState<number | ''>(item.uomConversion || '');

  // Sync local state when item changes externally
  useEffect(() => {
    setPurchaseUom(item.purchaseUom || '');
    setStockUom(item.stockUom || '');
    setConsumptionUom(item.consumptionUom || '');
    setUomConversion(item.uomConversion || '');
  }, [item.purchaseUom, item.stockUom, item.consumptionUom, item.uomConversion]);

  const [showRecalc, setShowRecalc] = useState(false);
  const [recalcOldFactor, setRecalcOldFactor] = useState<number>(0);
  const [recalcNewFactor, setRecalcNewFactor] = useState<number>(0);
  const [recalculating, setRecalculating] = useState(false);
  const [recalcResult, setRecalcResult] = useState<{ adjustedLocations: number; totalDelta: number } | null>(null);
  const [recalcError, setRecalcError] = useState<string | null>(null);

  const needsConversion = purchaseUom && stockUom && purchaseUom !== stockUom;
  const hasData = item.purchaseUom || item.stockUom;
  const hasStockAndConversion = item.uomConversion && item.uomConversion > 0 && (item.inventory?.inStock ?? 0) > 0;

  const handleSave = async () => {
    if (!user) return;
    if (needsConversion && !uomConversion) return;
    setSaving(true);
    try {
      const oldConv = item.uomConversion || 0;
      const newConv = typeof uomConversion === 'number' ? uomConversion : 0;

      await updateInventoryItem(item.id, {
        purchaseUom: purchaseUom || undefined,
        stockUom: stockUom || undefined,
        consumptionUom: consumptionUom || undefined,
        uomConversion: (needsConversion && typeof uomConversion === 'number') ? uomConversion : undefined,
      } as any, user.uid);

      // If conversion changed and there's stock, prompt recalculation
      if (oldConv > 0 && newConv > 0 && oldConv !== newConv) {
        setRecalcOldFactor(oldConv);
        setRecalcNewFactor(newConv);
        setShowRecalc(true);
      }

      await onUpdated();
      setEditing(false);
    } catch (err) {
      console.error('Failed to save UoM conversion:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRecalculate = async () => {
    if (!user || recalcOldFactor <= 0 || recalcNewFactor <= 0) return;
    setRecalculating(true);
    setRecalcError(null);
    setRecalcResult(null);
    try {
      const result = await recalculateStockForConversionChange(
        item.id,
        recalcOldFactor,
        recalcNewFactor,
        user.uid,
      );
      setRecalcResult(result);
      await onUpdated();
      if (result.adjustedLocations === 0) {
        setRecalcError('No stock levels found to adjust. The item may have zero stock.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to recalculate stock';
      setRecalcError(msg);
      console.error('Recalculate stock error:', err);
    } finally {
      setRecalculating(false);
    }
  };

  const handleManualRecalc = () => {
    setRecalcOldFactor(0);
    setRecalcNewFactor(item.uomConversion || 0);
    setShowRecalc(true);
  };

  // Read-only view
  if (!editing) {
    return (
      <div className="bg-teal-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-teal-600" />
            <h4 className="font-medium text-gray-900">Unit Conversion</h4>
          </div>
          <div className="flex items-center gap-2">
            {hasStockAndConversion && !editing && (
              <button
                onClick={handleManualRecalc}
                className="text-xs text-amber-700 hover:text-amber-900 font-medium flex items-center gap-1"
              >
                <ArrowRightLeft className="w-3 h-3" />
                Recalculate
              </button>
            )}
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-teal-700 hover:text-teal-900 font-medium"
            >
              {hasData ? 'Edit' : 'Configure'}
            </button>
          </div>
        </div>
        {hasData ? (
          <>
            <div className="grid grid-cols-3 gap-4">
              {item.purchaseUom && (
                <div>
                  <p className="text-xs text-teal-700 uppercase">Purchase In</p>
                  <p className="text-sm font-medium text-gray-900">
                    {INVENTORY_UNITS[item.purchaseUom] || item.purchaseUom}
                  </p>
                </div>
              )}
              {item.stockUom && (
                <div>
                  <p className="text-xs text-teal-700 uppercase">Track As</p>
                  <p className="text-sm font-medium text-gray-900">
                    {INVENTORY_UNITS[item.stockUom] || item.stockUom}
                  </p>
                </div>
              )}
              {item.consumptionUom && (
                <div>
                  <p className="text-xs text-teal-700 uppercase">BOM Draws In</p>
                  <p className="text-sm font-medium text-gray-900">
                    {INVENTORY_UNITS[item.consumptionUom] || item.consumptionUom}
                  </p>
                </div>
              )}
            </div>
            {item.purchaseUom && item.stockUom && item.purchaseUom !== item.stockUom && item.uomConversion && (
              <div className="mt-3 bg-white px-3 py-2 rounded border border-teal-200 flex items-center gap-2">
                <span className="text-sm font-medium text-teal-900">1</span>
                <span className="px-2 py-0.5 bg-teal-100 text-teal-800 rounded text-xs font-medium">
                  {INVENTORY_UNITS[item.purchaseUom] || item.purchaseUom}
                </span>
                <ArrowRightLeft className="w-3.5 h-3.5 text-teal-500" />
                <span className="text-sm font-bold text-teal-900">{item.uomConversion}</span>
                <span className="px-2 py-0.5 bg-teal-100 text-teal-800 rounded text-xs font-medium">
                  {INVENTORY_UNITS[item.stockUom] || item.stockUom}
                </span>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-teal-600">
            No unit conversion configured. Click <strong>Configure</strong> to map purchase, stock, and consumption units.
          </p>
        )}
      </div>
    );
  }

  // Editing view
  return (
    <div className="bg-teal-50 rounded-lg p-4 space-y-4 ring-2 ring-teal-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-teal-600" />
          <h4 className="font-medium text-gray-900">Unit Conversion</h4>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setEditing(false); setPurchaseUom(item.purchaseUom || ''); setStockUom(item.stockUom || ''); setConsumptionUom(item.consumptionUom || ''); setUomConversion(item.uomConversion || ''); }}
            className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (!!needsConversion && !uomConversion)}
            className="px-3 py-1 text-xs font-medium text-white bg-teal-600 rounded hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <p className="text-xs text-teal-700">
        Map how you <strong>buy</strong>, <strong>store</strong>, and <strong>consume</strong> this item when they differ.
      </p>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-teal-800 mb-1">Purchase UoM</label>
          <select
            value={purchaseUom}
            onChange={(e) => setPurchaseUom(e.target.value as InventoryUnit)}
            className="w-full px-2 py-1.5 border border-teal-300 rounded-lg text-sm bg-white focus:ring-1 focus:ring-teal-500"
          >
            <option value="">— Same as pricing —</option>
            {Object.entries(INVENTORY_UNITS).map(([key, label]) => (
              <option key={key} value={key}>{label} ({key})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-teal-800 mb-1">Stock UoM</label>
          <select
            value={stockUom}
            onChange={(e) => setStockUom(e.target.value as InventoryUnit)}
            className="w-full px-2 py-1.5 border border-teal-300 rounded-lg text-sm bg-white focus:ring-1 focus:ring-teal-500"
          >
            <option value="">— Same as pricing —</option>
            {Object.entries(INVENTORY_UNITS).map(([key, label]) => (
              <option key={key} value={key}>{label} ({key})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-teal-800 mb-1">Consumption UoM</label>
          <select
            value={consumptionUom}
            onChange={(e) => setConsumptionUom(e.target.value as InventoryUnit)}
            className="w-full px-2 py-1.5 border border-teal-300 rounded-lg text-sm bg-white focus:ring-1 focus:ring-teal-500"
          >
            <option value="">— Same as stock —</option>
            {Object.entries(INVENTORY_UNITS).map(([key, label]) => (
              <option key={key} value={key}>{label} ({key})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Conversion factor — always visible when purchase ≠ stock */}
      {needsConversion && (
        <div className="p-3 bg-white border border-teal-200 rounded-lg">
          <label className="block text-xs font-medium text-teal-800 mb-1">Conversion Factor</label>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-teal-900">1</span>
            <span className="px-2 py-0.5 bg-teal-100 text-teal-800 rounded text-xs font-medium">
              {INVENTORY_UNITS[purchaseUom as InventoryUnit] || purchaseUom}
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
              {INVENTORY_UNITS[stockUom as InventoryUnit] || stockUom}
            </span>
          </div>
          {!uomConversion && (
            <p className="text-xs text-red-600 mt-1">Required when purchase and stock units differ.</p>
          )}
        </div>
      )}

      {/* Live preview */}
      {needsConversion && typeof uomConversion === 'number' && uomConversion > 0 && (
        <p className="text-xs text-teal-700 bg-white px-3 py-2 rounded border border-teal-200">
          When you receive <strong>1 {INVENTORY_UNITS[purchaseUom as InventoryUnit] || purchaseUom}</strong>, stock increases by{' '}
          <strong>{uomConversion} {INVENTORY_UNITS[stockUom as InventoryUnit] || stockUom}</strong>
          {consumptionUom && consumptionUom !== stockUom
            ? `, and BOM draws in ${INVENTORY_UNITS[consumptionUom as InventoryUnit] || consumptionUom}.`
            : '.'}
        </p>
      )}

      {/* Recalculation Panel */}
      {showRecalc && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
          <h5 className="text-sm font-medium text-amber-900 flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4" />
            Recalculate Stock Balances
          </h5>
          <p className="text-xs text-amber-800">
            Adjust existing stock quantities based on a conversion factor change.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-amber-700 font-medium">Old Factor</label>
              <input
                type="number"
                min="0.001"
                step="any"
                value={recalcOldFactor || ''}
                onChange={(e) => setRecalcOldFactor(parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1.5 border border-amber-300 rounded text-sm"
                placeholder="Previous factor"
              />
            </div>
            <div>
              <label className="text-xs text-amber-700 font-medium">New Factor</label>
              <input
                type="number"
                min="0.001"
                step="any"
                value={recalcNewFactor || ''}
                onChange={(e) => setRecalcNewFactor(parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1.5 border border-amber-300 rounded text-sm"
                placeholder="Current factor"
              />
            </div>
          </div>
          {recalcOldFactor > 0 && recalcNewFactor > 0 && recalcOldFactor !== recalcNewFactor && (
            <p className="text-xs text-amber-700">
              Ratio: <strong>{(recalcNewFactor / recalcOldFactor).toFixed(4)}</strong> — stock will be multiplied by this factor.
              {(item.inventory?.inStock ?? 0) > 0 && (
                <> Current {item.inventory!.inStock} {item.stockUom ? INVENTORY_UNITS[item.stockUom] : 'units'} will become{' '}
                <strong>{(item.inventory!.inStock * recalcNewFactor / recalcOldFactor).toFixed(1)}</strong>.</>
              )}
            </p>
          )}
          {recalcResult && recalcResult.adjustedLocations > 0 && (
            <p className="text-xs text-green-700 font-medium bg-green-50 px-2 py-1.5 rounded">
              Done — {recalcResult.adjustedLocations} location{recalcResult.adjustedLocations !== 1 ? 's' : ''} adjusted, delta: {recalcResult.totalDelta > 0 ? '+' : ''}{recalcResult.totalDelta.toFixed(2)}
            </p>
          )}
          {recalcError && (
            <p className="text-xs text-red-700 font-medium bg-red-50 px-2 py-1.5 rounded flex items-center gap-1">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              {recalcError}
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowRecalc(false); setRecalcResult(null); setRecalcError(null); }}
              className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded"
            >
              {recalcResult ? 'Close' : 'Cancel'}
            </button>
            {!recalcResult && (
              <button
                onClick={handleRecalculate}
                disabled={recalculating || recalcOldFactor <= 0 || recalcNewFactor <= 0 || recalcOldFactor === recalcNewFactor}
                className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded disabled:opacity-50 flex items-center gap-1"
              >
                {recalculating && <Loader2 className="w-3 h-3 animate-spin" />}
                Recalculate
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface InventoryItemDetailProps {
  itemId: string;
  onClose: () => void;
  onEdit: () => void;
}

export function InventoryItemDetail({
  itemId,
  onClose,
  onEdit,
}: InventoryItemDetailProps) {
  const { user } = useAuth();
  const { currentSubsidiary } = useSubsidiary();
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [transferOpen, setTransferOpen] = useState(false);
  const [selectedStockLevelId, setSelectedStockLevelId] = useState<string | null>(null);
  const [aiEnhanceOpen, setAiEnhanceOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reclassifyDialogOpen, setReclassifyDialogOpen] = useState(false);
  const [convertToFamilyOpen, setConvertToFamilyOpen] = useState(false);
  const [unreserveTarget, setUnreserveTarget] = useState<{
    warehouseId: string;
    warehouseName: string;
    currentReserved: number;
  } | null>(null);

  // Stock and cost hooks
  const { stockLevels, aggregated, loading: stockLoading, offcutCount, offcutValue } = useStockLevels(
    itemId,
    item?.name || item?.displayName || undefined,
  );
  const { warehouses } = useWarehouses(currentSubsidiary?.id || null);
  const { bySlug: categoryBySlug } = useCategories();

  // Family rollup (only fetches when item is a family)
  const [familyRollup, setFamilyRollup] = useState<import('../types').FamilyStockRollup | null>(null);
  const [familyRollupLoading, setFamilyRollupLoading] = useState(false);
  useEffect(() => {
    if (!item?.isFamily) { setFamilyRollup(null); return; }
    let cancelled = false;
    setFamilyRollupLoading(true);
    import('../services/inventoryService').then(({ getFamilyStockRollup }) =>
      getFamilyStockRollup(item.id)
    ).then((data) => {
      if (!cancelled) setFamilyRollup(data);
    }).catch(() => {}).finally(() => {
      if (!cancelled) setFamilyRollupLoading(false);
    });
    return () => { cancelled = true; };
  }, [item?.isFamily, item?.id]);

  useEffect(() => {
    loadItem();
  }, [itemId]);

  const loadItem = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getInventoryItem(itemId);
      setItem(data);
    } catch (err) {
      setError('Failed to load item details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Never';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'discontinued':
        return 'bg-gray-100 text-gray-600';
      case 'out-of-stock':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getWarehouseName = (warehouseId: string) => {
    const wh = warehouses.find(w => w.id === warehouseId);
    return wh ? `${wh.name} (${wh.code})` : warehouseId.slice(0, 8) + '...';
  };

  const formatMoney = (amount: number | undefined, currency: string) => {
    if (amount == null || Number.isNaN(amount)) return '--';
    return `${currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  };

  // Cost integrity model:
  // Purchase Cost (supplier-facing) -> UoM conversion -> Inventory Valuation/Pricing Cost (stock-facing).
  const purchaseCurrency = item?.pricing?.currency || 'UGX';
  const purchaseCostPerUnit = item?.pricing?.costPerUnit || 0;
  const purchaseUnit = item?.purchaseUom || item?.pricing?.unit || 'ea';
  const stockUnit = item?.stockUom || purchaseUnit;
  const conversionFactor = item?.uomConversion || 0;
  const conversionRequired = purchaseUnit !== stockUnit;
  const conversionValid = !conversionRequired || conversionFactor > 0;

  const functionalCurrency = 'UGX';
  const purchaseCostFunctional =
    item?.pricing?.functionalCurrencyCost ??
    (purchaseCurrency === functionalCurrency ? purchaseCostPerUnit : undefined);

  const stockCostFunctional =
    purchaseCostFunctional != null
      ? (conversionRequired && conversionValid
          ? purchaseCostFunctional / conversionFactor
          : purchaseCostFunctional)
      : undefined;
  const inventoryValueFunctional =
    stockCostFunctional != null ? aggregated.totalOnHand * stockCostFunctional : undefined;

  const detailTabs: { id: DetailTab; label: string; icon: typeof Package; show: boolean }[] = [
    { id: 'overview', label: 'Overview', icon: Package, show: true },
    { id: 'materials', label: 'Materials', icon: Palette, show: true },
    { id: 'suppliers', label: 'Suppliers', icon: Building2, show: true },
    { id: 'variants', label: item?.isFamily ? 'SKUs' : 'Variants', icon: GitBranch, show: !item?.parentItemId },
    { id: 'stock', label: 'Stock', icon: Warehouse, show: !item?.isFamily },
    { id: 'cost-history', label: 'Costs', icon: TrendingUp, show: !item?.isFamily },
    { id: 'movements', label: 'Movements', icon: History, show: !item?.isFamily },
    { id: 'finishes', label: 'Finishes', icon: Palette, show: true },
  ];
  const DETAIL_TABS = detailTabs.filter(t => t.show);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-white w-full max-w-2xl shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Item Details</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAiEnhanceOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100"
            >
              <Sparkles className="w-4 h-4" />
              AI Enhance
            </button>
            {/* Make Variant — only for standalone items that are not parents/families */}
            {item && !item.parentItemId && !item.isVariantParent && !item.isFamily && !item.familyId && (
              <>
                <button
                  onClick={() => setReclassifyDialogOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100"
                >
                  <GitBranch className="w-4 h-4" />
                  Make Variant Of...
                </button>
                <button
                  onClick={() => setConvertToFamilyOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100"
                >
                  <Package className="w-4 h-4" />
                  Convert to Family
                </button>
              </>
            )}
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={() => setDeleteDialogOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        {!loading && item && (
          <div className="border-b border-gray-200 px-6">
            <nav className="-mb-px flex space-x-6">
              {DETAIL_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 py-3 border-b-2 text-xs font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="p-6">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            </div>
          ) : item ? (
            <>
              {/* ============ OVERVIEW TAB ============ */}
              {activeTab === 'overview' && (
                <div className="p-6 space-y-6">
                  {/* Header Info */}
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-mono text-gray-500">{item.sku}</p>
                        <h3 className="text-xl font-semibold text-gray-900 mt-1">
                          {getItemDisplayName(item)}
                        </h3>
                        {getItemDisplayName(item) !== item.name && (
                          <p className="text-sm text-gray-500 mt-0.5">{item.name}</p>
                        )}
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                    </div>

                    {item.description && (
                      <p className="text-gray-600 mt-3">{item.description}</p>
                    )}
                  </div>

                  {/* Classification, Category & Source */}
                  <div className="flex flex-wrap gap-2">
                    {/* Item Type badge (parametric) */}
                    {item.itemType && item.itemType !== 'standard' && (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${
                        item.itemType === 'kit'
                          ? 'bg-purple-100 text-purple-700'
                          : item.itemType === 'engineering-parent'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-cyan-100 text-cyan-700'
                      }`}>
                        {item.itemType === 'kit' && 'Kit'}
                        {item.itemType === 'engineering-parent' && 'Engineering Parent'}
                        {item.itemType === 'purchasing-tier' && 'Purchasing Tier'}
                      </span>
                    )}
                    {item.classification && (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${
                        item.classification === 'product'
                          ? 'bg-blue-100 text-blue-700'
                          : item.classification === 'kit'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}>
                        {item.classification === 'product' ? 'Product' : item.classification === 'kit' ? 'Kit' : 'Material'}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg text-sm">
                      {categoryBySlug.get(item.category)?.icon ?? ''}
                      {categoryBySlug.get(item.category)?.name ?? item.category}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${INVENTORY_SOURCE_LABELS[item.source]?.color}`}>
                      {INVENTORY_SOURCE_LABELS[item.source]?.label}
                    </span>
                    {item.brand && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm">
                        {item.brand}
                      </span>
                    )}
                    {(item.vendorSources?.length ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 rounded-lg text-sm">
                        <Building2 className="w-3.5 h-3.5" />
                        {item.vendorSources!.length} vendor{item.vendorSources!.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    {item.isFamily && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm">
                        <Layers className="w-3.5 h-3.5" />
                        Family ({item.skuIds?.length || familyRollup?.variantCount || 0} SKUs)
                      </span>
                    )}
                    {item.isVariantParent && !item.isFamily && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 text-violet-700 rounded-lg text-sm">
                        <GitBranch className="w-3.5 h-3.5" />
                        {item.variantIds?.length || 0} variants
                      </span>
                    )}
                    {item.parentItemId && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 text-violet-700 rounded-lg text-sm">
                        <GitBranch className="w-3.5 h-3.5" />
                        Variant
                      </span>
                    )}
                  </div>

                  {/* Structured Name (parametric) */}
                  {item.structuredName && (
                    <div className="bg-indigo-50 rounded-lg p-4">
                      <h4 className="text-xs text-indigo-600 uppercase font-medium mb-2">Structured Name</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {item.structuredName.function && (
                          <div>
                            <span className="text-xs text-indigo-500">Function: </span>
                            <span className="font-medium text-indigo-900">{item.structuredName.function}</span>
                          </div>
                        )}
                        {item.structuredName.keySpecs && (
                          <div>
                            <span className="text-xs text-indigo-500">Key Specs: </span>
                            <span className="font-medium text-indigo-900">{item.structuredName.keySpecs}</span>
                          </div>
                        )}
                        {item.structuredName.qualityTier && (
                          <div>
                            <span className="text-xs text-indigo-500">Quality Tier: </span>
                            <span className="font-medium text-indigo-900">{item.structuredName.qualityTier}</span>
                          </div>
                        )}
                        {item.structuredName.brandName && (
                          <div>
                            <span className="text-xs text-indigo-500">Brand: </span>
                            <span className="font-medium text-indigo-900">{item.structuredName.brandName}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Supplier */}
                  {item.preferredSupplierName && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-xs text-gray-500 uppercase mb-1">Preferred Supplier</h4>
                      <p className="text-sm font-medium text-gray-900">{item.preferredSupplierName}</p>
                    </div>
                  )}

                  {/* Shopify IDs (for products) */}
                  {item.classification === 'product' && (item.shopifyProductId || item.shopifyVariantId) && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="text-xs text-blue-700 uppercase mb-2">Shopify Integration</h4>
                      <div className="space-y-1 text-sm">
                        {item.shopifyProductId && (
                          <p className="text-blue-800">
                            Product: <span className="font-mono text-xs">{item.shopifyProductId}</span>
                          </p>
                        )}
                        {item.shopifyVariantId && (
                          <p className="text-blue-800">
                            Variant: <span className="font-mono text-xs">{item.shopifyVariantId}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Kit Components (for kit items) */}
                  {item.itemType === 'kit' && user && (
                    <KitBuilder
                      kitItemId={item.id}
                      kitComponents={item.kitComponents || []}
                      userId={user.uid}
                      onUpdated={loadItem}
                    />
                  )}

                  {/* Family Overview Card (replaces pricing/stock for family items) */}
                  {item.isFamily && (
                    <FamilyOverviewCard
                      rollup={familyRollup}
                      loading={familyRollupLoading}
                      onViewVariants={() => setActiveTab('variants')}
                      skuCount={item.skuIds?.length}
                    />
                  )}

                  {/* Pricing Section (non-family items only) */}
                  {!item.isFamily && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <DollarSign className="w-4 h-4 text-gray-500" />
                      <h4 className="font-medium text-gray-900">Cost Integrity (Purchase vs Inventory Valuation)</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-white border border-gray-200 rounded-lg p-3">
                        <p className="text-xs text-gray-500 uppercase">Purchase Cost (Supplier-facing)</p>
                        <p className="text-lg font-semibold text-gray-900 mt-1">
                          {formatMoney(purchaseCostPerUnit, purchaseCurrency)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          per {INVENTORY_UNITS[purchaseUnit] || purchaseUnit}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-2">
                          Used for purchase orders and supplier negotiations.
                        </p>
                      </div>

                      <div className="bg-white border border-gray-200 rounded-lg p-3">
                        <p className="text-xs text-gray-500 uppercase">Inventory Valuation & Pricing Cost</p>
                        <p className="text-lg font-semibold text-gray-900 mt-1">
                          {formatMoney(stockCostFunctional, functionalCurrency)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          per {INVENTORY_UNITS[stockUnit] || stockUnit} ({functionalCurrency})
                        </p>
                        <p className="text-[11px] text-gray-500 mt-2">
                          Used for inventory value tracking and internal pricing baselines.
                        </p>
                      </div>
                    </div>

                    <div className={`mt-3 p-2 rounded border text-xs ${
                      conversionValid ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'
                    }`}>
                      {conversionRequired ? (
                        conversionValid ? (
                          <>
                            UoM cost link: <strong>1 {INVENTORY_UNITS[purchaseUnit] || purchaseUnit}</strong> ={' '}
                            <strong>{conversionFactor}</strong> <strong>{INVENTORY_UNITS[stockUnit] || stockUnit}</strong>. Valuation cost is derived from purchase cost using this factor.
                          </>
                        ) : (
                          <>
                            Purchase and stock units differ, but conversion factor is missing/invalid. Inventory value accuracy is at risk until conversion is fixed.
                          </>
                        )
                      ) : (
                        <>
                          Purchase and stock units match, so purchase cost equals valuation cost per unit.
                        </>
                      )}
                    </div>

                    {inventoryValueFunctional != null && (
                      <div className="mt-2 text-xs text-gray-600">
                        Estimated on-hand valuation: <strong>{formatMoney(inventoryValueFunctional, functionalCurrency)}</strong>
                        {' '}({aggregated.totalOnHand} {INVENTORY_UNITS[stockUnit] || stockUnit} on hand).
                      </div>
                    )}

                    {item.pricing?.exchangeRate != null && item.pricing.currency !== 'UGX' && (
                      <p className="text-xs text-gray-500 mt-2">
                        FX reference: 1 {item.pricing.currency} = {item.pricing.exchangeRate.toLocaleString()} UGX
                      </p>
                    )}
                  </div>
                  )}

                  {/* UoM Conversion — inline editable */}
                  <UomConversionSection item={item} onUpdated={loadItem} />

                  {/* Stock Summary (non-family items only) */}
                  {!item.isFamily && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Box className="w-4 h-4 text-gray-500" />
                        <h4 className="font-medium text-gray-900">Stock Summary</h4>
                      </div>
                      {stockLevels.length > 0 && (
                        <button
                          onClick={() => setActiveTab('stock')}
                          className="text-xs text-primary hover:underline"
                        >
                          View by location
                        </button>
                      )}
                    </div>
                    <div className={`grid ${offcutCount > 0 ? 'grid-cols-5' : 'grid-cols-4'} gap-4`}>
                      <div>
                        <p className="text-xs text-gray-500 uppercase">On Hand</p>
                        <p className={`text-lg font-semibold ${
                          aggregated.totalOnHand > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {stockLoading ? '...' : aggregated.totalOnHand}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Reserved</p>
                        <p className="text-lg font-medium text-amber-600">
                          {stockLoading ? '...' : aggregated.totalReserved}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Available</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {stockLoading ? '...' : aggregated.totalAvailable}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Valuation (UGX)</p>
                        <p className="text-lg font-semibold text-indigo-700">
                          {stockLoading ? '...' : (inventoryValueFunctional != null
                            ? Math.round(inventoryValueFunctional).toLocaleString()
                            : '--')}
                        </p>
                      </div>
                      {offcutCount > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 uppercase">Offcuts</p>
                          <p className="text-lg font-semibold text-emerald-600">
                            {offcutCount}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {offcutValue.toLocaleString()} UGX
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  )}

                  {/* Dimensions Section */}
                  {item.dimensions && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Layers className="w-4 h-4 text-gray-500" />
                        <h4 className="font-medium text-gray-900">Dimensions</h4>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        {item.dimensions.thickness && (
                          <div>
                            <p className="text-xs text-gray-500 uppercase">Thickness</p>
                            <p className="text-sm font-medium text-gray-900">
                              {item.dimensions.thickness}mm
                            </p>
                          </div>
                        )}
                        {item.dimensions.length && (
                          <div>
                            <p className="text-xs text-gray-500 uppercase">Length</p>
                            <p className="text-sm font-medium text-gray-900">
                              {item.dimensions.length}mm
                            </p>
                          </div>
                        )}
                        {item.dimensions.width && (
                          <div>
                            <p className="text-xs text-gray-500 uppercase">Width</p>
                            <p className="text-sm font-medium text-gray-900">
                              {item.dimensions.width}mm
                            </p>
                          </div>
                        )}
                      </div>
                      {item.grainPattern && item.grainPattern !== 'none' && (
                        <p className="text-sm text-gray-600 mt-2">
                          Grain: {item.grainPattern}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Fabric / Upholstery roll spec */}
                  {item.fabricSpec && item.fabricSpec.rollWidth > 0 && (
                    <div className="bg-fuchsia-50 border border-fuchsia-100 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Layers className="w-4 h-4 text-fuchsia-600" />
                        <h4 className="font-medium text-gray-900">Roll Specification</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 uppercase">Roll Width</p>
                          <p className="text-sm font-medium text-gray-900">
                            {item.fabricSpec.rollWidth} mm
                          </p>
                        </div>
                        {item.fabricSpec.defaultBayLength && (
                          <div>
                            <p className="text-xs text-gray-500 uppercase">Default Bay Length</p>
                            <p className="text-sm font-medium text-gray-900">
                              {item.fabricSpec.defaultBayLength} mm
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-gray-500 uppercase">Rotation</p>
                          <p className="text-sm font-medium text-gray-900">
                            {item.fabricSpec.allowRotation ? 'Allowed' : 'Not allowed (nap/pattern)'}
                          </p>
                        </div>
                        {item.fabricSpec.patternRepeat && (
                          <div>
                            <p className="text-xs text-gray-500 uppercase">Pattern Repeat</p>
                            <p className="text-sm font-medium text-gray-900">
                              {item.fabricSpec.patternRepeat.length} × {item.fabricSpec.patternRepeat.width} mm
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {item.tags && item.tags.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Tag className="w-4 h-4 text-gray-500" />
                        <h4 className="font-medium text-gray-900">Tags</h4>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {item.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Aliases */}
                  {item.aliases && item.aliases.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Also known as</h4>
                      <div className="flex flex-wrap gap-2">
                        {item.aliases.map((alias, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm"
                          >
                            {alias}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="border-t pt-4 text-xs text-gray-500 space-y-1">
                    <p>Created: {formatDate(item.createdAt)} by {item.createdBy}</p>
                    <p>Updated: {formatDate(item.updatedAt)} by {item.updatedBy}</p>
                  </div>
                </div>
              )}

              {/* ============ MATERIALS TAB ============ */}
              {activeTab === 'materials' && user && (
                <div className="p-6">
                  <LinkedMaterialsTab
                    inventoryItemId={item.id}
                    inventoryItemName={item.displayName || item.name}
                    inventoryItemSku={item.sku}
                    userId={user.uid}
                  />
                </div>
              )}

              {/* ============ SUPPLIERS TAB ============ */}
              {activeTab === 'suppliers' && user && (
                <div className="p-6 space-y-6">
                  {/* Vendor Sources (MPN-decoupled) */}
                  <VendorSourceManager
                    vendorSources={item.vendorSources || []}
                    onAdd={async (sourceData) => {
                      const newSource: VendorSource = {
                        ...sourceData,
                        id: crypto.randomUUID(),
                        addedAt: Timestamp.now(),
                        addedBy: user.uid,
                      };
                      const updated = [...(item.vendorSources || [])];
                      if (newSource.isPreferred) {
                        updated.forEach((s) => { s.isPreferred = false; });
                      }
                      updated.push(newSource);
                      await updateInventoryItem(item.id, { vendorSources: updated } as any, user.uid);
                      await loadItem();
                    }}
                    onRemove={async (sourceId) => {
                      const updated = (item.vendorSources || []).filter((s) => s.id !== sourceId);
                      await updateInventoryItem(item.id, { vendorSources: updated } as any, user.uid);
                      await loadItem();
                    }}
                    onSetPreferred={async (sourceId) => {
                      const updated = (item.vendorSources || []).map((s) => ({
                        ...s,
                        isPreferred: s.id === sourceId,
                      }));
                      await updateInventoryItem(item.id, { vendorSources: updated } as any, user.uid);
                      await loadItem();
                    }}
                    defaultCurrency={item.pricing?.currency}
                    defaultUnit={item.pricing?.unit}
                  />

                  {(item.vendorSources?.length ?? 0) > 0 && (item.supplierPricing?.length ?? 0) > 0 && (
                    <div className="border-t border-gray-200" />
                  )}

                  {/* Legacy Supplier Pricing */}
                  <SupplierPricingManager
                    supplierPricing={item.supplierPricing || []}
                    preferredSupplierId={item.preferredSupplierId}
                    onAddSupplier={async (pricing, setPreferred) => {
                      await addSupplierPricing(item.id, pricing, user.uid, setPreferred);
                      await loadItem();
                    }}
                    onRemoveSupplier={async (supplierId) => {
                      await removeSupplierPricing(item.id, supplierId, user.uid);
                      await loadItem();
                    }}
                    onSetPreferred={async (supplierId) => {
                      await setPreferredSupplier(item.id, supplierId, user.uid);
                      await loadItem();
                    }}
                    currency={item.pricing?.currency}
                  />

                  {(item.supplierPricing?.length ?? 0) >= 2 && (
                    <>
                      <div className="border-t border-gray-200" />
                      <SupplierCostAnalysis
                        supplierPricing={item.supplierPricing!}
                        itemName={item.displayName || item.name}
                        currency={item.pricing?.currency}
                      />
                    </>
                  )}
                </div>
              )}

              {/* ============ VARIANTS / SKUs TAB ============ */}
              {activeTab === 'variants' && !item.parentItemId && user && (
                <div className="p-6">
                  {item.isFamily ? (
                    <FamilySkuList
                      familyId={item.id}
                      familyItem={item}
                      userId={user.uid}
                      onSkuClick={(sku) => {
                        // Navigate to child SKU detail by reloading with child ID
                        setItem(null);
                        setLoading(true);
                        getInventoryItem(sku.id).then((data) => {
                          setItem(data);
                          setActiveTab('overview');
                        }).catch(() => {
                          setError('Failed to load SKU details');
                        }).finally(() => setLoading(false));
                      }}
                    />
                  ) : (
                    <VariantManager
                      parentItemId={item.id}
                      parentItem={item}
                      userId={user.uid}
                    />
                  )}
                </div>
              )}

              {/* ============ STOCK TAB ============ */}
              {activeTab === 'stock' && (
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-900">
                      Stock by Location
                    </h3>
                    <button
                      onClick={() => setTransferOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      Transfer
                    </button>
                  </div>

                  {/* Aggregated Summary */}
                  <div className={`grid ${offcutCount > 0 ? 'grid-cols-4' : 'grid-cols-3'} gap-3`}>
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-semibold text-green-700">{aggregated.totalOnHand}</p>
                      <p className="text-xs text-green-600">On Hand</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3 text-center relative">
                      <p className="text-lg font-semibold text-amber-700">{aggregated.totalReserved}</p>
                      <p className="text-xs text-amber-600">Reserved</p>
                      {aggregated.totalReserved > 0 && (
                        <button
                          onClick={() => {
                            // If only one warehouse, open dialog directly
                            if (stockLevels.length === 1 && stockLevels[0].quantityReserved > 0) {
                              setUnreserveTarget({
                                warehouseId: stockLevels[0].warehouseId,
                                warehouseName: getWarehouseName(stockLevels[0].warehouseId),
                                currentReserved: stockLevels[0].quantityReserved,
                              });
                            }
                          }}
                          className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-amber-700 bg-amber-100 rounded hover:bg-amber-200"
                          title="Manually unreserve stock"
                        >
                          <Unlock className="w-3 h-3" />
                          Unreserve
                        </button>
                      )}
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-semibold text-gray-900">{aggregated.totalAvailable}</p>
                      <p className="text-xs text-gray-600">Available</p>
                    </div>
                    {offcutCount > 0 && (
                      <div className="bg-emerald-50 rounded-lg p-3 text-center">
                        <p className="text-lg font-semibold text-emerald-700">{offcutCount}</p>
                        <p className="text-xs text-emerald-600">Offcut Pieces</p>
                        <p className="text-[10px] text-emerald-500 mt-0.5">
                          {offcutValue.toLocaleString()} UGX
                        </p>
                      </div>
                    )}
                  </div>

                  {stockLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                    </div>
                  ) : stockLevels.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      <Warehouse className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p>No stock recorded at any location.</p>
                      <p className="text-xs mt-1">Stock levels are created when goods are received from purchase orders.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {stockLevels.map((sl) => (
                        <div
                          key={sl.id}
                          onClick={() => setSelectedStockLevelId(
                            selectedStockLevelId === sl.id ? null : sl.id
                          )}
                          className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                            selectedStockLevelId === sl.id
                              ? 'border-primary bg-primary/5'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {getWarehouseName(sl.warehouseId)}
                              </p>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <div className="text-right">
                                <p className="text-xs text-gray-500">On Hand</p>
                                <p className="font-medium text-gray-900">{sl.quantityOnHand}</p>
                              </div>
                              <div className="text-right">
                                <div className="flex items-center gap-1 justify-end">
                                  <p className="text-xs text-gray-500">Reserved</p>
                                  {sl.quantityReserved > 0 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setUnreserveTarget({
                                          warehouseId: sl.warehouseId,
                                          warehouseName: getWarehouseName(sl.warehouseId),
                                          currentReserved: sl.quantityReserved,
                                        });
                                      }}
                                      className="p-0.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded"
                                      title="Unreserve stock"
                                    >
                                      <Unlock className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                                <p className="font-medium text-amber-600">{sl.quantityReserved}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Available</p>
                                <p className="font-semibold text-green-600">{sl.quantityAvailable}</p>
                              </div>
                            </div>
                          </div>
                          {sl.reorderLevel != null && sl.quantityAvailable <= sl.reorderLevel && (
                            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Below reorder level ({sl.reorderLevel})
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Movement history for selected stock level */}
                  {selectedStockLevelId && (
                    <div className="mt-4 border-t pt-4">
                      <StockMovementHistory
                        stockLevelId={selectedStockLevelId}
                        title="Movement History"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ============ COST HISTORY TAB ============ */}
              {activeTab === 'cost-history' && (
                <div className="p-6">
                  <CostHistoryChart inventoryItemId={itemId} />
                </div>
              )}

              {/* ============ FINISHES TAB ============ */}
              {activeTab === 'finishes' && item && user && (
                <ProductFinishConfig
                  item={item}
                  organizationId="default"
                  userId={user.uid}
                  onUpdated={loadItem}
                />
              )}

              {/* ============ MOVEMENTS TAB ============ */}
              {activeTab === 'movements' && (
                <div className="p-6 space-y-4">
                  <h3 className="text-sm font-medium text-gray-900">
                    Select a stock location to view movements
                  </h3>
                  {stockLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                    </div>
                  ) : stockLevels.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      No stock locations to show movements for.
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {stockLevels.map((sl) => (
                          <button
                            key={sl.id}
                            onClick={() => setSelectedStockLevelId(
                              selectedStockLevelId === sl.id ? null : sl.id
                            )}
                            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                              selectedStockLevelId === sl.id
                                ? 'border-primary bg-primary text-white'
                                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {getWarehouseName(sl.warehouseId)}
                          </button>
                        ))}
                      </div>
                      <StockMovementHistory stockLevelId={selectedStockLevelId} />
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="p-6 text-center text-gray-500">
              Item not found
            </div>
          )}
        </div>
      </div>

      {/* Stock Transfer Dialog */}
      {user && (
        <StockTransferDialog
          open={transferOpen}
          onClose={() => setTransferOpen(false)}
          inventoryItemId={itemId}
          itemName={item?.displayName || item?.name}
          userId={user.uid}
        />
      )}

      {/* AI Enhancement Panel */}
      {item && user && (
        <AIEnhancementPanel
          open={aiEnhanceOpen}
          item={item}
          onClose={() => setAiEnhanceOpen(false)}
          onApply={async (updates) => {
            await updateInventoryItem(item.id, updates, user.uid);
            await loadItem();
            setAiEnhanceOpen(false);
          }}
        />
      )}

      {/* Delete Material Dialog */}
      {user && (
        <DeleteMaterialDialog
          open={deleteDialogOpen}
          itemId={itemId}
          itemName={item?.displayName || item?.name || ''}
          onClose={() => setDeleteDialogOpen(false)}
          onDeleted={() => {
            setDeleteDialogOpen(false);
            onClose();
          }}
          userId={user.uid}
        />
      )}

      {/* Unreserve Stock Dialog */}
      {unreserveTarget && item && (
        <UnreserveStockDialog
          open={!!unreserveTarget}
          onClose={() => setUnreserveTarget(null)}
          inventoryItemId={itemId}
          itemName={item.displayName || item.name}
          warehouseId={unreserveTarget.warehouseId}
          warehouseName={unreserveTarget.warehouseName}
          currentReserved={unreserveTarget.currentReserved}
          onSuccess={() => setUnreserveTarget(null)}
        />
      )}

      {/* Reclassify as Variant Dialog */}
      {user && item && (
        <ReclassifyAsVariantDialog
          open={reclassifyDialogOpen}
          selectedIds={new Set([item.id])}
          selectedItems={[{
            id: item.id,
            sku: item.sku,
            name: item.name,
            displayName: item.displayName,
            category: item.category,
            tier: item.tier,
            source: item.source,
            status: item.status,
          }]}
          onClose={() => setReclassifyDialogOpen(false)}
          onComplete={() => {
            setReclassifyDialogOpen(false);
            loadItem();
          }}
          userId={user.uid}
        />
      )}

      {/* Convert to Family Dialog */}
      {user && item && (
        <ConvertToFamilyDialog
          open={convertToFamilyOpen}
          item={{
            id: item.id,
            sku: item.sku,
            name: item.name,
            displayName: item.displayName,
            category: item.category,
            tier: item.tier,
            source: item.source,
            status: item.status,
          }}
          onClose={() => setConvertToFamilyOpen(false)}
          onComplete={() => {
            setConvertToFamilyOpen(false);
            loadItem();
          }}
          userId={user.uid}
        />
      )}
    </div>
  );
}

export default InventoryItemDetail;
