/**
 * Manufacturing Order Detail Page
 * Full MO view with BOM, parts, stage tracker, and actions
 * Styled to match DawinOS Finishes design system
 *
 * Consolidated: includes stock-level badges, substitution dialog,
 * delete MO, and live procurement needs from the drawer component.
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
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
  ArrowLeft,
  AlertTriangle,
  X,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { useManufacturingOrder } from '../hooks/useManufacturingOrder';
import { useRecordTracker } from '@/core/hooks/useRecordTracker';
import { useProcurementRequirements } from '../hooks/useProcurementRequirements';
import { useBOM } from '../hooks/useBOM';
import { useBOMStockLevels } from '../hooks/useBOMStockLevels';
import { useItemReservations } from '../hooks/useItemReservations';
import {
  findSimilarInventoryItems,
  type SimilarInventoryItem,
} from '../services/inventoryIntegrationService';
import { useWarehouses } from '@/modules/inventory/hooks/useWarehouses';
import { MO_STAGES, MO_STAGE_LABELS, MO_STATUS_LABELS, COMPLETION_DISPOSITION_LABELS, INSTALLATION_STATUS_LABELS } from '../types';
import type { BOMEntry, ManufacturingOrderStatus, CompletionDisposition } from '../types';
import { PROCUREMENT_STATUS_LABELS } from '../types/procurement';
import type { ProcurementRequirementStatus } from '../types/procurement';
import { useAuth } from '@/shared/hooks/useAuth';
import { MaterialConsumptionDialog } from '../components/mo/MaterialConsumptionDialog';
import { QCInspectionDialog } from '../components/mo/QCInspectionDialog';
import { MOCloseoutDialog } from '../components/mo/MOCloseoutDialog';
import { updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { syncRequirementsWithBOM } from '../services/procurementRequirementService';
import { cleanArrayForFirestore } from '../services/manufacturingOrderService';
import { syncMOToCOGS, syncQuoteToInvoice } from '@/modules/finance/services/qboSyncService';
import { useMOCascadeTree } from '../hooks/useMOCascadeTree';
import MOCascadeBadge from '../components/mo/MOCascadeBadge';
import MOCascadeTreePanel from '../components/mo/MOCascadeTreePanel';
import { CrossModuleEntityTabs } from '@/shared/components/navigation/CrossModuleEntityTabs';

const STATUS_CONFIG: Record<ManufacturingOrderStatus, { bg: string; text: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700' },
  'pending-approval': { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  approved: { bg: 'bg-blue-100', text: 'text-blue-700' },
  'in-progress': { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  'on-hold': { bg: 'bg-red-100', text: 'text-red-700' },
  'partially-complete': { bg: 'bg-teal-100', text: 'text-teal-700' },
  completed: { bg: 'bg-green-100', text: 'text-green-700' },
  'closed-out': { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-500' },
};

const PRIORITY_CONFIG = {
  low: { bg: 'bg-gray-100', text: 'text-gray-600' },
  medium: { bg: 'bg-blue-100', text: 'text-blue-700' },
  high: { bg: 'bg-amber-100', text: 'text-amber-700' },
  urgent: { bg: 'bg-red-100', text: 'text-red-700' },
};

const PROCUREMENT_STATUS_CONFIG: Record<ProcurementRequirementStatus, { bg: string; text: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  'added-to-po': { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  ordered: { bg: 'bg-blue-100', text: 'text-blue-700' },
  received: { bg: 'bg-green-100', text: 'text-green-700' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-500' },
};

export default function ManufacturingOrderDetailPage() {
  const { orderId: moId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { order: rawOrder, loading, error, actions } = useManufacturingOrder(moId ?? null, user?.uid ?? '');
  // Log this record for the Global Search palette's recency boost + empty state.
  useRecordTracker({
    type: 'manufacturing_order',
    id: rawOrder?.id,
    title: (rawOrder as { moNumber?: string } | null | undefined)?.moNumber ?? '',
    subtitle: (rawOrder as { productName?: string } | null | undefined)?.productName,
    module: 'manufacturing',
  });
  const { bomLines: subcollectionBom } = useBOM(moId ?? null);
  const { tree: cascadeTree, loading: cascadeLoading } = useMOCascadeTree(moId ?? null);

  const designProjectRefId = rawOrder?.designProjectId ?? rawOrder?.projectId ?? undefined;
  const [resolvedDealId, setResolvedDealId] = useState<string | null>(null);

  useEffect(() => {
    if (!designProjectRefId) {
      setResolvedDealId(null);
      return;
    }
    let cancelled = false;
    getDoc(doc(db, 'designProjects', designProjectRefId))
      .then((snap) => {
        if (cancelled || !snap.exists()) return;
        const did = snap.data().dealId;
        setResolvedDealId(typeof did === 'string' && did.length > 0 ? did : null);
      })
      .catch(() => {
        if (!cancelled) setResolvedDealId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [designProjectRefId]);

  // Merge: if inline bom is empty but subcollection has data, convert subcollection BOM to inline format
  const order = useMemo(() => {
    if (!rawOrder) return null;
    if (rawOrder.bom && rawOrder.bom.length > 0) return rawOrder;
    if (subcollectionBom.length === 0) return rawOrder;
    // Convert BOMLine (subcollection) to BOMEntry (inline) format
    const convertedBom: BOMEntry[] = subcollectionBom.map((line) => ({
      id: line.id,
      inventoryItemId: line.inventoryItemId ?? '',
      sku: (line as unknown as Record<string, unknown>).materialCode as string ?? '',
      itemName: line.materialName,
      category: line.category === 'sheet_material' ? 'sheet-goods'
        : line.category === 'linear_material' ? 'timber'
        : line.category as string,
      quantityRequired: line.requiredQuantity,
      unit: line.unit,
      unitCost: line.unitCost,
      totalCost: line.totalEstimatedCost,
    }));
    return { ...rawOrder, bom: convertedBom };
  }, [rawOrder, subcollectionBom]);

  const { requirements: procurementReqs } = useProcurementRequirements({
    subsidiaryId: 'finishes',
    filters: { moId: moId ?? undefined },
  });
  const { warehouses } = useWarehouses('finishes');
  const { stockMap, resolvedIds, loading: stockLoading } = useBOMStockLevels(order?.bom ?? null);

  // Collect all inventory item IDs from BOM to look up who reserved them
  const bomInventoryItemIds = useMemo(() => {
    if (!order?.bom) return [];
    const ids = new Set<string>();
    for (const e of order.bom) {
      const eid = e.inventoryItemId || resolvedIds[e.id];
      if (eid && !eid.includes(':') && !e.offcutId) ids.add(eid);
    }
    return [...ids];
  }, [order?.bom, resolvedIds]);
  const { reservationMap, loading: reservationsLoading } = useItemReservations(bomInventoryItemIds, moId ?? undefined, order?.subsidiaryId);

  const [actionLoading, setActionLoading] = useState(false);

  // Dialog states
  const [stageNotes, setStageNotes] = useState('');
  const [showAdvanceDialog, setShowAdvanceDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [approveWarehouseId, setApproveWarehouseId] = useState('');
  const [approveError, setApproveError] = useState<string | null>(null);
  const [showHoldDialog, setShowHoldDialog] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [shortageAlert, setShortageAlert] = useState<string | null>(null);
  const [showConsumeDialog, setShowConsumeDialog] = useState(false);

  // Completion disposition state
  const [completionDisposition, setCompletionDisposition] = useState<CompletionDisposition>('site_installation');
  const [completionWarehouseLocation, setCompletionWarehouseLocation] = useState('');
  const [completionInstallationNotes, setCompletionInstallationNotes] = useState('');
  const [showQCDialog, setShowQCDialog] = useState(false);

  // Delete state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Closeout state
  const [showCloseoutDialog, setShowCloseoutDialog] = useState(false);

  // QBO sync state
  const [qboSyncing, setQboSyncing] = useState<'invoice' | 'cogs' | null>(null);
  const [quoteInvoiceStatus, setQuoteInvoiceStatus] = useState<{
    synced: boolean; qboInvoiceId?: string; qboInvoiceDocNumber?: string; quoteId?: string;
  } | null>(null);

  // Fetch invoice status from quote (invoice lives on quote, not MO)
  useEffect(() => {
    if (!order) return;
    if (!['completed', 'closed-out'].includes(order.status) || !order.projectId) return;
    if ((order as any).qboInvoiceId) {
      setQuoteInvoiceStatus({ synced: true, qboInvoiceId: (order as any).qboInvoiceId, qboInvoiceDocNumber: (order as any).qboInvoiceDocNumber });
      return;
    }
    (async () => {
      try {
        const { getDocs, query: fbQuery, collection: fbCollection, where, limit: fbLimit, orderBy: fbOrderBy } = await import('firebase/firestore');
        const q = fbQuery(fbCollection(db, 'clientQuotes'), where('projectId', '==', order.projectId), where('status', '==', 'approved'), fbOrderBy('createdAt', 'desc'), fbLimit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const quote = snap.docs[0].data();
          setQuoteInvoiceStatus({
            synced: !!quote.qboInvoiceId,
            qboInvoiceId: quote.qboInvoiceId,
            qboInvoiceDocNumber: quote.qboInvoiceDocNumber,
            quoteId: snap.docs[0].id,
          });
        }
      } catch (err) {
        console.warn('Failed to fetch quote invoice status:', err);
      }
    })();
  }, [order?.status, order?.projectId, (order as any)?.qboInvoiceId]);

  // Order date editing state
  const [orderDateEditing, setOrderDateEditing] = useState(false);
  const [orderDateValue, setOrderDateValue] = useState('');

  // BOM editing state
  const [bomEditing, setBomEditing] = useState(false);
  const [editedBom, setEditedBom] = useState<BOMEntry[]>([]);
  const [bomSaving, setBomSaving] = useState(false);

  // BOM substitution state
  const [substitutionEntry, setSubstitutionEntry] = useState<BOMEntry | null>(null);
  const [subItems, setSubItems] = useState<SimilarInventoryItem[]>([]);
  const [subLoading, setSubLoading] = useState(false);
  const [subSearch, setSubSearch] = useState('');
  const [subSelectedId, setSubSelectedId] = useState<string | null>(null);

  // Auto-select first warehouse when warehouses load
  useEffect(() => {
    if (warehouses.length > 0 && !approveWarehouseId) {
      setApproveWarehouseId(warehouses[0].id);
    }
  }, [warehouses, approveWarehouseId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Manufacturing order not found
        </div>
      </div>
    );
  }

  const currentStageIndex = MO_STAGES.indexOf(order.currentStage);
  const statusConfig = STATUS_CONFIG[order.status];
  const priorityConfig = PRIORITY_CONFIG[order.priority];
  const canDelete =
    (['draft', 'cancelled'].includes(order.status)) &&
    (!order.materialConsumptions || order.materialConsumptions.length === 0);
  const canSubstitute = ['draft', 'approved'].includes(order.status);

  const handleApprove = async () => {
    if (!approveWarehouseId) return;
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

  const isAdvancingToReady = order && MO_STAGES[MO_STAGES.indexOf(order.currentStage) + 1] === 'ready';

  const handleAdvanceStage = async () => {
    setActionLoading(true);
    try {
      const completionData = isAdvancingToReady
        ? {
            disposition: completionDisposition,
            warehouseLocation: completionDisposition === 'finished_goods' ? completionWarehouseLocation || undefined : undefined,
            installationNotes: completionDisposition === 'site_installation' ? completionInstallationNotes || undefined : undefined,
          }
        : undefined;
      await actions.advanceStage(stageNotes || undefined, completionData);
      setShowAdvanceDialog(false);
      setStageNotes('');
      setCompletionDisposition('site_installation');
      setCompletionWarehouseLocation('');
      setCompletionInstallationNotes('');
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

      // Sync procurement requirements with the updated BOM
      try {
        const syncResult = await syncRequirementsWithBOM(order.id, recalculated, user?.uid ?? '');
        if (syncResult.skippedNonPending.length > 0) {
          setShortageAlert(
            `BOM saved. Note: ${syncResult.skippedNonPending.length} procurement requirement(s) could not be updated because they are already on a Purchase Order.`,
          );
        }
      } catch (syncError) {
        console.warn('Failed to sync procurement requirements:', syncError);
        setShortageAlert(
          'BOM saved, but procurement requirements could not be synced automatically.',
        );
      }

      setBomEditing(false);
    } catch (e) {
      setShortageAlert((e as Error).message);
    } finally {
      setBomSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header — title left, cross-module tabs + status badges on the right */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <Link
            to="/manufacturing/orders"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
          >
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{order.moNumber}</h1>
              <MOCascadeBadge
                mo={order}
                parentMO={cascadeTree?.parent ?? null}
                childCount={cascadeTree?.children.length ?? 0}
                salesOrderId={order.salesOrderId ?? null}
              />
            </div>
            {order.projectId && order.designItemId ? (
              <Link
                to={`/design/project/${order.projectId}/item/${order.designItemId}`}
                className="text-muted-foreground hover:underline"
              >
                {order.designItemName} — {order.projectCode}
              </Link>
            ) : (
              <p className="text-muted-foreground">
                {order.designItemName} — {order.projectCode}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <span>Order Date:</span>
              {orderDateEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={orderDateValue}
                    onChange={(e) => setOrderDateValue(e.target.value)}
                    className="h-7 w-40 px-2 border border-gray-300 rounded text-sm"
                  />
                  <button
                    onClick={async () => {
                      try {
                        await updateDoc(doc(db, 'manufacturingOrders', order.id), {
                          orderDate: new Date(orderDateValue),
                          updatedAt: new Date(),
                        });
                        setOrderDateEditing(false);
                      } catch (e) {
                        setShortageAlert((e as Error).message);
                      }
                    }}
                    className="text-green-600 hover:text-green-800"
                  >
                    <Save className="h-4 w-4" />
                  </button>
                  <button onClick={() => setOrderDateEditing(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setOrderDateValue(
                      order.orderDate
                        ? new Date((order.orderDate as any).seconds * 1000).toISOString().split('T')[0]
                        : new Date().toISOString().split('T')[0]
                    );
                    setOrderDateEditing(true);
                  }}
                  className="flex items-center gap-1 hover:text-gray-700"
                >
                  {order.orderDate
                    ? new Date((order.orderDate as any).seconds * 1000).toLocaleDateString()
                    : 'Not set'}
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end xl:flex-row xl:items-center xl:gap-3 shrink-0">
          <CrossModuleEntityTabs
            links={{
              dealId: resolvedDealId,
              designProjectId: order.designProjectId ?? order.projectId,
              salesOrderId: order.salesOrderId,
              manufacturingOrderId: order.id,
            }}
            className="w-fit"
          />
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${statusConfig.bg} ${statusConfig.text}`}>
              {MO_STATUS_LABELS[order.status]}
            </span>
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${priorityConfig.bg} ${priorityConfig.text}`}>
              {order.priority.charAt(0).toUpperCase() + order.priority.slice(1)}
            </span>
            {order.completionDisposition && (
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                order.completionDisposition === 'site_installation'
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}>
                {order.completionDisposition === 'site_installation' ? '🏗️ ' : '📦 '}
                {COMPLETION_DISPOSITION_LABELS[order.completionDisposition]}
                {order.installationStatus && ` — ${INSTALLATION_STATUS_LABELS[order.installationStatus]}`}
                {order.warehouseLocation && ` — ${order.warehouseLocation}`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* CO Cascade Tree — hidden when MO has no cascade relationships */}
      <MOCascadeTreePanel tree={cascadeTree} loading={cascadeLoading} />

      {/* Project & Order Info Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {Boolean((order as unknown as Record<string, unknown>).projectName) && (
            <div>
              <span className="text-gray-500 block">Project</span>
              <Link to={`/design/project/${order.projectId}`} className="font-medium text-primary hover:underline">
                {(order as unknown as Record<string, unknown>).projectName as string}
              </Link>
              {order.projectCode && <span className="text-xs text-gray-400 ml-1">({order.projectCode})</span>}
            </div>
          )}
          {Boolean((order as unknown as Record<string, unknown>).customerName) && (
            <div>
              <span className="text-gray-500 block">Customer</span>
              <span className="font-medium text-gray-900">{(order as unknown as Record<string, unknown>).customerName as string}</span>
            </div>
          )}
          <div>
            <span className="text-gray-500 block">Quantity</span>
            <span className="font-medium text-gray-900">{order.quantity ?? 1}</span>
          </div>
          {order.dueDate && (
            <div>
              <span className="text-gray-500 block">Due Date</span>
              <span className="font-medium text-gray-900">
                {(() => {
                  const d = order.dueDate as any;
                  if (typeof d?.toDate === 'function') return d.toDate().toLocaleDateString();
                  if (d?.seconds) return new Date(d.seconds * 1000).toLocaleDateString();
                  return String(d);
                })()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Shortage Alert */}
      {shortageAlert && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-yellow-800 mb-1">Material Shortages Detected</h4>
            <p className="text-yellow-700 whitespace-pre-line text-sm">{shortageAlert}</p>
          </div>
          <button onClick={() => setShortageAlert(null)} className="text-yellow-600 hover:text-yellow-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Stage Tracker */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Production Stage</h2>
        <div className="flex items-center justify-between">
          {MO_STAGES.map((stage, index) => {
            const isCompleted = index < currentStageIndex;
            const isCurrent = index === currentStageIndex;
            return (
              <div key={stage} className="flex-1 flex flex-col items-center relative">
                {/* Connector line */}
                {index > 0 && (
                  <div
                    className={`absolute left-0 top-4 w-1/2 h-0.5 -translate-x-1/2 ${
                      isCompleted ? 'bg-primary' : 'bg-gray-200'
                    }`}
                  />
                )}
                {index < MO_STAGES.length - 1 && (
                  <div
                    className={`absolute right-0 top-4 w-1/2 h-0.5 translate-x-1/2 ${
                      isCompleted ? 'bg-primary' : 'bg-gray-200'
                    }`}
                  />
                )}
                {/* Circle */}
                <div
                  className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    isCompleted
                      ? 'bg-primary text-white'
                      : isCurrent
                        ? 'bg-primary/20 text-primary border-2 border-primary'
                        : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {isCompleted ? <CheckCircle className="h-4 w-4" /> : index + 1}
                </div>
                {/* Label */}
                <span
                  className={`mt-2 text-xs font-medium ${
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
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {actionLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            Approve & Reserve Materials
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
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            Start Production
          </button>
        )}
        {order.status === 'in-progress' && order.currentStage !== 'ready' && (
          <button
            onClick={() => setShowAdvanceDialog(true)}
            disabled={actionLoading}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <SkipForward className="h-4 w-4" />
            Advance Stage
          </button>
        )}
        {order.status === 'in-progress' && (
          <button
            onClick={() => setShowHoldDialog(true)}
            disabled={actionLoading}
            className="flex items-center gap-2 px-4 py-2 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors disabled:opacity-50"
          >
            <Pause className="h-4 w-4" />
            Put on Hold
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
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            Resume
          </button>
        )}
        {order.status === 'in-progress' && (
          <button
            onClick={() => setShowConsumeDialog(true)}
            disabled={actionLoading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Package className="h-4 w-4" />
            Consume Materials
          </button>
        )}
        {order.status === 'in-progress' && order.currentStage === 'qc' && (
          <button
            onClick={() => setShowQCDialog(true)}
            disabled={actionLoading}
            className="flex items-center gap-2 px-4 py-2 border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50"
          >
            <BadgeCheck className="h-4 w-4" />
            Record QC
          </button>
        )}
        {order.status === 'completed' && (
          <button
            onClick={() => setShowCloseoutDialog(true)}
            disabled={actionLoading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            <CheckCircle className="h-4 w-4" />
            Close Out
          </button>
        )}
        {!['completed', 'closed-out', 'cancelled'].includes(order.status) && (
          <button
            onClick={() => setShowCancelDialog(true)}
            disabled={actionLoading}
            className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" />
            Cancel Order
          </button>
        )}
        {canDelete && (
          <button
            onClick={() => setShowDeleteDialog(true)}
            disabled={actionLoading}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        )}
      </div>

      {/* QBO Sync Status — shown for completed/closed-out orders */}
      {['completed', 'closed-out'].includes(order.status) && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">QuickBooks Sync</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Invoice Sync — checks both MO and linked quote for invoice status */}
            <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
              <div>
                <p className="text-sm font-medium">Invoice</p>
                {(quoteInvoiceStatus?.synced || (order as any).qboInvoiceId) ? (
                  <p className="text-xs text-green-600">
                    Synced — #{quoteInvoiceStatus?.qboInvoiceDocNumber || (order as any).qboInvoiceDocNumber || quoteInvoiceStatus?.qboInvoiceId || (order as any).qboInvoiceId}
                  </p>
                ) : (order as any).qboInvoiceSyncStatus === 'error' ? (
                  <p className="text-xs text-red-600">Error: {(order as any).qboInvoiceSyncError}</p>
                ) : (order as any).qboInvoiceSyncStatus === 'skipped' ? (
                  <p className="text-xs text-amber-600">Skipped: {(order as any).qboInvoiceSyncSkipReason}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Pending</p>
                )}
              </div>
              {(quoteInvoiceStatus?.synced || (order as any).qboInvoiceId) ? (
                <a
                  href={`https://app.qbo.intuit.com/app/invoice?txnId=${quoteInvoiceStatus?.qboInvoiceId || (order as any).qboInvoiceId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open in QBO
                </a>
              ) : !quoteInvoiceStatus?.synced && !(order as any).qboInvoiceId && (
                <button
                  onClick={async () => {
                    setQboSyncing('invoice');
                    try {
                      const { getDocs, getDoc, query, collection, where, limit: fbLimit, doc: fbDoc, updateDoc, serverTimestamp } = await import('firebase/firestore');
                      const quoteId = quoteInvoiceStatus?.quoteId;
                      let resolvedQuoteId = quoteId;
                      if (!resolvedQuoteId) {
                        const q = query(collection(db, 'clientQuotes'), where('projectId', '==', order.projectId), where('status', '==', 'approved'), fbLimit(1));
                        const snap = await getDocs(q);
                        if (snap.empty) { alert('No approved quote found for this project'); return; }
                        resolvedQuoteId = snap.docs[0].id;
                      }
                      await syncQuoteToInvoice(resolvedQuoteId);
                      // Write invoice ID back to MO
                      const quoteSnap = await getDoc(fbDoc(db, 'clientQuotes', resolvedQuoteId));
                      const quoteData = quoteSnap.data();
                      if (quoteData?.qboInvoiceId) {
                        await updateDoc(fbDoc(db, 'manufacturingOrders', order.id), {
                          qboInvoiceId: quoteData.qboInvoiceId,
                          qboInvoiceDocNumber: quoteData.qboInvoiceDocNumber || '',
                          invoicedAt: serverTimestamp(),
                        });
                        setQuoteInvoiceStatus({
                          synced: true,
                          qboInvoiceId: quoteData.qboInvoiceId,
                          qboInvoiceDocNumber: quoteData.qboInvoiceDocNumber,
                          quoteId: resolvedQuoteId,
                        });
                      }
                    } catch (err: any) {
                      alert(`Invoice sync failed: ${err.message}`);
                    } finally {
                      setQboSyncing(null);
                    }
                  }}
                  disabled={qboSyncing !== null || !order.projectId}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs border rounded-md hover:bg-accent disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${qboSyncing === 'invoice' ? 'animate-spin' : ''}`} />
                  Retry
                </button>
              )}
            </div>

            {/* COGS Sync */}
            <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
              <div>
                <p className="text-sm font-medium">COGS Journal</p>
                {(order as any).qboJournalEntryId ? (
                  <p className="text-xs text-green-600">
                    Synced — #{(order as any).qboJournalEntryDocNumber || (order as any).qboJournalEntryId}
                  </p>
                ) : (order as any).qboSyncStatus === 'error' ? (
                  <p className="text-xs text-red-600">Error: {(order as any).qboSyncError}</p>
                ) : (order as any).qboSyncStatus === 'skipped' ? (
                  <p className="text-xs text-amber-600">Skipped: {(order as any).qboSyncSkipReason}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Pending</p>
                )}
              </div>
              {(order as any).qboJournalEntryId ? (
                <a
                  href={`https://app.qbo.intuit.com/app/journal?txnId=${(order as any).qboJournalEntryId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open in QBO
                </a>
              ) : (
                <button
                  onClick={async () => {
                    setQboSyncing('cogs');
                    try {
                      await syncMOToCOGS(order.id);
                    } catch (err: any) {
                      alert(`COGS sync failed: ${err.message}`);
                    } finally {
                      setQboSyncing(null);
                    }
                  }}
                  disabled={qboSyncing !== null}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs border rounded-md hover:bg-accent disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${qboSyncing === 'cogs' ? 'animate-spin' : ''}`} />
                  Retry
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Closeout Summary — shown for closed-out orders */}
      {order.status === 'closed-out' && (order as any).closeout && (
        <div className="rounded-lg border bg-emerald-50 border-emerald-200 p-4">
          <h3 className="text-sm font-semibold text-emerald-900 mb-2 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            Order Closed Out
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-emerald-700 text-xs font-medium">Routed To</p>
              <p className="text-emerald-900 font-semibold capitalize">
                {((order as any).closeout.routeTo || '').replace('-', ' ')}
              </p>
            </div>
            <div>
              <p className="text-emerald-700 text-xs font-medium">Closed Out By</p>
              <p className="text-emerald-900">
                {(order as any).closeout.closedOutAt
                  ? new Date(
                      (order as any).closeout.closedOutAt.toDate?.()
                        ?? (order as any).closeout.closedOutAt
                    ).toLocaleDateString()
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-emerald-700 text-xs font-medium">COGS Account</p>
              <p className="text-emerald-900">{(order as any).closeout.cogsAccountName || '—'}</p>
            </div>
          </div>
          {(order as any).closeout.closeoutNotes && (
            <p className="text-xs text-emerald-800 mt-2 bg-emerald-100 rounded px-2 py-1">
              {(order as any).closeout.closeoutNotes}
            </p>
          )}
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Stock Availability Summary Banner — hidden for closed-out/cancelled MOs */}
        {!['closed-out', 'cancelled'].includes(order.status) && !stockLoading && order.bom.length > 0 && (() => {
          const bomWithStock = order.bom.filter(e => {
            if (e.offcutId) return true;
            const eid = e.inventoryItemId || resolvedIds[e.id];
            return eid && !eid.includes(':');
          });
          const getAvail = (e: BOMEntry) => {
            if (e.offcutId) return e.quantityRequired;
            const eid = e.inventoryItemId || resolvedIds[e.id];
            return eid ? (stockMap[eid]?.totalAvailable ?? 0) : 0;
          };
          const getReserved = (e: BOMEntry) => {
            if (e.offcutId) return 0;
            const eid = e.inventoryItemId || resolvedIds[e.id];
            return eid ? (stockMap[eid]?.totalReserved ?? 0) : 0;
          };
          const inStockCount = bomWithStock.filter(e => getAvail(e) >= e.quantityRequired).length;
          const partialCount = bomWithStock.filter(e => {
            const avail = getAvail(e);
            return avail > 0 && avail < e.quantityRequired;
          }).length;
          const reservedCount = bomWithStock.filter(e => getAvail(e) <= 0 && getReserved(e) > 0).length;
          const outOfStockCount = bomWithStock.filter(e => getAvail(e) <= 0 && getReserved(e) <= 0).length;
          const totalShortageValue = bomWithStock.reduce((sum, e) => {
            const avail = getAvail(e);
            const short = Math.max(0, e.quantityRequired - avail);
            return sum + short * e.unitCost;
          }, 0);

          const allReady = partialCount === 0 && outOfStockCount === 0 && reservedCount === 0;

          return (
            <div className="lg:col-span-12">
              <div className={`rounded-lg border p-4 flex items-center gap-4 ${
                allReady ? 'bg-green-50 border-green-200' :
                outOfStockCount > 0 ? 'bg-red-50 border-red-200' :
                reservedCount > 0 ? 'bg-blue-50 border-blue-200' :
                'bg-amber-50 border-amber-200'
              }`}>
                <Package className={`h-5 w-5 flex-shrink-0 ${
                  allReady ? 'text-green-600' :
                  outOfStockCount > 0 ? 'text-red-600' :
                  reservedCount > 0 ? 'text-blue-600' :
                  'text-amber-600'
                }`} />
                <div className="flex-1">
                  <div className="flex items-center gap-3 text-sm font-medium">
                    <span className="text-green-700">{inStockCount} in stock</span>
                    {partialCount > 0 && <span className="text-amber-700">{partialCount} partial</span>}
                    {reservedCount > 0 && <span className="text-blue-700">{reservedCount} reserved by MOs</span>}
                    {outOfStockCount > 0 && <span className="text-red-700">{outOfStockCount} out of stock</span>}
                  </div>
                  {reservedCount > 0 && (
                    <div className="text-xs text-blue-600 mt-0.5">
                      {reservedCount} item{reservedCount > 1 ? 's' : ''} held by other manufacturing orders — not truly out of stock
                    </div>
                  )}
                  {totalShortageValue > 0 && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      Shortage value: {totalShortageValue.toLocaleString()} {order.costSummary.currency} — only shortages need procurement
                    </div>
                  )}
                  {allReady && (
                    <div className="text-xs text-green-700 mt-0.5">
                      All materials available — no procurement needed
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-400 flex-shrink-0">LIVE</div>
              </div>
            </div>
          );
        })()}

        {/* BOM Table - Full Width */}
        <div className="lg:col-span-12">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Bill of Materials</h2>
              {['draft', 'approved'].includes(order.status) && !bomEditing && (
                <button
                  onClick={() => {
                    setEditedBom(order.bom.map((e) => ({ ...e })));
                    setBomEditing(true);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Pencil className="h-4 w-4" />
                  Edit BOM
                </button>
              )}
              {bomEditing && (
                <div className="flex items-center gap-2">
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
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Add Entry
                  </button>
                  <button
                    onClick={() => setBomEditing(false)}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveBom}
                    disabled={bomSaving}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {bomSaving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save BOM
                  </button>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Item
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Supplier
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Planned
                    </th>
                    {!bomEditing && (
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        In Stock
                      </th>
                    )}
                    {!bomEditing && (
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Consumed
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Unit
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Unit Cost
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Cost
                    </th>
                    {!bomEditing && (
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Variance
                      </th>
                    )}
                    {!bomEditing && canSubstitute && <th className="px-4 py-3 w-12" />}
                    {bomEditing && <th className="px-4 py-3 w-12" />}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bomEditing ? (
                    editedBom.map((entry, idx) => (
                      <tr key={entry.id}>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={entry.itemName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditedBom((prev) =>
                                prev.map((b, i) => (i === idx ? { ...b, itemName: val } : b)),
                              );
                            }}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={entry.category}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditedBom((prev) =>
                                prev.map((b, i) => (i === idx ? { ...b, category: val } : b)),
                              );
                            }}
                            className="w-24 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-sm">
                          {entry.supplierName ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={entry.quantityRequired}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setEditedBom((prev) =>
                                prev.map((b, i) =>
                                  i === idx
                                    ? { ...b, quantityRequired: val, totalCost: val * b.unitCost }
                                    : b,
                                ),
                              );
                            }}
                            className="w-20 px-2 py-1 border border-gray-200 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={entry.unit}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditedBom((prev) =>
                                prev.map((b, i) => (i === idx ? { ...b, unit: val } : b)),
                              );
                            }}
                            className="w-16 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={entry.unitCost}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setEditedBom((prev) =>
                                prev.map((b, i) =>
                                  i === idx
                                    ? { ...b, unitCost: val, totalCost: b.quantityRequired * val }
                                    : b,
                                ),
                              );
                            }}
                            className="w-24 px-2 py-1 border border-gray-200 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-900">
                          {(entry.quantityRequired * entry.unitCost).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setEditedBom((prev) => prev.filter((_, i) => i !== idx))}
                            className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    order.bom.map((entry) => {
                      // Match consumptions: prefer bomEntryId, fallback to inventoryItemId only for unlinked records
                      const consumed = order.materialConsumptions
                        .filter((c) => c.bomEntryId === entry.id)
                        .reduce((sum, c) => sum + c.quantityConsumed, 0);
                      const pct = entry.quantityRequired > 0 ? Math.round((consumed / entry.quantityRequired) * 100) : 0;
                      const varianceQty = consumed - entry.quantityRequired;
                      const varianceCost = varianceQty * entry.unitCost;

                      // Live stock availability — check direct link or name-resolved link
                      const effectiveItemId = entry.inventoryItemId || resolvedIds[entry.id];
                      const stock = effectiveItemId ? stockMap[effectiveItemId] : null;
                      const available = stock?.totalAvailable ?? 0;
                      const reserved = stock?.totalReserved ?? 0;
                      const shortage = Math.max(0, entry.quantityRequired - available);
                      const hasLink = !!effectiveItemId;

                      // Reservation context: who is holding stock for this item?
                      const holders = (effectiveItemId && !reservationsLoading) ? (reservationMap[effectiveItemId] ?? []) : [];
                      const reservedByThisMO = holders.filter(h => h.moId === moId);
                      const reservedByOtherMOs = holders.filter(h => h.moId !== moId);
                      const thisMOReservedQty = reservedByThisMO.reduce((s, h) => s + h.quantityReserved, 0);
                      const isReservedByOthers = reservedByOtherMOs.length > 0;

                      const stockStatus: 'in_stock' | 'partial' | 'out_of_stock' | 'reserved' | 'unknown' =
                        !hasLink ? 'unknown'
                          : stockLoading ? 'unknown'
                          : available >= entry.quantityRequired ? 'in_stock'
                          : available > 0 ? 'partial'
                          // If available is 0 but there are reservations, it's "reserved" not "out of stock"
                          : reserved > 0 ? 'reserved'
                          : 'out_of_stock';

                      return (
                        <tr key={entry.id} className={
                          stockStatus === 'in_stock' ? 'bg-green-50/40' :
                          stockStatus === 'out_of_stock' ? 'bg-red-50/40' :
                          stockStatus === 'reserved' ? 'bg-blue-50/40' :
                          ''
                        }>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-900">{entry.itemName}</div>
                            {entry.sku && (
                              <div className="text-xs text-gray-400">{entry.sku}</div>
                            )}
                            {!stockLoading && hasLink && (
                              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
                                  stockStatus === 'in_stock'
                                    ? 'bg-green-100 text-green-700'
                                    : stockStatus === 'partial'
                                      ? 'bg-amber-100 text-amber-700'
                                      : stockStatus === 'reserved'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-red-100 text-red-700'
                                }`}>
                                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                                    stockStatus === 'in_stock' ? 'bg-green-500' :
                                    stockStatus === 'partial' ? 'bg-amber-500' :
                                    stockStatus === 'reserved' ? 'bg-blue-500' :
                                    'bg-red-500'
                                  }`} />
                                  {stockStatus === 'in_stock' ? 'In Stock' :
                                   stockStatus === 'partial' ? 'Partial' :
                                   stockStatus === 'reserved' ? 'Reserved' :
                                   'Out of Stock'}
                                </span>
                                {/* Show which MOs hold reservations */}
                                {thisMOReservedQty > 0 && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-green-50 text-green-700 border border-green-200">
                                    {thisMOReservedQty} reserved for this MO
                                  </span>
                                )}
                                {isReservedByOthers && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200"
                                    title={reservedByOtherMOs.map(h => `${h.moNumber}: ${h.quantityReserved}`).join(', ')}
                                  >
                                    {reservedByOtherMOs.reduce((s, h) => s + h.quantityReserved, 0)} held by {reservedByOtherMOs.map(h => h.moNumber).join(', ')}
                                  </span>
                                )}
                              </div>
                            )}
                            {!stockLoading && !hasLink && (
                              <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-500">
                                Not in inventory
                              </span>
                            )}
                            {resolvedIds[entry.id] && !entry.inventoryItemId && (
                              <span className="inline-flex items-center ml-1 px-1 py-0.5 text-[9px] font-medium rounded bg-blue-50 text-blue-600">
                                Auto-matched
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{entry.category}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {entry.supplierName ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">
                            {entry.quantityRequired}
                          </td>
                          {/* Live Stock Availability */}
                          <td className="px-4 py-3">
                            {stockLoading ? (
                              <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400" />
                              </div>
                            ) : !hasLink ? (
                              <span className="text-sm text-gray-400 block text-center">—</span>
                            ) : (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className={`text-sm font-medium ${
                                  stockStatus === 'in_stock' ? 'text-green-700' :
                                  stockStatus === 'partial' ? 'text-amber-700' :
                                  stockStatus === 'reserved' ? 'text-blue-600' :
                                  'text-red-600'
                                }`}>
                                  {available} avail
                                </span>
                                {stock?.offcutCount ? (
                                  <span className="text-xs text-emerald-600 font-medium">
                                    +{stock.offcutCount} offcut{stock.offcutCount > 1 ? 's' : ''}
                                  </span>
                                ) : null}
                                {reserved > 0 && (
                                  <span className="text-xs text-blue-500 font-medium">
                                    {reserved} reserved
                                  </span>
                                )}
                                {shortage > 0 && (
                                  <span className="text-xs text-red-500 font-medium">
                                    -{shortage} short
                                  </span>
                                )}
                                <div className="w-16 bg-gray-200 rounded-full h-1.5">
                                  <div
                                    className={`h-1.5 rounded-full ${
                                      stockStatus === 'in_stock' ? 'bg-green-500' :
                                      stockStatus === 'partial' ? 'bg-amber-500' :
                                      stockStatus === 'reserved' ? 'bg-blue-500' :
                                      'bg-red-500'
                                    }`}
                                    style={{ width: `${entry.quantityRequired > 0 ? Math.min(100, (available / entry.quantityRequired) * 100) : 0}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-sm text-gray-900">{consumed} / {entry.quantityRequired}</span>
                              <div className="w-20 bg-gray-200 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    pct > 100 ? 'bg-red-500' : pct >= 100 ? 'bg-green-500' : pct > 0 ? 'bg-amber-500' : 'bg-gray-300'
                                  }`}
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{entry.unit}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">
                            {entry.unitCost.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">
                            {entry.totalCost.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
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
                            <td className="px-4 py-3">
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
                                <RefreshCw className="h-4 w-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                  {(bomEditing ? editedBom : order.bom).length === 0 && (
                    <tr>
                      <td
                        colSpan={bomEditing ? 8 : (canSubstitute ? 11 : 10)}
                        className="px-4 py-8 text-center text-gray-500"
                      >
                        No BOM entries
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Cost Summary */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Cost Summary</h2>
            <div className="space-y-2">
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
              <hr className="my-2" />
              <div className="flex justify-between font-semibold">
                <span>Total (Planned)</span>
                <span>
                  {order.costSummary.totalCost.toLocaleString()} {order.costSummary.currency}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Material Reservations */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Material Reservations ({order.materialReservations.length})
              </h2>
            </div>
            {order.materialReservations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Item
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reserved
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {order.materialReservations.map((res) => {
                      const bomMatch = order.bom.find((b) => b.inventoryItemId === res.inventoryItemId);
                      return (
                      <tr key={res.id}>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {bomMatch?.itemName ?? res.inventoryItemId}
                          {bomMatch && <span className="text-xs text-gray-400 ml-1">({bomMatch.sku})</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          {res.quantityReserved}
                        </td>
                        <td className="px-4 py-3">
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 text-gray-500">No materials reserved yet</div>
            )}
          </div>
        </div>

        {/* Procurement Needs — Live Shortages + Existing Requirements */}
        {(() => {
          const getEffectiveId = (e: BOMEntry) => e.inventoryItemId || resolvedIds[e.id] || '';
          const getStockAvail = (itemId: string) => itemId ? (stockMap[itemId]?.totalAvailable ?? 0) : 0;

          const liveShortages = !stockLoading ? order.bom
            .filter((e) => {
              if (e.offcutId) return false;
              const eid = getEffectiveId(e);
              return eid && !eid.includes(':');
            })
            .map((e) => {
              const eid = getEffectiveId(e);
              const avail = getStockAvail(eid);
              const shortageAmt = Math.max(0, e.quantityRequired - avail);
              return { ...e, available: avail, shortage: shortageAmt, effectiveItemId: eid };
            })
            .filter((e) => e.shortage > 0) : [];

          const unmappedItems = order.bom.filter((e) => !e.inventoryItemId && !resolvedIds[e.id]);

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
            <div className="lg:col-span-12">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Procurement Needs
                    {!stockLoading && (
                      <span className="ml-2 text-xs font-normal text-gray-400">LIVE</span>
                    )}
                  </h2>
                  <Link
                    to="/manufacturing/procurement"
                    className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Procurement Dashboard
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Required</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">In Stock</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">To Procure</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Est. Cost</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PO</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {/* Items with live stock shortages */}
                      {liveShortages.map((entry) => {
                        const existingReq = procReqByBomEntry.get(entry.id) ?? procReqByItemId.get(entry.effectiveItemId);
                        const reqStatusConfig = existingReq ? PROCUREMENT_STATUS_CONFIG[existingReq.status] : null;
                        return (
                          <tr key={entry.id}>
                            <td className="px-4 py-3">
                              <div className="text-sm text-gray-900">{entry.itemName}</div>
                              <div className="text-xs text-gray-400">{entry.sku}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-right">{entry.quantityRequired}</td>
                            <td className="px-4 py-3 text-sm text-right">
                              <span className={entry.available > 0 ? 'text-amber-600' : 'text-red-600'}>
                                {entry.available}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-red-700">{entry.shortage}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-right">
                              {(entry.shortage * entry.unitCost).toLocaleString()}
                            </td>
                            <td className="px-4 py-3">
                              {existingReq ? (
                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${reqStatusConfig!.bg} ${reqStatusConfig!.text}`}>
                                  {PROCUREMENT_STATUS_LABELS[existingReq.status]}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                                  Needs PO
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {existingReq?.poId ? (
                                <Link
                                  to={`/manufacturing/purchase-orders?selected=${existingReq.poId}`}
                                  className="text-primary text-sm hover:underline"
                                >
                                  View PO
                                </Link>
                              ) : (
                                <span className="text-gray-400 text-sm">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Unmapped items (no inventory link — always need procurement) */}
                      {unmappedItems.map((entry) => (
                        <tr key={entry.id}>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-900">{entry.itemName}</div>
                            <div className="text-xs text-gray-400">No inventory link</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">{entry.quantityRequired}</td>
                          <td className="px-4 py-3 text-sm text-gray-400 text-right">—</td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-red-700">{entry.quantityRequired}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">{entry.totalCost.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                              Unmapped
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-gray-400 text-sm">—</span>
                          </td>
                        </tr>
                      ))}

                      {/* Existing procurement reqs that don't match a live shortage */}
                      {procurementReqs
                        .filter((req) => {
                          const matchesShortage = liveShortages.some(
                            (s) => s.id === req.bomEntryId || s.effectiveItemId === req.inventoryItemId,
                          );
                          const matchesUnmapped = unmappedItems.some((u) => u.id === req.bomEntryId);
                          return !matchesShortage && !matchesUnmapped;
                        })
                        .map((req) => {
                          const reqStatusConfig = PROCUREMENT_STATUS_CONFIG[req.status];
                          const bomEntry = order.bom.find((b) => b.id === req.bomEntryId);
                          const reqEffectiveId = req.inventoryItemId || (bomEntry ? resolvedIds[bomEntry.id] : '') || '';
                          const avail = getStockAvail(reqEffectiveId);
                          return (
                            <tr key={req.id} className="bg-green-50/50">
                              <td className="px-4 py-3">
                                <div className="text-sm text-gray-900">{req.itemDescription}</div>
                                {avail > 0 && (
                                  <div className="text-xs text-green-600">Now in stock ({avail} avail)</div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 text-right">
                                {bomEntry?.quantityRequired ?? req.quantityRequired}
                              </td>
                              <td className="px-4 py-3 text-sm text-right">
                                <span className="text-green-600">{avail}</span>
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-500">{req.quantityRequired}</td>
                              <td className="px-4 py-3 text-sm text-gray-900 text-right">{req.estimatedTotalCost.toLocaleString()}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${reqStatusConfig.bg} ${reqStatusConfig.text}`}>
                                  {PROCUREMENT_STATUS_LABELS[req.status]}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {req.poId ? (
                                  <Link
                                    to={`/manufacturing/purchase-orders?selected=${req.poId}`}
                                    className="text-primary text-sm hover:underline"
                                  >
                                    View PO
                                  </Link>
                                ) : (
                                  <span className="text-gray-400 text-sm">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}

                      {liveShortages.length === 0 && unmappedItems.length === 0 && procurementReqs.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-green-600 text-sm font-medium">
                            All materials in stock — no procurement needed
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {/* Totals row */}
                    {(liveShortages.length > 0 || unmappedItems.length > 0) && (
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-700" colSpan={3}>
                            Total to Procure
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-red-700 text-right">
                            {liveShortages.reduce((s, e) => s + e.shortage, 0) +
                              unmappedItems.reduce((s, e) => s + e.quantityRequired, 0)} items
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
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
            </div>
          );
        })()}

        {/* Linked Purchase Orders */}
        {order.linkedPOIds && order.linkedPOIds.length > 0 && (
          <div className="lg:col-span-12">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Linked Purchase Orders ({order.linkedPOIds.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {order.linkedPOIds.map((poId) => (
                  <Link
                    key={poId}
                    to={`/manufacturing/purchase-orders/${poId}`}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
                  >
                    PO: {poId.slice(0, 8)}...
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Approve Dialog */}
      {showApproveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
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
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                  {warehouses.length === 0 && (
                    <option value="" disabled>
                      No warehouses available
                    </option>
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
              <button
                onClick={() => { setShowApproveDialog(false); setApproveError(null); }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={!approveWarehouseId || actionLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Approving...' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Advance Stage Dialog */}
      {showAdvanceDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {isAdvancingToReady
                  ? 'Complete Manufacturing Order'
                  : `Advance to ${MO_STAGE_LABELS[MO_STAGES[currentStageIndex + 1]]}`}
              </h3>
              {isAdvancingToReady && (
                <p className="text-sm text-gray-500 mt-1">
                  Production is complete. Choose what happens next.
                </p>
              )}
            </div>
            <div className="p-4 space-y-4">
              {isAdvancingToReady && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Completion Disposition
                  </label>
                  <div className="space-y-2">
                    <label className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      completionDisposition === 'site_installation' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input
                        type="radio"
                        name="disposition"
                        checked={completionDisposition === 'site_installation'}
                        onChange={() => setCompletionDisposition('site_installation')}
                        className="mt-0.5"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900">Schedule Site Installation</span>
                        <p className="text-xs text-gray-500 mt-0.5">Item needs delivery and installation at the client site</p>
                      </div>
                    </label>
                    <label className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      completionDisposition === 'finished_goods' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input
                        type="radio"
                        name="disposition"
                        checked={completionDisposition === 'finished_goods'}
                        onChange={() => setCompletionDisposition('finished_goods')}
                        className="mt-0.5"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900">Move to Finished Goods</span>
                        <p className="text-xs text-gray-500 mt-0.5">Store completed item in warehouse inventory</p>
                      </div>
                    </label>
                  </div>

                  {completionDisposition === 'site_installation' && (
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Installation Notes (optional)
                      </label>
                      <textarea
                        value={completionInstallationNotes}
                        onChange={(e) => setCompletionInstallationNotes(e.target.value)}
                        rows={2}
                        placeholder="Delivery address, access instructions, special requirements..."
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                  )}

                  {completionDisposition === 'finished_goods' && (
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Warehouse Location (optional)
                      </label>
                      <input
                        type="text"
                        value={completionWarehouseLocation}
                        onChange={(e) => setCompletionWarehouseLocation(e.target.value)}
                        placeholder="e.g. Bay 3, Shelf A2"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stage Notes (optional)
                </label>
                <textarea
                  value={stageNotes}
                  onChange={(e) => setStageNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setShowAdvanceDialog(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdvanceStage}
                disabled={actionLoading}
                className={`px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ${
                  isAdvancingToReady ? 'bg-green-600 hover:bg-green-700' : 'bg-primary hover:bg-primary/90'
                }`}
              >
                {isAdvancingToReady ? 'Complete Order' : 'Advance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hold Dialog */}
      {showHoldDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Put Order on Hold</h3>
            </div>
            <div className="p-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason for Hold <span className="text-red-500">*</span>
              </label>
              <textarea
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setShowHoldDialog(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleHold}
                disabled={!holdReason.trim() || actionLoading}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                Put on Hold
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Cancel Manufacturing Order</h3>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600">
                This will cancel the manufacturing order and release any material reservations. This
                action cannot be undone.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cancellation Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setShowCancelDialog(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Keep Order
              </button>
              <button
                onClick={handleCancel}
                disabled={!cancelReason.trim() || actionLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                Cancel Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
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
                <Trash2 className="h-4 w-4" />
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOM Substitution Dialog */}
      {substitutionEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
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

      {/* Material Consumption Dialog */}
      {showConsumeDialog && (
        <MaterialConsumptionDialog
          open={showConsumeDialog}
          onClose={() => setShowConsumeDialog(false)}
          order={order}
          warehouses={warehouses}
          onConsume={actions.consumeMaterials}
        />
      )}

      {/* QC Inspection Dialog */}
      {showQCDialog && (
        <QCInspectionDialog
          open={showQCDialog}
          onClose={() => setShowQCDialog(false)}
          order={order}
          userId={user?.uid ?? ''}
          onRecordQC={actions.recordQC}
        />
      )}

      {showCloseoutDialog && (
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
    </div>
  );
}
