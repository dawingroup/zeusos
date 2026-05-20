/**
 * OPO Receiving Dialog
 * Dual-location goods receipt: receive finished goods + consume ingredients.
 */

import { useState } from 'react';
import { Loader2, Package, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/core/components/ui/dialog';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Textarea } from '@/core/components/ui/textarea';
import type { PurchaseOrder } from '../types/purchaseOrder';
import type { OPOReceiveInput } from '../services/outsourcedPurchaseOrderService';

interface Props {
  open: boolean;
  onClose: () => void;
  opo: PurchaseOrder;
  onReceive: (receipt: OPOReceiveInput) => Promise<void>;
}

export function OPOReceivingDialog({ open, onClose, opo, onReceive }: Props) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [deliveryRef, setDeliveryRef] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recipeRows = opo.recipeSnapshot ?? [];

  const getRemaining = (lineItemId: string) => {
    const li = opo.lineItems.find(l => l.id === lineItemId);
    if (!li) return 0;
    return li.quantity - li.quantityReceived;
  };

  const getQty = (lineItemId: string) => quantities[lineItemId] ?? 0;

  const setQty = (lineItemId: string, val: number) => {
    setQuantities(prev => ({ ...prev, [lineItemId]: val }));
  };

  const totalReceiving = Object.values(quantities).reduce((s, q) => s + q, 0);

  // Calculate proportional ingredient consumption for preview
  const ingredientConsumption: Array<{ name: string; qty: number; unit: string; available: number }> = [];
  for (const li of opo.lineItems) {
    const receiveQty = getQty(li.id);
    if (receiveQty <= 0) continue;
    const itemRecipe = recipeRows.filter(r => r.parentLineItemId === li.id);
    for (const ingredient of itemRecipe) {
      const consumeQty = ingredient.quantityPerUnit * receiveQty;
      const existing = ingredientConsumption.find(ic => ic.name === ingredient.ingredientName);
      if (existing) {
        existing.qty += consumeQty;
      } else {
        ingredientConsumption.push({
          name: ingredient.ingredientName,
          qty: consumeQty,
          unit: ingredient.unit,
          available: ingredient.availableQuantity ?? 0,
        });
      }
    }
  }

  const hasInsufficientIngredients = ingredientConsumption.some(ic => ic.qty > ic.available);

  const handleReceive = async () => {
    setError(null);
    const lines = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([lineItemId, quantityReceived]) => ({
        lineItemId,
        quantityReceived,
        inventoryItemId: opo.lineItems.find(li => li.id === lineItemId)?.inventoryItemId,
      }));

    if (lines.length === 0) {
      setError('Enter at least one quantity to receive');
      return;
    }

    setSaving(true);
    try {
      await onReceive({
        lines,
        notes: notes || undefined,
        deliveryReference: deliveryRef || undefined,
      });
      setQuantities({});
      setNotes('');
      setDeliveryRef('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Receive OPO — {opo.poNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Ship-to Info */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p>
              <span className="text-muted-foreground">Finished goods → </span>
              <span className="font-medium">{opo.shipToWarehouseName || 'Ship-to warehouse'}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Ingredients consumed from → </span>
              <span className="font-medium">{opo.trackIngredientsWarehouseName || 'Tracking warehouse'}</span>
            </p>
          </div>

          {/* Line Items with Qty Input */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Finished Goods to Receive</Label>
            <div className="space-y-2">
              {opo.lineItems.map(li => {
                const remaining = getRemaining(li.id);
                if (remaining <= 0) return (
                  <div key={li.id} className="flex items-center gap-2 text-sm text-muted-foreground line-through">
                    <span className="flex-1">{li.description}</span>
                    <span>Fully received</span>
                  </div>
                );
                return (
                  <div key={li.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{li.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {li.quantityReceived} of {li.quantity} received — {remaining} remaining
                      </p>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={remaining}
                      value={getQty(li.id) || ''}
                      onChange={(e) => setQty(li.id, Math.min(parseFloat(e.target.value) || 0, remaining))}
                      className="w-24"
                      placeholder="0"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => setQty(li.id, remaining)}
                    >
                      All
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ingredient Consumption Preview */}
          {ingredientConsumption.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Ingredient Consumption (automatic)</Label>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-1">
                {ingredientConsumption.map((ic, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span>{ic.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        -{ic.qty.toFixed(2)} {ic.unit}
                      </span>
                      {ic.qty > ic.available && (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-label="Insufficient stock" />
                      )}
                    </div>
                  </div>
                ))}
                {hasInsufficientIngredients && (
                  <p className="text-xs text-amber-600 mt-2">
                    Some ingredients have insufficient stock. Receiving will still proceed but ingredient cost may be understated.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Delivery Reference */}
          <div className="space-y-2">
            <Label>Delivery Reference</Label>
            <Input
              value={deliveryRef}
              onChange={(e) => setDeliveryRef(e.target.value)}
              placeholder="Waybill number, tracking ID..."
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Receipt notes..." />
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">{error}</div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            onClick={handleReceive}
            disabled={saving || totalReceiving === 0}
            className="gap-2 bg-green-600 hover:bg-green-700"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Receiving...' : `Receive ${totalReceiving > 0 ? totalReceiving : ''} Items`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
