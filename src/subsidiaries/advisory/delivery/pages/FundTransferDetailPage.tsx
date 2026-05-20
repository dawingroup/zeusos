/**
 * FundTransferDetailPage
 *
 * Detail page for viewing, editing, confirming, or cancelling a fund transfer.
 * Route: /advisory/delivery/programs/:programId/transfers/:transferId
 */

import { useState, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Loader2,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Trash2,
  Pencil,
  Save,
  X,
  CalendarDays,
  Hash,
  FileText,
  Banknote,
  ArrowLeftRight,
  Clock,
  User,
} from 'lucide-react';
import { useFundTransfer, useFundLocationMutations } from '../hooks/fund-location-hooks';
import {
  getTransferStatusColor,
  calculateBankFee,
  BANK_FEE_RATE,
} from '../types/fund-location';
import type { TransferLineItem } from '../types/fund-location';
import { formatMoney } from '../../core/types/money';
import type { Money } from '../../core/types/money';
import { db } from '@/core/services/firebase';
import { useAuth } from '@/shared/hooks';

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

function formatDate(date: any): string {
  const jsDate = date?.toDate
    ? date.toDate()
    : date instanceof Date
      ? date
      : new Date(date?.seconds ? date.seconds * 1000 : date);
  if (isNaN(jsDate.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(jsDate);
}

function formatDateTime(date: any): string {
  const jsDate = date?.toDate
    ? date.toDate()
    : date instanceof Date
      ? date
      : new Date(date?.seconds ? date.seconds * 1000 : date);
  if (isNaN(jsDate.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(jsDate);
}

function fmtNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function capitalizeStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────

export function FundTransferDetailPage() {
  const { programId, transferId } = useParams<{ programId: string; transferId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.uid || '';

  const { transfer, loading, error, refresh } = useFundTransfer(
    db,
    programId || null,
    transferId || null
  );
  const mutations = useFundLocationMutations(db, userId);

  const [isEditing, setIsEditing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [editReference, setEditReference] = useState('');
  const [editPurpose, setEditPurpose] = useState('');
  const [editLineItems, setEditLineItems] = useState<TransferLineItem[]>([]);

  const isPending = transfer?.status === 'pending';

  const startEditing = useCallback(() => {
    if (!transfer) return;
    setEditReference(transfer.reference);
    setEditPurpose(transfer.purpose);
    setEditLineItems(transfer.lineItems ? [...transfer.lineItems] : []);
    setIsEditing(true);
  }, [transfer]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!programId || !transferId || !transfer) return;
    setSaving(true);
    try {
      // Recompute amount from line items if present
      const totalGrant = editLineItems.reduce((s, li) => s + li.grantAmount, 0);
      const updates: Record<string, any> = {
        reference: editReference,
        purpose: editPurpose,
        lineItems: editLineItems,
      };

      if (editLineItems.length > 0) {
        updates.amount = {
          amount: totalGrant,
          currency: transfer.amount.currency,
        } as Money;

        // If cross-currency, recompute converted amount
        if (transfer.exchangeRate) {
          updates.convertedAmount = {
            amount: totalGrant * transfer.exchangeRate.rate,
            currency: transfer.convertedAmount?.currency || transfer.exchangeRate.toCurrency,
          } as Money;
        }
      }

      await mutations.updateTransfer(programId, transferId, updates);
      setIsEditing(false);
      await refresh();
    } catch (err) {
      console.error('Failed to save transfer:', err);
    } finally {
      setSaving(false);
    }
  }, [programId, transferId, transfer, editReference, editPurpose, editLineItems, mutations, refresh]);

  const handleConfirm = useCallback(async () => {
    if (!programId || !transferId) return;
    setSaving(true);
    try {
      await mutations.confirmTransfer(programId, transferId);
      setShowConfirmDialog(false);
      await refresh();
    } catch (err) {
      console.error('Failed to confirm transfer:', err);
    } finally {
      setSaving(false);
    }
  }, [programId, transferId, mutations, refresh]);

  const handleCancel = useCallback(async () => {
    if (!programId || !transferId) return;
    setSaving(true);
    try {
      await mutations.cancelTransfer(programId, transferId);
      setShowCancelDialog(false);
      await refresh();
    } catch (err) {
      console.error('Failed to cancel transfer:', err);
    } finally {
      setSaving(false);
    }
  }, [programId, transferId, mutations, refresh]);

  const handleDelete = useCallback(async () => {
    if (!programId || !transferId) return;
    setSaving(true);
    try {
      await mutations.deleteTransfer(programId, transferId);
      setShowDeleteDialog(false);
      navigate(`/advisory/delivery/programs/${programId}/budget`);
    } catch (err) {
      console.error('Failed to delete transfer:', err);
    } finally {
      setSaving(false);
    }
  }, [programId, transferId, mutations, navigate]);

  const handleLineItemChange = useCallback(
    (index: number, grantAmount: number) => {
      setEditLineItems(prev => {
        const next = [...prev];
        const bankFee = calculateBankFee(grantAmount);
        next[index] = {
          ...next[index],
          grantAmount,
          bankFee,
          lineTotal: grantAmount - bankFee,
        };
        return next;
      });
    },
    []
  );

  // Derived totals
  const lineItemTotals = useMemo(() => {
    const items = isEditing ? editLineItems : (transfer?.lineItems || []);
    return {
      grantTotal: items.reduce((s, li) => s + li.grantAmount, 0),
      feeTotal: items.reduce((s, li) => s + li.bankFee, 0),
      netTotal: items.reduce((s, li) => s + li.lineTotal, 0),
    };
  }, [isEditing, editLineItems, transfer?.lineItems]);

  // ── Loading ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-600">Loading transfer...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-4">
        <Link
          to={`/advisory/delivery/programs/${programId}/budget`}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Budget
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{error.message}</span>
        </div>
      </div>
    );
  }

  if (!transfer) {
    return (
      <div className="p-6 space-y-4">
        <Link
          to={`/advisory/delivery/programs/${programId}/budget`}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Budget
        </Link>
        <div className="text-center py-12">
          <h2 className="text-xl font-medium text-gray-900">Transfer not found</h2>
          <p className="text-gray-600 mt-2">This transfer may have been deleted.</p>
        </div>
      </div>
    );
  }

  const statusColor = getTransferStatusColor(transfer.status);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* Back link */}
      <Link
        to={`/advisory/delivery/programs/${programId}/budget`}
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        Back to Program Budget
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {transfer.reference}
            </h1>
            <span className={`inline-flex items-center px-2.5 py-1 text-sm font-medium rounded-full ${statusColor}`}>
              {capitalizeStatus(transfer.status)}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">Fund Transfer Detail</p>
        </div>

        {/* Action buttons */}
        {!isEditing && (
          <div className="flex items-center gap-2">
            {isPending && (
              <>
                <button
                  onClick={startEditing}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => setShowConfirmDialog(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm
                </button>
                <button
                  onClick={() => setShowCancelDialog(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
                >
                  <XCircle className="w-4 h-4" />
                  Cancel Transfer
                </button>
              </>
            )}
            {transfer.status !== 'confirmed' && (
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
        )}

        {isEditing && (
          <div className="flex items-center gap-2">
            <button
              onClick={cancelEditing}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <X className="w-4 h-4" />
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Amount */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <Banknote className="w-4 h-4" />
            Amount
          </div>
          <p className="text-lg font-semibold text-gray-900">{formatMoney(transfer.amount)}</p>
          {transfer.convertedAmount && (
            <p className="text-sm text-gray-500 mt-0.5">{formatMoney(transfer.convertedAmount)}</p>
          )}
        </div>

        {/* Direction */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <ArrowLeftRight className="w-4 h-4" />
            Direction
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
            <span>{transfer.fromLocationName}</span>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <span>{transfer.toLocationName}</span>
          </div>
        </div>

        {/* Date */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <CalendarDays className="w-4 h-4" />
            Transfer Date
          </div>
          <p className="text-sm font-medium text-gray-900">
            {formatDate(transfer.transferDate)}
          </p>
        </div>

        {/* Status */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <Clock className="w-4 h-4" />
            Status
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 text-sm font-medium rounded-full ${statusColor}`}>
            {capitalizeStatus(transfer.status)}
          </span>
          {transfer.confirmedAt && (
            <p className="text-xs text-gray-500 mt-1">
              Confirmed {formatDateTime(transfer.confirmedAt)}
            </p>
          )}
        </div>
      </div>

      {/* Detail Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main detail - 2 cols */}
        <div className="lg:col-span-2 space-y-6">
          {/* Reference & Purpose */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Transfer Details</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  <Hash className="w-3.5 h-3.5 inline mr-1" />
                  Reference
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editReference}
                    onChange={e => setEditReference(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-sm font-mono text-gray-900">{transfer.reference}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  <FileText className="w-3.5 h-3.5 inline mr-1" />
                  Purpose
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editPurpose}
                    onChange={e => setEditPurpose(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-sm text-gray-900">{transfer.purpose || '—'}</p>
                )}
              </div>
            </div>

            {/* Exchange Rate */}
            {transfer.exchangeRate && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  <ArrowLeftRight className="w-3.5 h-3.5 inline mr-1" />
                  Exchange Rate
                </label>
                <p className="text-sm text-gray-900">
                  1 {transfer.exchangeRate.fromCurrency} ={' '}
                  {new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(
                    transfer.exchangeRate.rate
                  )}{' '}
                  {transfer.exchangeRate.toCurrency}
                  <span className="text-gray-500 ml-2">
                    ({transfer.exchangeRate.source})
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Line Items Table */}
          {((transfer.lineItems && transfer.lineItems.length > 0) || isEditing) && (
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h3 className="text-base font-semibold text-gray-900 mb-3">
                Project Breakdown
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                      <th className="text-left py-2 pr-4">Project</th>
                      <th className="text-right py-2 px-3">Grant Amount</th>
                      <th className="text-right py-2 px-3">Bank Fee ({(BANK_FEE_RATE * 100).toFixed(1)}%)</th>
                      <th className="text-right py-2 pl-3">Net to Project</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(isEditing ? editLineItems : transfer.lineItems || []).map((li, idx) => (
                      <tr key={li.id}>
                        <td className="py-2.5 pr-4 text-gray-800">
                          <span className="text-gray-500">{li.projectCode}</span>
                          {' — '}
                          {li.projectName}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {isEditing ? (
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={li.grantAmount}
                              onChange={e => handleLineItemChange(idx, parseFloat(e.target.value) || 0)}
                              className="w-32 px-2 py-1 text-right text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <span className="tabular-nums text-gray-700">{fmtNumber(li.grantAmount)}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-gray-500">
                          {fmtNumber(li.bankFee)}
                        </td>
                        <td className="py-2.5 pl-3 text-right tabular-nums font-medium text-gray-900">
                          {fmtNumber(li.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 font-semibold text-gray-900">
                      <td className="py-2.5 pr-4">Total</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        {fmtNumber(lineItemTotals.grantTotal)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-500">
                        {fmtNumber(lineItemTotals.feeTotal)}
                      </td>
                      <td className="py-2.5 pl-3 text-right tabular-nums font-bold">
                        {fmtNumber(lineItemTotals.netTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Audit info */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Audit Trail</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-gray-500 flex items-center gap-1">
                  <User className="w-3.5 h-3.5" /> Created By
                </dt>
                <dd className="text-gray-900 mt-0.5">{transfer.createdBy}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5" /> Created At
                </dt>
                <dd className="text-gray-900 mt-0.5">{formatDateTime(transfer.createdAt)}</dd>
              </div>
              {transfer.confirmedBy && (
                <div>
                  <dt className="text-xs text-gray-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed By
                  </dt>
                  <dd className="text-gray-900 mt-0.5">{transfer.confirmedBy}</dd>
                </div>
              )}
              {transfer.confirmedAt && (
                <div>
                  <dt className="text-xs text-gray-500 flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5" /> Confirmed At
                  </dt>
                  <dd className="text-gray-900 mt-0.5">{formatDateTime(transfer.confirmedAt)}</dd>
                </div>
              )}
            </dl>
          </div>

          {transfer.budgetPeriodId && (
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Budget Period</h3>
              <p className="text-sm text-gray-700">{transfer.budgetPeriodId}</p>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Transfer</h3>
            <p className="text-sm text-gray-600 mb-1">
              Are you sure you want to confirm this transfer?
            </p>
            <p className="text-sm text-gray-600 mb-4">
              <strong>{transfer.reference}</strong> — {formatMoney(transfer.amount)} from{' '}
              {transfer.fromLocationName} to {transfer.toLocationName}
            </p>
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              Once confirmed, this transfer will affect fund location balances and cannot be reverted
              to pending.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Confirming...' : 'Confirm Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Cancel Transfer</h3>
            <p className="text-sm text-gray-600 mb-1">
              Are you sure you want to cancel this transfer?
            </p>
            <p className="text-sm text-gray-600 mb-4">
              <strong>{transfer.reference}</strong> — {formatMoney(transfer.amount)}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCancelDialog(false)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Go Back
              </button>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? 'Cancelling...' : 'Cancel Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Transfer</h3>
            <p className="text-sm text-gray-600 mb-1">
              This action is <strong>permanent</strong> and cannot be undone.
            </p>
            <p className="text-sm text-gray-600 mb-4">
              <strong>{transfer.reference}</strong> — {formatMoney(transfer.amount)}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Go Back
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {saving ? 'Deleting...' : 'Delete Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
