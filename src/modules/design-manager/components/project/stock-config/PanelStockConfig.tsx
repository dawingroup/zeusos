/**
 * Panel Stock Configuration Component
 * For configuring sheet material stock sizes (PANEL, SOLID, VENEER)
 */

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { OptimizationStockSheet } from '@/shared/types';
import type { InventoryListItem } from '@/modules/inventory/types';
import { PANEL_SIZE_PRESETS, COMMON_THICKNESSES } from '../../../types/materials';

// ============================================
// Types
// ============================================

interface PanelStockConfigProps {
  stock: OptimizationStockSheet[];
  onChange: (stock: OptimizationStockSheet[]) => void;
  inventoryItem: InventoryListItem | null;
  thickness: number;
}

// ============================================
// Helper Functions
// ============================================

function generateId(): string {
  return `ss-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================
// Component
// ============================================

export function PanelStockConfig({
  stock,
  onChange,
  inventoryItem,
  thickness,
}: PanelStockConfigProps) {
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customLength, setCustomLength] = useState<number>(2440);
  const [customWidth, setCustomWidth] = useState<number>(1220);
  const [customThickness, setCustomThickness] = useState<number>(thickness);
  const [customQuantity, setCustomQuantity] = useState<number>(0);
  const [customCost, setCustomCost] = useState<number>(inventoryItem?.costPerUnit || 0);

  // Derive costPerSheet from inventory, adjusting for pricing unit
  const deriveCostPerSheet = (sheetLengthMm: number): number => {
    const rawCost = inventoryItem?.costPerUnit || 0;
    const unit = inventoryItem?.costUnit;
    if (unit === 'm' || unit === 'lm' || unit === 'lft') {
      // Price is per linear meter — multiply by sheet length in meters
      return Math.round(rawCost * (sheetLengthMm / 1000));
    }
    if (unit === 'sqm' || unit === 'sqft') {
      // Price is per m² — multiply by sheet area in m²
      // (width not known at this point for presets, so handled in custom form)
      return rawCost; // will be overridden by user
    }
    // 'sheet', 'ea', or unspecified — use as-is
    return rawCost;
  };

  // Add stock from preset
  const handleAddPreset = (preset: { length: number; width: number; label: string }) => {
    const newSheet: OptimizationStockSheet = {
      id: generateId(),
      materialId: inventoryItem?.id || '',
      materialName: inventoryItem?.displayName || inventoryItem?.name || '',
      length: preset.length,
      width: preset.width,
      thickness: thickness,
      quantity: 0,
      costPerSheet: deriveCostPerSheet(preset.length),
    };
    onChange([...stock, newSheet]);
  };

  // Add custom stock
  const handleAddCustom = () => {
    const newSheet: OptimizationStockSheet = {
      id: generateId(),
      materialId: inventoryItem?.id || '',
      materialName: inventoryItem?.displayName || inventoryItem?.name || '',
      length: customLength,
      width: customWidth,
      thickness: customThickness,
      quantity: customQuantity,
      costPerSheet: customCost,
    };
    onChange([...stock, newSheet]);
    setShowCustomForm(false);
    // Reset form
    setCustomLength(2440);
    setCustomWidth(1220);
    setCustomThickness(thickness);
    setCustomQuantity(0);
    setCustomCost(inventoryItem?.costPerUnit || 0);
  };

  // Update stock item
  const handleUpdateStock = (id: string, updates: Partial<OptimizationStockSheet>) => {
    onChange(stock.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  // Remove stock item
  const handleRemoveStock = (id: string) => {
    onChange(stock.filter(s => s.id !== id));
  };

  // Check if preset is already added
  const isPresetAdded = (preset: { length: number; width: number }) => {
    return stock.some(s => s.length === preset.length && s.width === preset.width && s.thickness === thickness);
  };

  return (
    <div className="space-y-4">
      {/* Preset Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Add from Common Sizes
        </label>
        <div className="flex flex-wrap gap-2">
          {PANEL_SIZE_PRESETS.map((preset) => (
            <button
              key={`${preset.length}x${preset.width}`}
              onClick={() => handleAddPreset(preset)}
              disabled={isPresetAdded(preset)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                isPresetAdded(preset)
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50 hover:border-blue-300'
              }`}
            >
              {preset.label}
            </button>
          ))}
          <button
            onClick={() => setShowCustomForm(true)}
            className="px-3 py-1.5 text-sm rounded-lg border border-dashed border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Custom Size
          </button>
        </div>
      </div>

      {/* Custom Size Form */}
      {showCustomForm && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
          <h4 className="font-medium text-gray-700">Add Custom Size</h4>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Length (mm)</label>
              <input
                type="number"
                value={customLength}
                onChange={(e) => setCustomLength(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                min="100"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Width (mm)</label>
              <input
                type="number"
                value={customWidth}
                onChange={(e) => setCustomWidth(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                min="100"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Thickness (mm)</label>
              <select
                value={customThickness}
                onChange={(e) => setCustomThickness(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {COMMON_THICKNESSES.map((t) => (
                  <option key={t} value={t}>{t}mm</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Quantity in Stock</label>
              <input
                type="number"
                value={customQuantity}
                onChange={(e) => setCustomQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Cost per Sheet</label>
              <input
                type="number"
                value={customCost}
                onChange={(e) => setCustomCost(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                min="0"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowCustomForm(false)}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleAddCustom}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Size
            </button>
          </div>
        </div>
      )}

      {/* Stock List */}
      {stock.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Configured Stock Sizes
          </label>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Dimensions</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Thickness</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cost/Sheet</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stock.map((sheet) => (
                  <tr key={sheet.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm text-gray-900">
                      {sheet.length} × {sheet.width}mm
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600">
                      {sheet.thickness}mm
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={sheet.quantity}
                        onChange={(e) => handleUpdateStock(sheet.id, { quantity: Number(e.target.value) })}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        min="0"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={sheet.costPerSheet}
                        onChange={(e) => handleUpdateStock(sheet.id, { costPerSheet: Number(e.target.value) })}
                        className="w-28 px-2 py-1 border border-gray-300 rounded text-sm"
                        min="0"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => handleRemoveStock(sheet.id)}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {stock.length === 0 && !showCustomForm && (
        <div className="text-center py-8 text-gray-500 border border-dashed border-gray-300 rounded-lg">
          <p className="text-sm">No stock sizes configured</p>
          <p className="text-xs mt-1">Select a common size above or add a custom size</p>
        </div>
      )}
    </div>
  );
}

export default PanelStockConfig;
