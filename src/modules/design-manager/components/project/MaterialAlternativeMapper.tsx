/**
 * Material Alternative Mapper
 * Dialog for mapping alternative materials per quality tier on a palette entry.
 * Enables real-cost tier-based quoting (economy, standard, premium, luxury).
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Trash2,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Minus,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import type {
  MaterialPalette,
  MaterialPaletteEntry,
  MaterialAlternativeMapping,
  MaterialQualityTier,
} from '@/shared/types';
import { MATERIAL_QUALITY_TIER_LABELS } from '@/shared/types';
import {
  mapMaterialAlternative,
  removeMaterialAlternative,
  getAlternativesForEntry,
} from '../../services/materialAlternativeService';
import { subscribeToInventory } from '@/modules/inventory/services/inventoryService';
import type { InventoryListItem } from '@/modules/inventory/types';

// ============================================
// Types
// ============================================

interface MaterialAlternativeMapperProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  paletteEntry: MaterialPaletteEntry;
  palette: MaterialPalette;
  userId: string;
  onUpdated: () => void;
}

const TIERS: MaterialQualityTier[] = ['economy', 'standard', 'premium', 'luxury'];

const TIER_COLORS: Record<MaterialQualityTier, { bg: string; text: string; border: string }> = {
  economy: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200' },
  standard: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  premium: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
  luxury: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
};

// ============================================
// Component
// ============================================

export function MaterialAlternativeMapper({
  isOpen,
  onClose,
  projectId,
  paletteEntry,
  palette,
  userId,
  onUpdated,
}: MaterialAlternativeMapperProps) {
  const [activeTier, setActiveTier] = useState<MaterialQualityTier | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryListItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventorySearch, setInventorySearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<MaterialQualityTier | null>(null);

  // Get current alternatives for this entry
  const alternatives = getAlternativesForEntry(palette, paletteEntry.id);
  const altByTier = new Map(alternatives.map(a => [a.qualityTier, a]));

  // Load inventory when mapping a tier
  useEffect(() => {
    if (!activeTier) return;

    setInventoryLoading(true);
    const unsubscribe = subscribeToInventory(
      (items) => {
        // Show all active inventory items regardless of category — hardware,
        // fasteners, finishing, and adhesives are valid alternative-mapping targets.
        const mappableItems = items.filter(i => i.status === 'active');
        setInventoryItems(mappableItems);
        setInventoryLoading(false);
      },
      (error) => {
        console.error('Failed to load inventory:', error);
        setInventoryLoading(false);
      }
    );

    return () => unsubscribe();
  }, [activeTier]);

  // Reset search when changing tier
  useEffect(() => {
    setInventorySearch('');
  }, [activeTier]);

  if (!isOpen) return null;

  const filteredInventory = inventoryItems.filter(item => {
    if (!inventorySearch) return true;
    const q = inventorySearch.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      item.displayName?.toLowerCase().includes(q)
    );
  });

  const baseCost = paletteEntry.unitCost || 0;

  const handleMapAlternative = async (inventoryItem: InventoryListItem) => {
    if (!activeTier) return;
    setSaving(true);

    try {
      const alternative: MaterialAlternativeMapping = {
        qualityTier: activeTier,
        inventoryId: inventoryItem.id,
        inventoryName: inventoryItem.displayName || inventoryItem.name,
        inventorySku: inventoryItem.sku,
        unitCost: inventoryItem.costPerUnit || 0,
        costUnit: inventoryItem.costUnit,  // Preserve the unit (sheet, m, sqm, cbm, ea, etc.)
        currency: inventoryItem.currency || 'UGX',
        mappedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any,
        mappedBy: userId,
      };

      await mapMaterialAlternative(projectId, paletteEntry.id, alternative, userId);
      setActiveTier(null);
      onUpdated();
    } catch (error) {
      console.error('Failed to map alternative:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAlternative = async (tier: MaterialQualityTier) => {
    setRemoving(tier);
    try {
      await removeMaterialAlternative(projectId, paletteEntry.id, tier);
      onUpdated();
    } catch (error) {
      console.error('Failed to remove alternative:', error);
    } finally {
      setRemoving(null);
    }
  };

  const getCostDelta = (altCost: number): { percent: number; label: string; icon: React.ReactNode } => {
    if (baseCost === 0) return { percent: 0, label: 'N/A', icon: <Minus className="w-3 h-3" /> };
    const delta = ((altCost - baseCost) / baseCost) * 100;
    const rounded = Math.round(delta * 10) / 10;
    if (rounded < 0) {
      return {
        percent: rounded,
        label: `${rounded}%`,
        icon: <TrendingDown className="w-3 h-3 text-green-600" />,
      };
    }
    if (rounded > 0) {
      return {
        percent: rounded,
        label: `+${rounded}%`,
        icon: <TrendingUp className="w-3 h-3 text-red-600" />,
      };
    }
    return { percent: 0, label: '0%', icon: <Minus className="w-3 h-3 text-gray-400" /> };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Material Alternatives</h3>
              <p className="text-sm text-gray-500 mt-1">
                Map alternative materials for quality tiers on{' '}
                <strong>{paletteEntry.designName}</strong> ({paletteEntry.thickness}mm)
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Base material info */}
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase">Base Material (Standard)</span>
                <div className="text-sm font-medium text-gray-900 mt-0.5">
                  {paletteEntry.inventoryName || paletteEntry.designName}
                </div>
                {paletteEntry.inventorySku && (
                  <div className="text-xs text-gray-500">SKU: {paletteEntry.inventorySku}</div>
                )}
              </div>
              <div className="text-right">
                <span className="text-xs font-medium text-gray-500 uppercase">Unit Cost</span>
                <div className="text-sm font-semibold text-gray-900">
                  {baseCost > 0 ? `${baseCost.toLocaleString()} UGX` : 'Not set'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tier Grid */}
        {!activeTier && (
          <div className="px-6 py-4 flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              {TIERS.map((tier) => {
                const isStandard = tier === 'standard';
                const alt = altByTier.get(tier);
                const colors = TIER_COLORS[tier];
                const isRemoving = removing === tier;

                return (
                  <div
                    key={tier}
                    className={`p-4 rounded-lg border-2 ${
                      isStandard ? 'border-blue-300 bg-blue-50' : alt ? colors.border + ' ' + colors.bg : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-semibold ${colors.text}`}>
                        {MATERIAL_QUALITY_TIER_LABELS[tier]}
                      </span>
                      {isStandard && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                          <CheckCircle className="w-3 h-3" />
                          Base
                        </span>
                      )}
                      {!isStandard && alt && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                          <CheckCircle className="w-3 h-3" />
                          Mapped
                        </span>
                      )}
                    </div>

                    {isStandard ? (
                      <div className="text-sm text-gray-700">
                        <div className="font-medium">{paletteEntry.inventoryName || paletteEntry.designName}</div>
                        <div className="text-gray-500 mt-1">
                          {baseCost > 0 ? `${baseCost.toLocaleString()} UGX` : 'No price set'}
                        </div>
                      </div>
                    ) : alt ? (
                      <div>
                        <div className="text-sm font-medium text-gray-900">{alt.inventoryName}</div>
                        {alt.inventorySku && (
                          <div className="text-xs text-gray-500">SKU: {alt.inventorySku}</div>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm font-medium text-gray-900">
                            {alt.unitCost.toLocaleString()} {alt.currency}
                          </span>
                          {baseCost > 0 && (
                            <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                              getCostDelta(alt.unitCost).percent < 0 ? 'text-green-700' :
                              getCostDelta(alt.unitCost).percent > 0 ? 'text-red-700' : 'text-gray-500'
                            }`}>
                              {getCostDelta(alt.unitCost).icon}
                              {getCostDelta(alt.unitCost).label}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => setActiveTier(tier)}
                            className="flex-1 px-2 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 rounded hover:bg-blue-200"
                          >
                            Change
                          </button>
                          <button
                            onClick={() => handleRemoveAlternative(tier)}
                            disabled={isRemoving}
                            className="px-2 py-1.5 text-xs font-medium text-red-700 bg-red-100 rounded hover:bg-red-200 disabled:opacity-50"
                          >
                            {isRemoving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-sm text-gray-500 mb-3">No alternative mapped</div>
                        <button
                          onClick={() => setActiveTier(tier)}
                          className={`w-full px-3 py-2 text-sm font-medium rounded border border-dashed ${colors.border} ${colors.text} hover:${colors.bg}`}
                        >
                          Map {MATERIAL_QUALITY_TIER_LABELS[tier]} Alternative
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Summary */}
            {alternatives.length > 0 && baseCost > 0 && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Cost Comparison</h4>
                <div className="flex items-center gap-4">
                  {TIERS.filter(t => t !== 'standard').map(tier => {
                    const alt = altByTier.get(tier);
                    if (!alt) return null;
                    const delta = getCostDelta(alt.unitCost);
                    return (
                      <div key={tier} className="flex items-center gap-2 text-sm">
                        <span className={`font-medium ${TIER_COLORS[tier].text}`}>
                          {MATERIAL_QUALITY_TIER_LABELS[tier]}:
                        </span>
                        <span className={delta.percent < 0 ? 'text-green-700' : delta.percent > 0 ? 'text-red-700' : 'text-gray-500'}>
                          {delta.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Inventory Picker (when a tier is selected for mapping) */}
        {activeTier && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-6 py-3 border-b border-gray-100 bg-gray-50 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTier(null)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Back
                  </button>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                  <span className={`text-sm font-medium ${TIER_COLORS[activeTier].text}`}>
                    Select {MATERIAL_QUALITY_TIER_LABELS[activeTier]} Alternative
                  </span>
                </div>
              </div>
              <div className="mt-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  placeholder="Search inventory items..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-3">
              {inventoryLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-500">Loading inventory...</span>
                </div>
              ) : filteredInventory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {inventorySearch ? 'No matching inventory items' : 'No inventory items found'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredInventory.map((item) => {
                    const itemCost = item.costPerUnit || 0;
                    const delta = baseCost > 0 && itemCost > 0 ? getCostDelta(itemCost) : null;

                    return (
                      <button
                        key={item.id}
                        onClick={() => handleMapAlternative(item)}
                        disabled={saving}
                        className="w-full p-3 text-left border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-50"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-gray-900">
                              {item.displayName || item.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              SKU: {item.sku} {item.thickness && `| ${item.thickness}mm`}
                            </div>
                          </div>
                          <div className="text-right">
                            {itemCost > 0 ? (
                              <>
                                <div className="text-sm font-medium text-gray-900">
                                  {itemCost.toLocaleString()} {item.currency || 'UGX'}
                                </div>
                                {delta && (
                                  <div className={`flex items-center justify-end gap-1 text-xs font-medium ${
                                    delta.percent < 0 ? 'text-green-600' :
                                    delta.percent > 0 ? 'text-red-600' : 'text-gray-500'
                                  }`}>
                                    {delta.icon}
                                    {delta.label} vs standard
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="text-sm text-amber-600 flex items-center gap-1">
                                <AlertCircle className="w-4 h-4" />
                                No price
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
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
