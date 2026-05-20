/**
 * OPO Detail Drawer
 * Full detail view for an outsourced purchase order with recipe, costing, and lifecycle actions.
 */

import { useState } from 'react';
import {
  X, Factory, MapPin, Package, ChevronDown, ChevronRight,
  Loader2, RotateCcw, Trash2, Send, CheckCircle, XCircle, Copy, Truck, Link2,
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Label } from '@/core/components/ui/label';
import { Textarea } from '@/core/components/ui/textarea';
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
import { useOutsourcedPurchaseOrder } from '../hooks/useOutsourcedPurchaseOrder';
import { OPOReceivingDialog } from './OPOReceivingDialog';
import { OPOMaterialDispatchDialog } from './OPOMaterialDispatchDialog';
import { IngredientIntelPopup } from './IngredientIntelPopup';
import { PO_STATUS_LABELS } from '../types/purchaseOrder';
import type { PurchaseOrderStatus, OPOIngredientAvailability } from '../types/purchaseOrder';
import { useAuth } from '@/shared/hooks/useAuth';

interface Props {
  opoId: string | null;
  open: boolean;
  onClose: () => void;
}

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

const INGREDIENT_DOT: Record<OPOIngredientAvailability, string> = {
  in_stock: 'bg-green-500',
  partial: 'bg-yellow-500',
  not_available: 'bg-red-500',
  no_recipe: 'bg-gray-300',
  not_applicable: 'bg-gray-200',
};

function formatDate(d: any): string {
  if (!d) return '—';
  if (typeof d.toDate === 'function') return d.toDate().toLocaleDateString();
  if (d.seconds) return new Date(d.seconds * 1000).toLocaleDateString();
  if (d instanceof Date) return d.toLocaleDateString();
  return '—';
}

function formatCurrency(amount: number | undefined, currency: string): string {
  return `${currency} ${(amount ?? 0).toLocaleString()}`;
}

export function OPODetailDrawer({ opoId, open, onClose }: Props) {
  const { user } = useAuth();
  const { order: opo, loading, actions } = useOutsourcedPurchaseOrder(opoId, user?.uid ?? '');
  const [actionLoading, setActionLoading] = useState(false);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [showDispatchDialog, setShowDispatchDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showRevertDialog, setShowRevertDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null);

  if (!open) return null;

  const wrapAction = async (fn: () => Promise<void>) => {
    setActionLoading(true);
    try { await fn(); } catch (err) {
      console.error(err);
    } finally { setActionLoading(false); }
  };

  const currency = opo?.totals?.currency ?? 'UGX';

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-background border-l shadow-xl overflow-y-auto">
        {loading || !opo ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="sticky top-0 bg-background z-10 border-b px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Factory className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <h2 className="text-lg font-semibold">{opo.poNumber}</h2>
                    <p className="text-sm text-muted-foreground">{opo.supplierName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={STATUS_STYLES[opo.status]}>
                    {PO_STATUS_LABELS[opo.status]}
                  </Badge>
                  <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 px-6 py-4 space-y-6">
              {/* Location Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Ship-to (Finished Goods)</p>
                    <p className="text-sm font-medium">{opo.shipToWarehouseName || '—'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Track Ingredients In</p>
                    <p className="text-sm font-medium">{opo.trackIngredientsWarehouseName || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Order Date</p>
                  <p>{formatDate(opo.orderDate ?? opo.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Expected Delivery</p>
                  <p>{formatDate(opo.expectedDeliveryDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ingredient Status</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${INGREDIENT_DOT[opo.ingredientAvailability ?? 'not_applicable']}`} />
                    <span className="text-xs capitalize">{(opo.ingredientAvailability ?? 'n/a').replace(/_/g, ' ')}</span>
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Purchase Items</CardTitle>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground border-b">
                        <th className="text-left py-2 pr-2">Item</th>
                        <th className="text-right py-2 px-2">Qty</th>
                        <th className="text-right py-2 px-2">Fee/Unit</th>
                        <th className="text-right py-2 px-2">Total Fee</th>
                        <th className="text-center py-2 px-2">Ingredients</th>
                        <th className="text-right py-2 pl-2">Received</th>
                      </tr>
                    </thead>
                    <tbody>
                      {opo.lineItems.map((li) => {
                        const ext = opo.opoLineItemExtensions?.[li.id];
                        const itemRecipe = (opo.recipeSnapshot ?? []).filter(r => r.parentLineItemId === li.id);
                        const isExpanded = expandedRecipe === li.id;

                        return (
                          <tr key={li.id} className="border-b last:border-0">
                            <td className="py-2 pr-2">
                              <div className="flex items-center gap-1">
                                {itemRecipe.length > 0 && (
                                  <button
                                    onClick={() => setExpandedRecipe(isExpanded ? null : li.id)}
                                    className="p-0.5 hover:bg-muted rounded"
                                  >
                                    {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                  </button>
                                )}
                                <span className="font-medium">{li.description}</span>
                              </div>
                              {li.sku && <span className="text-xs text-muted-foreground">{li.sku}</span>}

                              {/* Expanded recipe rows */}
                              {isExpanded && itemRecipe.length > 0 && (
                                <div className="mt-2 ml-4 bg-muted/30 rounded-lg p-2 space-y-1">
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Recipe / Ingredients</p>
                                  {itemRecipe.map(r => (
                                    <div key={r.id} className="flex items-center gap-2 text-xs">
                                      <IngredientIntelPopup ingredient={r} currency={currency}>
                                        <button type="button" className={`inline-block h-2 w-2 rounded-full ${INGREDIENT_DOT[r.availability]} cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-primary/40 transition-shadow`} />
                                      </IngredientIntelPopup>
                                      <span className="flex-1">{r.ingredientName}</span>
                                      <span className="text-muted-foreground">{r.quantityPerUnit} {r.unit}/unit</span>
                                      <span className="text-muted-foreground">= {r.totalQuantity} total</span>
                                      <span>{formatCurrency(r.totalCost, currency)}</span>
                                    </div>
                                  ))}
                                  <div className="border-t pt-1 mt-1 flex justify-between text-xs font-medium">
                                    <span>Ingredient Cost/Unit</span>
                                    <span>{formatCurrency(ext?.ingredientCostPerUnit ?? 0, currency)}</span>
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="text-right py-2 px-2">{li.quantity}</td>
                            <td className="text-right py-2 px-2 text-muted-foreground">
                              {formatCurrency(li.unitCost, currency)}
                            </td>
                            <td className="text-right py-2 px-2">
                              {formatCurrency(li.totalCost, currency)}
                            </td>
                            <td className="text-center py-2 px-2">
                              {ext && (
                                <span className={`inline-block h-2.5 w-2.5 rounded-full ${INGREDIENT_DOT[ext.ingredientAvailability ?? 'not_applicable']}`} />
                              )}
                            </td>
                            <td className="text-right py-2 pl-2">
                              <span className={li.quantityReceived >= li.quantity ? 'text-green-600' : ''}>
                                {li.quantityReceived}/{li.quantity}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              {/* Cost Summary */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Cost Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Service Fees (Contractor)</span>
                    <span>{formatCurrency(opo.totalServiceFee ?? opo.totals.subtotal, currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Additional Costs (Landed)</span>
                    <span>{formatCurrency(opo.totals.landedCostTotal, currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ingredient Costs</span>
                    <span>{formatCurrency(opo.totalIngredientCost ?? 0, currency)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between text-sm font-medium">
                    <span>Total Product Cost</span>
                    <span>{formatCurrency(opo.totalProductCost ?? opo.totals.grandTotal, currency)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Bill Total (QBO)</span>
                    <span>{formatCurrency(opo.totals.grandTotal, currency)} (fees + additional only)</span>
                  </div>
                </CardContent>
              </Card>

              {/* Receiving History */}
              {opo.receivingHistory.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Receiving History</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {opo.receivingHistory.map((receipt, idx) => (
                      <div key={receipt.id || idx} className="flex items-center justify-between text-sm border-b last:border-0 pb-2">
                        <div>
                          <p className="font-medium">{formatDate(receipt.receivedAt)}</p>
                          {receipt.notes && <p className="text-xs text-muted-foreground">{receipt.notes}</p>}
                        </div>
                        <div className="text-right">
                          {receipt.lines.map(line => (
                            <p key={line.lineItemId} className="text-xs text-muted-foreground">
                              +{line.quantityReceived} received
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Linked Manufacturing Orders */}
              {(opo.linkedManufacturingOrderIds ?? []).length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                      <Link2 className="h-4 w-4" />
                      Linked Manufacturing Orders
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {opo.linkedManufacturingOrderIds!.map((moId) => (
                      <div key={moId} className="flex items-center gap-2 text-sm">
                        <Factory className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground font-mono text-xs">{moId}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Material Dispatch History */}
              {(opo.materialDispatchHistory ?? []).length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                      <Truck className="h-4 w-4" />
                      Material Dispatch History
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {opo.materialDispatchHistory!.map((dispatch, idx) => (
                      <div key={dispatch.id || idx} className="border-b last:border-0 pb-2">
                        <div className="flex items-center justify-between text-sm">
                          <p className="font-medium">{formatDate(dispatch.dispatchedAt)}</p>
                          <span className="text-xs text-muted-foreground">{dispatch.toWarehouseName}</span>
                        </div>
                        {dispatch.items.map((item, i) => (
                          <p key={i} className="text-xs text-muted-foreground ml-2">
                            {item.ingredientName}: {item.quantity} {item.unit}
                          </p>
                        ))}
                        {dispatch.notes && <p className="text-xs text-muted-foreground mt-1 italic">{dispatch.notes}</p>}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Notes */}
              {opo.notes && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{opo.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Action Bar */}
            <div className="sticky bottom-0 bg-background border-t px-6 py-3">
              <div className="flex items-center gap-2 justify-end flex-wrap">
                {opo.status === 'draft' && (
                  <Button
                    size="sm"
                    onClick={() => wrapAction(actions.submitForApproval)}
                    disabled={actionLoading}
                  >
                    Submit for Approval
                  </Button>
                )}
                {opo.status === 'pending-approval' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-200"
                      onClick={() => setShowRejectDialog(true)}
                      disabled={actionLoading}
                    >
                      <XCircle className="h-4 w-4 mr-1" /> Reject
                    </Button>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => wrapAction(() => actions.approve(user?.displayName ?? user?.email ?? 'Approver'))}
                      disabled={actionLoading}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" /> Approve
                    </Button>
                  </>
                )}
                {opo.status === 'approved' && (
                  <Button
                    size="sm"
                    onClick={() => wrapAction(actions.markSent)}
                    disabled={actionLoading}
                  >
                    <Send className="h-4 w-4 mr-1" /> Mark Sent
                  </Button>
                )}
                {(opo.status === 'approved' || opo.status === 'sent') && (opo.recipeSnapshot ?? []).length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowDispatchDialog(true)}
                    disabled={actionLoading}
                  >
                    <Truck className="h-4 w-4 mr-1" /> Dispatch Materials
                  </Button>
                )}
                {(opo.status === 'sent' || opo.status === 'partially-received') && (
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => setShowReceiveDialog(true)}
                    disabled={actionLoading}
                  >
                    <Package className="h-4 w-4 mr-1" /> Receive Goods
                  </Button>
                )}
                {(opo.status === 'received' || opo.status === 'partially-received') && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-amber-600 border-amber-200"
                    onClick={() => setShowRevertDialog(true)}
                    disabled={actionLoading}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" /> Revert
                  </Button>
                )}
                {opo.status === 'received' && (
                  <Button
                    size="sm"
                    onClick={() => wrapAction(actions.close)}
                    disabled={actionLoading}
                  >
                    Close Order
                  </Button>
                )}
                {['draft', 'cancelled'].includes(opo.status) && opo.receivingHistory.length === 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200"
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={actionLoading}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const newId = await actions.duplicate();
                    if (newId) { onClose(); }
                  }}
                  disabled={actionLoading}
                >
                  <Copy className="h-4 w-4 mr-1" /> Duplicate
                </Button>
                {actionLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Receiving Dialog */}
      {opo && (
        <OPOReceivingDialog
          open={showReceiveDialog}
          onClose={() => setShowReceiveDialog(false)}
          opo={opo}
          onReceive={async (receipt) => {
            await actions.receive(receipt);
            setShowReceiveDialog(false);
          }}
        />
      )}

      {/* Material Dispatch Dialog */}
      {opo && (
        <OPOMaterialDispatchDialog
          open={showDispatchDialog}
          onClose={() => setShowDispatchDialog(false)}
          opo={opo}
          onDispatch={async (input) => {
            await actions.dispatchMaterials(input);
            setShowDispatchDialog(false);
          }}
        />
      )}

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={(o) => { if (!o) { setShowRejectDialog(false); setRejectReason(''); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject OPO</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Reason <span className="text-destructive">*</span></Label>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRejectDialog(false); setRejectReason(''); }}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || actionLoading}
              onClick={async () => {
                await wrapAction(() => actions.reject(user?.displayName ?? 'Reviewer', rejectReason));
                setShowRejectDialog(false);
                setRejectReason('');
              }}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revert Confirmation */}
      <AlertDialog open={showRevertDialog} onOpenChange={setShowRevertDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revert OPO Receipt</AlertDialogTitle>
            <AlertDialogDescription>
              This will reverse all inventory movements: finished goods will be removed from the
              ship-to warehouse and consumed ingredients will be restored at the tracking warehouse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => wrapAction(actions.revert)}
            >
              Revert Receipt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete OPO</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete this outsourced order? All ingredient reservations will be released.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={async () => { await wrapAction(actions.delete); onClose(); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
