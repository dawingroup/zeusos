/**
 * CabinetRoster — Sidebar list of all cabinets in a scene
 *
 * Shows cabinet code, name, thumbnail, status (locked if MO created).
 * Add cabinet button opens PDD picker. Supports selection.
 *
 * Supports grouping by DesignItem (the intended M:N grouping axis — one
 * scene can show cabinets from multiple DesignItems). A group toggle at
 * the top switches between flat and grouped rendering. The "Unassigned"
 * bucket only ever has entries on standalone scenes, where cabinets
 * legitimately have no DesignItem FK (Slice 6 rule-exempt). Project-
 * backed scenes post-Slice-6 are guaranteed to have every cabinet
 * linked, so the Unassigned bucket is empty in practice — we keep the
 * rendering path defensively for the standalone regime and for any
 * legacy orphan docs that slip through.
 */
import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useSceneCabinets } from '../../hooks/useSceneCabinets';
import { useSceneDesignItems } from '../../hooks/useSceneDesignItems';
import type { SceneCabinet } from '../../types/scene.types';
import { isStandaloneProjectId } from '../../utils/sceneProjectUtils';
import { assignCabinetToDesignItem } from '../../services/scene.service';
import { DesignItemPicker, type DesignItemPickerValue } from './DesignItemPicker';

interface CabinetRosterProps {
  sceneId: string;
  /** P2: used to hydrate DesignItem metadata for grouping. */
  projectId?: string;
  /** P21.10 (D): required to create a new DesignItem inline from the
   *  bulk-assign picker. Safe to omit on standalone scenes — the bulk
   *  action is hidden there anyway. */
  userId?: string;
  selectedCabinetId?: string;
  onCabinetSelect: (cabinetId: string) => void;
  onAddCabinet: () => void;
  onDuplicateCabinet?: (cabinetId: string) => void;
  onRemoveCabinet?: (cabinetId: string) => void;
  /**
   * P3: release a DesignItem group's cabinets to production. When provided,
   * an inline "Release" button is rendered on each real DesignItem group
   * header (never on the Unassigned bucket). Disabled when every cabinet
   * in the group is already locked.
   */
  onReleaseGroup?: (designItemId: string) => void;
}

const UNASSIGNED_GROUP_ID = '__unassigned__';

function formatCurrency(amount: number, currency: string): string {
  if (currency === 'USD') return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
  return `UGX ${amount.toLocaleString('en-UG', { minimumFractionDigits: 0 })}`;
}

export function CabinetRoster({
  sceneId,
  projectId,
  userId,
  selectedCabinetId,
  onCabinetSelect,
  onAddCabinet,
  onDuplicateCabinet,
  onRemoveCabinet,
  onReleaseGroup,
}: CabinetRosterProps) {
  const { cabinets, isLoading } = useSceneCabinets(sceneId);
  const { byId: designItemsById, unassignedCount } = useSceneDesignItems(projectId, cabinets);

  const [groupByDesignItem, setGroupByDesignItem] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // P21.10 (D): bulk selection for reassign-to-item. Only active on
  // project-backed scenes — standalone scenes can't carry a DesignItem FK.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerValue, setPickerValue] = useState<DesignItemPickerValue | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const canBulkAssign = !isStandaloneProjectId(projectId);

  const toggleSelected = (cabinetId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(cabinetId)) next.delete(cabinetId);
      else next.add(cabinetId);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkAssign = async () => {
    if (!pickerValue || selectedIds.size === 0) return;
    setAssigning(true);
    setAssignError(null);
    const ids = Array.from(selectedIds);
    // Gather errors so one locked cabinet doesn't silently stop the batch.
    const failures: string[] = [];
    for (const cabinetId of ids) {
      try {
        await assignCabinetToDesignItem(sceneId, cabinetId, pickerValue.id);
      } catch (err) {
        const cab = cabinets.find(c => c.id === cabinetId);
        failures.push(`${cab?.cabinetCode ?? cabinetId}: ${(err as Error).message}`);
      }
    }
    setAssigning(false);
    if (failures.length > 0) {
      setAssignError(
        `${ids.length - failures.length}/${ids.length} reassigned. ` +
          `Failed: ${failures.slice(0, 3).join('; ')}${failures.length > 3 ? '…' : ''}`,
      );
      return;
    }
    // Success — close picker, clear selection.
    setPickerOpen(false);
    setPickerValue(null);
    clearSelection();
  };

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // Build ordered groups when grouping is enabled.
  // Groups are keyed by designItemId (or UNASSIGNED_GROUP_ID).
  const groups = useMemo(() => {
    if (!groupByDesignItem) return null;
    const buckets = new Map<string, SceneCabinet[]>();
    for (const c of cabinets) {
      const key = c.designItemId ?? UNASSIGNED_GROUP_ID;
      const arr = buckets.get(key) ?? [];
      arr.push(c);
      buckets.set(key, arr);
    }
    // Sort by DesignItem name (unassigned last).
    const ordered = Array.from(buckets.entries()).sort(([a], [b]) => {
      if (a === UNASSIGNED_GROUP_ID) return 1;
      if (b === UNASSIGNED_GROUP_ID) return -1;
      const an = designItemsById.get(a)?.name ?? '';
      const bn = designItemsById.get(b)?.name ?? '';
      return an.localeCompare(bn);
    });
    return ordered;
  }, [groupByDesignItem, cabinets, designItemsById]);

  const canGroup = !isStandaloneProjectId(projectId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <h3 className="text-sm font-semibold text-gray-700">
          Cabinets ({cabinets.length})
        </h3>
        <button
          type="button"
          onClick={onAddCabinet}
          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Add
        </button>
      </div>

      {/* Group-by toggle — only meaningful when the scene has a project. */}
      {canGroup && cabinets.length > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b bg-gray-50">
          <label className="flex items-center gap-1.5 text-[11px] text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={groupByDesignItem}
              onChange={e => setGroupByDesignItem(e.target.checked)}
              className="rounded border-gray-300"
            />
            Group by Design Item
          </label>
          {groupByDesignItem && unassignedCount > 0 && (
            <span
              className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded"
              title="Cabinets without a DesignItem link. Use the detail panel to assign one."
            >
              {unassignedCount} unassigned
            </span>
          )}
        </div>
      )}

      {/* Cabinet list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-24">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
          </div>
        ) : cabinets.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-xs text-gray-400">No cabinets yet</p>
            <button
              type="button"
              onClick={onAddCabinet}
              className="mt-2 text-xs text-blue-600 hover:text-blue-700"
            >
              Add first cabinet
            </button>
          </div>
        ) : groups ? (
          <div className="py-1">
            {groups.map(([groupId, groupCabinets]) => {
              const isUnassigned = groupId === UNASSIGNED_GROUP_ID;
              const designItem = isUnassigned ? null : designItemsById.get(groupId);
              const label = isUnassigned
                ? 'Unassigned'
                : designItem?.name ?? '(unknown item)';
              const isCollapsed = collapsedGroups.has(groupId);
              // P3: release CTA eligibility — real DesignItem group only,
              // at least one unlocked cabinet, caller wired the handler.
              const unlockedCount = groupCabinets.filter(c => !c.isLocked).length;
              const canRelease =
                !isUnassigned && !!onReleaseGroup && unlockedCount > 0;
              return (
                <div key={groupId} className="mb-1">
                  <div
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider ${
                      isUnassigned ? 'text-amber-700 bg-amber-50' : 'text-gray-500 bg-gray-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(groupId)}
                      className="flex items-center gap-1.5 truncate flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                    >
                      <svg
                        className={`w-3 h-3 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="truncate normal-case">{label}</span>
                      {designItem?.itemCode && (
                        <span className="text-[10px] font-mono text-gray-400 normal-case">
                          {designItem.itemCode}
                        </span>
                      )}
                    </button>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {canRelease && (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            onReleaseGroup?.(groupId);
                          }}
                          className="px-1.5 py-0.5 rounded bg-blue-600 text-white text-[10px] normal-case font-medium hover:bg-blue-700"
                          title={`Release ${unlockedCount} unlocked cabinet(s) to production as a new MO`}
                        >
                          Release
                        </button>
                      )}
                      <span className="text-[10px] text-gray-400">
                        {groupCabinets.length}
                      </span>
                    </div>
                  </div>
                  {!isCollapsed && (
                    <div>
                      {groupCabinets.map(cabinet => (
                        <CabinetRosterItem
                          key={cabinet.id}
                          cabinet={cabinet}
                          isSelected={cabinet.id === selectedCabinetId}
                          onSelect={() => onCabinetSelect(cabinet.id)}
                          onDuplicate={onDuplicateCabinet ? () => onDuplicateCabinet(cabinet.id) : undefined}
                          onRemove={onRemoveCabinet && !cabinet.isLocked ? () => onRemoveCabinet(cabinet.id) : undefined}
                          showCheckbox={canBulkAssign && !cabinet.isLocked}
                          isChecked={selectedIds.has(cabinet.id)}
                          onCheckToggle={() => toggleSelected(cabinet.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-1">
            {cabinets.map(cabinet => (
              <CabinetRosterItem
                key={cabinet.id}
                cabinet={cabinet}
                isSelected={cabinet.id === selectedCabinetId}
                onSelect={() => onCabinetSelect(cabinet.id)}
                onDuplicate={onDuplicateCabinet ? () => onDuplicateCabinet(cabinet.id) : undefined}
                onRemove={onRemoveCabinet && !cabinet.isLocked ? () => onRemoveCabinet(cabinet.id) : undefined}
                showCheckbox={canBulkAssign && !cabinet.isLocked}
                isChecked={selectedIds.has(cabinet.id)}
                onCheckToggle={() => toggleSelected(cabinet.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* P21.10 (D) — Bulk-assign action bar */}
      {canBulkAssign && selectedIds.size > 0 && !pickerOpen && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-t bg-blue-50">
          <span className="text-[11px] text-blue-900 font-medium">
            {selectedIds.size} selected
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={clearSelection}
              className="px-2 py-1 text-[11px] text-gray-600 hover:text-gray-800"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="px-2 py-1 text-[11px] bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Move to item…
            </button>
          </div>
        </div>
      )}

      {/* P21.10 (D) — Bulk-assign picker modal */}
      {pickerOpen && canBulkAssign && projectId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => !assigning && setPickerOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-[420px] max-w-[90vw] p-4 space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <div>
              <h3 className="text-sm font-semibold">Move cabinets to a DesignItem</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Reassigning {selectedIds.size} cabinet{selectedIds.size === 1 ? '' : 's'}.
                Locked cabinets will be skipped.
              </p>
            </div>
            <DesignItemPicker
              projectId={projectId}
              userId={userId ?? ''}
              value={pickerValue}
              onChange={setPickerValue}
              disabled={assigning}
            />
            {assignError && (
              <p className="text-[11px] text-red-600 bg-red-50 rounded px-2 py-1.5">
                {assignError}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setPickerOpen(false);
                  setAssignError(null);
                }}
                disabled={assigning}
                className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkAssign}
                disabled={!pickerValue || assigning}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {assigning && <Loader2 className="h-3 w-3 animate-spin" />}
                Reassign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Roster Item ──

function CabinetRosterItem({
  cabinet,
  isSelected,
  onSelect,
  onDuplicate,
  onRemove,
  isChecked,
  onCheckToggle,
  showCheckbox,
}: {
  cabinet: SceneCabinet;
  isSelected: boolean;
  onSelect: () => void;
  onDuplicate?: () => void;
  onRemove?: () => void;
  isChecked?: boolean;
  onCheckToggle?: () => void;
  showCheckbox?: boolean;
}) {
  const price = cabinet.estimatedPrice as unknown as Record<string, unknown> | null;
  const total = typeof price?.total === 'number' ? price.total : 0;
  const currency = (typeof price?.currency === 'string' ? price.currency : 'UGX') as string;

  return (
    <div
      className={`group flex items-center gap-2 px-3 py-2 cursor-pointer border-l-2 transition-colors ${
        isSelected
          ? 'border-blue-600 bg-blue-50'
          : 'border-transparent hover:bg-gray-50'
      }`}
      onClick={onSelect}
    >
      {/* Bulk-select checkbox (P21.10 D) */}
      {showCheckbox && (
        <input
          type="checkbox"
          checked={!!isChecked}
          onChange={e => {
            e.stopPropagation();
            onCheckToggle?.();
          }}
          onClick={e => e.stopPropagation()}
          className="flex-shrink-0 rounded border-gray-300"
          aria-label="Select cabinet for bulk action"
        />
      )}
      {/* Thumbnail */}
      <div className="w-10 h-10 rounded bg-gray-100 flex-shrink-0 flex items-center justify-center">
        {cabinet.thumbnailUrl ? (
          <img src={cabinet.thumbnailUrl} alt="" className="w-full h-full object-cover rounded" />
        ) : (
          <span className="text-gray-300 text-xs">3D</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-xs font-mono font-semibold text-gray-500">
            {cabinet.cabinetCode}
          </span>
          {cabinet.isLocked && (
            <span className="inline-flex px-1 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
              Locked
            </span>
          )}
          {(cabinet.requiredQuantity ?? 1) > 1 && (
            <span
              className="inline-flex px-1 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700"
              title={`Required quantity — this design represents ${cabinet.requiredQuantity} physical units`}
            >
              × {cabinet.requiredQuantity}
            </span>
          )}
        </div>
        <p className="text-sm truncate">{cabinet.displayName}</p>
        {total > 0 && (
          <p className="text-xs text-gray-400">{formatCurrency(total, currency)}</p>
        )}
      </div>

      {/* Actions (visible on hover) */}
      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 flex gap-1">
        {onDuplicate && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onDuplicate(); }}
            className="p-1 text-gray-400 hover:text-blue-600"
            title="Duplicate"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onRemove(); }}
            className="p-1 text-gray-400 hover:text-red-600"
            title="Remove"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
