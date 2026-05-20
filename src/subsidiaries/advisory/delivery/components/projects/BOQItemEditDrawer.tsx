/**
 * BOQItemEditDrawer
 *
 * Side drawer for editing a single Control BOQ line item.
 * Uses the Sheet component from the shared UI library.
 */

import { useState, useEffect } from 'react';
import { Loader2, Save, Link2, Unlink } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/core/components/ui/sheet';
import { updateControlBOQItem } from '../../core/services/control-boq';
import { db } from '@/core/services/firebase';
import type { ControlBOQItem, BOQItemStatus } from '../../core/types/boq';
import { LinkDesignItemModal } from './LinkDesignItemModal';
import type { DesignItem } from '@/modules/design-manager/types';
import {
  unlinkBoqFromDesignItem,
  BOQDesignItemLinkError,
} from '@/modules/design-manager/services/boqDesignItemLinkService';
import { getDesignItem } from '@/modules/design-manager/services/firestore';
import {
  getDesignItemTotalCost,
  DESIGN_ITEM_COST_SOURCE_LABELS,
} from '@/modules/design-manager/utils/designItemCost';

interface BOQItemEditDrawerProps {
  item: ControlBOQItem | null;
  projectId: string;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function BOQItemEditDrawer({
  item,
  projectId,
  userId,
  onClose,
  onSaved,
}: BOQItemEditDrawerProps) {
  const [description, setDescription] = useState('');
  const [specification, setSpecification] = useState('');
  const [unit, setUnit] = useState('');
  const [quantityContract, setQuantityContract] = useState(0);
  const [rate, setRate] = useState(0);
  const [status, setStatus] = useState<BOQItemStatus>('pending');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // P9b — cross-module link state. `linkedDesignItemId` mirrors the
  // BOQ row's server-side field; we optimistically update it on
  // link/unlink commits so the drawer reflects the change without
  // re-opening, then `onSaved()` lets the parent refresh the table.
  const [linkedDesignItemId, setLinkedDesignItemId] = useState<string | null>(null);
  const [linkedDesignProjectId, setLinkedDesignProjectId] = useState<string | null>(null);
  const [linkedDesignItemLabel, setLinkedDesignItemLabel] = useState<string | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  // P9c-2 — when a link exists we fetch the DesignItem so we can show
  // its cost next to the BOQ amount. Without P9c-1's stored projectId
  // this fetch wasn't possible from the BOQ side; now it is.
  const [linkedDesignItem, setLinkedDesignItem] = useState<DesignItem | null>(null);
  const [loadingLinkedCost, setLoadingLinkedCost] = useState(false);

  useEffect(() => {
    if (item) {
      setDescription(item.description || '');
      setSpecification(item.specification || '');
      setUnit(item.unit || '');
      setQuantityContract(item.quantityContract ?? 0);
      setRate(item.rate ?? 0);
      setStatus(item.status || 'pending');
      setError(null);
      setLinkedDesignItemId(item.linkedDesignItemId ?? null);
      setLinkedDesignProjectId(item.linkedDesignProjectId ?? null);
      // We only know the id from the row; the descriptive label is
      // populated after a fresh link via `handleLinked`. On reopen,
      // show the id alone (operator can click through if we add a
      // navigation affordance later).
      setLinkedDesignItemLabel(null);
      setLinkError(null);
      setLinkedDesignItem(null);
    }
  }, [item]);

  // P9c-2 — fetch the linked DesignItem whenever both halves of the
  // link are known. Refetches when the id or projectId change (after
  // link/unlink) so the cost row stays in sync. Legacy rows missing
  // `linkedDesignProjectId` skip the fetch — we can't resolve the
  // Firestore path without it.
  useEffect(() => {
    if (!linkedDesignItemId || !linkedDesignProjectId) {
      setLinkedDesignItem(null);
      return;
    }
    let cancelled = false;
    setLoadingLinkedCost(true);
    getDesignItem(linkedDesignProjectId, linkedDesignItemId)
      .then(di => {
        if (!cancelled) setLinkedDesignItem(di);
      })
      .catch(() => {
        // Silent fail — the cost row is a nicety, not a blocker on
        // the drawer. The label/id still render from local state.
        if (!cancelled) setLinkedDesignItem(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingLinkedCost(false);
      });
    return () => {
      cancelled = true;
    };
  }, [linkedDesignItemId, linkedDesignProjectId]);

  const handleSave = async () => {
    if (!item) return;
    setSaving(true);
    setError(null);

    try {
      await updateControlBOQItem(db, projectId, item.id, {
        description,
        specification: specification || undefined,
        unit,
        quantityContract,
        rate,
        status,
      }, userId);
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Error updating BOQ item:', err);
      setError(err.message || 'Failed to update item');
    } finally {
      setSaving(false);
    }
  };

  const amount = quantityContract * rate;

  // P9b — after LinkDesignItemModal commits the link, it hands us back
  // the DesignItem so we can show its name in the "currently linked"
  // chip. The drawer stays open in case the operator wants to tweak
  // other fields before saving.
  const handleLinked = (designItem: DesignItem) => {
    setLinkedDesignItemId(designItem.id);
    // P9c — the modal already supplied the designProjectId when calling
    // the link service, but we don't have it in scope here; read it back
    // from the DesignItem we just received to keep the local state
    // consistent with the stored BOQ row.
    setLinkedDesignProjectId(designItem.projectId);
    setLinkedDesignItemLabel(designItem.name);
    setLinkError(null);
    // The link service wrote to the BOQ row directly, so the parent's
    // cached copy is stale — refresh its table view.
    onSaved();
  };

  /**
   * P9c — Unlink from the BOQ side now works because the BOQ row carries
   * `linkedDesignProjectId`. Before P9c we had to route this to the
   * DesignItem detail page so the design projectId was in scope; now
   * both sides can sever the link symmetrically.
   */
  const handleUnlink = async () => {
    if (!item || !linkedDesignItemId || !linkedDesignProjectId) return;
    setUnlinking(true);
    setLinkError(null);
    try {
      await unlinkBoqFromDesignItem(
        { advisoryProjectId: projectId, boqItemId: item.id },
        { designProjectId: linkedDesignProjectId, designItemId: linkedDesignItemId },
        userId,
      );
      setLinkedDesignItemId(null);
      setLinkedDesignProjectId(null);
      setLinkedDesignItemLabel(null);
      onSaved();
    } catch (err) {
      if (err instanceof BOQDesignItemLinkError) {
        setLinkError(`${err.code}: ${err.message}`);
      } else {
        setLinkError(err instanceof Error ? err.message : 'Unlink failed');
      }
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <Sheet open={!!item} onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit BOQ Item</SheetTitle>
          <SheetDescription>
            {item?.itemCode} — {item?.billName}
          </SheetDescription>
        </SheetHeader>

        {item && (
          <div className="mt-6 space-y-5">
            {/* Hierarchy context */}
            {(item.elementName || item.sectionName) && (
              <div className="text-xs text-gray-500 space-y-0.5 bg-gray-50 rounded-lg p-3">
                {item.billName && <div><span className="font-medium">Bill:</span> {item.billName}</div>}
                {item.elementName && <div><span className="font-medium">Element:</span> {item.elementName}</div>}
                {item.sectionName && <div><span className="font-medium">Section:</span> {item.sectionName}</div>}
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Specification */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Specification</label>
              <textarea
                value={specification}
                onChange={e => setSpecification(e.target.value)}
                rows={2}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Material specs, standards, etc."
              />
            </div>

            {/* Quantity & Unit */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  value={quantityContract}
                  onChange={e => setQuantityContract(parseFloat(e.target.value) || 0)}
                  step="0.01"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <input
                  type="text"
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="m2, m3, nr, etc."
                />
              </div>
            </div>

            {/* Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate (per {unit || 'unit'})</label>
              <input
                type="number"
                value={rate}
                onChange={e => setRate(parseFloat(e.target.value) || 0)}
                step="0.01"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Computed Amount */}
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-xs text-blue-600 font-medium">Amount</div>
              <div className="text-lg font-bold text-blue-900">
                UGX {amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as BOQItemStatus)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {/* P9b — Cross-module link to DesignItem (finishes design-manager).
                Reconciliation annotation only; no automatic sync. */}
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Link2 className="w-4 h-4 text-gray-500" />
                <h4 className="text-sm font-semibold text-gray-800">Linked DesignItem</h4>
              </div>
              {linkedDesignItemId ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-blue-900 font-medium">
                        {linkedDesignItemLabel ?? linkedDesignItemId}
                      </p>
                      <p className="text-[11px] font-mono text-blue-700 break-all">
                        {linkedDesignItemId}
                      </p>
                      {linkedDesignProjectId && (
                        <p className="text-[10px] font-mono text-blue-500 break-all mt-0.5">
                          project: {linkedDesignProjectId}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleUnlink}
                      disabled={unlinking || !linkedDesignProjectId}
                      title={
                        linkedDesignProjectId
                          ? 'Unlink this DesignItem'
                          : 'Legacy link — unlink from the DesignItem page (no projectId stored)'
                      }
                      className="flex-shrink-0 flex items-center gap-1 px-2 py-1 text-xs text-red-700 border border-red-200 rounded hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {unlinking ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Unlink className="w-3 h-3" />
                      )}
                      Unlink
                    </button>
                  </div>
                  {/* P9c-2 — cost reconciliation row. With `linkedDesignProjectId`
                      in hand we can fetch the DesignItem and show its
                      sourcing-specific headline cost next to the BOQ
                      amount. No silent currency coercion: when the
                      currencies don't match we show both side-by-side
                      rather than a fake delta. */}
                  {(() => {
                    const designCost = getDesignItemTotalCost(linkedDesignItem);
                    if (loadingLinkedCost) {
                      return (
                        <div className="flex items-center gap-1.5 text-[11px] text-blue-700 pt-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Loading DesignItem cost…
                        </div>
                      );
                    }
                    if (!designCost) return null;
                    const boqCurrency = item?.currency || 'UGX';
                    const sameCurrency = designCost.currency === boqCurrency;
                    const delta = sameCurrency ? designCost.total - amount : null;
                    const percent =
                      delta !== null && amount > 0 ? (delta / amount) * 100 : null;
                    return (
                      <div className="border-t border-blue-200 pt-2 space-y-0.5 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-blue-700">DesignItem cost:</span>
                          <span className="font-medium text-blue-900">
                            {designCost.currency}{' '}
                            {designCost.total.toLocaleString(undefined, {
                              maximumFractionDigits: 0,
                            })}
                            <span className="ml-1 text-[10px] text-blue-600 opacity-75">
                              ({DESIGN_ITEM_COST_SOURCE_LABELS[designCost.source]})
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-blue-700">BOQ amount:</span>
                          <span className="font-medium text-blue-900">
                            {boqCurrency} {amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        {sameCurrency ? (
                          <div className="flex items-center justify-between pt-0.5">
                            <span className="text-blue-700 font-medium">Δ:</span>
                            <span
                              className={`font-semibold ${
                                delta === 0
                                  ? 'text-gray-700'
                                  : (delta ?? 0) > 0
                                  ? 'text-blue-800'
                                  : 'text-rose-700'
                              }`}
                            >
                              {(delta ?? 0) > 0 ? '+' : ''}
                              {designCost.currency}{' '}
                              {(delta ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              {percent !== null && (
                                <span className="ml-1 text-[10px] opacity-75">
                                  ({percent > 0 ? '+' : ''}
                                  {percent.toFixed(1)}%)
                                </span>
                              )}
                            </span>
                          </div>
                        ) : (
                          <p className="text-[10px] text-amber-700 italic pt-0.5">
                            Different currencies — cannot compute delta.
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Legacy links (pre-P9c) have no stored projectId, so
                      the service can't resolve the DesignItem path on
                      the unlink write. Fall back to the DesignItem-side
                      flow — rare enough to leave as a hint rather than
                      block the UI. */}
                  {!linkedDesignProjectId && (
                    <p className="text-[10px] text-blue-600 italic">
                      This link was created before P9c. To unlink, open
                      the DesignItem in design-manager.
                    </p>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowLinkModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-blue-700 border border-dashed border-blue-300 rounded-lg hover:bg-blue-50"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  Link to a DesignItem
                </button>
              )}

              {linkError && (
                <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded p-2 mt-2">
                  {linkError}
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
              <button
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </SheetContent>

      {/* P9b — linker modal lives inside the Sheet so it stacks above
          the drawer backdrop and closes cleanly with it. */}
      {item && (
        <LinkDesignItemModal
          open={showLinkModal}
          onClose={() => setShowLinkModal(false)}
          boqRef={{ advisoryProjectId: projectId, boqItemId: item.id }}
          userId={userId}
          onLinked={handleLinked}
        />
      )}
    </Sheet>
  );
}
