/**
 * PO Line Item Detail Drawer
 *
 * Full-featured slide-over panel for a PO line item that provides:
 * - Line item detail editing (description, SKU, category, account, quantity, costs, weight)
 * - Alternative items finder with AI-enhanced semantic matching
 * - Inventory adjustment fields
 *
 * Opens as a right-side Sheet when a line item row is clicked in PurchaseOrderDetailPage.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  ArrowRightLeft,
  Package,
  Check,
  Loader2,
  Sparkles,
  Save,
  DollarSign,
  Scale,
  FileText,
  Layers,
  TrendingDown,
  TrendingUp,
  Warehouse,
  Hash,
  Minus,
  ChevronDown,
  ChevronRight,
  Lock,
  Info,
  BoxIcon,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/core/components/ui/sheet';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Badge } from '@/core/components/ui/badge';
import { Textarea } from '@/core/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import type { POLineItem, POLineItemCategory } from '../types/purchaseOrder';
import { PO_LINE_ITEM_CATEGORY_LABELS } from '../types/purchaseOrder';
import {
  findSimilarItemsEnhanced,
  type SimilarInventoryItem,
} from '@/shared/services/inventory/similarItemService';
import { searchInventory } from '@/modules/inventory/services/inventoryService';

// ============================================
// Types
// ============================================

type DrawerTab = 'detail' | 'alternatives';

interface POLineItemAlternativesProps {
  open: boolean;
  onClose: () => void;
  lineItem: POLineItem;
  /** Save edits to this line item's fields (description, sku, category, etc.) */
  onSave: (lineItemId: string, updates: Partial<POLineItem>) => Promise<void>;
  /** Replace this line item with a completely different inventory item */
  onSubstitute: (lineItemId: string, newItem: SimilarInventoryItem) => void;
  /** Whether the PO is in an editable state */
  canEdit: boolean;
}

// ============================================
// Component
// ============================================

export function POLineItemAlternatives({
  open,
  onClose,
  lineItem,
  onSave,
  onSubstitute,
  canEdit,
}: POLineItemAlternativesProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>('detail');
  const [saving, setSaving] = useState(false);

  // ---- Detail tab state ----
  const [editDescription, setEditDescription] = useState('');
  const [editSku, setEditSku] = useState('');
  const [editCategory, setEditCategory] = useState<string>('inventory');
  const [editExpenseAccount, setEditExpenseAccount] = useState('');
  const [editQuantity, setEditQuantity] = useState(0);
  const [editUnitCost, setEditUnitCost] = useState(0);
  const [editUnit, setEditUnit] = useState('');
  const [editWeight, setEditWeight] = useState<number | ''>('');
  const [editMpn, setEditMpn] = useState('');
  const [editAssetCategory, setEditAssetCategory] = useState('');
  // Packaging
  const [editPackagingUnit, setEditPackagingUnit] = useState('');
  const [editPackagingQty, setEditPackagingQty] = useState<number | ''>('');

  // ---- Alternatives tab state ----
  const [altLoading, setAltLoading] = useState(false);
  const [altItems, setAltItems] = useState<SimilarInventoryItem[]>([]);
  const [altSearch, setAltSearch] = useState('');
  const [altSelectedId, setAltSelectedId] = useState<string | null>(null);
  const [useAI, setUseAI] = useState(false);
  const [altLoaded, setAltLoaded] = useState(false);
  const [fallbackResults, setFallbackResults] = useState<SimilarInventoryItem[]>([]);
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const fallbackDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLocked = lineItem.quantityReceived > 0;
  const totalCost = editQuantity * editUnitCost;
  const receivedPct = editQuantity > 0
    ? Math.round((lineItem.quantityReceived / editQuantity) * 100)
    : 0;

  // Populate form state when line item changes
  useEffect(() => {
    if (!open) return;
    setEditDescription(lineItem.description ?? '');
    setEditSku(lineItem.sku ?? '');
    setEditCategory(lineItem.category ?? 'inventory');
    setEditExpenseAccount(lineItem.expenseAccountCode ?? '');
    setEditQuantity(lineItem.quantity);
    setEditUnitCost(lineItem.unitCost);
    setEditUnit(lineItem.unit ?? 'pcs');
    setEditWeight(lineItem.weight ?? '');
    setEditMpn(lineItem.mpn ?? '');
    setEditAssetCategory(lineItem.assetCategory ?? '');
    setEditPackagingUnit(lineItem.packagingUnit ?? '');
    setEditPackagingQty(lineItem.packagingQty ?? '');
    setActiveTab('detail');
    setAltLoaded(false);
    setAltSelectedId(null);
    setAltSearch('');
  }, [open, lineItem]);

  // Lazy-load alternatives only when tab is activated
  useEffect(() => {
    if (activeTab !== 'alternatives' || altLoaded) return;
    setAltLoading(true);
    setAltSelectedId(null);
    setAltSearch('');

    findSimilarItemsEnhanced(
      {
        inventoryItemId: lineItem.inventoryItemId,
        category: lineItem.category,
        sku: lineItem.sku,
        name: lineItem.description,
        description: lineItem.description,
      },
      { semanticSearch: useAI },
    )
      .then((results) => {
        setAltItems(results);
        setAltLoaded(true);
      })
      .catch((err) => {
        console.error('Failed to find alternative items:', err);
        setAltItems([]);
        setAltLoaded(true);
      })
      .finally(() => setAltLoading(false));
  }, [activeTab, altLoaded, lineItem, useAI]);

  // Re-search when AI toggle changes
  const handleToggleAI = () => {
    setUseAI(!useAI);
    setAltLoaded(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(lineItem.id, {
        description: editDescription,
        sku: editSku || undefined,
        category: editCategory,
        expenseAccountCode: editExpenseAccount || undefined,
        quantity: editQuantity,
        unitCost: editUnitCost,
        totalCost,
        unit: editUnit,
        weight: editWeight === '' ? undefined : editWeight,
        mpn: editMpn || undefined,
        assetCategory: editAssetCategory || undefined,
        packagingUnit: editPackagingUnit || undefined,
        packagingQty: editPackagingQty === '' ? undefined : editPackagingQty,
      });
      onClose();
    } catch {
      /* error handled by parent */
    }
    setSaving(false);
  };

  const handleSubstitute = () => {
    const selected = altItems.find((i) => i.id === altSelectedId)
      ?? fallbackResults.find((i) => i.id === altSelectedId);
    if (!selected) return;
    onSubstitute(lineItem.id, selected);
    onClose();
  };

  // Fallback: when manual search has text, search full inventory as well
  useEffect(() => {
    if (fallbackDebounce.current) clearTimeout(fallbackDebounce.current);
    if (!altSearch || altSearch.trim().length < 2) {
      setFallbackResults([]);
      return;
    }
    setFallbackLoading(true);
    fallbackDebounce.current = setTimeout(async () => {
      try {
        const items = await searchInventory(altSearch.trim(), { limit: 15 });
        const seenIds = new Set(altItems.map((a) => a.id));
        if (lineItem.inventoryItemId) seenIds.add(lineItem.inventoryItemId);
        const mapped: SimilarInventoryItem[] = items
          .filter((it) => !seenIds.has(it.id) && !it.isFamily && it.isOrderable !== false)
          .map((it) => ({
            id: it.id,
            sku: it.sku,
            name: it.displayName || it.name,
            category: it.category,
            subcategory: it.subcategory,
            brand: it.brand,
            unitCost: it.costPerUnit ?? 0,
            currency: it.currency ?? 'UGX',
            unit: it.category === 'sheet-goods' ? 'sheet' : 'pcs',
            inStock: it.inStock ?? 0,
            matchReason: 'Inventory search',
            relevance: 0.3,
          }));
        setFallbackResults(mapped);
      } catch {
        setFallbackResults([]);
      } finally {
        setFallbackLoading(false);
      }
    }, 400);
    return () => { if (fallbackDebounce.current) clearTimeout(fallbackDebounce.current); };
  }, [altSearch, altItems, lineItem.inventoryItemId]);

  // Filtered alternatives — merge structural results with fallback search
  const filteredAlts = useMemo(() => {
    let structuralFiltered = altItems;
    if (altSearch) {
      const q = altSearch.toLowerCase();
      structuralFiltered = altItems.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          (item.brand ?? '').toLowerCase().includes(q) ||
          (item.subcategory ?? '').toLowerCase().includes(q) ||
          item.matchReason.toLowerCase().includes(q),
      );
    }
    // Append fallback results (deduplicated)
    if (fallbackResults.length > 0) {
      const seenIds = new Set(structuralFiltered.map((i) => i.id));
      const extras = fallbackResults.filter((f) => !seenIds.has(f.id));
      return [...structuralFiltered, ...extras];
    }
    return structuralFiltered;
  }, [altItems, altSearch, fallbackResults]);

  const selectedAlt = altSelectedId
    ? (altItems.find((i) => i.id === altSelectedId) ?? fallbackResults.find((i) => i.id === altSelectedId) ?? null)
    : null;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl p-0 flex flex-col gap-0"
      >
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-b from-muted/40 to-background">
          <div className="flex items-start gap-3 pr-8">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base leading-tight line-clamp-2">
                {lineItem.description}
              </SheetTitle>
              <SheetDescription asChild>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {lineItem.sku && (
                    <span className="inline-flex items-center gap-1 font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                      <Hash className="h-3 w-3" />
                      {lineItem.sku}
                    </span>
                  )}
                  {lineItem.inventoryItemId && (
                    <Badge variant="outline" className="text-xs font-normal gap-1">
                      <Warehouse className="h-3 w-3" />
                      Linked
                    </Badge>
                  )}
                  {isLocked && (
                    <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-200 gap-1">
                      <Lock className="h-3 w-3" />
                      Partially received
                    </Badge>
                  )}
                </div>
              </SheetDescription>
            </div>
          </div>

          {/* Quick stats row */}
          <div className="grid grid-cols-4 gap-3 mt-4">
            <QuickStat label="Quantity" value={`${lineItem.quantity} ${lineItem.unit ?? ''}`} />
            <QuickStat
              label="Unit Cost"
              value={`${lineItem.unitCost.toLocaleString()} ${lineItem.currency ?? ''}`}
            />
            <QuickStat
              label="Total"
              value={lineItem.totalCost.toLocaleString()}
              highlight
            />
            <QuickStat
              label="Received"
              value={`${lineItem.quantityReceived}/${lineItem.quantity}`}
              badge={receivedPct > 0 ? `${receivedPct}%` : undefined}
              badgeColor={receivedPct >= 100 ? 'green' : receivedPct > 0 ? 'amber' : undefined}
            />
          </div>
        </SheetHeader>

        {/* Tab bar */}
        <div className="flex border-b bg-background sticky top-0 z-10">
          <TabButton
            active={activeTab === 'detail'}
            onClick={() => setActiveTab('detail')}
            icon={<FileText className="h-4 w-4" />}
            label="Item Detail"
          />
          <TabButton
            active={activeTab === 'alternatives'}
            onClick={() => setActiveTab('alternatives')}
            icon={<ArrowRightLeft className="h-4 w-4" />}
            label="Alternatives"
            count={altLoaded ? altItems.length : undefined}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'detail' ? (
            <DetailTab
              canEdit={canEdit}
              isLocked={isLocked}
              editDescription={editDescription}
              setEditDescription={setEditDescription}
              editSku={editSku}
              setEditSku={setEditSku}
              editCategory={editCategory}
              setEditCategory={setEditCategory}
              editExpenseAccount={editExpenseAccount}
              setEditExpenseAccount={setEditExpenseAccount}
              editQuantity={editQuantity}
              setEditQuantity={setEditQuantity}
              editUnitCost={editUnitCost}
              setEditUnitCost={setEditUnitCost}
              editUnit={editUnit}
              setEditUnit={setEditUnit}
              editWeight={editWeight}
              setEditWeight={setEditWeight}
              editMpn={editMpn}
              setEditMpn={setEditMpn}
              editAssetCategory={editAssetCategory}
              setEditAssetCategory={setEditAssetCategory}
              editPackagingUnit={editPackagingUnit}
              setEditPackagingUnit={setEditPackagingUnit}
              editPackagingQty={editPackagingQty}
              setEditPackagingQty={setEditPackagingQty}
              totalCost={totalCost}
              lineItem={lineItem}
            />
          ) : (
            <AlternativesTab
              loading={altLoading || fallbackLoading}
              items={filteredAlts}
              search={altSearch}
              setSearch={setAltSearch}
              selectedId={altSelectedId}
              setSelectedId={setAltSelectedId}
              useAI={useAI}
              onToggleAI={handleToggleAI}
              lineItem={lineItem}
            />
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t bg-background px-6 py-3 flex items-center gap-3">
          {activeTab === 'detail' ? (
            <>
              <div className="flex-1 text-xs text-muted-foreground">
                {isLocked && (
                  <span className="inline-flex items-center gap-1 text-amber-600">
                    <Lock className="h-3 w-3" />
                    {lineItem.quantityReceived}/{lineItem.quantity} received — some fields locked
                  </span>
                )}
              </div>
              {canEdit && (
                <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5 px-5">
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              )}
            </>
          ) : (
            <>
              <div className="flex-1">
                {selectedAlt && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Selected: </span>
                    <span className="font-medium">{selectedAlt.displayName || selectedAlt.name}</span>
                    {selectedAlt.unitCost !== lineItem.unitCost && (
                      <span className={`ml-1.5 font-medium ${
                        selectedAlt.unitCost < lineItem.unitCost ? 'text-green-600' : 'text-red-600'
                      }`}>
                        ({selectedAlt.unitCost < lineItem.unitCost ? '' : '+'}
                        {((selectedAlt.unitCost - lineItem.unitCost) * lineItem.quantity).toLocaleString()} total)
                      </span>
                    )}
                  </div>
                )}
                {!selectedAlt && (
                  <span className="text-xs text-muted-foreground">
                    {filteredAlts.length} alternative{filteredAlts.length !== 1 ? 's' : ''} found
                  </span>
                )}
              </div>
              {canEdit && (
                <Button
                  onClick={handleSubstitute}
                  disabled={!altSelectedId}
                  size="sm"
                  className="gap-1.5 px-5"
                  variant={altSelectedId ? 'default' : 'outline'}
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                  Substitute Item
                </Button>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================
// Quick Stat Card
// ============================================

function QuickStat({
  label,
  value,
  highlight,
  badge,
  badgeColor,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  badge?: string;
  badgeColor?: 'green' | 'amber';
}) {
  return (
    <div className={`rounded-lg px-3 py-2 ${highlight ? 'bg-primary/5 ring-1 ring-primary/10' : 'bg-muted/50'}`}>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <div className="flex items-center gap-1.5 mt-0.5">
        <p className={`text-sm font-semibold tabular-nums ${highlight ? 'text-primary' : ''}`}>{value}</p>
        {badge && (
          <span className={`text-[10px] font-medium px-1 py-0.5 rounded ${
            badgeColor === 'green' ? 'bg-green-100 text-green-700' :
            badgeColor === 'amber' ? 'bg-amber-100 text-amber-700' :
            'bg-muted text-muted-foreground'
          }`}>
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================
// Tab Button
// ============================================

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
        active
          ? 'border-primary text-primary bg-primary/5'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
      }`}
    >
      {icon}
      {label}
      {count !== undefined && count > 0 && (
        <span className={`inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-xs font-medium ${
          active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

// ============================================
// Detail Tab
// ============================================

function DetailTab({
  canEdit,
  isLocked,
  editDescription,
  setEditDescription,
  editSku,
  setEditSku,
  editCategory,
  setEditCategory,
  editExpenseAccount,
  setEditExpenseAccount,
  editQuantity,
  setEditQuantity,
  editUnitCost,
  setEditUnitCost,
  editUnit,
  setEditUnit,
  editWeight,
  setEditWeight,
  editMpn,
  setEditMpn,
  editAssetCategory,
  setEditAssetCategory,
  editPackagingUnit,
  setEditPackagingUnit,
  editPackagingQty,
  setEditPackagingQty,
  totalCost,
  lineItem,
}: {
  canEdit: boolean;
  isLocked: boolean;
  editDescription: string;
  setEditDescription: (v: string) => void;
  editSku: string;
  setEditSku: (v: string) => void;
  editCategory: string;
  setEditCategory: (v: string) => void;
  editExpenseAccount: string;
  setEditExpenseAccount: (v: string) => void;
  editQuantity: number;
  setEditQuantity: (v: number) => void;
  editUnitCost: number;
  setEditUnitCost: (v: number) => void;
  editUnit: string;
  setEditUnit: (v: string) => void;
  editWeight: number | '';
  setEditWeight: (v: number | '') => void;
  editMpn: string;
  setEditMpn: (v: string) => void;
  editAssetCategory: string;
  setEditAssetCategory: (v: string) => void;
  editPackagingUnit: string;
  setEditPackagingUnit: (v: string) => void;
  editPackagingQty: number | '';
  setEditPackagingQty: (v: number | '') => void;
  totalCost: number;
  lineItem: POLineItem;
}) {
  const disabled = !canEdit;
  const [showPackaging, setShowPackaging] = useState(
    !!(lineItem.packagingUnit || lineItem.weight),
  );

  const receivedPct = lineItem.quantity > 0
    ? Math.min(Math.round((lineItem.quantityReceived / lineItem.quantity) * 100), 100)
    : 0;

  return (
    <div className="divide-y">
      {/* Core fields */}
      <section className="px-6 py-5 space-y-4">
        <SectionHeader icon={<Package className="h-4 w-4" />} title="Item Details" />

        <div className="space-y-3">
          <FieldGroup label="Description" locked={isLocked}>
            <Textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={2}
              disabled={disabled || isLocked}
              className="text-sm resize-none"
            />
          </FieldGroup>

          <div className="grid grid-cols-2 gap-3">
            <FieldGroup label="SKU" locked={isLocked}>
              <Input
                value={editSku}
                onChange={(e) => setEditSku(e.target.value)}
                disabled={disabled || isLocked}
                className="h-9 text-sm font-mono"
              />
            </FieldGroup>
            <FieldGroup label="MPN" hint="Manufacturer Part Number">
              <Input
                value={editMpn}
                onChange={(e) => setEditMpn(e.target.value)}
                disabled={disabled}
                className="h-9 text-sm font-mono"
                placeholder="e.g. 71B3550"
              />
            </FieldGroup>
          </div>

          <FieldGroup label="Unit of Measure">
            <Input
              value={editUnit}
              onChange={(e) => setEditUnit(e.target.value)}
              disabled={disabled}
              className="h-9 text-sm"
              placeholder="pcs, m, sheet, kg..."
            />
          </FieldGroup>
        </div>
      </section>

      {/* Pricing & Quantity */}
      <section className="px-6 py-5 space-y-4">
        <SectionHeader icon={<DollarSign className="h-4 w-4" />} title="Pricing & Quantity" />

        <div className="grid grid-cols-3 gap-3">
          <FieldGroup label="Quantity">
            <Input
              type="number"
              value={editQuantity}
              min={isLocked ? lineItem.quantityReceived : 0}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                if (isLocked && val < lineItem.quantityReceived) return;
                setEditQuantity(val);
              }}
              disabled={disabled}
              className="h-9 text-sm text-right tabular-nums"
            />
            {isLocked && (
              <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-0.5">
                <Info className="h-3 w-3" /> Min {lineItem.quantityReceived} (received)
              </p>
            )}
          </FieldGroup>
          <FieldGroup label="Unit Cost" locked={isLocked}>
            <Input
              type="number"
              value={editUnitCost}
              onChange={(e) => setEditUnitCost(parseFloat(e.target.value) || 0)}
              disabled={disabled || isLocked}
              className="h-9 text-sm text-right tabular-nums"
            />
          </FieldGroup>
          <FieldGroup label="Line Total">
            <div className="h-9 px-3 flex items-center text-sm font-semibold bg-primary/5 text-primary rounded-md justify-end tabular-nums border border-primary/10">
              {totalCost.toLocaleString()}
            </div>
          </FieldGroup>
        </div>

        {/* Landed cost info (read-only) */}
        {(lineItem.landedCostAllocation ?? 0) > 0 && (
          <div className="rounded-lg border border-dashed border-border p-3">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Landed Cost Breakdown
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-muted-foreground">Allocation</p>
                <p className="text-sm font-medium tabular-nums">
                  +{(lineItem.landedCostAllocation ?? 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Effective Unit Cost</p>
                <p className="text-sm font-semibold tabular-nums">
                  {(lineItem.effectiveUnitCost ?? lineItem.unitCost).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Category & Accounting */}
      <section className="px-6 py-5 space-y-4">
        <SectionHeader icon={<Layers className="h-4 w-4" />} title="Category & Accounting" />

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Line Item Category">
            <Select
              value={editCategory}
              onValueChange={setEditCategory}
              disabled={disabled}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.entries(PO_LINE_ITEM_CATEGORY_LABELS) as [
                    POLineItemCategory,
                    string,
                  ][]
                ).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="Expense Account">
            <Input
              value={editExpenseAccount}
              onChange={(e) => setEditExpenseAccount(e.target.value)}
              disabled={disabled}
              className="h-9 text-sm"
              placeholder="Account code"
            />
          </FieldGroup>
        </div>

        {editCategory === 'asset' && (
          <FieldGroup label="Asset Category">
            <Input
              value={editAssetCategory}
              onChange={(e) => setEditAssetCategory(e.target.value)}
              disabled={disabled}
              className="h-9 text-sm"
              placeholder="e.g., Machinery, Equipment, Furniture"
            />
          </FieldGroup>
        )}
      </section>

      {/* Packaging & Weight (collapsible) */}
      <section className="px-6 py-4">
        <button
          type="button"
          onClick={() => setShowPackaging(!showPackaging)}
          className="w-full flex items-center justify-between text-left group"
        >
          <SectionHeader icon={<Scale className="h-4 w-4" />} title="Packaging & Weight" />
          {showPackaging ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          )}
        </button>

        {showPackaging && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            <FieldGroup label="Weight (kg)">
              <Input
                type="number"
                value={editWeight}
                onChange={(e) =>
                  setEditWeight(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)
                }
                disabled={disabled}
                className="h-9 text-sm text-right tabular-nums"
                placeholder="0.00"
              />
            </FieldGroup>
            <FieldGroup label="Pkg Unit">
              <Input
                value={editPackagingUnit}
                onChange={(e) => setEditPackagingUnit(e.target.value)}
                disabled={disabled}
                className="h-9 text-sm"
                placeholder="box, roll..."
              />
            </FieldGroup>
            <FieldGroup label="Pkg Qty">
              <Input
                type="number"
                value={editPackagingQty}
                onChange={(e) =>
                  setEditPackagingQty(
                    e.target.value === '' ? '' : parseFloat(e.target.value) || 0,
                  )
                }
                disabled={disabled}
                className="h-9 text-sm text-right tabular-nums"
                placeholder="Per pkg"
              />
            </FieldGroup>
          </div>
        )}
      </section>

      {/* Receiving status */}
      {lineItem.quantityReceived > 0 && (
        <section className="px-6 py-5 space-y-3">
          <SectionHeader icon={<BoxIcon className="h-4 w-4" />} title="Receiving Progress" />
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium tabular-nums">
                {lineItem.quantityReceived} / {editQuantity} {editUnit}
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                receivedPct >= 100
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {receivedPct}%
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  receivedPct >= 100 ? 'bg-green-500' : 'bg-amber-500'
                }`}
                style={{ width: `${receivedPct}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              {editQuantity - lineItem.quantityReceived > 0
                ? `${editQuantity - lineItem.quantityReceived} ${editUnit} remaining`
                : 'Fully received'}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

// ============================================
// Alternatives Tab
// ============================================

function AlternativesTab({
  loading,
  items,
  search,
  setSearch,
  selectedId,
  setSelectedId,
  useAI,
  onToggleAI,
  lineItem,
}: {
  loading: boolean;
  items: SimilarInventoryItem[];
  search: string;
  setSearch: (v: string) => void;
  selectedId: string | null;
  setSelectedId: (v: string | null) => void;
  useAI: boolean;
  onToggleAI: () => void;
  lineItem: POLineItem;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Current item summary */}
      <div className="px-6 py-3 bg-gradient-to-r from-muted/50 to-muted/20 border-b">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-background border flex items-center justify-center flex-shrink-0">
            <Package className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{lineItem.description}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {lineItem.unitCost.toLocaleString()} {lineItem.currency}/{lineItem.unit}
              <span className="mx-1.5">·</span>
              Qty {lineItem.quantity}
            </p>
          </div>
        </div>
      </div>

      {/* Search + AI toggle */}
      <div className="px-6 py-3 border-b flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name, SKU, brand..."
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Button
          variant={useAI ? 'default' : 'outline'}
          size="sm"
          onClick={onToggleAI}
          className={`gap-1.5 shrink-0 ${
            useAI ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''
          }`}
          title="Enable AI-powered semantic matching"
        >
          <Sparkles className="h-3.5 w-3.5" />
          AI Search
        </Button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              {useAI ? 'AI searching for matches...' : 'Finding similar items...'}
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 px-8 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Minus className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">No alternatives found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {search
                  ? 'No items match your filter. Try a different search term.'
                  : useAI
                    ? 'No similar items could be found, even with AI matching.'
                    : 'Try enabling AI Search for broader semantic matching.'}
              </p>
            </div>
            {!useAI && !search && (
              <Button variant="outline" size="sm" onClick={onToggleAI} className="mt-2 gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Try AI Search
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {items.map((item) => (
              <AlternativeItemRow
                key={item.id}
                item={item}
                isSelected={selectedId === item.id}
                onToggle={() => setSelectedId(selectedId === item.id ? null : item.id)}
                lineItem={lineItem}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Alternative Item Row
// ============================================

function AlternativeItemRow({
  item,
  isSelected,
  onToggle,
  lineItem,
}: {
  item: SimilarInventoryItem;
  isSelected: boolean;
  onToggle: () => void;
  lineItem: POLineItem;
}) {
  const costDiff = item.unitCost - lineItem.unitCost;
  const totalDiff = costDiff * lineItem.quantity;
  const pctDiff = lineItem.unitCost > 0
    ? Math.round((costDiff / lineItem.unitCost) * 100)
    : 0;
  const isAI = item.matchReason.includes('AI');
  const relevancePct = item.relevance ? Math.round(item.relevance * 100) : null;

  return (
    <button
      onClick={onToggle}
      className={`w-full text-left px-6 py-3.5 transition-all hover:bg-muted/40 ${
        isSelected
          ? 'bg-primary/5 ring-1 ring-inset ring-primary/20'
          : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Selection indicator */}
        <div className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
          isSelected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-muted-foreground/30'
        }`}>
          {isSelected && <Check className="h-3 w-3" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight line-clamp-1">
                {item.displayName || item.name}
              </p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="text-xs text-muted-foreground font-mono bg-muted px-1 py-0.5 rounded">
                  {item.sku}
                </span>
                {item.brand && (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">
                    {item.brand}
                  </Badge>
                )}
                {item.qualityTier && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                    {item.qualityTier}
                  </Badge>
                )}
              </div>
            </div>

            {/* Price */}
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-semibold tabular-nums">
                {item.unitCost.toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {item.currency}/{item.unit}
              </p>
            </div>
          </div>

          {/* Bottom row: match reason, stock, cost diff */}
          <div className="flex items-center justify-between mt-2 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {/* Match reason */}
              <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md ${
                isAI
                  ? 'bg-indigo-50 text-indigo-600'
                  : relevancePct !== null && relevancePct >= 80
                    ? 'bg-green-50 text-green-700'
                    : 'bg-muted text-muted-foreground'
              }`}>
                {isAI && <Sparkles className="h-3 w-3" />}
                {item.matchReason}
              </span>

              {/* Stock */}
              <span className={`inline-flex items-center gap-1 text-[11px] ${
                item.inStock > 0 ? 'text-green-600' : 'text-muted-foreground'
              }`}>
                <Package className="h-3 w-3" />
                {item.inStock > 0 ? `${item.inStock} in stock` : 'Out of stock'}
              </span>
            </div>

            {/* Cost comparison */}
            {costDiff !== 0 && (
              <span className={`inline-flex items-center gap-0.5 text-xs font-medium flex-shrink-0 ${
                costDiff < 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {costDiff < 0 ? (
                  <TrendingDown className="h-3 w-3" />
                ) : (
                  <TrendingUp className="h-3 w-3" />
                )}
                {costDiff > 0 ? '+' : ''}{totalDiff.toLocaleString()}
                {pctDiff !== 0 && (
                  <span className="text-[10px] opacity-70">({pctDiff > 0 ? '+' : ''}{pctDiff}%)</span>
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ============================================
// Shared UI helpers
// ============================================

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h4 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
      <span className="text-muted-foreground/70">{icon}</span>
      {title}
    </h4>
  );
}

function FieldGroup({
  label,
  hint,
  locked,
  children,
}: {
  label: string;
  hint?: string;
  locked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-xs font-medium text-foreground/70 flex items-center gap-1">
        {label}
        {locked && <Lock className="h-3 w-3 text-amber-500" />}
        {hint && (
          <span className="text-[10px] text-muted-foreground font-normal">({hint})</span>
        )}
      </Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
