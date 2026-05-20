/**
 * MOCloseoutDialog
 * Modal for formally closing out a completed manufacturing order.
 * Shows cost variance, material consumption, QBO sync status,
 * QC confirmation, routing selection, and a sign-off checklist.
 */

import { useState, useEffect } from 'react';
import {
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  Receipt,
  Truck,
  Package,
  ArrowRight,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import type { ManufacturingOrder } from '../../types';
import {
  buildCloseoutSummary,
  closeoutManufacturingOrder,
  type CloseoutSummary,
  type CloseoutInput,
} from '../../services/moCloseoutService';
import { syncMOToCOGS, syncQuoteToInvoice } from '@/modules/finance/services/qboSyncService';

interface MOCloseoutDialogProps {
  open: boolean;
  onClose: () => void;
  order: ManufacturingOrder;
  userId: string;
  onClosedOut: () => void;
}

function formatCurrency(value: number | undefined | null): string {
  if (value == null) return 'UGX 0';
  return `UGX ${value.toLocaleString()}`;
}

function varianceColor(pct: number | undefined | null): string {
  const abs = Math.abs(pct ?? 0);
  if (abs <= 5) return 'text-green-700 bg-green-50';
  if (abs <= 15) return 'text-amber-700 bg-amber-50';
  return 'text-red-700 bg-red-50';
}

export function MOCloseoutDialog({
  open,
  onClose,
  order,
  userId,
  onClosedOut,
}: MOCloseoutDialogProps) {
  const [summary, setSummary] = useState<CloseoutSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingInvoice, setSyncingInvoice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Checklist
  const [qcConfirmed, setQcConfirmed] = useState(false);
  const [finishedGoodsConfirmed, setFinishedGoodsConfirmed] = useState(false);
  const [varianceAcknowledged, setVarianceAcknowledged] = useState(false);
  const [cogsJournalVerified, setCogsJournalVerified] = useState(false);

  // Routing
  const [routeTo, setRouteTo] = useState<'installation' | 'finished-goods' | ''>('');

  // COGS account selection
  const [selectedCogsAccountId, setSelectedCogsAccountId] = useState('');

  // Notes
  const [closeoutNotes, setCloseoutNotes] = useState('');

  // Load summary on open
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setSummary(null);
    setQcConfirmed(false);
    setFinishedGoodsConfirmed(false);
    setVarianceAcknowledged(false);
    setCogsJournalVerified(false);
    setRouteTo('');
    setSelectedCogsAccountId('');
    setCloseoutNotes('');

    buildCloseoutSummary(order)
      .then(setSummary)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open, order]);

  // Auto-select default COGS account when routing changes
  useEffect(() => {
    if (!summary?.qboAccountsConfig || !routeTo) return;
    const cfg = summary.qboAccountsConfig;
    const defaultId = routeTo === 'installation'
      ? cfg.defaultForInstallation
      : cfg.defaultForFinishedGoods;
    setSelectedCogsAccountId(defaultId);
  }, [routeTo, summary?.qboAccountsConfig]);

  const allChecked =
    qcConfirmed &&
    finishedGoodsConfirmed &&
    varianceAcknowledged &&
    cogsJournalVerified &&
    routeTo !== '' &&
    closeoutNotes.trim().length > 0;

  const selectedAccountName = summary?.qboAccountsConfig?.cogsAccounts.find(
    (a) => a.id === selectedCogsAccountId,
  )?.name;

  const handleSyncCOGS = async () => {
    setSyncing(true);
    setError(null);
    try {
      await syncMOToCOGS(order.id, selectedCogsAccountId || undefined);
      // Refresh summary to pick up updated sync status
      const updated = await buildCloseoutSummary(order);
      setSummary(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to sync COGS journal entry');
    } finally {
      setSyncing(false);
    }
  };


  const handleSyncInvoice = async () => {
    if (!summary?.qboInvoice.quoteId) return;
    setSyncingInvoice(true);
    setError(null);
    try {
      await syncQuoteToInvoice(summary.qboInvoice.quoteId);
      const updated = await buildCloseoutSummary(order);
      setSummary(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to sync Invoice');
    } finally {
      setSyncingInvoice(false);
    }
  };

  const handleCloseout = async () => {
    if (!allChecked) return;
    setClosing(true);
    setError(null);
    try {
      const data: CloseoutInput = {
        closeoutNotes: closeoutNotes.trim(),
        qcConfirmed,
        finishedGoodsConfirmed,
        varianceAcknowledged,
        cogsJournalVerified,
        routeTo: routeTo as 'installation' | 'finished-goods',
        cogsAccountId: selectedCogsAccountId || undefined,
        cogsAccountName: selectedAccountName || undefined,
      };
      await closeoutManufacturingOrder(order.id, data, userId);
      onClosedOut();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to close out order');
    } finally {
      setClosing(false);
    }
  };

  if (!open) return null;

  const accountsCfg = summary?.qboAccountsConfig;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Close Out Manufacturing Order
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {order.moNumber} — {order.designItemName || order.itemName}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg" disabled={closing}>
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Loading closeout summary...</span>
            </div>
          ) : summary ? (
            <>
              {/* 1. Cost Summary */}
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Cost Summary</h3>
                {summary.finalCost ? (
                  <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Estimated</p>
                      <p className="font-semibold">{formatCurrency(summary.finalCost.totalEstimatedCost)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Actual</p>
                      <p className="font-semibold">{formatCurrency(summary.finalCost.totalActualCost)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Variance</p>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${varianceColor(summary.finalCost.costVariancePercent)}`}>
                        {(summary.finalCost.costVariance ?? 0) >= 0 ? '+' : ''}{formatCurrency(summary.finalCost.costVariance)}
                        {' '}({(summary.finalCost.costVariancePercent ?? 0) >= 0 ? '+' : ''}{(summary.finalCost.costVariancePercent ?? 0).toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">Final cost not yet computed by system</p>
                )}
                {summary.scheduleDaysVariance !== null && (
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Schedule variance: {summary.scheduleDaysVariance > 0 ? `+${summary.scheduleDaysVariance}` : summary.scheduleDaysVariance} days
                  </p>
                )}
              </section>

              {/* 2. Material Variance Table */}
              {summary.materialLines.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Material Variance</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Item</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500">Planned</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500">Actual</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500">Waste</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500">Cost Plan</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500">Cost Actual</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-500">Var%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {summary.materialLines.map((line) => (
                          <tr key={line.bomEntryId}>
                            <td className="px-3 py-2 text-gray-900 truncate max-w-[160px]">{line.itemName}</td>
                            <td className="px-3 py-2 text-right text-gray-600">{line.plannedQty}</td>
                            <td className="px-3 py-2 text-right text-gray-600">{line.actualQty}</td>
                            <td className="px-3 py-2 text-right text-gray-600">{line.wasteQty > 0 ? line.wasteQty : '-'}</td>
                            <td className="px-3 py-2 text-right text-gray-600">{formatCurrency(line.plannedCost)}</td>
                            <td className="px-3 py-2 text-right text-gray-600">{formatCurrency(line.actualCost)}</td>
                            <td className="px-3 py-2 text-right">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${varianceColor(line.variancePercent)}`}>
                                {(line.variancePercent ?? 0) >= 0 ? '+' : ''}{(line.variancePercent ?? 0).toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* 3. Quality Confirmation */}
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Quality Check</h3>
                {summary.qcPassed !== null ? (
                  <div className={`flex items-center gap-2 text-sm ${summary.qcPassed ? 'text-green-700' : 'text-red-700'}`}>
                    {summary.qcPassed ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <AlertTriangle className="w-4 h-4" />
                    )}
                    <span className="font-medium">{summary.qcPassed ? 'QC Passed' : 'QC Failed'}</span>
                    {summary.qcDefects.length > 0 && (
                      <span className="text-gray-500 font-normal">
                        — {summary.qcDefects.length} defect{summary.qcDefects.length !== 1 ? 's' : ''}: {summary.qcDefects.join(', ')}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No QC inspection recorded</p>
                )}
              </section>

              {/* 4. Post-Completion Routing */}
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Post-Completion Routing</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRouteTo('installation')}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                      routeTo === 'installation'
                        ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Truck className={`w-5 h-5 ${routeTo === 'installation' ? 'text-emerald-600' : 'text-gray-400'}`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Installation</p>
                      <p className="text-xs text-gray-500">Route to fulfillment pipeline</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRouteTo('finished-goods')}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                      routeTo === 'finished-goods'
                        ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Package className={`w-5 h-5 ${routeTo === 'finished-goods' ? 'text-emerald-600' : 'text-gray-400'}`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Finished Goods</p>
                      <p className="text-xs text-gray-500">Receipt into inventory stock</p>
                    </div>
                  </button>
                </div>
              </section>

              {/* 5. QuickBooks Sync */}
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">QuickBooks Sync</h3>
                <div className="border rounded-lg divide-y divide-gray-100">
                  {/* Invoice status */}
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-500 w-16">Invoice</span>
                        {summary.qboInvoice.synced ? (
                          <a
                            href={`https://app.qbo.intuit.com/app/invoice?txnId=${summary.qboInvoice.qboInvoiceId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-700 font-medium flex items-center gap-1 hover:underline"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Invoice #{summary.qboInvoice.qboInvoiceDocNumber} created
                          </a>
                        ) : summary.qboInvoice.error ? (
                          <span className="text-red-600 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> {summary.qboInvoice.error}
                          </span>
                        ) : (
                          <span className="text-amber-600 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> Not yet synced
                          </span>
                        )}
                      </div>
                      {/* Sync Invoice button */}
                      {!summary.qboInvoice.synced && summary.qboInvoice.quoteId && (
                        <button
                          type="button"
                          onClick={handleSyncInvoice}
                          disabled={syncingInvoice}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                        >
                          {syncingInvoice ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                          {syncingInvoice ? 'Syncing...' : 'Sync Invoice'}
                        </button>
                      )}
                    </div>
                    {summary.qboInvoice.missingSalesOrder && !summary.qboInvoice.synced && (
                      <p className="mt-1.5 ml-6 text-[11px] text-gray-400">
                        No Sales Order in QBO — invoice will be created directly from the quote
                      </p>
                    )}
                  </div>

                  {/* COGS Journal — account selector + sync button */}
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <Receipt className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-500 w-16">COGS</span>
                        {summary.qboJournal.synced ? (
                          <span className="text-green-700 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Journal Entry recorded
                          </span>
                        ) : summary.qboJournal.error ? (
                          <span className="text-red-600 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> {summary.qboJournal.error}
                          </span>
                        ) : (
                          <span className="text-gray-400">Not yet synced</span>
                        )}
                      </div>
                      {/* Sync button */}
                      {!summary.qboJournal.synced && (
                        <button
                          type="button"
                          onClick={handleSyncCOGS}
                          disabled={syncing || !selectedCogsAccountId}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                          title={!selectedCogsAccountId ? 'Select a COGS account first' : ''}
                        >
                          {syncing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                          {syncing ? 'Syncing...' : summary.qboJournal.error ? 'Retry Sync' : 'Sync COGS'}
                        </button>
                      )}
                    </div>

                    {/* COGS breakdown when synced */}
                    {summary.qboJournal.synced && summary.qboJournal.cogsRecorded && (
                      <div className="mt-2 ml-6 text-xs text-gray-500 bg-gray-50 rounded-lg p-2.5 grid grid-cols-3 gap-2">
                        <div>
                          <p className="text-gray-400">Material</p>
                          <p className="font-medium text-gray-700">{formatCurrency(summary.qboJournal.cogsRecorded.materialCost)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Labour</p>
                          <p className="font-medium text-gray-700">{formatCurrency(summary.qboJournal.cogsRecorded.laborCost)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Total COGS</p>
                          <p className="font-medium text-gray-900">{formatCurrency(summary.qboJournal.cogsRecorded.totalCOGS)}</p>
                        </div>
                      </div>
                    )}

                    {/* COGS Account Selector */}
                    {accountsCfg && accountsCfg.cogsAccounts.length > 0 && (
                      <div className="mt-3 ml-6">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          COGS Account
                        </label>
                        <div className="relative">
                          <select
                            value={selectedCogsAccountId}
                            onChange={(e) => setSelectedCogsAccountId(e.target.value)}
                            className="w-full appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Select COGS account...</option>
                            {accountsCfg.cogsAccounts.map((acct) => (
                              <option key={acct.id} value={acct.id}>
                                {acct.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                        {selectedCogsAccountId && accountsCfg && (
                          <p className="text-[11px] text-gray-400 mt-1">
                            Debit: <span className="text-gray-600">{selectedAccountName}</span>
                            {' '}/ Credit: <span className="text-gray-600">{accountsCfg.inventoryAccountName}</span>
                          </p>
                        )}
                        {!routeTo && (
                          <p className="text-[11px] text-gray-400 mt-1 italic">
                            Select a routing option to auto-suggest an account
                          </p>
                        )}
                      </div>
                    )}
                    {!accountsCfg && (
                      <p className="mt-2 ml-6 text-xs text-gray-400 italic">
                        QBO account mapping not configured
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* 6. Checklist */}
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Sign-Off Checklist</h3>
                <div className="space-y-2">
                  {[
                    { checked: qcConfirmed, set: setQcConfirmed, label: 'Quality check confirmed' },
                    { checked: finishedGoodsConfirmed, set: setFinishedGoodsConfirmed, label: 'Finished goods received and verified' },
                    { checked: varianceAcknowledged, set: setVarianceAcknowledged, label: 'Cost variance reviewed and acknowledged' },
                    { checked: cogsJournalVerified, set: setCogsJournalVerified, label: 'COGS journal entry verified' },
                  ].map(({ checked, set, label }) => (
                    <label key={label} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => set(e.target.checked)}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
              </section>

              {/* 7. Reservation Warning */}
              {summary.activeReservationCount > 0 && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-800">
                    {summary.activeReservationCount} active material reservation{summary.activeReservationCount !== 1 ? 's' : ''} will be released on closeout.
                  </p>
                </div>
              )}

              {/* 8. Closeout Notes */}
              <section>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Closeout Notes</h3>
                <textarea
                  value={closeoutNotes}
                  onChange={(e) => setCloseoutNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  placeholder="Summary of closeout findings, observations, or follow-up actions..."
                />
              </section>
            </>
          ) : null}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              disabled={closing}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCloseout}
              disabled={closing || !allChecked}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {closing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Closing Out...
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4" />
                  Close Out Order
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
