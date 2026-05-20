/**
 * LineItemApprovalDialog
 * Dialog for reviewing and approving/rejecting individual line items on a client quote.
 * Admin/CEO uses this to record verbal client approval of specific items.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Check,
  ChevronDown,
  ChevronUp,
  MessageSquare,
} from 'lucide-react';
import type { ClientQuote, ClientQuoteLineItem } from '../../types/clientPortal';
import {
  approveQuoteLineItems,
  type LineItemApprovalInput,
} from '../../services/clientPortalService';
import { useAuth } from '@/contexts/AuthContext';

interface LineItemApprovalDialogProps {
  open: boolean;
  onClose: () => void;
  quote: ClientQuote | null;
  onApproved: () => void;
}

type ApprovalStatus = 'pending' | 'approved' | 'rejected';

interface ItemApprovalState {
  status: ApprovalStatus;
  notes: string;
  showNotes: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  material: 'Material',
  labor: 'Labour',
  hardware: 'Hardware',
  finishing: 'Finishing',
  outsourcing: 'Outsourcing',
  overhead: 'Overhead',
  procurement: 'Procurement',
  'procurement-logistics': 'Logistics',
  'procurement-customs': 'Customs',
  other: 'Other',
};

function formatCurrency(value: number | undefined | null, currency = 'UGX'): string {
  if (value == null) return `${currency} 0`;
  return `${currency} ${value.toLocaleString()}`;
}

export function LineItemApprovalDialog({
  open,
  onClose,
  quote,
  onApproved,
}: LineItemApprovalDialogProps) {
  const { user } = useAuth();
  const [approvals, setApprovals] = useState<Record<string, ItemApprovalState>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Initialize approval states from quote line items
  useEffect(() => {
    if (!open || !quote) return;
    const initial: Record<string, ItemApprovalState> = {};
    for (const item of quote.lineItems) {
      initial[item.id] = {
        status: item.approvalStatus || 'pending',
        notes: item.approvalNotes || '',
        showNotes: !!item.approvalNotes,
      };
    }
    setApprovals(initial);
    setError(null);
    // Expand all categories by default
    const cats = new Set(quote.lineItems.map((li) => li.category));
    setExpandedCategories(cats);
  }, [open, quote]);

  // Group line items by category
  const groupedItems = useMemo(() => {
    if (!quote) return new Map<string, ClientQuoteLineItem[]>();
    const map = new Map<string, ClientQuoteLineItem[]>();
    for (const item of quote.lineItems) {
      const group = map.get(item.category) || [];
      group.push(item);
      map.set(item.category, group);
    }
    return map;
  }, [quote]);

  // Summary stats
  const stats = useMemo(() => {
    const values = Object.values(approvals);
    const approved = values.filter((a) => a.status === 'approved').length;
    const rejected = values.filter((a) => a.status === 'rejected').length;
    const pending = values.filter((a) => a.status === 'pending').length;
    const approvedTotal = quote
      ? quote.lineItems
          .filter((li) => approvals[li.id]?.status === 'approved')
          .reduce((sum, li) => sum + (li.totalPrice ?? 0), 0)
      : 0;
    return { approved, rejected, pending, total: values.length, approvedTotal };
  }, [approvals, quote]);

  const hasChanges = useMemo(() => {
    if (!quote) return false;
    return quote.lineItems.some((li) => {
      const curr = approvals[li.id];
      if (!curr) return false;
      return curr.status !== (li.approvalStatus || 'pending') ||
        curr.notes !== (li.approvalNotes || '');
    });
  }, [approvals, quote]);

  const setItemStatus = (itemId: string, status: ApprovalStatus) => {
    setApprovals((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], status },
    }));
  };

  const setItemNotes = (itemId: string, notes: string) => {
    setApprovals((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], notes },
    }));
  };

  const toggleNotes = (itemId: string) => {
    setApprovals((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], showNotes: !prev[itemId].showNotes },
    }));
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const approveAll = () => {
    setApprovals((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = { ...next[key], status: 'approved' };
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!quote) return;
    setSaving(true);
    setError(null);
    try {
      const inputs: LineItemApprovalInput[] = Object.entries(approvals).map(
        ([itemId, state]) => ({
          itemId,
          status: state.status,
          notes: state.notes.trim() || undefined,
        }),
      );
      await approveQuoteLineItems(quote.id, inputs, user?.uid || 'unknown-user');
      onApproved();
    } catch (err: any) {
      setError(err.message || 'Failed to save approvals');
    } finally {
      setSaving(false);
    }
  };

  if (!open || !quote) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Line Item Approval
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {quote.quoteNumber} — {quote.title || quote.projectName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg"
            disabled={saving}
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Summary bar */}
        <div className="px-6 py-3 bg-gray-50 border-b flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1 text-green-700">
              <CheckCircle2 className="w-4 h-4" />
              {stats.approved} approved
            </span>
            <span className="flex items-center gap-1 text-red-600">
              <XCircle className="w-4 h-4" />
              {stats.rejected} rejected
            </span>
            <span className="flex items-center gap-1 text-amber-600">
              <Clock className="w-4 h-4" />
              {stats.pending} pending
            </span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-700 font-medium">
              Approved total: {formatCurrency(stats.approvedTotal, quote.currency)}
            </span>
          </div>
          <button
            onClick={approveAll}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
          >
            Approve All
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {Array.from(groupedItems.entries()).map(([category, items]) => {
            const expanded = expandedCategories.has(category);
            const catApproved = items.filter(
              (i) => approvals[i.id]?.status === 'approved',
            ).length;
            const catTotal = items.length;
            const catAmount = items.reduce((s, i) => s + (i.totalPrice ?? 0), 0);

            return (
              <div key={category} className="border rounded-lg overflow-hidden">
                {/* Category header */}
                <button
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {expanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-sm font-medium text-gray-800">
                      {CATEGORY_LABELS[category] || category}
                    </span>
                    <span className="text-xs text-gray-400">
                      {catApproved}/{catTotal} approved
                    </span>
                  </div>
                  <span className="text-sm text-gray-600">
                    {formatCurrency(catAmount, quote.currency)}
                  </span>
                </button>

                {/* Items */}
                {expanded && (
                  <div className="divide-y divide-gray-100">
                    {items.map((item) => {
                      const state = approvals[item.id];
                      if (!state) return null;

                      return (
                        <div
                          key={item.id}
                          className={`px-4 py-3 transition-colors ${
                            state.status === 'approved'
                              ? 'bg-green-50/50'
                              : state.status === 'rejected'
                              ? 'bg-red-50/50'
                              : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            {/* Item info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {item.linkedDesignItemName || item.description}
                              </p>
                              {item.linkedDesignItemName && item.description !== item.linkedDesignItemName && (
                                <p className="text-xs text-gray-500 mt-0.5 truncate">
                                  {item.description}
                                </p>
                              )}
                              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                <span>
                                  {item.quantity} {item.unit} × {formatCurrency(item.unitPrice, quote.currency)}
                                </span>
                                {item.discountPercent ? (
                                  <span className="text-amber-600">
                                    -{item.discountPercent}% disc
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            {/* Price */}
                            <div className="text-right shrink-0">
                              <p className="text-sm font-semibold text-gray-900">
                                {formatCurrency(item.totalPrice, quote.currency)}
                              </p>
                              {(item.taxAmount ?? 0) > 0 && (
                                <p className="text-[10px] text-gray-400">
                                  +{formatCurrency(item.taxAmount, quote.currency)} tax
                                </p>
                              )}
                            </div>

                            {/* Approval buttons */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => setItemStatus(item.id, 'approved')}
                                className={`p-1.5 rounded-lg border transition-all ${
                                  state.status === 'approved'
                                    ? 'bg-green-100 border-green-300 text-green-700'
                                    : 'border-gray-200 text-gray-400 hover:bg-green-50 hover:border-green-200 hover:text-green-600'
                                }`}
                                title="Approve"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setItemStatus(item.id, 'rejected')}
                                className={`p-1.5 rounded-lg border transition-all ${
                                  state.status === 'rejected'
                                    ? 'bg-red-100 border-red-300 text-red-700'
                                    : 'border-gray-200 text-gray-400 hover:bg-red-50 hover:border-red-200 hover:text-red-600'
                                }`}
                                title="Reject"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleNotes(item.id)}
                                className={`p-1.5 rounded-lg border transition-all ${
                                  state.showNotes || state.notes
                                    ? 'bg-blue-50 border-blue-200 text-blue-600'
                                    : 'border-gray-200 text-gray-400 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600'
                                }`}
                                title="Add notes"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Notes input */}
                          {state.showNotes && (
                            <div className="mt-2">
                              <input
                                type="text"
                                value={state.notes}
                                onChange={(e) => setItemNotes(item.id, e.target.value)}
                                placeholder="Notes (e.g., client requested change, alternate spec)..."
                                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {stats.total} line items · Quote total: {formatCurrency(quote.total, quote.currency)}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Save Approvals
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
