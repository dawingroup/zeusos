/**
 * Create Outsourced Purchase Order Dialog
 * OPO creation with contractor picker, line items, recipe snapshot, and warehouse selection.
 */

import { useState, useCallback } from 'react';
import { Plus, Trash2, Loader2, Factory } from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { SupplierPicker } from './SupplierPicker';
import { POItemPicker } from './POItemPicker';
import type { UnifiedSearchResult } from '../hooks/usePOItemSearch';
import type { POLineItem, OPORecipeRow } from '../types/purchaseOrder';
import { DEFAULT_LANDED_COSTS } from '../types/purchaseOrder';
import { createOPO } from '../services/outsourcedPurchaseOrderService';
import { useWarehouses } from '@/modules/inventory/hooks/useWarehouses';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (opoId: string) => void;
  subsidiaryId: string;
  userId: string;
}

interface LineItemDraft {
  key: string;
  inventoryItemId: string;
  description: string;
  sku: string;
  quantity: string;
  unitCost: string;
  unit: string;
}

const emptyLineItem = (): LineItemDraft => ({
  key: crypto.randomUUID(),
  inventoryItemId: '',
  description: '',
  sku: '',
  quantity: '1',
  unitCost: '0',
  unit: 'pcs',
});

export function CreateOutsourcedOrderDialog({
  open,
  onClose,
  onCreated,
  subsidiaryId,
  userId,
}: Props) {
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [shipToWarehouseId, setShipToWarehouseId] = useState('');
  const [trackWarehouseId, setTrackWarehouseId] = useState('');
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([emptyLineItem()]);
  const [notes, setNotes] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [currency, setCurrency] = useState('UGX');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { warehouses } = useWarehouses(subsidiaryId);

  const handleSupplierChange = useCallback((value: { supplierId: string; supplierName: string } | null) => {
    setSupplierId(value?.supplierId ?? '');
    setSupplierName(value?.supplierName ?? '');
  }, []);

  const handleItemSelect = useCallback((index: number, result: UnifiedSearchResult) => {
    // Resolve fields from the discriminated union
    let inventoryItemId = '';
    let description = '';
    let sku = '';
    let unit = 'pcs';

    if (result.source === 'inventory') {
      inventoryItemId = result.item.id;
      description = result.item.name;
      sku = result.item.sku ?? '';
      unit = result.item.costUnit ?? 'pcs';
    } else if (result.source === 'material') {
      inventoryItemId = result.linkedInventory?.id ?? '';
      description = result.item.name;
      sku = result.item.code ?? '';
      unit = result.item.pricing?.unit ?? 'pcs';
    } else if (result.source === 'product') {
      description = result.item.name;
      sku = result.item.variants?.[0]?.sku ?? '';
    }

    setLineItems(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        inventoryItemId,
        description,
        sku,
        unit,
      };
      return updated;
    });
  }, []);

  const addLineItem = () => setLineItems(prev => [...prev, emptyLineItem()]);

  const removeLineItem = (index: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItemDraft, value: string) => {
    setLineItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const resetForm = () => {
    setSupplierId('');
    setSupplierName('');
    setSupplierContact('');
    setShipToWarehouseId('');
    setTrackWarehouseId('');
    setLineItems([emptyLineItem()]);
    setNotes('');
    setExpectedDate('');
    setCurrency('UGX');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCreate = async () => {
    setError(null);

    if (!supplierId) { setError('Please select a contractor'); return; }
    if (!shipToWarehouseId) { setError('Please select a ship-to warehouse'); return; }
    if (!trackWarehouseId) { setError('Please select a tracking warehouse'); return; }

    const validLines = lineItems.filter(li => li.description.trim() && parseFloat(li.quantity) > 0);
    if (validLines.length === 0) { setError('Add at least one line item'); return; }

    setSaving(true);
    try {
      const shipToWarehouse = warehouses.find(w => w.id === shipToWarehouseId);
      const trackWarehouse = warehouses.find(w => w.id === trackWarehouseId);

      const poLineItems: POLineItem[] = validLines.map(li => ({
        id: li.key,
        inventoryItemId: li.inventoryItemId || undefined,
        description: li.description,
        sku: li.sku,
        quantity: parseFloat(li.quantity) || 1,
        unitCost: parseFloat(li.unitCost) || 0,
        totalCost: (parseFloat(li.quantity) || 1) * (parseFloat(li.unitCost) || 0),
        currency,
        unit: li.unit,
        quantityReceived: 0,
      }));

      // Recipe snapshot will be empty for now — populated when user adds items with BOM
      const recipeSnapshot: OPORecipeRow[] = [];

      const opoId = await createOPO(
        {
          supplierId,
          supplierName,
          supplierContact,
          shipToWarehouseId,
          shipToWarehouseName: shipToWarehouse?.name ?? '',
          trackIngredientsWarehouseId: trackWarehouseId,
          trackIngredientsWarehouseName: trackWarehouse?.name ?? '',
          lineItems: poLineItems,
          recipeSnapshot,
          landedCosts: { ...DEFAULT_LANDED_COSTS, currency },
          notes: notes || undefined,
          expectedDeliveryDate: expectedDate ? new Date(expectedDate) : undefined,
          subsidiaryId,
        },
        userId,
      );

      resetForm();
      onClose();
      onCreated(opoId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const totalServiceFee = lineItems.reduce(
    (sum, li) => sum + (parseFloat(li.quantity) || 0) * (parseFloat(li.unitCost) || 0),
    0,
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5" />
            Create Outsourced Purchase Order
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Contractor Selection */}
          <div className="space-y-2">
            <Label>Contractor / Supplier <span className="text-destructive">*</span></Label>
            <SupplierPicker
              value={supplierId ? { supplierId, supplierName } : null}
              onChange={handleSupplierChange}
              subsidiaryId={subsidiaryId}
              preferredCategories={['contractor', 'subcontractor']}
              placeholder="Select contractor..."
            />
          </div>

          {/* Warehouses */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ship-to Warehouse <span className="text-destructive">*</span></Label>
              <Select value={shipToWarehouseId} onValueChange={setShipToWarehouseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Where finished goods arrive" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.filter(w => w.isActive).map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Track Ingredients In <span className="text-destructive">*</span></Label>
              <Select value={trackWarehouseId} onValueChange={setTrackWarehouseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Where ingredients are consumed from" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.filter(w => w.isActive).map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date & Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Expected Delivery</Label>
              <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UGX">UGX</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Line Items */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Outsourced Items (Service Fees)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lineItems.map((li, idx) => (
                <div key={li.key} className="flex gap-2 items-start">
                  <div className="flex-1 min-w-0">
                    <POItemPicker
                      value={li.description}
                      onSelect={(result) => handleItemSelect(idx, result)}
                      onInputChange={(value: string) => updateLineItem(idx, 'description', value)}
                      userId={userId}
                    />
                  </div>
                  <div className="w-20">
                    <Input
                      type="number"
                      min="1"
                      value={li.quantity}
                      onChange={(e) => updateLineItem(idx, 'quantity', e.target.value)}
                      placeholder="Qty"
                    />
                  </div>
                  <div className="w-16">
                    <Input
                      value={li.unit}
                      onChange={(e) => updateLineItem(idx, 'unit', e.target.value)}
                      placeholder="Unit"
                    />
                  </div>
                  <div className="w-28">
                    <Input
                      type="number"
                      min="0"
                      value={li.unitCost}
                      onChange={(e) => updateLineItem(idx, 'unitCost', e.target.value)}
                      placeholder="Fee/unit"
                    />
                  </div>
                  <div className="w-24 text-right pt-2 text-sm text-muted-foreground">
                    {currency} {((parseFloat(li.quantity) || 0) * (parseFloat(li.unitCost) || 0)).toLocaleString()}
                  </div>
                  {lineItems.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeLineItem(idx)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" className="gap-1" onClick={addLineItem}>
                <Plus className="h-3 w-3" /> Add Item
              </Button>
            </CardContent>
          </Card>

          {/* Summary */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-1">
            <div className="flex justify-between text-sm">
              <span>Total Service Fee</span>
              <span className="font-medium">{currency} {totalServiceFee.toLocaleString()}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Ingredient costs will be calculated from the product BOM after creation.
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Internal notes..." />
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Creating...' : 'Create OPO'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
