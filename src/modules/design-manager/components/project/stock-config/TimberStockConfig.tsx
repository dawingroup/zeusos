/**
 * Timber Stock Configuration Component
 * For configuring dimensional lumber stock (cross-sections and lengths)
 */

import { useState } from 'react';
import { Plus, Trash2, X, RefreshCw, AlertTriangle } from 'lucide-react';
import type { TimberStockDefinition } from '@/shared/types';
import type { InventoryListItem } from '@/modules/inventory/types';
import { fetchTimberStockFromInventory } from '@/modules/inventory/services/timberInventorySync';

type PricingMethod = 'linear' | 'volumetric' | 'per-piece';

// ============================================
// Types
// ============================================

interface TimberStockConfigProps {
  stock: TimberStockDefinition[];
  onChange: (stock: TimberStockDefinition[]) => void;
  inventoryItem: InventoryListItem | null;
  materialName: string;
}

// ============================================
// Helper Functions
// ============================================

function generateId(): string {
  return `ts-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================
// Component
// ============================================

export function TimberStockConfig({
  stock,
  onChange,
  inventoryItem,
  materialName,
}: TimberStockConfigProps) {
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customThickness, setCustomThickness] = useState<number>(38);
  const [customWidth, setCustomWidth] = useState<number>(100);
  const [customLengths, setCustomLengths] = useState<number[]>([]);
  const [customPricingMethod, setCustomPricingMethod] = useState<PricingMethod>('linear');
  const [customCostPerMeter, setCustomCostPerMeter] = useState<number>(0);
  const [customCostPerCubicMeter, setCustomCostPerCubicMeter] = useState<number>(0);
  const [customCostPerPiece, setCustomCostPerPiece] = useState<Array<{ length: number; cost: number }>>([]);
  const [customIsDressed, setCustomIsDressed] = useState(true);
  const [customCanBeRipped, setCustomCanBeRipped] = useState(true);
  const [customSpecies, setCustomSpecies] = useState('');
  const [customGrade, setCustomGrade] = useState('');

  // Inventory sync state — for the "pull stock from inventory" button.
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    variantCount: number;
    crossSectionCount: number;
    warnings: string[];
  } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Resolve which family to sync from. The palette entry might map either to
  // the family parent itself or to a variant under it.
  const targetFamilyId =
    inventoryItem?.isFamily ? inventoryItem.id : (inventoryItem?.familyId || null);

  const handleSyncFromInventory = async () => {
    if (!targetFamilyId) return;
    setSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const result = await fetchTimberStockFromInventory(targetFamilyId, { materialName });
      // Replace the existing stock list with what inventory says is available.
      onChange(result.stocks);
      setSyncResult({
        variantCount: result.variantCount,
        crossSectionCount: result.stocks.length,
        warnings: result.warnings,
      });
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  };

  // Preset-based "add" was removed in favor of:
  //   1) Sync from inventory  (real on-hand stock)
  //   2) Add custom cross-section  (manual entry below)
  // Hardcoded defaults like [2400, 3000, 4800, 6000] mm produced fictional
  // stock sizes the workshop didn't actually have.

  // Add custom stock
  const handleAddCustom = () => {
    if (customLengths.length === 0) {
      alert('Please select at least one available length');
      return;
    }

    const newStock: TimberStockDefinition = {
      id: generateId(),
      materialId: inventoryItem?.id || '',
      materialName: materialName,
      thickness: customThickness,
      width: customWidth,
      availableLengths: customLengths,
      costPerLinearMeter: customPricingMethod === 'linear' ? customCostPerMeter : undefined,
      costPerCubicMeter: customPricingMethod === 'volumetric' ? customCostPerCubicMeter : undefined,
      costPerPiece: customPricingMethod === 'per-piece' && customCostPerPiece.length > 0
        ? customCostPerPiece
        : undefined,
      isDressed: customIsDressed,
      canBeRipped: customCanBeRipped,
      species: customSpecies || undefined,
      grade: customGrade || undefined,
    };
    onChange([...stock, newStock]);
    setShowCustomForm(false);
    // Reset form
    setCustomThickness(38);
    setCustomWidth(100);
    setCustomLengths([3000, 4800]);
    setCustomPricingMethod('linear');
    setCustomCostPerMeter(0);
    setCustomCostPerCubicMeter(0);
    setCustomCostPerPiece([]);
    setCustomIsDressed(true);
    setCustomCanBeRipped(true);
    setCustomSpecies('');
    setCustomGrade('');
  };

  // Update stock item
  const handleUpdateStock = (id: string, updates: Partial<TimberStockDefinition>) => {
    onChange(stock.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  // Remove stock item
  const handleRemoveStock = (id: string) => {
    onChange(stock.filter(s => s.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* Sync from inventory — pulls all active variants of this timber
          family in and groups them by cross-section. The optimizer's
          stock-selection algorithm then chooses the lowest-waste fit per
          part from those real-on-hand options. */}
      {targetFamilyId && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-blue-900">Sync stock from inventory</div>
              <p className="text-xs text-blue-800 mt-0.5 leading-snug">
                Pull all active variants of this timber family from the inventory database
                and group them by cross-section. Replaces the stock list below.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSyncFromInventory}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed flex-shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync from inventory'}
            </button>
          </div>
          {syncResult && (
            <div className="mt-2 text-xs text-blue-900 bg-white/60 rounded px-2 py-1.5 leading-snug">
              <div className="font-medium">
                Synced {syncResult.variantCount} variant{syncResult.variantCount === 1 ? '' : 's'} into{' '}
                {syncResult.crossSectionCount} cross-section group{syncResult.crossSectionCount === 1 ? '' : 's'}.
              </div>
              {syncResult.warnings.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {syncResult.warnings.map((w, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 text-amber-800">
                      <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {syncError && (
            <div className="mt-2 text-xs text-rose-800 bg-rose-50 rounded px-2 py-1.5">
              Sync failed: {syncError}
            </div>
          )}
        </div>
      )}

      {/* Custom-section trigger. Seeded preset cross-sections were removed —
          stock should come from inventory ("Sync from inventory" above) or
          from manual entry below. Hard-coded defaults were producing
          fictional stock sizes the workshop didn't actually have. */}
      <div>
        <button
          onClick={() => setShowCustomForm(true)}
          className="px-3 py-1.5 text-sm rounded-lg border border-dashed border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Add custom cross-section
        </button>
      </div>

      {/* Custom Form */}
      {showCustomForm && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-4">
          <h4 className="font-medium text-gray-700">Add Custom Timber Stock</h4>

          {/* Cross-section */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Thickness (mm)</label>
              <input
                type="number"
                value={customThickness}
                onChange={(e) => setCustomThickness(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                min="10"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Width (mm)</label>
              <input
                type="number"
                value={customWidth}
                onChange={(e) => setCustomWidth(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                min="10"
              />
            </div>
          </div>

          {/* Available Lengths — manual entry only. Preset length pills
              were removed because they were producing fictional stock the
              workshop didn't actually have. Real lengths come from the
              Sync-from-inventory button at the top. */}
          <div>
            <label className="block text-sm text-gray-600 mb-2">Available Lengths (mm)</label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="number"
                placeholder="e.g. 3000"
                min={100}
                step={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const v = Number((e.target as HTMLInputElement).value);
                    if (v && !customLengths.includes(v)) {
                      setCustomLengths([...customLengths, v].sort((a, b) => a - b));
                      (e.target as HTMLInputElement).value = '';
                    }
                  }
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <span className="text-xs text-gray-500">Press Enter to add</span>
            </div>
            {customLengths.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {customLengths.map((len) => (
                  <span
                    key={len}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-100 text-green-800 text-sm"
                  >
                    {len}mm
                    <button
                      type="button"
                      onClick={() => setCustomLengths(customLengths.filter(l => l !== len))}
                      className="hover:text-green-900"
                      title="Remove"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Species & Grade */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Species (optional)</label>
              <input
                type="text"
                value={customSpecies}
                onChange={(e) => setCustomSpecies(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="e.g., Meranti, Pine, Oak"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Grade (optional)</label>
              <input
                type="text"
                value={customGrade}
                onChange={(e) => setCustomGrade(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="e.g., Select, Premium"
              />
            </div>
          </div>

          {/* Pricing Method */}
          <div>
            <label className="block text-sm text-gray-600 mb-2">Pricing Method</label>
            <div className="flex gap-2">
              {([
                { value: 'linear' as PricingMethod, label: 'Per Linear Meter' },
                { value: 'volumetric' as PricingMethod, label: 'Per Cubic Meter (m³)' },
                { value: 'per-piece' as PricingMethod, label: 'Per Piece / Length' },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCustomPricingMethod(opt.value)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    customPricingMethod === opt.value
                      ? 'bg-green-100 text-green-800 border-green-300 font-medium'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cost Input — conditional on pricing method */}
          {customPricingMethod === 'linear' && (
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
          )}

          {customPricingMethod === 'volumetric' && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">Cost per Cubic Meter (m³)</label>
              <input
                type="number"
                value={customCostPerCubicMeter}
                onChange={(e) => setCustomCostPerCubicMeter(Number(e.target.value))}
                className="w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                min="0"
              />
              <p className="text-xs text-gray-400 mt-1">
                Volume = thickness × width × length. Cost calculated at optimization time.
              </p>
            </div>
          )}

          {customPricingMethod === 'per-piece' && (
            <div>
              <label className="block text-sm text-gray-600 mb-2">Cost per Standard Length</label>
              <div className="space-y-2">
                {customCostPerPiece.map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-16">{entry.length}mm</span>
                    <input
                      type="number"
                      value={entry.cost}
                      onChange={(e) => {
                        const updated = [...customCostPerPiece];
                        updated[idx] = { ...entry, cost: Number(e.target.value) };
                        setCustomCostPerPiece(updated);
                      }}
                      className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
                      min="0"
                      placeholder="Cost"
                    />
                    <button
                      type="button"
                      onClick={() => setCustomCostPerPiece(customCostPerPiece.filter((_, i) => i !== idx))}
                      className="p-1 text-red-400 hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {/* Add price for lengths not yet priced */}
                {customLengths
                  .filter(l => !customCostPerPiece.some(p => p.length === l))
                  .length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {customLengths
                      .filter(l => !customCostPerPiece.some(p => p.length === l))
                      .map((length) => (
                        <button
                          key={length}
                          type="button"
                          onClick={() => setCustomCostPerPiece([...customCostPerPiece, { length, cost: 0 }].sort((a, b) => a.length - b.length))}
                          className="px-2 py-0.5 text-xs rounded border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50"
                        >
                          + {length}mm
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Options */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={customIsDressed}
                onChange={(e) => setCustomIsDressed(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Dressed (PAR)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={customCanBeRipped}
                onChange={(e) => setCustomCanBeRipped(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Can be ripped</span>
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
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Add Timber Stock
            </button>
          </div>
        </div>
      )}

      {/* Stock List */}
      {stock.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Configured Timber Stock
          </label>
          <div className="space-y-3">
            {stock.map((item) => (
              <div key={item.id} className="p-3 border border-gray-200 rounded-lg bg-white">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-gray-900">
                      {item.thickness} × {item.width}mm
                      {item.species && <span className="text-gray-500 ml-2">({item.species})</span>}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {item.isDressed ? 'PAR' : 'Rough sawn'}
                      {item.canBeRipped && ' • Can be ripped'}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveStock(item.id)}
                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Available Lengths — manual entry only. Preset pills
                    were removed in favor of inventory-sync + manual add. */}
                <div className="mt-3">
                  <label className="text-xs text-gray-500 mb-1 block">Available Lengths (mm):</label>
                  <div className="flex items-center gap-2 mb-1.5">
                    <input
                      type="number"
                      placeholder="e.g. 3000"
                      min={100}
                      step={1}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const v = Number((e.target as HTMLInputElement).value);
                          if (v && !item.availableLengths.includes(v)) {
                            handleUpdateStock(item.id, {
                              availableLengths: [...item.availableLengths, v].sort((a, b) => a - b),
                            });
                            (e.target as HTMLInputElement).value = '';
                          }
                        }
                      }}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
                    />
                    <span className="text-[10px] text-gray-500">Press Enter</span>
                  </div>
                  {item.availableLengths.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {item.availableLengths.map((len) => (
                        <span
                          key={len}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs"
                        >
                          {len}mm
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateStock(item.id, {
                                availableLengths: item.availableLengths.filter(l => l !== len),
                              })
                            }
                            className="hover:text-green-900"
                            title="Remove"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-amber-700 italic">
                      No lengths configured — sync from inventory or add manually.
                    </p>
                  )}
                </div>

                {/* Pricing */}
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-1">
                    <label className="text-xs text-gray-500">Pricing:</label>
                    <div className="flex gap-1">
                      {([
                        { value: 'linear' as PricingMethod, label: '/m' },
                        { value: 'volumetric' as PricingMethod, label: '/m³' },
                        { value: 'per-piece' as PricingMethod, label: '/pc' },
                      ]).map((opt) => {
                        const isActive =
                          (opt.value === 'linear' && (item.costPerLinearMeter ?? 0) > 0 && !item.costPerCubicMeter && !item.costPerPiece?.length) ||
                          (opt.value === 'volumetric' && (item.costPerCubicMeter ?? 0) > 0) ||
                          (opt.value === 'per-piece' && (item.costPerPiece?.length ?? 0) > 0);
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              // Switch pricing method: clear others, set a default
                              if (opt.value === 'linear') {
                                handleUpdateStock(item.id, {
                                  costPerLinearMeter: item.costPerLinearMeter || 0,
                                  costPerCubicMeter: undefined,
                                  costPerPiece: undefined,
                                });
                              } else if (opt.value === 'volumetric') {
                                handleUpdateStock(item.id, {
                                  costPerLinearMeter: undefined,
                                  costPerCubicMeter: item.costPerCubicMeter || 0,
                                  costPerPiece: undefined,
                                });
                              } else {
                                handleUpdateStock(item.id, {
                                  costPerLinearMeter: undefined,
                                  costPerCubicMeter: undefined,
                                  costPerPiece: item.costPerPiece?.length
                                    ? item.costPerPiece
                                    : item.availableLengths.map(l => ({ length: l, cost: 0 })),
                                });
                              }
                            }}
                            className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                              isActive
                                ? 'bg-green-100 text-green-800 border-green-300 font-medium'
                                : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Linear cost input */}
                  {(!item.costPerCubicMeter && !item.costPerPiece?.length) && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500">Cost/m:</label>
                      <input
                        type="number"
                        value={item.costPerLinearMeter || 0}
                        onChange={(e) => handleUpdateStock(item.id, { costPerLinearMeter: Number(e.target.value) })}
                        className="w-28 px-2 py-1 border border-gray-300 rounded text-sm"
                        min="0"
                      />
                    </div>
                  )}

                  {/* Volumetric cost input */}
                  {(item.costPerCubicMeter !== undefined && item.costPerCubicMeter !== null) && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500">Cost/m³:</label>
                      <input
                        type="number"
                        value={item.costPerCubicMeter || 0}
                        onChange={(e) => handleUpdateStock(item.id, { costPerCubicMeter: Number(e.target.value) })}
                        className="w-28 px-2 py-1 border border-gray-300 rounded text-sm"
                        min="0"
                      />
                    </div>
                  )}

                  {/* Per-piece cost inputs */}
                  {(item.costPerPiece?.length ?? 0) > 0 && (
                    <div className="space-y-1">
                      {item.costPerPiece!.map((pp, idx) => (
                        <div key={pp.length} className="flex items-center gap-2">
                          <label className="text-xs text-gray-500 w-16">{pp.length}mm:</label>
                          <input
                            type="number"
                            value={pp.cost}
                            onChange={(e) => {
                              const updated = [...item.costPerPiece!];
                              updated[idx] = { ...pp, cost: Number(e.target.value) };
                              handleUpdateStock(item.id, { costPerPiece: updated });
                            }}
                            className="w-28 px-2 py-1 border border-gray-300 rounded text-sm"
                            min="0"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {stock.length === 0 && !showCustomForm && (
        <div className="text-center py-8 text-gray-500 border border-dashed border-gray-300 rounded-lg">
          <p className="text-sm">No timber stock configured</p>
          <p className="text-xs mt-1">Select a cross-section above or add a custom one</p>
        </div>
      )}
    </div>
  );
}

export default TimberStockConfig;
