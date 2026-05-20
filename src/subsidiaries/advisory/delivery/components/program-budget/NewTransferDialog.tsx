/**
 * NewTransferDialog - Modal for creating a new fund transfer
 *
 * Supports per-project line items with bank fees (0.4%) extracted from the gross amount.
 * Grant amount entered is the gross (inclusive of bank fee).
 * Net to project = grantAmount - bankFee.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Loader2, Send, ArrowRight, Plus, Trash2, Info } from 'lucide-react';
import type { FundLocation, TransferLineItem } from '../../types/fund-location';
import { FUND_LOCATION_TYPE_CONFIG, BANK_FEE_RATE, calculateBankFee } from '../../types/fund-location';
import type { ProjectBudgetRollupItem } from '../../hooks/useProgramBudgetData';

// ─────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────

interface NewTransferDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    fromLocationId: string;
    toLocationId: string;
    amount: number;
    exchangeRate?: number;
    reference: string;
    purpose: string;
    lineItems: TransferLineItem[];
  }) => void;
  locations: FundLocation[];
  projects: ProjectBudgetRollupItem[];
  /** Auto-generated reference like TRF-2026-003 */
  suggestedReference?: string;
  submitting?: boolean;
}

// ─────────────────────────────────────────────────────────────────
// INTERNAL DRAFT TYPE (before IDs are assigned)
// ─────────────────────────────────────────────────────────────────

interface LineItemDraft {
  key: number;            // local key for React list rendering
  projectId: string;
  grantAmount: number | '';
}

let nextKey = 0;
function makeEmptyDraft(): LineItemDraft {
  return { key: nextKey++, projectId: '', grantAmount: '' };
}

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────

export function NewTransferDialog({
  open,
  onClose,
  onSubmit,
  locations,
  projects,
  suggestedReference = '',
  submitting = false,
}: NewTransferDialogProps) {
  const [fromLocationId, setFromLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [exchangeRate, setExchangeRate] = useState<number | ''>('');
  const [reference, setReference] = useState('');
  const [purpose, setPurpose] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([makeEmptyDraft()]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setFromLocationId('');
      setToLocationId('');
      setExchangeRate('');
      setReference(suggestedReference);
      setPurpose('');
      setError(null);
      nextKey = 0;
      setLineItems([makeEmptyDraft()]);
    }
  }, [open]);

  // ── Derived state ───────────────────────────────────────────────

  const activeLocations = useMemo(
    () => locations.filter(loc => loc.isActive),
    [locations]
  );

  const fromLocation = useMemo(
    () => activeLocations.find(loc => loc.id === fromLocationId),
    [activeLocations, fromLocationId]
  );

  const toLocation = useMemo(
    () => activeLocations.find(loc => loc.id === toLocationId),
    [activeLocations, toLocationId]
  );

  const isCrossCurrency = fromLocation && toLocation && fromLocation.currency !== toLocation.currency;

  // Already-selected project IDs (to filter dropdown options)
  const selectedProjectIds = useMemo(
    () => new Set(lineItems.map(li => li.projectId).filter(Boolean)),
    [lineItems]
  );

  // Resolved line items with computed bank fee and total
  const resolvedLineItems = useMemo(() => {
    return lineItems.map(li => {
      const proj = projects.find(p => p.projectId === li.projectId);
      const grant = typeof li.grantAmount === 'number' ? li.grantAmount : 0;
      const fee = calculateBankFee(grant);
      return {
        key: li.key,
        projectId: li.projectId,
        projectName: proj?.projectName ?? '',
        projectCode: proj?.projectCode ?? '',
        grantAmount: grant,
        bankFee: fee,
        lineTotal: grant - fee,
      };
    });
  }, [lineItems, projects]);

  const totalGrantAmount = useMemo(
    () => resolvedLineItems.reduce((sum, li) => sum + li.grantAmount, 0),
    [resolvedLineItems]
  );

  const totalBankFees = useMemo(
    () => resolvedLineItems.reduce((sum, li) => sum + li.bankFee, 0),
    [resolvedLineItems]
  );

  const totalAmount = totalGrantAmount; // Grant amount is already gross (inclusive of fees)
  const totalNetToProject = totalGrantAmount - totalBankFees;

  const convertedAmount = useMemo(() => {
    if (!isCrossCurrency || !totalAmount || !exchangeRate) return null;
    return totalAmount * Number(exchangeRate);
  }, [isCrossCurrency, totalAmount, exchangeRate]);

  // ── Line item handlers ────────────────────────────────────────

  const addLineItem = useCallback(() => {
    setLineItems(prev => [...prev, makeEmptyDraft()]);
  }, []);

  const removeLineItem = useCallback((key: number) => {
    setLineItems(prev => {
      const next = prev.filter(li => li.key !== key);
      return next.length === 0 ? [makeEmptyDraft()] : next;
    });
  }, []);

  const updateLineItem = useCallback((key: number, field: 'projectId' | 'grantAmount', value: string | number) => {
    setLineItems(prev => prev.map(li =>
      li.key === key ? { ...li, [field]: value } : li
    ));
  }, []);

  // ── Submit handler ────────────────────────────────────────────

  const handleSubmit = () => {
    setError(null);

    if (!fromLocationId) {
      setError('Please select a source location.');
      return;
    }
    if (!toLocationId) {
      setError('Please select a destination location.');
      return;
    }
    if (fromLocationId === toLocationId) {
      setError('Source and destination must be different.');
      return;
    }

    // Validate line items
    const validLines = resolvedLineItems.filter(li => li.projectId && li.grantAmount > 0);
    if (validLines.length === 0) {
      setError('Please add at least one project line item with an amount.');
      return;
    }

    // Check for duplicate projects
    const projectIds = validLines.map(li => li.projectId);
    if (new Set(projectIds).size !== projectIds.length) {
      setError('Each project can only appear once in the line items.');
      return;
    }

    if (isCrossCurrency && (!exchangeRate || Number(exchangeRate) <= 0)) {
      setError('Please enter a valid exchange rate for cross-currency transfers.');
      return;
    }
    if (!reference.trim()) {
      setError('Please enter a transfer reference.');
      return;
    }
    if (!purpose.trim()) {
      setError('Please enter the transfer purpose.');
      return;
    }

    // Build final TransferLineItem[]
    const finalLineItems: TransferLineItem[] = validLines.map((li, idx) => ({
      id: `li-${Date.now()}-${idx}`,
      projectId: li.projectId,
      projectName: li.projectName,
      projectCode: li.projectCode,
      grantAmount: li.grantAmount,
      bankFee: li.bankFee,
      lineTotal: li.lineTotal,
    }));

    onSubmit({
      fromLocationId,
      toLocationId,
      amount: totalAmount,
      exchangeRate: isCrossCurrency ? Number(exchangeRate) : undefined,
      reference: reference.trim(),
      purpose: purpose.trim(),
      lineItems: finalLineItems,
    });
  };

  // ── Early return if closed ──────────────────────────────────────

  if (!open) return null;

  // ── Currency formatting helper ──────────────────────────────────

  const fmtCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">New Fund Transfer</h2>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* From / To locations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* From location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                From Location
              </label>
              <select
                value={fromLocationId}
                onChange={e => setFromLocationId(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">Select source...</option>
                {activeLocations.map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.currency})
                  </option>
                ))}
              </select>
              {fromLocation && (
                <p className="mt-1 text-xs text-gray-400">
                  {FUND_LOCATION_TYPE_CONFIG[fromLocation.type].label} &middot; {fromLocation.currency}
                </p>
              )}
            </div>

            {/* To location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                To Location
              </label>
              <select
                value={toLocationId}
                onChange={e => setToLocationId(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">Select destination...</option>
                {activeLocations
                  .filter(loc => loc.id !== fromLocationId)
                  .map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.currency})
                    </option>
                  ))}
              </select>
              {toLocation && (
                <p className="mt-1 text-xs text-gray-400">
                  {FUND_LOCATION_TYPE_CONFIG[toLocation.type].label} &middot; {toLocation.currency}
                </p>
              )}
            </div>
          </div>

          {/* Currency direction indicator */}
          {fromLocation && toLocation && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-lg py-2">
              <span className="font-medium">{fromLocation.currency}</span>
              <ArrowRight className="w-4 h-4 text-gray-400" />
              <span className="font-medium">{toLocation.currency}</span>
              {!isCrossCurrency && (
                <span className="text-xs text-gray-400 ml-1">(same currency)</span>
              )}
            </div>
          )}

          {/* ── Project Line Items ──────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Project Line Items
              </label>
              <button
                type="button"
                onClick={addLineItem}
                disabled={submitting || projects.length === 0}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Project
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                No projects found under this program. Create projects first before making transfers.
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                        Project
                      </th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase w-36">
                        Grant Amount
                      </th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase w-28">
                        Bank Fee (0.4%)
                      </th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase w-28">
                        Net to Project
                      </th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lineItems.map((li, idx) => {
                      const resolved = resolvedLineItems[idx];
                      return (
                        <tr key={li.key} className="hover:bg-gray-50">
                          {/* Project dropdown */}
                          <td className="px-3 py-2">
                            <select
                              value={li.projectId}
                              onChange={e => updateLineItem(li.key, 'projectId', e.target.value)}
                              disabled={submitting}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
                            >
                              <option value="">Select project...</option>
                              {projects
                                .filter(p => p.projectId === li.projectId || !selectedProjectIds.has(p.projectId))
                                .map(p => (
                                  <option key={p.projectId} value={p.projectId}>
                                    {p.projectCode} - {p.projectName}
                                  </option>
                                ))}
                            </select>
                          </td>

                          {/* Grant amount input */}
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={li.grantAmount}
                              onChange={e =>
                                updateLineItem(
                                  li.key,
                                  'grantAmount',
                                  e.target.value === '' ? '' : Number(e.target.value)
                                )
                              }
                              min={0}
                              step={100}
                              placeholder="0.00"
                              disabled={submitting}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
                            />
                          </td>

                          {/* Bank fee (read-only) */}
                          <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                            {resolved.grantAmount > 0 ? fmtCurrency(resolved.bankFee) : '—'}
                          </td>

                          {/* Line total (read-only) */}
                          <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-900">
                            {resolved.grantAmount > 0 ? fmtCurrency(resolved.lineTotal) : '—'}
                          </td>

                          {/* Remove button */}
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeLineItem(li.key)}
                              disabled={submitting}
                              className="p-1 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                              title="Remove line"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Totals footer */}
                  <tfoot>
                    <tr className="bg-blue-50 border-t border-gray-200 font-medium">
                      <td className="px-3 py-2 text-sm text-gray-700">
                        Totals ({resolvedLineItems.filter(li => li.projectId && li.grantAmount > 0).length} project{resolvedLineItems.filter(li => li.projectId && li.grantAmount > 0).length !== 1 ? 's' : ''})
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-900">
                        {fmtCurrency(totalGrantAmount)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                        {fmtCurrency(totalBankFees)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-blue-700">
                        {fromLocation?.currency ?? ''} {fmtCurrency(totalNetToProject)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Bank fee info note */}
            <div className="flex items-start gap-2 mt-2 text-xs text-gray-500">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>
                Grant amount is the gross amount (inclusive of {(BANK_FEE_RATE * 100).toFixed(1)}% bank fee). Net to project = grant amount minus extracted bank fee.
              </span>
            </div>
          </div>

          {/* Exchange rate (only for cross-currency) */}
          {isCrossCurrency && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Exchange Rate
                <span className="text-gray-400 font-normal ml-1">
                  (1 {fromLocation.currency} = ? {toLocation.currency})
                </span>
              </label>
              <input
                type="number"
                value={exchangeRate}
                onChange={e => setExchangeRate(e.target.value === '' ? '' : Number(e.target.value))}
                min={0}
                step={0.01}
                placeholder="e.g. 3750"
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
              />

              {/* Converted amount preview */}
              {convertedAmount !== null && (
                <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                  <span className="text-xs font-medium text-blue-600">Converted Amount</span>
                  <p className="text-sm font-semibold text-blue-900">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: toLocation.currency,
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(convertedAmount)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Reference */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Reference
            </label>
            <input
              type="text"
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="e.g. TRF-2025-001"
              disabled={submitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>

          {/* Purpose */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Purpose
            </label>
            <textarea
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              rows={3}
              placeholder="Describe the purpose of this transfer..."
              disabled={submitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Transfer
          </button>
        </div>
      </div>
    </div>
  );
}
