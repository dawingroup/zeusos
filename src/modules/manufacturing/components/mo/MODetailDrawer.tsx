/**
 * Manufacturing Order Detail Drawer
 * Side panel view of full MO detail with BOM, stage tracker, and actions
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Play,
  SkipForward,
  CheckCircle,
  Pause,
  XCircle,
  ShoppingCart,
  Package,
  BadgeCheck,
  Pencil,
  Plus,
  Trash2,
  Save,
  AlertTriangle,
  X,
  RefreshCw,
  Layers,
  FileText,
  Truck,
  ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  findSimilarInventoryItems,
  type SimilarInventoryItem,
} from '../../services/inventoryIntegrationService';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/core/components/ui/sheet';
import { useManufacturingOrder } from '../../hooks/useManufacturingOrder';
import { useBOMStockLevels } from '../../hooks/useBOMStockLevels';
import { useProcurementRequirements } from '@/modules/procurement/hooks/useProcurementRequirements';
import { useWarehouses } from '@/modules/inventory/hooks/useWarehouses';
import { MO_STAGES, MO_STAGE_LABELS, MO_STATUS_LABELS } from '../../types';
import type { BOMEntry, ManufacturingOrderStatus } from '../../types';
import { PROCUREMENT_STATUS_LABELS } from '@/modules/procurement/types/procurement';
import type { ProcurementRequirementStatus } from '@/modules/procurement/types/procurement';
import { useAuth } from '@/shared/hooks/useAuth';
import { MaterialConsumptionDialog } from './MaterialConsumptionDialog';
import { QCInspectionDialog } from './QCInspectionDialog';
import { MOCloseoutDialog } from './MOCloseoutDialog';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { sendShortagesToProcurement } from '../../services/procurementRequirementService';
import { cleanArrayForFirestore } from '../../services/manufacturingOrderService';
import { RagBadge, Banner } from '@/shared/components/data-display';

type DrawerTone = 'green' | 'amber' | 'red' | 'blue' | 'na';

const STATUS_TONE: Record<ManufacturingOrderStatus, DrawerTone> = {
  draft: 'na',
  'pending-approval': 'amber',
  approved: 'blue',
  'in-progress': 'blue',
  'on-hold': 'red',
  'partially-complete': 'amber',
  completed: 'green',
  'closed-out': 'green',
  cancelled: 'na',
};

const PROCURED_ITEM_STATUS_TONE: Record<string, DrawerTone> = {
  pending: 'na',
  ordered: 'blue',
  received: 'green',
  installed: 'green',
};

const PRIORITY_TONE: Record<'low' | 'medium' | 'high' | 'urgent', DrawerTone> = {
  low: 'na',
  medium: 'blue',
  high: 'amber',
  urgent: 'red',
};

const PROCUREMENT_STATUS_TONE: Record<ProcurementRequirementStatus, DrawerTone> = {
  pending: 'amber',
  'added-to-po': 'blue',
  ordered: 'blue',
  received: 'green',
  cancelled: 'na',
};

interface MODetailDrawerProps {
  moId: string | null;
  open: boolean;
  onClose: () => void;
}

export function MODetailDrawer({ moId, open, onClose }: MODetailDrawerProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { order, loading, error, actions } = useManufacturingOrder(moId, user?.uid ?? '');
  const { requirements: procurementReqs } = useProcurementRequirements({
    subsidiaryId: 'finishes',
    filters: { moId: moId ?? undefined },
  });
  const { warehouses } = useWarehouses('finishes');
  const { stockMap, resolvedIds, loading: stockLoading } = useBOMStockLevels(order?.bom ?? null);
  const [actionLoading, setActionLoading] = useState(false);

  // Dialog states
  const [stageNotes, setStageNotes] = useState('');
  const [showAdvanceDialog, setShowAdvanceDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [approveWarehouseId, setApproveWarehouseId] = useState(warehouses[0]?.id ?? '');
  const [showHoldDialog, setShowHoldDialog] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [shortageAlert, setShortageAlert] = useState<string | null>(null);
  const [showConsumeDialog, setShowConsumeDialog] = useState(false);
  const [showQCDialog, setShowQCDialog] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  // Auto-select first warehouse when warehouses load
  useEffect(() => {
    if (warehouses.length > 0 && !approveWarehouseId) {
      setApproveWarehouseId(warehouses[0].id);
    }
  }, [warehouses, approveWarehouseId]);

  // BOM editing state
  const [bomEditing, setBomEditing] = useState(false);
  const [editedBom, setEditedBom] = useState<BOMEntry[]>([]);
  const [bomSaving, setBomSaving] = useState(false);

  // Delete state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Closeout state
  const [showCloseoutDialog, setShowCloseoutDialog] = useState(false);

  // Procurement push state
  const [procurementPushing, setProcurementPushing] = useState(false);
  const [procurementResult, setProcurementResult] = useState<{ created: number; skipped: number } | null>(null);

  // BOM substitution state
  const [substitutionEntry, setSubstitutionEntry] = useState<BOMEntry | null>(null);
  const [subItems, setSubItems] = useState<SimilarInventoryItem[]>([]);
  const [subLoading, setSubLoading] = useState(false);
  const [subSearch, setSubSearch] = useState('');
  const [subSelectedId, setSubSelectedId] = useState<string | null>(null);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
      // Reset all state
      setShowAdvanceDialog(false);
      setShowApproveDialog(false);
      setShowHoldDialog(false);
      setShowCancelDialog(false);
      setShowConsumeDialog(false);
      setShowQCDialog(false);
      setShowDeleteDialog(false);
      setBomEditing(false);
      setSubstitutionEntry(null);
      setSubItems([]);
      setSubSearch('');
      setSubSelectedId(null);
      setShortageAlert(null);
      setApproveError(null);
      setStageNotes('');
      setHoldReason('');
      setCancelReason('');
    }
  };

  const handleApprove = async () => {
    if (!approveWarehouseId || !order) return;
    setActionLoading(true);
    setApproveError(null);
    try {
      const result = await actions.approve(approveWarehouseId);
      if (!result.success && result.shortages.length > 0) {
        setShortageAlert(
          result.shortages
            .map((s) => `${s.itemName}: need ${s.required}, have ${s.available}`)
            .join('\n'),
        );
      }
      setShowApproveDialog(false);
    } catch (e) {
      setApproveError((e as Error).message || 'Approval failed');
    }
    setActionLoading(false);
  };

  const handleAdvanceStage = async () => {
    setActionLoading(true);
    try {
      await actions.advanceStage(stageNotes || undefined);
      setShowAdvanceDialog(false);
      setStageNotes('');
    } catch {
      // Error handled by hook
    }
    setActionLoading(false);
  };

  const handleHold = async () => {
    if (!holdReason.trim()) return;
    setActionLoading(true);
    try {
      await actions.hold(holdReason);
      setShowHoldDialog(false);
      setHoldReason('');
    } catch {
      // Error handled by hook
    }
    setActionLoading(false);
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) return;
    setActionLoading(true);
    try {
      await actions.cancel(cancelReason);
      setShowCancelDialog(false);
      setCancelReason('');
    } catch {
      // Error handled by hook
    }
    setActionLoading(false);
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await actions.delete();
      onClose();
      navigate('/manufacturing/orders');
    } catch {
      // Error handled by hook
    }
    setDeleteLoading(false);
  };

  const handleSubstitute = async (bomEntryId: string, newItem: SimilarInventoryItem) => {
    if (!order) return;
    try {
      const updatedBom = order.bom.map((entry) => {
        if (entry.id !== bomEntryId) return entry;
        return {
          ...entry,
          inventoryItemId: newItem.id,
          sku: newItem.sku,
          itemName: newItem.displayName || newItem.name,
          category: newItem.category,
          unitCost: newItem.unitCost,
          totalCost: newItem.unitCost * entry.quantityRequired,
          notes: `Substituted from "${entry.itemName}" — ${newItem.matchReason}`,
        };
      });
      const materialCost = updatedBom.reduce((s, e) => s + e.totalCost, 0);
      await updateDoc(doc(db, 'manufacturingOrders', order.id), {
        bom: cleanArrayForFirestore(updatedBom),
        'costSummary.materialCost': materialCost,
        'costSummary.totalCost': materialCost,
        updatedAt: new Date(),
        updatedBy: user?.uid ?? '',
      });
    } catch (e) {
      console.error('Substitution failed:', e);
    } finally {
      setSubstitutionEntry(null);
    }
  };

  const handleSaveBom = async () => {
    if (!order) return;
    setBomSaving(true);
    try {
      const recalculated = editedBom.map((e) => ({
        ...e,
        totalCost: e.quantityRequired * e.unitCost,
      }));
      await updateDoc(doc(db, 'manufacturingOrders', order.id), {
        bom: cleanArrayForFirestore(recalculated),
        'costSummary.materialCost': recalculated.reduce((s, e) => s + e.totalCost, 0),
        'costSummary.totalCost': recalculated.reduce((s, e) => s + e.totalCost, 0),
        updatedAt: new Date(),
        updatedBy: user?.uid ?? '',
      });
      setBomEditing(false);
    } catch (e) {
      setShortageAlert((e as Error).message);
    } finally {
      setBomSaving(false);
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
      return <Banner tone="danger" title="Manufacturing order not found" />;
    }

    const currentStageIndex = MO_STAGES.indexOf(order.currentStage);
    const canDelete =
      (['draft', 'cancelled'].includes(order.status)) &&
      (!order.materialConsumptions || order.materialConsumptions.length === 0);
    const canSubstitute = ['draft', 'approved', 'in-progress', 'partially-complete'].includes(order.status);

    return (
      <div className="space-y-5">
        {/* Status & Priority Badges */}
        <div className="flex items-center gap-2">
          <RagBadge tone={STATUS_TONE[order.status]}>
            {MO_STATUS_LABELS[order.status]}
          </RagBadge>
          <RagBadge tone={PRIORITY_TONE[order.priority]}>
            {order.priority.charAt(0).toUpperCase() + order.priority.slice(1)}
          </RagBadge>
        </div>

        {/* Sales Order & Batch Info */}
        {(order.salesOrderId || order.batchId || order.projectPhase || order.demandSource) && (
          <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
            {order.salesOrderId && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Sales Order
                </span>
                <Link
                  to={`/sales-orders/${order.salesOrderId}`}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  View SO <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}
            {order.projectPhase && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Project Phase</span>
                <span className="text-xs font-medium text-gray-700">{order.projectPhase}</span>
              </div>
            )}
            {order.batchId && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Layers className="h-3 w-3" /> Batch
                </span>
                <span className="text-xs font-medium text-gray-700">
                  {order.batchSequence ? `#${order.batchSequence}` : ''}{' '}
                  {order.batchQuantity && order.totalQuantityRequired
                    ? `(${order.batchQuantity} of ${order.totalQuantityRequired} total)`
                    : ''}
                </span>
              </div>
            )}
            {order.demandSource && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Demand Source</span>
                <span className="text-xs font-medium text-gray-700 capitalize">
                  {order.demandSource.type.replace(/_/g, ' ')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Completion Progress (for batch/partial MOs) */}
        {(order.completedQuantity != null || order.scrapQuantity != null || order.status === 'partially-complete') && (
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Completion Progress</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Target Quantity</span>
                <span className="font-medium text-gray-900">{order.batchQuantity ?? order.quantity}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Completed</span>
                <span className="font-medium text-green-700">{order.completedQuantity ?? 0}</span>
              </div>
              {(order.scrapQuantity ?? 0) > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Scrapped</span>
                  <span className="font-medium text-red-600">{order.scrapQuantity}</span>
                </div>
              )}
              {/* Progress bar */}
              {(() => {
                const target = order.batchQuantity ?? order.quantity;
                const completed = order.completedQuantity ?? 0;
                const pct = target > 0 ? Math.round((completed / target) * 100) : 0;
                return (
                  <div className="pt-1">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct > 0 ? 'bg-teal-500' : 'bg-gray-300'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-gray-500 text-right mt-0.5">{pct}%</div>
                  </div>
                );
              })()}
              {/* Completion Lots */}
              {order.completionLots && order.completionLots.length > 0 && (
                <div className="pt-2 border-t border-gray-100">
                  <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Completion Lots</h4>
                  <div className="space-y-1">
                    {order.completionLots.map((lot) => (
                      <div key={lot.id} className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{lot.quantity} units</span>
                          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
                            lot.qualityStatus === 'passed' ? 'bg-green-100 text-green-700' :
                            lot.qualityStatus === 'failed' ? 'bg-red-100 text-red-700' :
                            lot.qualityStatus === 'conditionally_passed' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {lot.qualityStatus.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <span className="text-gray-400">
                          {lot.completedAt && typeof (lot.completedAt as any).seconds === 'number'
                            ? new Date((lot.completedAt as any).seconds * 1000).toLocaleDateString()
                            : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Shortage Alert */}
        {shortageAlert && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-yellow-800 mb-1 text-sm">Material Shortages Detected</h4>
              <p className="text-yellow-700 whitespace-pre-line text-xs">{shortageAlert}</p>
            </div>
            <button onClick={() => setShortageAlert(null)} className="text-yellow-600 hover:text-yellow-800">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Stage Tracker */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Production Stage</h3>
          <div className="flex items-center justify-between">
            {MO_STAGES.map((stage, index) => {
              const isCompleted = index < currentStageIndex;
              const isCurrent = index === currentStageIndex;
              return (
                <div key={stage} className="flex-1 flex flex-col items-center relative">
                  {index > 0 && (
                    <div
                      className={`absolute left-0 top-3 w-1/2 h-0.5 -translate-x-1/2 ${
                        isCompleted ? 'bg-primary' : 'bg-gray-200'
                      }`}
                    />
                  )}
                  {index < MO_STAGES.length - 1 && (
                    <div
                      className={`absolute right-0 top-3 w-1/2 h-0.5 translate-x-1/2 ${
                        isCompleted ? 'bg-primary' : 'bg-gray-200'
                      }`}
                    />
                  )}
                  <div
                    className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      isCompleted
                        ? 'bg-primary text-white'
                        : isCurrent
                          ? 'bg-primary/20 text-primary border-2 border-primary'
                          : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {isCompleted ? <CheckCircle className="h-3 w-3" /> : index + 1}
                  </div>
                  <span
                    className={`mt-1 text-[10px] font-medium ${
                      isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-400'
                    }`}
                  >
                    {MO_STAGE_LABELS[stage]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {order.status === 'draft' && (
            <button
              onClick={() => {
                setApproveWarehouseId(warehouses[0]?.id ?? '');
                setShowApproveDialog(true);
              }}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {actionLoading ? (
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
              ) : (
                <CheckCircle className="h-3.5 w-3.5" />
              )}
              Approve & Reserve
            </button>
          )}
          {order.status === 'approved' && (
            <button
              onClick={async () => {
                setActionLoading(true);
                await actions.startProduction();
                setActionLoading(false);
              }}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              Start Production
            </button>
          )}
          {['in-progress', 'partially-complete'].includes(order.status) && order.currentStage !== 'ready' && (
            <button
              onClick={() => setShowAdvanceDialog(true)}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <SkipForward className="h-3.5 w-3.5" />
              Advance Stage
            </button>
          )}
          {['in-progress', 'partially-complete'].includes(order.status) && (
            <button
              onClick={() => setShowHoldDialog(true)}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors disabled:opacity-50"
            >
              <Pause className="h-3.5 w-3.5" />
              Hold
            </button>
          )}
          {order.status === 'on-hold' && (
            <button
              onClick={async () => {
                setActionLoading(true);
                await actions.resume();
                setActionLoading(false);
              }}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              Resume
            </button>
          )}
          {['in-progress', 'partially-complete'].includes(order.status) && (
            <button
              onClick={() => setShowConsumeDialog(true)}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Package className="h-3.5 w-3.5" />
              Consume
            </button>
          )}
          {['in-progress', 'partially-complete'].includes(order.status) && order.currentStage === 'qc' && (
            <button
              onClick={() => setShowQCDialog(true)}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50"
            >
              <BadgeCheck className="h-3.5 w-3.5" />
              Record QC
            </button>
          )}
          {order.status === 'completed' && (
            <button
              onClick={() => setShowCloseoutDialog(true)}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Close Out
            </button>
          )}
          {!['completed', 'closed-out', 'cancelled'].includes(order.status) && (
            <button
              onClick={() => setShowCancelDialog(true)}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancel
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => setShowDeleteDialog(true)}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          )}
        </div>

        {/* BOM Stock Availability Summary */}
        {!stockLoading && order.bom.length > 0 && (() => {
          // Include both directly-linked and name-resolved BOM entries
          const bomWithStock = order.bom.filter(e => {
            if (e.offcutId) return true; // Offcut-backed entries are always in stock
            const eid = e.inventoryItemId || resolvedIds[e.id];
            return eid && !eid.includes(':');
          });
          const getAvail = (e: BOMEntry) => {
            if (e.offcutId) return e.quantityRequired; // Offcuts are always available
            const eid = e.inventoryItemId || resolvedIds[e.id];
            return eid ? (stockMap[eid]?.totalAvailable ?? 0) : 0;
          };
          const inStockCount = bomWithStock.filter(e => getAvail(e) >= e.quantityRequired).length;
          const partialCount = bomWithStock.filter(e => {
            const avail = getAvail(e);
            return avail > 0 && avail < e.quantityRequired;
          }).length;
          const outOfStockCount = bomWithStock.filter(e => getAvail(e) <= 0).length;
          const totalShortageValue = bomWithStock.reduce((sum, e) => {
            const avail = getAvail(e);
            const short = Math.max(0, e.quantityRequired - avail);
            return sum + short * e.unitCost;
          }, 0);

          const allReady = partialCount === 0 && outOfStockCount === 0;

          return (
            <div className={`rounded-lg border p-3 flex items-center gap-3 ${
              allReady ? 'bg-green-50 border-green-200' :
              outOfStockCount > 0 ? 'bg-red-50 border-red-200' :
              'bg-amber-50 border-amber-200'
            }`}>
              <Package className={`h-5 w-5 flex-shrink-0 ${
                allReady ? 'text-green-600' :
                outOfStockCount > 0 ? 'text-red-600' :
                'text-amber-600'
              }`} />
              <div className="flex-1">
                <div className="flex items-center gap-3 text-xs font-medium">
                  <span className="text-green-700">{inStockCount} in stock</span>
                  {partialCount > 0 && <span className="text-amber-700">{partialCount} partial</span>}
                  {outOfStockCount > 0 && <span className="text-red-700">{outOfStockCount} out of stock</span>}
                </div>
                {totalShortageValue > 0 && (
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    Shortage value: {totalShortageValue.toLocaleString()} {order.costSummary.currency} — only shortages need procurement
                  </div>
                )}
                {allReady && (
                  <div className="text-[10px] text-green-700 mt-0.5">
                    All materials available — no procurement needed
                  </div>
                )}
              </div>
              <div className="text-[10px] text-gray-400 flex-shrink-0">LIVE</div>
            </div>
          );
        })()}

        {/* BOM Table */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-3 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-gray-900">Bill of Materials</h3>
            {['draft', 'approved'].includes(order.status) && !bomEditing && (
              <button
                onClick={() => {
                  setEditedBom(order.bom.map((e) => ({ ...e })));
                  setBomEditing(true);
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Pencil className="h-3 w-3" />
                Edit BOM
              </button>
            )}
            {bomEditing && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() =>
                    setEditedBom((prev) => [
                      ...prev,
                      {
                        id: `BOM-${Date.now()}`,
                        inventoryItemId: '',
                        sku: '',
                        itemName: '',
                        category: '',
                        quantityRequired: 0,
                        unit: 'pcs',
                        unitCost: 0,
                        totalCost: 0,
                      },
                    ])
                  }
                  className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Add
                </button>
                <button
                  onClick={() => setBomEditing(false)}
                  className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveBom}
                  disabled={bomSaving}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {bomSaving ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                  ) : (
                    <Save className="h-3 w-3" />
                  )}
                  Save
                </button>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12">Pri</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Planned</th>
                  {!bomEditing && (
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">In Stock</th>
                  )}
                  {!bomEditing && (
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Consumed</th>
                  )}
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Cost</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  {!bomEditing && (
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Variance</th>
                  )}
                  {!bomEditing && canSubstitute && <th className="px-3 py-2 w-8" />}
                  {bomEditing && <th className="px-3 py-2 w-8" />}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {bomEditing ? (
                  editedBom.map((entry, idx) => (
                    <tr key={entry.id}>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={entry.itemName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditedBom((prev) => prev.map((b, i) => (i === idx ? { ...b, itemName: val } : b)));
                          }}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={entry.category}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditedBom((prev) => prev.map((b, i) => (i === idx ? { ...b, category: val } : b)));
                          }}
                          className="w-20 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={entry.quantityRequired}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setEditedBom((prev) =>
                              prev.map((b, i) =>
                                i === idx ? { ...b, quantityRequired: val, totalCost: val * b.unitCost } : b,
                              ),
                            );
                          }}
                          className="w-16 px-2 py-1 border border-gray-200 rounded text-xs text-right focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={entry.unit}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditedBom((prev) => prev.map((b, i) => (i === idx ? { ...b, unit: val } : b)));
                          }}
                          className="w-12 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={entry.unitCost}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setEditedBom((prev) =>
                              prev.map((b, i) =>
                                i === idx ? { ...b, unitCost: val, totalCost: b.quantityRequired * val } : b,
                              ),
                            );
                          }}
                          className="w-20 px-2 py-1 border border-gray-200 rounded text-xs text-right focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-gray-900">
                        {(entry.quantityRequired * entry.unitCost).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => setEditedBom((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  order.bom.map((entry) => {
                    const consumed = order.materialConsumptions
                      .filter((c) => c.bomEntryId === entry.id || (!c.bomEntryId && c.inventoryItemId === entry.inventoryItemId))
                      .reduce((sum, c) => sum + c.quantityConsumed, 0);
                    const pct = entry.quantityRequired > 0 ? Math.round((consumed / entry.quantityRequired) * 100) : 0;
                    const varianceQty = consumed - entry.quantityRequired;
                    const varianceCost = varianceQty * entry.unitCost;

                    // Live stock availability — check direct link or name-resolved link
                    const effectiveItemId = entry.inventoryItemId || resolvedIds[entry.id];
                    const stock = effectiveItemId ? stockMap[effectiveItemId] : null;
                    const available = stock?.totalAvailable ?? 0;
                    const shortage = Math.max(0, entry.quantityRequired - available);
                    const hasLink = !!effectiveItemId;
                    const stockStatus: 'in_stock' | 'partial' | 'out_of_stock' | 'unknown' =
                      !hasLink ? 'unknown'
                        : stockLoading ? 'unknown'
                        : available >= entry.quantityRequired ? 'in_stock'
                        : available > 0 ? 'partial'
                        : 'out_of_stock';

                    return (
                      <tr key={entry.id} className={
                        stockStatus === 'in_stock' ? 'bg-green-50/40' :
                        stockStatus === 'out_of_stock' ? 'bg-red-50/40' :
                        ''
                      }>
                        <td className="px-3 py-2 text-center">
                          {entry.purchasePriority != null ? (
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${
                              entry.prioritySource === 'manufacturing'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-gray-100 text-gray-600'
                            }`} title={`Source: ${entry.prioritySource ?? 'design'}`}>
                              {entry.purchasePriority + 1}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="text-xs text-gray-900">{entry.itemName}</div>
                          {entry.sku && <div className="text-[10px] text-gray-400">{entry.sku}</div>}
                          {!stockLoading && hasLink && (
                            <span className={`inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
                              stockStatus === 'in_stock'
                                ? 'bg-green-100 text-green-700'
                                : stockStatus === 'partial'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-red-100 text-red-700'
                            }`}>
                              <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                                stockStatus === 'in_stock' ? 'bg-green-500' :
                                stockStatus === 'partial' ? 'bg-amber-500' :
                                'bg-red-500'
                              }`} />
                              {stockStatus === 'in_stock' ? 'In Stock' :
                               stockStatus === 'partial' ? 'Partial' :
                               'Out of Stock'}
                            </span>
                          )}
                          {!stockLoading && !hasLink && (
                            <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-500">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400" />
                              Not in inventory
                            </span>
                          )}
                          {!stockLoading && !entry.inventoryItemId && resolvedIds[entry.id] && (
                            <div className="text-[10px] text-blue-500 mt-0.5">↳ Auto-matched to inventory</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">{entry.category}</td>
                        <td className="px-3 py-2 text-xs text-gray-900 text-right">{entry.quantityRequired}</td>
                        {/* Live Stock Availability */}
                        <td className="px-3 py-2">
                          {stockLoading ? (
                            <div className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400" />
                            </div>
                          ) : !hasLink ? (
                            <span className="text-xs text-gray-400 block text-center">—</span>
                          ) : (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={`text-xs font-medium ${
                                stockStatus === 'in_stock' ? 'text-green-700' :
                                stockStatus === 'partial' ? 'text-amber-700' :
                                'text-red-600'
                              }`}>
                                {available} avail
                              </span>
                              {shortage > 0 && (
                                <span className="text-[10px] text-red-500 font-medium">
                                  -{shortage} short
                                </span>
                              )}
                              <div className="w-14 bg-gray-200 rounded-full h-1">
                                <div
                                  className={`h-1 rounded-full ${
                                    stockStatus === 'in_stock' ? 'bg-green-500' :
                                    stockStatus === 'partial' ? 'bg-amber-500' :
                                    'bg-red-500'
                                  }`}
                                  style={{ width: `${entry.quantityRequired > 0 ? Math.min(100, (available / entry.quantityRequired) * 100) : 0}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-xs text-gray-900">{consumed} / {entry.quantityRequired}</span>
                            <div className="w-16 bg-gray-200 rounded-full h-1">
                              <div
                                className={`h-1 rounded-full ${
                                  pct > 100 ? 'bg-red-500' : pct >= 100 ? 'bg-green-500' : pct > 0 ? 'bg-amber-500' : 'bg-gray-300'
                                }`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">{entry.unit}</td>
                        <td className="px-3 py-2 text-xs text-gray-900 text-right">{entry.unitCost.toLocaleString()}</td>
                        <td className="px-3 py-2 text-xs text-gray-900 text-right">{entry.totalCost.toLocaleString()}</td>
                        <td className="px-3 py-2 text-xs text-right">
                          {consumed === 0 ? (
                            <span className="text-gray-400">—</span>
                          ) : varianceQty === 0 ? (
                            <span className="text-green-600 font-medium">On target</span>
                          ) : varianceQty > 0 ? (
                            <span className="text-red-600 font-medium">
                              +{varianceQty} ({varianceCost > 0 ? `+${varianceCost.toLocaleString()}` : ''})
                            </span>
                          ) : (
                            <span className="text-blue-600 font-medium">
                              {varianceQty} ({varianceCost.toLocaleString()})
                            </span>
                          )}
                        </td>
                        {canSubstitute && (
                          <td className="px-3 py-2">
                            <button
                              onClick={() => {
                                setSubstitutionEntry(entry);
                                setSubSelectedId(null);
                                setSubSearch('');
                                setSubLoading(true);
                                findSimilarInventoryItems(entry)
                                  .then((results) => setSubItems(results))
                                  .catch(() => setSubItems([]))
                                  .finally(() => setSubLoading(false));
                              }}
                              title="Substitute with similar item"
                              className="p-1 text-gray-400 hover:text-primary hover:bg-gray-100 rounded transition-colors"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
                {(bomEditing ? editedBom : order.bom).length === 0 && (
                  <tr>
                    <td colSpan={bomEditing ? 7 : 9} className="px-3 py-6 text-center text-gray-500 text-xs">
                      No BOM entries
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cost Summary */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Cost Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Materials (Planned)</span>
              <span className="text-gray-900">
                {order.costSummary.materialCost.toLocaleString()} {order.costSummary.currency}
              </span>
            </div>
            {order.materialConsumptions.length > 0 && (() => {
              const actualMaterialCost = order.bom.reduce((total, entry) => {
                const consumed = order.materialConsumptions
                  .filter((c) => c.bomEntryId === entry.id || (!c.bomEntryId && c.inventoryItemId === entry.inventoryItemId))
                  .reduce((sum, c) => sum + c.quantityConsumed, 0);
                return total + consumed * entry.unitCost;
              }, 0);
              const variance = actualMaterialCost - order.costSummary.materialCost;
              return (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Materials (Actual)</span>
                    <span className={variance > 0 ? 'text-red-600 font-medium' : variance < 0 ? 'text-blue-600 font-medium' : 'text-green-600 font-medium'}>
                      {actualMaterialCost.toLocaleString()} {order.costSummary.currency}
                    </span>
                  </div>
                  {variance !== 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Material Variance</span>
                      <span className={variance > 0 ? 'text-red-600' : 'text-blue-600'}>
                        {variance > 0 ? '+' : ''}{variance.toLocaleString()} {order.costSummary.currency}
                      </span>
                    </div>
                  )}
                </>
              );
            })()}
            {order.costSummary.laborCost > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Labor (legacy)</span>
                <span className="text-gray-900">
                  {order.costSummary.laborCost.toLocaleString()} {order.costSummary.currency}
                </span>
              </div>
            )}
            <hr className="my-1" />
            <div className="flex justify-between font-semibold">
              <span>Total (Planned)</span>
              <span>
                {order.costSummary.totalCost.toLocaleString()} {order.costSummary.currency}
              </span>
            </div>
          </div>
        </div>

        {/* Material Reservations */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">
              Material Reservations ({order.materialReservations.length})
            </h3>
          </div>
          {order.materialReservations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Reserved</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {order.materialReservations.map((res) => (
                    <tr key={res.id}>
                      <td className="px-3 py-2 text-xs text-gray-900">{res.inventoryItemId}</td>
                      <td className="px-3 py-2 text-xs text-gray-900 text-right">{res.quantityReserved}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            res.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : res.status === 'consumed'
                                ? 'bg-gray-100 text-gray-600'
                                : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {res.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-3 text-gray-500 text-xs">No materials reserved yet</div>
          )}
        </div>

        {/* Procurement — Live Needs + Existing Requirements */}
        {(() => {
          // Helper to get effective inventory item ID (direct link or name-resolved)
          const getEffectiveId = (e: BOMEntry) => e.inventoryItemId || resolvedIds[e.id] || '';
          const getStockAvail = (itemId: string) => itemId ? (stockMap[itemId]?.totalAvailable ?? 0) : 0;

          // Build live shortage list from real-time stock data
          // Include both directly-linked and name-resolved entries
          const liveShortages = !stockLoading ? order.bom
            .filter((e) => {
              if (e.offcutId) return false; // Offcut-backed entries have no shortage
              const eid = getEffectiveId(e);
              return eid && !eid.includes(':');
            })
            .map((e) => {
              const eid = getEffectiveId(e);
              const avail = getStockAvail(eid);
              const shortage = Math.max(0, e.quantityRequired - avail);
              return { ...e, available: avail, shortage, effectiveItemId: eid };
            })
            .filter((e) => e.shortage > 0) : [];

          // Items without inventoryItemId AND not resolved by name
          const unmappedItems = order.bom.filter((e) => !e.inventoryItemId && !resolvedIds[e.id]);

          // Match existing procurement reqs to BOM entries (by bomEntryId first, then by inventoryItemId)
          const procReqByBomEntry = new Map<string, typeof procurementReqs[number]>();
          for (const req of procurementReqs) {
            if (req.bomEntryId) procReqByBomEntry.set(req.bomEntryId, req);
          }
          const procReqByItemId = new Map<string, typeof procurementReqs[number]>();
          for (const req of procurementReqs) {
            if (req.inventoryItemId && !procReqByBomEntry.has(req.bomEntryId ?? '')) {
              procReqByItemId.set(req.inventoryItemId, req);
            }
          }

          const hasContent = liveShortages.length > 0 || unmappedItems.length > 0 || procurementReqs.length > 0;
          if (!hasContent) return null;

          return (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-3 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-sm font-semibold text-gray-900">
                  Procurement Needs
                  {!stockLoading && (
                    <span className="ml-1.5 text-[10px] font-normal text-gray-400">LIVE</span>
                  )}
                </h3>
                <div className="flex items-center gap-1.5">
                  {/* Send shortages to procurement queue */}
                  {liveShortages.length > 0 && (
                    <button
                      onClick={async () => {
                        if (!order || !user?.uid) return;
                        setProcurementPushing(true);
                        setProcurementResult(null);
                        try {
                          const shortageData = liveShortages.map((e) => ({
                            bomEntryId: e.id,
                            itemName: e.itemName,
                            sku: e.sku,
                            inventoryItemId: e.effectiveItemId,
                            shortageQuantity: e.shortage,
                            availableQuantity: e.available,
                            requiredQuantity: e.quantityRequired,
                            unit: e.unit,
                            unitCost: e.unitCost,
                            category: e.category,
                            supplierId: e.supplierId,
                            supplierName: e.supplierName,
                          }));
                          // Also include unmapped items as shortages
                          for (const unmapped of unmappedItems) {
                            shortageData.push({
                              bomEntryId: unmapped.id,
                              itemName: unmapped.itemName,
                              sku: unmapped.sku,
                              inventoryItemId: '',
                              shortageQuantity: unmapped.quantityRequired,
                              availableQuantity: 0,
                              requiredQuantity: unmapped.quantityRequired,
                              unit: unmapped.unit,
                              unitCost: unmapped.unitCost,
                              category: unmapped.category,
                              supplierId: unmapped.supplierId,
                              supplierName: unmapped.supplierName,
                            });
                          }
                          const result = await sendShortagesToProcurement(
                            order.id,
                            shortageData,
                            user.uid,
                          );
                          setProcurementResult({ created: result.created, skipped: result.skipped });
                        } catch (e) {
                          console.error('Failed to send to procurement:', e);
                          setShortageAlert(`Failed to send to procurement: ${(e as Error).message}`);
                        } finally {
                          setProcurementPushing(false);
                        }
                      }}
                      disabled={procurementPushing}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {procurementPushing ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                      ) : (
                        <ShoppingCart className="h-3 w-3" />
                      )}
                      Send to Procurement
                    </button>
                  )}
                  <Link
                    to="/manufacturing/procurement"
                    className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <ShoppingCart className="h-3 w-3" />
                    Dashboard
                  </Link>
                </div>
              </div>
              {/* Procurement push result */}
              {procurementResult && (
                <div className="px-3 py-2 bg-green-50 border-b border-green-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-green-700">
                      {procurementResult.created > 0
                        ? `✓ ${procurementResult.created} item(s) sent to procurement queue`
                        : 'All shortage items already have procurement requirements'}
                      {procurementResult.skipped > 0 && ` (${procurementResult.skipped} already tracked)`}
                    </span>
                    <button
                      onClick={() => setProcurementResult(null)}
                      className="text-green-600 hover:text-green-800"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Required</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">In Stock</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">To Procure</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Est. Cost</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PO</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {/* Items with live stock shortages */}
                    {liveShortages.map((entry) => {
                      const existingReq = procReqByBomEntry.get(entry.id) ?? procReqByItemId.get(entry.effectiveItemId);
                      return (
                        <tr key={entry.id}>
                          <td className="px-3 py-2">
                            <div className="text-xs text-gray-900">{entry.itemName}</div>
                            <div className="text-[10px] text-gray-400">{entry.sku}</div>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-900 text-right">{entry.quantityRequired}</td>
                          <td className="px-3 py-2 text-xs text-right">
                            <span className={entry.available > 0 ? 'text-amber-600' : 'text-red-600'}>
                              {entry.available}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-right font-medium text-red-700">{entry.shortage}</td>
                          <td className="px-3 py-2 text-xs text-gray-900 text-right">
                            {(entry.shortage * entry.unitCost).toLocaleString()}
                          </td>
                          <td className="px-3 py-2">
                            {existingReq ? (
                              <RagBadge tone={PROCUREMENT_STATUS_TONE[existingReq.status]}>
                                {PROCUREMENT_STATUS_LABELS[existingReq.status]}
                              </RagBadge>
                            ) : (
                              <RagBadge tone="red">Needs PO</RagBadge>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {existingReq?.poId ? (
                              <Link
                                to={`/manufacturing/purchase-orders?selected=${existingReq.poId}`}
                                className="text-primary text-xs hover:underline"
                              >
                                View PO
                              </Link>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Unmapped items (no inventory link — always need procurement) */}
                    {unmappedItems.map((entry) => (
                      <tr key={entry.id}>
                        <td className="px-3 py-2">
                          <div className="text-xs text-gray-900">{entry.itemName}</div>
                          <div className="text-[10px] text-gray-400">No inventory link</div>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-900 text-right">{entry.quantityRequired}</td>
                        <td className="px-3 py-2 text-xs text-gray-400 text-right">—</td>
                        <td className="px-3 py-2 text-xs text-right font-medium text-red-700">{entry.quantityRequired}</td>
                        <td className="px-3 py-2 text-xs text-gray-900 text-right">{entry.totalCost.toLocaleString()}</td>
                        <td className="px-3 py-2">
                          <RagBadge tone="na">Unmapped</RagBadge>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-gray-400 text-xs">—</span>
                        </td>
                      </tr>
                    ))}

                    {/* Existing procurement reqs that don't match a live shortage (e.g. already fully stocked but PO was already raised) */}
                    {procurementReqs
                      .filter((req) => {
                        const matchesShortage = liveShortages.some(
                          (s) => s.id === req.bomEntryId || s.effectiveItemId === req.inventoryItemId,
                        );
                        const matchesUnmapped = unmappedItems.some((u) => u.id === req.bomEntryId);
                        return !matchesShortage && !matchesUnmapped;
                      })
                      .map((req) => {
                        const bomEntry = order.bom.find((b) => b.id === req.bomEntryId);
                        // Use resolved ID if available for stock lookup
                        const reqEffectiveId = req.inventoryItemId || (bomEntry ? resolvedIds[bomEntry.id] : '') || '';
                        const avail = getStockAvail(reqEffectiveId);
                        return (
                          <tr key={req.id} className="bg-green-50/50">
                            <td className="px-3 py-2">
                              <div className="text-xs text-gray-900">{req.itemDescription}</div>
                              {avail > 0 && (
                                <div className="text-[10px] text-green-600">Now in stock ({avail} avail)</div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-900 text-right">
                              {bomEntry?.quantityRequired ?? req.quantityRequired}
                            </td>
                            <td className="px-3 py-2 text-xs text-right">
                              <span className="text-green-600">{avail}</span>
                            </td>
                            <td className="px-3 py-2 text-xs text-right text-gray-500">{req.quantityRequired}</td>
                            <td className="px-3 py-2 text-xs text-gray-900 text-right">{req.estimatedTotalCost.toLocaleString()}</td>
                            <td className="px-3 py-2">
                              <RagBadge tone={PROCUREMENT_STATUS_TONE[req.status]}>
                                {PROCUREMENT_STATUS_LABELS[req.status]}
                              </RagBadge>
                            </td>
                            <td className="px-3 py-2">
                              {req.poId ? (
                                <Link
                                  to={`/manufacturing/purchase-orders?selected=${req.poId}`}
                                  className="text-primary text-xs hover:underline"
                                >
                                  View PO
                                </Link>
                              ) : (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                    {liveShortages.length === 0 && unmappedItems.length === 0 && procurementReqs.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-green-600 text-xs font-medium">
                          All materials in stock — no procurement needed
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {/* Totals row */}
                  {(liveShortages.length > 0 || unmappedItems.length > 0) && (
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td className="px-3 py-2 text-xs font-semibold text-gray-700" colSpan={3}>
                          Total to Procure
                        </td>
                        <td className="px-3 py-2 text-xs font-semibold text-red-700 text-right">
                          {liveShortages.reduce((s, e) => s + e.shortage, 0) +
                            unmappedItems.reduce((s, e) => s + e.quantityRequired, 0)} items
                        </td>
                        <td className="px-3 py-2 text-xs font-semibold text-gray-900 text-right">
                          {(
                            liveShortages.reduce((s, e) => s + e.shortage * e.unitCost, 0) +
                            unmappedItems.reduce((s, e) => s + e.totalCost, 0)
                          ).toLocaleString()}{' '}
                          {order.costSummary.currency}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          );
        })()}

        {/* Procured Items */}
        {order.procuredItems && order.procuredItems.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                <Truck className="h-4 w-4 text-gray-500" />
                Procured Items ({order.procuredItems.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Received</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {order.procuredItems.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2">
                          <div className="text-xs text-gray-900">{item.name}</div>
                          {item.supplier && <div className="text-[10px] text-gray-400">{item.supplier}</div>}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-900 text-right">{item.quantity} {item.unit}</td>
                        <td className="px-3 py-2 text-xs text-right">
                          <span
                            style={{
                              color:
                                item.receivedQuantity && item.receivedQuantity >= item.quantity
                                  ? 'var(--rag-green)'
                                  : 'var(--fg-secondary)',
                              fontWeight:
                                item.receivedQuantity && item.receivedQuantity >= item.quantity ? 500 : 400,
                            }}
                          >
                            {item.receivedQuantity ?? 0}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-900 text-right">{item.totalCost.toLocaleString()}</td>
                        <td className="px-3 py-2">
                          <RagBadge tone={PROCURED_ITEM_STATUS_TONE[item.status] ?? 'na'}>
                            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                          </RagBadge>
                        </td>
                      </tr>
                    ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td className="px-3 py-2 text-xs font-semibold text-gray-700" colSpan={3}>Total Procured</td>
                    <td className="px-3 py-2 text-xs font-semibold text-gray-900 text-right">
                      {order.procuredItems.reduce((s, i) => s + i.totalCost, 0).toLocaleString()}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Linked Purchase Orders */}
        {order.linkedPOIds && order.linkedPOIds.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Linked Purchase Orders ({order.linkedPOIds.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {order.linkedPOIds.map((poId) => (
                <Link
                  key={poId}
                  to={`/manufacturing/purchase-orders?selected=${poId}`}
                  className="px-3 py-1 text-xs border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
                >
                  PO: {poId.slice(0, 8)}...
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-3xl lg:max-w-4xl overflow-y-auto">
          <SheetHeader className="pb-3 border-b border-gray-100 mb-4">
            <SheetTitle>{order?.moNumber ?? 'Manufacturing Order'}</SheetTitle>
            <SheetDescription>
              {order?.projectId && order?.designItemId ? (
                <Link
                  to={`/design/project/${order.projectId}/item/${order.designItemId}`}
                  className="hover:underline"
                >
                  {order.designItemName} — {order.projectCode}
                </Link>
              ) : (
                order ? `${order.designItemName} — ${order.projectCode}` : 'Loading...'
              )}
            </SheetDescription>
          </SheetHeader>
          {renderContent()}

          {/* Dialogs rendered INSIDE SheetContent so they are within the Radix portal tree */}
          {/* (Radix Sheet blocks pointer-events on elements outside its portal) */}

          {/* Approve Dialog */}
          {showApproveDialog && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Approve & Reserve Materials</h3>
                </div>
                <div className="p-4 space-y-4">
                  <p className="text-sm text-gray-600">
                    Select the warehouse to reserve materials from for this manufacturing order.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse</label>
                    <select
                      value={approveWarehouseId}
                      onChange={(e) => setApproveWarehouseId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                      {warehouses.length === 0 && (
                        <option value="" disabled>No warehouses available</option>
                      )}
                    </select>
                  </div>
                  {approveError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                      {approveError}
                    </div>
                  )}
                  {warehouses.length === 0 && (
                    <p className="text-sm text-amber-600">No warehouses found. Create a warehouse in Inventory first.</p>
                  )}
                </div>
                <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
                  <button onClick={() => { setShowApproveDialog(false); setApproveError(null); }} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                  <button onClick={handleApprove} disabled={!approveWarehouseId || actionLoading} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50">
                    {actionLoading ? 'Approving...' : 'Approve'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Advance Stage Dialog */}
          {showAdvanceDialog && order && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Advance to {order.currentStage !== 'ready' && MO_STAGE_LABELS[MO_STAGES[MO_STAGES.indexOf(order.currentStage) + 1]]}
                  </h3>
                </div>
                <div className="p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stage Notes (optional)</label>
                  <textarea
                    value={stageNotes}
                    onChange={(e) => setStageNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
                  <button onClick={() => setShowAdvanceDialog(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                  <button onClick={handleAdvanceStage} disabled={actionLoading} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">Advance</button>
                </div>
              </div>
            </div>
          )}

          {/* Hold Dialog */}
          {showHoldDialog && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Put Order on Hold</h3>
                </div>
                <div className="p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Hold <span className="text-red-500">*</span></label>
                  <textarea
                    value={holdReason}
                    onChange={(e) => setHoldReason(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
                  <button onClick={() => setShowHoldDialog(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                  <button onClick={handleHold} disabled={!holdReason.trim() || actionLoading} className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50">Put on Hold</button>
                </div>
              </div>
            </div>
          )}

          {/* Cancel Dialog */}
          {showCancelDialog && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Cancel Manufacturing Order</h3>
                </div>
                <div className="p-4 space-y-4">
                  <p className="text-sm text-gray-600">
                    This will cancel the manufacturing order and release any material reservations. This action cannot be undone.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cancellation Reason <span className="text-red-500">*</span></label>
                    <textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>
                <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
                  <button onClick={() => setShowCancelDialog(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Keep Order</button>
                  <button onClick={handleCancel} disabled={!cancelReason.trim() || actionLoading} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">Cancel Order</button>
                </div>
              </div>
            </div>
          )}

          {/* BOM Substitution Dialog */}
          {substitutionEntry && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Substitute BOM Item</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Replace <span className="font-medium text-gray-700">{substitutionEntry.itemName}</span> with a similar item
                  </p>
                </div>

                {/* Current Item */}
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Current Item</div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-gray-900">{substitutionEntry.itemName}</span>
                      {substitutionEntry.sku && (
                        <span className="ml-2 text-xs text-gray-500">({substitutionEntry.sku})</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      {substitutionEntry.quantityRequired} {substitutionEntry.unit} @ {substitutionEntry.unitCost.toLocaleString()}/unit
                    </div>
                  </div>
                </div>

                {/* Search */}
                <div className="px-4 py-3 border-b border-gray-200">
                  <input
                    type="text"
                    value={subSearch}
                    onChange={(e) => setSubSearch(e.target.value)}
                    placeholder="Filter by name, SKU, brand..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                {/* Results */}
                <div className="flex-1 overflow-y-auto">
                  {subLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400" />
                      <span className="ml-2 text-sm text-gray-500">Finding similar items...</span>
                    </div>
                  ) : (() => {
                    const filtered = subSearch
                      ? subItems.filter(
                          (item) =>
                            item.name.toLowerCase().includes(subSearch.toLowerCase()) ||
                            item.sku.toLowerCase().includes(subSearch.toLowerCase()) ||
                            (item.brand ?? '').toLowerCase().includes(subSearch.toLowerCase()) ||
                            (item.subcategory ?? '').toLowerCase().includes(subSearch.toLowerCase()),
                        )
                      : subItems;

                    if (filtered.length === 0) {
                      return (
                        <div className="text-center py-12 text-gray-500 text-sm">
                          {subSearch ? 'No matching items found. Try a different search.' : 'No similar items found in inventory.'}
                        </div>
                      );
                    }

                    return (
                      <div className="divide-y divide-gray-100">
                        {filtered.map((item) => {
                          const isSelected = subSelectedId === item.id;
                          const costDiff = item.unitCost - substitutionEntry.unitCost;
                          const totalDiff = costDiff * substitutionEntry.quantityRequired;

                          return (
                            <button
                              key={item.id}
                              onClick={() => setSubSelectedId(isSelected ? null : item.id)}
                              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                                isSelected ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : ''
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    {isSelected && (
                                      <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                                    )}
                                    <span className="text-sm font-medium text-gray-900 truncate">
                                      {item.displayName || item.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs text-gray-500">{item.sku}</span>
                                    {item.brand && (
                                      <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">{item.brand}</span>
                                    )}
                                    {item.subcategory && (
                                      <span className="text-xs text-gray-400">{item.subcategory}</span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-400 mt-1">{item.matchReason}</div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <div className="text-sm font-medium text-gray-900">
                                    {item.unitCost.toLocaleString()} {item.currency}/{item.unit}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5 justify-end">
                                    <Package className="h-3 w-3 text-gray-400" />
                                    <span className={`text-xs font-medium ${item.inStock > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                      {item.inStock > 0 ? `${item.inStock} in stock` : 'Out of stock'}
                                    </span>
                                  </div>
                                  {costDiff !== 0 && (
                                    <div className={`text-xs mt-0.5 ${costDiff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                      {costDiff > 0 ? '+' : ''}{totalDiff.toLocaleString()} total
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    {subItems.length} similar item{subItems.length !== 1 ? 's' : ''} found
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setSubstitutionEntry(null); setSubItems([]); setSubSearch(''); setSubSelectedId(null); }}
                      className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        const selected = subItems.find((i) => i.id === subSelectedId);
                        if (!selected || !substitutionEntry) return;
                        handleSubstitute(substitutionEntry.id, selected);
                        setSubItems([]);
                        setSubSearch('');
                        setSubSelectedId(null);
                      }}
                      disabled={!subSelectedId}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 text-sm"
                    >
                      Substitute Item
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Delete Confirmation Dialog */}
          {showDeleteDialog && order && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Delete Manufacturing Order</h3>
                </div>
                <div className="p-4">
                  <p className="text-sm text-gray-600">
                    Are you sure you want to permanently delete <strong>{order.moNumber}</strong> ({order.designItemName ?? order.itemName})?
                    This action cannot be undone.
                  </p>
                </div>
                <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
                  <button
                    onClick={() => setShowDeleteDialog(false)}
                    disabled={deleteLoading}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleteLoading}
                    className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {deleteLoading ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </SheetContent>
      </Sheet>

      {/* These use their own Radix Dialog portals, so they work outside the Sheet */}
      {showConsumeDialog && order && (
        <MaterialConsumptionDialog
          open={showConsumeDialog}
          onClose={() => setShowConsumeDialog(false)}
          order={order}
          warehouses={warehouses}
          onConsume={actions.consumeMaterials}
        />
      )}

      {showQCDialog && order && (
        <QCInspectionDialog
          open={showQCDialog}
          onClose={() => setShowQCDialog(false)}
          order={order}
          userId={user?.uid ?? ''}
          onRecordQC={actions.recordQC}
        />
      )}

      {showCloseoutDialog && order && (
        <MOCloseoutDialog
          open={showCloseoutDialog}
          onClose={() => setShowCloseoutDialog(false)}
          order={order}
          userId={user?.uid ?? ''}
          onClosedOut={() => {
            setShowCloseoutDialog(false);
          }}
        />
      )}

    </>
  );
}
