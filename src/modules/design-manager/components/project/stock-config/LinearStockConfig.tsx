/**
 * Linear Stock Configuration Component
 * For configuring metal bars and aluminium profiles
 */

import { useState } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import type { LinearStockDefinition } from '@/shared/types';
import type { InventoryListItem } from '@/modules/inventory/types';
import {
  LINEAR_PROFILE_PRESETS,
  LINEAR_LENGTH_PRESETS,
  LINEAR_PROFILE_TYPES,
  LINEAR_MATERIAL_TYPES,
} from '../../../types/materials';

// ============================================
// Types
// ============================================

interface LinearStockConfigProps {
  stock: LinearStockDefinition[];
  onChange: (stock: LinearStockDefinition[]) => void;
  inventoryItem: InventoryListItem | null;
  materialName: string;
  materialType: 'steel' | 'aluminium';
}

type ProfileType = LinearStockDefinition['profileDimensions']['type'];

// ============================================
// Helper Functions
// ============================================

function generateId(): string {
  return `ls-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================
// Component
// ============================================

export function LinearStockConfig({
  stock,
  onChange,
  inventoryItem,
  materialName,
  materialType,
}: LinearStockConfigProps) {
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customProfileType, setCustomProfileType] = useState<ProfileType>('square');
  const [customDimension1, setCustomDimension1] = useState<number>(40);
  const [customDimension2, setCustomDimension2] = useState<number>(40);
  const [customWallThickness, setCustomWallThickness] = useState<number>(2);
  const [customLengths, setCustomLengths] = useState<number[]>([6000]);
  const [customCostPerMeter, setCustomCostPerMeter] = useState<number>(0);
  const [customMaterial, setCustomMaterial] = useState<LinearStockDefinition['material']>(materialType);
  const [customFinish, setCustomFinish] = useState('');

  // Add stock from preset profile
  const handleAddPreset = (preset: typeof LINEAR_PROFILE_PRESETS[0]) => {
    const profileDimensions: LinearStockDefinition['profileDimensions'] = {
      type: preset.type,
      dimension1: preset.dimension1,
      dimension2: 'dimension2' in preset ? preset.dimension2 : undefined,
      wallThickness: 'wallThickness' in preset ? preset.wallThickness : undefined,
    };

    const newStock: LinearStockDefinition = {
      id: generateId(),
      materialId: inventoryItem?.id || '',
      materialName: materialName,
      profile: preset.label,
      profileDimensions,
      availableLengths: [6000],
      costPerLinearMeter: inventoryItem?.costPerUnit || 0,
      material: materialType,
    };
    onChange([...stock, newStock]);
  };

  // Toggle length selection
  const toggleLength = (length: number) => {
    if (customLengths.includes(length)) {
      setCustomLengths(customLengths.filter(l => l !== length));
    } else {
      setCustomLengths([...customLengths, length].sort((a, b) => a - b));
    }
  };

  // Build profile label from dimensions
  const buildProfileLabel = (): string => {
    switch (customProfileType) {
      case 'round':
        return `${customDimension1}mm Round Bar`;
      case 'square':
        return `${customDimension1}×${customDimension1} SHS`;
      case 'rectangle':
        return `${customDimension1}×${customDimension2} RHS`;
      case 'angle':
        return `${customDimension1}×${customDimension2} Angle`;
      case 'channel':
        return `${customDimension1}×${customDimension2} Channel`;
      case 'flat':
        return `${customDimension1}×${customDimension2} Flat Bar`;
      case 'tube':
        return `${customDimension1}mm Tube (${customWallThickness}mm wall)`;
      default:
        return `${customDimension1}mm`;
    }
  };

  // Add custom stock
  const handleAddCustom = () => {
    if (customLengths.length === 0) {
      alert('Please select at least one available length');
      return;
    }

    const profileDimensions: LinearStockDefinition['profileDimensions'] = {
      type: customProfileType,
      dimension1: customDimension1,
      dimension2: ['rectangle', 'angle', 'channel', 'flat'].includes(customProfileType) ? customDimension2 : undefined,
      wallThickness: customProfileType === 'tube' ? customWallThickness : undefined,
    };

    const newStock: LinearStockDefinition = {
      id: generateId(),
      materialId: inventoryItem?.id || '',
      materialName: materialName,
      profile: buildProfileLabel(),
      profileDimensions,
      availableLengths: customLengths,
      costPerLinearMeter: customCostPerMeter,
      material: customMaterial,
      finish: customFinish || undefined,
    };
    onChange([...stock, newStock]);
    setShowCustomForm(false);
    // Reset form
    setCustomProfileType('square');
    setCustomDimension1(40);
    setCustomDimension2(40);
    setCustomWallThickness(2);
    setCustomLengths([6000]);
    setCustomCostPerMeter(0);
    setCustomMaterial(materialType);
    setCustomFinish('');
  };

  // Update stock item
  const handleUpdateStock = (id: string, updates: Partial<LinearStockDefinition>) => {
    onChange(stock.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  // Toggle available length for a stock item
  const handleToggleStockLength = (stockId: string, length: number) => {
    const item = stock.find(s => s.id === stockId);
    if (!item) return;

    const newLengths = item.availableLengths.includes(length)
      ? item.availableLengths.filter(l => l !== length)
      : [...item.availableLengths, length].sort((a, b) => a - b);

    if (newLengths.length === 0) {
      alert('Must have at least one available length');
      return;
    }

    handleUpdateStock(stockId, { availableLengths: newLengths });
  };

  // Remove stock item
  const handleRemoveStock = (id: string) => {
    onChange(stock.filter(s => s.id !== id));
  };

  // Check if preset is already added
  const isPresetAdded = (preset: typeof LINEAR_PROFILE_PRESETS[0]) => {
    return stock.some(s => s.profile === preset.label);
  };

  // Filter presets by material type
  const relevantPresets = LINEAR_PROFILE_PRESETS;

  return (
    <div className="space-y-4">
      {/* Preset Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Add from Common Profiles
        </label>
        <div className="flex flex-wrap gap-2">
          {relevantPresets.slice(0, 12).map((preset) => (
            <button
              key={preset.label}
              onClick={() => handleAddPreset(preset)}
              disabled={isPresetAdded(preset)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                isPresetAdded(preset)
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-slate-50 hover:border-slate-300'
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
            Custom Profile
          </button>
        </div>
      </div>

      {/* Custom Form */}
      {showCustomForm && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-4">
          <h4 className="font-medium text-gray-700">Add Custom Linear Stock</h4>

          {/* Profile Type */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Profile Type</label>
            <select
              value={customProfileType}
              onChange={(e) => setCustomProfileType(e.target.value as ProfileType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {LINEAR_PROFILE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          {/* Dimensions - varies by type */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                {customProfileType === 'round' || customProfileType === 'tube' ? 'Diameter' : 'Width'} (mm)
              </label>
              <input
                type="number"
                value={customDimension1}
                onChange={(e) => setCustomDimension1(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                min="1"
              />
            </div>
            {['rectangle', 'angle', 'channel', 'flat'].includes(customProfileType) && (
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  {customProfileType === 'flat' ? 'Thickness' : 'Height'} (mm)
                </label>
                <input
                  type="number"
                  value={customDimension2}
                  onChange={(e) => setCustomDimension2(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  min="1"
                />
              </div>
            )}
            {customProfileType === 'tube' && (
              <div>
                <label className="block text-sm text-gray-600 mb-1">Wall Thickness (mm)</label>
                <input
                  type="number"
                  value={customWallThickness}
                  onChange={(e) => setCustomWallThickness(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  min="0.5"
                  step="0.5"
                />
              </div>
            )}
          </div>

          {/* Material & Finish */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Material</label>
              <select
                value={customMaterial}
                onChange={(e) => setCustomMaterial(e.target.value as LinearStockDefinition['material'])}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {LINEAR_MATERIAL_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Finish (optional)</label>
              <input
                type="text"
                value={customFinish}
                onChange={(e) => setCustomFinish(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="e.g., Mill, Anodized"
              />
            </div>
          </div>

          {/* Available Lengths */}
          <div>
            <label className="block text-sm text-gray-600 mb-2">Available Lengths</label>
            <div className="flex flex-wrap gap-2">
              {LINEAR_LENGTH_PRESETS.map((preset) => (
                <button
                  key={preset.length}
                  onClick={() => toggleLength(preset.length)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors flex items-center gap-1 ${
                    customLengths.includes(preset.length)
                      ? 'bg-slate-200 text-slate-800 border-slate-400'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {customLengths.includes(preset.length) && <Check className="w-3 h-3" />}
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cost */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Cost per Linear Meter</label>
            <input
              type="number"
              value={customCostPerMeter}
              onChange={(e) => setCustomCostPerMeter(Number(e.target.value))}
              className="w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              min="0"
            />
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
              className="px-3 py-1.5 text-sm bg-slate-600 text-white rounded-lg hover:bg-slate-700"
            >
              Add Linear Stock
            </button>
          </div>
        </div>
      )}

      {/* Stock List */}
      {stock.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Configured Linear Stock
          </label>
          <div className="space-y-3">
            {stock.map((item) => (
              <div key={item.id} className="p-3 border border-gray-200 rounded-lg bg-white">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-gray-900">
                      {item.profile}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {LINEAR_MATERIAL_TYPES.find(t => t.value === item.material)?.label || item.material}
                      {item.finish && ` • ${item.finish}`}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveStock(item.id)}
                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Available Lengths */}
                <div className="mt-3">
                  <label className="text-xs text-gray-500 mb-1 block">Available Lengths:</label>
                  <div className="flex flex-wrap gap-1">
                    {LINEAR_LENGTH_PRESETS.map((preset) => (
                      <button
                        key={preset.length}
                        onClick={() => handleToggleStockLength(item.id, preset.length)}
                        className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                          item.availableLengths.includes(preset.length)
                            ? 'bg-slate-100 text-slate-800 border-slate-300'
                            : 'bg-gray-50 text-gray-400 border-gray-200'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cost */}
                <div className="mt-3 flex items-center gap-2">
                  <label className="text-xs text-gray-500">Cost/m:</label>
                  <input
                    type="number"
                    value={item.costPerLinearMeter}
                    onChange={(e) => handleUpdateStock(item.id, { costPerLinearMeter: Number(e.target.value) })}
                    className="w-28 px-2 py-1 border border-gray-300 rounded text-sm"
                    min="0"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {stock.length === 0 && !showCustomForm && (
        <div className="text-center py-8 text-gray-500 border border-dashed border-gray-300 rounded-lg">
          <p className="text-sm">No linear stock configured</p>
          <p className="text-xs mt-1">Select a profile above or add a custom one</p>
        </div>
      )}
    </div>
  );
}

export default LinearStockConfig;
