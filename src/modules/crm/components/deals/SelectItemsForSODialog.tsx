/**
 * SelectItemsForSODialog
 * Dialog for selecting line items from a deal's approved quote to include in a Sales Order.
 * - create: new SO from selected approved lines (deal not yet converted or won flow).
 * - append: add newly approved lines to an existing SO (progressive approval / different dates).
 */

import { useState, useEffect } from 'react';
import { Loader2, Package, Check, X, AlertCircle } from 'lucide-react';
import { useAuth } from '@/shared/hooks';
import { useSubsidiary } from '@/contexts/SubsidiaryContext';
import {
  findApprovedQuoteForProject,
  createSalesOrderFromDealWithItems,
  appendQuoteLinesToDealSalesOrder,
  isQuoteLineAlreadyOnSalesOrder,
} from '../../services/dealToSalesOrderService';
import { getApprovedLineItems } from '@/modules/design-manager/services/clientPortalService';
import { getSalesOrder } from '@/modules/sales-orders/services/salesOrderService';
import type { ClientQuote, ClientQuoteLineItem } from '@/modules/design-manager/types/clientPortal';
import type { CRMDeal } from '../../types';

interface SelectItemsForSODialogProps {
  open: boolean;
  onClose: () => void;
  dealId: string;
  deal: CRMDeal;
  onSalesOrderCreated: (soId: string) => void;
  mode?: 'create' | 'append';
  /** Required when mode === 'append' */
  existingSalesOrderId?: string;
}

function formatCurrency(value: number, currency: string): string {
  if (currency === 'UGX') return `UGX ${value.toLocaleString()}`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}

function formatApprovedAt(li: ClientQuoteLineItem): string | null {
  const t = li.approvedAt;
  if (!t || typeof (t as { toDate?: () => Date }).toDate !== 'function') return null;
  return (t as { toDate: () => Date }).toDate().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function SelectItemsForSODialog({
  open,
  onClose,
  dealId,
  deal,
  onSalesOrderCreated,
  mode = 'create',
  existingSalesOrderId,
}: SelectItemsForSODialogProps) {
  const { user } = useAuth();
  const { currentSubsidiary } = useSubsidiary();
  const [quote, setQuote] = useState<ClientQuote | null>(null);
  const [lineItems, setLineItems] = useState<ClientQuoteLineItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !deal.linkedProjectId) return;
    setLoading(true);
    setError(null);
    setQuote(null);
    setLineItems([]);
    setSelected(new Set());

    (async () => {
      try {
        let preferQuoteId: string | undefined;
        if (mode === 'append' && existingSalesOrderId) {
          const so = await getSalesOrder(existingSalesOrderId);
          preferQuoteId = so?.quoteId || undefined;
        }

        const q = await findApprovedQuoteForProject(deal.linkedProjectId!, {
          preferQuoteId,
        });
        if (!q) {
          setError('No quote with approved line items found for this project. Approve at least one item first.');
          return;
        }
        setQuote(q);
        let items = getApprovedLineItems(q);
        if (mode === 'append' && existingSalesOrderId) {
          const so = await getSalesOrder(existingSalesOrderId);
          if (!so) {
            setError('Sales order not found.');
            return;
          }
          items = items.filter((li) => !isQuoteLineAlreadyOnSalesOrder(so, li));
          if (items.length === 0) {
            setError(
              'No new approved lines to add. Either they are already on this order, or approve additional lines on the quote first.',
            );
            return;
          }
        }
        setLineItems(items);
        setSelected(new Set(items.map((li) => li.id)));
      } catch (err) {
        console.error('Failed to load quote:', err);
        setError('Failed to load quote items. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [open, deal.linkedProjectId, mode, existingSalesOrderId]);

  const toggleItem = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === lineItems.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(lineItems.map((li) => li.id)));
    }
  };

  const selectedItems = lineItems.filter((li) => selected.has(li.id));
  const selectedTotal = selectedItems.reduce((sum, li) => sum + li.totalPrice, 0);
  const currency = quote?.currency || deal.currency || 'UGX';

  const handleCreate = async () => {
    if (!user || !quote || selectedItems.length === 0) return;
    if (mode === 'append' && !existingSalesOrderId) return;
    setCreating(true);
    setError(null);
    try {
      if (mode === 'append' && existingSalesOrderId) {
        const result = await appendQuoteLinesToDealSalesOrder(
          dealId,
          existingSalesOrderId,
          user.uid,
          selectedItems,
          quote,
        );
        if (result.skipped) {
          setError(result.reason || 'Could not add lines');
          return;
        }
        onSalesOrderCreated(existingSalesOrderId);
        return;
      }

      const result = await createSalesOrderFromDealWithItems(
        dealId,
        user.uid,
        currentSubsidiary?.id || 'dawin-finishes',
        selectedItems,
        quote,
      );
      if (result.skipped) {
        setError(result.reason || 'Could not create sales order');
        return;
      }
      if (result.salesOrderId) {
        onSalesOrderCreated(result.salesOrderId);
      }
    } catch (err: unknown) {
      console.error('Failed to create/update sales order:', err);
      setError(err instanceof Error ? err.message : 'Failed to save sales order');
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  const isAppend = mode === 'append';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isAppend ? 'Add approved lines to sales order' : 'Select items for sales order'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {deal.title} — {deal.customerName}
            </p>
            {isAppend && (
              <p className="text-xs text-amber-700 mt-1">
                Only lines that are approved on the quote and not already on this order are shown. You can approve more items at any time, then return here to add them.
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg" disabled={creating}>
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Loading quote items...</span>
            </div>
          ) : error && lineItems.length === 0 ? (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">{error}</p>
                {!deal.linkedProjectId && (
                  <p className="text-xs text-amber-600 mt-1">Link a design project to this deal first.</p>
                )}
              </div>
            </div>
          ) : lineItems.length > 0 ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={toggleAll}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  {selected.size === lineItems.length ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-xs text-gray-500">
                  {selected.size} of {lineItems.length} item{lineItems.length === 1 ? '' : 's'} selected
                </span>
              </div>

              <div className="space-y-2">
                {lineItems.map((li) => {
                  const isSelected = selected.has(li.id);
                  const approvedLabel = formatApprovedAt(li);
                  return (
                    <button
                      key={li.id}
                      type="button"
                      onClick={() => toggleItem(li.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        isSelected
                          ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div
                            className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                              isSelected ? 'bg-blue-600' : 'border-2 border-gray-300'
                            }`}
                          >
                            {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{li.description}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {li.quantity} {li.unit || 'pcs'} × {formatCurrency(li.unitPrice, currency)}
                              {approvedLabel && (
                                <span className="ml-2 text-gray-400">· Approved {approvedLabel}</span>
                              )}
                              {li.category && (
                                <span className="ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">
                                  {li.category}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 flex-shrink-0">
                          {formatCurrency(li.totalPrice, currency)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {error && lineItems.length > 0 && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <div className="flex items-center justify-between">
            <div>
              {selectedItems.length > 0 && (
                <div className="text-sm flex items-center gap-2">
                  <Package className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-500">{isAppend ? 'Addition total:' : 'Order total:'}</span>{' '}
                  <span className="font-bold text-gray-900">{formatCurrency(selectedTotal, currency)}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                disabled={creating}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || selectedItems.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : isAppend ? (
                  'Add to sales order'
                ) : (
                  'Create sales order'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
