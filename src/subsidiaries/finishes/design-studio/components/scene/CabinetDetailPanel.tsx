/**
 * CabinetDetailPanel — Right-side panel when a cabinet is selected
 *
 * Shows cabinet code, dimensions, configuration summary, BOM rollup,
 * price, lock status, MO link if exists.
 *
 * P2 Slice 4: surfaces the cabinet's current DesignItem binding and
 * offers a "Reassign" action that opens an inline DesignItemPicker and
 * calls `assignCabinetToDesignItem`. Locked cabinets block reassign at
 * both the UI and service layer.
 */
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import { useCabinet } from '../../hooks/useCabinet';
import { useScene } from '../../hooks/useScene';
import { useSceneDesignItems } from '../../hooks/useSceneDesignItems';
import { assignCabinetToDesignItem, setCabinetRequiredQuantity } from '../../services/scene.service';
import {
  writeSceneOriginParts,
  previewWriteSceneOriginParts,
  deleteProcurementRowsBySource,
  listProcurementSourceCounts,
  getBlockingSyncErrorMessageForDesignItem,
  type SyncPreview,
  type SyncResult,
  type PairingStrategy,
} from '../../services/designItemPartsSyncFromScene';
import { SceneSyncReviewDialog } from './SceneSyncReviewDialog';
import { ArchetypeMultiSelect } from './ArchetypeMultiSelect';
import { resolveCabinetArchetypes } from '../../constants/furnitureDomains';
import { subscribeToRevisions } from '../../services/designRevisionService';
import { RevisionDiffModal } from '../handoff/RevisionDiffModal';
import { ModelPackageHistoryModal } from '../handoff/ModelPackageHistoryModal';
import { SplitCabinetDialog } from './SplitCabinetDialog';
import { detectSubCabinets } from '../../services/splitCabinetDetection';
import { useMeshBboxes } from '../../hooks/useMeshBboxes';
import type { ParsedModel } from '../../types/workshop-viewer.types';
import type { SceneCabinet } from '../../types/scene.types';
import type { DesignRevision } from '../../types/designRevision.types';
import { useCabinetParsedModel } from '../../hooks/useCabinetParsedModel';
import { ModelProcessingPanel } from './ModelProcessingPanel';
import { DesignItemPicker, type DesignItemPickerValue } from './DesignItemPicker';
import { isStandaloneScene as computeIsStandaloneScene } from '../../utils/sceneProjectUtils';

interface CabinetDetailPanelProps {
  sceneId: string;
  cabinetId: string;
  onClose: () => void;
  /** Called after a destructive cabinet change (split, revision apply, …)
   *  so the scene workspace can refetch + clear stale selection. */
  onSplit?: () => void;
  /** After AI model processing writes assemblies to the cabinet doc — refetch the scene roster. */
  onCabinetUpdated?: () => void;
}

function formatCurrency(amount: number, currency: string): string {
  if (currency === 'USD') return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
  return `UGX ${amount.toLocaleString('en-UG', { minimumFractionDigits: 0 })}`;
}

export function CabinetDetailPanel({ sceneId, cabinetId, onClose, onSplit, onCabinetUpdated }: CabinetDetailPanelProps) {
  const { user } = useAuth();
  const { cabinet, isLoading, refetch } = useCabinet(sceneId, cabinetId);
  // P2 Slice 4 — scene metadata (projectId) is needed to hydrate the picker.
  const { scene } = useScene(sceneId, { includeFullCabinets: false });
  const [reassigning, setReassigning] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [pickerValue, setPickerValue] = useState<DesignItemPickerValue | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Load the cabinet's GLB into a ParsedModel so the "Process with AI"
  // button in ModelProcessingPanel can actually run — otherwise `canProcess`
  // stays false forever for scene cabinets. The hook takes stable primitive
  // effect deps (url + meshFilterKey) internally so changing `cabinet`
  // reference across renders doesn't cause loops.
  const {
    parsedModel,
    isLoading: isModelLoading,
    error: modelError,
  } = useCabinetParsedModel(sceneId, cabinet);

  // Hook-order invariant: every hook must run on every render, so the
  // DesignItem hydration (useMemo + useSceneDesignItems) must live ABOVE
  // the early-return gates below. Passing `[cabinet]` guarded by a
  // nullish check keeps the output stable and cheap when the cabinet
  // hasn't loaded yet — the picker row just doesn't render until the
  // guard at line ~66 lets us through.
  const projectId = scene?.projectId ?? '';
  const isStandaloneScene = computeIsStandaloneScene(scene);
  const designItemHydrationInput = useMemo(
    () => (cabinet ? [cabinet] : []),
    [cabinet],
  );
  const { byId: designItemsById } = useSceneDesignItems(
    projectId,
    designItemHydrationInput,
  );

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="h-3 bg-gray-100 rounded" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!cabinet) {
    return (
      <div className="p-4 text-sm text-gray-400">Cabinet not found</div>
    );
  }

  const price = cabinet.estimatedPrice as unknown as Record<string, unknown> | null;
  const total = typeof price?.total === 'number' ? price.total : 0;
  const currency = (typeof price?.currency === 'string' ? price.currency : 'UGX') as string;
  const bomLines = (cabinet.computedBOM ?? []) as unknown as Record<string, unknown>[];
  const config = cabinet.configuration ?? {};

  const linkedDesignItem = cabinet.designItemId
    ? designItemsById.get(cabinet.designItemId)
    : null;

  const handleConfirmReassign = async () => {
    if (!pickerValue) return;
    setReassigning(true);
    setReassignError(null);
    try {
      await assignCabinetToDesignItem(sceneId, cabinetId, pickerValue.id);
      await refetch();
      setPickerOpen(false);
      setPickerValue(null);
    } catch (err) {
      setReassignError((err as Error).message || 'Failed to reassign cabinet');
    } finally {
      setReassigning(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b gap-2">
        <div className="min-w-0">
          <span className="text-xs font-mono font-semibold text-gray-500">{cabinet.cabinetCode}</span>
          <h3 className="text-sm font-semibold truncate">{cabinet.displayName}</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ArchetypeMultiSelect
            sceneId={sceneId}
            cabinetId={cabinet.id}
            value={resolveCabinetArchetypes(cabinet)}
            disabled={cabinet.isLocked}
          />
          <CabinetQuantityInput
            sceneId={sceneId}
            cabinetId={cabinet.id}
            value={cabinet.requiredQuantity ?? 1}
            disabled={cabinet.isLocked}
          />
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            title="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Status badges */}
        <div className="flex flex-wrap gap-2">
          {cabinet.isLocked && (
            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
              Locked for Production
            </span>
          )}
          {cabinet.manufacturingOrderId && (
            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
              MO: {cabinet.manufacturingOrderId}
            </span>
          )}
          {/* P21.8.1 — surface the BOM/pricing freeze semantic. The cabinet
              detail panel shows live fields (that's what 3D / inventory
              edits operate on), but the DesignItem.manufacturingRollup
              reads from lockedSnapshot once isLocked=true. Users need a
              heads-up that the rollup won't follow live edits any more. */}
          {cabinet.isLocked && cabinet.lockedSnapshot && (
            <span
              className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800"
              title={`BOM and pricing frozen at ${
                cabinet.lockedSnapshot.lockedAt.toDate
                  ? cabinet.lockedSnapshot.lockedAt.toDate().toLocaleString()
                  : String(cabinet.lockedSnapshot.lockedAt)
              }. DesignItem rollup reads the snapshot, not the live values shown below. Unlock to restore live authority.`}
            >
              BOM frozen
            </span>
          )}
        </div>

        {/* P2 Slice 4 — DesignItem binding + reassign. */}
        {!isStandaloneScene && (
          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Design Item
            </h4>
            {cabinet.designItemId && !pickerOpen ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between rounded-md border border-gray-200 px-2.5 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {linkedDesignItem?.name ?? cabinet.designItemId}
                    </p>
                    <p className="text-[10px] font-mono text-gray-400 truncate">
                      {linkedDesignItem?.itemCode ?? cabinet.designItemId}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    disabled={cabinet.isLocked}
                    className="text-xs text-blue-600 hover:text-blue-700 disabled:text-gray-300 disabled:cursor-not-allowed ml-2 flex-shrink-0"
                    title={cabinet.isLocked ? 'Unlock to reassign' : 'Move to a different DesignItem'}
                  >
                    Reassign
                  </button>
                </div>
                <DesignItemPartsSyncRow
                  sceneId={sceneId}
                  designItemId={cabinet.designItemId}
                  userId={user?.uid ?? ''}
                  lastSyncedAt={linkedDesignItem?.partsLastSyncedAt}
                  designItemLabel={linkedDesignItem?.name}
                />
                <RevisionApplyRow
                  sceneId={sceneId}
                  cabinetId={cabinet.id}
                  cabinetLabel={cabinet.cabinetCode || cabinet.displayName || cabinet.id}
                  projectId={projectId}
                  designItemId={cabinet.designItemId}
                  lastAppliedRevisionNumber={cabinet.lastAppliedRevisionNumber}
                />
              </div>
            ) : !cabinet.designItemId && !pickerOpen ? (
              <div className="space-y-1.5">
                <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
                  No DesignItem linked. Assign one so this cabinet's cost rolls
                  up into an item and can be included in a Manufacturing Order.
                </div>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  disabled={cabinet.isLocked}
                  className="w-full text-xs text-blue-600 hover:text-blue-700 disabled:text-gray-300 border border-dashed border-blue-300 rounded-md px-2 py-1.5"
                >
                  Assign to Design Item…
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <DesignItemPicker
                  projectId={projectId}
                  userId={user?.uid ?? ''}
                  value={pickerValue}
                  onChange={setPickerValue}
                  disabled={reassigning}
                />
                {reassignError && (
                  <p className="text-xs text-red-600">{reassignError}</p>
                )}
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setPickerOpen(false);
                      setPickerValue(null);
                      setReassignError(null);
                    }}
                    disabled={reassigning}
                    className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmReassign}
                    disabled={!pickerValue || reassigning || pickerValue.id === cabinet.designItemId}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {reassigning ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* AI Processing */}
        {isModelLoading && (
          <div className="flex items-center gap-2 text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded px-2 py-1.5">
            <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600" />
            Preparing 3D model…
          </div>
        )}
        {modelError && !isModelLoading && (
          <div className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            Model unavailable: {modelError.message}
          </div>
        )}
        <ModelProcessingPanel
          sceneId={sceneId}
          cabinet={cabinet}
          parsedModel={parsedModel ?? undefined}
          onProcessComplete={async () => {
            await refetch();
            onCabinetUpdated?.();
          }}
        />

        {/* Split-cabinet — detect when an import grouped multiple
            physical cabinets into one SceneCabinet and offer to fan
            them out into individual cabinets. Gated on parsedModel
            because the detector needs bboxes. */}
        {parsedModel && (
          <SplitCabinetRow
            sceneId={sceneId}
            cabinet={cabinet}
            parsedModel={parsedModel}
            onSplit={onSplit}
          />
        )}

        {/* Configuration */}
        <section>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Configuration</h4>
          <div className="space-y-1">
            {Object.entries(config).map(([key, value]) => (
              <div key={key} className="flex justify-between text-sm">
                <span className="text-gray-500">{key}</span>
                <span className="font-medium">{String(value)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Finish Selections */}
        {Object.keys(cabinet.finishSelections ?? {}).length > 0 && (
          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Finishes</h4>
            <div className="space-y-1">
              {Object.entries(cabinet.finishSelections).map(([group, finishId]) => (
                <div key={group} className="flex justify-between text-sm">
                  <span className="text-gray-500">{group}</span>
                  <span className="font-medium text-xs">{finishId}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* BOM Summary */}
        {bomLines.length > 0 && (
          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              BOM ({bomLines.length} lines)
            </h4>
            <div className="space-y-1">
              {bomLines.slice(0, 8).map((line: Record<string, unknown>, i: number) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-gray-600 truncate max-w-[60%]">
                    {String(line.materialCategory ?? line.description ?? '')}
                  </span>
                  <span className="text-gray-400">
                    {String(line.quantity ?? '')} {String(line.unit ?? '')}
                  </span>
                </div>
              ))}
              {bomLines.length > 8 && (
                <p className="text-xs text-gray-400">+{bomLines.length - 8} more lines</p>
              )}
            </div>
          </section>
        )}

        {/* Position */}
        <section>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Position</h4>
          <div className="text-xs text-gray-500 font-mono">
            X: {cabinet.position?.x ?? 0}mm &nbsp;
            Y: {cabinet.position?.y ?? 0}mm &nbsp;
            Z: {cabinet.position?.z ?? 0}mm &nbsp;
            R: {cabinet.rotation ?? 0}°
          </div>
        </section>

        {/* Pricing */}
        {total > 0 && (
          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Price Estimate</h4>
            <p className="text-lg font-semibold">{formatCurrency(total, currency)}</p>
          </section>
        )}

        {/* Notes */}
        {cabinet.notes && (
          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</h4>
            <p className="text-sm text-gray-600">{cabinet.notes}</p>
          </section>
        )}
      </div>
    </div>
  );
}

/**
 * Inline row: "Sync parts to Design Manager" for this cabinet's
 * linked DesignItem. Calls the scene orchestrator so sibling cabinets
 * bound to the same DesignItem get merged into a single parts push.
 */
interface DesignItemPartsSyncRowProps {
  sceneId: string;
  designItemId: string;
  userId: string;
  lastSyncedAt?: { toDate?: () => Date } | null;
  /** Shown in the review dialog title. */
  designItemLabel?: string;
}

function rowResultFromSyncResult(res: SyncResult) {
  return {
    added: res.addedNew,
    preservedProcurement: res.preservedProcurement,
    droppedStaleSceneOrigin: res.droppedStaleSceneOrigin,
    aiUsed: !!res.aiReport,
    aiConfidence: res.aiReport?.confidence,
    aiReasoning: res.aiReport?.reasoning,
    csvMatched: res.csvReport?.matchedRows,
    csvTotal: res.csvReport?.totalRows,
  };
}

function DesignItemPartsSyncRow({
  sceneId,
  designItemId,
  userId,
  lastSyncedAt,
  designItemLabel,
}: DesignItemPartsSyncRowProps) {
  const [syncing, setSyncing] = useState(false);
  const [review, setReview] = useState<{ pairingStrategy: PairingStrategy } | null>(null);
  const [result, setResult] = useState<{
    added: number;
    preservedProcurement: number;
    droppedStaleSceneOrigin: number;
    aiUsed: boolean;
    aiConfidence?: number;
    aiReasoning?: string;
    csvMatched?: number;
    csvTotal?: number;
    procurementRemoved?: number;
  } | null>(null);
  const [preview, setPreview] = useState<SyncPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  const runSync = async (strategy: 'heuristic' | 'ai' | 'auto') => {
    setSyncing(true);
    setError(null);
    setPreview(null);
    try {
      const res = await writeSceneOriginParts(sceneId, designItemId, userId, {
        pairingStrategy: strategy,
      });
      setResult(rowResultFromSyncResult(res));
    } catch (err) {
      setError((err as Error).message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleSync = () => runSync('auto');
  const handleAiMatch = () => runSync('ai');

  const openReview = async (pairingStrategy: PairingStrategy) => {
    if (!userId) {
      setError('Sign in to review and sync parts.');
      return;
    }
    const block = await getBlockingSyncErrorMessageForDesignItem(sceneId, designItemId);
    if (block) {
      setError(block);
      return;
    }
    setError(null);
    setReview({ pairingStrategy });
  };

  const handleWipeProcurement = async () => {
    // eslint-disable-next-line no-alert
    const ok = window.confirm(
      `Clean procurement rows on this DesignItem?\n\n` +
      `Deletes every non-scene row (CSV imports, manual entries, untagged legacy).\n` +
      `Scene-origin parts are untouched — they're owned by Design Studio sync.\n\n` +
      `Use this to drain accumulated legacy data before the first clean sync.`,
    );
    if (!ok) return;
    setSyncing(true);
    setError(null);
    setResult(null);
    try {
      // We need projectId — discover it from the scene doc if we haven't yet.
      let pid = projectId;
      if (!pid) {
        const { getScene } = await import('../../services/scene.service');
        const s = await getScene(sceneId, false);
        pid = s?.projectId ?? null;
        if (!pid) throw new Error('Scene has no project binding');
        setProjectId(pid);
      }
      const counts = await listProcurementSourceCounts(pid, designItemId);
      if (counts.length === 0) {
        setResult({
          added: 0,
          preservedProcurement: 0,
          droppedStaleSceneOrigin: 0,
          aiUsed: false,
          procurementRemoved: 0,
        });
        return;
      }
      const sources = counts.map(c => c.source);
      const r = await deleteProcurementRowsBySource(pid, designItemId, sources, userId);
      setResult({
        added: 0,
        preservedProcurement: r.kept,
        droppedStaleSceneOrigin: 0,
        aiUsed: false,
        procurementRemoved: r.removed,
      });
    } catch (err) {
      setError((err as Error).message || 'Procurement cleanup failed');
    } finally {
      setSyncing(false);
    }
  };

  const handlePreview = async () => {
    setSyncing(true);
    setError(null);
    setResult(null);
    try {
      // Use heuristic in preview so the dry-run doesn't hit the AI API
      // (a paid call per cabinet preview adds up). Real Sync uses 'auto'.
      const p = await previewWriteSceneOriginParts(sceneId, designItemId, {
        pairingStrategy: 'heuristic',
      });
      setPreview(p);
    } catch (err) {
      setError((err as Error).message || 'Preview failed');
    } finally {
      setSyncing(false);
    }
  };

  const lastSyncedLabel = (() => {
    if (!lastSyncedAt) return 'Never synced';
    try {
      const d = lastSyncedAt.toDate ? lastSyncedAt.toDate() : new Date(lastSyncedAt as unknown as string);
      return `Last synced ${d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`;
    } catch {
      return 'Last synced —';
    }
  })();

  return (
    <div className="rounded-md border border-gray-200 px-2.5 py-2 space-y-1.5">
      {review && userId && (
        <SceneSyncReviewDialog
          open
          onClose={() => setReview(null)}
          sceneId={sceneId}
          designItemId={designItemId}
          userId={userId}
          pairingStrategy={review.pairingStrategy}
          designItemLabel={designItemLabel ?? designItemId}
          onCommitted={res => {
            setResult(rowResultFromSyncResult(res));
          }}
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-gray-500 truncate" title={lastSyncedLabel}>
          {lastSyncedLabel}
        </p>
        <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
          <button
            type="button"
            onClick={() => void openReview('auto')}
            disabled={syncing}
            className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
            title="Match and merge, then review names and dimensions before saving."
          >
            Review &amp; sync
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="text-[10px] px-1.5 py-1 text-gray-600 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50"
            title="Write scene-origin parts immediately without the review step."
          >
            {syncing ? '…' : 'Quick sync'}
          </button>
          <button
            type="button"
            onClick={() => void openReview('ai')}
            disabled={syncing}
            className="text-xs px-2 py-1 bg-purple-600 text-white rounded hover:opacity-90 disabled:opacity-50"
            title="Preview AI pairing, then review and save."
          >
            AI review
          </button>
          <button
            type="button"
            onClick={handleAiMatch}
            disabled={syncing}
            className="text-[10px] px-1.5 py-1 text-purple-800 border border-purple-200 bg-purple-50/80 rounded hover:bg-purple-100 disabled:opacity-50"
            title="Force AI pairing and write immediately (no review). ~$0.18 per call."
          >
            Quick AI
          </button>
          <button
            type="button"
            onClick={handlePreview}
            disabled={syncing}
            className="text-xs px-2 py-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50"
            title="Dry-run aggregate: cabinet count, merged part count, procurement preserved. Heuristic only (no API). For row-level edits use Review & sync."
          >
            Preview
          </button>
          <button
            type="button"
            onClick={handleWipeProcurement}
            disabled={syncing}
            className="text-xs px-2 py-1 text-amber-700 border border-amber-200 rounded hover:bg-amber-50 disabled:opacity-50"
            title="Drain procurement rows on this DesignItem (CSV imports, manual entries, untagged legacy). Scene-origin parts are protected."
          >
            Wipe procurement
          </button>
        </div>
      </div>
      {preview && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-2 space-y-1 text-[10px] text-blue-900">
          <p className="font-medium">Preview — forecast for the next sync</p>
          <p>
            {preview.cabinetCount} cabinet{preview.cabinetCount === 1 ? '' : 's'} bound
            {' · '}{preview.mergedPartCount} scene parts
            {' · '}{preview.preservedProcurement} procurement rows preserved
            {' → '}final: <span className="font-semibold">{preview.wouldFinalCount}</span>
          </p>
          {preview.droppedStaleSceneOrigin > 0 && (
            <p className="text-amber-700">
              {preview.droppedStaleSceneOrigin} existing scene-origin rows will be replaced.
            </p>
          )}
          {Object.keys(preview.existingBySource).length > 0 && (
            <p className="text-blue-800">
              Existing DM by source:{' '}
              {Object.entries(preview.existingBySource)
                .sort((a, b) => b[1] - a[1])
                .map(([src, n]) => `${n} ${src}`)
                .join(' · ')}
            </p>
          )}
          {preview.perCabinet.length > 1 && (
            <details className="mt-1">
              <summary className="cursor-pointer hover:underline">Per-cabinet breakdown</summary>
              <ul className="mt-1 space-y-0.5 pl-3">
                {preview.perCabinet.map(c => (
                  <li key={c.cabinetId}>
                    {c.cabinetCode}: {c.partsBeforeMerge} parts · qty {c.requiredQuantity} · from {c.source}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      {result && (
        <div className="space-y-0.5">
          {result.procurementRemoved !== undefined ? (
            <p className="text-[10px] text-amber-700">
              {result.procurementRemoved} procurement rows deleted · {result.preservedProcurement} remaining
              {result.procurementRemoved === 0 && ' (nothing to drain — no procurement rows present)'}
            </p>
          ) : (
            <p className="text-[10px] text-green-700">
              {result.added} scene parts written · {result.preservedProcurement} procurement rows preserved
              {result.droppedStaleSceneOrigin > 0 && (
                <span className="text-amber-700"> · {result.droppedStaleSceneOrigin} stale scene rows replaced</span>
              )}
            </p>
          )}
          {result.aiUsed && result.aiConfidence !== undefined && (
            <p className="text-[10px] text-purple-700" title={result.aiReasoning}>
              AI pairing · {Math.round(result.aiConfidence * 100)}% confidence · hover for reasoning
            </p>
          )}
          {result.csvMatched !== undefined && result.csvTotal !== undefined && (
            <p className="text-[10px] text-gray-500">
              CSV overlay: {result.csvMatched}/{result.csvTotal} rows paired
            </p>
          )}
        </div>
      )}
      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RevisionApplyRow — surfaces the latest DesignRevision for the cabinet's
// project and offers a "Apply to parts" button that opens the diff modal.
// Disabled when (a) there's no revision yet, (b) the scene isn't
// project-backed, (c) the latest revision has no glbUrl yet (i.e. CAD
// conversion still in flight), or (d) the cabinet is already on the
// latest revision.
// ---------------------------------------------------------------------------

interface RevisionApplyRowProps {
  sceneId: string;
  cabinetId: string;
  cabinetLabel: string;
  projectId: string;
  designItemId?: string;
  lastAppliedRevisionNumber?: number;
}

function RevisionApplyRow({
  sceneId, cabinetId, cabinetLabel, projectId, designItemId, lastAppliedRevisionNumber,
}: RevisionApplyRowProps) {
  const [latest, setLatest] = useState<DesignRevision | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    const unsub = subscribeToRevisions({ projectId }, list => {
      setLatest(list[0] ?? null);
    });
    return () => unsub();
  }, [projectId]);

  if (!projectId) return null;
  if (!latest) return null; // No revisions yet — nothing to apply.

  const applied = lastAppliedRevisionNumber ?? 0;
  const isCurrent = applied >= latest.revisionNumber;
  // Client-parseable if the revision carries a .3ds or .glb source —
  // .step/.x_t are server-side only and need the CAD→GLB regeneration
  // Cloud Function to populate glbUrl first.
  const hasGlb = !!(latest.files?.threeDsUrl || latest.files?.glbUrl);

  const disabled = isCurrent || !hasGlb;
  const tooltip = isCurrent
    ? `Cabinet already on revision #${latest.revisionNumber}`
    : !hasGlb
    ? 'Latest revision has no .3ds / .glb yet — waiting for CAD→GLB conversion'
    : `Preview + apply revision #${latest.revisionNumber}`;

  return (
    <>
      <div className="rounded-md border border-gray-200 px-2.5 py-2 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-gray-500 truncate">
            {isCurrent
              ? `Parts on revision #${latest.revisionNumber} (latest)`
              : `Parts on rev #${applied} · latest is #${latest.revisionNumber}`}
          </p>
          <div className="flex gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              title="Browse + roll back to an older ModelPackage version"
              className="text-xs px-2 py-1 rounded border border-border hover:bg-accent"
            >
              History
            </button>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              disabled={disabled}
              title={tooltip}
              className="text-xs px-2 py-1 rounded border border-border hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isCurrent ? 'Up to date' : 'Apply revision'}
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <RevisionDiffModal
          sceneId={sceneId}
          cabinetId={cabinetId}
          cabinetLabel={cabinetLabel}
          revisionId={latest.id}
          designItemId={designItemId}
          onClose={() => setModalOpen(false)}
        />
      )}

      {historyOpen && (
        <ModelPackageHistoryModal
          sceneId={sceneId}
          cabinetId={cabinetId}
          cabinetLabel={cabinetLabel}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// CabinetQuantityInput — compact × N stepper in the panel header.
//
// Reads requiredQuantity straight off the cabinet doc; writes through
// `setCabinetRequiredQuantity` which validates the value, rejects locked
// cabinets at the service layer, and triggers the DesignItem rollup so
// cost + parts sync on the DM side catch up automatically.
// ---------------------------------------------------------------------------

function CabinetQuantityInput({
  sceneId, cabinetId, value, disabled,
}: {
  sceneId: string;
  cabinetId: string;
  value: number;
  disabled?: boolean;
}) {
  const [local, setLocal] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Keep local mirror in sync when the cabinet prop changes — e.g. the
  // scene reloads after a different write elsewhere.
  useEffect(() => { setLocal(String(value)); }, [value]);

  const commit = async (raw: string) => {
    setErr(null);
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1) {
      setErr('Must be ≥ 1');
      setLocal(String(value));
      return;
    }
    if (n === value) return;
    setSaving(true);
    try {
      await setCabinetRequiredQuantity(sceneId, cabinetId, n);
    } catch (e) {
      setErr((e as Error).message || 'Failed to update');
      setLocal(String(value));
    } finally {
      setSaving(false);
    }
  };

  const step = (delta: number) => {
    if (disabled) return;
    const next = Math.max(1, value + delta);
    if (next === value) return;
    void commit(String(next));
  };

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded border border-gray-200 bg-white"
      title={disabled ? 'Locked cabinet — unlock to change quantity' : 'Required quantity (physical units)'}
    >
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={disabled || saving || value <= 1}
        className="px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-30"
      >
        −
      </button>
      <div className="relative flex items-center">
        <span className="text-[10px] text-gray-400 mr-0.5">×</span>
        <input
          type="number"
          min={1}
          step={1}
          value={local}
          disabled={disabled || saving}
          onChange={e => setLocal(e.target.value)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          className="w-8 text-center text-xs font-medium bg-transparent focus:outline-none disabled:opacity-60"
        />
      </div>
      <button
        type="button"
        onClick={() => step(1)}
        disabled={disabled || saving}
        className="px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-30"
      >
        +
      </button>
      {err && (
        <span className="absolute mt-8 text-[10px] text-red-600 whitespace-nowrap">{err}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SplitCabinetRow — opens SplitCabinetDialog. Shows a subtle entry
// point + a live count hint ("2 clusters detected") when the
// default 50mm tolerance already suggests the cabinet should split.
// ---------------------------------------------------------------------------

function SplitCabinetRow({
  sceneId, cabinet, parsedModel, onSplit,
}: {
  sceneId: string;
  cabinet: SceneCabinet;
  parsedModel: ParsedModel;
  onSplit?: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const meshBboxes = useMeshBboxes(parsedModel);

  // Quick preview count — if a split is obviously needed the button
  // says so ("Split into 2"), else falls back to a neutral label.
  const hint = useMemo(() => {
    if (!meshBboxes) return null;
    const meshes = cabinet.sourceMeshNames?.length
      ? cabinet.sourceMeshNames
      : Array.from(meshBboxes.keys());
    if (meshes.length < 2) return null;
    const res = detectSubCabinets(meshes, meshBboxes, { gapToleranceMm: 50 });
    return res.clusters.length >= 2 ? res.clusters.length : null;
  }, [cabinet.sourceMeshNames, meshBboxes]);

  return (
    <section className="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-2 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[11px] font-medium">Split into separate cabinets</p>
        <p className="text-[10px] text-gray-500">
          {hint
            ? `${hint} cabinets detected at default 50 mm gap tolerance`
            : 'Detect when one import contains multiple physical units'}
        </p>
      </div>
      <button
        type="button"
        disabled={cabinet.isLocked || !meshBboxes}
        onClick={() => setDialogOpen(true)}
        className="shrink-0 text-[11px] px-2 py-1 rounded border border-border hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
        title={cabinet.isLocked ? 'Unlock the cabinet to split' : 'Open split-detection'}
      >
        {hint ? `Split → ${hint}` : 'Detect'}
      </button>
      {dialogOpen && meshBboxes && (
        <SplitCabinetDialog
          sceneId={sceneId}
          cabinet={cabinet}
          meshBboxes={meshBboxes}
          onClose={() => setDialogOpen(false)}
          onSplit={() => { setDialogOpen(false); onSplit?.(); }}
        />
      )}
    </section>
  );
}
