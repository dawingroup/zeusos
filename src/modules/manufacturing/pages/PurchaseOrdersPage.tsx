/**
 * Purchase Orders List Page
 * Styled to match DawinOS Finishes design system
 */

import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, ShoppingCart, ExternalLink, ArrowLeft, Plus, Package, Trash2, XCircle } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Badge } from '@/core/components/ui/badge';
import { Card, CardContent } from '@/core/components/ui/card';
import { Label } from '@/core/components/ui/label';
import { Textarea } from '@/core/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/core/components/ui/dialog';
import { usePurchaseOrders } from '../hooks/usePurchaseOrders';
import { PO_STATUS_LABELS, PO_LINE_CATEGORY_LABELS } from '../types/purchaseOrder';
import type { PurchaseOrderStatus, POLineItemCategory } from '../types/purchaseOrder';
import { CreatePurchaseOrderDialog } from '../components/po/CreatePurchaseOrderDialog';
import { deletePurchaseOrder, cancelPurchaseOrder } from '../services/purchaseOrderService';
import { useAuth } from '@/shared/hooks/useAuth';

const SUBSIDIARY_ID = 'finishes';

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

export default function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') ?? 'all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; poNumber: string } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ id: string; poNumber: string } | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const filters = {
    search: search || undefined,
    status: statusFilter && statusFilter !== 'all' ? (statusFilter as PurchaseOrderStatus) : undefined,
    category: categoryFilter && categoryFilter !== 'all' ? (categoryFilter as POLineItemCategory) : undefined,
  };

  const { orders, loading } = usePurchaseOrders(SUBSIDIARY_ID, filters);

  const formatCurrency = (amount: number, currency: string) => {
    return `${currency} ${amount.toLocaleString()}`;
  };

  const handleDeletePO = async () => {
    if (!deleteTarget || !user?.uid) return;
    setActionLoading(true);
    try {
      await deletePurchaseOrder(deleteTarget.id, user.uid);
    } catch (err) {
      console.error('Delete failed:', (err as Error).message);
    } finally {
      setActionLoading(false);
      setDeleteTarget(null);
    }
  };

  const handleCancelPO = async () => {
    if (!cancelTarget || !user?.uid || !cancelReason.trim()) return;
    setActionLoading(true);
    try {
      await cancelPurchaseOrder(cancelTarget.id, user.uid, cancelReason);
    } catch (err) {
      console.error('Cancel failed:', (err as Error).message);
    } finally {
      setActionLoading(false);
      setCancelTarget(null);
      setCancelReason('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/manufacturing"
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Purchase Orders</h1>
            <p className="text-sm text-muted-foreground">Manage supplier orders and deliveries</p>
          </div>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Create PO
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search PO number or supplier..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="min-w-[160px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(PO_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="min-w-[140px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(PO_LINE_CATEGORY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>
          {orders.length} order{orders.length !== 1 ? 's' : ''}
        </span>
        {((statusFilter && statusFilter !== 'all') || (categoryFilter && categoryFilter !== 'all')) && (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-sm"
            onClick={() => { setStatusFilter('all'); setCategoryFilter('all'); }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : orders.length === 0 ? (
        /* Empty State */
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ShoppingCart className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <h3 className="text-lg font-medium">No purchase orders found</h3>
            <p className="text-muted-foreground mt-1">
              {search || (statusFilter && statusFilter !== 'all') || (categoryFilter && categoryFilter !== 'all')
                ? 'Try adjusting your filters'
                : 'Create your first purchase order to get started'}
            </p>
            {!search && (!statusFilter || statusFilter === 'all') && (!categoryFilter || categoryFilter === 'all') && (
              <Button
                variant="link"
                className="mt-2"
                onClick={() => setShowCreateDialog(true)}
              >
                Create Purchase Order
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Orders Table */
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border table-sticky-first-col">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    PO Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Supplier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Order Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Subtotal
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Landed Cost
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Grand Total
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Received
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((po) => (
                  <tr
                    key={po.id}
                    onClick={() => navigate(`/manufacturing/purchase-orders/${po.id}`)}
                    className="hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium">{po.poNumber}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span>{po.supplierName}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {po.orderDate && typeof (po.orderDate as any).toDate === 'function'
                        ? (po.orderDate as any).toDate().toLocaleDateString()
                        : po.orderDate
                          ? new Date((po.orderDate as any).seconds * 1000).toLocaleDateString()
                          : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant="outline" className={STATUS_STYLES[po.status]}>
                        {PO_STATUS_LABELS[po.status]}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-muted-foreground">
                      {formatCurrency(po.totals.subtotal, po.totals.currency)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-muted-foreground">
                      {formatCurrency(po.totals.landedCostTotal, po.totals.currency)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-medium">
                      {formatCurrency(po.totals.grandTotal, po.totals.currency)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {['sent', 'partially-received', 'received', 'closed'].includes(po.status) ? (() => {
                        const totalOrdered = po.lineItems.reduce((s, li) => s + li.quantity, 0);
                        const totalReceived = po.lineItems.reduce((s, li) => s + li.quantityReceived, 0);
                        const pct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;
                        return (
                          <div className="inline-flex flex-col items-center gap-1">
                            <span className="text-sm text-muted-foreground">{totalReceived}/{totalOrdered}</span>
                            <div className="w-16 bg-gray-200 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${pct >= 100 ? 'bg-green-500' : pct > 0 ? 'bg-amber-500' : 'bg-gray-300'}`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })() : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(po.status === 'sent' || po.status === 'partially-received') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                            title="Receive Goods"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/manufacturing/purchase-orders/${po.id}?action=receive`);
                            }}
                          >
                            <Package className="h-4 w-4" />
                          </Button>
                        )}
                        {!['closed', 'cancelled'].includes(po.status) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            title="Cancel PO"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCancelTarget({ id: po.id, poNumber: po.poNumber });
                            }}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {['draft', 'cancelled'].includes(po.status) &&
                          po.receivingHistory.length === 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                            title="Delete PO"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget({ id: po.id, poNumber: po.poNumber });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/manufacturing/purchase-orders/${po.id}`);
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Dialog */}
      <CreatePurchaseOrderDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={(poId) => navigate(`/manufacturing/purchase-orders/${poId}`)}
        subsidiaryId={SUBSIDIARY_ID}
        userId={user?.uid ?? ''}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Purchase Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{deleteTarget?.poNumber}</strong>?
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={actionLoading}
              onClick={handleDeletePO}
            >
              {actionLoading ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel PO Dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) { setCancelTarget(null); setCancelReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Purchase Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Cancel <strong>{cancelTarget?.poNumber}</strong>? This cannot be undone.
            </p>
            <div className="space-y-1.5">
              <Label>Cancellation Reason <span className="text-destructive">*</span></Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCancelTarget(null); setCancelReason(''); }}>
              Keep PO
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelPO}
              disabled={!cancelReason.trim() || actionLoading}
            >
              Cancel PO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
