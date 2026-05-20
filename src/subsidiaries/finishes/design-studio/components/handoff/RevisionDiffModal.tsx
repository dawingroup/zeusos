/**
 * RevisionDiffModal — preview + apply a revision's parts against a cabinet.
 *
 * Flow:
 *   1. Mounts → calls `previewRevisionApply` (fetches GLB, dry-runs the
 *      AI grouping, diffs against current parts).
 *   2. Renders the diff grouped by kind (Added / Changed / Removed /
 *      Unchanged) with a per-row decision selector. Locked fields
 *      surface as small shields so the user knows why the default is
 *      "keep".
 *   3. "Apply" calls `applyRevisionToCabinet` with the final decisions.
 *      Re-parses on the server path so a concurrent revision bump is
 *      respected.
 *
 * The modal is scoped to ONE cabinet. Scene-wide batch apply is a
 * separate, later surface (scope doc's out-of-scope).
 */
import { useEffect, useMemo, useState } from 'react';
import { X, Loader2, Check, AlertTriangle, Lock, Plus, Minus, ArrowRight, Send } from 'lucide-react';
import {
  previewRevisionApply, applyRevisionToCabinet,
  type PreviewResult,
} from '../../services/revisionPartsRefresh';
import type { PartChange, ChangeDecision, PartFieldChange } from '../../services/revisionPartsDiff';
import { syncDesignItemPartsFromScene } from '../../services/designItemPartsSyncFromScene';
import { useAuth } from '@/shared/hooks/useAuth';

interface Props {
  sceneId: string;
  cabinetId: string;
  cabinetLabel: string;
  revisionId: string;
  /** When set, enables the "Also push to Design Manager" checkbox. */
  designItemId?: string;
  onClose: () => void;
  onApplied?: (partsWritten: number) => void;
}

export function RevisionDiffModal({
  sceneId, cabinetId, cabinetLabel, revisionId, designItemId, onClose, onApplied,
}: Props) {
  const { user } = useAuth();
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'error'; message: string }
    | { kind: 'ready'; preview: PreviewResult }
    | { kind: 'applying'; step: 'apply' | 'sync' }
    | { kind: 'done'; partsWritten: number; fieldsPreserved: number; issuesResolved: number; dmSynced?: number }
  >({ kind: 'loading' });

  const [decisions, setDecisions] = useState<Record<string, ChangeDecision>>({});
  const [alsoSyncToDM, setAlsoSyncToDM] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    (async () => {
      try {
        const preview = await previewRevisionApply(sceneId, cabinetId, revisionId);
        if (cancelled) return;
        setDecisions(preview.defaultDecisions);
        setState({ kind: 'ready', preview });
      } catch (e) {
        if (cancelled) return;
        setState({ kind: 'error', message: (e as Error).message || 'Preview failed' });
      }
    })();
    return () => { cancelled = true; };
  }, [sceneId, cabinetId, revisionId]);

  const setDecision = (id: string, d: ChangeDecision) => {
    setDecisions(prev => ({ ...prev, [id]: d }));
  };

  const handleApply = async () => {
    if (!user) return;
    setState({ kind: 'applying', step: 'apply' });
    try {
      const res = await applyRevisionToCabinet(sceneId, cabinetId, revisionId, decisions, user);

      let dmSynced: number | undefined;
      if (alsoSyncToDM && designItemId) {
        setState({ kind: 'applying', step: 'sync' });
        try {
          const syncRes = await syncDesignItemPartsFromScene(sceneId, designItemId, user.uid);
          dmSynced = syncRes.synced;
        } catch {
          // Non-fatal — the apply succeeded; surface DM-sync failure as a
          // note in the done state rather than failing the whole flow.
          dmSynced = -1;
        }
      }

      setState({
        kind: 'done',
        partsWritten: res.partsWritten,
        fieldsPreserved: res.fieldsPreserved,
        issuesResolved: res.issuesResolved,
        dmSynced,
      });
      onApplied?.(res.partsWritten);
    } catch (e) {
      setState({ kind: 'error', message: (e as Error).message || 'Apply failed' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-background rounded-lg shadow-xl border border-border w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate">Apply revision to {cabinetLabel}</h2>
            {state.kind === 'ready' && (
              <p className="text-[11px] text-muted-foreground">
                Revision #{state.preview.revision.revisionNumber} · AI grouping {state.preview.grouping.source} · confidence {(state.preview.grouping.confidence * 100).toFixed(0)}%
              </p>
            )}
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

        {/* Body */}
        <div className="flex-1 overflow-auto p-3">
          {state.kind === 'loading' && <LoadingState />}
          {state.kind === 'error' && <ErrorState message={state.message} />}
          {state.kind === 'applying' && (
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              {state.step === 'apply' ? 'Applying revision…' : 'Pushing to Design Manager…'}
            </div>
          )}
          {state.kind === 'done' && (
            <DoneState result={state} onClose={onClose} />
          )}
          {state.kind === 'ready' && (
            <DiffBody
              preview={state.preview}
              decisions={decisions}
              onDecision={setDecision}
            />
          )}
        </div>

        {/* Footer */}
        {state.kind === 'ready' && (
          <div className="flex items-center justify-between p-3 border-t border-border gap-3 flex-wrap">
            <DiffSummary preview={state.preview} decisions={decisions} />
            <div className="flex items-center gap-3">
              {designItemId && (
                <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={alsoSyncToDM}
                    onChange={e => setAlsoSyncToDM(e.target.checked)}
                    className="h-3.5 w-3.5"
                  />
                  <Send className="h-3 w-3" />
                  Also push to Design Manager
                </label>
              )}
              <button
                type="button"
                onClick={onClose}
                className="text-xs px-3 py-1.5 rounded border border-border hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={!user}
                className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 inline-flex items-center gap-1"
              >
                <Check className="h-3.5 w-3.5" />
                Apply
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin mb-2" />
      Fetching revision + running AI grouping…
      <p className="text-[11px] mt-1">Can take 20–40s for a large model.</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-900">
      <AlertTriangle className="h-4 w-4 inline mr-1" />
      {message}
    </div>
  );
}

function DoneState({
  result, onClose,
}: {
  result: { partsWritten: number; fieldsPreserved: number; issuesResolved: number; dmSynced?: number };
  onClose: () => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-green-700 flex items-center gap-1">
        <Check className="h-4 w-4" /> Revision applied
      </p>
      <ul className="text-xs text-foreground space-y-0.5">
        <li>{result.partsWritten} parts committed</li>
        <li>{result.fieldsPreserved} user-locked fields preserved (names / materials)</li>
        {result.issuesResolved > 0 && (
          <li>{result.issuesResolved} revision-pending issue{result.issuesResolved === 1 ? '' : 's'} auto-resolved</li>
        )}
        {result.dmSynced !== undefined && result.dmSynced >= 0 && (
          <li>{result.dmSynced} parts pushed to Design Manager</li>
        )}
        {result.dmSynced === -1 && (
          <li className="text-amber-700">Design Manager sync failed — click "Sync parts" to retry.</li>
        )}
      </ul>
      <button
        type="button"
        onClick={onClose}
        className="text-xs px-3 py-1.5 rounded border border-border hover:bg-accent mt-2"
      >
        Close
      </button>
    </div>
  );
}

function DiffSummary({
  preview, decisions,
}: {
  preview: PreviewResult;
  decisions: Record<string, ChangeDecision>;
}) {
  const counts = useMemo(() => {
    const c = { apply: 0, keep: 0, drop: 0 };
    for (const ch of preview.diff.changes) {
      const d = decisions[ch.id] ?? 'keep';
      c[d]++;
    }
    return c;
  }, [preview, decisions]);
  return (
    <p className="text-[11px] text-muted-foreground">
      {counts.apply} apply · {counts.keep} keep · {counts.drop} drop
    </p>
  );
}

function DiffBody({
  preview, decisions, onDecision,
}: {
  preview: PreviewResult;
  decisions: Record<string, ChangeDecision>;
  onDecision: (id: string, d: ChangeDecision) => void;
}) {
  // Sort for stable display: added → changed → removed → unchanged.
  const order: PartChange['kind'][] = ['added', 'changed', 'removed', 'unchanged'];
  const grouped = order.map(k => ({
    kind: k,
    changes: preview.diff.changes.filter(c => c.kind === k),
  })).filter(g => g.changes.length > 0);

  return (
    <div className="space-y-3">
      {grouped.map(g => (
        <section key={g.kind}>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            {g.kind} ({g.changes.length})
          </h3>
          <ul className="space-y-1">
            {g.changes.map(ch => (
              <ChangeRow
                key={ch.id}
                change={ch}
                decision={decisions[ch.id] ?? 'keep'}
                onDecision={d => onDecision(ch.id, d)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ChangeRow({
  change, decision, onDecision,
}: {
  change: PartChange;
  decision: ChangeDecision;
  onDecision: (d: ChangeDecision) => void;
}) {
  const icon = change.kind === 'added'
    ? <Plus className="h-3.5 w-3.5 text-green-700" />
    : change.kind === 'removed'
    ? <Minus className="h-3.5 w-3.5 text-red-700" />
    : change.kind === 'changed'
    ? <ArrowRight className="h-3.5 w-3.5 text-amber-700" />
    : <Check className="h-3.5 w-3.5 text-muted-foreground" />;

  return (
    <li className="rounded-md border border-border p-2">
      <div className="flex items-start gap-2">
        <span className="mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate" title={change.label}>
            {change.label}
          </p>
          {change.changes.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {change.changes.map((f, i) => <FieldDelta key={i} f={f} />)}
            </ul>
          )}
          {change.kind === 'added' && change.incoming?.dimensions && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {change.incoming.dimensions.length ?? '?'}×{change.incoming.dimensions.width ?? '?'}×{change.incoming.dimensions.thickness ?? '?'}mm
              · {change.incoming.inventoryItemName || change.incoming.materialDescription || 'no material'}
            </p>
          )}
        </div>
        <select
          value={decision}
          onChange={e => onDecision(e.target.value as ChangeDecision)}
          className="shrink-0 text-[10px] px-1.5 py-1 rounded border border-border bg-background"
        >
          <option value="apply">Apply</option>
          <option value="keep">Keep current</option>
          <option value="drop">Drop</option>
        </select>
      </div>
    </li>
  );
}

function FieldDelta({ f }: { f: PartFieldChange }) {
  return (
    <li className="text-[10px] flex items-center gap-1">
      <span className="text-muted-foreground capitalize">{f.field}:</span>
      <span className="font-mono line-through opacity-60">{String(f.before ?? '—')}</span>
      <ArrowRight className="h-2.5 w-2.5" />
      <span className="font-mono">{String(f.after ?? '—')}</span>
      {f.locked && (
        <span className="ml-1 inline-flex items-center gap-0.5 text-amber-700" title="Locked by user — default is to keep the current value">
          <Lock className="h-2.5 w-2.5" />
          locked
        </span>
      )}
    </li>
  );
}
