/**
 * Purchase Order Detail Page
 * Full PO view with line items, landed costs, approvals, and goods receipt
 * Styled to match ZeusOS Finishes design system
 */

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
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
  ArrowLeft,
  PackagePlus,
  Loader2,
  Receipt,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
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
import { useRecordTracker } from '@/core/hooks/useRecordTracker';
import { PO_STATUS_LABELS, PO_LINE_ITEM_CATEGORY_LABELS } from '../types/purchaseOrder';
import type { POLineItem, POLineItemCategory, PurchaseOrderStatus, LandedCostDistributionMethod } from '../types/purchaseOrder';
import { useAuth } from '@/shared/hooks/useAuth';
import { useCurrentDawinUser } from '@/core/settings';
import { useWarehouses } from '@/modules/inventory/hooks/useWarehouses';
import { createWarehouse } from '@/modules/inventory/services/warehouseService';
import { GoodsReceiptDialog } from '../components/GoodsReceiptDialog';
import { EditGoodsReceiptDialog } from '../components/EditGoodsReceiptDialog';
import { createInventoryItem, generateSku } from '@/modules/inventory/services/inventoryService';
import type { InventoryCategory } from '@/modules/inventory/types';
import { POItemPicker } from '../components/POItemPicker';
import { POLineItemAlternatives } from '../components/POLineItemAlternatives';
import type { SimilarInventoryItem } from '@/shared/services/inventory/similarItemService';
import { SupplierPicker } from '../components/SupplierPicker';
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

const STATUS_STYLES: Record<PurchaseOrderStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  'pending-approval': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  approved: 'bg-blue-50 text-blue-700 border-blue-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  sent: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'partially-received': 'bg-amber-50 text-amber-700 border-amber-200',
  received: 'bg-green-50 text-green-700 border-green-200',
  closed: 'bg-gray-100 text-gray-600 border-gray-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

export default function PurchaseOrderDetailPage() {
  const { poId } = useParams<{ poId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { dawinUser } = useCurrentDawinUser();
  const { order, loading, error, actions } = usePurchaseOrder(poId ?? null, user?.uid ?? '');
  // Log this record for the Global Search palette's recency boost + empty state.
  useRecordTracker({
    type: 'purchase_order',
    id: order?.id,
    title: (order as { poNumber?: string } | null | undefined)?.poNumber ?? '',
    subtitle: (order as { supplierName?: string } | null | undefined)?.supplierName,
    module: 'procurement',
  });
  const { warehouses } = useWarehouses('finishes');
  const { isReady: qboReady } = useQBOConfig();

  // Admin edit support
  const ADMIN_ROLES = ['manager', 'admin', 'owner'];
  const SUPER_USER_EMAIL = 'onzimai@zeusgroup.co.ug';
  const isAdminUser =
    (dawinUser?.globalRole && ADMIN_ROLES.includes(dawinUser.globalRole)) ||
    user?.email === SUPER_USER_EMAIL;
  const [actionLoading, setActionLoading] = useState(false);

  // Dialog states
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [alternativesLineItem, setAlternativesLineItem] = useState<POLineItem | null>(null);
  const [creatingItemForLineId, setCreatingItemForLineId] = useState<string | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<any>(null);

  // Auto-open receipt dialog if navigated with ?action=receive
  useEffect(() => {
    if (searchParams.get('action') === 'receive' && order && !loading) {
      const canReceiveNow = order.status === 'sent' || order.status === 'partially-received';
      if (canReceiveNow) setShowReceiptDialog(true);
    }
  }, [searchParams, order, loading]);

  // Full PO editing state
  const [editing, setEditing] = useState(false);
  const [editLineItems, setEditLineItems] = useState<POLineItem[]>([]);
  const [editSupplier, setEditSupplier] = useState<{ supplierId: string; supplierName: string } | null>(null);
  const [editSupplierContact, setEditSupplierContact] = useState('');
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
  const [editOrderDate, setEditOrderDate] = useState('');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Purchase order not found
        </div>
      </div>
    );
  }

  const wrap = async (fn: () => Promise<void>) => {
    setActionLoading(true);
    try {
      await fn();
    } catch {
      /* hook handles */
    }
    setActionLoading(false);
  };

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

  // Full PO editing helpers
  const startEditing = () => {
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
            li.id !== lineId
              ? li
              : {
                  ...li,
                  inventoryItemId: resolved.inventoryItemId,
                  description: resolved.description,
                  sku: resolved.sku,
                  unitCost: resolved.unitCost,
                  totalCost: resolved.unitCost * (li.quantity || 0),
                  unit: resolved.unit,
                },
          ),
        );
      } else if (result.source === 'material') {
        if (result.linkedInventory) {
          const resolved = resolveLinkedMaterial(result.item, result.linkedInventory);
          setEditLineItems((prev) =>
            prev.map((li) =>
              li.id !== lineId
                ? li
                : {
                    ...li,
                    inventoryItemId: resolved.inventoryItemId,
                    materialId: resolved.materialId,
                    description: resolved.description,
                    sku: resolved.sku,
                    unitCost: resolved.unitCost,
                    totalCost: resolved.unitCost * (li.quantity || 0),
                    unit: resolved.unit,
                  },
            ),
          );
        } else {
          const resolved = await resolveUnlinkedMaterial(result.item, user?.uid ?? '');
          setEditLineItems((prev) =>
            prev.map((li) =>
              li.id !== lineId
                ? li
                : {
                    ...li,
                    inventoryItemId: resolved.inventoryItemId,
                    materialId: resolved.materialId,
                    description: resolved.description,
                    sku: resolved.sku,
                    unitCost: resolved.unitCost,
                    totalCost: resolved.unitCost * (li.quantity || 0),
                    unit: resolved.unit,
                  },
            ),
          );
        }
      } else if (result.source === 'product') {
        const resolved = resolveProduct(result.item);
        setEditLineItems((prev) =>
          prev.map((li) =>
            li.id !== lineId
              ? li
              : {
                  ...li,
                  inventoryItemId: resolved.inventoryItemId,
                  description: resolved.description,
                  sku: resolved.sku,
                  unitCost: resolved.unitCost,
                  totalCost: resolved.unitCost * (li.quantity || 0),
                  unit: resolved.unit,
                },
          ),
        );
      }
    } catch {
      /* errors handled silently in edit mode */
    }
  };

  const saveAllChanges = async () => {
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
      } as any, canAdminEdit && !canEdit ? { isAdminEdit: true } : undefined);
      setEditing(false);
    });
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await actions.delete();
      navigate('/procurement/orders');
    } catch {
      /* error is set on the hook */
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleReject = async () => {
    if (!rejectNotes.trim()) return;
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
    if (!user?.uid) return;
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
      const updatedLineItems = order.lineItems.map((li) =>
        li.id === lineItem.id
          ? { ...li, inventoryItemId: newItemId, sku }
          : li,
      );
      await actions.update({ lineItems: updatedLineItems } as any);
    } catch (err) {
      console.error('Failed to create inventory item for line:', err);
    } finally {
      setCreatingItemForLineId(null);
    }
  };

  const canSyncToQBO =
    qboReady && ['approved', 'sent', 'partially-received', 'received'].includes(order.status);
  const hasExistingQBOBill = Boolean(order.qboBillId);
  const shouldRunCorrectionSync =
    order.qboSyncStatus === 'correction-pending' ||
    (order.qboSyncStatus === 'error' && hasExistingQBOBill);

  const handleRetryQBOSync = async () => {
    if (shouldRunCorrectionSync) {
      await actions.syncBillCorrection();
      return;
    }
    await actions.syncToBill();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/procurement/orders"
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{order.poNumber}</h1>
            {editing ? (
              <div className="grid grid-cols-3 gap-3 mt-2">
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
            ) : (
              <p className="text-sm text-muted-foreground">
                Supplier: {order.supplierName}
                {order.supplierContact && ` — ${order.supplierContact}`}
                {(() => {
                  const d = (order as any).orderDate || order.createdAt;
                  if (d && typeof d.toDate === 'function') return ` | Order Date: ${d.toDate().toLocaleDateString()}`;
                  if (d?.seconds) return ` | Order Date: ${new Date(d.seconds * 1000).toLocaleDateString()}`;
                  return '';
                })()}
              </p>
            )}
          </div>
        </div>
        <Badge variant="outline" className={`text-sm px-3 py-1 ${STATUS_STYLES[order.status]}`}>
          {PO_STATUS_LABELS[order.status]}
        </Badge>
      </div>

      {/* Order Details Card */}
      {!editing && (
        <Card>
          <CardContent className="px-4 py-3">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <div>
                <span className="text-muted-foreground">Supplier: </span>
                <span className="font-medium">{order.supplierName}</span>
                {order.supplierContact && <span className="text-muted-foreground"> — {order.supplierContact}</span>}
              </div>
              <div>
                <span className="text-muted-foreground">Order Date: </span>
                <span className="font-medium">
                  {(() => {
                    const d = (order as any).orderDate || order.createdAt;
                    if (d && typeof d.toDate === 'function') return d.toDate().toLocaleDateString();
                    if (d?.seconds) return new Date(d.seconds * 1000).toLocaleDateString();
                    return '—';
                  })()}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Currency: </span>
                <span className="font-medium">{order.totals.currency}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Alert */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Linked References */}
      {(order.linkedMOIds?.length || order.linkedProjectId) && (
        <div className="flex flex-wrap gap-2 items-center">
          {order.linkedMOIds?.map((moId) => (
            <Link
              key={moId}
              to={`/manufacturing/orders/${moId}`}
              className="px-3 py-1 text-sm border rounded-full hover:bg-muted transition-colors"
            >
              MO: {moId.slice(0, 8)}...
            </Link>
          ))}
          {order.linkedProjectId && (
            <Link
              to={`/design/project/${order.linkedProjectId}`}
              className="px-3 py-1 text-sm border rounded-full hover:bg-muted transition-colors"
            >
              View Project
            </Link>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {isDraft && (
          <Button
            onClick={() => wrap(() => actions.submitForApproval())}
            disabled={actionLoading}
            size="sm"
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            Submit for Approval
          </Button>
        )}
        {isPending && (
          <>
            <Button
              onClick={() => wrap(() => actions.approve(approverName))}
              disabled={actionLoading}
              size="sm"
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4" />
              Approve
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(true)}
              disabled={actionLoading}
              size="sm"
              className="gap-2 border-red-300 text-red-700 hover:bg-red-50"
            >
              Reject
            </Button>
          </>
        )}
        {order.status === 'approved' && (
          <Button
            onClick={() => wrap(() => actions.markSent())}
            disabled={actionLoading}
            size="sm"
            className="gap-2"
          >
            <Truck className="h-4 w-4" />
            Mark as Sent
          </Button>
        )}
        {canReceive && (
          <Button
            onClick={async () => {
              if (warehouses.length === 0) {
                setActionLoading(true);
                try {
                  await createWarehouse({
                    name: 'Main Warehouse',
                    code: 'MAIN-WH',
                    type: 'warehouse',
                    isActive: true,
                    subsidiaryId: 'finishes',
                  });
                } catch {
                  /* warehouse hook will pick it up */
                }
                setActionLoading(false);
              }
              setShowReceiptDialog(true);
            }}
            disabled={actionLoading}
            size="sm"
            className="gap-2 bg-green-600 hover:bg-green-700"
          >
            <Package className="h-4 w-4" />
            Receive Goods
          </Button>
        )}
        {['received', 'partially-received'].includes(order.status) && (
          <Button
            variant="outline"
            onClick={() => wrap(() => actions.close())}
            disabled={actionLoading}
            size="sm"
            className="gap-2"
          >
            <Lock className="h-4 w-4" />
            Close PO
          </Button>
        )}
        {/* QBO Sync Buttons */}
        {canSyncToQBO &&
          order.qboSyncStatus !== 'synced' &&
          order.qboSyncStatus !== 'pending' && (
          <Button
            onClick={() => wrap(handleRetryQBOSync)}
            disabled={actionLoading}
            size="sm"
            className="gap-2 bg-indigo-600 hover:bg-indigo-700"
          >
            <Receipt className="h-4 w-4" />
            {shouldRunCorrectionSync ? 'Retry QBO Correction Sync' : 'Create Bill in QBO'}
          </Button>
        )}
        {canSyncToQBO &&
          order.qboSyncStatus === 'synced' &&
          hasExistingQBOBill && (
          <Button
            variant="outline"
            onClick={() => wrap(() => actions.syncBillCorrection())}
            disabled={actionLoading}
            size="sm"
            className="gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
          >
            <RefreshCw className="h-4 w-4" />
            Sync Correction to QBO
          </Button>
        )}
        {canCancel && !editing && (
          <Button
            variant="outline"
            onClick={() => setShowCancelDialog(true)}
            disabled={actionLoading}
            size="sm"
            className="gap-2 border-red-300 text-red-700 hover:bg-red-50"
          >
            <XCircle className="h-4 w-4" />
            Cancel
          </Button>
        )}
        {order.status === 'cancelled' && (
          <Button
            onClick={() => wrap(() => actions.reinstate('Reinstated via detail page'))}
            disabled={actionLoading}
            size="sm"
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <RotateCcw className="h-4 w-4" />
            Reinstate
          </Button>
        )}
        {canDelete && !editing && (
          <Button
            variant="outline"
            onClick={() => setShowDeleteDialog(true)}
            disabled={actionLoading}
            size="sm"
            className="gap-2 border-red-300 text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        )}
        {canEditOverall && !editing && (
          <Button
            variant="outline"
            onClick={startEditing}
            disabled={actionLoading}
            size="sm"
            className={`gap-2 ${canAdminEdit && !canEdit ? 'border-amber-300 text-amber-700 hover:bg-amber-50' : ''}`}
          >
            <Pencil className="h-4 w-4" />
            {canAdminEdit && !canEdit ? 'Admin Edit' : 'Edit PO'}
          </Button>
        )}
        {editing && (
          <>
            <Button
              size="sm"
              onClick={saveAllChanges}
              disabled={actionLoading}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Discard
            </Button>
          </>
        )}
      </div>

      {/* Admin Edit Warning */}
      {editing && canAdminEdit && !canEdit && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          <strong>Admin Edit:</strong> You are editing an approved PO. Changes will be recorded in the audit trail.
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Line Items - Full Width */}
        <div className="lg:col-span-12">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-base">Line Items</CardTitle>
              {editing && (
                <Button variant="ghost" size="sm" onClick={addEditLine} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Add Item
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {editing ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border table-sticky-first-col">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider min-w-[180px]">
                          Description
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-24">
                          SKU
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-28">
                          Category
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-28">
                          Account
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-20">
                          Qty
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-24">
                          Unit Cost
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-24">
                          Total
                        </th>
                        <th className="px-4 py-3 w-12" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {editLineItems.map((li) => {
                        const isLocked = li.quantityReceived > 0;
                        return (
                        <tr key={li.id} className={isLocked ? 'bg-amber-50/40' : ''}>
                          <td className="px-4 py-2.5">
                            {isLocked ? (
                              <div className="flex items-center gap-1.5 h-8 px-2 text-sm text-muted-foreground">
                                <Lock className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{li.description}</span>
                              </div>
                            ) : (
                              <POItemPicker
                                value={li.description}
                                onInputChange={(val) => updateEditLine(li.id, 'description', val)}
                                onSelect={(result) => handleEditItemSelected(li.id, result)}
                                userId={user?.uid ?? ''}
                                placeholder="Search or type description..."
                              />
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <Input
                              value={li.sku ?? ''}
                              onChange={(e) => updateEditLine(li.id, 'sku', e.target.value)}
                              className="h-8"
                              disabled={isLocked}
                              title={isLocked ? 'Locked — line has received quantities' : undefined}
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <Select
                              value={li.category ?? 'inventory'}
                              onValueChange={(val) => updateEditLine(li.id, 'category', val)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(Object.entries(PO_LINE_ITEM_CATEGORY_LABELS) as [POLineItemCategory, string][]).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-2.5">
                            <Input
                              value={li.expenseAccountCode ?? ''}
                              onChange={(e) => updateEditLine(li.id, 'expenseAccountCode', e.target.value)}
                              className="h-8"
                              placeholder="Account code"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <Input
                              type="number"
                              value={li.quantity}
                              min={isLocked ? li.quantityReceived : 0}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                if (isLocked && val < li.quantityReceived) return;
                                updateEditLine(li.id, 'quantity', val);
                              }}
                              className="h-8 text-right"
                              title={isLocked ? `Min: ${li.quantityReceived} (already received)` : undefined}
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <Input
                              type="number"
                              value={li.unitCost}
                              onChange={(e) =>
                                updateEditLine(li.id, 'unitCost', parseFloat(e.target.value) || 0)
                              }
                              className="h-8 text-right"
                              disabled={isLocked}
                              title={isLocked ? 'Locked — line has received quantities' : undefined}
                            />
                          </td>
                          <td className="px-4 py-2.5 text-right text-sm">
                            {li.totalCost.toLocaleString()}
                          </td>
                          <td className="px-4 py-2.5">
                            {!isLocked && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => removeEditLine(li.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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
                  <table className="min-w-full divide-y divide-border table-sticky-first-col">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          SKU
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Category
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Account
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Qty
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Unit Cost
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Total
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Landed Alloc.
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Effective Cost
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Received
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {order.lineItems.map((li) => (
                        <tr
                          key={li.id}
                          className="hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => setAlternativesLineItem(li)}
                          title="Click to view item details"
                        >
                          <td className="px-4 py-3 text-sm">
                            <div>
                              <span>{li.description}</span>
                              {!li.inventoryItemId && (
                                <div className="mt-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCreateInventoryForLine(li);
                                    }}
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
                          <td className="px-4 py-3 text-sm text-muted-foreground">{li.sku ?? '—'}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{PO_LINE_ITEM_CATEGORY_LABELS[(li.category as POLineItemCategory) ?? 'inventory'] ?? 'Inventory'}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{li.expenseAccountCode ?? '—'}</td>
                          <td className="px-4 py-3 text-sm text-right">{li.quantity}</td>
                          <td className="px-4 py-3 text-sm text-right">
                            {li.unitCost.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            {li.totalCost.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground text-right">
                            {(li.landedCostAllocation ?? 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            {(li.effectiveUnitCost ?? li.unitCost).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground text-right">
                            {li.quantityReceived}/{li.quantity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Landed Costs */}
        <div className="lg:col-span-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Landed Costs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {editing ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {(['shipping', 'customs', 'duties', 'insurance', 'handling', 'other'] as const).map((field) => (
                      <div key={field} className="space-y-1">
                        <Label className="capitalize text-xs">{field}</Label>
                        <Input
                          type="number"
                          value={editLandedCosts[field]}
                          onChange={(e) =>
                            setEditLandedCosts((prev) => ({ ...prev, [field]: e.target.value }))
                          }
                          className="h-8"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Currency</Label>
                      <Select value={editCurrency} onValueChange={setEditCurrency}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(CURRENCIES).map((code) => (
                            <SelectItem key={code} value={code}>
                              {code} — {CURRENCY_LABELS[code]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Distribution Method</Label>
                      <Select
                        value={editDistributionMethod}
                        onValueChange={(v) => setEditDistributionMethod(v as LandedCostDistributionMethod)}
                      >
                        <SelectTrigger className="h-8">
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
                    <div key={label as string} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{label as string}</span>
                      <span>
                        {(value as number).toLocaleString()} {order.landedCosts.currency}
                      </span>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-semibold text-sm">
                      <span>Total Landed</span>
                      <span>
                        {order.landedCosts.totalLandedCost.toLocaleString()} {order.landedCosts.currency}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground pt-1">
                    Distribution: {order.landedCosts.distributionMethod.replace(/_/g, ' ')}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Totals */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{order.totals.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Landed Costs</span>
                <span>{order.totals.landedCostTotal.toLocaleString()}</span>
              </div>
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between font-semibold text-sm">
                  <span>Grand Total</span>
                  <span>
                    {order.totals.grandTotal.toLocaleString()} {order.totals.currency}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Notes */}
        <div className="lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={4}
                  placeholder="Add notes about this purchase order..."
                />
              ) : (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {order.notes || 'No notes'}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Receiving Summary */}
        {(order.status === 'sent' || order.status === 'partially-received' || order.status === 'received' || order.status === 'closed') && (
          <div className="lg:col-span-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Receiving Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {order.lineItems.map((li) => {
                  const pct = li.quantity > 0 ? Math.round((li.quantityReceived / li.quantity) * 100) : 0;
                  return (
                    <div key={li.id} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="truncate mr-2">{li.description}</span>
                        <span className="text-muted-foreground whitespace-nowrap">
                          {li.quantityReceived}/{li.quantity}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct > 0 ? 'bg-amber-500' : 'bg-gray-300'}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Receiving History */}
        <div className="lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Receiving History ({order.receivingHistory.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {order.receivingHistory.length > 0 ? (
                <div className="space-y-3">
                  {order.receivingHistory.map((receipt) => {
                    const receivedAt = receipt.receivedAt && typeof (receipt.receivedAt as any).toDate === 'function'
                      ? (receipt.receivedAt as any).toDate()
                      : receipt.receivedAt instanceof Date
                        ? receipt.receivedAt
                        : null;
                    return (
                      <div key={receipt.id} className="p-3 bg-muted/50 rounded-lg space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{receipt.id}</span>
                          {receivedAt && (
                            <span className="text-xs text-muted-foreground">
                              {receivedAt.toLocaleDateString()} {receivedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        {receipt.deliveryReference && (
                          <p className="text-xs text-muted-foreground">Ref: {receipt.deliveryReference}</p>
                        )}
                        <div className="space-y-0.5">
                          {receipt.lines.map((line) => {
                            const poLine = order.lineItems.find((li) => li.id === line.lineItemId);
                            return (
                              <div key={line.lineItemId} className="flex justify-between text-xs">
                                <span className="text-muted-foreground truncate mr-2">{poLine?.description ?? line.lineItemId}</span>
                                <span className="font-medium whitespace-nowrap">+{line.quantityReceived}</span>
                              </div>
                            );
                          })}
                        </div>
                        {receipt.notes && (
                          <p className="text-xs text-muted-foreground italic">{receipt.notes}</p>
                        )}
                        {isAdminUser && (
                          <button
                            className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline mt-1"
                            onClick={() => setEditingReceipt(receipt)}
                          >
                            Edit Receipt
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No goods received yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* QuickBooks Integration — only shown when QBO is connected & configured */}
        {qboReady && (
          <div className="lg:col-span-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">QuickBooks</CardTitle>
              </CardHeader>
              <CardContent>
                <QBOSyncStatusBadge
                  status={order.qboSyncStatus}
                  error={order.qboSyncError}
                  lastSyncedAt={order.qboSyncedAt as any}
                  qboDocNumber={order.qboBillDocNumber}
                  qboDocUrl={order.qboBillId ? `https://app.qbo.intuit.com/app/bill?txnId=${order.qboBillId}` : undefined}
                  entityType="Bill"
                  onRetry={
                    canSyncToQBO &&
                    (order.qboSyncStatus === 'error' || order.qboSyncStatus === 'correction-pending')
                      ? () => wrap(handleRetryQBOSync)
                      : undefined
                  }
                  onSync={
                    !order.qboSyncStatus &&
                    canSyncToQBO
                      ? () => wrap(() => actions.syncToBill())
                      : undefined
                  }
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Purchase Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>
                Rejection Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectNotes.trim() || actionLoading}
            >
              Reject
            </Button>
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
            <p className="text-sm text-muted-foreground">
              This will cancel the purchase order. This action cannot be undone.
            </p>
            <div className="space-y-1.5">
              <Label>
                Cancellation Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Keep PO
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={!cancelReason.trim() || actionLoading}
            >
              Cancel PO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Goods Receipt Dialog */}
      {showReceiptDialog && (
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
              Are you sure you want to permanently delete <strong>{order.poNumber}</strong>?
              This action cannot be undone. The purchase order and all its data will be
              permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? 'Deleting...' : 'Delete Permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Line Item Detail / Alternatives Drawer */}
      {alternativesLineItem && (
        <POLineItemAlternatives
          open={!!alternativesLineItem}
          onClose={() => setAlternativesLineItem(null)}
          lineItem={alternativesLineItem}
          canEdit={canEditOverall}
          onSave={async (lineItemId: string, updates: Partial<POLineItem>) => {
            const updatedLineItems = order.lineItems.map((li) => {
              if (li.id !== lineItemId) return li;
              const patched = { ...li, ...updates };
              // Recalculate totalCost if quantity or unitCost changed
              if (updates.quantity !== undefined || updates.unitCost !== undefined) {
                patched.totalCost = patched.quantity * patched.unitCost;
              }
              return patched;
            });
            await actions.update({ lineItems: updatedLineItems });
            // Refresh the drawer's lineItem with updated data
            const refreshed = updatedLineItems.find((li) => li.id === lineItemId);
            if (refreshed) setAlternativesLineItem(refreshed);
          }}
          onSubstitute={async (lineItemId: string, newItem: SimilarInventoryItem) => {
            const updatedLineItems = order.lineItems.map((li) => {
              if (li.id !== lineItemId) return li;
              return {
                ...li,
                inventoryItemId: newItem.id,
                sku: newItem.sku,
                description: newItem.displayName || newItem.name,
                unitCost: newItem.unitCost,
                totalCost: newItem.unitCost * li.quantity,
                currency: newItem.currency,
                unit: newItem.unit,
              };
            });
            try {
              await actions.update({ lineItems: updatedLineItems });
            } catch {
              /* error handled by hook */
            }
            setAlternativesLineItem(null);
          }}
        />
      )}

      {/* Edit Goods Receipt Dialog (admin only) */}
      {editingReceipt && order && (
        <EditGoodsReceiptDialog
          open={!!editingReceipt}
          onClose={() => setEditingReceipt(null)}
          order={order}
          receipt={editingReceipt}
          onSave={actions.editReceipt}
        />
      )}
    </div>
  );
}
