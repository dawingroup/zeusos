/**
 * OPO Material Dispatch Dialog
 * Allows dispatching ingredients from the tracking warehouse to a contractor location.
 * Shows available stock, editable quantities, and destination warehouse picker.
 */

import { useState, useEffect, useMemo } from 'react';
import { Loader2, Truck } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Textarea } from '@/core/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/core/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { useWarehouses } from '@/modules/inventory/hooks/useWarehouses';
import { getStockLevel } from '@/modules/inventory/services/stockLevelService';
import type { PurchaseOrder } from '../types/purchaseOrder';
import type { DispatchMaterialsInput } from '../services/outsourcedPurchaseOrderService';

interface Props {
  open: boolean;
  onClose: () => void;
  opo: PurchaseOrder;
  onDispatch: (input: DispatchMaterialsInput) => Promise<void>;
}

interface DispatchRow {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  totalQuantity: number;
  availableStock: number | null;
  dispatchQuantity: number;
}

export function OPOMaterialDispatchDialog({ open, onClose, opo, onDispatch }: Props) {
  const { warehouses } = useWarehouses(opo.subsidiaryId ?? null);
  const [rows, setRows] = useState<DispatchRow[]>([]);
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingStock, setLoadingStock] = useState(false);

  const recipeRows = useMemo(() => opo.recipeSnapshot ?? [], [opo.recipeSnapshot]);
  const trackingWarehouseId = opo.trackIngredientsWarehouseId ?? '';

  // Deduplicate ingredients (multiple line items may share ingredients)
  const uniqueIngredients = useMemo(() => {
    const map = new Map<string, { ingredientId: string; ingredientName: string; unit: string; totalQuantity: number }>();
    for (const r of recipeRows) {
      const existing = map.get(r.ingredientId);
      if (existing) {
        existing.totalQuantity += r.totalQuantity;
      } else {
        map.set(r.ingredientId, {
          ingredientId: r.ingredientId,
          ingredientName: r.ingredientName,
          unit: r.unit,
          totalQuantity: r.totalQuantity,
        });
      }
    }
    return Array.from(map.values());
  }, [recipeRows]);

  // Load available stock when dialog opens
  useEffect(() => {
    if (!open || !trackingWarehouseId || uniqueIngredients.length === 0) return;

    let cancelled = false;
    setLoadingStock(true);

    Promise.all(
      uniqueIngredients.map(async (ing) => {
        const stock = await getStockLevel(ing.ingredientId, trackingWarehouseId);
        return {
          ingredientId: ing.ingredientId,
          ingredientName: ing.ingredientName,
          unit: ing.unit,
          totalQuantity: ing.totalQuantity,
          availableStock: stock?.quantityAvailable ?? 0,
          dispatchQuantity: Math.min(ing.totalQuantity, stock?.quantityAvailable ?? 0),
        } as DispatchRow;
      }),
    ).then((loadedRows) => {
      if (!cancelled) {
        setRows(loadedRows);
        setLoadingStock(false);
      }
    });

    return () => { cancelled = true; };
  }, [open, trackingWarehouseId, uniqueIngredients]);

  // Filter out the tracking warehouse from destination options
  const destinationWarehouses = useMemo(
    () => warehouses.filter(w => w.id !== trackingWarehouseId),
    [warehouses, trackingWarehouseId],
  );

  const toWarehouseName = useMemo(
    () => destinationWarehouses.find(w => w.id === toWarehouseId)?.name ?? '',
    [destinationWarehouses, toWarehouseId],
  );

  const hasValidItems = rows.some(r => r.dispatchQuantity > 0);
  const canSubmit = toWarehouseId && hasValidItems && !submitting;

  const handleQuantityChange = (ingredientId: string, value: string) => {
    const num = parseFloat(value);
    setRows(prev =>
      prev.map(r =>
        r.ingredientId === ingredientId
          ? { ...r, dispatchQuantity: isNaN(num) ? 0 : Math.max(0, num) }
          : r,
      ),
    );
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onDispatch({
        items: rows
          .filter(r => r.dispatchQuantity > 0)
          .map(r => ({
            ingredientId: r.ingredientId,
            ingredientName: r.ingredientName,
            quantity: r.dispatchQuantity,
            unit: r.unit,
          })),
        toWarehouseId,
        toWarehouseName,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err) {
      console.error('Dispatch failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Dispatch Materials
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Source info */}
          <div className="text-sm text-muted-foreground">
            Transferring ingredients from <span className="font-medium text-foreground">{opo.trackIngredientsWarehouseName ?? 'Tracking Warehouse'}</span>
          </div>

          {/* Destination warehouse */}
          <div className="space-y-1.5">
            <Label>Destination Warehouse</Label>
            <Select value={toWarehouseId} onValueChange={setToWarehouseId}>
              <SelectTrigger>
                <SelectValue placeholder="Select destination..." />
              </SelectTrigger>
              <SelectContent>
                {destinationWarehouses.map(w => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ingredient rows */}
          <div className="space-y-1.5">
            <Label>Ingredients to Dispatch</Label>
            {loadingStock ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading stock levels...
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No ingredients in recipe</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground bg-muted/50">
                      <th className="text-left py-2 px-3">Ingredient</th>
                      <th className="text-right py-2 px-2">Needed</th>
                      <th className="text-right py-2 px-2">Available</th>
                      <th className="text-right py-2 px-3 w-28">Dispatch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => {
                      const overStock = row.availableStock !== null && row.dispatchQuantity > row.availableStock;
                      return (
                        <tr key={row.ingredientId} className="border-t">
                          <td className="py-2 px-3">
                            <span className="font-medium">{row.ingredientName}</span>
                            <span className="text-xs text-muted-foreground ml-1">({row.unit})</span>
                          </td>
                          <td className="text-right py-2 px-2 text-muted-foreground">
                            {row.totalQuantity}
                          </td>
                          <td className="text-right py-2 px-2">
                            <span className={row.availableStock !== null && row.availableStock < row.totalQuantity ? 'text-amber-600' : 'text-green-600'}>
                              {row.availableStock ?? '—'}
                            </span>
                          </td>
                          <td className="text-right py-2 px-3">
                            <Input
                              type="number"
                              min={0}
                              step="any"
                              value={row.dispatchQuantity}
                              onChange={(e) => handleQuantityChange(row.ingredientId, e.target.value)}
                              className={`h-7 text-right text-sm w-24 ${overStock ? 'border-red-300 focus-visible:ring-red-400' : ''}`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Dispatch notes..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Dispatch Materials
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
