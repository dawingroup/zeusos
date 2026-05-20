/**
 * Create Purchase Order Dialog
 * Standalone PO creation with supplier picker, line item builder, and landed costs.
 * Includes smart consolidation to combine requirements from multiple MOs.
 */

import React, { useState, useCallback } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
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
import { SupplierPicker } from './SupplierPicker';
import { POItemPicker } from './POItemPicker';
import { SmartConsolidationAlert } from './SmartConsolidationAlert';
import { createPurchaseOrder } from '../../services/purchaseOrderService';
import { useSmartConsolidationForSupplier } from '../../hooks/useSmartConsolidation';
import {
  resolveInventoryItem,
  resolveLinkedMaterial,
  resolveUnlinkedMaterial,
  resolveProduct,
} from '../../hooks/usePOItemSearch';
import type { UnifiedSearchResult } from '../../hooks/usePOItemSearch';
import type { POLineItem, LandedCosts, LandedCostDistributionMethod, POLineItemCategory } from '../../types/purchaseOrder';
import { PO_LINE_CATEGORY_LABELS } from '../../types/purchaseOrder';
import type { ProcurementRequirement } from '../../types/procurement';

interface LineItemDraft {
  key: string;
  inventoryItemId: string;
  materialId: string;
  description: string;
  sku: string;
  quantity: string;
  unitCost: string;
  unit: string;
  weight: string;
  category: POLineItemCategory;
  assetCategory: string;
  expenseAccountCode: string;
}

const emptyLineItem = (): LineItemDraft => ({
  key: crypto.randomUUID(),
  inventoryItemId: '',
  materialId: '',
  description: '',
  sku: '',
  quantity: '',
  unitCost: '',
  unit: 'pcs',
  weight: '',
  category: 'inventory',
  assetCategory: '',
  expenseAccountCode: '',
});

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (poId: string) => void;
  subsidiaryId: string;
  userId: string;
}

export function CreatePurchaseOrderDialog({ open, onClose, onCreated, subsidiaryId, userId }: Props) {
  const [supplierValue, setSupplierValue] = useState<{ supplierId: string; supplierName: string } | null>(null);
  const [supplierContact, setSupplierContact] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([emptyLineItem()]);
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [currency, setCurrency] = useState('USD');
  const [landedCosts, setLandedCosts] = useState({
    shipping: '',
    customs: '',
    duties: '',
    insurance: '',
    handling: '',
    other: '',
  });
  const [distributionMethod, setDistributionMethod] = useState<LandedCostDistributionMethod>('proportional_value');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Smart consolidation - find other MOs needing same supplier
  const {
    opportunity: consolidationOpportunity,
    loading: consolidationLoading,
  } = useSmartConsolidationForSupplier({
    supplierId: supplierValue?.supplierId ?? null,
    subsidiaryId,
  });

  // Handler to add requirements from consolidation to line items
  const handleAddConsolidationRequirements = useCallback((requirements: ProcurementRequirement[]) => {
    const newItems: LineItemDraft[] = requirements.map((req) => ({
      key: crypto.randomUUID(),
      inventoryItemId: '',
      materialId: '',
      description: `${req.itemDescription} (MO: ${req.moNumber})`,
      sku: '',
      quantity: req.quantityRequired.toString(),
      unitCost: req.estimatedUnitCost.toString(),
      unit: req.unit,
      weight: '',
      category: 'inventory' as POLineItemCategory,
      assetCategory: '',
      expenseAccountCode: '',
    }));

    // Remove empty placeholder line items and add new ones
    setLineItems((prev) => {
      const nonEmpty = prev.filter((li) => li.description.trim() !== '');
      return [...nonEmpty, ...newItems];
    });

    // Update currency if needed
    if (requirements.length > 0 && requirements[0].currency !== currency) {
      setCurrency(requirements[0].currency);
    }
  }, [currency]);

  const resetForm = () => {
    setSupplierValue(null);
    setSupplierContact('');
    setNotes('');
    setLineItems([emptyLineItem()]);
    setOrderDate(new Date().toISOString().split('T')[0]);
    setCurrency('USD');
    setLandedCosts({ shipping: '', customs: '', duties: '', insurance: '', handling: '', other: '' });
    setDistributionMethod('proportional_value');
    setOrderDate(new Date().toISOString().split('T')[0]);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const updateLineItem = (key: string, field: keyof LineItemDraft, value: string) => {
    setLineItems((prev) =>
      prev.map((li) => (li.key === key ? { ...li, [field]: value } : li)),
    );
  };

  const addLineItem = () => {
    setLineItems((prev) => [...prev, emptyLineItem()]);
  };

  const removeLineItem = (key: string) => {
    setLineItems((prev) => prev.filter((li) => li.key !== key));
  };

  const handleItemSelected = async (key: string, result: UnifiedSearchResult) => {
    try {
      if (result.source === 'inventory') {
        const resolved = resolveInventoryItem(result.item);
        setLineItems((prev) =>
          prev.map((li) =>
            li.key === key
              ? {
                  ...li,
                  inventoryItemId: resolved.inventoryItemId,
                  description: resolved.description,
                  sku: resolved.sku,
                  unitCost: resolved.unitCost.toString(),
                  unit: resolved.unit,
                }
              : li,
          ),
        );
      } else if (result.source === 'material') {
        if (result.linkedInventory) {
          const resolved = resolveLinkedMaterial(result.item, result.linkedInventory);
          setLineItems((prev) =>
            prev.map((li) =>
              li.key === key
                ? {
                    ...li,
                    inventoryItemId: resolved.inventoryItemId,
                    materialId: resolved.materialId ?? '',
                    description: resolved.description,
                    sku: resolved.sku,
                    unitCost: resolved.unitCost.toString(),
                    unit: resolved.unit,
                  }
                : li,
            ),
          );
        } else {
          // Material without inventory link — auto-create inventory item
          const resolved = await resolveUnlinkedMaterial(result.item, userId);
          setLineItems((prev) =>
            prev.map((li) =>
              li.key === key
                ? {
                    ...li,
                    inventoryItemId: resolved.inventoryItemId,
                    materialId: resolved.materialId ?? '',
                    description: resolved.description,
                    sku: resolved.sku,
                    unitCost: resolved.unitCost.toString(),
                    unit: resolved.unit,
                  }
                : li,
            ),
          );
        }
      } else if (result.source === 'product') {
        const resolved = resolveProduct(result.item);
        setLineItems((prev) =>
          prev.map((li) =>
            li.key === key
              ? {
                  ...li,
                  inventoryItemId: resolved.inventoryItemId ?? '',
                  description: resolved.description,
                  sku: resolved.sku,
                  unitCost: resolved.unitCost.toString(),
                  unit: resolved.unit,
                }
              : li,
          ),
        );
      }
    } catch (err) {
      setError(`Failed to resolve item: ${(err as Error).message}`);
    }
  };

  const calcLineTotal = (li: LineItemDraft): number => {
    const qty = parseFloat(li.quantity) || 0;
    const cost = parseFloat(li.unitCost) || 0;
    return qty * cost;
  };

  const subtotal = lineItems.reduce((sum, li) => sum + calcLineTotal(li), 0);
  const totalLanded = Object.values(landedCosts).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);

  const handleSubmit = async () => {
    setError(null);

    if (!supplierValue) {
      setError('Please select a supplier');
      return;
    }

    const validLines = lineItems.filter((li) => li.description && parseFloat(li.quantity) > 0 && parseFloat(li.unitCost) > 0);
    if (validLines.length === 0) {
      setError('At least one line item with description, quantity, and unit cost is required');
      return;
    }

    setSaving(true);
    try {
      const poLineItems: POLineItem[] = validLines.map((li, idx) => {
        const item: POLineItem = {
          id: `LI-${Date.now()}-${idx}`,
          description: li.description,
          quantity: parseFloat(li.quantity),
          unitCost: parseFloat(li.unitCost),
          totalCost: calcLineTotal(li),
          currency,
          unit: li.unit,
          quantityReceived: 0,
        };
        if (li.sku) item.sku = li.sku;
        if (li.weight) item.weight = parseFloat(li.weight);
        if (li.inventoryItemId) item.inventoryItemId = li.inventoryItemId;
        if (li.materialId) item.materialId = li.materialId;
        if (li.category && li.category !== 'inventory') item.category = li.category;
        if (li.assetCategory) item.assetCategory = li.assetCategory;
        if (li.expenseAccountCode) item.expenseAccountCode = li.expenseAccountCode;
        return item;
      });

      const landedCostsData: LandedCosts = {
        shipping: parseFloat(landedCosts.shipping) || 0,
        customs: parseFloat(landedCosts.customs) || 0,
        duties: parseFloat(landedCosts.duties) || 0,
        insurance: parseFloat(landedCosts.insurance) || 0,
        handling: parseFloat(landedCosts.handling) || 0,
        other: parseFloat(landedCosts.other) || 0,
        totalLandedCost: totalLanded,
        currency,
        distributionMethod,
      };

      const poData: Parameters<typeof createPurchaseOrder>[0] = {
        supplierName: supplierValue.supplierName,
        supplierId: supplierValue.supplierId,
        lineItems: poLineItems,
        landedCosts: landedCostsData,
        subsidiaryId,
      };
      poData.orderDate = new Date(orderDate);
      if (supplierContact) poData.supplierContact = supplierContact;
      if (notes) poData.notes = notes;
      poData.orderDate = new Date(orderDate);

      const poId = await createPurchaseOrder(poData, userId);

      handleClose();
      onCreated(poId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const LANDED_COST_FIELDS = ['shipping', 'customs', 'duties', 'insurance', 'handling', 'other'] as const;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>Create Purchase Order</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Supplier Section */}
          <div>
            <h3 className="text-sm font-medium mb-2">Supplier</h3>
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 md:col-span-6">
                <SupplierPicker
                  value={supplierValue}
                  onChange={(val) => setSupplierValue(val)}
                  subsidiaryId={subsidiaryId}
                  label="Select Supplier"
                />
              </div>
              <div className="col-span-12 md:col-span-3">
                <div className="space-y-1.5">
                  <Label>Contact Person</Label>
                  <Input
                    value={supplierContact}
                    onChange={(e) => setSupplierContact(e.target.value)}
                  />
                </div>
              </div>
              <div className="col-span-12 md:col-span-3">
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="UGX">UGX</SelectItem>
                      <SelectItem value="AED">AED</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="KES">KES</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="col-span-12 md:col-span-3">
                <div className="space-y-1.5">
                  <Label>Order Date</Label>
                  <Input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Smart Consolidation Alert */}
          <SmartConsolidationAlert
            opportunity={consolidationOpportunity}
            loading={consolidationLoading}
            onAddRequirements={handleAddConsolidationRequirements}
          />

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Line Items</h3>
              <Button variant="ghost" size="sm" onClick={addLineItem} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider min-w-[200px]">
                      Description *
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-28">
                      Category
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-24">
                      SKU
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-20">
                      Qty *
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-16">
                      Unit
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-24">
                      Unit Cost *
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-20">
                      Weight (kg)
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-24">
                      Total
                    </th>
                    <th className="px-3 py-2.5 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lineItems.map((li) => (
                    <React.Fragment key={li.key}>
                    <tr>
                      <td className="px-3 py-2">
                        <POItemPicker
                          value={li.description}
                          onInputChange={(val) => updateLineItem(li.key, 'description', val)}
                          onSelect={(result) => handleItemSelected(li.key, result)}
                          placeholder="Search or type description..."
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={li.category}
                          onValueChange={(val) => updateLineItem(li.key, 'category', val)}
                        >
                          <SelectTrigger className="h-8 w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(PO_LINE_CATEGORY_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={li.sku}
                          onChange={(e) => updateLineItem(li.key, 'sku', e.target.value)}
                          className="h-8"
                          disabled={li.category !== 'inventory'}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          value={li.quantity}
                          onChange={(e) => updateLineItem(li.key, 'quantity', e.target.value)}
                          className="h-8 text-right"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={li.unit}
                          onChange={(e) => updateLineItem(li.key, 'unit', e.target.value)}
                          className="h-8"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          value={li.unitCost}
                          onChange={(e) => updateLineItem(li.key, 'unitCost', e.target.value)}
                          className="h-8 text-right"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          value={li.weight}
                          onChange={(e) => updateLineItem(li.key, 'weight', e.target.value)}
                          className="h-8 text-right"
                          disabled={li.category !== 'inventory'}
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-sm font-medium">
                        {calcLineTotal(li).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        {lineItems.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeLineItem(li.key)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                    {/* Category-specific sub-row */}
                    {li.category === 'asset' && (
                      <tr key={`${li.key}-asset`} className="bg-purple-50/30">
                        <td colSpan={9} className="px-3 py-2">
                          <div className="flex items-center gap-3 pl-2">
                            <Label className="text-xs text-muted-foreground whitespace-nowrap">Asset Type</Label>
                            <Select
                              value={li.assetCategory || ''}
                              onValueChange={(val) => updateLineItem(li.key, 'assetCategory', val)}
                            >
                              <SelectTrigger className="h-7 w-44">
                                <SelectValue placeholder="Select asset type..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="STATIONARY_MACHINE">Stationary Machine</SelectItem>
                                <SelectItem value="POWER_TOOL">Power Tool</SelectItem>
                                <SelectItem value="HAND_TOOL">Hand Tool</SelectItem>
                                <SelectItem value="CNC">CNC</SelectItem>
                                <SelectItem value="DUST_COLLECTION">Dust Collection</SelectItem>
                                <SelectItem value="SPRAY_EQUIPMENT">Spray Equipment</SelectItem>
                                <SelectItem value="SEWING_MACHINE">Sewing Machine</SelectItem>
                                <SelectItem value="JIG">Jig / Fixture</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </td>
                      </tr>
                    )}
                    {(li.category === 'service' || li.category === 'overhead') && (
                      <tr key={`${li.key}-expense`} className="bg-blue-50/30">
                        <td colSpan={9} className="px-3 py-2">
                          <div className="flex items-center gap-3 pl-2">
                            <Label className="text-xs text-muted-foreground whitespace-nowrap">Expense Account</Label>
                            <Input
                              value={li.expenseAccountCode}
                              onChange={(e) => updateLineItem(li.key, 'expenseAccountCode', e.target.value)}
                              placeholder="e.g. 5200 - Outsourced Services"
                              className="h-7 w-60"
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t" />

          {/* Landed Costs */}
          <div>
            <h3 className="text-sm font-medium mb-2">Landed Costs (optional)</h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {LANDED_COST_FIELDS.map((field) => (
                <div key={field} className="space-y-1.5">
                  <Label className="capitalize">{field}</Label>
                  <Input
                    type="number"
                    value={landedCosts[field]}
                    onChange={(e) => setLandedCosts((prev) => ({ ...prev, [field]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
              <div className="space-y-1.5">
                <Label>Cost Distribution</Label>
                <Select
                  value={distributionMethod}
                  onValueChange={(v) => setDistributionMethod(v as LandedCostDistributionMethod)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="proportional_value">Proportional by Value</SelectItem>
                    <SelectItem value="proportional_weight">Proportional by Weight</SelectItem>
                    <SelectItem value="equal">Equal Split</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="border-t" />

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Summary */}
          <div className="flex justify-end gap-6 text-sm">
            <span>Subtotal: <strong>{subtotal.toLocaleString()} {currency}</strong></span>
            <span>Landed: <strong>{totalLanded.toLocaleString()} {currency}</strong></span>
            <span>Grand Total: <strong>{(subtotal + totalLanded).toLocaleString()} {currency}</strong></span>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Create Purchase Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
