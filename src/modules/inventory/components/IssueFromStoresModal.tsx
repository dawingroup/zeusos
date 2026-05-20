/**
 * IssueFromStoresModal
 * Form for issuing consumables/spareparts from stores.
 * Creates an inventoryIssue doc; Cloud Function handles stock deduction + QBO journal.
 */

import React, { useState, useCallback } from 'react';
import { X, Trash2, Package, AlertCircle } from 'lucide-react';
import { createInventoryIssue } from '../services/inventoryIssueService';
import { useCategories } from '../hooks/useCategories';
import {
  ISSUE_REASON_LABELS,
  type IssueReason,
  type IssueFormData,
} from '../types/inventoryIssue';

interface IssueFromStoresModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (issueId: string) => void;
  userId: string;
  organizationId: string;
  subsidiaryId?: string;
}

interface LineItemDraft {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  sku: string;
  category: string;
  quantity: number;
  unit: string;
  unitCost: number;
}

let nextId = 1;

export function IssueFromStoresModal({
  isOpen,
  onClose,
  onCreated,
  userId,
  organizationId,
  subsidiaryId,
}: IssueFromStoresModalProps) {
  const { bySlug: categoryBySlug } = useCategories();
  const [reason, setReason] = useState<IssueReason>('production');
  const [notes, setNotes] = useState('');
  const [issuedTo, setIssuedTo] = useState('');
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Item search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{
    id: string; name: string; sku: string; category: string; unit: string; costPerUnit: number;
  }>>([]);
  const [searching, setSearching] = useState(false);

  const searchItems = useCallback(async (term: string) => {
    if (term.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const { searchInventory } = await import('../services/inventoryService');
      const results = await searchInventory(term);
      // Only show items in expense-on-issue categories
      const filtered = results.filter((item) => {
        const cat = categoryBySlug.get(item.category);
        return cat?.expenseOnIssue;
      });
      setSearchResults(
        filtered.map((item) => ({
          id: item.id,
          name: item.name,
          sku: item.sku || '',
          category: item.category,
          unit: item.costUnit || 'ea',
          costPerUnit: item.costPerUnit || 0,
        })),
      );
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [categoryBySlug]);

  function addLineItem(item: typeof searchResults[0]) {
    setLineItems((prev) => [
      ...prev,
      {
        id: String(nextId++),
        inventoryItemId: item.id,
        inventoryItemName: item.name,
        sku: item.sku,
        category: item.category,
        quantity: 1,
        unit: item.unit,
        unitCost: item.costPerUnit,
      },
    ]);
    setSearchTerm('');
    setSearchResults([]);
  }

  function updateQuantity(id: string, qty: number) {
    setLineItems((prev) =>
      prev.map((li) => (li.id === id ? { ...li, quantity: Math.max(0, qty) } : li)),
    );
  }

  function removeLine(id: string) {
    setLineItems((prev) => prev.filter((li) => li.id !== id));
  }

  const totalValue = lineItems.reduce((sum, li) => sum + li.quantity * li.unitCost, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lineItems.length === 0) {
      setError('Add at least one item to issue');
      return;
    }
    if (!issuedTo.trim()) {
      setError('Specify who this is issued to');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const formData: IssueFormData = {
        reason,
        notes,
        issuedTo: issuedTo.trim(),
        projectId: null,
        manufacturingOrderId: null,
        lineItems: lineItems.map((li) => ({
          inventoryItemId: li.inventoryItemId,
          inventoryItemName: li.inventoryItemName,
          sku: li.sku,
          category: li.category,
          quantity: li.quantity,
          unit: li.unit,
          unitCost: li.unitCost,
          totalCost: li.quantity * li.unitCost,
        })),
      };

      const issueId = await createInventoryIssue(
        formData,
        userId,
        organizationId,
        subsidiaryId,
      );
      onCreated?.(issueId);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-gray-900">Issue from Stores</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Reason + Issued To */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as IssueReason)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {Object.entries(ISSUE_REASON_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Issued To *</label>
              <input
                type="text"
                value={issuedTo}
                onChange={(e) => setIssuedTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Person or department"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Optional notes"
            />
          </div>

          {/* Item Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Add Items</label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  searchItems(e.target.value);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Search consumables / spareparts..."
              />
              {searching && (
                <div className="absolute right-3 top-2.5 text-xs text-gray-400">Searching...</div>
              )}
              {searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {searchResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addLineItem(item)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm flex justify-between"
                    >
                      <span>{item.name}</span>
                      <span className="text-gray-400">{item.sku}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Line Items */}
          {lineItems.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Item</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-500 w-24">Qty</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-500 w-28">Unit Cost</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-500 w-28">Total</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((li) => (
                    <tr key={li.id} className="border-b border-gray-100">
                      <td className="py-2 px-3">
                        <div className="font-medium text-gray-800">{li.inventoryItemName}</div>
                        <div className="text-xs text-gray-400">{li.sku}</div>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          value={li.quantity}
                          onChange={(e) => updateQuantity(li.id, Number(e.target.value))}
                          min={0}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-right text-sm"
                        />
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        {li.unitCost.toLocaleString()} UGX
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums font-medium">
                        {(li.quantity * li.unitCost).toLocaleString()} UGX
                      </td>
                      <td className="py-2 px-1">
                        <button
                          type="button"
                          onClick={() => removeLine(li.id)}
                          className="text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td colSpan={3} className="py-2 px-3 text-right font-medium text-gray-700">
                      Total Value
                    </td>
                    <td className="py-2 px-3 text-right font-semibold tabular-nums">
                      {totalValue.toLocaleString()} UGX
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Info */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              Issuing items will immediately deduct stock and create a QBO expense journal entry
              (Debit Expense, Credit Inventory Asset).
            </span>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || lineItems.length === 0}
              className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              {saving ? 'Issuing...' : `Issue ${lineItems.length} Item${lineItems.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
