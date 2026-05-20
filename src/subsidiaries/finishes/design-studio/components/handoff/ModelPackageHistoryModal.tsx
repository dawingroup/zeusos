/**
 * ModelPackageHistoryModal — browse + roll back archived ModelPackage
 * versions for a cabinet.
 *
 * Every time parts are re-derived (first processing, revision apply,
 * manual re-processing), the prior package is archived to
 * `designScenes/{sceneId}/cabinets/{cabinetId}/modelPackage/current/versions/{id}`.
 * This modal lists them newest-first and offers a single-click restore.
 *
 * Restore uses `rollbackToModelPackageVersion` which writes the target
 * version back as the new current (archiving the current-at-time as
 * its own version), so rollback is itself reversible — the user can
 * roll forward again from history.
 */
import { useEffect, useState } from 'react';
import { X, Loader2, RotateCcw, Check, AlertTriangle, FileBox } from 'lucide-react';
import { useAuth } from '@/shared/hooks/useAuth';
import {
  listCabinetModelPackageVersions,
  rollbackToModelPackageVersion,
} from '../../services/revisionPartsRefresh';
import type { ModelPackage } from '../../types/modelPackage.types';

interface Props {
  sceneId: string;
  cabinetId: string;
  cabinetLabel: string;
  onClose: () => void;
  onRolledBack?: (restoredVersion: number) => void;
}

export function ModelPackageHistoryModal({
  sceneId, cabinetId, cabinetLabel, onClose, onRolledBack,
}: Props) {
  const { user } = useAuth();
  const [versions, setVersions] = useState<ModelPackage[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);    // version number currently being restored
  const [done, setDone] = useState<{ restoredVersion: number; partsWritten: number } | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listCabinetModelPackageVersions(sceneId, cabinetId);
        if (!cancelled) setVersions(list);
      } catch (e) {
        if (!cancelled) setErr((e as Error).message || 'Failed to load versions');
      }
    })();
    return () => { cancelled = true; };
  }, [sceneId, cabinetId]);

  const handleRestore = async (v: ModelPackage) => {
    if (!user) return;
    setBusy(v.version);
    setErr(null);
    try {
      const res = await rollbackToModelPackageVersion(sceneId, cabinetId, v, user);
      setDone({ restoredVersion: res.restoredVersion, partsWritten: res.partsWritten });
      onRolledBack?.(res.restoredVersion);
    } catch (e) {
      setErr((e as Error).message || 'Rollback failed');
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-background rounded-lg shadow-xl border border-border w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold">Parts history — {cabinetLabel}</h2>
            <p className="text-[11px] text-muted-foreground">Restore an older ModelPackage version.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-accent"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-3">
          {err && (
            <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-900 mb-2 inline-flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> {err}
            </div>
          )}

          {done && (
            <div className="rounded-md border border-green-200 bg-green-50 p-2 text-xs text-green-900 mb-2">
              <Check className="h-3.5 w-3.5 inline mr-1" />
              Restored v{done.restoredVersion} — {done.partsWritten} parts in place.
              The stale-revision detector will re-flag this cabinet against
              the project's latest revision (that's expected and correct).
            </div>
          )}

          {versions === null ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading version history…
            </div>
          ) : versions.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No archived versions yet — this cabinet has only its current ModelPackage.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {versions.map(v => {
                const partCount = (v.grouping?.parts ?? []).length;
                const asmCount = (v.grouping?.assemblies ?? []).length;
                const processed = v.metadata?.processedAt
                  ? (v.metadata.processedAt as unknown as { toDate?: () => Date }).toDate?.()
                  : null;
                const isBusy = busy === v.version;
                const isConfirming = confirming === v.version;
                return (
                  <li key={v.version} className="rounded-md border border-border p-2">
                    <div className="flex items-start gap-2">
                      <FileBox className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">
                          v{v.version}
                          <span className="text-muted-foreground ml-2">
                            {processed ? processed.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                          </span>
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {asmCount} assembl{asmCount === 1 ? 'y' : 'ies'} · {partCount} parts · grouping {v.grouping?.source}
                          {v.grouping?.confidence !== undefined && ` (${Math.round(v.grouping.confidence * 100)}%)`}
                        </p>
                        {v.modelRef?.fileName && (
                          <p className="text-[10px] text-muted-foreground font-mono truncate">
                            {v.modelRef.fileName}
                          </p>
                        )}
                      </div>
                      {isConfirming ? (
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleRestore(v)}
                            disabled={isBusy || !user}
                            className="text-[10px] px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 inline-flex items-center gap-1"
                          >
                            {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirming(null)}
                            className="text-[10px] px-2 py-1 rounded border border-border hover:bg-accent"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirming(v.version)}
                          disabled={!user}
                          className="shrink-0 text-[10px] px-2 py-1 rounded border border-border hover:bg-accent disabled:opacity-40 inline-flex items-center gap-1"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Restore
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
