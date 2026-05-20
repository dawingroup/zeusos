/**
 * LinkedBoqItemsCard — P9b
 *
 * Displays the advisory BOQ line items cross-linked to this DesignItem,
 * rendered as a card in the OverviewTab sidebar. Reconciliation-only:
 * the link is an annotation that surfaces cost / quantity divergence
 * between the two independent cost systems. No automatic sync.
 *
 * Responsibilities:
 *   - Fetch each id in `designItem.linkedBoqItemIds` via the
 *     project-agnostic `fetchControlBoqItemById` helper (we don't know
 *     which advisory project each link lives in from this surface;
 *     Firestore rules enforce tenancy).
 *   - Render description / itemCode / amount per row.
 *   - Offer an unlink action — derives the BOQ's `advisoryProjectId`
 *     from the fetched row's `projectId` field, so the bidirectional
 *     unlink in `boqDesignItemLinkService` can enforce its tenancy
 *     guard on the write.
 *   - Orphaned links (BOQ deleted but id still in the array) render
 *     as a disabled "BOQ item unavailable" row so the user can spot
 *     them and clean up via the unlink button.
 *
 * Creation of new links is deliberately NOT a responsibility of this
 * card — the operator initiates linking from the BOQ-side drawer,
 * where the advisory project context is known. Display-and-unlink is
 * all this surface can safely offer from the DesignItem side.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link2, Loader2, Unlink, AlertTriangle } from 'lucide-react';
import {
  fetchControlBoqItemById,
  unlinkBoqFromDesignItem,
  BOQDesignItemLinkError,
} from '../../services/boqDesignItemLinkService';
import type { ControlBOQItem } from '@/subsidiaries/advisory/delivery/core/types/boq';
import type { DesignItem } from '../../types';
import {
  getDesignItemTotalCost,
  computeCostDivergence,
  DESIGN_ITEM_COST_SOURCE_LABELS,
} from '../../utils/designItemCost';

interface LinkedBoqItemsCardProps {
  /**
   * Full DesignItem — the card reads `linkedBoqItemIds` for the row
   * list AND the sourcing-specific pricing union for the divergence
   * summary. Passing the whole item (rather than the id list alone)
   * lets the header render cost reconciliation without the parent
   * having to pre-compute it.
   */
  designItem: DesignItem;
  designProjectId: string;
  userId: string;
}

/**
 * Per-row shape — we keep the `id` even when the BOQ row is missing
 * so the user can unlink the dangling reference from the UI.
 */
interface LinkedRow {
  id: string;
  item: ControlBOQItem | null;
}

export function LinkedBoqItemsCard({
  designItem,
  designProjectId,
  userId,
}: LinkedBoqItemsCardProps) {
  const designItemId = designItem.id;
  const [rows, setRows] = useState<LinkedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ids = designItem.linkedBoqItemIds ?? [];

  // Reload the BOQ rows whenever the id list changes. Firestore's
  // DesignItem subscription pushes a fresh `linkedBoqItemIds` after
  // unlink commits, so this effect also covers the "refresh after
  // unlink" case without a local mutation.
  useEffect(() => {
    if (ids.length === 0) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all(ids.map(id => fetchControlBoqItemById(id).then(item => ({ id, item }))))
      .then(result => {
        if (!cancelled) setRows(result);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load linked BOQ items');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Serialise the ids so React doesn't refetch on every parent render
    // just because the array reference changed — only content matters.
  }, [ids.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUnlink = useCallback(
    async (row: LinkedRow) => {
      // For orphaned rows (BOQ doc deleted) we can't recover the
      // advisoryProjectId — the service's tenancy guard will reject.
      // Surface this as a clear error so the user knows the dangling
      // reference has to be cleaned up with a direct Firestore edit.
      if (!row.item) {
        setError(
          `BOQ item ${row.id} is gone — its advisory project is unknown, so unlink can't verify tenancy. ` +
            `Ask an admin to clean up the dangling reference.`,
        );
        return;
      }

      setUnlinkingId(row.id);
      setError(null);
      try {
        await unlinkBoqFromDesignItem(
          { advisoryProjectId: row.item.projectId, boqItemId: row.id },
          { designProjectId, designItemId },
          userId,
        );
        // DesignItem subscription will pick up the removed id and the
        // effect above will rerun — no local state mutation needed.
      } catch (err) {
        if (err instanceof BOQDesignItemLinkError) {
          setError(`Unlink failed (${err.code}): ${err.message}`);
        } else {
          setError(err instanceof Error ? err.message : 'Unlink failed');
        }
      } finally {
        setUnlinkingId(null);
      }
    },
    [designProjectId, designItemId, userId],
  );

  // P9c-2 — cost reconciliation. We sum the *fetched* rows (which is a
  // subset of `ids` when some are orphaned) so the divergence reflects
  // what the operator can actually see. The design-side cost is picked
  // from whichever pricing union matches the item's sourcingType.
  const designCost = useMemo(() => getDesignItemTotalCost(designItem), [designItem]);
  const divergence = useMemo(() => {
    const boqAmounts = rows
      .filter(r => r.item && typeof r.item.amount === 'number')
      .map(r => ({
        amount: r.item!.amount,
        currency: r.item!.currency || 'UGX',
      }));
    return computeCostDivergence(designCost, boqAmounts);
  }, [designCost, rows]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">Linked BOQ Items</h3>
        </div>
        {ids.length > 0 && (
          <span className="text-[10px] font-mono text-gray-400">
            {ids.length}
          </span>
        )}
      </div>

      {/* Cost reconciliation summary — only render when we have numbers
          on both sides. The helper returns a discriminated union so we
          can tell "no data" from "currency mismatch" and render
          appropriately. */}
      {'delta' in divergence && (
        <div
          className={`mb-3 rounded-md border p-2.5 text-xs ${
            Math.abs(divergence.percent ?? 0) > 5
              ? 'bg-amber-50 border-amber-200'
              : 'bg-emerald-50 border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-semibold text-gray-700">Cost reconciliation</span>
            {designCost && (
              <span className="text-[10px] text-gray-500">
                {DESIGN_ITEM_COST_SOURCE_LABELS[designCost.source]}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
            <span className="text-gray-500">DesignItem:</span>
            <span className="text-right font-medium text-gray-900">
              {divergence.currency} {divergence.designCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
            <span className="text-gray-500">BOQ total:</span>
            <span className="text-right font-medium text-gray-900">
              {divergence.currency} {divergence.boqTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
            <span className="text-gray-600 font-medium">Δ:</span>
            <span
              className={`text-right font-semibold ${
                divergence.delta === 0
                  ? 'text-gray-700'
                  : divergence.delta > 0
                  ? 'text-blue-700'
                  : 'text-rose-700'
              }`}
            >
              {divergence.delta > 0 ? '+' : ''}
              {divergence.currency}{' '}
              {divergence.delta.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              {divergence.percent !== null && (
                <span className="ml-1 text-[10px] opacity-75">
                  ({divergence.percent > 0 ? '+' : ''}
                  {divergence.percent.toFixed(1)}%)
                </span>
              )}
            </span>
          </div>
        </div>
      )}

      {'mismatch' in divergence && divergence.mismatch === 'currency' && (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-2 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-800">
            BOQ and DesignItem use different currencies — can't reconcile
            without a conversion. Align currencies to see divergence.
          </p>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading…
        </div>
      )}

      {!loading && ids.length === 0 && (
        <p className="text-xs text-gray-400 italic">
          No BOQ items linked. Link from the advisory BOQ to enable cost reconciliation.
        </p>
      )}

      {!loading && rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map(row => (
            <li
              key={row.id}
              className="border border-gray-200 rounded-md p-2.5 hover:border-gray-300 transition-colors"
            >
              {row.item ? (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        {row.item.itemCode || row.id.slice(0, 8)}
                      </span>
                      {row.item.billName && (
                        <span className="text-[10px] text-gray-500 truncate">
                          {row.item.billName}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-900 mt-1 line-clamp-2">
                      {row.item.description || '—'}
                    </p>
                    {typeof row.item.amount === 'number' && (
                      <p className="text-[11px] text-gray-500 mt-1">
                        {row.item.quantityContract} {row.item.unit} @ {row.item.rate} ={' '}
                        <span className="font-medium text-gray-700">
                          {row.item.currency || 'UGX'}{' '}
                          {row.item.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnlink(row)}
                    disabled={unlinkingId === row.id}
                    title="Unlink this BOQ item"
                    className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                  >
                    {unlinkingId === row.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Unlink className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ) : (
                // Orphaned link — the BOQ row has been deleted. We keep
                // it rendered so the user sees the dangling reference.
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-mono text-gray-400">
                      {row.id.slice(0, 12)}…
                    </span>
                    <p className="text-xs text-gray-400 italic mt-0.5">
                      BOQ item unavailable (deleted or no access)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnlink(row)}
                    title="Dangling reference — cannot unlink safely"
                    className="flex-shrink-0 p-1 text-gray-300 cursor-not-allowed"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded p-2 mt-2">
          {error}
        </p>
      )}
    </div>
  );
}

export default LinkedBoqItemsCard;
