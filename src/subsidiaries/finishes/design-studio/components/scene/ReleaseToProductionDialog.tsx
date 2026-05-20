/**
 * ReleaseToProductionDialog — P3 UI entry point
 *
 * Takes a DesignItem + its candidate cabinets (pre-filtered by the caller
 * to one design-item group inside a scene's roster) and lets the user
 * release them to production. Under the hood it calls the P3 service:
 *
 *   createMOFromDesignItem(projectId, designItemId, options, userId)
 *
 * The dialog surfaces:
 *   - the DesignItem context (name, code)
 *   - a quick summary of the slice being released (count, estimated
 *     total, currency) — pre-computed from each cabinet's
 *     `estimatedPrice.total`
 *   - lock / currency warnings that WOULD cause the service to reject,
 *     so the user sees the blocker before clicking Release
 *   - a success state showing the new MO id + locked-cabinet count
 *
 * Intentionally no scope-editing UI: the group's membership *is* the
 * scope. If the caller wants partial release, they should filter
 * upstream (future: multi-select → partial release). Keeping this dialog
 * single-purpose makes the happy path 2 clicks.
 */
import { useMemo, useState } from 'react';
import type { SceneCabinet } from '../../types/scene.types';
import type { DesignItem } from '@/modules/design-manager/types';
import { useCreateMOFromDesignItem } from '../../hooks/useCreateMOFromDesignItem';

interface ReleaseToProductionDialogProps {
  projectId: string;
  designItem: DesignItem;
  cabinets: SceneCabinet[];
  userId: string;
  onClose: () => void;
  /** Fired after the user acknowledges the success panel. */
  onReleased?: (moId: string) => void;
}

function formatCurrency(amount: number, currency: 'UGX' | 'USD'): string {
  if (currency === 'USD') {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
  }
  return `UGX ${amount.toLocaleString('en-UG', { minimumFractionDigits: 0 })}`;
}

export function ReleaseToProductionDialog({
  projectId,
  designItem,
  cabinets,
  userId,
  onClose,
  onReleased,
}: ReleaseToProductionDialogProps) {
  const { isCreating, error, result, release, reset } = useCreateMOFromDesignItem({
    projectId,
    designItemId: designItem.id,
    userId,
  });

  const [userNotes, setUserNotes] = useState('');

  // ── Pre-flight: the same guards the service enforces, surfaced in the UI ──
  const preflight = useMemo(() => {
    const locked = cabinets.filter(c => c.isLocked);
    const currencies = new Set<string>();
    let estimatedTotal = 0;
    for (const c of cabinets) {
      const price = c.estimatedPrice as unknown as
        | { total?: number; currency?: string }
        | null;
      const cur =
        price?.currency === 'USD' || price?.currency === 'UGX'
          ? price.currency
          : 'UGX';
      currencies.add(cur);
      estimatedTotal += typeof price?.total === 'number' ? price.total : 0;
    }
    const currency: 'UGX' | 'USD' = currencies.has('UGX')
      ? 'UGX'
      : currencies.has('USD')
      ? 'USD'
      : 'UGX';
    return {
      lockedCount: locked.length,
      hasMixedCurrencies: currencies.size > 1,
      estimatedTotal,
      currency,
      sceneCount: new Set(cabinets.map(c => c.sceneId)).size,
    };
  }, [cabinets]);

  const canRelease =
    cabinets.length > 0 &&
    preflight.lockedCount === 0 &&
    !preflight.hasMixedCurrencies &&
    !isCreating &&
    !result;

  const handleConfirm = async () => {
    const res = await release({
      instructions: userNotes || undefined,
    });
    if (res && onReleased) {
      onReleased(res.moId);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">
            {result ? 'Released to Production' : 'Release to Production'}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {result ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                <p className="text-sm font-medium text-green-900">
                  Manufacturing order created.
                </p>
                <p className="text-xs text-green-800 mt-1 font-mono break-all">
                  MO id: {result.moId}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-gray-500">Cabinets locked</dt>
                  <dd className="font-medium">
                    {result.lockedCabinets.length} of {cabinets.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">BOM line items</dt>
                  <dd className="font-medium">{result.bomLineCount}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Currency</dt>
                  <dd className="font-medium">{result.currency}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Design item</dt>
                  <dd className="font-medium truncate" title={designItem.name}>
                    {designItem.name}
                  </dd>
                </div>
              </dl>
              <p className="text-xs text-gray-500">
                The included cabinets are now <strong>locked</strong> in this
                scene and cannot be edited until the MO is cancelled. The new
                MO is available in the Manufacturing module.
              </p>
            </div>
          ) : (
            <>
              {/* DesignItem context */}
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-500 mb-1">
                  Design Item
                </p>
                <p className="text-sm font-medium">{designItem.name}</p>
                {designItem.itemCode && (
                  <p className="text-xs font-mono text-gray-500 mt-0.5">
                    {designItem.itemCode}
                  </p>
                )}
              </div>

              {/* Slice summary */}
              <dl className="grid grid-cols-2 gap-3 text-sm border rounded-lg p-3">
                <div>
                  <dt className="text-xs text-gray-500">Cabinets</dt>
                  <dd className="font-medium">{cabinets.length}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Scenes involved</dt>
                  <dd className="font-medium">{preflight.sceneCount}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Estimated total</dt>
                  <dd className="font-medium">
                    {formatCurrency(preflight.estimatedTotal, preflight.currency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Priority</dt>
                  <dd className="font-medium capitalize">
                    {designItem.priority ?? 'medium'}
                  </dd>
                </div>
              </dl>

              {/* Pre-flight warnings */}
              {preflight.lockedCount > 0 && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                  <p className="font-medium">
                    {preflight.lockedCount} cabinet
                    {preflight.lockedCount === 1 ? ' is' : 's are'} already
                    locked to an existing MO.
                  </p>
                  <p className="text-xs mt-1">
                    Unlock them (via the Manufacturing module) or filter them
                    out before releasing.
                  </p>
                </div>
              )}

              {preflight.hasMixedCurrencies && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
                  <p className="font-medium">Mixed currencies in this slice.</p>
                  <p className="text-xs mt-1">
                    An MO has a single currency. Split the release by currency
                    and try each separately.
                  </p>
                </div>
              )}

              {/* Optional notes */}
              <div>
                <label
                  htmlFor="release-notes"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Instructions (optional)
                </label>
                <textarea
                  id="release-notes"
                  value={userNotes}
                  onChange={e => setUserNotes(e.target.value)}
                  rows={3}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  placeholder="Build-specific instructions for the shop floor."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leaves the DesignItem's `notes` field as the default if
                  blank.
                </p>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                  <p className="font-medium">Release failed</p>
                  <p className="text-xs mt-1 break-words">{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-3 border-t bg-gray-50">
          {result ? (
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!canRelease}
                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isCreating ? 'Releasing…' : 'Release to Production'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
