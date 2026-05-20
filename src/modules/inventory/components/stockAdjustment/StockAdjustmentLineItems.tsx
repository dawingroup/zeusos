/**
 * StockAdjustmentLineItems
 * Count-based stock adjustment: user enters final counted quantity,
 * variance is auto-computed against current system stock.
 */

import { useState, useCallback } from 'react';
import { Plus, Trash2, TrendingUp, TrendingDown, Minus, Recycle, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Badge } from '@/core/components/ui/badge';
import { POItemPicker } from '@/modules/procurement/components/POItemPicker';
import type { UnifiedSearchResult } from '@/modules/procurement/hooks/usePOItemSearch';
import {
  resolveInventoryItem,
} from '@/modules/procurement/hooks/usePOItemSearch';
import { getAggregatedStock } from '../../services/stockLevelService';
import type { StockAdjustmentLineItem, AdjustmentType } from '../../types/stockAdjustment';
import { queryAllOffcuts } from '@/shared/services/offcutLibraryService';
import type { Offcut } from '@/shared/types/offcut';
import { useAuth } from '@/shared/hooks/useAuth';

interface StockAdjustmentLineItemsProps {
  lineItems: StockAdjustmentLineItem[];
  onChange: (lineItems: StockAdjustmentLineItem[]) => void;
  adjustmentType: AdjustmentType;
  readOnly?: boolean;
}

export function StockAdjustmentLineItems({
  lineItems,
  onChange,
  adjustmentType,
  readOnly = false,
}: StockAdjustmentLineItemsProps) {
  const { user } = useAuth();
  const [showAddRow, setShowAddRow] = useState(false);
  const [newItemDescription, setNewItemDescription] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  // Offcut picker state
  const [offcuts, setOffcuts] = useState<Offcut[]>([]);
  const [offcutLoading, setOffcutLoading] = useState(false);
  const [offcutSearch, setOffcutSearch] = useState('');
  const [showOffcutPicker, setShowOffcutPicker] = useState(false);

  const isTransfer = adjustmentType === 'internal_transfer';
  const isOffcutAdjustment = adjustmentType === 'offcut_adjustment';

  /** Compute direction and adjustment quantity from counted vs current stock */
  const computeVariance = (currentStock: number, countedQty: number) => {
    const diff = countedQty - currentStock;
    return {
      direction: (diff >= 0 ? 'increase' : 'decrease') as 'increase' | 'decrease',
      quantity: Math.abs(diff),
    };
  };

  const handleItemSelected = useCallback(async (result: UnifiedSearchResult) => {
    if (result.source !== 'inventory') return;
    const resolved = resolveInventoryItem(result.item);

    // Fetch current stock
    setAddingItem(true);
    let currentStock = 0;
    try {
      const agg = await getAggregatedStock(resolved.inventoryItemId);
      currentStock = agg.totalOnHand;
    } catch {
      // If stock fetch fails, default to 0
    }
    setAddingItem(false);

    const { direction, quantity } = computeVariance(currentStock, currentStock); // start with no change

    const newLine: StockAdjustmentLineItem = {
      lineId: uuidv4(),
      itemId: resolved.inventoryItemId,
      itemName: resolved.description,
      itemSku: resolved.sku,
      direction,
      quantity,
      currentStock,
      countedQuantity: currentStock, // default to current (no variance)
      unitOfMeasure: resolved.unit || 'ea',
      unitCostAtAdjustment: resolved.unitCost || 0,
      totalValue: 0,
    };
    onChange([...lineItems, newLine]);
    setShowAddRow(false);
    setNewItemDescription('');
  }, [lineItems, onChange]);

  const handleAddOffcut = useCallback((offcut: Offcut) => {
    if (lineItems.some(l => l.offcutId === offcut.id)) return;
    const dims = offcut.crossSection
      ? `${offcut.crossSection.thickness}×${offcut.crossSection.width}mm × ${offcut.length}mm`
      : `${offcut.length}×${offcut.width}mm (${offcut.thickness}mm)`;
    const newLine: StockAdjustmentLineItem = {
      lineId: uuidv4(),
      itemId: '',
      itemName: offcut.materialName,
      itemSku: '',
      direction: 'decrease',
      quantity: 1,
      unitOfMeasure: 'pc',
      unitCostAtAdjustment: offcut.originalCostAllocation || 0,
      totalValue: offcut.originalCostAllocation || 0,
      offcutId: offcut.id,
      offcutDimensions: dims,
    };
    onChange([...lineItems, newLine]);
    setShowOffcutPicker(false);
    setOffcutSearch('');
  }, [lineItems, onChange]);

  const handleOpenOffcutPicker = useCallback(async () => {
    setShowOffcutPicker(true);
    if (offcuts.length === 0) {
      setOffcutLoading(true);
      try {
        const list = await queryAllOffcuts({ status: 'available' });
        setOffcuts(list);
      } catch (err) {
        console.error('Failed to load offcuts:', err);
      } finally {
        setOffcutLoading(false);
      }
    }
  }, [offcuts.length]);

  /** Handle counted quantity change — auto-compute direction and adjustment */
  const handleCountedQtyChange = useCallback((lineId: string, countedQty: number) => {
    const updated = lineItems.map(line => {
      if (line.lineId !== lineId) return line;
      const currentStock = line.currentStock ?? 0;
      const { direction, quantity } = computeVariance(currentStock, countedQty);
      return {
        ...line,
        countedQuantity: countedQty,
        direction,
        quantity,
        totalValue: quantity * (line.unitCostAtAdjustment || 0),
      };
    });
    onChange(updated);
  }, [lineItems, onChange]);

  const handleUpdateLine = useCallback((lineId: string, field: string, value: unknown) => {
    const updated = lineItems.map(line => {
      if (line.lineId !== lineId) return line;
      const updatedLine = { ...line, [field]: value };
      // Recalc total if cost changes
      if (field === 'unitCostAtAdjustment') {
        updatedLine.totalValue = (updatedLine.quantity || 0) * (updatedLine.unitCostAtAdjustment || 0);
      }
      return updatedLine;
    });
    onChange(updated);
  }, [lineItems, onChange]);

  const handleRemoveLine = useCallback((lineId: string) => {
    onChange(lineItems.filter(l => l.lineId !== lineId));
  }, [lineItems, onChange]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 })
      .format(amount);

  return (
    <div className="space-y-3">
      {/* Line Items Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider min-w-[200px]">
                {isOffcutAdjustment ? 'Material / Offcut' : 'Item'}
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-24">
                {isOffcutAdjustment ? 'Dimensions' : 'SKU'}
              </th>
              {!isOffcutAdjustment && (
                <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-24">
                  System Qty
                </th>
              )}
              <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-24">
                {isOffcutAdjustment ? 'Qty' : 'Counted Qty'}
              </th>
              {!isOffcutAdjustment && (
                <th className="px-3 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider w-28">
                  Variance
                </th>
              )}
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-16">
                UOM
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-24">
                Unit Cost
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-24">
                Impact
              </th>
              {isTransfer && (
                <>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-24">From</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-24">To</th>
                </>
              )}
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-28">
                Notes
              </th>
              {!readOnly && <th className="px-3 py-2.5 w-10" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lineItems.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No line items yet. Click &quot;Add Item&quot; to begin.
                </td>
              </tr>
            )}
            {lineItems.map((line) => {
              const variance = (line.countedQuantity ?? line.quantity) - (line.currentStock ?? 0);
              const hasVariance = line.quantity > 0;

              return (
                <tr key={line.lineId} className={hasVariance ? '' : 'bg-muted/20'}>
                  <td className="px-3 py-2 text-sm">
                    <div className="flex items-center gap-1.5">
                      {line.offcutId && <Recycle className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />}
                      <span className="font-medium">{line.itemName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground font-mono">
                    {line.offcutId ? (line.offcutDimensions || '—') : line.itemSku}
                  </td>

                  {/* System Qty (read-only) */}
                  {!isOffcutAdjustment && (
                    <td className="px-3 py-2 text-right">
                      <span className="text-sm text-muted-foreground">{line.currentStock ?? 0}</span>
                    </td>
                  )}

                  {/* Counted Qty (editable) */}
                  <td className="px-3 py-2">
                    {readOnly ? (
                      <span className="text-sm text-right block font-medium">
                        {line.countedQuantity ?? line.quantity}
                      </span>
                    ) : isOffcutAdjustment ? (
                      <Input
                        type="number"
                        value={line.quantity}
                        onChange={(e) => handleUpdateLine(line.lineId, 'quantity', Math.max(0, parseFloat(e.target.value) || 0))}
                        className="h-8 text-right w-24"
                        min={0}
                        step={1}
                      />
                    ) : (
                      <Input
                        type="number"
                        value={line.countedQuantity ?? 0}
                        onChange={(e) => handleCountedQtyChange(line.lineId, Math.max(0, parseFloat(e.target.value) || 0))}
                        className="h-8 text-right w-24 font-medium"
                        min={0}
                        step={1}
                      />
                    )}
                  </td>

                  {/* Variance (auto-computed) */}
                  {!isOffcutAdjustment && (
                    <td className="px-3 py-2 text-center">
                      {variance === 0 ? (
                        <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200">
                          <Minus className="h-3 w-3 mr-0.5" />
                          No change
                        </Badge>
                      ) : variance > 0 ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <TrendingUp className="h-3 w-3 mr-0.5" />
                          +{variance}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          <TrendingDown className="h-3 w-3 mr-0.5" />
                          {variance}
                        </Badge>
                      )}
                    </td>
                  )}

                  <td className="px-3 py-2">
                    {readOnly ? (
                      <span className="text-sm">{line.unitOfMeasure}</span>
                    ) : (
                      <Input
                        value={line.unitOfMeasure}
                        onChange={(e) => handleUpdateLine(line.lineId, 'unitOfMeasure', e.target.value)}
                        className="h-8 w-16"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {readOnly ? (
                      <span className="text-sm text-right block">{formatCurrency(line.unitCostAtAdjustment)}</span>
                    ) : (
                      <Input
                        type="number"
                        value={line.unitCostAtAdjustment}
                        onChange={(e) => {
                          const cost = Math.max(0, parseFloat(e.target.value) || 0);
                          const updated = lineItems.map(l => {
                            if (l.lineId !== line.lineId) return l;
                            return { ...l, unitCostAtAdjustment: cost, totalValue: (l.quantity || 0) * cost };
                          });
                          onChange(updated);
                        }}
                        className="h-8 text-right w-24"
                        min={0}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {line.quantity === 0 ? (
                      <span className="text-sm text-muted-foreground">—</span>
                    ) : (
                      <span className={`text-sm font-semibold ${line.direction === 'increase' ? 'text-green-600' : 'text-red-600'}`}>
                        {line.direction === 'decrease' ? '-' : '+'}
                        {formatCurrency(line.totalValue)}
                      </span>
                    )}
                  </td>
                  {isTransfer && (
                    <>
                      <td className="px-3 py-2">
                        {readOnly ? (
                          <span className="text-sm">{line.locationFrom || '—'}</span>
                        ) : (
                          <Input
                            value={line.locationFrom || ''}
                            onChange={(e) => handleUpdateLine(line.lineId, 'locationFrom', e.target.value)}
                            placeholder="From"
                            className="h-8 w-24"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {readOnly ? (
                          <span className="text-sm">{line.locationTo || '—'}</span>
                        ) : (
                          <Input
                            value={line.locationTo || ''}
                            onChange={(e) => handleUpdateLine(line.lineId, 'locationTo', e.target.value)}
                            placeholder="To"
                            className="h-8 w-24"
                          />
                        )}
                      </td>
                    </>
                  )}
                  <td className="px-3 py-2">
                    {readOnly ? (
                      <span className="text-xs text-muted-foreground">{line.notes || '—'}</span>
                    ) : (
                      <Input
                        value={line.notes || ''}
                        onChange={(e) => handleUpdateLine(line.lineId, 'notes', e.target.value)}
                        placeholder="Notes"
                        className="h-8 w-28"
                      />
                    )}
                  </td>
                  {!readOnly && (
                    <td className="px-3 py-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveLine(line.lineId)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}

            {/* Inline add row */}
            {!readOnly && showAddRow && !isOffcutAdjustment && (
              <tr className="bg-blue-50/30">
                <td colSpan={12} className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 max-w-md">
                      <POItemPicker
                        value={newItemDescription}
                        onInputChange={setNewItemDescription}
                        onSelect={handleItemSelected}
                        userId={user?.uid ?? ''}
                        placeholder="Search inventory items by name or SKU..."
                      />
                    </div>
                    {addingItem && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setShowAddRow(false); setNewItemDescription(''); }}
                    >
                      Cancel
                    </Button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Item Button */}
      {!readOnly && (
        <div>
          {isOffcutAdjustment ? (
            <Button variant="outline" size="sm" onClick={handleOpenOffcutPicker} className="gap-1.5">
              <Recycle className="h-4 w-4" />
              Add Offcut
            </Button>
          ) : !showAddRow ? (
            <Button variant="outline" size="sm" onClick={() => setShowAddRow(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          ) : null}
        </div>
      )}

      {/* Offcut Picker */}
      {showOffcutPicker && isOffcutAdjustment && (
        <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Select Offcut</h4>
            <Button variant="ghost" size="sm" onClick={() => setShowOffcutPicker(false)}>Cancel</Button>
          </div>
          <Input
            placeholder="Search offcuts by material name..."
            value={offcutSearch}
            onChange={(e) => setOffcutSearch(e.target.value)}
            className="h-8"
            autoFocus
          />
          <div className="max-h-60 overflow-auto space-y-1">
            {offcutLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (() => {
              const alreadyAdded = new Set(lineItems.filter(l => l.offcutId).map(l => l.offcutId));
              const filtered = offcuts.filter(o => {
                if (alreadyAdded.has(o.id)) return false;
                if (!offcutSearch) return true;
                return o.materialName.toLowerCase().includes(offcutSearch.toLowerCase());
              });
              if (filtered.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground py-3 text-center">
                    {offcutSearch ? 'No matching offcuts.' : 'No available offcuts.'}
                  </p>
                );
              }
              return filtered.map((offcut) => {
                const dims = offcut.crossSection
                  ? `${offcut.crossSection.thickness}×${offcut.crossSection.width}mm × ${offcut.length}mm`
                  : `${offcut.length}×${offcut.width}mm (${offcut.thickness}mm)`;
                return (
                  <div
                    key={offcut.id}
                    className="flex items-center justify-between px-3 py-2 rounded-md cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => handleAddOffcut(offcut)}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Recycle className="h-3.5 w-3.5 text-green-600" />
                        <span className="text-sm font-medium">{offcut.materialName}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{dims} · {offcut.condition} · {offcut.materialType}</p>
                    </div>
                    <span className="text-sm text-muted-foreground">{formatCurrency(offcut.originalCostAllocation)}</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
