/**
 * Outsourced Purchase Orders List Page
 * Shows OPOs with ingredient availability indicators
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Factory, Plus, Package, Trash2, XCircle, ExternalLink, X } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { RagBadge } from '@/shared/components/data-display';
import { Checkbox } from '@/core/components/ui/checkbox';
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
import { useOutsourcedPurchaseOrders } from '../hooks/useOutsourcedPurchaseOrders';
import { PO_STATUS_LABELS } from '../types/purchaseOrder';
import type { PurchaseOrderStatus, OPOIngredientAvailability } from '../types/purchaseOrder';
import { CreateOutsourcedOrderDialog } from '../components/CreateOutsourcedOrderDialog';
import { OPODetailDrawer } from '../components/OPODetailDrawer';
import { deleteOPO } from '../services/outsourcedPurchaseOrderService';
import { cancelPurchaseOrder } from '../services/purchaseOrderService';
import { useAuth } from '@/shared/hooks/useAuth';

const SUBSIDIARY_ID = 'finishes';

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

const INGREDIENT_STATUS_CONFIG: Record<OPOIngredientAvailability, { dot: string; label: string }> = {
  in_stock: { dot: 'bg-green-500', label: 'In Stock' },
  partial: { dot: 'bg-yellow-500', label: 'Partial' },
  not_available: { dot: 'bg-red-500', label: 'Not Available' },
  no_recipe: { dot: 'bg-gray-300', label: 'No Recipe' },
  not_applicable: { dot: 'bg-gray-200', label: 'N/A' },
};

function IngredientStatusDot({ status }: { status?: OPOIngredientAvailability }) {
  const config = INGREDIENT_STATUS_CONFIG[status ?? 'not_applicable'];
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${config.dot}`} />
      <span className="text-xs text-muted-foreground">{config.label}</span>
    </div>
  );
}

export default function OutsourcedOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; poNumber: string } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ id: string; poNumber: string } | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedOpoId, setSelectedOpoId] = useState<string | null>(searchParams.get('selected'));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filters = {
    search: search || undefined,
    status: statusFilter && statusFilter !== 'all' ? (statusFilter as PurchaseOrderStatus) : undefined,
  };

  const { orders, loading } = useOutsourcedPurchaseOrders(SUBSIDIARY_ID, filters);

  const formatCurrency = (amount: number, currency: string) =>
    `${currency} ${amount.toLocaleString()}`;

  const formatDate = (d: any) => {
    if (!d) return '—';
    if (typeof d.toDate === 'function') return d.toDate().toLocaleDateString();
    if (d.seconds) return new Date(d.seconds * 1000).toLocaleDateString();
    if (d instanceof Date) return d.toLocaleDateString();
    return '—';
  };

  const handleSelectOpo = (opoId: string) => {
    setSelectedOpoId(opoId);
    setSearchParams((prev) => { prev.set('selected', opoId); return prev; }, { replace: true });
  };

  const handleCloseDrawer = () => {
    setSelectedOpoId(null);
    setSearchParams((prev) => { prev.delete('selected'); return prev; }, { replace: true });
  };

  const handleDeleteOPO = async () => {
    if (!deleteTarget || !user?.uid) return;
    setActionLoading(true);
    try {
      await deleteOPO(deleteTarget.id, user.uid);
    } catch (err) {
      console.error('Delete failed:', (err as Error).message);
    } finally {
      setActionLoading(false);
      setDeleteTarget(null);
    }
  };

  const handleCancelOPO = async () => {
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

  const toggleSelectId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map(o => o.id)));
    }
  };

  const [bulkDeleteTarget, setBulkDeleteTarget] = useState(false);
  const [bulkCancelTarget, setBulkCancelTarget] = useState(false);
  const [bulkCancelReason, setBulkCancelReason] = useState('');

  const handleBulkDelete = async () => {
    if (!user?.uid) return;
    setActionLoading(true);
    try {
      const eligibleIds = orders
        .filter(o => selectedIds.has(o.id) && ['draft', 'cancelled'].includes(o.status) && o.receivingHistory.length === 0)
        .map(o => o.id);
      for (const id of eligibleIds) {
        await deleteOPO(id, user.uid);
      }
    } catch (err) {
      console.error('Bulk delete failed:', (err as Error).message);
    } finally {
      setActionLoading(false);
      setBulkDeleteTarget(false);
      setSelectedIds(new Set());
    }
  };

  const handleBulkCancel = async () => {
    if (!user?.uid || !bulkCancelReason.trim()) return;
    setActionLoading(true);
    try {
      const eligibleIds = orders
        .filter(o => selectedIds.has(o.id) && !['closed', 'cancelled'].includes(o.status))
        .map(o => o.id);
      for (const id of eligibleIds) {
        await cancelPurchaseOrder(id, user.uid, bulkCancelReason);
      }
    } catch (err) {
      console.error('Bulk cancel failed:', (err as Error).message);
    } finally {
      setActionLoading(false);
      setBulkCancelTarget(false);
      setBulkCancelReason('');
      setSelectedIds(new Set());
    }
  };

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[1640px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1>Outsourced Orders</h1>
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--fg-secondary)' }}>
            Manage outsourced manufacturing orders to contractors
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-3.5 w-3.5" /> Create OPO
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search OPO number or contractor..."
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
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-primary/5 border rounded-lg p-3 flex items-center gap-3">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Button
            size="sm"
            variant="outline"
            className="text-amber-600 border-amber-200"
            onClick={() => setBulkCancelTarget(true)}
            disabled={actionLoading}
          >
            <XCircle className="h-4 w-4 mr-1" /> Cancel Selected
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 border-red-200"
            onClick={() => setBulkDeleteTarget(true)}
            disabled={actionLoading}
          >
            <Trash2 className="h-4 w-4 mr-1" /> Delete Selected
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
          >
            <X className="h-4 w-4 mr-1" /> Clear
          </Button>
        </div>
      )}

      {/* Results Count */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{orders.length} order{orders.length !== 1 ? 's' : ''}</span>
        {statusFilter && statusFilter !== 'all' && (
          <Button variant="link" size="sm" className="h-auto p-0 text-sm" onClick={() => setStatusFilter('all')}>
            Clear filter
          </Button>
        )}
      </div>

      {/* Loading / Empty / Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Factory className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <h3 className="text-lg font-medium">No outsourced orders found</h3>
            <p className="text-muted-foreground mt-1">
              {search || (statusFilter && statusFilter !== 'all')
                ? 'Try adjusting your filters'
                : 'Create your first outsourced purchase order to get started'}
            </p>
            {!search && (!statusFilter || statusFilter === 'all') && (
              <Button variant="link" className="mt-2" onClick={() => setShowCreateDialog(true)}>
                Create Outsourced Order
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-3 text-center w-10">
                    <Checkbox
                      checked={orders.length > 0 && selectedIds.size === orders.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    OPO Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Contractor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Items
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Ingredients
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Expected
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Service Fee
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Product Cost
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
                {orders.map((opo) => (
                  <tr
                    key={opo.id}
                    onClick={() => handleSelectOpo(opo.id)}
                    className="hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(opo.id)}
                        onCheckedChange={() => toggleSelectId(opo.id)}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium">{opo.poNumber}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span>{opo.supplierName}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {opo.lineItems.length} item{opo.lineItems.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <IngredientStatusDot status={opo.ingredientAvailability} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {formatDate(opo.expectedDeliveryDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <RagBadge tone={STATUS_TONE[opo.status]}>
                        {PO_STATUS_LABELS[opo.status]}
                      </RagBadge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-muted-foreground">
                      {formatCurrency(opo.totalServiceFee ?? opo.totals.subtotal, opo.totals.currency)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-medium">
                      {formatCurrency(opo.totalProductCost ?? opo.totals.grandTotal, opo.totals.currency)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {['sent', 'partially-received', 'received', 'closed'].includes(opo.status) ? (() => {
                        const totalOrdered = opo.lineItems.reduce((s, li) => s + li.quantity, 0);
                        const totalReceived = opo.lineItems.reduce((s, li) => s + li.quantityReceived, 0);
                        const pct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;
                        return (
                          <div className="inline-flex flex-col items-center gap-1">
                            <span className="text-sm text-muted-foreground">{totalReceived}/{totalOrdered}</span>
                            <div
                              className="w-16 rounded-full h-1.5 overflow-hidden"
                              style={{ backgroundColor: 'var(--bg-sunken)' }}
                            >
                              <div
                                className="h-1.5 rounded-full"
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
                      })() : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(opo.status === 'sent' || opo.status === 'partially-received') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                            title="Receive Goods"
                            onClick={(e) => { e.stopPropagation(); handleSelectOpo(opo.id); }}
                          >
                            <Package className="h-4 w-4" />
                          </Button>
                        )}
                        {!['closed', 'cancelled'].includes(opo.status) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            title="Cancel OPO"
                            onClick={(e) => { e.stopPropagation(); setCancelTarget({ id: opo.id, poNumber: opo.poNumber }); }}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {['draft', 'cancelled'].includes(opo.status) && opo.receivingHistory.length === 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                            title="Delete OPO"
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: opo.id, poNumber: opo.poNumber }); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => { e.stopPropagation(); handleSelectOpo(opo.id); }}
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

      {/* Create OPO Dialog */}
      <CreateOutsourcedOrderDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={(opoId) => handleSelectOpo(opoId)}
        subsidiaryId={SUBSIDIARY_ID}
        userId={user?.uid ?? ''}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Outsourced Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{deleteTarget?.poNumber}</strong>?
              All ingredient reservations will be released. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" disabled={actionLoading} onClick={handleDeleteOPO}>
              {actionLoading ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel OPO Dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) { setCancelTarget(null); setCancelReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Outsourced Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Cancel <strong>{cancelTarget?.poNumber}</strong>? Ingredient reservations will be released.
            </p>
            <div className="space-y-1.5">
              <Label>Cancellation Reason <span className="text-destructive">*</span></Label>
              <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCancelTarget(null); setCancelReason(''); }}>Keep OPO</Button>
            <Button variant="destructive" onClick={handleCancelOPO} disabled={!cancelReason.trim() || actionLoading}>
              Cancel OPO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteTarget} onOpenChange={(open) => { if (!open) setBulkDeleteTarget(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Orders</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the selected orders? Only draft and cancelled orders
              with no receiving history will be deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" disabled={actionLoading} onClick={handleBulkDelete}>
              {actionLoading ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Cancel Dialog */}
      <Dialog open={bulkCancelTarget} onOpenChange={(open) => { if (!open) { setBulkCancelTarget(false); setBulkCancelReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Selected Orders</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Cancel {selectedIds.size} selected order{selectedIds.size !== 1 ? 's' : ''}? Ingredient reservations will be released.
            </p>
            <div className="space-y-1.5">
              <Label>Cancellation Reason <span className="text-destructive">*</span></Label>
              <Textarea value={bulkCancelReason} onChange={(e) => setBulkCancelReason(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBulkCancelTarget(false); setBulkCancelReason(''); }}>Keep Orders</Button>
            <Button variant="destructive" onClick={handleBulkCancel} disabled={!bulkCancelReason.trim() || actionLoading}>
              Cancel Orders
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Drawer */}
      <OPODetailDrawer
        opoId={selectedOpoId}
        open={!!selectedOpoId}
        onClose={handleCloseDrawer}
      />
    </div>
  );
}
