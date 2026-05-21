/**
 * Purchase Orders List Page
 * Styled to match ZeusOS Finishes design system
 */

import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, ExternalLink, ArrowLeft, Plus, Package, Trash2, XCircle, FileUp, Receipt } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
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
import { PO_STATUS_LABELS } from '../types/purchaseOrder';
import type { PurchaseOrderStatus } from '../types/purchaseOrder';
import { RagBadge, Banner } from '@/shared/components/data-display';
import { CreatePurchaseOrderDialog } from '../components/CreatePurchaseOrderDialog';
import type { InitialLineItem } from '../components/CreatePurchaseOrderDialog';
import { POPdfImportDialog } from '../components/POPdfImportDialog';
import { deletePurchaseOrder, cancelPurchaseOrder } from '../services/purchaseOrderService';
import { getProcurementRequest, buildPOLineItemsFromRequests } from '../services/procurementRequestService';
import { getProcurementRequirementsByIds } from '../services/procurementRequirementService';
import { syncMultiplePOsToBills } from '@/modules/finance/services/qboSyncService';
import { QBOSyncIndicator } from '@/modules/finance/components/integrations/QBOSyncStatusBadge';
import { useQBOConfig } from '@/modules/finance/hooks/useQBOConfig';
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

export default function PurchaseOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') ?? 'all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; poNumber: string } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ id: string; poNumber: string } | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const { isReady: qboReady } = useQBOConfig();
  const [selectedQBPOs, setSelectedQBPOs] = useState<Set<string>>(new Set());
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [bulkSyncResult, setBulkSyncResult] = useState<{ synced: number; failed: number } | null>(null);
  const [queueLineItems, setQueueLineItems] = useState<InitialLineItem[] | undefined>();
  const [queueSupplier, setQueueSupplier] = useState<{ supplierId: string; supplierName: string } | null>(null);
  const [queueCurrency, setQueueCurrency] = useState<string | undefined>();

  // Auto-open Create PO dialog when navigating from the procurement queue
  useEffect(() => {
    const fromRequests = searchParams.get('fromRequests');
    const fromRequirements = searchParams.get('fromRequirements');
    if (!fromRequests && !fromRequirements) return;

    let cancelled = false;

    (async () => {
      const items: InitialLineItem[] = [];
      let supplier: { supplierId: string; supplierName: string } | null = null;
      let currency: string | undefined;

      // Fetch material-driven requests
      if (fromRequests) {
        const requestIds = fromRequests.split(',').filter(Boolean);
        const requests = await Promise.all(
          requestIds.map((id) => getProcurementRequest(id)),
        );
        const validRequests = requests.filter((r): r is NonNullable<typeof r> => r !== null);
        if (validRequests.length > 0) {
          const built = buildPOLineItemsFromRequests(validRequests);
          items.push(...built.map((b) => ({ ...b, quantity: b.quantity, unitCost: b.unitCost })));
          // Use suggested supplier from first request if available
          const firstWithSupplier = validRequests.find((r) => r.suggestedSupplierId);
          if (firstWithSupplier?.suggestedSupplierId && firstWithSupplier?.suggestedSupplier) {
            supplier = { supplierId: firstWithSupplier.suggestedSupplierId, supplierName: firstWithSupplier.suggestedSupplier };
          }
          currency = validRequests[0].currency;
        }
      }

      // Fetch MO-driven requirements
      if (fromRequirements) {
        const requirementIds = fromRequirements.split(',').filter(Boolean);
        const requirements = await getProcurementRequirementsByIds(requirementIds);
        for (const req of requirements) {
          items.push({
            description: `${req.itemDescription} (MO: ${req.moNumber})`,
            quantity: req.quantityRequired,
            unitCost: req.estimatedUnitCost,
            unit: req.unit,
            inventoryItemId: req.inventoryItemId,
          });
        }
        // Use supplier from first requirement if available and no supplier set yet
        if (!supplier) {
          const firstWithSupplier = requirements.find((r) => r.supplierId);
          if (firstWithSupplier?.supplierId && firstWithSupplier?.supplierName) {
            supplier = { supplierId: firstWithSupplier.supplierId, supplierName: firstWithSupplier.supplierName };
          }
        }
        if (!currency && requirements.length > 0) {
          currency = requirements[0].currency;
        }
      }

      if (cancelled) return;

      if (items.length > 0) {
        setQueueLineItems(items);
        setQueueSupplier(supplier);
        setQueueCurrency(currency);
        setShowCreateDialog(true);
      }

      // Clear the queue params from URL so refresh doesn't re-trigger
      setSearchParams((prev) => {
        prev.delete('fromRequests');
        prev.delete('fromRequirements');
        return prev;
      }, { replace: true });
    })();

    return () => { cancelled = true; };
  }, []); // Run once on mount

  // Legacy redirect: ?selected=:poId → /procurement/orders/:poId
  useEffect(() => {
    const sel = searchParams.get('selected');
    if (sel) {
      const action = searchParams.get('action');
      navigate(`/procurement/orders/${sel}${action ? `?action=${action}` : ''}`, { replace: true });
    }
  }, [searchParams, navigate]);

  const handleSelectPo = (poId: string, action?: 'receive') => {
    navigate(`/procurement/orders/${poId}${action ? '?action=receive' : ''}`);
  };

  const filters = {
    search: search || undefined,
    status: statusFilter && statusFilter !== 'all' ? (statusFilter as PurchaseOrderStatus) : undefined,
  };

  const { orders: allOrders, loading } = usePurchaseOrders(SUBSIDIARY_ID, filters);
  // Filter out outsourced POs — they appear on the Outsourcing tab
  const orders = allOrders.filter(o => o.purchaseOrderType !== 'outsourced');

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

  const syncEligiblePOs = orders.filter(
    (po) =>
      ['approved', 'sent', 'partially-received', 'received'].includes(po.status) &&
      (po as any).qboSyncStatus !== 'synced' &&
      (po as any).qboSyncStatus !== 'pending'
  );

  const toggleQBSelection = (poId: string) => {
    setSelectedQBPOs((prev) => {
      const next = new Set(prev);
      if (next.has(poId)) next.delete(poId);
      else next.add(poId);
      return next;
    });
  };

  const toggleSelectAllEligible = () => {
    if (selectedQBPOs.size === syncEligiblePOs.length) {
      setSelectedQBPOs(new Set());
    } else {
      setSelectedQBPOs(new Set(syncEligiblePOs.map((po) => po.id)));
    }
  };

  const handleBulkSync = async () => {
    if (selectedQBPOs.size === 0) return;
    setBulkSyncing(true);
    setBulkSyncResult(null);
    try {
      const result = await syncMultiplePOsToBills(Array.from(selectedQBPOs));
      setBulkSyncResult({ synced: result.synced, failed: result.failed });
      setSelectedQBPOs(new Set());
    } catch {
      setBulkSyncResult({ synced: 0, failed: selectedQBPOs.size });
    } finally {
      setBulkSyncing(false);
    }
  };

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[1640px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/procurement"
            className="p-1.5 rounded transition-colors"
            style={{ color: 'var(--fg-secondary)' }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = 'var(--bg-sunken)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = 'transparent')
            }
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1>Purchase Orders</h1>
            <p className="mt-1 text-[12.5px]" style={{ color: 'var(--fg-secondary)' }}>
              Manage supplier orders and deliveries
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
            <FileUp className="h-3.5 w-3.5" /> Import PDF
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-3.5 w-3.5" /> Create PO
          </Button>
        </div>
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
          </div>
        </CardContent>
      </Card>

      {/* Results Count + Bulk Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {orders.length} order{orders.length !== 1 ? 's' : ''}
          </span>
          {statusFilter && statusFilter !== 'all' && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-sm"
              onClick={() => setStatusFilter('all')}
            >
              Clear filter
            </Button>
          )}
        </div>
        {qboReady && (selectedQBPOs.size > 0 || syncEligiblePOs.length > 0) && (
          <div className="flex items-center gap-2">
            {selectedQBPOs.size > 0 && (
              <Button
                size="sm"
                className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                onClick={handleBulkSync}
                disabled={bulkSyncing}
              >
                <Receipt className="h-4 w-4" />
                {bulkSyncing ? 'Syncing...' : `Sync ${selectedQBPOs.size} to QBO`}
              </Button>
            )}
            {syncEligiblePOs.length > 0 && selectedQBPOs.size === 0 && (
              <span className="text-xs text-muted-foreground">
                {syncEligiblePOs.length} PO{syncEligiblePOs.length !== 1 ? 's' : ''} ready for QBO billing
              </span>
            )}
          </div>
        )}
      </div>

      {/* Bulk Sync Result */}
      {bulkSyncResult && (
        <Banner
          tone={bulkSyncResult.failed === 0 ? 'success' : 'warning'}
          title={
            bulkSyncResult.failed === 0
              ? 'Sync complete'
              : 'Sync finished with errors'
          }
          message={
            <>
              {bulkSyncResult.synced > 0 &&
                `${bulkSyncResult.synced} PO${bulkSyncResult.synced !== 1 ? 's' : ''} synced to QuickBooks. `}
              {bulkSyncResult.failed > 0 && `${bulkSyncResult.failed} failed.`}
            </>
          }
          onDismiss={() => setBulkSyncResult(null)}
        />
      )}

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
              {search || (statusFilter && statusFilter !== 'all')
                ? 'Try adjusting your filters'
                : 'Create your first purchase order to get started'}
            </p>
            {!search && (!statusFilter || statusFilter === 'all') && (
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
                  {qboReady && syncEligiblePOs.length > 0 && (
                    <th className="px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={selectedQBPOs.size === syncEligiblePOs.length && syncEligiblePOs.length > 0}
                        onChange={toggleSelectAllEligible}
                        className="h-4 w-4 rounded border-gray-300"
                        title="Select all eligible for QBO sync"
                      />
                    </th>
                  )}
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
                  {qboReady && (
                    <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      QB
                    </th>
                  )}
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
                    onClick={() => handleSelectPo(po.id)}
                    className="hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    {qboReady && syncEligiblePOs.length > 0 && (
                      <td className="px-3 py-4 w-10" onClick={(e) => e.stopPropagation()}>
                        {syncEligiblePOs.some((ep) => ep.id === po.id) ? (
                          <input
                            type="checkbox"
                            checked={selectedQBPOs.has(po.id)}
                            onChange={() => toggleQBSelection(po.id)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                        ) : null}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-medium">{po.poNumber}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span>{po.supplierName}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {(() => {
                        const d = (po as any).orderDate || po.createdAt;
                        if (!d) return '—';
                        if (typeof d.toDate === 'function') return d.toDate().toLocaleDateString();
                        if (d.seconds) return new Date(d.seconds * 1000).toLocaleDateString();
                        if (d instanceof Date) return d.toLocaleDateString();
                        return '—';
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <RagBadge tone={STATUS_TONE[po.status]}>
                        {PO_STATUS_LABELS[po.status]}
                      </RagBadge>
                    </td>
                    {qboReady && (
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <QBOSyncIndicator
                          status={(po as any).qboSyncStatus}
                          qboDocNumber={(po as any).qboBillDocNumber}
                        />
                      </td>
                    )}
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
                        const fillColor =
                          pct >= 100
                            ? 'var(--rag-green)'
                            : pct > 0
                            ? 'var(--rag-amber)'
                            : 'var(--border-default)';
                        return (
                          <div className="inline-flex flex-col items-center gap-1">
                            <span
                              className="text-[11.5px] tabular-nums"
                              style={{ color: 'var(--fg-secondary)' }}
                            >
                              {totalReceived}/{totalOrdered}
                            </span>
                            <div
                              className="w-16 rounded-full h-1.5 overflow-hidden"
                              style={{ backgroundColor: 'var(--bg-sunken)' }}
                            >
                              <div
                                className="h-1.5 rounded-full"
                                style={{
                                  width: `${Math.min(pct, 100)}%`,
                                  backgroundColor: fillColor,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })() : (
                        <span style={{ color: 'var(--fg-tertiary)' }}>—</span>
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
                              handleSelectPo(po.id, 'receive');
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
                            handleSelectPo(po.id);
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

      {/* Create Dialog (manual or from queue) */}
      <CreatePurchaseOrderDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={(poId) => handleSelectPo(poId)}
        subsidiaryId={SUBSIDIARY_ID}
        userId={user?.uid ?? ''}
        initialLineItems={queueLineItems}
        initialSupplier={queueSupplier}
        initialCurrency={queueCurrency}
        onFullClose={() => {
          setQueueLineItems(undefined);
          setQueueSupplier(null);
          setQueueCurrency(undefined);
        }}
      />

      {/* Import from PDF Dialog */}
      <POPdfImportDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
        onCreated={(poId) => {
          setShowImportDialog(false);
          handleSelectPo(poId);
        }}
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
