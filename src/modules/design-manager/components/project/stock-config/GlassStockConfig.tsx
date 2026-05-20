/**
 * Glass Stock Configuration Component
 * For configuring glass sheet stock sizes with glass-specific properties
 */

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { GlassStockDefinition } from '@/shared/types';
import type { InventoryListItem } from '@/modules/inventory/types';
import { GLASS_SIZE_PRESETS, GLASS_TYPES } from '../../../types/materials';

// ============================================
// Types
// ============================================

interface GlassStockConfigProps {
  stock: GlassStockDefinition[];
  onChange: (stock: GlassStockDefinition[]) => void;
  inventoryItem: InventoryListItem | null;
  thickness: number;
}

// ============================================
// Helper Functions
// ============================================

function generateId(): string {
  return `gs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Glass thicknesses are different from panel
const GLASS_THICKNESSES = [3, 4, 5, 6, 8, 10, 12, 15, 19];

// ============================================
// Component
// ============================================

export function GlassStockConfig({
  stock,
  onChange,
  inventoryItem,
  thickness,
}: GlassStockConfigProps) {
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customLength, setCustomLength] = useState<number>(2440);
  const [customWidth, setCustomWidth] = useState<number>(1220);
  const [customThickness, setCustomThickness] = useState<number>(thickness || 6);
  const [customQuantity, setCustomQuantity] = useState<number>(0);
  const [customCost, setCustomCost] = useState<number>(inventoryItem?.costPerUnit || 0);
  const [customGlassType, setCustomGlassType] = useState<GlassStockDefinition['glassType']>('clear');
  const [customSafetyMargin, setCustomSafetyMargin] = useState<number>(25);
  const [customMinCutLength, setCustomMinCutLength] = useState<number>(100);
  const [customMinCutWidth, setCustomMinCutWidth] = useState<number>(100);
  const [customRequiresPolishing, setCustomRequiresPolishing] = useState(true);

  // Add stock from preset
  const handleAddPreset = (preset: { length: number; width: number; label: string }) => {
    const newSheet: GlassStockDefinition = {
      id: generateId(),
      materialId: inventoryItem?.id || '',
      materialName: inventoryItem?.displayName || inventoryItem?.name || '',
      length: preset.length,
      width: preset.width,
      thickness: thickness || 6,
      quantity: 0,
      costPerSheet: inventoryItem?.costPerUnit || 0,
      glassType: 'clear',
      safetyMargin: 25,
      minimumCutSize: { length: 100, width: 100 },
      requiresPolishing: true,
      fragile: true,
    };
    onChange([...stock, newSheet]);
  };

  // Add custom stock
  const handleAddCustom = () => {
    const newSheet: GlassStockDefinition = {
      id: generateId(),
      materialId: inventoryItem?.id || '',
      materialName: inventoryItem?.displayName || inventoryItem?.name || '',
      length: customLength,
      width: customWidth,
      thickness: customThickness,
      quantity: customQuantity,
      costPerSheet: customCost,
      glassType: customGlassType,
      safetyMargin: customSafetyMargin,
      minimumCutSize: { length: customMinCutLength, width: customMinCutWidth },
      requiresPolishing: customRequiresPolishing,
      fragile: true,
    };
    onChange([...stock, newSheet]);
    setShowCustomForm(false);
    // Reset form
    setCustomLength(2440);
    setCustomWidth(1220);
    setCustomThickness(thickness || 6);
    setCustomQuantity(0);
    setCustomCost(inventoryItem?.costPerUnit || 0);
    setCustomGlassType('clear');
    setCustomSafetyMargin(25);
    setCustomMinCutLength(100);
    setCustomMinCutWidth(100);
    setCustomRequiresPolishing(true);
  };

  // Update stock item
  const handleUpdateStock = (id: string, updates: Partial<GlassStockDefinition>) => {
    onChange(stock.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  // Remove stock item
  const handleRemoveStock = (id: string) => {
    onChange(stock.filter(s => s.id !== id));
  };

  // Check if preset is already added
  const isPresetAdded = (preset: { length: number; width: number }) => {
    return stock.some(s => s.length === preset.length && s.width === preset.width);
  };

  return (
    <div className="space-y-4">
      {/* Preset Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Add from Common Glass Sizes
        </label>
        <div className="flex flex-wrap gap-2">
          {GLASS_SIZE_PRESETS.map((preset) => (
            <button
              key={`${preset.length}x${preset.width}`}
              onClick={() => handleAddPreset(preset)}
              disabled={isPresetAdded(preset)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                isPresetAdded(preset)
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-cyan-50 hover:border-cyan-300'
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
        <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-lg space-y-4">
          <h4 className="font-medium text-gray-700">Add Custom Glass Size</h4>

          {/* Dimensions */}
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
                {GLASS_THICKNESSES.map((t) => (
                  <option key={t} value={t}>{t}mm</option>
                ))}
              </select>
            </div>
          </div>

          {/* Glass Type & Safety */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Glass Type</label>
              <select
                value={customGlassType}
                onChange={(e) => setCustomGlassType(e.target.value as GlassStockDefinition['glassType'])}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {GLASS_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Safety Margin (mm)</label>
              <input
                type="number"
                value={customSafetyMargin}
                onChange={(e) => setCustomSafetyMargin(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                min="0"
                placeholder="Distance from edge"
              />
            </div>
          </div>

          {/* Minimum Cut Size */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Min Cut Length (mm)</label>
              <input
                type="number"
                value={customMinCutLength}
                onChange={(e) => setCustomMinCutLength(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                min="50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Min Cut Width (mm)</label>
              <input
                type="number"
                value={customMinCutWidth}
                onChange={(e) => setCustomMinCutWidth(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                min="50"
              />
            </div>
          </div>

          {/* Quantity & Cost */}
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

          {/* Requires Polishing */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="requiresPolishing"
              checked={customRequiresPolishing}
              onChange={(e) => setCustomRequiresPolishing(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="requiresPolishing" className="text-sm text-gray-700">
              Edges require polishing after cutting
            </label>
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
              className="px-3 py-1.5 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
            >
              Add Glass Size
            </button>
          </div>
        </div>
      )}

      {/* Stock List */}
      {stock.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Configured Glass Stock
          </label>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Dimensions</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Margin</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stock.map((sheet) => (
                  <tr key={sheet.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm text-gray-900">
                      {sheet.length} × {sheet.width} × {sheet.thickness}mm
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={sheet.glassType}
                        onChange={(e) => handleUpdateStock(sheet.id, { glassType: e.target.value as GlassStockDefinition['glassType'] })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        {GLASS_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={sheet.safetyMargin}
                        onChange={(e) => handleUpdateStock(sheet.id, { safetyMargin: Number(e.target.value) })}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                        min="0"
                      />
                      <span className="text-xs text-gray-500 ml-1">mm</span>
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
          <p className="text-sm">No glass stock sizes configured</p>
          <p className="text-xs mt-1">Select a common size above or add a custom size</p>
        </div>
      )}
    </div>
  );
}

export default GlassStockConfig;
