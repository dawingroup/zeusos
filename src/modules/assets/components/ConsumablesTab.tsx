/**
 * Consumables Tab
 * Shows required consumables/repair parts for an asset,
 * AI-suggested parts, and stock management actions.
 */

import { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Minus,
  AlertTriangle,
  Sparkles,
  Shield,
  Wrench,
  Loader2,
  Clock,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { consumableService } from '../services/consumableService';
import { useAuth } from '@/shared/hooks';
import type { Asset } from '@/shared/types';
import type { AssetConsumable, ConsumableType } from '../types/consumable';
import { CONSUMABLE_TYPE_LABELS } from '../types/consumable';
import type {
  AIConsumableSuggestion,
  RepairPartsStrategy,
} from '../types/assetIntelligence';

// ============================================================================
// CONFIG
// ============================================================================

const TYPE_COLORS: Record<ConsumableType, { bg: string; text: string }> = {
  'cutting-tool': { bg: 'bg-red-50', text: 'text-red-700' },
  'abrasive': { bg: 'bg-orange-50', text: 'text-orange-700' },
  'filter': { bg: 'bg-sky-50', text: 'text-sky-700' },
  'lubricant': { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  'wear-part': { bg: 'bg-amber-50', text: 'text-amber-700' },
  'electrical': { bg: 'bg-violet-50', text: 'text-violet-700' },
  'accessory': { bg: 'bg-blue-50', text: 'text-blue-700' },
};

function getStockColor(item: AssetConsumable): string {
  if (item.quantityOnHand <= 0) return 'text-red-600';
  if (item.quantityOnHand <= item.reorderLevel) return 'text-amber-600';
  return 'text-green-600';
}

function getStockBg(item: AssetConsumable): string {
  if (item.quantityOnHand <= 0) return 'bg-red-50 border-red-200';
  if (item.quantityOnHand <= item.reorderLevel) return 'bg-amber-50 border-amber-200';
  return 'bg-white border-gray-200';
}

// ============================================================================
// COMPONENT
// ============================================================================

interface ConsumablesTabProps {
  asset: Asset;
  aiSuggestions?: AIConsumableSuggestion[];
  repairPartsStrategy?: RepairPartsStrategy;
}

export function ConsumablesTab({
  asset,
  aiSuggestions,
  repairPartsStrategy,
}: ConsumablesTabProps) {
  const { user } = useAuth();
  const [consumables, setConsumables] = useState<AssetConsumable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [operatingId, setOperatingId] = useState<string | null>(null);
  const [addingIndex, setAddingIndex] = useState<number | null>(null);
  const [showStrategy, setShowStrategy] = useState(false);

  useEffect(() => {
    loadConsumables();
  }, [asset.id, asset.category]);

  const loadConsumables = async () => {
    setIsLoading(true);
    try {
      const results = await consumableService.getConsumablesForAsset(asset);
      setConsumables(results);
    } catch (err) {
      console.error('Failed to load consumables:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseOne = async (consumable: AssetConsumable) => {
    if (consumable.quantityOnHand <= 0) return;
    setOperatingId(consumable.id);
    try {
      await consumableService.recordUsage(consumable.id, 1);
      setConsumables(prev =>
        prev.map(c =>
          c.id === consumable.id
            ? { ...c, quantityOnHand: c.quantityOnHand - 1 }
            : c
        )
      );
    } catch (err) {
      console.error('Failed to record usage:', err);
    } finally {
      setOperatingId(null);
    }
  };

  const handleRestock = async (consumable: AssetConsumable) => {
    setOperatingId(consumable.id);
    try {
      await consumableService.restockConsumable(consumable.id, consumable.reorderQuantity);
      setConsumables(prev =>
        prev.map(c =>
          c.id === consumable.id
            ? { ...c, quantityOnHand: c.quantityOnHand + c.reorderQuantity }
            : c
        )
      );
    } catch (err) {
      console.error('Failed to restock:', err);
    } finally {
      setOperatingId(null);
    }
  };

  const handleAddFromAI = async (suggestion: AIConsumableSuggestion, index: number) => {
    if (!user?.uid) return;
    setAddingIndex(index);
    try {
      await consumableService.createFromAISuggestions([suggestion], asset.category, user.uid);
      await loadConsumables();
    } catch (err) {
      console.error('Failed to add from AI suggestion:', err);
    } finally {
      setAddingIndex(null);
    }
  };

  const lowStockCount = consumables.filter(c => c.quantityOnHand <= c.reorderLevel).length;
  const criticalCount = consumables.filter(c => c.isCritical && c.quantityOnHand <= 0).length;

  return (
    <div className="space-y-4">
      {/* Summary Alert */}
      {criticalCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <strong>{criticalCount} critical</strong> part{criticalCount > 1 ? 's' : ''} out of stock
          </span>
        </div>
      )}

      {lowStockCount > 0 && criticalCount === 0 && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <strong>{lowStockCount}</strong> item{lowStockCount > 1 ? 's' : ''} at or below reorder level
          </span>
        </div>
      )}

      {/* Catalogued Consumables */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-500" />
            <h3 className="font-semibold text-gray-900 text-sm">
              Required Parts & Consumables
            </h3>
            {consumables.length > 0 && (
              <span className="text-xs text-gray-400">({consumables.length})</span>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : consumables.length === 0 ? (
          <div className="text-center py-10 px-4">
            <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-500">No consumables catalogued yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Run AI analysis to discover required parts, or add them manually
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {consumables.map((item) => {
              const typeColor = TYPE_COLORS[item.type] || TYPE_COLORS.accessory;
              const stockColor = getStockColor(item);
              const stockBg = getStockBg(item);
              const isOperating = operatingId === item.id;

              return (
                <div key={item.id} className={`px-4 py-3 ${stockBg}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {item.name}
                        </span>
                        {item.isCritical && (
                          <Shield className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        )}
                        {item.aiSuggested && (
                          <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${typeColor.bg} ${typeColor.text}`}>
                          {CONSUMABLE_TYPE_LABELS[item.type]}
                        </span>
                        {item.partNumber && (
                          <span className="text-[10px] text-gray-400">#{item.partNumber}</span>
                        )}
                        {item.expectedLifeHours && (
                          <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                            <Clock className="w-2.5 h-2.5" />
                            {item.expectedLifeHours}h life
                          </span>
                        )}
                      </div>
                      {item.fitmentNotes && (
                        <p className="text-[11px] text-gray-400 mt-1">{item.fitmentNotes}</p>
                      )}
                    </div>

                    {/* Stock & Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right mr-1">
                        <div className={`text-sm font-bold ${stockColor}`}>
                          {item.quantityOnHand}
                        </div>
                        <div className="text-[10px] text-gray-400">{item.unitOfMeasure}</div>
                      </div>
                      <button
                        onClick={() => handleUseOne(item)}
                        disabled={isOperating || item.quantityOnHand <= 0}
                        title="Used 1"
                        className="p-1.5 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isOperating ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                        ) : (
                          <Minus className="w-3.5 h-3.5 text-gray-500" />
                        )}
                      </button>
                      <button
                        onClick={() => handleRestock(item)}
                        disabled={isOperating}
                        title={`Restock +${item.reorderQuantity}`}
                        className="p-1.5 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                      >
                        <Plus className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI-Suggested Parts */}
      {aiSuggestions && aiSuggestions.length > 0 && (
        <div className="bg-white border border-purple-200 rounded-lg">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-purple-100 bg-purple-50 rounded-t-lg">
            <Sparkles className="w-4 h-4 text-purple-500" />
            <h3 className="font-semibold text-gray-900 text-sm">
              AI-Discovered Parts
            </h3>
            <span className="text-xs text-purple-500">({aiSuggestions.length})</span>
          </div>
          <div className="divide-y divide-gray-100">
            {aiSuggestions.map((suggestion, i) => {
              const typeColor = TYPE_COLORS[suggestion.type] || TYPE_COLORS.accessory;
              const isAdding = addingIndex === i;
              const alreadyCatalogued = consumables.some(
                c => c.name.toLowerCase() === suggestion.name.toLowerCase() ||
                     (suggestion.partNumber && c.partNumber === suggestion.partNumber)
              );

              return (
                <div key={i} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {suggestion.name}
                        </span>
                        {suggestion.isCritical && (
                          <Shield className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${typeColor.bg} ${typeColor.text}`}>
                          {CONSUMABLE_TYPE_LABELS[suggestion.type] || suggestion.type}
                        </span>
                        {suggestion.partNumber && (
                          <span className="text-[10px] text-gray-400">#{suggestion.partNumber}</span>
                        )}
                        {suggestion.expectedLifeHours && (
                          <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                            <Clock className="w-2.5 h-2.5" />
                            {suggestion.expectedLifeHours}h
                          </span>
                        )}
                        {suggestion.estimatedCost && (
                          <span className="text-[10px] text-gray-400">
                            ~{suggestion.estimatedCost.amount} {suggestion.estimatedCost.currency}
                          </span>
                        )}
                      </div>
                      {suggestion.replacementTrigger && (
                        <p className="text-[11px] text-gray-400 mt-1">{suggestion.replacementTrigger}</p>
                      )}
                    </div>

                    <button
                      onClick={() => handleAddFromAI(suggestion, i)}
                      disabled={isAdding || alreadyCatalogued}
                      className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg ${
                        alreadyCatalogued
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50'
                      }`}
                    >
                      {isAdding ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : alreadyCatalogued ? (
                        'Added'
                      ) : (
                        <>
                          <Plus className="w-3 h-3" />
                          Add
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Repair Parts Strategy */}
      {repairPartsStrategy && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <button
            onClick={() => setShowStrategy(!showStrategy)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 rounded-lg"
          >
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-gray-500" />
              <h3 className="font-semibold text-gray-900 text-sm">
                Repair Parts Strategy
              </h3>
            </div>
            {showStrategy ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {showStrategy && (
            <div className="px-4 pb-4 space-y-4">
              {/* Uptime Risk Assessment */}
              {repairPartsStrategy.uptimeRiskAssessment && (
                <div className="px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  <strong>Uptime Risk:</strong> {repairPartsStrategy.uptimeRiskAssessment}
                </div>
              )}

              {/* Critical Spares */}
              {repairPartsStrategy.criticalSpares.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-red-500" />
                    Critical Spares
                  </div>
                  <div className="space-y-2">
                    {repairPartsStrategy.criticalSpares.map((spare, i) => (
                      <div key={i} className="bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">{spare.part}</span>
                          <span className="text-xs text-gray-500">
                            Stock {spare.recommendedStock}
                            {spare.estimatedCost ? ` (~${spare.estimatedCost.toLocaleString()} UGX)` : ''}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">{spare.reason}</p>
                        {spare.replacementInterval && (
                          <p className="text-[10px] text-gray-400 mt-0.5">{spare.replacementInterval}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Maintenance Kits */}
              {repairPartsStrategy.maintenanceKits.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                    <Wrench className="w-3.5 h-3.5" />
                    Maintenance Kits
                  </div>
                  <div className="space-y-2">
                    {repairPartsStrategy.maintenanceKits.map((kit, i) => (
                      <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">{kit.name}</span>
                          {kit.estimatedCost && (
                            <span className="text-xs text-gray-500">
                              ~{kit.estimatedCost.toLocaleString()} UGX
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {kit.parts.map((part, j) => (
                            <span key={j} className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] text-gray-600">
                              {part}
                            </span>
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">{kit.frequency}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
