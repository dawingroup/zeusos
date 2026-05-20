/**
 * Fabric / Upholstery Stock Configuration Component
 *
 * Configure one or more roll definitions per fabric palette entry. Each row
 * captures the manufacturer's roll width, the manageable bay-cut length, the
 * cost per linear meter, and rotation/pattern-repeat constraints.
 *
 * Two ways to populate:
 *   1) Sync from inventory — pulls fabricSpec from the mapped inventory item
 *      (or all variants of its family). This is the recommended path; the
 *      data already lives on the inventory record.
 *   2) Add custom roll — manual entry, useful when a project has a one-off
 *      roll that isn't a stocked SKU.
 */

import { useState } from 'react';
import { Plus, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import type { FabricRollDefinition } from '@/shared/types';
import type { InventoryListItem } from '@/modules/inventory/types';
import {
  fetchFabricRollFromInventory,
  fetchFabricRollsFromInventoryFamily,
} from '@/modules/inventory/services/fabricInventorySync';

interface FabricStockConfigProps {
  stock: FabricRollDefinition[];
  onChange: (stock: FabricRollDefinition[]) => void;
  inventoryItem: InventoryListItem | null;
  materialName: string;
}

function generateId(): string {
  return `fr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function FabricStockConfig({
  stock,
  onChange,
  inventoryItem,
  materialName,
}: FabricStockConfigProps) {
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customRollWidth, setCustomRollWidth] = useState<number>(1400);
  const [customBayLength, setCustomBayLength] = useState<number>(3000);
  const [customCostPerMeter, setCustomCostPerMeter] = useState<number>(
    inventoryItem?.costPerUnit || 0,
  );
  const [customAllowRotation, setCustomAllowRotation] = useState(false);

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ count: number; warnings: string[] } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Resolve sync target: prefer the family if mapped to a variant, otherwise
  // the item itself (which may be a single fabric SKU with its own spec).
  const familyId =
    inventoryItem?.isFamily ? inventoryItem.id : inventoryItem?.familyId || null;
  const itemId = inventoryItem?.id || null;

  const handleSyncFromInventory = async () => {
    if (!itemId && !familyId) return;
    setSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      // Prefer family sync (gets every variant); fall back to single-item sync.
      if (familyId) {
        const result = await fetchFabricRollsFromInventoryFamily(familyId);
        if (result.rolls.length > 0) {
          onChange(result.rolls);
        }
        setSyncResult({ count: result.rolls.length, warnings: result.warnings });
      } else if (itemId) {
        const result = await fetchFabricRollFromInventory(itemId);
        if (result.roll) {
          onChange([result.roll]);
        }
        setSyncResult({
          count: result.roll ? 1 : 0,
          warnings: result.roll
            ? result.warnings
            : [
                ...result.warnings,
                `Inventory item "${inventoryItem?.displayName || materialName}" has no fabricSpec — set a roll specification on it before syncing.`,
              ],
        });
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  };

  const handleAddCustom = () => {
    if (customRollWidth <= 0 || customBayLength <= 0) {
      alert('Roll width and bay length must be greater than zero');
      return;
    }
    const newRoll: FabricRollDefinition = {
      id: generateId(),
      materialId: inventoryItem?.id || '',
      materialName: inventoryItem?.displayName || inventoryItem?.name || materialName,
      rollWidth: customRollWidth,
      defaultBayLength: customBayLength,
      costPerLinearMeter: customCostPerMeter,
      ...(customAllowRotation ? { allowRotation: true } : {}),
    };
    onChange([...stock, newRoll]);
    setShowCustomForm(false);
    setCustomRollWidth(1400);
    setCustomBayLength(3000);
    setCustomCostPerMeter(inventoryItem?.costPerUnit || 0);
    setCustomAllowRotation(false);
  };

  const handleUpdateRoll = (id: string, updates: Partial<FabricRollDefinition>) => {
    onChange(stock.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const handleRemoveRoll = (id: string) => {
    onChange(stock.filter((r) => r.id !== id));
  };

  const canSync = !!(familyId || itemId);

  return (
    <div className="space-y-4">
      {/* Sync from inventory */}
      <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-fuchsia-900">Sync stock from inventory</div>
            <div className="text-xs text-fuchsia-800 mt-0.5">
              {canSync
                ? familyId
                  ? `Pull every active fabric variant from the mapped family. Recommended when this palette entry maps to a fabric family with multiple SKUs.`
                  : `Pull the roll spec from the mapped inventory item.`
                : `Map this palette entry to an inventory item with a roll specification to enable sync.`}
            </div>
          </div>
          <button
            type="button"
            onClick={handleSyncFromInventory}
            disabled={syncing || !canSync}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-fuchsia-600 rounded-lg hover:bg-fuchsia-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync from inventory'}
          </button>
        </div>

        {syncResult && (
          <div className="mt-2 text-xs text-fuchsia-900">
            <div>
              {syncResult.count > 0
                ? `Synced ${syncResult.count} roll${syncResult.count === 1 ? '' : 's'} from inventory.`
                : `No rolls synced — see warnings below.`}
            </div>
            {syncResult.warnings.length > 0 && (
              <ul className="mt-1 list-disc list-inside space-y-0.5 text-amber-800">
                {syncResult.warnings.map((w, idx) => (
                  <li key={idx} className="flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {syncError && (
          <div className="mt-2 text-xs text-red-700">Sync failed: {syncError}</div>
        )}
      </div>

      {/* Add custom roll */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-gray-700">Configured rolls</div>
        <button
          type="button"
          onClick={() => setShowCustomForm((s) => !s)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-dashed border-gray-300 text-gray-600 hover:bg-gray-50"
        >
          <Plus className="w-4 h-4" />
          Custom roll
        </button>
      </div>

      {showCustomForm && (
        <div className="p-4 bg-fuchsia-50 border border-fuchsia-200 rounded-lg space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Roll Width (mm)</label>
              <input
                type="number"
                value={customRollWidth}
                onChange={(e) => setCustomRollWidth(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Default Bay Length (mm)</label>
              <input
                type="number"
                value={customBayLength}
                onChange={(e) => setCustomBayLength(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                min="1"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Cost per Linear Meter (UGX)</label>
            <input
              type="number"
              value={customCostPerMeter}
              onChange={(e) => setCustomCostPerMeter(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              min="0"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="fabric-rotation"
              type="checkbox"
              checked={customAllowRotation}
              onChange={(e) => setCustomAllowRotation(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="fabric-rotation" className="text-sm text-gray-700">
              Allow 90° rotation when nesting
              <span className="text-xs text-gray-500 ml-1">
                (leave off for fabrics with nap or directional pattern)
              </span>
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
              className="px-3 py-1.5 text-sm bg-fuchsia-600 text-white rounded-lg hover:bg-fuchsia-700"
            >
              Add Roll
            </button>
          </div>
        </div>
      )}

      {/* Roll list */}
      {stock.length > 0 ? (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Roll Width</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bay Length</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cost / m</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rotation</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stock.map((roll) => (
                <tr key={roll.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={roll.rollWidth}
                      onChange={(e) =>
                        handleUpdateRoll(roll.id, { rollWidth: Number(e.target.value) })
                      }
                      className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                      min="1"
                    />
                    <span className="text-xs text-gray-500 ml-1">mm</span>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={roll.defaultBayLength}
                      onChange={(e) =>
                        handleUpdateRoll(roll.id, { defaultBayLength: Number(e.target.value) })
                      }
                      className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                      min="1"
                    />
                    <span className="text-xs text-gray-500 ml-1">mm</span>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={roll.costPerLinearMeter}
                      onChange={(e) =>
                        handleUpdateRoll(roll.id, { costPerLinearMeter: Number(e.target.value) })
                      }
                      className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
                      min="0"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <label className="inline-flex items-center gap-1.5 text-xs text-gray-700">
                      <input
                        type="checkbox"
                        checked={roll.allowRotation === true}
                        onChange={(e) =>
                          handleUpdateRoll(roll.id, { allowRotation: e.target.checked })
                        }
                        className="rounded border-gray-300"
                      />
                      Allow
                    </label>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => handleRemoveRoll(roll.id)}
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
      ) : (
        <div className="text-center py-8 text-gray-500 border border-dashed border-gray-300 rounded-lg">
          <p className="text-sm">No fabric rolls configured</p>
          <p className="text-xs mt-1">
            Sync from inventory above or add a custom roll. Rolls drive the upholstery
            nesting in the Design Studio.
          </p>
        </div>
      )}
    </div>
  );
}

export default FabricStockConfig;
