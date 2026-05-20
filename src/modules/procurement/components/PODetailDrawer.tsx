/**
 * Purchase Order Detail Drawer
 * Side panel view of full PO detail with line items, landed costs, and receiving
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Send,
  CheckCircle,
  Truck,
  Lock,
  XCircle,
  Package,
  Pencil,
  Plus,
  Trash2,
  Save,
  Receipt,
  PackagePlus,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/core/components/ui/sheet';
import { Button } from '@/core/components/ui/button';
import { RagBadge, Banner } from '@/shared/components/data-display';
import { Input } from '@/core/components/ui/input';
import { Textarea } from '@/core/components/ui/textarea';
import { Label } from '@/core/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/core/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/core/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/core/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { usePurchaseOrder } from '../hooks/usePurchaseOrder';
import { PO_STATUS_LABELS, PO_LINE_ITEM_CATEGORY_LABELS } from '../types/purchaseOrder';
import type { POLineItem, POLineItemCategory, PurchaseOrderStatus, LandedCostDistributionMethod, GoodsReceipt } from '../types/purchaseOrder';
import { useAuth } from '@/shared/hooks/useAuth';
import { useCurrentDawinUser } from '@/core/settings';
import { useWarehouses } from '@/modules/inventory/hooks/useWarehouses';
import { createWarehouse } from '@/modules/inventory/services/warehouseService';
import { GoodsReceiptDialog } from './GoodsReceiptDialog';
import { EditGoodsReceiptDialog } from './EditGoodsReceiptDialog';
import { POItemPicker } from './POItemPicker';
import { SupplierPicker } from './SupplierPicker';
import { QBOSyncStatusBadge } from '@/modules/finance/components/integrations/QBOSyncStatusBadge';
import { useQBOConfig } from '@/modules/finance/hooks/useQBOConfig';
import {
  resolveInventoryItem,
  resolveLinkedMaterial,
  resolveUnlinkedMaterial,
  resolveProduct,
} from '../hooks/usePOItemSearch';
import type { UnifiedSearchResult } from '../hooks/usePOItemSearch';
import { CURRENCIES, CURRENCY_LABELS } from '@/modules/finance/constants/currency.constants';
import { createInventoryItem, generateSku } from '@/modules/inventory/services/inventoryService';
import type { InventoryCategory } from '@/modules/inventory/types';

const STATUS_TONE: Record<PurchaseOrderStatus, 'green' | 'amber' | 'red' | 'blue' | 'na'> = {
  draft: 'na',
  'pending-approval': 'amber',
  approved: 'blue',
  rejected: 'red',
  sent: 'blue',
  'partially-received': 'amber',
  received: 'green',
  closed: 'na',
  cancelled: 'na',
};

interface PODetailDrawerProps {
  poId: string | null;
  open: boolean;
  onClose: () => void;
  autoAction?: 'receive' | null;
}

const ADMIN_ROLES = ['manager', 'admin', 'owner'];
const SUPER_USER_EMAIL = 'onzimai@dawin.group';

export function PODetailDrawer({ poId, open, onClose, autoAction }: PODetailDrawerProps) {
  const { user } = useAuth();
  const { dawinUser } = useCurrentDawinUser();
  const { order, loading, error, actions } = usePurchaseOrder(poId, user?.uid ?? '');
  const { warehouses } = useWarehouses('finishes');
  const { isReady: qboReady } = useQBOConfig();
  const [actionLoading, setActionLoading] = useState(false);

  // Admin detection
  const isAdminUser =
    (dawinUser?.globalRole && ADMIN_ROLES.includes(dawinUser.globalRole)) ||
    user?.email === SUPER_USER_EMAIL;

  // Dialog states
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<GoodsReceipt | null>(null);
  const [creatingItemForLineId, setCreatingItemForLineId] = useState<string | null>(null);

  // Full PO editing state
  const [editing, setEditing] = useState(false);
  const [editLineItems, setEditLineItems] = useState<POLineItem[]>([]);
  const [editSupplier, setEditSupplier] = useState<{ supplierId: string; supplierName: string } | null>(null);
  const [editSupplierContact, setEditSupplierContact] = useState('');
  const [editOrderDate, setEditOrderDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editLandedCosts, setEditLandedCosts] = useState({
    shipping: '',
    customs: '',
    duties: '',
    insurance: '',
    handling: '',
    other: '',
  });
  const [editDistributionMethod, setEditDistributionMethod] = useState<LandedCostDistributionMethod>('proportional_value');
  const [editCurrency, setEditCurrency] = useState('USD');

  // Auto-open receipt dialog if autoAction='receive'
  useEffect(() => {
    if (autoAction === 'receive' && order && !loading) {
      const canReceiveNow = order.status === 'sent' || order.status === 'partially-received';
      if (canReceiveNow) setShowReceiptDialog(true);
    }
  }, [autoAction, order, loading]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
      // Reset all state
      setEditing(false);
      setShowRejectDialog(false);
      setShowCancelDialog(false);
      setShowReceiptDialog(false);
      setShowDeleteDialog(false);
      setEditingReceipt(null);
      setRejectNotes('');
      setCancelReason('');
    }
  };

  const wrap = async (fn: () => Promise<void>) => {
    setActionLoading(true);
    try {
      await fn();
    } catch {
      /* hook handles */
    }
    setActionLoading(false);
  };

  // Edit helpers
  const startEditing = () => {
    if (!order) return;
    setEditLineItems(order.lineItems.map((li) => ({ ...li })));
    setEditSupplier(
      order.supplierId
        ? { supplierId: order.supplierId, supplierName: order.supplierName }
        : { supplierId: '', supplierName: order.supplierName },
    );
    setEditSupplierContact(order.supplierContact ?? '');
    // Initialize order date from orderDate or createdAt
    const dateVal = (order as any).orderDate || order.createdAt;
    if (dateVal && typeof dateVal.toDate === 'function') {
      setEditOrderDate(dateVal.toDate().toISOString().split('T')[0]);
    } else if (dateVal?.seconds) {
      setEditOrderDate(new Date(dateVal.seconds * 1000).toISOString().split('T')[0]);
    } else {
      setEditOrderDate(new Date().toISOString().split('T')[0]);
    }
    setEditNotes(order.notes ?? '');
    setEditLandedCosts({
      shipping: String(order.landedCosts.shipping || ''),
      customs: String(order.landedCosts.customs || ''),
      duties: String(order.landedCosts.duties || ''),
      insurance: String(order.landedCosts.insurance || ''),
      handling: String(order.landedCosts.handling || ''),
      other: String(order.landedCosts.other || ''),
    });
    setEditDistributionMethod(order.landedCosts.distributionMethod);
    setEditCurrency(order.landedCosts.currency || 'USD');
    setEditing(true);
  };

  const updateEditLine = (id: string, field: keyof POLineItem, value: string | number) => {
    setEditLineItems((prev) =>
      prev.map((li) => {
        if (li.id !== id) return li;
        const updated = { ...li, [field]: value };
        if (field === 'quantity' || field === 'unitCost') {
          updated.totalCost = (updated.quantity || 0) * (updated.unitCost || 0);
        }
        return updated;
      }),
    );
  };

  const addEditLine = () => {
    setEditLineItems((prev) => [
      ...prev,
      {
        id: `LI-${Date.now()}-${prev.length}`,
        description: '',
        quantity: 0,
        unitCost: 0,
        totalCost: 0,
        currency: editCurrency,
        unit: 'pcs',
        quantityReceived: 0,
      },
    ]);
  };

  const removeEditLine = (id: string) => {
    setEditLineItems((prev) => prev.filter((li) => li.id !== id));
  };

  const handleEditItemSelected = async (lineId: string, result: UnifiedSearchResult) => {
    try {
      if (result.source === 'inventory') {
        const resolved = resolveInventoryItem(result.item);
        setEditLineItems((prev) =>
          prev.map((li) =>
            li.id !== lineId ? li : { ...li, inventoryItemId: resolved.inventoryItemId, description: resolved.description, sku: resolved.sku, unitCost: resolved.unitCost, totalCost: resolved.unitCost * (li.quantity || 0), unit: resolved.unit },
          ),
        );
      } else if (result.source === 'material') {
        if (result.linkedInventory) {
          const resolved = resolveLinkedMaterial(result.item, result.linkedInventory);
          setEditLineItems((prev) =>
            prev.map((li) =>
              li.id !== lineId ? li : { ...li, inventoryItemId: resolved.inventoryItemId, materialId: resolved.materialId, description: resolved.description, sku: resolved.sku, unitCost: resolved.unitCost, totalCost: resolved.unitCost * (li.quantity || 0), unit: resolved.unit },
            ),
          );
        } else {
          const resolved = await resolveUnlinkedMaterial(result.item, user?.uid ?? '');
          setEditLineItems((prev) =>
            prev.map((li) =>
              li.id !== lineId ? li : { ...li, inventoryItemId: resolved.inventoryItemId, materialId: resolved.materialId, description: resolved.description, sku: resolved.sku, unitCost: resolved.unitCost, totalCost: resolved.unitCost * (li.quantity || 0), unit: resolved.unit },
            ),
          );
        }
      } else if (result.source === 'product') {
        const resolved = resolveProduct(result.item);
        setEditLineItems((prev) =>
          prev.map((li) =>
            li.id !== lineId ? li : { ...li, inventoryItemId: resolved.inventoryItemId, description: resolved.description, sku: resolved.sku, unitCost: resolved.unitCost, totalCost: resolved.unitCost * (li.quantity || 0), unit: resolved.unit },
          ),
        );
      }
    } catch {
      /* errors handled silently in edit mode */
    }
  };

  const saveAllChanges = async () => {
    if (!order) return;
    const validLineItems = editLineItems.filter((li) => li.description && li.quantity > 0);
    if (validLineItems.length === 0) return;

    const landedCostsData = {
      shipping: parseFloat(editLandedCosts.shipping) || 0,
      customs: parseFloat(editLandedCosts.customs) || 0,
      duties: parseFloat(editLandedCosts.duties) || 0,
      insurance: parseFloat(editLandedCosts.insurance) || 0,
      handling: parseFloat(editLandedCosts.handling) || 0,
      other: parseFloat(editLandedCosts.other) || 0,
      totalLandedCost: 0,
      currency: editCurrency,
      distributionMethod: editDistributionMethod,
    };

    await wrap(async () => {
      await actions.update({
        supplierName: editSupplier?.supplierName ?? order.supplierName,
        supplierId: editSupplier?.supplierId || undefined,
        supplierContact: editSupplierContact,
        lineItems: validLineItems,
        landedCosts: landedCostsData,
        notes: editNotes,
        orderDate: editOrderDate ? new Date(editOrderDate) : undefined,
      } as any, isAdminUser && !['draft', 'pending-approval'].includes(order.status) ? { isAdminEdit: true } : undefined);
      setEditing(false);
    });
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await actions.delete();
      onClose();
    } catch {
      /* error is set on the hook */
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleReject = async () => {
    if (!rejectNotes.trim() || !order) return;
    const approverName = user?.displayName ?? 'Manager';
    await wrap(() => actions.reject(approverName, rejectNotes));
    setShowRejectDialog(false);
    setRejectNotes('');
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) return;
    await wrap(() => actions.cancel(cancelReason));
    setShowCancelDialog(false);
    setCancelReason('');
  };

  /** Create a new inventory item from a PO line item and link it */
  const handleCreateInventoryForLine = async (lineItem: POLineItem) => {
    if (!order || !user?.uid) return;
    setCreatingItemForLineId(lineItem.id);
    try {
      const category: InventoryCategory = (lineItem.category as InventoryCategory) || 'other';
      const name = lineItem.description;
      const sku = lineItem.sku || generateSku(name, category);
      const newItemId = await createInventoryItem(
        {
          sku,
          name,
          description: '',
          category,
          status: 'active',
          pricing: {
            costPerUnit: lineItem.unitCost ?? 0,
            currency: lineItem.currency ?? 'UGX',
            unit: (lineItem.unit as any) ?? 'pcs',
          },
        },
        user.uid,
      );
      // Update the PO line item with the new inventoryItemId
      const updatedLineItems = order.lineItems.map((li) =>
        li.id === lineItem.id
          ? { ...li, inventoryItemId: newItemId, sku: sku }
          : li,
      );
      await actions.update({ lineItems: updatedLineItems } as any);
    } catch (err) {
      console.error('Failed to create inventory item for line:', err);
    } finally {
      setCreatingItemForLineId(null);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      );
    }

    if (!order) {
      return (
        <Banner tone="danger" title="Purchase order not found" />
      );
    }

    const approverName = user?.displayName ?? 'Manager';
    const isDraft = order.status === 'draft';
    const isPending = order.status === 'pending-approval';
    const canEdit = isDraft || isPending;
    const adminEditableStatuses: PurchaseOrderStatus[] = ['approved', 'sent', 'partially-received', 'received'];
    const canAdminEdit = isAdminUser && adminEditableStatuses.includes(order.status);
    const canEditOverall = canEdit || canAdminEdit;
    const canReceive = order.status === 'sent' || order.status === 'partially-received';
    const canCancel = !['closed', 'cancelled'].includes(order.status);
    const canDelete =
      ['draft', 'cancelled'].includes(order.status) &&
      order.receivingHistory.length === 0 &&
      !order.lineItems.some((li) => li.quantityReceived > 0);

    return (
      <div className="space-y-5">
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <RagBadge tone={STATUS_TONE[order.status]}>
            {PO_STATUS_LABELS[order.status]}
          </RagBadge>
        </div>

        {/* Admin Edit Warning */}
        {editing && canAdminEdit && !canEdit && (
          <Banner
            tone="warning"
            title="Admin Edit"
            message="You are editing an approved PO. Changes will be recorded in the audit trail."
          />
        )}

        {/* Supplier Info (edit mode) */}
        {editing && (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <SupplierPicker
                value={editSupplier}
                onChange={(val) => setEditSupplier(val)}
                subsidiaryId="finishes"
                label=""
                placeholder="Search suppliers..."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Contact Person</Label>
              <Input
                value={editSupplierContact}
                onChange={(e) => setEditSupplierContact(e.target.value)}
                placeholder="Contact person"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Order Date</Label>
              <Input
                type="date"
                value={editOrderDate}
                onChange={(e) => setEditOrderDate(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && <Banner tone="danger" title="Error" message={error} />}

        {/* Linked References */}
        {(order.linkedMOIds?.length || order.linkedProjectId) && (
          <div className="flex flex-wrap gap-2 items-center">
            {order.linkedMOIds?.map((moId) => (
              <Link
                key={moId}
                to={`/manufacturing/orders?selected=${moId}`}
                className="px-3 py-1 text-xs border rounded-full hover:bg-muted transition-colors"
              >
                MO: {moId.slice(0, 8)}...
              </Link>
            ))}
            {order.linkedProjectId && (
              <Link
                to={`/design/project/${order.linkedProjectId}`}
                className="px-3 py-1 text-xs border rounded-full hover:bg-muted transition-colors"
              >
                View Project
              </Link>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {isDraft && (
            <Button onClick={() => wrap(() => actions.submitForApproval())} disabled={actionLoading} size="sm" className="gap-1.5">
              <Send className="h-3.5 w-3.5" />
              Submit for Approval
            </Button>
          )}
          {isPending && (
            <>
              <Button onClick={() => wrap(() => actions.approve(approverName))} disabled={actionLoading} size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700">
                <CheckCircle className="h-3.5 w-3.5" />
                Approve
              </Button>
              <Button variant="outline" onClick={() => setShowRejectDialog(true)} disabled={actionLoading} size="sm" className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50">
                Reject
              </Button>
            </>
          )}
          {order.status === 'approved' && (
            <Button onClick={() => wrap(() => actions.markSent())} disabled={actionLoading} size="sm" className="gap-1.5">
              <Truck className="h-3.5 w-3.5" />
              Mark as Sent
            </Button>
          )}
          {canReceive && (
            <Button
              onClick={async () => {
                if (warehouses.length === 0) {
                  setActionLoading(true);
                  try {
                    await createWarehouse({ name: 'Main Warehouse', code: 'MAIN-WH', type: 'warehouse', isActive: true, subsidiaryId: 'finishes' });
                  } catch { /* warehouse hook will pick it up */ }
                  setActionLoading(false);
                }
                setShowReceiptDialog(true);
              }}
              disabled={actionLoading}
              size="sm"
              className="gap-1.5 bg-green-600 hover:bg-green-700"
            >
              <Package className="h-3.5 w-3.5" />
              Receive Goods
            </Button>
          )}
          {['approved', 'sent', 'partially-received', 'received'].includes(order.status) &&
            order.qboSyncStatus !== 'synced' &&
            order.qboSyncStatus !== 'pending' && (
            <Button
              onClick={() => wrap(() => actions.syncToBill())}
              disabled={actionLoading}
              size="sm"
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700"
            >
              <Receipt className="h-3.5 w-3.5" />
              Create Bill in QBO
            </Button>
          )}
          {['received', 'partially-received'].includes(order.status) && (
            <Button variant="outline" onClick={() => wrap(() => actions.close())} disabled={actionLoading} size="sm" className="gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              Close PO
            </Button>
          )}
          {canCancel && !editing && (
            <Button variant="outline" onClick={() => setShowCancelDialog(true)} disabled={actionLoading} size="sm" className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50">
              <XCircle className="h-3.5 w-3.5" />
              Cancel
            </Button>
          )}
          {order.status === 'cancelled' && (
            <Button onClick={() => wrap(() => actions.reinstate('Reinstated via UI'))} disabled={actionLoading} size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700">
              <RotateCcw className="h-3.5 w-3.5" />
              Reinstate
            </Button>
          )}
          {canDelete && !editing && (
            <Button variant="outline" onClick={() => setShowDeleteDialog(true)} disabled={actionLoading} size="sm" className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50">
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          )}
          {canEditOverall && !editing && (
            <Button variant="outline" onClick={startEditing} disabled={actionLoading} size="sm" className={`gap-1.5 ${canAdminEdit && !canEdit ? 'border-amber-300 text-amber-700 hover:bg-amber-50' : ''}`}>
              <Pencil className="h-3.5 w-3.5" />
              {canAdminEdit && !canEdit ? 'Admin Edit' : 'Edit PO'}
            </Button>
          )}
          {editing && (
            <>
              <Button size="sm" onClick={saveAllChanges} disabled={actionLoading} className="gap-1.5">
                <Save className="h-3.5 w-3.5" />
                Save Changes
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Discard</Button>
            </>
          )}
        </div>

        {/* Line Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 px-4 pt-4">
            <CardTitle className="text-sm">Line Items</CardTitle>
            {editing && (
              <Button variant="ghost" size="sm" onClick={addEditLine} className="gap-1 h-7 text-xs">
                <Plus className="h-3 w-3" />
                Add Item
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {editing ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider min-w-[160px]">Description</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-20">SKU</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-24">Category</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-24">Account</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-16">Qty</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-20">Unit Cost</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-20">Total</th>
                      <th className="px-3 py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {editLineItems.map((li) => {
                      const isLocked = li.quantityReceived > 0;
                      return (
                        <tr
                          key={li.id}
                          style={
                            isLocked
                              ? { backgroundColor: 'var(--rag-amber-soft)' }
                              : undefined
                          }
                        >
                          <td className="px-3 py-2">
                            {isLocked ? (
                              <div className="flex items-center gap-1.5 h-8 px-2 text-xs text-muted-foreground">
                                <Lock className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{li.description}</span>
                              </div>
                            ) : (
                              <POItemPicker
                                value={li.description}
                                onInputChange={(val) => updateEditLine(li.id, 'description', val)}
                                onSelect={(result) => handleEditItemSelected(li.id, result)}
                                userId={user?.uid ?? ''}
                                placeholder="Search or type..."
                              />
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <Input value={li.sku ?? ''} onChange={(e) => updateEditLine(li.id, 'sku', e.target.value)} className="h-7 text-xs" disabled={isLocked} />
                          </td>
                          <td className="px-3 py-2">
                            <Select
                              value={li.category ?? 'inventory'}
                              onValueChange={(val) => updateEditLine(li.id, 'category', val)}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(Object.entries(PO_LINE_ITEM_CATEGORY_LABELS) as [POLineItemCategory, string][]).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              value={li.expenseAccountCode ?? ''}
                              onChange={(e) => updateEditLine(li.id, 'expenseAccountCode', e.target.value)}
                              className="h-7 text-xs"
                              placeholder="Account"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              value={li.quantity}
                              min={isLocked ? li.quantityReceived : 0}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                if (isLocked && val < li.quantityReceived) return;
                                updateEditLine(li.id, 'quantity', val);
                              }}
                              className="h-7 text-xs text-right"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              value={li.unitCost}
                              onChange={(e) => updateEditLine(li.id, 'unitCost', parseFloat(e.target.value) || 0)}
                              className="h-7 text-xs text-right"
                              disabled={isLocked}
                            />
                          </td>
                          <td className="px-3 py-2 text-right text-xs">{li.totalCost.toLocaleString()}</td>
                          <td className="px-3 py-2">
                            {!isLocked && (
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => removeEditLine(li.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">SKU</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Account</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Qty</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Unit Cost</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Landed</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Effective</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Received</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {order.lineItems.map((li) => (
                      <tr key={li.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-3 py-2 text-xs">
                          <div>
                            <span>{li.description}</span>
                            {!li.inventoryItemId && (
                              <div className="mt-1">
                                <button
                                  type="button"
                                  onClick={() => handleCreateInventoryForLine(li)}
                                  disabled={creatingItemForLineId === li.id}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded transition-colors"
                                  title="Create inventory item and link to this line"
                                >
                                  {creatingItemForLineId === li.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <PackagePlus className="h-3 w-3" />
                                  )}
                                  Add to Inventory
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{li.sku ?? '—'}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{PO_LINE_ITEM_CATEGORY_LABELS[(li.category as POLineItemCategory) ?? 'inventory'] ?? 'Inventory'}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{li.expenseAccountCode ?? '—'}</td>
                        <td className="px-3 py-2 text-xs text-right">{li.quantity}</td>
                        <td className="px-3 py-2 text-xs text-right">{li.unitCost.toLocaleString()}</td>
                        <td className="px-3 py-2 text-xs text-right">{li.totalCost.toLocaleString()}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground text-right">{(li.landedCostAllocation ?? 0).toLocaleString()}</td>
                        <td className="px-3 py-2 text-xs text-right">{(li.effectiveUnitCost ?? li.unitCost).toLocaleString()}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground text-right">{li.quantityReceived}/{li.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Landed Costs & Totals Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Landed Costs */}
          <Card>
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-sm">Landed Costs</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {editing ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {(['shipping', 'customs', 'duties', 'insurance', 'handling', 'other'] as const).map((field) => (
                      <div key={field} className="space-y-1">
                        <Label className="capitalize text-[10px]">{field}</Label>
                        <Input
                          type="number"
                          value={editLandedCosts[field]}
                          onChange={(e) => setEditLandedCosts((prev) => ({ ...prev, [field]: e.target.value }))}
                          className="h-7 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Currency</Label>
                      <Select value={editCurrency} onValueChange={setEditCurrency}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.values(CURRENCIES).map((code) => (
                            <SelectItem key={code} value={code}>{code} — {CURRENCY_LABELS[code]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Distribution</Label>
                      <Select value={editDistributionMethod} onValueChange={(v) => setEditDistributionMethod(v as LandedCostDistributionMethod)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="proportional_value">By Value</SelectItem>
                          <SelectItem value="proportional_weight">By Weight</SelectItem>
                          <SelectItem value="equal">Equal Split</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {[
                    ['Shipping', order.landedCosts.shipping],
                    ['Customs', order.landedCosts.customs],
                    ['Duties', order.landedCosts.duties],
                    ['Insurance', order.landedCosts.insurance],
                    ['Handling', order.landedCosts.handling],
                    ['Other', order.landedCosts.other],
                  ].map(([label, value]) => (
                    <div key={label as string} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{label as string}</span>
                      <span>{(value as number).toLocaleString()} {order.landedCosts.currency}</span>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-semibold text-xs">
                      <span>Total Landed</span>
                      <span>{order.landedCosts.totalLandedCost.toLocaleString()} {order.landedCosts.currency}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground pt-1">
                    Distribution: {order.landedCosts.distributionMethod.replace(/_/g, ' ')}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-sm">Totals</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{order.totals.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Landed Costs</span>
                <span>{order.totals.landedCostTotal.toLocaleString()}</span>
              </div>
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between font-semibold text-sm">
                  <span>Grand Total</span>
                  <span>{order.totals.grandTotal.toLocaleString()} {order.totals.currency}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Notes */}
        <Card>
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-sm">Notes</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {editing ? (
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                placeholder="Add notes about this purchase order..."
                className="text-xs"
              />
            ) : (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                {order.notes || 'No notes'}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Receiving Progress */}
        {(order.status === 'sent' || order.status === 'partially-received' || order.status === 'received' || order.status === 'closed') && (
          <Card>
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-sm">Receiving Progress</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {order.lineItems.map((li) => {
                const pct = li.quantity > 0 ? Math.round((li.quantityReceived / li.quantity) * 100) : 0;
                return (
                  <div key={li.id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="truncate mr-2">{li.description}</span>
                      <span className="text-muted-foreground whitespace-nowrap">{li.quantityReceived}/{li.quantity}</span>
                    </div>
                    <div
                      className="w-full rounded-full h-1.5 overflow-hidden"
                      style={{ backgroundColor: 'var(--bg-sunken)' }}
                    >
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${Math.min(pct, 100)}%`,
                          backgroundColor:
                            pct >= 100
                              ? 'var(--rag-green)'
                              : pct > 0
                              ? 'var(--rag-amber)'
                              : 'var(--border-default)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Receiving History */}
        <Card>
          <CardHeader className="px-4 pt-4 pb-2">
            <CardTitle className="text-sm">Receiving History ({order.receivingHistory.length})</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {order.receivingHistory.length > 0 ? (
              <div className="space-y-2">
                {order.receivingHistory.map((receipt) => {
                  const receivedAt = receipt.receivedAt && typeof (receipt.receivedAt as any).toDate === 'function'
                    ? (receipt.receivedAt as any).toDate()
                    : receipt.receivedAt instanceof Date ? receipt.receivedAt : null;
                  return (
                    <div key={receipt.id} className="p-2 bg-muted/50 rounded-lg space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-xs">{receipt.id}</span>
                        <div className="flex items-center gap-2">
                          {receivedAt && (
                            <span className="text-[10px] text-muted-foreground">
                              {receivedAt.toLocaleDateString()} {receivedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          {isAdminUser && (
                            <button
                              onClick={() => setEditingReceipt(receipt)}
                              className="text-[10px] text-amber-600 hover:text-amber-800 hover:underline font-medium"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </div>
                      {receipt.deliveryReference && (
                        <p className="text-[10px] text-muted-foreground">Ref: {receipt.deliveryReference}</p>
                      )}
                      <div className="space-y-0.5">
                        {receipt.lines.map((line) => {
                          const poLine = order.lineItems.find((li) => li.id === line.lineItemId);
                          return (
                            <div key={line.lineItemId} className="flex justify-between text-[10px]">
                              <span className="text-muted-foreground truncate mr-2">{poLine?.description ?? line.lineItemId}</span>
                              <span className="font-medium whitespace-nowrap">+{line.quantityReceived}</span>
                            </div>
                          );
                        })}
                      </div>
                      {receipt.notes && (
                        <p className="text-[10px] text-muted-foreground italic">{receipt.notes}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No goods received yet</p>
            )}
          </CardContent>
        </Card>

        {/* QuickBooks — only shown when QBO is connected & configured */}
        {qboReady && (
          <Card>
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-sm">QuickBooks</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <QBOSyncStatusBadge
                status={order.qboSyncStatus}
                error={order.qboSyncError}
                lastSyncedAt={order.qboSyncedAt as any}
                qboDocNumber={order.qboBillDocNumber}
                entityType="Bill"
                onRetry={order.qboSyncStatus === 'error' ? () => wrap(() => actions.syncToBill()) : undefined}
                onSync={
                  !order.qboSyncStatus &&
                  ['approved', 'sent', 'partially-received', 'received'].includes(order.status)
                    ? () => wrap(() => actions.syncToBill())
                    : undefined
                }
              />
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl overflow-y-auto">
          <SheetHeader className="pb-3 border-b border-gray-100 mb-4">
            <SheetTitle>{order?.poNumber ?? 'Purchase Order'}</SheetTitle>
            <SheetDescription>
              {order ? (() => {
                const supplierText = `Supplier: ${order.supplierName}${order.supplierContact ? ` — ${order.supplierContact}` : ''}`;
                const d = (order as any).orderDate || order.createdAt;
                let dateText = '';
                if (d && typeof d.toDate === 'function') dateText = d.toDate().toLocaleDateString();
                else if (d?.seconds) dateText = new Date(d.seconds * 1000).toLocaleDateString();
                return dateText ? `${supplierText} | Order Date: ${dateText}` : supplierText;
              })() : 'Loading...'}
            </SheetDescription>
          </SheetHeader>
          {renderContent()}
        </SheetContent>
      </Sheet>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Purchase Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Rejection Reason <span className="text-destructive">*</span></Label>
              <Textarea value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectNotes.trim() || actionLoading}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Purchase Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">This will cancel the purchase order. This action cannot be undone.</p>
            <div className="space-y-1.5">
              <Label>Cancellation Reason <span className="text-destructive">*</span></Label>
              <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>Keep PO</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={!cancelReason.trim() || actionLoading}>Cancel PO</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Goods Receipt Dialog */}
      {showReceiptDialog && order && (
        <GoodsReceiptDialog
          open={showReceiptDialog}
          onClose={() => setShowReceiptDialog(false)}
          order={order}
          warehouses={warehouses}
          onReceive={(receipt) => actions.receive(receipt as any)}
          userId={user?.uid ?? ''}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Purchase Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{order?.poNumber}</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" disabled={deleting} onClick={handleDelete}>
              {deleting ? 'Deleting...' : 'Delete Permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Goods Receipt Dialog (Admin) */}
      {editingReceipt && order && (
        <EditGoodsReceiptDialog
          open={!!editingReceipt}
          onClose={() => setEditingReceipt(null)}
          order={order}
          receipt={editingReceipt}
          onSave={actions.editReceipt}
        />
      )}
    </>
  );
}
