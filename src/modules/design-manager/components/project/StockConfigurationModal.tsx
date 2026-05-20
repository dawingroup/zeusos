/**
 * Stock Configuration Modal
 * Allows configuring multiple stock sizes for materials during mapping
 */

import { useState, useEffect } from 'react';
import { X, Package, Save, Loader2 } from 'lucide-react';
import type {
  MaterialPaletteEntry,
  OptimizationStockSheet,
  GlassStockDefinition,
  TimberStockDefinition,
  LinearStockDefinition,
  FabricRollDefinition,
  MaterialType,
} from '@/shared/types';
import type { InventoryListItem } from '@/modules/inventory/types';
import {
  PanelStockConfig,
  GlassStockConfig,
  TimberStockConfig,
  LinearStockConfig,
  FabricStockConfig,
} from './stock-config';

// ============================================
// Types
// ============================================

export interface StockConfigResult {
  stockSheets?: OptimizationStockSheet[];
  glassStock?: GlassStockDefinition[];
  timberStock?: TimberStockDefinition[];
  linearStock?: LinearStockDefinition[];
  fabricStock?: FabricRollDefinition[];
}

interface StockConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: MaterialPaletteEntry;
  inventoryItem: InventoryListItem | null;
  onSave: (config: StockConfigResult) => void;
  onMaterialTypeChange?: (entryId: string, newType: MaterialType) => void;
}

// ============================================
// Helper Functions
// ============================================

function getMaterialTypeLabel(type: MaterialType): string {
  const labels: Record<MaterialType, string> = {
    PANEL: 'Panel / Sheet',
    SOLID: 'Solid Wood',
    VENEER: 'Veneer',
    EDGE: 'Edge Banding',
    TIMBER: 'Timber / Lumber',
    GLASS: 'Glass',
    METAL_BAR: 'Metal Bar',
    ALUMINIUM: 'Aluminium',
    STONE: 'Stone / Countertop',
    FABRIC: 'Fabric / Upholstery',
    COMPONENT: 'Component',
  };
  return labels[type] || type;
}

function getMaterialTypeBadgeColor(type: MaterialType): string {
  const colors: Record<MaterialType, string> = {
    PANEL: 'bg-blue-100 text-blue-800',
    SOLID: 'bg-amber-100 text-amber-800',
    VENEER: 'bg-purple-100 text-purple-800',
    EDGE: 'bg-gray-100 text-gray-800',
    TIMBER: 'bg-green-100 text-green-800',
    GLASS: 'bg-cyan-100 text-cyan-800',
    METAL_BAR: 'bg-slate-100 text-slate-800',
    ALUMINIUM: 'bg-zinc-100 text-zinc-800',
    STONE: 'bg-amber-200 text-amber-900',
    FABRIC: 'bg-pink-100 text-pink-800',
    COMPONENT: 'bg-indigo-100 text-indigo-800',
  };
  return colors[type] || 'bg-gray-100 text-gray-800';
}

// ============================================
// Component
// ============================================

export function StockConfigurationModal({
  isOpen,
  onClose,
  entry,
  inventoryItem,
  onSave,
  onMaterialTypeChange,
}: StockConfigurationModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localMaterialType, setLocalMaterialType] = useState<MaterialType>(entry.materialType);

  // Stock state for each type
  const [panelStock, setPanelStock] = useState<OptimizationStockSheet[]>([]);
  const [glassStock, setGlassStock] = useState<GlassStockDefinition[]>([]);
  const [timberStock, setTimberStock] = useState<TimberStockDefinition[]>([]);
  const [linearStock, setLinearStock] = useState<LinearStockDefinition[]>([]);
  const [fabricStock, setFabricStock] = useState<FabricRollDefinition[]>([]);

  // Initialize stock from entry when modal opens
  useEffect(() => {
    if (isOpen && entry) {
      setLocalMaterialType(entry.materialType);
      setPanelStock(entry.stockSheets || []);
      setGlassStock(entry.glassStock || []);
      setTimberStock(entry.timberStock || []);
      setLinearStock(entry.linearStock || []);
      setFabricStock(entry.fabricStock || []);
      setError(null);
    }
  }, [isOpen, entry]);

  // Handle material type change within the modal
  const handleTypeChange = (newType: MaterialType) => {
    setLocalMaterialType(newType);
    onMaterialTypeChange?.(entry.id, newType);
  };

  // Handle save
  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const config: StockConfigResult = {};

      // Include the appropriate stock based on material type
      switch (localMaterialType) {
        case 'PANEL':
        case 'SOLID':
        case 'VENEER':
        case 'STONE':
          if (panelStock.length === 0) {
            setError('Please add at least one stock sheet/slab size');
            setSaving(false);
            return;
          }
          config.stockSheets = panelStock;
          break;
        case 'GLASS':
          if (glassStock.length === 0) {
            setError('Please add at least one glass stock size');
            setSaving(false);
            return;
          }
          config.glassStock = glassStock;
          break;
        case 'TIMBER':
          if (timberStock.length === 0) {
            setError('Please add at least one timber stock definition');
            setSaving(false);
            return;
          }
          config.timberStock = timberStock;
          break;
        case 'METAL_BAR':
        case 'ALUMINIUM':
          if (linearStock.length === 0) {
            setError('Please add at least one linear stock definition');
            setSaving(false);
            return;
          }
          config.linearStock = linearStock;
          break;
        case 'FABRIC':
          if (fabricStock.length === 0) {
            setError('Please add at least one fabric roll definition');
            setSaving(false);
            return;
          }
          config.fabricStock = fabricStock;
          break;
        default:
          config.stockSheets = panelStock;
      }

      onSave(config);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save stock configuration');
    } finally {
      setSaving(false);
    }
  };

  // Render appropriate config panel based on material type
  const renderConfigPanel = () => {
    switch (localMaterialType) {
      case 'PANEL':
      case 'SOLID':
      case 'VENEER':
      case 'STONE':
        return (
          <PanelStockConfig
            stock={panelStock}
            onChange={setPanelStock}
            inventoryItem={inventoryItem}
            thickness={entry.thickness}
          />
        );
      case 'GLASS':
        return (
          <GlassStockConfig
            stock={glassStock}
            onChange={setGlassStock}
            inventoryItem={inventoryItem}
            thickness={entry.thickness}
          />
        );
      case 'TIMBER':
        return (
          <TimberStockConfig
            stock={timberStock}
            onChange={setTimberStock}
            inventoryItem={inventoryItem}
            materialName={entry.inventoryName || entry.designName}
          />
        );
      case 'METAL_BAR':
      case 'ALUMINIUM':
        return (
          <LinearStockConfig
            stock={linearStock}
            onChange={setLinearStock}
            inventoryItem={inventoryItem}
            materialName={entry.inventoryName || entry.designName}
            materialType={entry.materialType === 'ALUMINIUM' ? 'aluminium' : 'steel'}
          />
        );
      case 'FABRIC':
        return (
          <FabricStockConfig
            stock={fabricStock}
            onChange={setFabricStock}
            inventoryItem={inventoryItem}
            materialName={entry.inventoryName || entry.designName}
          />
        );
      default:
        return (
          <PanelStockConfig
            stock={panelStock}
            onChange={setPanelStock}
            inventoryItem={inventoryItem}
            thickness={entry.thickness}
          />
        );
    }
  };

  // Get stock count for display
  const getStockCount = (): number => {
    switch (localMaterialType) {
      case 'PANEL':
      case 'SOLID':
      case 'VENEER':
      case 'STONE':
        return panelStock.length;
      case 'GLASS':
        return glassStock.length;
      case 'TIMBER':
        return timberStock.length;
      case 'METAL_BAR':
      case 'ALUMINIUM':
        return linearStock.length;
      case 'FABRIC':
        return fabricStock.length;
      default:
        return panelStock.length;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-gray-600" />
            <div>
              <h2 className="font-semibold text-gray-900">Configure Stock Sizes</h2>
              <p className="text-sm text-gray-500">
                {entry.designName} ({entry.thickness}mm)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {onMaterialTypeChange ? (
              <select
                value={localMaterialType}
                onChange={(e) => handleTypeChange(e.target.value as MaterialType)}
                className={`px-2 py-1 text-xs font-medium rounded-full border-0 cursor-pointer pr-6 ${getMaterialTypeBadgeColor(localMaterialType)}`}
              >
                {(['PANEL', 'SOLID', 'VENEER', 'EDGE', 'TIMBER', 'GLASS', 'METAL_BAR', 'ALUMINIUM', 'FABRIC'] as MaterialType[]).map((type) => (
                  <option key={type} value={type}>
                    {getMaterialTypeLabel(type)}
                  </option>
                ))}
              </select>
            ) : (
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getMaterialTypeBadgeColor(localMaterialType)}`}>
                {getMaterialTypeLabel(localMaterialType)}
              </span>
            )}
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Inventory Info */}
          {inventoryItem && (
            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="text-sm">
                <span className="text-gray-500">Mapped to: </span>
                <span className="font-medium text-gray-900">
                  {inventoryItem.displayName || inventoryItem.name}
                </span>
                <span className="text-gray-500 ml-2">({inventoryItem.sku})</span>
              </div>
              {inventoryItem.costPerUnit && (
                <div className="text-sm mt-1">
                  <span className="text-gray-500">Inventory price: </span>
                  <span className="font-medium text-green-700">
                    {inventoryItem.costPerUnit.toLocaleString()} {inventoryItem.currency || 'UGX'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Type-specific configuration panel */}
          {renderConfigPanel()}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="text-sm text-gray-500">
            {getStockCount()} stock size{getStockCount() !== 1 ? 's' : ''} configured
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || getStockCount() === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Stock Sizes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StockConfigurationModal;
