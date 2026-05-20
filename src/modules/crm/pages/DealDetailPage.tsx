/**
 * Deal Detail Page
 * Full view of a single deal with stage management, linked entities, and activity
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, NavLink } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  User,
  MapPin,
  Tag,
  FolderOpen,
  Wrench,
  ChevronRight,
  Trash2,
  Edit3,
  Plus,
  Package,
  MessageCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  CreditCard,
  Send,
  ClipboardCheck,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/shared/hooks';
import { getDeal, updateDeal, updateDealStage, deleteDeal } from '../services/crmDealService';
import { DealForm, type DealFormValues } from '../components/deals/DealForm';
import { CreateProjectFromDealDialog } from '../components/deals/CreateProjectFromDealDialog';
import { ProductPickerDialog } from '../components/deals/ProductPickerDialog';
import { QuoteShareDialog } from '@/modules/whatsapp/components/QuoteShareDialog';
import { OrderUpdateDialog } from '@/modules/whatsapp/components/OrderUpdateDialog';
import { OrderConfirmationDialog } from '@/modules/whatsapp/components/OrderConfirmationDialog';
import { DepositRequestDialog } from '@/modules/whatsapp/components/DepositRequestDialog';
import { SelectItemsForSODialog } from '../components/deals/SelectItemsForSODialog';
import { LineItemApprovalDialog } from '@/modules/design-manager/components/client-portal/LineItemApprovalDialog';
import { findApprovedQuoteForProject } from '../services/dealToSalesOrderService';
import { getSalesOrder } from '@/modules/sales-orders/services/salesOrderService';
import { getSalesOrderForDeal } from '@/modules/sales-orders/services/salesOrderService';
import type { ClientQuote } from '@/modules/design-manager/types/clientPortal';
import type { CRMDeal, CRMDealStage } from '../types';
import type { PaymentTerms } from '@/modules/sales-orders/types';
import {
  CRM_DEAL_STAGE_LABELS,
  CRM_DEAL_STAGE_COLORS,
  CRM_DEAL_STAGE_ORDER,
  CRM_ACTIVE_DEAL_STAGES,
  DEAL_SOURCE_LABELS,
  DEAL_PRIORITY_LABELS,
  DEAL_PRIORITY_COLORS,
  CRM_DEFAULT_CURRENCY,
} from '../constants/crm.constants';
import { FullPageLoader } from '@/shared/components/feedback/FullPageLoader';
import { useRecordTracker } from '@/core/hooks/useRecordTracker';
import DealChangeOrderSummaryCard from '../components/deals/DealChangeOrderSummaryCard';
import DealNextActionChecklist from '../components/deals/DealNextActionChecklist';
import { CrossModuleEntityTabs } from '@/shared/components/navigation/CrossModuleEntityTabs';

function formatCurrency(value: number, currency: string): string {
  if (currency === 'UGX') return `UGX ${value.toLocaleString()}`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}

function formatDate(timestamp: { toDate?: () => Date; seconds?: number } | undefined): string {
  if (!timestamp) return '-';
  const date = timestamp.toDate?.() ?? new Date((timestamp.seconds ?? 0) * 1000);
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function DealDetailPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [deal, setDeal] = useState<CRMDeal | null>(null);
  const [loading, setLoading] = useState(true);
  // Log this record for the Global Search palette's recency boost + empty state.
  useRecordTracker({
    type: 'crm_deal',
    id: deal?.id,
    title: deal?.title ?? '',
    subtitle: deal?.customerName,
    module: 'crm',
  });
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showWhatsAppQuote, setShowWhatsAppQuote] = useState(false);
  const [showWhatsAppOrder, setShowWhatsAppOrder] = useState(false);
  const [showWonConfirm, setShowWonConfirm] = useState(false);
  const [showLostConfirm, setShowLostConfirm] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [lostProcessing, setLostProcessing] = useState(false);
  const [wonProcessing, setWonProcessing] = useState(false);
  const [showSOItemSelect, setShowSOItemSelect] = useState(false);
  const [showOrderConfirmation, setShowOrderConfirmation] = useState(false);
  const [showDepositRequest, setShowDepositRequest] = useState(false);
  const [showLineItemApproval, setShowLineItemApproval] = useState(false);
  const [showAppendQuoteLines, setShowAppendQuoteLines] = useState(false);
  const [approvalQuote, setApprovalQuote] = useState<ClientQuote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [linkedSalesOrder, setLinkedSalesOrder] = useState<{
    id: string;
    orderNumber: string;
    currentAmount: number;
    currency: string;
    paymentTerms?: PaymentTerms;
  } | null>(null);
  const [loadingSO, setLoadingSO] = useState(false);

  const loadDeal = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    const data = await getDeal(dealId);
    setDeal(data);
    setLoading(false);
  }, [dealId]);

  useEffect(() => {
    loadDeal();
  }, [loadDeal]);

  // Load linked sales order: explicit id, or any SO with dealId (open pipeline often has SO before linkedSalesOrderId is set)
  useEffect(() => {
    if (!deal || !dealId) return;
    let cancelled = false;
    const shouldLoad =
      Boolean(deal.linkedSalesOrderId) ||
      deal.stage === 'won' ||
      (Boolean(deal.linkedProjectId) && deal.stage !== 'lost');
    if (!shouldLoad) {
      setLinkedSalesOrder(null);
      return;
    }

    setLoadingSO(true);

    (async () => {
      try {
        let so = null;
        if (deal.linkedSalesOrderId) {
          so = await getSalesOrder(deal.linkedSalesOrderId);
        }
        if (!so) {
          so = await getSalesOrderForDeal(dealId);
        }
        if (!cancelled) {
          if (so) {
            setLinkedSalesOrder({
              id: so.id,
              orderNumber: so.orderNumber,
              currentAmount: so.currentAmount,
              currency: so.currency,
              paymentTerms: so.paymentTerms,
            });
          } else {
            setLinkedSalesOrder(null);
          }
        }
      } catch (err) {
        console.warn('Failed to load linked sales order:', err);
      } finally {
        if (!cancelled) setLoadingSO(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deal, dealId]);

  const handleStageChange = async (newStage: CRMDealStage) => {
    if (!dealId || !user || !deal) return;
    if (newStage === 'won') {
      setShowWonConfirm(true);
      return;
    }
    if (newStage === 'lost') {
      setShowLostConfirm(true);
      return;
    }
    try {
      await updateDealStage(dealId, newStage, user.uid, user.displayName || user.email || 'Unknown');
      await loadDeal();
    } catch (err) {
      console.error('Failed to change stage:', err);
    }
  };

  const handleMarkLost = async () => {
    if (!dealId || !user || !deal || !lostReason.trim()) return;
    setLostProcessing(true);
    try {
      await updateDealStage(dealId, 'lost', user.uid, user.displayName || user.email || 'Unknown', lostReason.trim());
      setShowLostConfirm(false);
      setLostReason('');
      await loadDeal();
    } catch (err) {
      console.error('Failed to mark deal as lost:', err);
    } finally {
      setLostProcessing(false);
    }
  };

  const handleMarkWon = async () => {
    if (!dealId || !user || !deal) return;
    setWonProcessing(true);
    try {
      // 1. Mark the deal as won
      await updateDealStage(dealId, 'won', user.uid, user.displayName || user.email || 'Unknown');
      await loadDeal();

      // 2. Close won dialog and open item selection dialog for SO creation
      setShowWonConfirm(false);
      setShowSOItemSelect(true);
    } catch (err: any) {
      console.error('Failed to mark deal as won:', err);
      await loadDeal();
    } finally {
      setWonProcessing(false);
    }
  };

  const handleSOCreated = async (salesOrderId: string) => {
    // Reload deal to pick up linkedSalesOrderId write-back
    await loadDeal();
    // Fetch the new SO for linked entity display
    const so = await getSalesOrder(salesOrderId);
    if (so) {
      setLinkedSalesOrder({
        id: so.id,
        orderNumber: so.orderNumber,
        currentAmount: so.currentAmount,
        currency: so.currency,
        paymentTerms: so.paymentTerms,
      });
    }
  };

  const handleOpenLineItemApproval = async () => {
    if (!deal?.linkedProjectId) return;
    setLoadingQuote(true);
    try {
      let preferQuoteId: string | undefined;
      const soId = deal.linkedSalesOrderId ?? linkedSalesOrder?.id;
      if (soId) {
        const so = await getSalesOrder(soId);
        preferQuoteId = so?.quoteId || undefined;
      }
      const quote = await findApprovedQuoteForProject(deal.linkedProjectId, {
        preferQuoteId,
      });
      if (quote) {
        setApprovalQuote(quote);
        setShowLineItemApproval(true);
      }
    } catch (err) {
      console.warn('Failed to load quote for approval:', err);
    } finally {
      setLoadingQuote(false);
    }
  };

  const handleDelete = async () => {
    if (!dealId) return;
    await deleteDeal(dealId);
    navigate('/crm/deals');
  };

  const handleEdit = async (values: DealFormValues) => {
    if (!dealId || !user) return;
    await updateDeal(dealId, {
      title: values.title,
      description: values.description,
      customerId: values.customerId,
      customerName: values.customerName,
      stage: values.stage,
      priority: values.priority,
      source: values.source,
      estimatedValue: values.estimatedValue,
      currency: values.currency || CRM_DEFAULT_CURRENCY,
      expectedCloseDate: values.expectedCloseDate ? Timestamp.fromDate(new Date(values.expectedCloseDate)) : undefined,
      siteLocation: values.siteLocation,
      tags: values.tags,
      notes: values.notes,
    }, user.uid);
    await loadDeal();
  };

  if (loading) return <FullPageLoader />;
  if (!deal) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Deal not found.</p>
        <NavLink to="/crm/deals" className="text-blue-600 text-sm mt-2 inline-block">Back to Deals</NavLink>
      </div>
    );
  }

  const currentStageIndex = CRM_DEAL_STAGE_ORDER.indexOf(deal.stage);
  const nextStage = CRM_ACTIVE_DEAL_STAGES[CRM_ACTIVE_DEAL_STAGES.indexOf(deal.stage) + 1];
  /** Prefer deal FK; fall back to loaded SO (e.g. won deal resolved via dealId query). */
  const effectiveSalesOrderId = deal.linkedSalesOrderId ?? linkedSalesOrder?.id ?? null;

  const LOST_REASON_CHIPS = [
    'Price too high',
    'Chose competitor',
    'Project cancelled',
    'No response',
    'Budget constraints',
    'Timeline mismatch',
  ];

  return (
    <div className="space-y-6">
      {/* Back + Title | cross-module tabs + actions (inline on the right) */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button onClick={() => navigate('/crm/deals')} className="p-1.5 hover:bg-gray-100 rounded-lg flex-shrink-0">
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900 truncate">{deal.title}</h2>
              <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border flex-shrink-0 ${CRM_DEAL_STAGE_COLORS[deal.stage]}`}>
                {CRM_DEAL_STAGE_LABELS[deal.stage]}
              </span>
            </div>
            <p className="text-sm text-gray-500">{deal.dealNumber}</p>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:items-end lg:flex-row lg:items-center lg:gap-3 lg:shrink-0">
          <CrossModuleEntityTabs
            links={{
              dealId: deal.id,
              designProjectId: deal.linkedProjectId,
              salesOrderId: deal.linkedSalesOrderId ?? linkedSalesOrder?.id,
              manufacturingOrderId: deal.linkedMOIds?.[0],
            }}
            className="w-fit sm:ml-auto lg:ml-0"
          />
          {/* All action buttons — inline, single row */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Won/Lost status badges OR action buttons */}
          {deal.stage === 'won' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-800 text-sm font-semibold rounded-lg border border-green-200">
              <CheckCircle2 className="h-4 w-4" />
              Won
            </span>
          ) : deal.stage === 'lost' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-800 text-sm font-semibold rounded-lg border border-red-200">
              <AlertTriangle className="h-4 w-4" />
              Lost
            </span>
          ) : (
            <>
              <button
                onClick={() => setShowWonConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 shadow-sm"
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark Won
              </button>
              <button
                onClick={() => setShowLostConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-red-600 text-sm font-medium rounded-lg border border-red-300 hover:bg-red-50"
              >
                <AlertTriangle className="h-4 w-4" />
                Mark Lost
              </button>
            </>
          )}

          {/* Approve line items — any stage except lost, including won with an SO (progressive approval) */}
          {deal.linkedProjectId && deal.stage !== 'lost' && (
            <button
              onClick={handleOpenLineItemApproval}
              disabled={loadingQuote}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 shadow-sm disabled:opacity-50"
            >
              {loadingQuote ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ClipboardCheck className="h-4 w-4" />
              )}
              Approve line items
            </button>
          )}

          {/* Add newly approved quote lines to an existing sales order */}
          {effectiveSalesOrderId && deal.linkedProjectId && deal.stage !== 'lost' && (
            <button
              onClick={() => setShowAppendQuoteLines(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 shadow-sm"
            >
              <Package className="h-4 w-4" />
              Add quote lines to order
            </button>
          )}

          {/* WhatsApp dropdown */}
          <div className="relative group">
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 shadow-sm">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </button>
            <div className="absolute right-0 mt-1 w-48 bg-white border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
              <button
                onClick={() => setShowWhatsAppQuote(true)}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-lg"
              >
                Share Quote
              </button>
              <button
                onClick={() => setShowWhatsAppOrder(true)}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Send Order Update
              </button>
              {linkedSalesOrder && (
                <button
                  onClick={() => setShowOrderConfirmation(true)}
                  className="w-full text-left px-3 py-2 text-sm text-green-700 hover:bg-green-50 font-medium"
                >
                  Send Order Confirmation
                </button>
              )}
              {linkedSalesOrder && (
                <button
                  onClick={() => setShowDepositRequest(true)}
                  className="w-full text-left px-3 py-2 text-sm text-green-700 hover:bg-green-50 last:rounded-b-lg font-medium"
                >
                  Request Deposit Payment
                </button>
              )}
            </div>
          </div>

          {/* Edit */}
          <button
            onClick={() => setShowEditForm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
          >
            <Edit3 className="h-4 w-4" />
            Edit
          </button>

          {/* Delete */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
            title="Delete deal"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          </div>
        </div>
      </div>

      {/* Stage Progress */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Pipeline Progress</h3>
        <div className="flex items-center gap-1">
          {CRM_ACTIVE_DEAL_STAGES.map((stage, i) => {
            const stageIdx = CRM_DEAL_STAGE_ORDER.indexOf(stage);
            const isActive = stage === deal.stage;
            const isPast = stageIdx < currentStageIndex && deal.stage !== 'lost' && deal.stage !== 'on_hold';
            return (
              <div key={stage} className="flex-1 flex items-center">
                <button
                  onClick={() => handleStageChange(stage)}
                  className={`flex-1 h-8 rounded text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : isPast
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {CRM_DEAL_STAGE_LABELS[stage]}
                </button>
                {i < CRM_ACTIVE_DEAL_STAGES.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-gray-300 mx-0.5 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
        {nextStage && deal.stage !== 'won' && deal.stage !== 'lost' && (
          <div className="mt-3">
            <button
              onClick={() => handleStageChange(nextStage)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Advance to {CRM_DEAL_STAGE_LABELS[nextStage]} →
            </button>
          </div>
        )}
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Financial */}
          <div className="bg-white rounded-lg border p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Financials</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500">Estimated Value</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(deal.estimatedValue, deal.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Probability</p>
                <p className="text-lg font-bold text-gray-900">{deal.probability}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Weighted Value</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(deal.weightedValue, deal.currency)}
                </p>
              </div>
            </div>
          </div>

          {/* Linked Entities */}
          <div className="bg-white rounded-lg border p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Linked Entities</h3>
            <div className="space-y-2">
              {deal.linkedProjectId ? (
                <div className="flex items-center justify-between">
                  <NavLink
                    to={`/design/project/${deal.linkedProjectId}`}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 text-sm text-blue-600"
                  >
                    <FolderOpen className="h-4 w-4" />
                    <span>Design Project: {deal.linkedProjectId}</span>
                  </NavLink>
                  <button
                    onClick={() => setShowProductPicker(true)}
                    className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium px-2 py-1 rounded hover:bg-purple-50"
                  >
                    <Package className="h-3.5 w-3.5" />
                    Add Product
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreateProject(true)}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-blue-50 text-sm text-blue-600 border border-dashed border-blue-300 w-full"
                >
                  <Plus className="h-4 w-4" />
                  Create Design Project
                </button>
              )}
              {/* Sales Order */}
              {loadingSO ? (
                <div className="flex items-center gap-2 p-2 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking sales order...
                </div>
              ) : linkedSalesOrder ? (
                <div className="flex items-center justify-between">
                  <NavLink
                    to={`/sales-orders/${linkedSalesOrder.id}`}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 text-sm text-blue-600"
                  >
                    <CreditCard className="h-4 w-4" />
                    <span>Sales Order: {linkedSalesOrder.orderNumber}</span>
                  </NavLink>
                  <button
                    onClick={() => setShowOrderConfirmation(true)}
                    className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium px-2 py-1 rounded hover:bg-green-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send Confirmation
                  </button>
                </div>
              ) : deal.stage === 'won' ? (
                <button
                  onClick={() => setShowSOItemSelect(true)}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-green-50 text-sm text-green-600 border border-dashed border-green-300 w-full"
                >
                  <Plus className="h-4 w-4" />
                  Create Sales Order
                </button>
              ) : null}

              {/* Manufacturing Orders */}
              {deal.linkedMOIds.length > 0 ? (
                deal.linkedMOIds.map((moId) => (
                  <NavLink
                    key={moId}
                    to={`/manufacturing/orders/${moId}`}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 text-sm text-blue-600"
                  >
                    <Wrench className="h-4 w-4" />
                    <span>Manufacturing Order: {moId}</span>
                  </NavLink>
                ))
              ) : (
                <p className="text-sm text-gray-400 flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  No manufacturing orders linked
                </p>
              )}
            </div>
          </div>

          {/* Change Order Summary — populated by the CO service when
              this deal's SO has COs. Also shows a "Request CO" CTA
              whenever an SO exists. */}
          <DealChangeOrderSummaryCard
            summary={deal.changeOrderSummary}
            linkedSalesOrderId={linkedSalesOrder?.id ?? deal.linkedSalesOrderId ?? null}
            currency={deal.currency || CRM_DEFAULT_CURRENCY}
          />

          {/* What's needed next — derived checklist over deal state +
              linked SO + CO summary. Purely presentational. */}
          <DealNextActionChecklist
            deal={deal}
            hasLinkedProject={Boolean(deal.linkedProjectId)}
            hasLinkedSalesOrder={Boolean(linkedSalesOrder?.id ?? deal.linkedSalesOrderId)}
            linkedSalesOrderId={linkedSalesOrder?.id ?? deal.linkedSalesOrderId ?? null}
          />

          {/* Description */}
          {deal.description && (
            <div className="bg-white rounded-lg border p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{deal.description}</p>
            </div>
          )}

          {/* Notes */}
          {deal.notes && (
            <div className="bg-white rounded-lg border p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Notes</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{deal.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Customer */}
          <div className="bg-white rounded-lg border p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Customer</h3>
            <NavLink
              to={`/customers/${deal.customerId}`}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
            >
              <User className="h-4 w-4" />
              {deal.customerName}
            </NavLink>
          </div>

          {/* Details */}
          <div className="bg-white rounded-lg border p-4 space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Details</h3>
            <div className="text-sm">
              <p className="text-gray-500">Priority</p>
              <p className={`font-medium ${DEAL_PRIORITY_COLORS[deal.priority]}`}>
                {DEAL_PRIORITY_LABELS[deal.priority]}
              </p>
            </div>
            <div className="text-sm">
              <p className="text-gray-500">Source</p>
              <p className="text-gray-900">{DEAL_SOURCE_LABELS[deal.source]}</p>
            </div>
            <div className="text-sm">
              <p className="text-gray-500">Owner</p>
              <p className="text-gray-900">{deal.ownerName}</p>
            </div>
            {deal.expectedCloseDate && (
              <div className="text-sm flex items-start gap-1.5">
                <Calendar className="h-4 w-4 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-gray-500">Expected Close</p>
                  <p className="text-gray-900">{formatDate(deal.expectedCloseDate)}</p>
                </div>
              </div>
            )}
            {deal.siteLocation?.address && (
              <div className="text-sm flex items-start gap-1.5">
                <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-gray-500">Location</p>
                  <p className="text-gray-900">
                    {[deal.siteLocation.address, deal.siteLocation.city, deal.siteLocation.country]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Tags */}
          {deal.tags.length > 0 && (
            <div className="bg-white rounded-lg border p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {deal.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="bg-white rounded-lg border p-4 space-y-2 text-xs text-gray-400">
            <p>Created: {formatDate(deal.createdAt)}</p>
            <p>Updated: {formatDate(deal.updatedAt)}</p>
            {deal.actualCloseDate && <p>Closed: {formatDate(deal.actualCloseDate)}</p>}
          </div>
        </div>
      </div>

      {/* Edit Form */}
      {showEditForm && (
        <DealForm deal={deal} onSubmit={handleEdit} onClose={() => setShowEditForm(false)} />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Deal?</h3>
            <p className="text-sm text-gray-500 mb-4">
              This will permanently delete "{deal.title}". This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark Won Confirmation Dialog */}
      {showWonConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => !wonProcessing && setShowWonConfirm(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Mark Deal as Won?</h3>
            <p className="text-sm text-gray-500 mb-4">
              This will mark "{deal.title}" as won. You'll then be able to select which
              quoted items to include in a new Sales Order.
            </p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm space-y-1">
              <p><span className="text-gray-500">Customer:</span> <span className="font-medium">{deal.customerName}</span></p>
              <p><span className="text-gray-500">Value:</span> <span className="font-medium">{formatCurrency(deal.estimatedValue, deal.currency)}</span></p>
              <p>
                <span className="text-gray-500">Project:</span>{' '}
                <span className="font-medium">{deal.linkedProjectId ? 'Linked' : 'No project linked'}</span>
              </p>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowWonConfirm(false)}
                disabled={wonProcessing}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkWon}
                disabled={wonProcessing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {wonProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm Won
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark Lost Confirmation Dialog */}
      {showLostConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => !lostProcessing && setShowLostConfirm(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Mark Deal as Lost?</h3>
            <p className="text-sm text-gray-500 mb-4">
              Please provide a reason for losing "{deal.title}".
            </p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm space-y-1">
              <p><span className="text-gray-500">Customer:</span> <span className="font-medium">{deal.customerName}</span></p>
              <p><span className="text-gray-500">Value:</span> <span className="font-medium">{formatCurrency(deal.estimatedValue, deal.currency)}</span></p>
            </div>

            {/* Quick-select reason chips */}
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 mb-2">Quick select reason:</p>
              <div className="flex flex-wrap gap-1.5">
                {LOST_REASON_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => setLostReason(chip)}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                      lostReason === chip
                        ? 'bg-red-100 border-red-300 text-red-700 font-medium'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom reason / notes */}
            <textarea
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="Enter reason for losing this deal..."
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-red-200 focus:border-red-400 outline-none resize-none mb-4"
            />

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowLostConfirm(false); setLostReason(''); }}
                disabled={lostProcessing}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkLost}
                disabled={lostProcessing || !lostReason.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {lostProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4" />
                    Confirm Lost
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Design Project Dialog */}
      <CreateProjectFromDealDialog
        deal={deal}
        open={showCreateProject}
        onClose={() => setShowCreateProject(false)}
        onProjectCreated={() => loadDeal()}
      />

      {/* Product Picker Dialog */}
      {deal.linkedProjectId && (
        <ProductPickerDialog
          open={showProductPicker}
          onClose={() => setShowProductPicker(false)}
          projectId={deal.linkedProjectId}
          onProductAdded={() => loadDeal()}
        />
      )}

      {/* WhatsApp Quote Share Dialog */}
      <QuoteShareDialog
        open={showWhatsAppQuote}
        onClose={() => setShowWhatsAppQuote(false)}
        phoneNumber={deal.customerPhone || ''}
        customerId={deal.customerId}
        dealId={dealId}
        dealTitle={deal.title}
        linkedProjectId={deal.linkedProjectId}
        customerName={deal.customerName || 'Customer'}
      />

      {/* WhatsApp Order Update Dialog */}
      <OrderUpdateDialog
        open={showWhatsAppOrder}
        onClose={() => setShowWhatsAppOrder(false)}
        phoneNumber={deal.customerPhone || ''}
        dealId={dealId}
        dealTitle={deal.title}
        customerName={deal.customerName}
      />

      {/* Order Confirmation Dialog */}
      {linkedSalesOrder && (
        <OrderConfirmationDialog
          open={showOrderConfirmation}
          onClose={() => setShowOrderConfirmation(false)}
          phoneNumber={deal.customerPhone || ''}
          customerId={deal.customerId}
          customerName={deal.customerName}
          dealId={dealId}
          dealTitle={deal.title}
          salesOrder={linkedSalesOrder}
        />
      )}

      {/* Deposit Payment Request Dialog */}
      {linkedSalesOrder && (
        <DepositRequestDialog
          open={showDepositRequest}
          onClose={() => setShowDepositRequest(false)}
          phoneNumber={deal.customerPhone || ''}
          customerId={deal.customerId}
          customerName={deal.customerName}
          dealId={dealId}
          dealTitle={deal.title}
          salesOrder={linkedSalesOrder}
        />
      )}

      {/* Select Items for Sales Order Dialog */}
      {dealId && (
        <SelectItemsForSODialog
          open={showSOItemSelect}
          onClose={() => setShowSOItemSelect(false)}
          dealId={dealId}
          deal={deal}
          mode="create"
          onSalesOrderCreated={(soId) => {
            setShowSOItemSelect(false);
            handleSOCreated(soId);
          }}
        />
      )}

      {dealId && effectiveSalesOrderId && (
        <SelectItemsForSODialog
          open={showAppendQuoteLines}
          onClose={() => setShowAppendQuoteLines(false)}
          dealId={dealId}
          deal={deal}
          mode="append"
          existingSalesOrderId={effectiveSalesOrderId}
          onSalesOrderCreated={async (soId) => {
            setShowAppendQuoteLines(false);
            await handleSOCreated(soId);
          }}
        />
      )}

      {/* Line Item Approval Dialog */}
      {approvalQuote && (
        <LineItemApprovalDialog
          open={showLineItemApproval}
          onClose={() => {
            setShowLineItemApproval(false);
            setApprovalQuote(null);
          }}
          quote={approvalQuote}
          onApproved={() => {
            setShowLineItemApproval(false);
            setApprovalQuote(null);
            void loadDeal();
          }}
        />
      )}
    </div>
  );
}
