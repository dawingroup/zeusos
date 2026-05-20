/**
 * ChangeOrderCreateWizard — 3-step modal for creating a Change Order.
 *
 *   1. Classify    — type, requester, title, description, reason
 *   2. Line items  — add new, remove existing, modify quantities
 *   3. Review      — price impact preview, timeline impact, approval
 *                    requirements, submit as draft or for internal review
 *
 * Props are deliberately minimal: the parent passes the parent SO and
 * a close callback. The wizard owns its own form state and, on submit,
 * calls `createChangeOrder` (optionally followed by
 * `submitForInternalApproval` if the user chose that path).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Check,
  Loader2,
  PackagePlus,
  PackageMinus,
  Pencil,
  Link2,
  Sparkles,
} from 'lucide-react';
import {
  createChangeOrder,
  submitForInternalApproval,
  updateChangeOrderDraft,
} from '../services/changeOrderService';
import { previewChangeOrderImpact } from '../services/pricingService';
import ChangeOrderPriceImpactCard from './ChangeOrderPriceImpactCard';
import ChangeOrderDesignItemPicker, {
  type ChangeOrderDesignItemPickerResult,
} from './ChangeOrderDesignItemPicker';
import type {
  ChangeOrder,
  ChangeOrderPriceImpact,
  ChangeOrderType,
  ItemCategory,
  SalesOrder,
  SalesOrderItem,
} from '../types';
import { CO_TYPE_LABELS, ITEM_CATEGORY_LABELS } from '../constants';
import type { CreateChangeOrderInput } from '../schemas';

interface Props {
  salesOrder: SalesOrder;
  userId: string;
  userName?: string;
  subsidiaryId: string;
  /**
   * When provided, the wizard opens in EDIT mode and prefills all
   * state from the existing draft CO. Submits route to
   * `updateChangeOrderDraft` instead of creating a new CO.
   * Only drafts can be edited — the caller must gate on `status === 'draft'`.
   */
  existingCO?: ChangeOrder;
  onClose: () => void;
  onCreated?: (coId: string) => void;
  /** Called after a successful update in edit mode. */
  onUpdated?: (coId: string) => void;
}

type DraftAddItem = {
  tempId: string;
  description: string;
  specification?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  category: ItemCategory;
  designItemId?: string;
};

type DraftRemoval = {
  itemId: string;
  description: string;
  amount: number;
};

type DraftModification = {
  itemId: string;
  field: 'quantity' | 'unitPrice' | 'description' | 'specification';
  oldValue: string;
  newValue: string;
  priceImpact: number;
};

const CO_TYPE_OPTIONS: ChangeOrderType[] = [
  'scope_addition',
  'scope_removal',
  'scope_modification',
  'price_adjustment',
  'timeline_change',
  'specification_change',
];

const CATEGORY_OPTIONS: ItemCategory[] = [
  'furniture',
  'fitout',
  'installation',
  'design_fee',
  'consultation',
  'other',
];

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function tempId(): string {
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ── Draft persistence ──────────────────────────────────────────────────
// The wizard state is purely in-memory React state, so a tab switch
// (e.g. jumping to Design Manager to price an item) would blow it
// away. We auto-save a serialized snapshot to localStorage on every
// state change, keyed by SO id, with a 7-day TTL so abandoned drafts
// don't accumulate forever. Restored on wizard re-mount via a
// "Resume?" banner.

const DRAFT_KEY_PREFIX = 'co-wizard-draft:';
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface PersistedWizardDraft {
  savedAt: number;
  step: 1 | 2 | 3;
  type: ChangeOrderType;
  requestedBy: 'client' | 'internal';
  title: string;
  description: string;
  reason: string;
  itemsAdded: DraftAddItem[];
  removedIds: string[];
  modifications: DraftModification[];
  negotiatedMode: 'absolute_delta' | 'discount_percent';
  negotiatedValue: string;
  negotiatedNote: string;
  deliveryDateImpact: string;
  internalApprovalRequired: boolean;
  clientApprovalRequired: boolean;
  submitForReview: boolean;
}

function loadDraft(salesOrderId: string): PersistedWizardDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY_PREFIX + salesOrderId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedWizardDraft;
    if (!parsed.savedAt || Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(DRAFT_KEY_PREFIX + salesOrderId);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveDraft(salesOrderId: string, draft: PersistedWizardDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY_PREFIX + salesOrderId, JSON.stringify(draft));
  } catch {
    // quota / access errors — silent
  }
}

function clearDraft(salesOrderId: string): void {
  try {
    localStorage.removeItem(DRAFT_KEY_PREFIX + salesOrderId);
  } catch {
    // ignore
  }
}

function isDraftEmpty(d: PersistedWizardDraft): boolean {
  return (
    !d.title.trim() &&
    !d.description.trim() &&
    !d.reason.trim() &&
    d.itemsAdded.length === 0 &&
    d.removedIds.length === 0 &&
    d.modifications.length === 0 &&
    !d.negotiatedValue.trim() &&
    !d.negotiatedNote.trim()
  );
}

export default function ChangeOrderCreateWizard({
  salesOrder,
  userId,
  userName,
  subsidiaryId,
  existingCO,
  onClose,
  onCreated,
  onUpdated,
}: Props) {
  const isEditMode = Boolean(existingCO);

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // ── Step 1 — classification ──────────────────────────────────────────
  // When opening an existing draft for editing, seed every field from
  // the CO doc so the user picks up exactly where they left off.
  const [type, setType] = useState<ChangeOrderType>(existingCO?.type ?? 'scope_addition');
  const [requestedBy, setRequestedBy] = useState<'client' | 'internal'>(
    existingCO?.requestedBy ?? 'client',
  );
  const [title, setTitle] = useState(existingCO?.title ?? '');
  const [description, setDescription] = useState(existingCO?.description ?? '');
  const [reason, setReason] = useState(existingCO?.reason ?? '');

  // ── Step 2 — line-item changes ───────────────────────────────────────
  const [itemsAdded, setItemsAdded] = useState<DraftAddItem[]>(() =>
    existingCO
      ? existingCO.itemsAdded.map((i) => ({
          tempId: tempId(),
          description: i.description,
          specification: i.specification,
          quantity: i.quantity,
          unit: i.unit,
          unitPrice: i.unitPrice,
          category: i.category,
          designItemId: i.designItemId,
        }))
      : [],
  );
  const [removedIds, setRemovedIds] = useState<Set<string>>(
    () => new Set((existingCO?.itemsRemoved ?? []).map((r) => r.itemId)),
  );
  const [modifications, setModifications] = useState<DraftModification[]>(
    () =>
      (existingCO?.itemsModified ?? []).map((m) => ({
        itemId: m.itemId,
        // Narrow the string `field` coming from Firestore to the union
        // the wizard uses. Falls back to 'quantity' for any unknown
        // field the UI can't render.
        field:
          m.field === 'quantity' ||
          m.field === 'unitPrice' ||
          m.field === 'description' ||
          m.field === 'specification'
            ? m.field
            : 'quantity',
        oldValue: m.oldValue,
        newValue: m.newValue,
        priceImpact: m.priceImpact,
      })),
  );
  const [negotiatedMode, setNegotiatedMode] = useState<'absolute_delta' | 'discount_percent'>(
    'absolute_delta',
  );
  const [negotiatedValue, setNegotiatedValue] = useState<string>(() => {
    if (!existingCO?.negotiatedPriceAdjustment) return '';
    return String(existingCO.negotiatedPriceAdjustment);
  });
  const [negotiatedNote, setNegotiatedNote] = useState<string>(
    existingCO?.negotiatedAdjustmentNote ?? '',
  );
  // Design-item picker drawer — when set, shows the picker bound to a
  // specific draft row so the user can attach/replace the design-item
  // linkage without leaving the wizard.
  const [pickerTargetRowId, setPickerTargetRowId] = useState<string | null>(null);

  // ── Step 3 — finalisation ────────────────────────────────────────────
  const [deliveryDateImpact, setDeliveryDateImpact] = useState<string>(
    existingCO?.deliveryDateImpact != null ? String(existingCO.deliveryDateImpact) : '',
  );
  const [internalApprovalRequired, setInternalApprovalRequired] = useState(
    existingCO?.internalApprovalRequired ?? true,
  );
  const [clientApprovalRequired, setClientApprovalRequired] = useState(
    existingCO?.clientApprovalRequired ?? true,
  );
  const [submitForReview, setSubmitForReview] = useState(true);

  const [impact, setImpact] = useState<ChangeOrderPriceImpact | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Draft persistence (localStorage) ─────────────────────────────────
  // Detected once on mount; if present, show a banner offering
  // Resume / Start fresh. We don't auto-restore so users aren't
  // surprised by stale data from a week ago.
  //
  // Edit mode (existingCO provided) skips this entirely — the Firestore
  // CO doc is already the source of truth, and the localStorage draft
  // was meant for in-flight new-CO drafts, not for edits of persisted
  // documents.
  const [pendingDraft, setPendingDraft] = useState<PersistedWizardDraft | null>(() => {
    if (isEditMode) return null;
    const d = loadDraft(salesOrder.id);
    return d && !isDraftEmpty(d) ? d : null;
  });
  const hasRestoredRef = useRef(false);

  const applyDraft = useCallback((d: PersistedWizardDraft) => {
    setStep(d.step);
    setType(d.type);
    setRequestedBy(d.requestedBy);
    setTitle(d.title);
    setDescription(d.description);
    setReason(d.reason);
    setItemsAdded(d.itemsAdded);
    setRemovedIds(new Set(d.removedIds));
    setModifications(d.modifications);
    setNegotiatedMode(d.negotiatedMode ?? 'absolute_delta');
    setNegotiatedValue(d.negotiatedValue ?? '');
    setNegotiatedNote(d.negotiatedNote ?? '');
    setDeliveryDateImpact(d.deliveryDateImpact);
    setInternalApprovalRequired(d.internalApprovalRequired);
    setClientApprovalRequired(d.clientApprovalRequired);
    setSubmitForReview(d.submitForReview);
    hasRestoredRef.current = true;
    setPendingDraft(null);
  }, []);

  const discardDraft = useCallback(() => {
    clearDraft(salesOrder.id);
    setPendingDraft(null);
  }, [salesOrder.id]);

  // Auto-save on state change. We skip the initial render so the very
  // first mount (with an unresolved "resume?" banner) doesn't wipe the
  // existing draft by writing an empty one on top.
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    // Skip saving while the user is still choosing whether to resume
    if (pendingDraft) return;
    // Edit mode writes directly to the Firestore CO on submit — no
    // need for a localStorage shadow copy.
    if (isEditMode) return;
    const draft: PersistedWizardDraft = {
      savedAt: Date.now(),
      step,
      type,
      requestedBy,
      title,
      description,
      reason,
      itemsAdded,
      removedIds: Array.from(removedIds),
      modifications,
      negotiatedMode,
      negotiatedValue,
      negotiatedNote,
      deliveryDateImpact,
      internalApprovalRequired,
      clientApprovalRequired,
      submitForReview,
    };
    if (isDraftEmpty(draft) && !hasRestoredRef.current) {
      // Don't pollute storage with blank wizards the user never filled
      return;
    }
    saveDraft(salesOrder.id, draft);
  }, [
    salesOrder.id,
    pendingDraft,
    isEditMode,
    step,
    type,
    requestedBy,
    title,
    description,
    reason,
    itemsAdded,
    removedIds,
    modifications,
    negotiatedMode,
    negotiatedValue,
    negotiatedNote,
    deliveryDateImpact,
    internalApprovalRequired,
    clientApprovalRequired,
    submitForReview,
  ]);

  // ── Derived ────────────────────────────────────────────────────────────
  const activeScopeItems = useMemo(
    () => salesOrder.scopeItems.filter((i) => i.isActive),
    [salesOrder.scopeItems],
  );

  const drafts = useMemo(() => {
    const removals: DraftRemoval[] = Array.from(removedIds).flatMap((id) => {
      const item = salesOrder.scopeItems.find((i) => i.id === id);
      if (!item) return [];
      return [
        {
          itemId: item.id,
          description: item.description,
          amount: item.totalPrice,
        },
      ];
    });
    return { removals };
  }, [removedIds, salesOrder.scopeItems]);

  const negotiatedAdjustment = useMemo(() => {
    const raw = Number(negotiatedValue || 0);
    if (!Number.isFinite(raw) || raw === 0) return 0;
    if (negotiatedMode === 'discount_percent') {
      const pct = Math.max(0, Math.min(100, raw));
      return -Math.round((salesOrder.currentAmount * pct) / 100);
    }
    return raw;
  }, [negotiatedMode, negotiatedValue, salesOrder.currentAmount]);

  const rawDelta = useMemo(() => {
    const added = itemsAdded.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const removed = drafts.removals.reduce((s, i) => s + i.amount, 0);
    const modified = modifications.reduce((s, m) => s + m.priceImpact, 0);
    const net = added - removed + modified + negotiatedAdjustment;
    return { added, removed, modified, negotiatedAdjustment, net };
  }, [itemsAdded, drafts.removals, modifications, negotiatedAdjustment]);

  const step1Valid =
    title.trim().length > 0 && description.trim().length > 0 && reason.trim().length > 0;
  const step2Valid =
    itemsAdded.length > 0 ||
    drafts.removals.length > 0 ||
    modifications.length > 0 ||
    negotiatedAdjustment !== 0;

  // ── Wizard navigation ────────────────────────────────────────────────
  const goNext = useCallback(async () => {
    setSubmitError(null);
    if (step === 1 && !step1Valid) return;
    if (step === 2 && !step2Valid) return;

    if (step === 2) {
      // Compute preview impact before showing review screen
      setImpactLoading(true);
      setImpactError(null);
      try {
        const preview = await previewChangeOrderImpact({
          salesOrderId: salesOrder.id,
          priceImpact: rawDelta.net,
          negotiatedPriceAdjustment: negotiatedAdjustment,
          itemsAdded: itemsAdded.map((i) => ({
            id: i.tempId,
            lineNumber: 0,
            description: i.description,
            specification: i.specification,
            quantity: i.quantity,
            unit: i.unit,
            unitPrice: i.unitPrice,
            totalPrice: i.quantity * i.unitPrice,
            category: i.category,
            designItemId: i.designItemId,
            fromQuoteVersion: salesOrder.scopeVersion,
            isActive: true,
          })),
          itemsRemoved: drafts.removals,
          itemsModified: modifications,
        });
        setImpact(preview);
      } catch (err) {
        setImpactError((err as Error).message);
        setImpact(null);
      } finally {
        setImpactLoading(false);
      }
    }

    setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s));
  }, [step, step1Valid, step2Valid, itemsAdded, drafts.removals, modifications, rawDelta.net, negotiatedAdjustment, salesOrder]);

  const goBack = useCallback(() => {
    setSubmitError(null);
    setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s));
  }, []);

  // ── Mutations on step 2 ──────────────────────────────────────────────
  const addRow = useCallback(() => {
    setItemsAdded((prev) => [
      ...prev,
      {
        tempId: tempId(),
        description: '',
        quantity: 1,
        unit: 'pcs',
        unitPrice: 0,
        category: 'furniture',
      },
    ]);
  }, []);

  const updateAdded = useCallback(
    (id: string, patch: Partial<DraftAddItem>) => {
      setItemsAdded((prev) =>
        prev.map((row) => (row.tempId === id ? { ...row, ...patch } : row)),
      );
    },
    [],
  );

  const removeAddedRow = useCallback((id: string) => {
    setItemsAdded((prev) => prev.filter((row) => row.tempId !== id));
  }, []);

  /**
   * Open the design-item picker for a new row that will be created
   * once the user picks or creates a DesignItem. The wizard maintains
   * a placeholder row id so the picker callback can patch it cleanly.
   */
  const openPickerForNewRow = useCallback(() => {
    const placeholderId = tempId();
    setItemsAdded((prev) => [
      ...prev,
      {
        tempId: placeholderId,
        description: '',
        quantity: 1,
        unit: 'pcs',
        unitPrice: 0,
        category: 'furniture',
      },
    ]);
    setPickerTargetRowId(placeholderId);
  }, []);

  const openPickerForRow = useCallback((rowId: string) => {
    setPickerTargetRowId(rowId);
  }, []);

  const handlePickerResult = useCallback(
    (result: ChangeOrderDesignItemPickerResult) => {
      if (!pickerTargetRowId) return;
      setItemsAdded((prev) =>
        prev.map((row) =>
          row.tempId === pickerTargetRowId
            ? {
                ...row,
                description: result.description,
                specification: result.specification,
                quantity: result.quantity,
                unitPrice: result.unitPrice,
                category: result.category,
                designItemId: result.designItemId,
              }
            : row,
        ),
      );
      setPickerTargetRowId(null);
    },
    [pickerTargetRowId],
  );

  const handlePickerClose = useCallback(() => {
    // If the row was created for the picker and has no designItemId yet,
    // assume the user cancelled and drop it to avoid dangling empty rows.
    if (pickerTargetRowId) {
      setItemsAdded((prev) =>
        prev.filter((row) => {
          if (row.tempId !== pickerTargetRowId) return true;
          return Boolean(row.designItemId) || row.description.trim().length > 0;
        }),
      );
    }
    setPickerTargetRowId(null);
  }, [pickerTargetRowId]);

  const toggleRemoval = useCallback((itemId: string) => {
    setRemovedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const upsertQuantityMod = useCallback(
    (item: SalesOrderItem, newQty: number) => {
      const priceImpact = (newQty - item.quantity) * item.unitPrice;
      setModifications((prev) => {
        const filtered = prev.filter(
          (m) => !(m.itemId === item.id && m.field === 'quantity'),
        );
        if (newQty === item.quantity) return filtered;
        return [
          ...filtered,
          {
            itemId: item.id,
            field: 'quantity',
            oldValue: String(item.quantity),
            newValue: String(newQty),
            priceImpact,
          },
        ];
      });
    },
    [],
  );

  const modifiedQtyFor = useCallback(
    (itemId: string): number | null => {
      const m = modifications.find((x) => x.itemId === itemId && x.field === 'quantity');
      return m ? Number(m.newValue) : null;
    },
    [modifications],
  );

  // ── Submit ───────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const input: CreateChangeOrderInput = {
        salesOrderId: salesOrder.id,
        type,
        title: title.trim(),
        description: description.trim(),
        reason: reason.trim(),
        requestedBy,
        itemsAdded: itemsAdded.map((i) => ({
          description: i.description.trim(),
          specification: i.specification?.trim() || undefined,
          quantity: i.quantity,
          unit: i.unit || 'pcs',
          unitPrice: i.unitPrice,
          category: i.category,
          designItemId: i.designItemId?.trim() || undefined,
        })),
        itemsRemoved: drafts.removals,
        itemsModified: modifications.map((m) => ({
          action: 'modify',
          itemId: m.itemId,
          field: m.field,
          oldValue: m.oldValue,
          newValue: m.newValue,
          description: '',
          priceImpact: m.priceImpact,
        })),
        ...(negotiatedAdjustment !== 0
          ? { negotiatedPriceAdjustment: negotiatedAdjustment }
          : {}),
        ...(negotiatedNote.trim()
          ? { negotiatedAdjustmentNote: negotiatedNote.trim() }
          : {}),
        deliveryDateImpact: deliveryDateImpact ? Number(deliveryDateImpact) : undefined,
        internalApprovalRequired,
        clientApprovalRequired,
      };

      let coId: string;

      if (isEditMode && existingCO) {
        // Editing an existing draft — patch in place, preserve CO id.
        await updateChangeOrderDraft(existingCO.id, input, userId, userName);
        coId = existingCO.id;
        if (submitForReview) {
          await submitForInternalApproval(
            coId,
            userId,
            userName,
            'Submitted from edit wizard',
          );
        }
        onUpdated?.(coId);
      } else {
        coId = await createChangeOrder(input, userId, subsidiaryId, userName);
        if (submitForReview) {
          await submitForInternalApproval(
            coId,
            userId,
            userName,
            'Auto-submitted from wizard',
          );
        }
        // The draft is now a real CO document — no need for the local
        // snapshot. Clear it so a future "New change order" starts fresh.
        clearDraft(salesOrder.id);
        onCreated?.(coId);
      }

      onClose();
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }, [
    salesOrder.id,
    isEditMode,
    existingCO,
    type,
    title,
    description,
    reason,
    requestedBy,
    itemsAdded,
    drafts.removals,
    modifications,
    negotiatedAdjustment,
    negotiatedNote,
    deliveryDateImpact,
    internalApprovalRequired,
    clientApprovalRequired,
    submitForReview,
    userId,
    userName,
    subsidiaryId,
    onCreated,
    onUpdated,
    onClose,
  ]);

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {isEditMode && existingCO
                ? `Continue editing ${existingCO.changeOrderNumber}`
                : 'New change order'}
            </h2>
            <p className="text-xs text-gray-500">
              {salesOrder.orderNumber} • {salesOrder.customerName}
              {isEditMode ? ' • Editing draft' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-md"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-5 py-2 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2 text-xs">
            {[1, 2, 3].map((n, idx) => (
              <div key={n} className="flex items-center gap-2">
                <span
                  className={`h-5 w-5 rounded-full flex items-center justify-center font-semibold text-[10px] ${
                    step === n
                      ? 'bg-indigo-600 text-white'
                      : step > n
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step > n ? <Check className="h-3 w-3" /> : n}
                </span>
                <span
                  className={
                    step === n ? 'font-semibold text-gray-900' : 'text-gray-500'
                  }
                >
                  {n === 1 ? 'Classify' : n === 2 ? 'Line items' : 'Review'}
                </span>
                {idx < 2 && <ChevronRight className="h-3 w-3 text-gray-300" />}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {pendingDraft && (
            <div className="flex items-start gap-3 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-[12px] text-indigo-900">
              <Loader2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-indigo-600" />
              <div className="flex-1">
                <p>
                  <strong>Resume your draft?</strong> You have unsaved wizard
                  progress from{' '}
                  {new Date(pendingDraft.savedAt).toLocaleString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {pendingDraft.title ? ` — "${pendingDraft.title}"` : ''}.
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => applyDraft(pendingDraft)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
                  >
                    <Check className="h-3 w-3" />
                    Resume
                  </button>
                  <button
                    type="button"
                    onClick={discardDraft}
                    className="px-2.5 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 rounded-md"
                  >
                    Start fresh
                  </button>
                </div>
              </div>
            </div>
          )}

          {salesOrder.scopeFrozen && (
            <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Scope is frozen.</strong> This change order will be
                flagged as post-freeze and require additional oversight before
                approval.
              </span>
            </div>
          )}

          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {CO_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setType(opt)}
                      className={`px-2.5 py-1.5 rounded-md border text-xs font-medium text-left ${
                        type === opt
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {CO_TYPE_LABELS[opt]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Requested by
                </label>
                <div className="flex gap-1.5">
                  {(['client', 'internal'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setRequestedBy(opt)}
                      className={`px-3 py-1.5 rounded-md border text-xs font-medium capitalize ${
                        requestedBy === opt
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Add three drawer base cabinets"
                  maxLength={200}
                  className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="What the client is asking for (or what internal needs to change)…"
                  className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Reason
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Why this change is needed — e.g. client site change, error in original scope, material substitution…"
                  className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Added items */}
              <section>
                <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                  <h3 className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1.5">
                    <PackagePlus className="h-3.5 w-3.5" /> Items added
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={openPickerForNewRow}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
                      title="Pick an existing design item or create a new one"
                    >
                      <Sparkles className="h-3 w-3" />
                      Add from design item
                    </button>
                    <button
                      type="button"
                      onClick={addRow}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-indigo-600 hover:bg-indigo-50 rounded-md"
                      title="Add a freeform line item without a design-item link (e.g. design fee, consultation)"
                    >
                      <Plus className="h-3 w-3" /> Freeform row
                    </button>
                  </div>
                </div>
                {itemsAdded.length === 0 ? (
                  <p className="text-[11px] text-gray-400">
                    No items added. Use <strong>Add from design item</strong> to create or pick a
                    design item (its price flows to the CO), or <strong>Freeform row</strong> for
                    ad-hoc charges.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {itemsAdded.map((row) => (
                      <div
                        key={row.tempId}
                        className="grid grid-cols-12 gap-1.5 items-start p-2 rounded-md border border-emerald-100 bg-emerald-50/30"
                      >
                        <input
                          type="text"
                          value={row.description}
                          onChange={(e) =>
                            updateAdded(row.tempId, { description: e.target.value })
                          }
                          placeholder="Description"
                          className="col-span-4 rounded-md border border-gray-200 px-2 py-1 text-[12px]"
                        />
                        <input
                          type="number"
                          min={0.01}
                          step="0.01"
                          value={row.quantity}
                          onChange={(e) =>
                            updateAdded(row.tempId, {
                              quantity: Number(e.target.value),
                            })
                          }
                          className="col-span-1 rounded-md border border-gray-200 px-2 py-1 text-[12px]"
                        />
                        <input
                          type="text"
                          value={row.unit}
                          onChange={(e) =>
                            updateAdded(row.tempId, { unit: e.target.value })
                          }
                          placeholder="pcs"
                          className="col-span-1 rounded-md border border-gray-200 px-2 py-1 text-[12px]"
                        />
                        <input
                          type="number"
                          min={0}
                          step="1"
                          value={row.unitPrice}
                          onChange={(e) =>
                            updateAdded(row.tempId, {
                              unitPrice: Number(e.target.value),
                            })
                          }
                          placeholder="Unit price"
                          className="col-span-2 rounded-md border border-gray-200 px-2 py-1 text-[12px]"
                        />
                        <select
                          value={row.category}
                          onChange={(e) =>
                            updateAdded(row.tempId, {
                              category: e.target.value as ItemCategory,
                            })
                          }
                          className="col-span-3 rounded-md border border-gray-200 px-2 py-1 text-[12px]"
                        >
                          {CATEGORY_OPTIONS.map((c) => (
                            <option key={c} value={c}>
                              {ITEM_CATEGORY_LABELS[c]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeAddedRow(row.tempId)}
                          className="col-span-1 p-1 rounded-md text-rose-500 hover:bg-rose-50"
                          aria-label="Remove row"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <div className="col-span-12 flex items-center gap-2">
                          {row.designItemId ? (
                            <>
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Link2 className="h-2.5 w-2.5" />
                                Linked design item
                              </span>
                              <span className="text-[10px] text-gray-400 font-mono">
                                {row.designItemId.slice(0, 12)}…
                              </span>
                              <button
                                type="button"
                                onClick={() => openPickerForRow(row.tempId)}
                                className="text-[11px] text-indigo-600 hover:underline ml-auto"
                              >
                                Change
                              </button>
                              <button
                                type="button"
                                onClick={() => updateAdded(row.tempId, { designItemId: undefined })}
                                className="text-[11px] text-gray-500 hover:underline"
                              >
                                Unlink
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openPickerForRow(row.tempId)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-indigo-600 hover:bg-indigo-50 rounded border border-indigo-200"
                            >
                              <Link2 className="h-3 w-3" />
                              Link / create design item
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Removed items */}
              <section>
                <h3 className="text-xs font-semibold text-rose-700 inline-flex items-center gap-1.5 mb-2">
                  <PackageMinus className="h-3.5 w-3.5" /> Items removed
                </h3>
                {activeScopeItems.length === 0 ? (
                  <p className="text-[11px] text-gray-400">
                    No active scope items on this sales order.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {activeScopeItems.map((item) => (
                      <label
                        key={item.id}
                        className={`flex items-start gap-2 p-2 rounded-md border cursor-pointer ${
                          removedIds.has(item.id)
                            ? 'border-rose-200 bg-rose-50/50'
                            : 'border-gray-100 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={removedIds.has(item.id)}
                          onChange={() => toggleRemoval(item.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 text-[12px]">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-800">
                              {item.description}
                            </span>
                            <span className="text-gray-600">
                              {formatCurrency(item.totalPrice, salesOrder.currency)}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500">
                            Qty {item.quantity} {item.unit} ×{' '}
                            {formatCurrency(item.unitPrice, salesOrder.currency)}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </section>

              {/* Modifications — quantity only for v1 */}
              <section>
                <h3 className="text-xs font-semibold text-indigo-700 inline-flex items-center gap-1.5 mb-2">
                  <Pencil className="h-3.5 w-3.5" /> Modify quantities
                </h3>
                {activeScopeItems.length === 0 ? (
                  <p className="text-[11px] text-gray-400">
                    Nothing to modify.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {activeScopeItems
                      .filter((i) => !removedIds.has(i.id))
                      .map((item) => {
                        const currentMod = modifiedQtyFor(item.id);
                        const value = currentMod ?? item.quantity;
                        const delta = (value - item.quantity) * item.unitPrice;
                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-2 p-2 rounded-md border border-gray-100 bg-white"
                          >
                            <div className="flex-1 text-[12px]">
                              <span className="font-medium text-gray-800">
                                {item.description}
                              </span>
                              <p className="text-[11px] text-gray-500">
                                Current qty: {item.quantity} {item.unit}
                              </p>
                            </div>
                            <input
                              type="number"
                              min={0.01}
                              step="0.01"
                              value={value}
                              onChange={(e) =>
                                upsertQuantityMod(item, Number(e.target.value))
                              }
                              className="w-20 rounded-md border border-gray-200 px-2 py-1 text-[12px] text-right"
                            />
                            {currentMod !== null && (
                              <span
                                className={`text-[11px] font-semibold ${
                                  delta >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                } min-w-[60px] text-right`}
                              >
                                {delta >= 0 ? '+' : ''}
                                {formatCurrency(delta, salesOrder.currency)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </section>

              {/* Running delta */}
              <section>
                <h3 className="text-xs font-semibold text-amber-700 inline-flex items-center gap-1.5 mb-2">
                  <Sparkles className="h-3.5 w-3.5" /> Negotiated adjustment
                </h3>
                <div className="rounded-md border border-amber-100 bg-amber-50/40 p-2 space-y-2">
                  {type !== 'price_adjustment' && (
                    <p className="text-[11px] text-amber-800">
                      Optional commercial adjustment. For adjustment-only change orders, set Type to
                      <strong> Price Adjustment</strong> in Step 1.
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-gray-600 block mb-1">Adjustment type</label>
                      <select
                        value={negotiatedMode}
                        onChange={(e) =>
                          setNegotiatedMode(e.target.value as 'absolute_delta' | 'discount_percent')
                        }
                        className="w-full rounded-md border border-gray-200 px-2 py-1 text-[12px]"
                      >
                        <option value="absolute_delta">Absolute delta ({salesOrder.currency})</option>
                        <option value="discount_percent">Discount (%)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-600 block mb-1">
                        {negotiatedMode === 'discount_percent' ? 'Discount %' : 'Delta amount'}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={negotiatedValue}
                        onChange={(e) => setNegotiatedValue(e.target.value)}
                        placeholder={negotiatedMode === 'discount_percent' ? 'e.g. 5' : 'e.g. -500000'}
                        className="w-full rounded-md border border-gray-200 px-2 py-1 text-[12px]"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-600">
                    Applied negotiated adjustment:{' '}
                    <strong className={negotiatedAdjustment >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                      {negotiatedAdjustment >= 0 ? '+' : ''}
                      {formatCurrency(negotiatedAdjustment, salesOrder.currency)}
                    </strong>
                  </p>
                  <div>
                    <label className="text-[11px] text-gray-600 block mb-1">
                      Negotiation note (client agreement context)
                    </label>
                    <textarea
                      value={negotiatedNote}
                      onChange={(e) => setNegotiatedNote(e.target.value)}
                      rows={2}
                      maxLength={500}
                      placeholder="e.g. Agreed 7% discount to close by month-end with same scope."
                      className="w-full rounded-md border border-gray-200 px-2 py-1 text-[12px]"
                    />
                  </div>
                </div>
              </section>

              <div className="sticky bottom-0 bg-white pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Running net impact</span>
                  <span
                    className={`text-sm font-bold ${
                      rawDelta.net >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {rawDelta.net >= 0 ? '+' : ''}
                    {formatCurrency(rawDelta.net, salesOrder.currency)}
                  </span>
                </div>
                <div className="text-[10px] text-gray-400">
                  + {formatCurrency(rawDelta.added, salesOrder.currency)} added •
                  – {formatCurrency(rawDelta.removed, salesOrder.currency)} removed •
                  {rawDelta.modified >= 0 ? ' +' : ' '}
                  {formatCurrency(rawDelta.modified, salesOrder.currency)} modified
                  {' • '}
                  {rawDelta.negotiatedAdjustment >= 0 ? '+' : ''}
                  {formatCurrency(rawDelta.negotiatedAdjustment, salesOrder.currency)} negotiated
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <section>
                <h3 className="text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                  Summary
                </h3>
                <div className="rounded-lg border border-gray-200 p-3 space-y-1 text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Type</span>
                    <span className="font-medium text-gray-800">{CO_TYPE_LABELS[type]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Requested by</span>
                    <span className="font-medium text-gray-800 capitalize">{requestedBy}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Title</span>
                    <span className="font-medium text-gray-800 text-right">{title}</span>
                  </div>
                  {negotiatedNote.trim() && (
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-500">Negotiation note</span>
                      <span className="font-medium text-gray-800 text-right">{negotiatedNote.trim()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Items added</span>
                    <span className="text-gray-800">{itemsAdded.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Items removed</span>
                    <span className="text-gray-800">{drafts.removals.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Items modified</span>
                    <span className="text-gray-800">{modifications.length}</span>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                  Price & margin impact
                </h3>
                <ChangeOrderPriceImpactCard
                  impact={impact}
                  currency={salesOrder.currency}
                  loading={impactLoading}
                  error={impactError}
                />
              </section>

              <section>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Timeline impact (days)
                </label>
                <input
                  type="number"
                  value={deliveryDateImpact}
                  onChange={(e) => setDeliveryDateImpact(e.target.value)}
                  placeholder="0"
                  className="w-32 rounded-md border border-gray-200 px-3 py-1.5 text-sm"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Positive = delay, negative = pull-in, blank = no impact.
                </p>
              </section>

              <section>
                <h3 className="text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                  Approval requirements
                </h3>
                <label className="flex items-center gap-2 text-[12px] text-gray-700">
                  <input
                    type="checkbox"
                    checked={internalApprovalRequired}
                    onChange={(e) => setInternalApprovalRequired(e.target.checked)}
                  />
                  Internal approval required
                </label>
                <label className="flex items-center gap-2 text-[12px] text-gray-700 mt-1">
                  <input
                    type="checkbox"
                    checked={clientApprovalRequired}
                    onChange={(e) => setClientApprovalRequired(e.target.checked)}
                  />
                  Client approval required
                </label>
              </section>

              <section>
                <label className="flex items-center gap-2 text-[12px] text-gray-700">
                  <input
                    type="checkbox"
                    checked={submitForReview}
                    onChange={(e) => setSubmitForReview(e.target.checked)}
                  />
                  Submit for internal review immediately after creation
                </label>
              </section>

              {submitError && (
                <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={step === 1 ? onClose : goBack}
              disabled={submitting}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-50"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {step === 1 ? 'Close' : 'Back'}
            </button>
            {!pendingDraft && (
              <span className="text-[10px] text-gray-400 hidden sm:inline">
                Auto-saved — your draft will resume on re-open.
              </span>
            )}
          </div>

          {step < 3 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid) || impactLoading}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50"
            >
              {impactLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {isEditMode
                ? submitForReview
                  ? 'Save & submit for review'
                  : 'Save draft changes'
                : submitForReview
                  ? 'Create & submit for review'
                  : 'Save as draft'}
            </button>
          )}
        </div>
      </div>

      {/* Design-item picker — inline link-or-create sub-modal */}
      {pickerTargetRowId && (
        <ChangeOrderDesignItemPicker
          designProjectId={salesOrder.designProjectId}
          currency={salesOrder.currency}
          userId={userId}
          initialDesignItemId={
            itemsAdded.find((r) => r.tempId === pickerTargetRowId)?.designItemId
          }
          onSelect={handlePickerResult}
          onClose={handlePickerClose}
        />
      )}
    </div>
  );
}
