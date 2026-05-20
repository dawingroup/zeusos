/**
 * SessionContextCard — Bind / rebind a Workshop Viewer session to a
 * DesignProject + DesignItem.
 *
 * P21.2: the Workshop Viewer could silently create `standalone` sessions
 * (null `linkedDesignItemId` + null `linkedMoId`), and there was no UI
 * for the user to bind one after the fact. Uploaded models, AI-recognised
 * parts and generated print packages would never propagate back to
 * Design Manager — the user saw a green tick on "saved" and assumed it
 * was linked. This panel closes that gap:
 *
 *   - Shows the session's current binding (project + item, or "Standalone").
 *   - Offers a two-step picker (project → item) when unbound or the user
 *     clicks "Rebind".
 *   - On confirm, calls {@link bindSessionToContext} and re-fetches so
 *     downstream hooks (`usePartRecognition`, `ExportConfigPanel`) pick up
 *     the new ids.
 *
 * Deliberately NOT offered: binding to an MO. The MO path is URL-driven
 * (`?moId=…`) and is owned by the Production flow; binding via UI here
 * would create two parallel authorities for the same session field.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link2, Loader2, RefreshCw } from 'lucide-react';
import { DesignProjectPicker, type DesignProjectPickerValue } from './scene/DesignProjectPicker';
import { DesignItemPicker, type DesignItemPickerValue } from './scene/DesignItemPicker';
import {
  bindSessionToContext,
  getSession,
} from '../services/workshopViewerService';
import type { ViewerSession } from '../types/workshop-viewer.types';

interface SessionContextCardProps {
  sessionId: string | null;
  userId: string;
  /** Called when the binding changes so parent can refresh derived state
   *  (e.g. re-resolve `projectContext`). */
  onBound?: (session: ViewerSession) => void;
}

export function SessionContextCard({
  sessionId,
  userId,
  onBound,
}: SessionContextCardProps) {
  const [session, setSession] = useState<ViewerSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pickingMode, setPickingMode] = useState(false);
  const [project, setProject] = useState<DesignProjectPickerValue | null>(null);
  const [item, setItem] = useState<DesignItemPickerValue | null>(null);
  const [saving, setSaving] = useState(false);

  // Load (and refresh) the session whenever the id changes.
  const loadSession = useCallback(async () => {
    if (!sessionId) {
      setSession(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const s = await getSession(sessionId);
      setSession(s);
    } catch (err) {
      setError((err as Error).message || 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const handleStartPicking = useCallback(() => {
    setProject(null);
    setItem(null);
    setError(null);
    setPickingMode(true);
  }, []);

  const handleCancel = useCallback(() => {
    setPickingMode(false);
    setProject(null);
    setItem(null);
  }, []);

  const handleBind = useCallback(async () => {
    if (!sessionId || !project || !item) return;
    setSaving(true);
    setError(null);
    try {
      await bindSessionToContext(
        sessionId,
        {
          linkedDesignProjectId: project.id,
          linkedDesignItemId: item.id,
          // Preserve any existing MO binding — the service overwrites it
          // if undefined, so forward explicitly.
          linkedMoId: session?.linkedMoId ?? undefined,
        },
        userId,
      );
      const refreshed = await getSession(sessionId);
      setSession(refreshed);
      setPickingMode(false);
      setProject(null);
      setItem(null);
      if (refreshed) onBound?.(refreshed);
    } catch (err) {
      setError((err as Error).message || 'Failed to bind session');
    } finally {
      setSaving(false);
    }
  }, [sessionId, project, item, session?.linkedMoId, userId, onBound]);

  if (!sessionId) {
    return (
      <div className="p-3">
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          No active session yet. Load a model file to start a session, then
          bind it to a Design Manager project here.
        </div>
      </div>
    );
  }

  if (loading && !session) {
    return (
      <div className="p-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading session…
      </div>
    );
  }

  const isStandalone = session?.scope === 'standalone' || !session?.linkedDesignItemId;

  return (
    <div className="p-3 space-y-3">
      {/* Current binding card */}
      <div
        className={`rounded-lg border p-3 ${
          isStandalone
            ? 'border-amber-200 bg-amber-50'
            : 'border-emerald-200 bg-emerald-50'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2
              className={`h-4 w-4 ${
                isStandalone ? 'text-amber-600' : 'text-emerald-600'
              }`}
            />
            <span
              className={`text-xs font-medium ${
                isStandalone ? 'text-amber-900' : 'text-emerald-900'
              }`}
            >
              {isStandalone ? 'Standalone session' : 'Bound session'}
            </span>
          </div>
          {!pickingMode && (
            <button
              type="button"
              onClick={handleStartPicking}
              className="text-xs font-medium text-blue-700 hover:underline flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              {isStandalone ? 'Bind…' : 'Rebind…'}
            </button>
          )}
        </div>

        <div className="mt-2 text-[11px] space-y-1">
          {isStandalone ? (
            <p className="text-amber-800">
              This session isn't linked to a DesignItem yet. Parts will not
              sync back to Design Manager, and print packages cannot be
              attached to a deliverable. Bind it to a project + item to
              enable the full handoff.
            </p>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="w-14 shrink-0 text-emerald-800/70">
                  Project
                </span>
                <span className="font-mono text-emerald-900 truncate">
                  {session?.linkedDesignProjectId ?? '—'}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="w-14 shrink-0 text-emerald-800/70">Item</span>
                <span className="font-mono text-emerald-900 truncate">
                  {session?.linkedDesignItemId ?? '—'}
                </span>
              </div>
              {session?.linkedMoId && (
                <div className="flex items-baseline gap-2">
                  <span className="w-14 shrink-0 text-emerald-800/70">MO</span>
                  <span className="font-mono text-emerald-900 truncate">
                    {session.linkedMoId}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Picker flow */}
      {pickingMode && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              1. Design project
            </label>
            <DesignProjectPicker
              value={project}
              onChange={(next) => {
                setProject(next);
                // Changing project invalidates the item pick.
                setItem(null);
              }}
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              2. Design item
            </label>
            <DesignItemPicker
              projectId={project?.id ?? ''}
              userId={userId}
              value={item}
              onChange={setItem}
              disabled={saving || !project}
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="px-3 py-1.5 text-xs text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleBind}
              disabled={!project || !item || saving}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
              Bind session
            </button>
          </div>
        </div>
      )}

      {error && !pickingMode && (
        <p className="text-xs text-red-600 px-1">{error}</p>
      )}
    </div>
  );
}

export default SessionContextCard;
