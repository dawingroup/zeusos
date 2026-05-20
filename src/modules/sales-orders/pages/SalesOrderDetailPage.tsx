/**
 * SalesOrderDetailPage — Tabbed detail view: Overview, Payments, Scope, Discounts,
 * Change Orders, Design Sign-Off, Risk & Audit.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Send,
  CheckCircle,
  Lock,
  ArrowLeft,
  AlertTriangle,
  XCircle,
  Trash2,
  X,
  Banknote,
  CreditCard,
  Receipt,
  Plus,
  Loader2,
  Pencil,
  Download,
  Package,
  MessageCircle,
} from 'lucide-react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/shared/hooks/useAuth';
import { useSalesOrderDetail } from '../hooks/useSalesOrderDetail';
import { useRecordTracker } from '@/core/hooks/useRecordTracker';
import { useChangeOrders } from '../hooks/useChangeOrders';
import { useDesignSignOff } from '../hooks/useDesignSignOff';
import {
  advanceStatus,
  freezeScope,
  releaseToProduction,
  cancelSalesOrder,
  cancelSalesOrderLineItems,
  deleteSalesOrder,
  recordPayment,
  updatePayment,
  deletePayment,
  detectRisks,
  createManualRiskFlag,
  resolveRiskFlag,
  reopenRiskFlag,
} from '../services/salesOrderService';
import { QBOSyncStatusBadge } from '@/modules/finance/components/integrations/QBOSyncStatusBadge';
import { useQBOConfig } from '@/modules/finance/hooks/useQBOConfig';
import { syncSOToInvoice, syncPaymentToQBO } from '@/modules/finance/services/qboSyncService';
import {
  STATUS_TRANSITIONS,
  CO_STATUS_LABELS,
  DSO_STATUS_LABELS,
  RISK_TYPE_LABELS,
  RISK_SEVERITY_ORDER,
} from '../constants';
import GateTracker from '../components/GateTracker';
import RiskFlagBanner from '../components/RiskFlagBanner';
import ScopeItemsTable from '../components/ScopeItemsTable';
import StatusTimeline from '../components/StatusTimeline';
import ReleaseChecklist from '../components/ReleaseChecklist';
import ChangeOrderCreateWizard from '../components/ChangeOrderCreateWizard';
import { SOStatusBadge } from '../components/shared';
import { OrderConfirmationDialog } from '@/modules/whatsapp/components/OrderConfirmationDialog';
import { DepositRequestDialog } from '@/modules/whatsapp/components/DepositRequestDialog';
import { PaymentReceiptDialog } from '@/modules/whatsapp/components/PaymentReceiptDialog';
import { SelectItemsForSODialog } from '@/modules/crm/components/deals/SelectItemsForSODialog';
import { getDeal } from '@/modules/crm/services/crmDealService';
import { getSubsidiaryBrandingLogoUrl } from '@/shared/services/branding.service';
import type { CRMDeal } from '@/modules/crm/types';
import type {
  SalesOrderStatus,
  SalesOrder,
  PaymentRecord,
  SalesOrderItem,
  RiskType,
  RiskSeverity,
} from '../types';
import { resolveReceiptDocumentNumber, buildReceiptPriorPaymentLines } from '@/modules/whatsapp/services/receiptPdfGenerator';
import { CrossModuleEntityTabs } from '@/shared/components/navigation/CrossModuleEntityTabs';

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(ts: any): string {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function paymentSortMillis(p: PaymentRecord): number {
  const pd = p.paymentDate?.toMillis?.();
  if (pd != null) return pd;
  return p.recordedAt?.toMillis?.() ?? 0;
}

/** Balance remaining on the order immediately after this payment (chronological). */
function balanceAfterPayment(so: SalesOrder, target: PaymentRecord): number {
  const sorted = [...(so.payments || [])].sort((a, b) => {
    const d = paymentSortMillis(a) - paymentSortMillis(b);
    if (d !== 0) return d;
    return a.id.localeCompare(b.id);
  });
  let sum = 0;
  for (const p of sorted) {
    sum += p.amount || 0;
    if (p.id === target.id) {
      return Math.max(0, (so.currentAmount || 0) - sum);
    }
  }
  return Math.max(0, (so.currentAmount || 0) - sum);
}

export default function SalesOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.uid ?? '';
  const { order, loading } = useSalesOrderDetail(orderId);
  // Log this record for the Global Search palette's recency boost + empty state.
  useRecordTracker({
    type: 'sales_order',
    id: order?.id,
    title: order?.orderNumber ?? '',
    subtitle: (order as { customerName?: string } | null | undefined)?.customerName,
    module: 'sales_orders',
  });
  const { changeOrders, pendingCount, draftCount } = useChangeOrders(orderId);
  const { signOffs } = useDesignSignOff(orderId);
  const { isReady: qboReady } = useQBOConfig();
  const [searchParams] = useSearchParams();
  // Deep-link: tab indices = Overview 0, Payments 1, Scope 2, Discounts 3, CO 4, DSO 5, Risk 6
  const initialTab = (() => {
    const t = searchParams.get('tab');
    if (t === 'change-orders') return 4;
    if (t === 'discounts') return 3;
    if (t === 'scope') return 2;
    if (t === 'payments') return 1;
    if (t === 'design-signoff') return 5;
    if (t === 'risk') return 6;
    return 0;
  })();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showOrderConfirmation, setShowOrderConfirmation] = useState(false);
  const [showDepositRequest, setShowDepositRequest] = useState(false);
  const [showPaymentReceipt, setShowPaymentReceipt] = useState(false);
  /** When set, receipt dialog resends WhatsApp template for this payment (no duplicate row). */
  const [paymentReceiptPrefill, setPaymentReceiptPrefill] = useState<PaymentRecord | null>(null);
  const [showChangeOrderWizard, setShowChangeOrderWizard] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [lineItemPendingCancel, setLineItemPendingCancel] = useState<SalesOrderItem | null>(null);
  const [lineItemCancelReason, setLineItemCancelReason] = useState('');
  const [lineItemCancelSaving, setLineItemCancelSaving] = useState(false);
  const [selectedScopeItemIds, setSelectedScopeItemIds] = useState<string[]>([]);
  const [showBulkLineCancelDialog, setShowBulkLineCancelDialog] = useState(false);
  const [bulkLineCancelReason, setBulkLineCancelReason] = useState('');

  // Inline payment form state
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [pmtType, setPmtType] = useState<'deposit' | 'milestone' | 'full'>('deposit');
  const [pmtAmount, setPmtAmount] = useState('');
  const [pmtMethod, setPmtMethod] = useState('');
  const [pmtRef, setPmtRef] = useState('');
  const [pmtDate, setPmtDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [pmtSaving, setPmtSaving] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [paymentPendingDelete, setPaymentPendingDelete] = useState<PaymentRecord | null>(null);
  const [paymentDeleteSaving, setPaymentDeleteSaving] = useState(false);
  const [receiptDownloadPaymentId, setReceiptDownloadPaymentId] = useState<string | null>(null);
  const [crmDealForQuoteAppend, setCrmDealForQuoteAppend] = useState<CRMDeal | null>(null);
  const [showAppendFromQuoteDialog, setShowAppendFromQuoteDialog] = useState(false);
  const [riskType, setRiskType] = useState<RiskType>('verbal_agreement_only');
  const [riskSeverity, setRiskSeverity] = useState<RiskSeverity>('medium');
  const [riskMessage, setRiskMessage] = useState('');
  const [riskSaving, setRiskSaving] = useState(false);
  const [riskResolutionNotes, setRiskResolutionNotes] = useState<Record<string, string>>({});
  const [riskActionMessage, setRiskActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!order?.dealId) {
      setCrmDealForQuoteAppend(null);
      return;
    }
    let cancelled = false;
    void getDeal(order.dealId)
      .then((d) => {
        if (!cancelled) setCrmDealForQuoteAppend(d);
      })
      .catch(() => {
        if (!cancelled) setCrmDealForQuoteAppend(null);
      });
    return () => {
      cancelled = true;
    };
  }, [order?.dealId]);

  const cancelPaymentForm = useCallback(() => {
    setShowAddPayment(false);
    setEditingPaymentId(null);
    setPmtType('deposit');
    setPmtAmount('');
    setPmtMethod('');
    setPmtRef('');
    setPmtDate(new Date().toISOString().split('T')[0]);
  }, []);

  const startEditPayment = useCallback(
    (pmt: {
      id: string;
      type: string;
      method: string;
      amount: number;
      paymentDate: { toDate: () => Date } | null | undefined;
      receiptRef?: string;
    }) => {
      setShowAddPayment(true);
      setEditingPaymentId(pmt.id);
      setPmtType(pmt.type as 'deposit' | 'milestone' | 'full');
      setPmtAmount(String(pmt.amount));
      setPmtMethod(pmt.method);
      setPmtRef(pmt.receiptRef || '');
      const d = pmt.paymentDate?.toDate?.() || new Date();
      setPmtDate(d.toISOString().split('T')[0]);
    },
    [],
  );

  const handleRecordPayment = useCallback(async () => {
    if (!orderId || !pmtAmount || !pmtMethod || editingPaymentId) return;
    setPmtSaving(true);
    setActionError(null);
    try {
      const paymentRecord = await recordPayment(
        orderId,
        {
          type: pmtType,
          method: pmtMethod,
          amount: parseFloat(pmtAmount),
          currency: order?.currency || 'UGX',
          paymentDate: pmtDate,
          receiptRef: pmtRef || undefined,
          sharedViaWhatsApp: false,
        },
        userId,
      );

      if (order?.qboInvoiceId && paymentRecord?.id) {
        try {
          await syncPaymentToQBO(orderId, paymentRecord.id);
        } catch (qboErr) {
          console.warn('QBO payment sync failed (can retry manually):', qboErr);
        }
      }

      cancelPaymentForm();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setPmtSaving(false);
    }
  }, [
    orderId,
    pmtType,
    pmtAmount,
    pmtMethod,
    pmtRef,
    pmtDate,
    editingPaymentId,
    userId,
    order?.qboInvoiceId,
    order?.currency,
    cancelPaymentForm,
  ]);

  const handleUpdatePayment = useCallback(async () => {
    if (!orderId || !editingPaymentId || !pmtAmount || !pmtMethod) return;
    setPmtSaving(true);
    setActionError(null);
    const pid = editingPaymentId;
    try {
      await updatePayment(
        orderId,
        pid,
        {
          type: pmtType,
          method: pmtMethod,
          amount: parseFloat(pmtAmount),
          currency: order?.currency || 'UGX',
          paymentDate: pmtDate,
          receiptRef: pmtRef || undefined,
        },
        userId,
      );

      if (order?.qboInvoiceId) {
        try {
          await syncPaymentToQBO(orderId, pid);
        } catch (qboErr) {
          console.warn('QBO payment sync failed after update (can retry manually):', qboErr);
        }
      }

      cancelPaymentForm();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setPmtSaving(false);
    }
  }, [
    orderId,
    editingPaymentId,
    pmtType,
    pmtAmount,
    pmtMethod,
    pmtRef,
    pmtDate,
    userId,
    order?.qboInvoiceId,
    order?.currency,
    cancelPaymentForm,
  ]);

  const handleAdvanceStatus = useCallback(
    async (targetStatus: SalesOrderStatus) => {
      if (!orderId) return;
      setActionLoading(true);
      setActionError(null);
      try {
        await advanceStatus(orderId, targetStatus, userId);
      } catch (err) {
        setActionError((err as Error).message);
      } finally {
        setActionLoading(false);
      }
    },
    [orderId],
  );

  const handleFreezeScope = useCallback(async () => {
    if (!orderId) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await freezeScope(orderId, userId);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  }, [orderId]);

  const handleRelease = useCallback(async () => {
    if (!orderId) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const result = await releaseToProduction(orderId, userId);
      if (!result.success) {
        setActionError(result.errors.join('; '));
      }
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  }, [orderId]);

  const handleCancel = useCallback(async () => {
    if (!orderId || !cancelReason.trim()) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await cancelSalesOrder(orderId, userId, cancelReason.trim());
      setShowCancelDialog(false);
      setCancelReason('');
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  }, [orderId, cancelReason]);

  const handleDelete = useCallback(async () => {
    if (!orderId) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await deleteSalesOrder(orderId);
      navigate('/sales-orders/list');
    } catch (err) {
      setActionError((err as Error).message);
      setActionLoading(false);
    }
  }, [orderId, navigate]);

  const handleCancelLineItem = useCallback(async () => {
    if (!orderId || !lineItemPendingCancel) return;
    setLineItemCancelSaving(true);
    setActionError(null);
    try {
      await cancelSalesOrderLineItems(
        orderId,
        [lineItemPendingCancel.id],
        userId,
        lineItemCancelReason.trim() || undefined,
      );
      setLineItemPendingCancel(null);
      setLineItemCancelReason('');
      setSelectedScopeItemIds((prev) => prev.filter((id) => id !== lineItemPendingCancel.id));
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setLineItemCancelSaving(false);
    }
  }, [orderId, lineItemPendingCancel, lineItemCancelReason, userId]);

  const handleBulkCancelLineItems = useCallback(async () => {
    if (!orderId || selectedScopeItemIds.length === 0) return;
    setLineItemCancelSaving(true);
    setActionError(null);
    try {
      await cancelSalesOrderLineItems(
        orderId,
        selectedScopeItemIds,
        userId,
        bulkLineCancelReason.trim() || undefined,
      );
      setShowBulkLineCancelDialog(false);
      setBulkLineCancelReason('');
      setSelectedScopeItemIds([]);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setLineItemCancelSaving(false);
    }
  }, [orderId, selectedScopeItemIds, userId, bulkLineCancelReason]);

  useEffect(() => {
    const scopeItems = order?.scopeItems ?? [];
    setSelectedScopeItemIds((prev) =>
      prev.filter((id) => scopeItems.some((item) => item.isActive && item.id === id)),
    );
  }, [order?.scopeItems]);

  const handleSyncSOInvoice = useCallback(async () => {
    if (!orderId) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await syncSOToInvoice(orderId);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  }, [orderId]);

  const handleSyncPaymentToQBO = useCallback(async (paymentId: string) => {
    if (!orderId) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await syncPaymentToQBO(orderId, paymentId);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  }, [orderId]);

  const handleRunRiskDetection = useCallback(async () => {
    if (!orderId) return;
    setRiskSaving(true);
    setActionError(null);
    setRiskActionMessage(null);
    try {
      const newRisks = await detectRisks(orderId);
      setRiskActionMessage(
        newRisks.length > 0
          ? `${newRisks.length} new risk flag${newRisks.length > 1 ? 's' : ''} detected.`
          : 'No new risks detected.',
      );
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setRiskSaving(false);
    }
  }, [orderId]);

  const handleAddManualRisk = useCallback(async () => {
    if (!orderId || !riskMessage.trim()) return;
    setRiskSaving(true);
    setActionError(null);
    setRiskActionMessage(null);
    try {
      await createManualRiskFlag(
        orderId,
        {
          type: riskType,
          severity: riskSeverity,
          message: riskMessage.trim(),
        },
        userId,
      );
      setRiskMessage('');
      setRiskActionMessage('Risk flag added.');
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setRiskSaving(false);
    }
  }, [orderId, riskMessage, riskSeverity, riskType, userId]);

  const handleResolveRisk = useCallback(
    async (riskId: string) => {
      if (!orderId) return;
      setRiskSaving(true);
      setActionError(null);
      setRiskActionMessage(null);
      try {
        await resolveRiskFlag(orderId, riskId, userId, riskResolutionNotes[riskId]);
        setRiskResolutionNotes((prev) => ({ ...prev, [riskId]: '' }));
        setRiskActionMessage('Risk flag resolved.');
      } catch (err) {
        setActionError((err as Error).message);
      } finally {
        setRiskSaving(false);
      }
    },
    [orderId, riskResolutionNotes, userId],
  );

  const handleReopenRisk = useCallback(
    async (riskId: string) => {
      if (!orderId) return;
      setRiskSaving(true);
      setActionError(null);
      setRiskActionMessage(null);
      try {
        await reopenRiskFlag(orderId, riskId, userId);
        setRiskActionMessage('Risk flag reopened.');
      } catch (err) {
        setActionError((err as Error).message);
      } finally {
        setRiskSaving(false);
      }
    },
    [orderId, userId],
  );

  const handleDownloadPaymentReceipt = useCallback(
    async (pmt: PaymentRecord) => {
      if (!order) return;
      setReceiptDownloadPaymentId(pmt.id);
      setActionError(null);
      try {
        if (pmt.receiptPdfUrl?.trim()) {
          window.open(pmt.receiptPdfUrl.trim(), '_blank', 'noopener,noreferrer');
          return;
        }
        const { receiptPdfService } = await import('@/modules/whatsapp/services/receiptPdfGenerator');
        let logoUrl: string | undefined;
        try {
          logoUrl = await getSubsidiaryBrandingLogoUrl(order.subsidiaryId);
        } catch {
          logoUrl = undefined;
        }
        const pmtDateObj = pmt.paymentDate?.toDate?.() || pmt.recordedAt?.toDate?.() || new Date();
        const paymentDateStr = pmtDateObj.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
        const receiptNumber = resolveReceiptDocumentNumber(order.orderNumber, pmt);
        const previousPayments = buildReceiptPriorPaymentLines(order.payments, pmt.id);
        const data = {
          receiptNumber,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          paymentDate: paymentDateStr,
          paymentType: pmt.type,
          paymentMethod: pmt.method || '—',
          amountReceived: pmt.amount,
          currency: pmt.currency || order.currency,
          orderTotal: order.currentAmount,
          balanceRemaining: balanceAfterPayment(order, pmt),
          receiptRef: pmt.receiptRef || undefined,
          invoiceNumber: order.qboInvoiceDocNumber || undefined,
          ...(logoUrl ? { logoUrl } : {}),
          ...(previousPayments.length > 0 ? { previousPayments } : {}),
        };
        const blob = await receiptPdfService.generateBlob(data);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Receipt_${order.orderNumber.replace(/-/g, '_')}_${pmt.id.replace(/-/g, '_')}.pdf`;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        setActionError((err as Error).message || 'Could not download receipt');
      } finally {
        setReceiptDownloadPaymentId(null);
      }
    },
    [order],
  );

  const handleConfirmDeletePayment = useCallback(async () => {
    if (!orderId || !paymentPendingDelete || !userId) return;
    setPaymentDeleteSaving(true);
    setActionError(null);
    try {
      await deletePayment(orderId, paymentPendingDelete.id, userId);
      setPaymentPendingDelete(null);
      cancelPaymentForm();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setPaymentDeleteSaving(false);
    }
  }, [orderId, paymentPendingDelete, userId, cancelPaymentForm]);

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
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Sales order not found.
        </div>
      </div>
    );
  }

  const coTabLabel = (() => {
    const parts = [`Change Orders (${changeOrders.length}`];
    if (draftCount > 0) parts.push(`, ${draftCount} draft`);
    return `${parts.join('')})`;
  })();

  const showPaymentTracking = [
    'client_accepted',
    'design_review',
    'awaiting_design_signoff',
    'design_approved',
    'scope_frozen',
    'awaiting_deposit',
    'deposit_received',
    'released_to_production',
    'in_progress',
    'completed',
  ].includes(order.status);

  const paymentTabCount = order.payments?.length ?? 0;
  const canCancelScopeLines = !['released_to_production', 'in_progress', 'completed', 'cancelled'].includes(order.status);
  const tabLabels = [
    'Overview',
    paymentTabCount > 0 ? `Payments (${paymentTabCount})` : 'Payments',
    'Scope & Items',
    `Discounts (${order.discounts.length})`,
    coTabLabel,
    'Design Sign-Off',
    'Risk & Audit',
  ];
  const activeRisks = order.riskFlags
    .filter((r) => !r.resolvedAt)
    .sort((a, b) => RISK_SEVERITY_ORDER.indexOf(a.severity) - RISK_SEVERITY_ORDER.indexOf(b.severity));
  const resolvedRisks = order.riskFlags
    .filter((r) => !!r.resolvedAt)
    .sort((a, b) => (b.resolvedAt?.toMillis?.() ?? 0) - (a.resolvedAt?.toMillis?.() ?? 0));

  return (
    <div className="space-y-4">
      {/* Header — title row with cross-module tabs on the right */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
            onClick={() => navigate('/sales-orders/list')}
          >
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 truncate">{order.orderNumber}</h1>
          <SOStatusBadge status={order.status} size="medium" />
        </div>
        <CrossModuleEntityTabs
          links={{
            dealId: order.dealId,
            designProjectId: order.designProjectId,
            salesOrderId: order.id,
            manufacturingOrderId:
              (order as { manufacturingOrderIds?: string[] }).manufacturingOrderIds?.[0] ??
              (order as { linkedManufacturingOrderIds?: string[] }).linkedManufacturingOrderIds?.[0],
          }}
          className="w-fit shrink-0 sm:ml-2"
        />
      </div>

      <p className="text-sm text-gray-500">
        {order.title} &mdash; {order.customerName}
      </p>

      {/* Risk Flags Banner */}
      <RiskFlagBanner riskFlags={order.riskFlags} />

      {actionError && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <XCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <span className="flex-1">{actionError}</span>
          <button onClick={() => setActionError(null)} className="p-1 hover:bg-red-100 rounded">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Gate Tracker */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <GateTracker gates={order.gates} />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6 -mb-px">
          {tabLabels.map((label, idx) => (
            <button
              key={label}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === idx
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab(idx)}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* ========== OVERVIEW TAB ========== */}
      {activeTab === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            {/* Financial Summary */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Financial Summary</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Original Quote</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrency(order.originalQuoteAmount, order.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Discounts</p>
                  <p className="text-lg font-semibold text-amber-600">
                    -{formatCurrency(order.totalDiscountAmount, order.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Change Orders</p>
                  <p
                    className={`text-lg font-semibold ${
                      order.totalChangeOrderValue >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {order.totalChangeOrderValue >= 0 ? '+' : ''}
                    {formatCurrency(order.totalChangeOrderValue, order.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Current Total</p>
                  <p className="text-lg font-bold text-primary">
                    {formatCurrency(order.currentAmount, order.currency)}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Actions</h2>
              <div className="flex flex-wrap gap-2">
                {order.status === 'draft' && (
                  <button
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
                    onClick={() => handleAdvanceStatus('sent_to_client')}
                    disabled={actionLoading}
                  >
                    <Send className="h-4 w-4" />
                    Send to Client
                  </button>
                )}
                {(order.status === 'sent_to_client' || order.status === 'negotiation') && (
                  <button
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
                    onClick={() => handleAdvanceStatus('client_accepted')}
                    disabled={actionLoading}
                  >
                    <CheckCircle className="h-4 w-4" />
                    Record Client Acceptance
                  </button>
                )}
                {order.status === 'design_approved' && !order.scopeFrozen && (
                  <button
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium disabled:opacity-50"
                    onClick={handleFreezeScope}
                    disabled={actionLoading}
                  >
                    <Lock className="h-4 w-4" />
                    Freeze Scope
                  </button>
                )}

                {/* Send Order Confirmation via WhatsApp */}
                {['client_accepted', 'design_review', 'awaiting_design_signoff',
                  'design_approved', 'scope_frozen', 'awaiting_deposit'].includes(order.status) && (
                  <button
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
                    onClick={() => setShowOrderConfirmation(true)}
                    disabled={actionLoading}
                  >
                    <CreditCard className="h-4 w-4" />
                    Send Confirmation
                  </button>
                )}

                {/* Request Deposit Payment via WhatsApp */}
                {['client_accepted', 'design_review', 'awaiting_design_signoff',
                  'design_approved', 'scope_frozen', 'awaiting_deposit'].includes(order.status) &&
                  order.paymentTerms.depositRequired && (
                  <button
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium disabled:opacity-50"
                    onClick={() => setShowDepositRequest(true)}
                    disabled={actionLoading}
                  >
                    <Banknote className="h-4 w-4" />
                    Request Deposit
                  </button>
                )}

                {/* Share Payment Receipt via WhatsApp */}
                {['awaiting_deposit', 'deposit_received', 'released_to_production',
                  'in_progress', 'completed'].includes(order.status) && (
                  <button
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
                    onClick={() => {
                      setPaymentReceiptPrefill(null);
                      setShowPaymentReceipt(true);
                    }}
                    disabled={actionLoading}
                  >
                    <Receipt className="h-4 w-4" />
                    Share Receipt
                  </button>
                )}

                {/* Request Change Order — always visible except on cancelled SOs. */}
                {order.status !== 'cancelled' && (
                  <button
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50"
                    onClick={() => setShowChangeOrderWizard(true)}
                    disabled={actionLoading}
                  >
                    <Plus className="h-4 w-4" />
                    Request Change Order
                  </button>
                )}

                {/* Cancel button */}
                {STATUS_TRANSITIONS[order.status]?.includes('cancelled') && (
                  <button
                    className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium disabled:opacity-50"
                    onClick={() => setShowCancelDialog(true)}
                    disabled={actionLoading}
                  >
                    <XCircle className="h-4 w-4" />
                    Cancel Order
                  </button>
                )}

                {/* Delete button */}
                {(order.status === 'draft' || order.status === 'cancelled') && (
                  <button
                    className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium disabled:opacity-50"
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={actionLoading}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                )}
              </div>
            </div>

            {/* Payment summary (detail on Payments tab) */}
            {showPaymentTracking && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-gray-400" />
                    Payments
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab(1)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    Open Payments tab
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <div className="text-center p-2 bg-gray-50 rounded-lg">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">Order Total</p>
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(order.currentAmount, order.currency)}</p>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded-lg">
                    <p className="text-[10px] text-green-600 uppercase tracking-wide">Paid</p>
                    <p className="text-sm font-semibold text-green-700">{formatCurrency(order.totalPaid || 0, order.currency)}</p>
                  </div>
                  <div className={`text-center p-2 rounded-lg ${(order.balanceRemaining ?? (order.currentAmount - (order.totalPaid || 0))) <= 0 ? 'bg-green-50' : 'bg-amber-50'}`}>
                    <p className={`text-[10px] uppercase tracking-wide ${(order.balanceRemaining ?? (order.currentAmount - (order.totalPaid || 0))) <= 0 ? 'text-green-600' : 'text-amber-600'}`}>Balance</p>
                    <p className={`text-sm font-semibold ${(order.balanceRemaining ?? (order.currentAmount - (order.totalPaid || 0))) <= 0 ? 'text-green-700' : 'text-amber-700'}`}>
                      {formatCurrency(order.balanceRemaining ?? (order.currentAmount - (order.totalPaid || 0)), order.currency)}
                    </p>
                  </div>
                </div>
                {paymentTabCount > 0 && (
                  <>
                    <p className="text-xs text-gray-500 mt-2">
                      {paymentTabCount} payment{paymentTabCount === 1 ? '' : 's'} recorded — edit, delete,
                      download receipt, send receipt on WhatsApp, or sync from here or the Payments tab.
                    </p>
                    <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                      {order.payments!.map((pmt, idx) => (
                        <SalesOrderPaymentLine
                          key={pmt.id || idx}
                          order={order}
                          pmt={pmt}
                          onEdit={() => startEditPayment(pmt)}
                          onDelete={() => setPaymentPendingDelete(pmt)}
                          onDownload={() => void handleDownloadPaymentReceipt(pmt)}
                          onSendWhatsApp={() => {
                            setPaymentReceiptPrefill(pmt);
                            setShowPaymentReceipt(true);
                          }}
                          receiptDownloading={receiptDownloadPaymentId === pmt.id}
                          onSyncQBO={() => void handleSyncPaymentToQBO(pmt.id)}
                          qboReady={qboReady}
                          syncBusy={actionLoading}
                          showQboInvoiceRow={!!order.qboInvoiceId}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* QuickBooks Integration — only shown when QBO is connected & configured */}
            {qboReady && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">QuickBooks</h2>
                <div className="space-y-3">
                  {/* Linked Estimate (if quote was synced before SO was created) */}
                  {order.qboSalesOrderId && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Estimate</p>
                      <QBOSyncStatusBadge
                        status="synced"
                        lastSyncedAt={order.qboSyncedAt as any}
                        qboDocNumber={order.qboSalesOrderDocNumber}
                        qboDocUrl={`https://app.qbo.intuit.com/app/estimate?txnId=${order.qboSalesOrderId}`}
                        entityType="Sales Order"
                        compact
                      />
                    </div>
                  )}

                  {/* Invoice sync (SO → QBO Invoice) — confirmed SOs sync directly to invoices */}
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Invoice</p>
                    <QBOSyncStatusBadge
                      status={order.qboInvoiceId ? 'synced' : (order.qboSyncStatus === 'error' && !order.qboInvoiceId ? 'error' : undefined)}
                      error={order.qboSyncStatus === 'error' && !order.qboInvoiceId ? order.qboSyncError : undefined}
                      lastSyncedAt={order.qboInvoiceId ? (order.qboSyncedAt as any) : undefined}
                      qboDocNumber={order.qboInvoiceDocNumber}
                      qboDocUrl={order.qboInvoiceId ? `https://app.qbo.intuit.com/app/invoice?txnId=${order.qboInvoiceId}` : undefined}
                      entityType="Invoice"
                      onRetry={
                        !order.qboInvoiceId && order.qboSyncStatus === 'error'
                          ? handleSyncSOInvoice
                          : undefined
                      }
                      onSync={
                        !order.qboInvoiceId &&
                        ['client_accepted', 'design_review', 'awaiting_design_signoff',
                         'design_approved', 'scope_frozen', 'awaiting_deposit',
                         'deposit_received', 'released_to_production', 'in_progress',
                         'completed'].includes(order.status)
                          ? handleSyncSOInvoice
                          : undefined
                      }
                    />
                  </div>

                  {/* Payments synced to QBO */}
                  {order.qboInvoiceId && order.payments?.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Payments</p>
                      <div className="text-xs space-y-1">
                        {(() => {
                          const synced = order.payments.filter((p: any) => p.qboPaymentId).length;
                          const total = order.payments.length;
                          return (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                              synced === total ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {synced}/{total} payments synced
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {/* Release Checklist */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <ReleaseChecklist
                order={order}
                userId={userId}
                onRelease={handleRelease}
                releasing={actionLoading}
              />
            </div>

            {/* Order Details */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Order Details</h2>
              <div className="space-y-2">
                <DetailRow label="Customer" value={order.customerName} />
                {order.customerEmail && <DetailRow label="Email" value={order.customerEmail} />}
                {order.customerPhone && <DetailRow label="Phone" value={order.customerPhone} />}
                <div className="border-t border-gray-200 my-2" />
                <DetailRow
                  label="Deposit"
                  value={
                    order.paymentTerms.depositRequired
                      ? `${order.paymentTerms.depositPercent ?? 0}% (${formatCurrency(order.paymentTerms.depositAmount ?? 0, order.currency)})`
                      : 'Not required'
                  }
                />
                <DetailRow
                  label="Payment Due"
                  value={`${order.paymentTerms.paymentDueDays} days`}
                />
                <DetailRow
                  label="Installation"
                  value={order.installationRequired ? 'Required' : 'Not required'}
                />
                {order.deliveryAddress && (
                  <DetailRow label="Delivery" value={order.deliveryAddress} />
                )}
                <DetailRow label="Scope Version" value={`v${order.scopeVersion}`} />
                <div className="border-t border-gray-200 my-2" />
                <DetailRow label="Created" value={formatDate(order.createdAt)} />
                {order.expectedDeliveryDate && (
                  <DetailRow label="Expected Delivery" value={formatDate(order.expectedDeliveryDate)} />
                )}
                {order.scopeFrozenAt && (
                  <DetailRow label="Scope Frozen" value={formatDate(order.scopeFrozenAt)} />
                )}
                {order.expiresAt && (
                  <DetailRow label="Expires" value={formatDate(order.expiresAt)} />
                )}
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Status History</h2>
              <StatusTimeline statusHistory={order.statusHistory} />
            </div>
          </div>
        </div>
      )}

      {/* ========== PAYMENTS TAB ========== */}
      {activeTab === 1 && (
        <div className="space-y-4">
          {!showPaymentTracking ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-sm text-gray-600">
              Payments can be recorded after the order reaches client acceptance and later workflow stages. Use the
              Overview tab to advance the order, then return here to record or edit payments.
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-gray-400" />
                  Payments
                </h2>
                {!showAddPayment && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPaymentId(null);
                      setPmtType('deposit');
                      setPmtAmount('');
                      setPmtMethod('');
                      setPmtRef('');
                      setPmtDate(new Date().toISOString().split('T')[0]);
                      setShowAddPayment(true);
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Record payment
                  </button>
                )}
              </div>

              <p className="text-xs text-gray-500 mb-3">
                Editing a payment recalculates paid balance. If a line was linked to QuickBooks, save and use “Sync
                to QBO” (or the button auto-runs) to push updates.
              </p>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Order Total</p>
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(order.currentAmount, order.currency)}</p>
                </div>
                <div className="text-center p-2 bg-green-50 rounded-lg">
                  <p className="text-[10px] text-green-600 uppercase tracking-wide">Paid</p>
                  <p className="text-sm font-semibold text-green-700">{formatCurrency(order.totalPaid || 0, order.currency)}</p>
                </div>
                <div
                  className={`text-center p-2 rounded-lg ${
                    (order.balanceRemaining ?? (order.currentAmount - (order.totalPaid || 0))) <= 0
                      ? 'bg-green-50'
                      : 'bg-amber-50'
                  }`}
                >
                  <p
                    className={`text-[10px] uppercase tracking-wide ${
                      (order.balanceRemaining ?? (order.currentAmount - (order.totalPaid || 0))) <= 0
                        ? 'text-green-600'
                        : 'text-amber-600'
                    }`}
                  >
                    Balance
                  </p>
                  <p
                    className={`text-sm font-semibold ${
                      (order.balanceRemaining ?? (order.currentAmount - (order.totalPaid || 0))) <= 0
                        ? 'text-green-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {formatCurrency(
                      order.balanceRemaining ?? (order.currentAmount - (order.totalPaid || 0)),
                      order.currency,
                    )}
                  </p>
                </div>
              </div>

              {showAddPayment && (
                <div className="border border-indigo-200 rounded-lg p-3 mb-3 bg-indigo-50/30">
                  <p className="text-xs font-medium text-gray-700 mb-2">
                    {editingPaymentId ? 'Edit payment' : 'Record a payment'}
                  </p>
                  <div className="space-y-2">
                    <div className="flex gap-1 bg-gray-100 rounded-md p-0.5">
                      {(['deposit', 'milestone', 'full'] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setPmtType(type)}
                          className={`flex-1 px-2 py-1 text-xs font-medium rounded capitalize transition-colors ${
                            pmtType === type
                              ? 'bg-white shadow-sm text-gray-900'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">Amount ({order.currency})</label>
                        <input
                          type="number"
                          value={pmtAmount}
                          onChange={(e) => setPmtAmount(e.target.value)}
                          placeholder={
                            pmtType === 'deposit'
                              ? String(order.paymentTerms?.depositAmount || Math.round(order.currentAmount * 0.5))
                              : pmtType === 'full'
                                ? String(order.currentAmount - (order.totalPaid || 0))
                                : '0'
                          }
                          className="w-full px-2 py-1.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">Method</label>
                        <select
                          value={pmtMethod}
                          onChange={(e) => setPmtMethod(e.target.value)}
                          className="w-full px-2 py-1.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                        >
                          <option value="">Select...</option>
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="Mobile Money">Mobile Money</option>
                          <option value="Cash">Cash</option>
                          <option value="Cheque">Cheque</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-0.5">Payment Date</label>
                        <input
                          type="date"
                          value={pmtDate}
                          onChange={(e) => setPmtDate(e.target.value)}
                          className="w-full px-2 py-1.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">Reference (optional)</label>
                      <input
                        type="text"
                        value={pmtRef}
                        onChange={(e) => setPmtRef(e.target.value)}
                        placeholder="Transaction ID or receipt number"
                        className="w-full px-2 py-1.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={cancelPaymentForm}
                        className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md"
                        disabled={pmtSaving}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={editingPaymentId ? handleUpdatePayment : handleRecordPayment}
                        disabled={pmtSaving || !pmtAmount || !pmtMethod}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50"
                      >
                        {pmtSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Banknote className="h-3 w-3" />}
                        {pmtSaving ? 'Saving...' : editingPaymentId ? 'Save changes' : 'Record payment'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {order.payments && order.payments.length > 0 ? (
                <div className="border-t border-gray-200 pt-3 space-y-3">
                  {order.payments.map((pmt: PaymentRecord, idx: number) => (
                    <SalesOrderPaymentLine
                      key={pmt.id || idx}
                      order={order}
                      pmt={pmt}
                      onEdit={() => startEditPayment(pmt)}
                      onDelete={() => setPaymentPendingDelete(pmt)}
                      onDownload={() => void handleDownloadPaymentReceipt(pmt)}
                      onSendWhatsApp={() => {
                        setPaymentReceiptPrefill(pmt);
                        setShowPaymentReceipt(true);
                      }}
                      receiptDownloading={receiptDownloadPaymentId === pmt.id}
                      onSyncQBO={() => void handleSyncPaymentToQBO(pmt.id)}
                      qboReady={qboReady}
                      syncBusy={actionLoading}
                      showQboInvoiceRow={!!order.qboInvoiceId}
                    />
                  ))}
                </div>
              ) : !showAddPayment ? (
                <p className="text-xs text-gray-400 text-center py-2">No payments recorded yet</p>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* ========== SCOPE & ITEMS TAB ========== */}
      {activeTab === 2 && (
        <div className="space-y-3">
          {order.dealId && crmDealForQuoteAppend?.linkedProjectId && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-indigo-200 bg-indigo-50/50 px-4 py-3">
              <p className="text-xs text-gray-600 max-w-xl">
                {order.scopeFrozen
                  ? 'Scope is frozen — adding lines still bumps the scope version and may reset design sign-off. Use when new quote lines were approved after freeze.'
                  : 'Add newly approved quote lines from the linked CRM deal (same flow as “Add quote lines to order” on the deal).'}
              </p>
              <button
                type="button"
                onClick={() => setShowAppendFromQuoteDialog(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm shrink-0"
              >
                <Package className="h-3.5 w-3.5" />
                Add quote lines to order
              </button>
            </div>
          )}
          <ScopeItemsTable
            items={order.scopeItems}
            scopeVersion={order.scopeVersion}
            scopeFrozen={order.scopeFrozen}
            currency={order.currency}
            onCancelItem={(item) => {
              setLineItemPendingCancel(item);
              setLineItemCancelReason('');
            }}
            selectedItemIds={selectedScopeItemIds}
            onToggleItemSelection={(itemId, checked) => {
              setSelectedScopeItemIds((prev) => {
                if (checked) return prev.includes(itemId) ? prev : [...prev, itemId];
                return prev.filter((id) => id !== itemId);
              });
            }}
            onToggleAllActive={(checked, activeItemIds) => {
              setSelectedScopeItemIds((prev) => {
                if (checked) {
                  const merged = new Set([...prev, ...activeItemIds]);
                  return Array.from(merged);
                }
                return prev.filter((id) => !activeItemIds.includes(id));
              });
            }}
            onCancelSelected={() => {
              setBulkLineCancelReason('');
              setShowBulkLineCancelDialog(true);
            }}
            cancellationDisabled={!canCancelScopeLines || actionLoading || lineItemCancelSaving}
            bulkCancelDisabled={
              !canCancelScopeLines ||
              actionLoading ||
              lineItemCancelSaving ||
              selectedScopeItemIds.length === 0
            }
          />
        </div>
      )}

      {/* ========== DISCOUNTS TAB ========== */}
      {activeTab === 3 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Discounts</h2>
          {order.discounts.length === 0 ? (
            <p className="text-sm text-gray-500">No discounts applied.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {order.discounts.map((discount) => (
                <div
                  key={discount.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {discount.type === 'percentage'
                        ? `${discount.value}% discount`
                        : formatCurrency(discount.amount, order.currency)}
                    </p>
                    <p className="text-xs text-gray-500">{discount.reason}</p>
                  </div>
                  <StatusBadge
                    label={discount.approvalStatus}
                    variant={
                      discount.approvalStatus === 'approved'
                        ? 'success'
                        : discount.approvalStatus === 'rejected'
                          ? 'error'
                          : 'warning'
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========== CHANGE ORDERS TAB ========== */}
      {activeTab === 4 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Change Orders</h2>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                  {pendingCount} pending
                </span>
              )}
              {order.totalChangeOrderValue !== 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    order.totalChangeOrderValue >= 0
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-rose-50 text-rose-700'
                  }`}
                  title="Approved CO value — included in current order total"
                >
                  {order.totalChangeOrderValue >= 0 ? '+' : ''}
                  {formatCurrency(order.totalChangeOrderValue, order.currency)} applied
                </span>
              )}
            </div>
            {order.status !== 'cancelled' && (
              <button
                type="button"
                onClick={() => setShowChangeOrderWizard(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
              >
                <Plus className="h-3.5 w-3.5" />
                Request change order
              </button>
            )}
          </div>
          {changeOrders.length === 0 ? (
            <p className="text-sm text-gray-500">No change orders yet.</p>
          ) : (
            <div className="space-y-2">
              {/* Drafts sort to the top so users looking to resume a
                  half-finished CO don't have to scroll past approved
                  ones. Within drafts we order by most-recent first so
                  the freshest edit surfaces first. */}
              {[...changeOrders]
                .sort((a, b) => {
                  const aDraft = a.status === 'draft' ? 1 : 0;
                  const bDraft = b.status === 'draft' ? 1 : 0;
                  if (aDraft !== bDraft) return bDraft - aDraft;
                  const aTime = a.updatedAt?.toMillis?.() ?? 0;
                  const bTime = b.updatedAt?.toMillis?.() ?? 0;
                  return bTime - aTime;
                })
                .map((co) => {
                const isDraft = co.status === 'draft';
                const itemChangeCount =
                  (co.itemsAdded?.length ?? 0) +
                  (co.itemsRemoved?.length ?? 0) +
                  (co.itemsModified?.length ?? 0);
                const updatedAt = co.updatedAt?.toDate?.();
                return (
                <div
                  key={co.id}
                  className={`p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors ${
                    co.isPostScopeFreeze
                      ? 'border-red-300 bg-red-50/30'
                      : isDraft
                        ? 'border-indigo-300 bg-indigo-50/30'
                        : 'border-gray-200'
                  }`}
                  onClick={() => navigate(`/sales-orders/${orderId}/change-orders/${co.id}`)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-900">
                      {co.changeOrderNumber}
                      {co.title ? `: ${co.title}` : ''}
                    </span>
                    <StatusBadge
                      label={CO_STATUS_LABELS[co.status]}
                      variant={
                        co.status === 'approved'
                          ? 'success'
                          : co.status === 'rejected'
                            ? 'error'
                            : 'default'
                      }
                    />
                  </div>
                  {co.description && (
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {co.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span
                      className={`text-xs font-semibold ${
                        co.priceImpact >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {co.priceImpact >= 0 ? '+' : ''}
                      {formatCurrency(co.priceImpact, order.currency)}
                    </span>
                    {itemChangeCount > 0 && (
                      <span className="text-[11px] text-gray-500">
                        {itemChangeCount} item change{itemChangeCount > 1 ? 's' : ''}
                      </span>
                    )}
                    {co.negotiatedAdjustmentNote && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-amber-200 bg-amber-50 text-amber-700"
                        title={co.negotiatedAdjustmentNote}
                      >
                        Negotiated terms
                      </span>
                    )}
                    {co.isPostScopeFreeze && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-red-200 bg-red-50 text-red-700">
                        <AlertTriangle className="h-3 w-3" />
                        Post-freeze
                      </span>
                    )}
                    {isDraft && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-indigo-200 bg-indigo-50 text-indigo-700">
                        Draft — click to continue
                      </span>
                    )}
                    {updatedAt && (
                      <span className="ml-auto text-[11px] text-gray-400">
                        Updated{' '}
                        {updatedAt.toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========== DESIGN SIGN-OFF TAB ========== */}
      {activeTab === 5 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Design Sign-Offs</h2>
          {signOffs.length === 0 ? (
            <p className="text-sm text-gray-500">No design sign-off requests yet.</p>
          ) : (
            <div className="space-y-2">
              {signOffs.map((dso) => (
                <div
                  key={dso.id}
                  className="p-3 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-900">
                      {dso.signOffNumber}: {dso.title}
                    </span>
                    <StatusBadge
                      label={DSO_STATUS_LABELS[dso.status]}
                      variant={
                        dso.status === 'approved'
                          ? 'success'
                          : dso.status === 'rejected'
                            ? 'error'
                            : 'default'
                      }
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Scope version: v{dso.scopeVersion} | Documents: {dso.designDocuments.length}
                  </p>
                  {dso.scopeVersion !== order.scopeVersion && dso.status !== 'superseded' && (
                    <div className="flex items-start gap-2 mt-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      Scope version mismatch — current is v{order.scopeVersion}, this sign-off is for v{dso.scopeVersion}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========== RISK & AUDIT TAB ========== */}
      {activeTab === 6 && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-sm font-semibold text-gray-900">Risk Management</h2>
              <button
                type="button"
                onClick={() => void handleRunRiskDetection()}
                disabled={riskSaving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md disabled:opacity-50"
              >
                {riskSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                Run Auto Detection
              </button>
            </div>

            {riskActionMessage && (
              <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                {riskActionMessage}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Risk Type</label>
                <select
                  value={riskType}
                  onChange={(e) => setRiskType(e.target.value as RiskType)}
                  className="w-full px-2 py-1.5 border rounded text-xs bg-white"
                >
                  {Object.entries(RISK_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Severity</label>
                <select
                  value={riskSeverity}
                  onChange={(e) => setRiskSeverity(e.target.value as RiskSeverity)}
                  className="w-full px-2 py-1.5 border rounded text-xs bg-white"
                >
                  {RISK_SEVERITY_ORDER.map((severity) => (
                    <option key={severity} value={severity}>
                      {severity}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] text-gray-500 mb-1">Message</label>
                <input
                  type="text"
                  value={riskMessage}
                  onChange={(e) => setRiskMessage(e.target.value)}
                  placeholder="Describe the risk and context"
                  className="w-full px-2 py-1.5 border rounded text-xs"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => void handleAddManualRisk()}
                disabled={riskSaving || !riskMessage.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50"
              >
                {riskSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add Risk Flag
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Active Risk Flags</h2>
            <RiskFlagBanner riskFlags={order.riskFlags} />
            {activeRisks.length === 0 && (
              <p className="text-sm text-gray-500">No active risk flags.</p>
            )}
            {activeRisks.length > 0 && (
              <div className="mt-4 space-y-3">
                {activeRisks.map((risk) => (
                  <div key={risk.id} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-gray-900">
                        {RISK_TYPE_LABELS[risk.type]}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] uppercase bg-gray-100 text-gray-700">
                        {risk.severity}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {risk.autoDetected ? 'Auto-detected' : 'Manual'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">{risk.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Created {formatDate(risk.createdAt)}
                    </p>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-5 gap-2">
                      <input
                        type="text"
                        value={riskResolutionNotes[risk.id] || ''}
                        onChange={(e) =>
                          setRiskResolutionNotes((prev) => ({ ...prev, [risk.id]: e.target.value }))
                        }
                        placeholder="Resolution notes (optional)"
                        className="md:col-span-4 px-2 py-1.5 border rounded text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => void handleResolveRisk(risk.id)}
                        disabled={riskSaving}
                        className="px-2 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded disabled:opacity-50"
                      >
                        Resolve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Resolved Risks</h2>
            {resolvedRisks.length === 0 ? (
              <p className="text-sm text-gray-500">No resolved risks yet.</p>
            ) : (
              <div className="space-y-2">
                {resolvedRisks.map((risk) => (
                  <div key={risk.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-gray-800">
                        {RISK_TYPE_LABELS[risk.type]}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] uppercase bg-white text-gray-600 border border-gray-200">
                        {risk.severity}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{risk.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Resolved {risk.resolvedAt ? formatDate(risk.resolvedAt) : '—'}
                      {risk.resolutionNotes ? ` · ${risk.resolutionNotes}` : ''}
                    </p>
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => void handleReopenRisk(risk.id)}
                        disabled={riskSaving}
                        className="px-2 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded disabled:opacity-50"
                      >
                        Reopen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Full Audit Trail</h2>
            <StatusTimeline statusHistory={order.statusHistory} />
          </div>
        </div>
      )}

      {/* Cancel Order Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Cancel Sales Order</h3>
              <button
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                onClick={() => setShowCancelDialog(false)}
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600 mb-4">
                This will cancel <strong>{order.orderNumber}</strong>. The order will remain in the
                system for audit purposes but can no longer be advanced. You can permanently delete it
                afterwards if needed.
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cancellation reason <span className="text-red-500">*</span>
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="e.g. Client withdrew, duplicate order, project cancelled..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200">
              <button
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                onClick={() => setShowCancelDialog(false)}
                disabled={actionLoading}
              >
                Keep Order
              </button>
              <button
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleCancel}
                disabled={actionLoading || !cancelReason.trim()}
              >
                {actionLoading ? 'Cancelling...' : 'Cancel Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete payment */}
      {paymentPendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Delete payment</h3>
              <button
                type="button"
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                onClick={() => setPaymentPendingDelete(null)}
                disabled={paymentDeleteSaving}
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <p className="text-sm text-gray-600">
                Remove this payment from{' '}
                <strong>{order.orderNumber}</strong>? Totals and balance will be recalculated.
              </p>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {paymentPendingDelete.qboPaymentId
                  ? 'This payment is linked in QuickBooks. Deleting it here does not remove the payment in QBO — adjust there if needed.'
                  : 'This does not change QuickBooks unless you had already synced; you can sync again after fixing data.'}
              </div>
              <p className="text-xs text-gray-500">
                {formatCurrency(paymentPendingDelete.amount, paymentPendingDelete.currency || order.currency)} ·{' '}
                {paymentPendingDelete.method} · {paymentPendingDelete.type}
              </p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200">
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                onClick={() => setPaymentPendingDelete(null)}
                disabled={paymentDeleteSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                onClick={() => void handleConfirmDeletePayment()}
                disabled={paymentDeleteSaving}
              >
                {paymentDeleteSaving ? 'Deleting…' : 'Delete payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Confirmation WhatsApp Dialog */}
      <OrderConfirmationDialog
        open={showOrderConfirmation}
        onClose={() => setShowOrderConfirmation(false)}
        phoneNumber={order.customerPhone || ''}
        customerId={order.customerId}
        customerName={order.customerName}
        salesOrder={{
          id: order.id,
          orderNumber: order.orderNumber,
          currentAmount: order.currentAmount,
          currency: order.currency,
          paymentTerms: order.paymentTerms,
        }}
      />

      {/* Deposit Request WhatsApp Dialog */}
      <DepositRequestDialog
        open={showDepositRequest}
        onClose={() => setShowDepositRequest(false)}
        phoneNumber={order.customerPhone || ''}
        customerId={order.customerId}
        customerName={order.customerName}
        salesOrder={{
          id: order.id,
          orderNumber: order.orderNumber,
          currentAmount: order.currentAmount,
          currency: order.currency,
          paymentTerms: order.paymentTerms,
        }}
      />

      {/* Payment Receipt WhatsApp Dialog */}
      <PaymentReceiptDialog
        open={showPaymentReceipt}
        onClose={() => {
          setShowPaymentReceipt(false);
          setPaymentReceiptPrefill(null);
        }}
        phoneNumber={order.customerPhone || ''}
        customerId={order.customerId}
        customerName={order.customerName}
        dealId={order.dealId}
        salesOrder={{
          id: order.id,
          orderNumber: order.orderNumber,
          currentAmount: order.currentAmount,
          currency: order.currency,
          paymentTerms: order.paymentTerms,
          qboInvoiceId: order.qboInvoiceId,
          qboInvoiceDocNumber: order.qboInvoiceDocNumber,
          subsidiaryId: order.subsidiaryId,
          payments: order.payments,
        }}
        existingPayment={
          paymentReceiptPrefill
            ? {
                id: paymentReceiptPrefill.id,
                type: paymentReceiptPrefill.type,
                method: paymentReceiptPrefill.method,
                amount: paymentReceiptPrefill.amount,
                currency: paymentReceiptPrefill.currency,
                paymentDate: paymentReceiptPrefill.paymentDate,
                recordedAt: paymentReceiptPrefill.recordedAt,
                receiptRef: paymentReceiptPrefill.receiptRef,
                receiptDocumentNumber: paymentReceiptPrefill.receiptDocumentNumber,
                receiptPdfUrl: paymentReceiptPrefill.receiptPdfUrl,
              }
            : undefined
        }
        balanceAfterThisPayment={
          paymentReceiptPrefill && order
            ? balanceAfterPayment(order, paymentReceiptPrefill)
            : undefined
        }
      />

      {order.dealId && crmDealForQuoteAppend && orderId && (
        <SelectItemsForSODialog
          open={showAppendFromQuoteDialog}
          onClose={() => setShowAppendFromQuoteDialog(false)}
          dealId={order.dealId}
          deal={crmDealForQuoteAppend}
          mode="append"
          existingSalesOrderId={orderId}
          onSalesOrderCreated={() => {
            setShowAppendFromQuoteDialog(false);
          }}
        />
      )}

      {/* Change Order Creation Wizard */}
      {showChangeOrderWizard && (
        <ChangeOrderCreateWizard
          salesOrder={order}
          userId={userId}
          userName={user?.displayName ?? undefined}
          subsidiaryId={order.subsidiaryId}
          onClose={() => setShowChangeOrderWizard(false)}
          onCreated={(coId) => navigate(`/sales-orders/${order.id}/change-orders/${coId}`)}
        />
      )}

      {/* Delete Order Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Permanently Delete Sales Order</h3>
              <button
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                onClick={() => setShowDeleteDialog(false)}
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-4">
              <div className="flex items-start gap-2 mb-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                This action cannot be undone.
              </div>
              <p className="text-sm text-gray-600">
                This will permanently delete <strong>{order.orderNumber}</strong> and all associated
                data. This is only allowed for draft or cancelled orders.
              </p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200">
              <button
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                onClick={() => setShowDeleteDialog(false)}
                disabled={actionLoading}
              >
                Keep Order
              </button>
              <button
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleDelete}
                disabled={actionLoading}
              >
                {actionLoading ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Scope Line Dialog */}
      {lineItemPendingCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Cancel Scope Line Item</h3>
              <button
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                onClick={() => {
                  if (lineItemCancelSaving) return;
                  setLineItemPendingCancel(null);
                  setLineItemCancelReason('');
                }}
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <p className="text-sm text-gray-600">
                Cancel line <strong>#{lineItemPendingCancel.lineNumber}</strong> on{' '}
                <strong>{order.orderNumber}</strong>?
              </p>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-sm font-medium text-gray-900">{lineItemPendingCancel.description}</p>
                <p className="text-xs text-gray-500">
                  {lineItemPendingCancel.quantity} {lineItemPendingCancel.unit} ·{' '}
                  {formatCurrency(lineItemPendingCancel.totalPrice, order.currency)}
                </p>
              </div>
              {!canCancelScopeLines && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  Line item cancellation is blocked once the order is in production, completed, or cancelled.
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason (optional)
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="e.g. Item no longer required by client"
                  value={lineItemCancelReason}
                  onChange={(e) => setLineItemCancelReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200">
              <button
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                onClick={() => {
                  setLineItemPendingCancel(null);
                  setLineItemCancelReason('');
                }}
                disabled={lineItemCancelSaving}
              >
                Keep Item
              </button>
              <button
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => void handleCancelLineItem()}
                disabled={lineItemCancelSaving || !canCancelScopeLines}
              >
                {lineItemCancelSaving ? 'Cancelling...' : 'Cancel Line'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Cancel Scope Lines Dialog */}
      {showBulkLineCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Cancel Selected Scope Lines</h3>
              <button
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                onClick={() => {
                  if (lineItemCancelSaving) return;
                  setShowBulkLineCancelDialog(false);
                  setBulkLineCancelReason('');
                }}
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <p className="text-sm text-gray-600">
                Cancel <strong>{selectedScopeItemIds.length}</strong> selected line item(s) on{' '}
                <strong>{order.orderNumber}</strong>?
              </p>
              {!canCancelScopeLines && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  Line item cancellation is blocked once the order is in production, completed, or cancelled.
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason (optional)
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                  placeholder="e.g. Scope trimmed after client review"
                  value={bulkLineCancelReason}
                  onChange={(e) => setBulkLineCancelReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200">
              <button
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                onClick={() => {
                  setShowBulkLineCancelDialog(false);
                  setBulkLineCancelReason('');
                }}
                disabled={lineItemCancelSaving}
              >
                Keep Items
              </button>
              <button
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => void handleBulkCancelLineItems()}
                disabled={lineItemCancelSaving || !canCancelScopeLines || selectedScopeItemIds.length === 0}
              >
                {lineItemCancelSaving ? 'Cancelling...' : 'Cancel Selected'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SalesOrderPaymentLine({
  order,
  pmt,
  onEdit,
  onDelete,
  onDownload,
  onSendWhatsApp,
  receiptDownloading,
  onSyncQBO,
  qboReady,
  syncBusy,
  showQboInvoiceRow,
}: {
  order: SalesOrder;
  pmt: PaymentRecord;
  onEdit: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onSendWhatsApp: () => void;
  receiptDownloading: boolean;
  onSyncQBO: () => void;
  qboReady: boolean;
  syncBusy: boolean;
  showQboInvoiceRow: boolean;
}) {
  const pmtDateObj = pmt.paymentDate?.toDate?.() || pmt.recordedAt?.toDate?.();
  return (
    <div className="space-y-1 rounded-lg border border-gray-100 p-2">
      <div className="flex items-start justify-between gap-2 text-xs">
        <div className="flex items-center flex-wrap gap-2 min-w-0">
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium capitalize shrink-0 ${
              pmt.type === 'deposit'
                ? 'bg-blue-100 text-blue-700'
                : pmt.type === 'full'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-purple-100 text-purple-700'
            }`}
          >
            {pmt.type}
          </span>
          {pmtDateObj && (
            <span className="text-gray-500 shrink-0">
              {pmtDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          )}
          <span className="text-gray-400">{pmt.method}</span>
          {pmt.receiptRef && <span className="text-gray-300">#{pmt.receiptRef}</span>}
          {pmt.receiptPdfUrl && (
            <span className="text-[10px] text-gray-400" title="PDF receipt on file">
              PDF
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <span className="font-medium text-gray-900 pr-1">
            {formatCurrency(pmt.amount, pmt.currency || order.currency)}
          </span>
          <button
            type="button"
            onClick={onDownload}
            disabled={receiptDownloading}
            className="p-1 rounded text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            title="Download payment receipt"
          >
            {receiptDownloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onSendWhatsApp}
            className="p-1 rounded text-green-600 hover:bg-green-50"
            title="Send payment receipt via WhatsApp (template + PDF)"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="p-1 rounded text-indigo-600 hover:bg-indigo-50"
            title="Edit payment"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1 rounded text-red-600 hover:bg-red-50"
            title="Delete payment"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between pl-0.5">
        {pmt.qboPaymentId ? (
          <a
            href={`https://app.qbo.intuit.com/app/recvpayment?txnId=${pmt.qboPaymentId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-green-600 hover:text-green-800"
          >
            Synced to QBO
          </a>
        ) : pmt.qboPaymentSyncStatus === 'error' ? (
          <span className="text-[10px] text-red-500" title={pmt.qboPaymentSyncError ?? ''}>
            QBO sync failed
          </span>
        ) : showQboInvoiceRow ? (
          <span className="text-[10px] text-gray-400">Not synced to QBO</span>
        ) : (
          <span className="text-[10px] text-gray-300">Invoice not synced</span>
        )}
        {!pmt.qboPaymentId && showQboInvoiceRow && qboReady && (
          <button
            type="button"
            onClick={onSyncQBO}
            disabled={syncBusy}
            className="text-[10px] px-1.5 py-0.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded disabled:opacity-50"
          >
            Sync to QBO
          </button>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-medium text-gray-900">{value}</span>
    </div>
  );
}

function StatusBadge({
  label,
  variant,
}: {
  label: string;
  variant: 'success' | 'error' | 'warning' | 'default';
}) {
  const config = {
    success: 'bg-green-100 text-green-700 border-green-200',
    error: 'bg-red-100 text-red-700 border-red-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    default: 'bg-gray-100 text-gray-700 border-gray-200',
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${config[variant]}`}
    >
      {label}
    </span>
  );
}
