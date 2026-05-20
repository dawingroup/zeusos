/**
 * SceneWorkspaceBreadcrumb — compact header widget that surfaces the
 * scene's project context + lets the user page to peer scenes without
 * leaving the workspace.
 *
 * Sits in the existing toolbar. Three affordances:
 *   1. Project name + link back to Design Manager's project detail
 *      (the new Scenes tab is pre-selected via URL hash, for a nice
 *      round-trip).
 *   2. "Scene K of N" counter so the user knows their position.
 *   3. Prev / Next buttons cycling through the project's peer scenes
 *      (skipping archived).
 *
 * Hidden when the scene is standalone (no projectId) — nothing to
 * breadcrumb to. Silent failure on lookup errors so it can never
 * block the workspace itself.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FolderOpen } from 'lucide-react';
import { getProject } from '@/modules/design-manager/services/firestore';
import { getScenesForProject } from '../../services/scene.service';
import type { DesignScene } from '../../types/scene.types';

interface Props {
  sceneId: string;
  projectId: string;
}

export function SceneWorkspaceBreadcrumb({ sceneId, projectId }: Props) {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState<string | null>(null);
  const [siblings, setSiblings] = useState<DesignScene[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [project, scenes] = await Promise.all([
          getProject(projectId),
          getScenesForProject(projectId),
        ]);
        if (cancelled) return;
        setProjectName(project?.name ?? 'Project');
        // Skip archived — the user can't page into something they
        // wouldn't see in the project's Scenes tab anyway.
        setSiblings(scenes.filter(s => s.status !== 'archived'));
      } catch {
        // Silent fallback — project lookup failures shouldn't block
        // the scene workspace.
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  const position = useMemo(() => {
    if (!siblings) return null;
    const idx = siblings.findIndex(s => s.id === sceneId);
    if (idx < 0) return null;
    return {
      index: idx,
      total: siblings.length,
      prev: idx > 0 ? siblings[idx - 1] : null,
      next: idx < siblings.length - 1 ? siblings[idx + 1] : null,
    };
  }, [siblings, sceneId]);

  const jump = (id: string) => navigate(`/workshop/scenes/${id}`);

  if (!projectName) return null;

  return (
    <div className="inline-flex items-center gap-1.5 text-[11px] text-gray-600">
      <Link
        to={`/design/project/${projectId}#scenes`}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-accent hover:text-foreground truncate max-w-[180px]"
        title={`Back to ${projectName} (Scenes tab)`}
      >
        <FolderOpen className="h-3 w-3 shrink-0" />
        <span className="truncate">{projectName}</span>
      </Link>

      {position && position.total > 1 && (
        <>
          <span className="text-gray-300">·</span>
          <button
            type="button"
            onClick={() => position.prev && jump(position.prev.id)}
            disabled={!position.prev}
            title={position.prev ? `Prev: ${position.prev.name}` : 'No earlier scene'}
            className="h-5 w-5 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center justify-center"
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
          <span className="tabular-nums text-[10px] text-muted-foreground">
            Scene {position.index + 1}/{position.total}
          </span>
          <button
            type="button"
            onClick={() => position.next && jump(position.next.id)}
            disabled={!position.next}
            title={position.next ? `Next: ${position.next.name}` : 'No later scene'}
            className="h-5 w-5 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center justify-center"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        </>
      )}
    </div>
  );
}
