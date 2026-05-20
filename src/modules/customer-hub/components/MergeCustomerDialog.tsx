/**
 * MergeCustomerDialog
 * Operator flow for deduping a customer record into another.
 *
 * Three-step flow inside a single modal:
 *   1. "Pick target" — choose the SURVIVING customer via CustomerPicker.
 *      Target defaults to nothing; validation prevents self-merge.
 *   2. "Preview" — call `previewMerge()` and show the per-collection
 *      breakdown. Operator sees exactly how many rows in CRM, sales
 *      orders, projects, etc. will be rewritten.
 *   3. "Confirm" — typed reason + final apply. Dispatches
 *      `mergeParty({ apply: true })`. On success, navigates to the
 *      target customer's detail page.
 *
 * Why three steps in one dialog: a merge is irreversible for practical
 * purposes (nothing is deleted, but un-rewriting pointers requires a
 * manual batch reverse). The extra friction is deliberate — operators
 * should see the blast radius AND type a reason before confirming.
 *
 * Scoped to finishes `Customer` records. Advisory `Client` merges use
 * the same underlying service but deserve their own subsidiary UI when
 * the advisory product surface catches up.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2, X, ArrowRight } from 'lucide-react';
import { CustomerPicker } from './CustomerPicker';
import type { CustomerPickerValue } from './CustomerPicker';
import {
  mergeParty,
  previewMerge,
  PartyMergeError,
  type MergePlan,
} from '@/shared/services/partyMergeService';
import { useAuth } from '@/contexts/AuthContext';
import type { Customer } from '../types';

interface MergeCustomerDialogProps {
  /** Source = the record being retired. */
  source: Customer;
  onClose: () => void;
}

type Step = 'pick' | 'preview' | 'applying' | 'done' | 'error';

export function MergeCustomerDialog({ source, onClose }: MergeCustomerDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [target, setTarget] = useState<CustomerPickerValue | null>(null);
  const [step, setStep] = useState<Step>('pick');
  const [plan, setPlan] = useState<MergePlan | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Kick off the preview whenever a target is picked. The preview is
  // cheap (a handful of queries, no writes) and re-running it on target
  // change keeps the displayed counts honest if the operator swaps
  // their pick.
  useEffect(() => {
    if (!target) {
      setPlan(null);
      setStep('pick');
      return;
    }
    if (target.customerId === source.id) {
      setError('Cannot merge a customer into itself. Pick a different target.');
      setStep('error');
      setPlan(null);
      return;
    }
    let cancelled = false;
    setStep('preview');
    setError(null);
    setPlan(null);
    previewMerge(
      { partyId: source.id, partyKind: 'finishes_customer' },
      { partyId: target.customerId, partyKind: 'finishes_customer' },
    )
      .then((p) => {
        if (!cancelled) setPlan(p);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setStep('error');
      });
    return () => {
      cancelled = true;
    };
  }, [target, source.id]);

  async function handleApply() {
    if (!target || !user?.email) return;
    setStep('applying');
    setError(null);
    try {
      const result = await mergeParty(
        { partyId: source.id, partyKind: 'finishes_customer' },
        { partyId: target.customerId, partyKind: 'finishes_customer' },
        {
          userId: user.email,
          apply: true,
          reason: reason.trim() || undefined,
        },
      );
      if (!result.applied) {
        // Shouldn't happen since we pass apply:true, but be explicit.
        throw new Error('Merge did not apply — check permissions.');
      }
      setStep('done');
      // Small pause so the operator sees the success state before the
      // navigation yanks the modal away.
      setTimeout(() => navigate(`/customers/${target.customerId}`), 1200);
    } catch (err: unknown) {
      setError(
        err instanceof PartyMergeError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Merge failed.',
      );
      setStep('error');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Merge duplicate customer</h2>
          <button
            onClick={onClose}
            disabled={step === 'applying'}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto space-y-5">
          {/* Source line */}
          <div className="text-sm">
            <p className="text-gray-500 mb-1">Retiring this record:</p>
            <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-100 rounded">
              <span className="font-medium text-gray-900">{source.name}</span>
              <span className="text-xs text-gray-500 bg-white px-1.5 py-0.5 rounded">{source.code}</span>
            </div>
          </div>

          {/* Target picker */}
          <div>
            <p className="text-gray-500 text-sm mb-1">Merging into (surviving record):</p>
            <CustomerPicker
              value={target}
              onChange={setTarget}
              label=""
              placeholder="Search for the customer to keep..."
              disabled={step === 'applying' || step === 'done'}
            />
          </div>

          {/* Preview plan */}
          {step === 'preview' && !plan && !error && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Calculating impact…
            </div>
          )}

          {plan && step !== 'applying' && step !== 'done' && (
            <div className="border border-amber-200 bg-amber-50 rounded p-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-2 flex-1">
                  <p className="font-medium text-amber-900">
                    {plan.totalDocs === 1
                      ? 'Only the customer record will change.'
                      : `This will rewrite ${plan.totalDocs - 1} cross-module pointer${plan.totalDocs - 1 === 1 ? '' : 's'} and retire the source.`}
                  </p>
                  {Object.entries(plan.breakdown).length > 0 && (
                    <ul className="text-xs text-amber-800 space-y-0.5">
                      {Object.entries(plan.breakdown).map(([col, n]) => (
                        <li key={col} className="flex items-center gap-1.5">
                          <span className="inline-block w-1 h-1 bg-amber-600 rounded-full" />
                          <span className="font-mono">{col}</span>
                          <span>×{n}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-amber-800 pt-1">
                    The source record is kept for audit (marked <code className="bg-white px-1 rounded">mergedInto</code>). Nothing is deleted.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Reason */}
          {plan && step !== 'applying' && step !== 'done' && (
            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Reason <span className="text-gray-400">(optional, captured in audit trail)</span>
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Shopify auto-created a duplicate; consolidating under the operator-created record"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          {/* Applying / done states */}
          {step === 'applying' && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              Merging — do not close this dialog…
            </div>
          )}
          {step === 'done' && (
            <div className="flex items-center gap-2 text-sm text-green-700">
              <ArrowRight className="h-4 w-4" />
              Merged. Redirecting to surviving record…
            </div>
          )}
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={step === 'applying'}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded disabled:opacity-50"
          >
            {step === 'done' ? 'Close' : 'Cancel'}
          </button>
          {step !== 'done' && (
            <button
              onClick={handleApply}
              disabled={!plan || step === 'applying' || step === 'preview' || !target}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {step === 'applying' ? 'Merging…' : 'Merge and retire source'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
