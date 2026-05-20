/**
 * Material Palette Table Component
 * Displays material palette entries with mapping status and actions
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Package,
  Link,
  Unlink,
  RefreshCw,
  Search,
  Sparkles,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Loader2,
  Settings2,
  Layers,
  Recycle,
  Plus,
  Palette,
} from 'lucide-react';
import type { MaterialPalette, MaterialPaletteEntry, MaterialType, OptimizationStockSheet, Offcut } from '@/shared/types';
import {
  harvestMaterials,
  mapMaterialToInventory,
  unmapMaterial,
  updatePaletteEntryStock,
  getPaletteStats,
  allMaterialsMapped,
} from '../../services/materialHarvester';
import { subscribeToInventory } from '@/modules/inventory/services/inventoryService';
import { useDesignItems } from '../../hooks/useDesignItems';
// P21.12 — Finish Library mapping tab
import { getFinishes } from '@/modules/inventory/services/finishLibraryService';
import { FinishSelector } from '@/shared/components/FinishAttributePicker/FinishSelector';
import type { FinishDocument } from '@/modules/inventory/types/finishLibrary';
import type { InventoryListItem } from '@/modules/inventory/types';
import { StockConfigurationModal, type StockConfigResult } from './StockConfigurationModal';
import { MaterialAlternativeMapper } from './MaterialAlternativeMapper';
import { OffcutPicker } from './OffcutPicker';
import { AddOffcutDialog } from '../production/AddOffcutDialog';
import { reserveOffcut } from '@/shared/services/offcutLibraryService';
import { buildStockFromOffcut } from '@/shared/services/offcutStockBuilder';
import { usePaletteBulkSelection } from '../../hooks/usePaletteBulkSelection';
import { PaletteBulkToolbar, type PaletteBulkAction } from './PaletteBulkToolbar';
import { BulkReclassifyMaterialDialog } from './BulkReclassifyMaterialDialog';
import { BulkUnmapDialog } from './BulkUnmapDialog';
import { bulkUpdatePaletteEntries } from '../../services/paletteBulkService';

// ============================================
// Types
// ============================================

interface MaterialPaletteTableProps {
  projectId: string;
  palette: MaterialPalette | undefined;
  onPaletteUpdated: () => void;
  userId: string;
  className?: string;
}

// Default sheet dimensions for stock sheets
const DEFAULT_SHEET_DIMENSIONS = { length: 2440, width: 1220 };

// ============================================
// Component
// ============================================

export function MaterialPaletteTable({
  projectId,
  palette,
  onPaletteUpdated,
  userId,
  className = '',
}: MaterialPaletteTableProps) {
  const [isHarvesting, setIsHarvesting] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<MaterialPaletteEntry | null>(null);
  const [showMappingModal, setShowMappingModal] = useState(false);

  // Map of design-item-id → human-readable name, so the "Used In Design
  // Items" expansion can show the same labels users see in the design
  // items section instead of raw Firestore IDs.
  const { items: designItems } = useDesignItems(projectId);
  const designItemNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const item of designItems) m.set(item.id, item.name);
    return m;
  }, [designItems]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  
  // Inventory state
  const [inventoryItems, setInventoryItems] = useState<InventoryListItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventorySearch, setInventorySearch] = useState('');
  // P21.12.2 — audit fix: let the user opt into non-active statuses so the
  // modal and the main Inventory list reconcile on demand. Defaults to
  // active-only because mapping to archived/discontinued items creates
  // broken links downstream.
  const [includeInactive, setIncludeInactive] = useState(false);
  
  // Price override state
  const [priceOverride, setPriceOverride] = useState<string>('');
  const [useOverride, setUseOverride] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryListItem | null>(null);

  // Stock configuration state
  const [showStockConfigModal, setShowStockConfigModal] = useState(false);
  const [pendingStockConfig, setPendingStockConfig] = useState<StockConfigResult | null>(null);

  // Alternative mapper state
  const [showAlternativeMapper, setShowAlternativeMapper] = useState(false);
  const [alternativeEntry, setAlternativeEntry] = useState<MaterialPaletteEntry | null>(null);

  // Offcut mapping state
  const [mappingSource, setMappingSource] = useState<'inventory' | 'offcut' | 'finish'>('inventory');
  const [selectedOffcut, setSelectedOffcut] = useState<Offcut | null>(null);
  const [showAddOffcutDialog, setShowAddOffcutDialog] = useState(false);

  // P21.12 — Finish Library tab state
  const [finishes, setFinishes] = useState<FinishDocument[]>([]);
  const [finishesLoading, setFinishesLoading] = useState(false);
  const [selectedFinish, setSelectedFinish] = useState<FinishDocument | null>(null);

  // Bulk selection & operations
  const bulkSelection = usePaletteBulkSelection();
  const [bulkDialog, setBulkDialog] = useState<PaletteBulkAction | null>(null);
  
  // Subscribe to inventory when modal opens
  useEffect(() => {
    if (!showMappingModal) return;
    
    setInventoryLoading(true);
    const unsubscribe = subscribeToInventory(
      (items) => {
        // Keep every item the service returns. Status filtering happens
        // downstream in `filteredInventory` so the user can opt into seeing
        // non-active items via the toggle — this matches the main Inventory
        // list's "All statuses" affordance and eliminates the silent
        // "modal has fewer items than inventory" divergence.
        setInventoryItems(items);
        setInventoryLoading(false);
      },
      (error) => {
        console.error('Failed to load inventory:', error);
        setInventoryLoading(false);
      }
    );
    
    return () => unsubscribe();
  }, [showMappingModal]);

  // P21.12 — load active finishes for the Finish tab when the modal opens.
  useEffect(() => {
    if (!showMappingModal) return;
    let cancelled = false;
    setFinishesLoading(true);
    getFinishes({ isActive: true })
      .then((list) => { if (!cancelled) setFinishes(list); })
      .catch((err) => { console.error('[MaterialPaletteTable] Failed to load finishes:', err); })
      .finally(() => { if (!cancelled) setFinishesLoading(false); });
    return () => { cancelled = true; };
  }, [showMappingModal]);

  // Reset modal state when closed
  useEffect(() => {
    if (!showMappingModal) {
      setPriceOverride('');
      setUseOverride(false);
      setSelectedInventoryItem(null);
      setInventorySearch('');
      setPendingStockConfig(null);
      setMappingSource('inventory');
      setSelectedOffcut(null);
      setShowAddOffcutDialog(false);
      setSelectedFinish(null);
    }
  }, [showMappingModal]);
  
  // Family handling depends on material type:
  //  - TIMBER is bought in many cross-sections under one species. Show family
  //    parents only; the harvester rolls up a weighted-avg price across child
  //    SKUs (getFamilyStockRollup), and downstream nesting fans out to the
  //    real SKU sizes. Mapping to a child directly loses the average.
  //  - Everything else: the user wants to pick the actual orderable SKU
  //    (a specific sheet, edge tape colour, hardware finish, fabric roll).
  //    Show children + standalone items and hide family parents — parents
  //    aren't orderable in their own right and choosing one was causing
  //    "the inventory picker doesn't show my SKU" complaints.
  // Search mirrors the inventory list: name, sku, displayName, brand, tags,
  // classification, subcategory — so a query like "Blum" or a tag surfaces
  // the same items the user sees on the inventory page.
  const isTimberMapping = selectedEntry?.materialType === 'TIMBER';
  const passesFamilyFilter = (item: InventoryListItem): boolean => {
    if (isTimberMapping) return !item.parentItemId && !item.familyId;
    return !item.isFamily;
  };
  const filteredInventory = inventoryItems.filter(item => {
    if (!passesFamilyFilter(item)) return false;
    if (!includeInactive && item.status !== 'active') return false;
    if (!inventorySearch) return true;
    const q = inventorySearch.toLowerCase();
    if (item.name.toLowerCase().includes(q)) return true;
    if (item.sku.toLowerCase().includes(q)) return true;
    if (item.displayName?.toLowerCase().includes(q)) return true;
    if (item.brand?.toLowerCase().includes(q)) return true;
    if (item.classification?.toLowerCase().includes(q)) return true;
    if (item.subcategory?.toLowerCase().includes(q)) return true;
    if (item.tags?.some((t) => t.toLowerCase().includes(q))) return true;
    return false;
  });

  const stats = getPaletteStats(palette);
  const allMapped = allMaterialsMapped(palette);

  // Handle harvest
  const handleHarvest = async () => {
    setIsHarvesting(true);
    try {
      await harvestMaterials(projectId, userId);
      onPaletteUpdated();
    } catch (error) {
      console.error('Failed to harvest materials:', error);
    } finally {
      setIsHarvesting(false);
    }
  };

  // Handle mapping
  const handleOpenMapping = (entry: MaterialPaletteEntry) => {
    setSelectedEntry(entry);
    setShowMappingModal(true);
  };

  const handleMapMaterial = async (inventoryItem: InventoryListItem, overridePrice?: number) => {
    if (!selectedEntry) return;

    // Use override price if explicitly provided, otherwise let backend auto-fetch from inventory
    const unitCost = useOverride && overridePrice ? overridePrice : undefined;

    // Get the display cost for stock sheets (use inventory price or override)
    const displayCost = overridePrice || inventoryItem.costPerUnit || 0;

    // Use configured stock if available, otherwise create default based on material type
    let stockSheets: OptimizationStockSheet[] = pendingStockConfig?.stockSheets || [];

    // If no stock config, create default stock sheet for panel materials
    if (stockSheets.length === 0 && !pendingStockConfig?.glassStock?.length &&
        !pendingStockConfig?.timberStock?.length && !pendingStockConfig?.linearStock?.length) {
      stockSheets = [{
        id: `ss-${inventoryItem.id}`,
        materialId: inventoryItem.id,
        materialName: inventoryItem.displayName || inventoryItem.name,
        length: DEFAULT_SHEET_DIMENSIONS.length,
        width: DEFAULT_SHEET_DIMENSIONS.width,
        thickness: inventoryItem.thickness || selectedEntry.thickness,
        quantity: inventoryItem.inStock || 0,
        costPerSheet: displayCost,
      }];
    }

    try {
      await mapMaterialToInventory(
        projectId,
        selectedEntry.id,
        inventoryItem.id,
        inventoryItem.displayName || inventoryItem.name,
        inventoryItem.sku,
        unitCost, // undefined = auto-fetch from inventory
        stockSheets,
        userId,
        pendingStockConfig?.glassStock,
        pendingStockConfig?.timberStock,
        pendingStockConfig?.linearStock
      );
      setShowMappingModal(false);
      setSelectedEntry(null);
      onPaletteUpdated();
    } catch (error) {
      console.error('Failed to map material:', error);
    }
  };

  const handleUnmapMaterial = async (entryId: string) => {
    try {
      await unmapMaterial(projectId, entryId, userId);
      onPaletteUpdated();
    } catch (error) {
      console.error('Failed to unmap material:', error);
    }
  };

  // Handle mapping from offcut library
  const handleMapFromOffcut = async () => {
    if (!selectedEntry || !selectedOffcut) return;

    try {
      // Reserve the offcut for this project
      await reserveOffcut(selectedOffcut.id, projectId);

      // Build stock definitions from the offcut
      const stock = buildStockFromOffcut(selectedOffcut);

      // Map using existing service with offcut-derived data
      await mapMaterialToInventory(
        projectId,
        selectedEntry.id,
        `offcut:${selectedOffcut.id}`,
        `${selectedOffcut.materialName} (offcut)`,
        `OFFCUT-${selectedOffcut.id.slice(0, 8)}`,
        0, // Zero cost — offcut is already owned
        stock.stockSheets || [],
        userId,
        stock.glassStock,
        stock.timberStock,
        stock.linearStock
      );

      setShowMappingModal(false);
      setSelectedEntry(null);
      onPaletteUpdated();
    } catch (error) {
      console.error('Failed to map from offcut:', error);
    }
  };

  // P21.12 — map a palette entry by picking a finish directly. The finish
  // carries its own `inventoryItemId`, so we use that as the inventory link
  // and stamp the Finish Library binding explicitly (no auto-lookup needed).
  const handleMapFromFinish = async () => {
    if (!selectedEntry || !selectedFinish) return;
    if (!selectedFinish.inventoryItemId) {
      console.warn('[MaterialPaletteTable] Finish has no inventoryItemId; cannot map without linked stock.');
      return;
    }

    // Prefer the loaded inventory item (has cost/sku/displayName) so the
    // palette row reads cleanly. Fall back to finish fields if not present.
    const inv = inventoryItems.find((i) => i.id === selectedFinish.inventoryItemId);
    const displayName = inv?.displayName || inv?.name || selectedFinish.name;
    const sku = inv?.sku || selectedFinish.code;
    const costPerSheet = inv?.costPerUnit || 0;

    const stockSheets: OptimizationStockSheet[] = pendingStockConfig?.stockSheets || [{
      id: `ss-${selectedFinish.inventoryItemId}`,
      materialId: selectedFinish.inventoryItemId,
      materialName: displayName,
      length: DEFAULT_SHEET_DIMENSIONS.length,
      width: DEFAULT_SHEET_DIMENSIONS.width,
      thickness: inv?.thickness || selectedEntry.thickness,
      quantity: inv?.inStock || 0,
      costPerSheet,
    }];

    try {
      await mapMaterialToInventory(
        projectId,
        selectedEntry.id,
        selectedFinish.inventoryItemId,
        displayName,
        sku,
        undefined, // auto-fetch price from inventory
        stockSheets,
        userId,
        pendingStockConfig?.glassStock,
        pendingStockConfig?.timberStock,
        pendingStockConfig?.linearStock,
        {
          finishId: selectedFinish.id,
          finishCode: selectedFinish.code,
          finishName: selectedFinish.name,
        },
      );
      setShowMappingModal(false);
      setSelectedEntry(null);
      onPaletteUpdated();
    } catch (error) {
      console.error('Failed to map from finish:', error);
    }
  };

  // Toggle expand
  const toggleExpand = (entryId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(entryId)) {
      newExpanded.delete(entryId);
    } else {
      newExpanded.add(entryId);
    }
    setExpandedItems(newExpanded);
  };

  // Filter entries
  const filteredEntries = (palette?.entries || []).filter(entry => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      entry.designName.toLowerCase().includes(query) ||
      entry.normalizedName.toLowerCase().includes(query) ||
      entry.inventoryName?.toLowerCase().includes(query) ||
      entry.inventorySku?.toLowerCase().includes(query)
    );
  });

  // Bulk selection helpers
  const visibleIds = useMemo(() => filteredEntries.map(e => e.id), [filteredEntries]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => bulkSelection.selectedIds.has(id));
  const someVisibleSelected = visibleIds.some(id => bulkSelection.selectedIds.has(id));
  const headerCheckRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (headerCheckRef.current) {
      headerCheckRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
    }
  }, [someVisibleSelected, allVisibleSelected]);

  const handleBulkAction = useCallback((action: PaletteBulkAction) => {
    setBulkDialog(action);
  }, []);

  const handleBulkComplete = useCallback(() => {
    setBulkDialog(null);
    bulkSelection.clearSelection();
    onPaletteUpdated();
  }, [bulkSelection, onPaletteUpdated]);

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Material Palette</h3>
            <span className="text-sm text-gray-500">
              {stats.total} materials
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Status badges */}
            <div className="flex items-center gap-2 mr-4">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <CheckCircle className="w-3 h-3" />
                {stats.mapped} mapped
              </span>
              {stats.unmapped > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                  <AlertCircle className="w-3 h-3" />
                  {stats.unmapped} unmapped
                </span>
              )}
            </div>
            
            {/* Actions */}
            <button
              onClick={handleHarvest}
              disabled={isHarvesting}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isHarvesting ? 'animate-spin' : ''}`} />
              {isHarvesting ? 'Scanning...' : 'Rescan'}
            </button>
            <button
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700"
            >
              <Sparkles className="w-4 h-4" />
              Auto-Map
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search materials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full table-sticky-first-col">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 w-10">
                <input
                  ref={headerCheckRef}
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={() => bulkSelection.toggleAll(visibleIds)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
              </th>
              <th className="w-8"></th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Design Material</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thickness</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usage</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Inventory Mapping</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Alternatives</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  {palette?.entries.length === 0 ? (
                    <div className="flex flex-col items-center gap-2">
                      <Package className="w-8 h-8 text-gray-400" />
                      <p>No materials found</p>
                      <button
                        onClick={handleHarvest}
                        className="text-blue-600 hover:underline"
                      >
                        Scan design items for materials
                      </button>
                    </div>
                  ) : (
                    'No materials match your search'
                  )}
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry) => (
                <React.Fragment key={entry.id}>
                  <tr className={`hover:bg-gray-50 ${bulkSelection.selectedIds.has(entry.id) ? 'bg-primary/5' : ''}`}>
                    {/* Selection checkbox */}
                    <td className="px-3 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={bulkSelection.selectedIds.has(entry.id)}
                        onChange={() => bulkSelection.toggleItem(entry.id)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </td>
                    {/* Expand toggle */}
                    <td className="pl-4">
                      <button
                        onClick={() => toggleExpand(entry.id)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        {expandedItems.has(entry.id) ? (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </td>

                    {/* Design Material */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{entry.designName}</div>
                      <div className="text-xs text-gray-500">{entry.normalizedName}</div>
                    </td>

                    {/* Thickness — timber entries aggregate across cross-sections */}
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {entry.materialType === 'TIMBER'
                        ? (entry.timberCrossSections && entry.timberCrossSections.length > 0
                            ? `${entry.timberCrossSections.length} cross-section${entry.timberCrossSections.length !== 1 ? 's' : ''}`
                            : 'by species')
                        : `${entry.thickness}mm`}
                    </td>

                    {/* Type — inline editable dropdown */}
                    <td className="px-4 py-3">
                      <select
                        value={entry.materialType}
                        onChange={async (e) => {
                          const newType = e.target.value as MaterialType;
                          if (newType === entry.materialType) return;
                          try {
                            await bulkUpdatePaletteEntries(
                              projectId,
                              [entry.id],
                              { materialType: newType },
                              userId,
                            );
                            onPaletteUpdated();
                          } catch (err) {
                            console.error('[MaterialPaletteTable] Failed to reclassify:', err);
                          }
                        }}
                        className={`px-2 py-1 text-xs font-medium rounded-full border-0 cursor-pointer ${
                          entry.materialType === 'PANEL' ? 'bg-blue-100 text-blue-800' :
                          entry.materialType === 'SOLID' ? 'bg-amber-100 text-amber-800' :
                          entry.materialType === 'VENEER' ? 'bg-purple-100 text-purple-800' :
                          entry.materialType === 'TIMBER' ? 'bg-green-100 text-green-800' :
                          entry.materialType === 'GLASS' ? 'bg-cyan-100 text-cyan-800' :
                          entry.materialType === 'METAL_BAR' ? 'bg-slate-100 text-slate-800' :
                          entry.materialType === 'ALUMINIUM' ? 'bg-gray-100 text-gray-800' :
                          entry.materialType === 'STONE' ? 'bg-amber-200 text-amber-900' :
                          entry.materialType === 'FABRIC' ? 'bg-pink-100 text-pink-800' :
                          entry.materialType === 'COMPONENT' ? 'bg-zinc-100 text-zinc-800' :
                          'bg-gray-100 text-gray-800'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="PANEL">PANEL</option>
                        <option value="SOLID">SOLID</option>
                        <option value="VENEER">VENEER</option>
                        <option value="EDGE">EDGE</option>
                        <option value="TIMBER">TIMBER</option>
                        <option value="GLASS">GLASS</option>
                        <option value="METAL_BAR">METAL_BAR</option>
                        <option value="ALUMINIUM">ALUMINIUM</option>
                        <option value="STONE">STONE</option>
                        <option value="FABRIC">FABRIC</option>
                        <option value="COMPONENT">COMPONENT</option>
                      </select>
                    </td>

                    {/* Usage */}
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {entry.materialType === 'EDGE'
                        ? `${(entry.usageCount as number).toFixed(2)} m in ${entry.designItemIds.length} items`
                        : entry.materialType === 'TIMBER' && entry.timberCrossSections && entry.timberCrossSections.length > 0
                          ? (() => {
                              const totalVol = entry.timberCrossSections!.reduce((s, c) => s + c.totalVolumeM3, 0);
                              return `${entry.usageCount} parts • ${totalVol.toFixed(3)} m³ in ${entry.designItemIds.length} items`;
                            })()
                          : `${entry.usageCount} parts in ${entry.designItemIds.length} items`}
                    </td>

                    {/* Inventory Mapping */}
                    <td className="px-4 py-3">
                      {entry.inventoryId ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{entry.inventoryName}</div>
                            <div className="text-xs text-gray-500">
                              {entry.inventorySku}
                              {/* P21.12 — finish chip when Finish Library binding is present */}
                              {entry.finishCode && (
                                <span
                                  title={entry.finishName || entry.finishCode}
                                  className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono text-[10px]"
                                >
                                  {entry.finishCode}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-amber-600">
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-sm">Not mapped</span>
                        </div>
                      )}
                    </td>

                    {/* Alternatives */}
                    <td className="px-4 py-3">
                      {entry.inventoryId ? (
                        <button
                          onClick={() => {
                            setAlternativeEntry(entry);
                            setShowAlternativeMapper(true);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded hover:bg-gray-100"
                        >
                          <Layers className="w-3 h-3" />
                          {entry.alternatives && entry.alternatives.length > 0 ? (
                            <span className="text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
                              {entry.alternatives.length} tier{entry.alternatives.length !== 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-gray-500">Add</span>
                          )}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">Map first</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenMapping(entry)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100"
                        >
                          <Link className="w-3 h-3" />
                          {entry.inventoryId ? 'Remap' : 'Map'}
                        </button>
                        {entry.materialType !== 'EDGE' && (
                          <button
                            onClick={() => {
                              setSelectedEntry(entry);
                              setSelectedInventoryItem(null);
                              setShowStockConfigModal(true);
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded ${
                              // Warn if type needs stock but none configured
                              (entry.materialType === 'TIMBER' && (!entry.timberStock || entry.timberStock.length === 0)) ||
                              (entry.materialType === 'GLASS' && (!entry.glassStock || entry.glassStock.length === 0)) ||
                              (['METAL_BAR', 'ALUMINIUM'].includes(entry.materialType) && (!entry.linearStock || entry.linearStock.length === 0)) ||
                              (['PANEL', 'SOLID', 'VENEER', 'STONE'].includes(entry.materialType) && entry.stockSheets.length === 0)
                                ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                                : 'text-gray-700 bg-gray-50 hover:bg-gray-100'
                            }`}
                          >
                            <Settings2 className="w-3 h-3" />
                            Stock
                          </button>
                        )}
                        {entry.inventoryId && (
                          <button
                            onClick={() => handleUnmapMaterial(entry.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 rounded hover:bg-red-100"
                          >
                            <Unlink className="w-3 h-3" />
                            Unmap
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Details */}
                  {expandedItems.has(entry.id) && (
                    <tr className="bg-gray-50">
                      <td colSpan={9} className="px-8 py-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <h4 className="font-medium text-gray-700 mb-2">Used In Design Items</h4>
                            <ul className="space-y-1">
                              {entry.designItemIds.slice(0, 5).map((id) => (
                                <li key={id} className="text-gray-600">
                                  • {designItemNameById.get(id) ?? id}
                                </li>
                              ))}
                              {entry.designItemIds.length > 5 && (
                                <li className="text-gray-500 italic">
                                  +{entry.designItemIds.length - 5} more...
                                </li>
                              )}
                            </ul>
                          </div>
                          {/* Panel/Sheet Stock */}
                          {entry.stockSheets.length > 0 && (
                            <div>
                              <h4 className="font-medium text-gray-700 mb-2">Stock Sheets</h4>
                              <ul className="space-y-1">
                                {entry.stockSheets.map((sheet) => (
                                  <li key={sheet.id} className="text-gray-600">
                                    {sheet.length}×{sheet.width}mm @ {sheet.costPerSheet?.toLocaleString()} UGX
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {/* Glass Stock */}
                          {entry.glassStock && entry.glassStock.length > 0 && (
                            <div>
                              <h4 className="font-medium text-gray-700 mb-2">Glass Stock</h4>
                              <ul className="space-y-1">
                                {entry.glassStock.map((glass) => (
                                  <li key={glass.id} className="text-gray-600">
                                    {glass.length}×{glass.width}×{glass.thickness}mm ({glass.glassType}) @ {glass.costPerSheet?.toLocaleString()} UGX
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {/* Timber cross-section demand (design-side) */}
                          {entry.materialType === 'TIMBER' && entry.timberCrossSections && entry.timberCrossSections.length > 0 && (
                            <div>
                              <h4 className="font-medium text-gray-700 mb-2">Cross-Section Demand</h4>
                              <ul className="space-y-1">
                                {entry.timberCrossSections.map((cs) => (
                                  <li key={`${cs.thickness}x${cs.width}`} className="text-gray-600">
                                    {cs.thickness}×{cs.width}mm — {cs.partCount} parts,
                                    {' '}
                                    {(cs.totalLinearMm / 1000).toFixed(2)} m,
                                    {' '}
                                    {cs.totalVolumeM3.toFixed(3)} m³
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {/* Timber Stock */}
                          {entry.timberStock && entry.timberStock.length > 0 && (
                            <div>
                              <h4 className="font-medium text-gray-700 mb-2">Timber Stock</h4>
                              <ul className="space-y-1">
                                {entry.timberStock.map((timber) => (
                                  <li key={timber.id} className="text-gray-600">
                                    {timber.thickness}×{timber.width}mm • Lengths: {timber.availableLengths.map(l => `${l}mm`).join(', ')}
                                    {timber.species && ` (${timber.species})`}
                                    {timber.costPerCubicMeter ? (
                                      <span className="ml-2 text-amber-700 font-medium">
                                        @ {timber.costPerCubicMeter.toLocaleString()} UGX/m³
                                      </span>
                                    ) : timber.costPerLinearMeter ? (
                                      <span className="ml-2 text-gray-500">
                                        @ {timber.costPerLinearMeter.toLocaleString()} UGX/m
                                      </span>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {/* Linear Stock (Metal Bars/Aluminium) */}
                          {entry.linearStock && entry.linearStock.length > 0 && (
                            <div>
                              <h4 className="font-medium text-gray-700 mb-2">Linear Stock</h4>
                              <ul className="space-y-1">
                                {entry.linearStock.map((linear) => (
                                  <li key={linear.id} className="text-gray-600">
                                    {linear.profile} ({linear.material}) • Lengths: {linear.availableLengths.map(l => `${l}mm`).join(', ')}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {entry.mappedAt && (
                            <div>
                              <h4 className="font-medium text-gray-700 mb-2">Mapping Info</h4>
                              <div className="flex items-center gap-2 text-gray-600">
                                <Clock className="w-4 h-4" />
                                Mapped {new Date(entry.mappedAt.seconds * 1000).toLocaleDateString()}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mapping Status */}
      {palette && palette.entries.length > 0 && (
        <div className={`px-4 py-3 border-t ${allMapped ? 'bg-green-50' : 'bg-amber-50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {allMapped ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-800">
                    All materials mapped to inventory
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">
                    {stats.unmapped} unmapped material{stats.unmapped !== 1 ? 's' : ''} - Map all materials to continue
                  </span>
                </>
              )}
            </div>
            <span className="text-sm text-gray-600">
              {stats.percentMapped}% mapped
            </span>
          </div>
        </div>
      )}

      {/* Mapping Modal */}
      {showMappingModal && selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
            {/* Modal Header */}
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Map Material</h3>
              <p className="text-sm text-gray-500 mt-1">
                Select stock source for: <strong>{selectedEntry.designName}</strong> ({selectedEntry.thickness}mm)
              </p>
            </div>

            {/* Source Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => { setMappingSource('inventory'); setSelectedOffcut(null); setSelectedFinish(null); }}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                  mappingSource === 'inventory'
                    ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50/50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Package className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                Inventory Stock
              </button>
              <button
                onClick={() => { setMappingSource('finish'); setSelectedInventoryItem(null); setUseOverride(false); setSelectedOffcut(null); }}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                  mappingSource === 'finish'
                    ? 'border-b-2 border-indigo-500 text-indigo-600 bg-indigo-50/50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Palette className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                Finish Library
              </button>
              <button
                onClick={() => { setMappingSource('offcut'); setSelectedInventoryItem(null); setUseOverride(false); setSelectedFinish(null); }}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                  mappingSource === 'offcut'
                    ? 'border-b-2 border-green-500 text-green-600 bg-green-50/50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Recycle className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                Offcut Library
              </button>
            </div>

            {/* Tab Content: Inventory */}
            {mappingSource === 'inventory' && (
              <>
                {/* Search and price override section */}
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={inventorySearch}
                          onChange={(e) => setInventorySearch(e.target.value)}
                          placeholder="Search name, SKU, brand, tag..."
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                    </div>
                    {/* P21.12.2 — status toggle so the modal matches the main Inventory list on demand */}
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={includeInactive}
                        onChange={(e) => setIncludeInactive(e.target.checked)}
                        className="rounded"
                      />
                      Include inactive
                    </label>
                    {selectedInventoryItem && (
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={useOverride}
                            onChange={(e) => setUseOverride(e.target.checked)}
                            className="rounded"
                          />
                          Override price
                        </label>
                        {useOverride && (
                          <div className="relative">
                            <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="number"
                              value={priceOverride}
                              onChange={(e) => setPriceOverride(e.target.value)}
                              placeholder="Price"
                              className="w-28 pl-8 pr-2 py-2 border border-gray-300 rounded-md text-sm"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 max-h-80 overflow-y-auto">
                  {inventoryLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                      <span className="ml-2 text-gray-500">Loading inventory...</span>
                    </div>
                  ) : filteredInventory.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      {inventorySearch ? 'No matching inventory items' : 'No active inventory items'}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-xs text-gray-500 px-1 pb-1 flex items-center justify-between">
                        <span>
                          Showing <strong>{filteredInventory.length}</strong> of {inventoryItems.filter(passesFamilyFilter).length} item(s)
                        </span>
                        {!includeInactive && inventoryItems.some(i => passesFamilyFilter(i) && i.status !== 'active') && (
                          <span className="text-amber-600">
                            {inventoryItems.filter(i => passesFamilyFilter(i) && i.status !== 'active').length} inactive hidden
                          </span>
                        )}
                      </div>
                      {filteredInventory.map((item) => {
                        const isSelected = selectedInventoryItem?.id === item.id;
                        const hasCost = item.costPerUnit && item.costPerUnit > 0;

                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              setSelectedInventoryItem(item);
                              setUseOverride(false);
                              setPriceOverride('');
                            }}
                            className={`w-full p-3 text-left border rounded-lg transition-colors ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium text-gray-900 flex items-center gap-2">
                                  {item.displayName || item.name}
                                  {item.isFamily && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-100 text-green-800">
                                      Family{item.skuCount ? ` • ${item.skuCount}` : ''}
                                    </span>
                                  )}
                                  {item.status && item.status !== 'active' && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-700 uppercase">
                                      {item.status}
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-500">
                                  SKU: {item.sku} {item.thickness && `• ${item.thickness}mm`}
                                </div>
                              </div>
                              <div className="text-right">
                                {hasCost ? (
                                  <>
                                    <div className="text-sm font-medium text-green-700">
                                      {item.costPerUnit?.toLocaleString()} {item.currency || 'UGX'}
                                      {item.costUnit ? `/${item.costUnit}` : ''}
                                    </div>
                                    <div className="text-xs text-green-600">auto-price</div>
                                  </>
                                ) : item.isFamily ? (
                                  <div className="text-xs text-green-700">
                                    Weighted avg from variants
                                  </div>
                                ) : (
                                  <div className="text-sm text-amber-600 flex items-center gap-1">
                                    <AlertCircle className="w-4 h-4" />
                                    Price pending sync
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Tab Content: Finish Library (P21.12) */}
            {mappingSource === 'finish' && (
              <div className="p-4 max-h-80 overflow-y-auto">
                {finishesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    <span className="ml-2 text-gray-500">Loading finishes...</span>
                  </div>
                ) : finishes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No active finishes in the Finish Library.
                  </div>
                ) : (
                  <>
                    <FinishSelector
                      finishes={finishes}
                      selectedFinishId={selectedFinish?.id}
                      onSelect={(f) => setSelectedFinish(f)}
                    />
                    {selectedFinish && !selectedFinish.inventoryItemId && (
                      <div className="mt-3 flex items-start gap-2 p-2 rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>
                          <strong>{selectedFinish.code}</strong> — {selectedFinish.name} has no linked
                          inventory item. Link one in the Finish Library before mapping, or pick an inventory
                          item directly under the Inventory Stock tab.
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Tab Content: Offcut Library */}
            {mappingSource === 'offcut' && (
              <>
                <OffcutPicker
                  entry={selectedEntry}
                  onSelect={setSelectedOffcut}
                  selectedOffcutId={selectedOffcut?.id}
                />
                {/* Register New button */}
                <div className="px-4 py-2 border-t border-gray-100">
                  <button
                    onClick={() => setShowAddOffcutDialog(true)}
                    className="inline-flex items-center gap-1.5 text-sm text-green-700 hover:text-green-800"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Register new offcut
                  </button>
                </div>
              </>
            )}

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-200 flex justify-between items-center">
              <div className="text-sm text-gray-500">
                {/* Inventory selection summary */}
                {mappingSource === 'inventory' && selectedInventoryItem && (
                  <div className="flex items-center gap-3">
                    <span>
                      Selected: <strong>{selectedInventoryItem.displayName || selectedInventoryItem.name}</strong>
                      {useOverride && priceOverride ? (
                        <span className="ml-2 text-blue-600">
                          @ {Number(priceOverride).toLocaleString()} UGX (override)
                        </span>
                      ) : selectedInventoryItem.costPerUnit ? (
                        <span className="ml-2 text-green-600">
                          @ {selectedInventoryItem.costPerUnit.toLocaleString()} UGX (from inventory)
                        </span>
                      ) : (
                        <span className="ml-2 text-gray-500">
                          (price will be fetched from inventory)
                        </span>
                      )}
                    </span>
                    {pendingStockConfig && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        Stock configured
                      </span>
                    )}
                  </div>
                )}
                {/* Finish selection summary (P21.12) */}
                {mappingSource === 'finish' && selectedFinish && (
                  <span>
                    Selected: <strong>{selectedFinish.name}</strong>
                    <span className="ml-2 font-mono text-xs text-indigo-700">{selectedFinish.code}</span>
                    {selectedFinish.inventoryItemId ? (
                      <span className="ml-2 text-green-600">→ linked inventory</span>
                    ) : (
                      <span className="ml-2 text-amber-600">(no linked inventory)</span>
                    )}
                  </span>
                )}
                {/* Offcut selection summary */}
                {mappingSource === 'offcut' && selectedOffcut && (
                  <span>
                    Selected: <strong>{selectedOffcut.materialName}</strong>
                    <span className="ml-2 text-green-600">
                      {selectedOffcut.crossSection
                        ? `${selectedOffcut.crossSection.thickness}×${selectedOffcut.crossSection.width}mm × ${selectedOffcut.length}mm`
                        : `${selectedOffcut.length}×${selectedOffcut.width}mm`}
                      {' '}(zero cost)
                    </span>
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowMappingModal(false);
                    setSelectedEntry(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                {mappingSource === 'inventory' && (
                  <>
                    <button
                      onClick={() => setShowStockConfigModal(true)}
                      disabled={!selectedInventoryItem}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Settings2 className="w-4 h-4" />
                      Configure Stock Sizes
                    </button>
                    <button
                      onClick={() => {
                        if (selectedInventoryItem) {
                          const override = useOverride && priceOverride ? Number(priceOverride) : undefined;
                          handleMapMaterial(selectedInventoryItem, override);
                        }
                      }}
                      disabled={!selectedInventoryItem}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Map Material
                    </button>
                  </>
                )}
                {mappingSource === 'offcut' && (
                  <button
                    onClick={handleMapFromOffcut}
                    disabled={!selectedOffcut}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Recycle className="w-4 h-4" />
                    Use Offcut
                  </button>
                )}
                {mappingSource === 'finish' && (
                  <button
                    onClick={handleMapFromFinish}
                    disabled={!selectedFinish || !selectedFinish.inventoryItemId}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    title={
                      selectedFinish && !selectedFinish.inventoryItemId
                        ? 'This finish has no linked inventory item.'
                        : undefined
                    }
                  >
                    <Palette className="w-4 h-4" />
                    Map via Finish
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Offcut Dialog (from mapping modal) */}
      <AddOffcutDialog
        open={showAddOffcutDialog}
        onClose={() => setShowAddOffcutDialog(false)}
        onCreated={() => {
          setShowAddOffcutDialog(false);
          // Re-trigger offcut picker refresh by toggling source
          setMappingSource('inventory');
          setTimeout(() => setMappingSource('offcut'), 0);
        }}
        defaultMaterialType={selectedEntry?.materialType}
        defaultMaterialName={selectedEntry?.designName}
      />

      {/* Stock Configuration Modal */}
      {showStockConfigModal && selectedEntry && (
        <StockConfigurationModal
          isOpen={showStockConfigModal}
          onClose={() => setShowStockConfigModal(false)}
          entry={selectedEntry}
          inventoryItem={selectedInventoryItem}
          onSave={async (config) => {
            if (showMappingModal) {
              // Inside mapping flow — just stage it
              setPendingStockConfig(config);
            } else {
              // Standalone — save directly to Firestore
              try {
                await updatePaletteEntryStock(
                  projectId,
                  selectedEntry.id,
                  config,
                  userId,
                );
                onPaletteUpdated();
              } catch (err) {
                console.error('[MaterialPaletteTable] Failed to save stock config:', err);
              }
            }
            setShowStockConfigModal(false);
          }}
          onMaterialTypeChange={async (entryId, newType) => {
            try {
              await bulkUpdatePaletteEntries(
                projectId,
                [entryId],
                { materialType: newType },
                userId,
              );
              // Update the local selectedEntry so the modal reflects the change immediately
              setSelectedEntry(prev => prev ? { ...prev, materialType: newType } : null);
              onPaletteUpdated();
            } catch (err) {
              console.error('[MaterialPaletteTable] Failed to update material type:', err);
            }
          }}
        />
      )}

      {/* Material Alternative Mapper */}
      {showAlternativeMapper && alternativeEntry && palette && (
        <MaterialAlternativeMapper
          isOpen={showAlternativeMapper}
          onClose={() => {
            setShowAlternativeMapper(false);
            setAlternativeEntry(null);
          }}
          projectId={projectId}
          paletteEntry={alternativeEntry}
          palette={palette}
          userId={userId}
          onUpdated={() => {
            onPaletteUpdated();
            // Refresh the entry data after update
            setAlternativeEntry(null);
            setShowAlternativeMapper(false);
          }}
        />
      )}

      {/* Bulk Actions Toolbar */}
      <PaletteBulkToolbar
        selectedCount={bulkSelection.selectedCount}
        onAction={handleBulkAction}
        onClearSelection={bulkSelection.clearSelection}
      />

      {/* Bulk Dialogs */}
      <BulkReclassifyMaterialDialog
        open={bulkDialog === 'reclassify'}
        selectedIds={bulkSelection.selectedIds}
        selectedEntries={bulkSelection.getSelectedEntries(palette?.entries || [])}
        onClose={() => setBulkDialog(null)}
        onComplete={handleBulkComplete}
        projectId={projectId}
        userId={userId}
      />

      <BulkUnmapDialog
        open={bulkDialog === 'unmap'}
        selectedIds={bulkSelection.selectedIds}
        selectedEntries={bulkSelection.getSelectedEntries(palette?.entries || [])}
        onClose={() => setBulkDialog(null)}
        onComplete={handleBulkComplete}
        projectId={projectId}
        userId={userId}
      />
    </div>
  );
}

export default MaterialPaletteTable;
