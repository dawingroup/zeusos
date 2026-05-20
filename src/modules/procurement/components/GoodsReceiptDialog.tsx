/**
 * Goods Receipt Dialog
 * Per-line quantity entry for receiving goods against a PO
 * Includes inventory item linking so stock levels get updated
 */

import { useState, useEffect } from 'react';
import { Loader2, Search, Link2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import type { PurchaseOrder, GoodsReceiptLine } from '../types/purchaseOrder';
import type { Warehouse } from '@/modules/inventory/types/warehouse';
import type { InventoryListItem } from '@/modules/inventory/types/inventory';
import { searchInventory } from '@/modules/inventory/services/inventoryService';

interface Props {
  open: boolean;
  onClose: () => void;
  order: PurchaseOrder;
  warehouses: Warehouse[];
  onReceive: (receipt: {
    receivedAt: Date;
    receivedBy: string;
    lines: GoodsReceiptLine[];
    notes?: string;
    deliveryReference?: string;
  }) => Promise<void>;
  userId: string;
}

export function GoodsReceiptDialog({ open, onClose, order, warehouses, onReceive, userId }: Props) {
  const [quantities, setQuantities] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    order.lineItems.forEach((li) => {
      const remaining = li.quantity - li.quantityReceived;
      init[li.id] = remaining > 0 ? String(remaining) : '0';
    });
    return init;
  });
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '');
  const [deliveryRef, setDeliveryRef] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inventory item linking per line
  const [inventoryLinks, setInventoryLinks] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    order.lineItems.forEach((li) => {
      if (li.inventoryItemId) init[li.id] = li.inventoryItemId;
    });
    return init;
  });
  const [inventoryLinkNames, setInventoryLinkNames] = useState<Record<string, string>>({});
  const [searchingLine, setSearchingLine] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<InventoryListItem[]>([]);
  const [searching, setSearching] = useState(false);

  // Auto-search inventory items by PO line description on mount
  useEffect(() => {
    const autoLink = async () => {
      for (const li of order.lineItems) {
        if (li.inventoryItemId) continue; // already linked
        try {
          const results = await searchInventory(li.description, { limit: 1 });
          if (results.length === 1) {
            setInventoryLinks((prev) => ({ ...prev, [li.id]: results[0].id }));
            setInventoryLinkNames((prev) => ({ ...prev, [li.id]: results[0].name }));
          }
        } catch {
          // non-critical
        }
      }
    };
    autoLink();
  }, [order.lineItems]);

  const handleSearch = async (term: string) => {
    setSearchTerm(term);
    if (term.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await searchInventory(term.trim(), { limit: 8 });
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  };

  const selectInventoryItem = (lineId: string, item: InventoryListItem) => {
    setInventoryLinks((prev) => ({ ...prev, [lineId]: item.id }));
    setInventoryLinkNames((prev) => ({ ...prev, [lineId]: item.name }));
    setSearchingLine(null);
    setSearchTerm('');
    setSearchResults([]);
  };

  const handleSubmit = async () => {
    setError(null);

    const lines: GoodsReceiptLine[] = [];
    for (const li of order.lineItems) {
      const qty = parseFloat(quantities[li.id] || '0');
      if (qty <= 0) continue;

      const remaining = li.quantity - li.quantityReceived;
      if (qty > remaining) {
        setError(`Cannot receive ${qty} for "${li.description}" — only ${remaining} remaining`);
        return;
      }

      const line: GoodsReceiptLine = {
        lineItemId: li.id,
        quantityReceived: qty,
        warehouseId,
      };
      // Use linked inventory item (from dialog picker OR from PO line)
      const invId = inventoryLinks[li.id] || li.inventoryItemId;
      if (invId) line.inventoryItemId = invId;
      lines.push(line);
    }

    if (lines.length === 0) {
      setError('Enter at least one quantity to receive');
      return;
    }

    if (!warehouseId) {
      setError('Please select a warehouse');
      return;
    }

    setSaving(true);
    try {
      const receipt: Parameters<typeof onReceive>[0] = {
        receivedAt: new Date(),
        receivedBy: userId,
        lines,
      };
      if (notes.trim()) receipt.notes = notes.trim();
      if (deliveryRef.trim()) receipt.deliveryReference = deliveryRef.trim();
      await onReceive(receipt);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>Receive Goods — {order.poNumber}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Receive to Warehouse</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger>
                <SelectValue placeholder="Select warehouse" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Inventory Item
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Ordered
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Received
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-24">
                    Receive Now
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {order.lineItems.map((li) => {
                  const remaining = li.quantity - li.quantityReceived;
                  const linkedName = inventoryLinkNames[li.id];
                  const isLinked = !!inventoryLinks[li.id] || !!li.inventoryItemId;
                  const isSearching = searchingLine === li.id;

                  return (
                    <tr key={li.id}>
                      <td className="px-3 py-3 text-sm">
                        <div>{li.description}</div>
                        {li.sku && <div className="text-xs text-muted-foreground">{li.sku}</div>}
                      </td>
                      <td className="px-3 py-3 text-sm">
                        {isSearching ? (
                          <div className="relative">
                            <div className="flex items-center gap-1">
                              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <Input
                                autoFocus
                                placeholder="Search inventory..."
                                value={searchTerm}
                                onChange={(e) => handleSearch(e.target.value)}
                                className="h-7 text-xs"
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => { setSearchingLine(null); setSearchResults([]); setSearchTerm(''); }}
                              >
                                Cancel
                              </Button>
                            </div>
                            {(searchResults.length > 0 || searching) && (
                              <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                {searching ? (
                                  <div className="px-3 py-2 text-xs text-muted-foreground">Searching...</div>
                                ) : (
                                  searchResults.map((item) => (
                                    <button
                                      key={item.id}
                                      className="w-full px-3 py-2 text-left text-xs hover:bg-muted/50 flex justify-between"
                                      onClick={() => selectInventoryItem(li.id, item)}
                                    >
                                      <span className="font-medium">{item.name}</span>
                                      <span className="text-muted-foreground ml-2">{item.sku}</span>
                                    </button>
                                  ))
                                )}
                                {!searching && searchResults.length === 0 && searchTerm.length >= 2 && (
                                  <div className="px-3 py-2 text-xs text-muted-foreground">No items found</div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : isLinked ? (
                          <button
                            className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded hover:bg-green-100 transition-colors"
                            onClick={() => setSearchingLine(li.id)}
                            title="Click to change"
                          >
                            <Link2 className="h-3 w-3" />
                            <span className="truncate max-w-[120px]">{linkedName || 'Linked'}</span>
                          </button>
                        ) : (
                          <button
                            className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded hover:bg-amber-100 transition-colors"
                            onClick={() => { setSearchingLine(li.id); handleSearch(li.description.slice(0, 20)); }}
                          >
                            <Search className="h-3 w-3" />
                            Link to inventory
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm text-right">{li.quantity}</td>
                      <td className="px-3 py-3 text-sm text-right">{li.quantityReceived}/{li.quantity}</td>
                      <td className="px-3 py-3 text-right">
                        <Input
                          type="number"
                          value={quantities[li.id] || ''}
                          onChange={(e) =>
                            setQuantities((prev) => ({ ...prev, [li.id]: e.target.value }))
                          }
                          min={0}
                          max={remaining}
                          step={1}
                          className="h-8 w-20 ml-auto text-right"
                          disabled={remaining <= 0}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Warning if unlinked lines have quantities */}
          {order.lineItems.some((li) => {
            const qty = parseFloat(quantities[li.id] || '0');
            return qty > 0 && !inventoryLinks[li.id] && !li.inventoryItemId;
          }) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              Some lines are not linked to inventory items. Stock levels will not be updated for unlinked lines.
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Delivery Reference (e.g. waybill number)</Label>
            <Input
              value={deliveryRef}
              onChange={(e) => setDeliveryRef(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Confirm Receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
