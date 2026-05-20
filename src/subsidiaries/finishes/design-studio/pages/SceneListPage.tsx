/**
 * SceneListPage — Browse and create design scenes
 *
 * Entry point for multi-cabinet scene composition.
 * Uses SceneBrowser to list scenes and create new ones.
 *
 * P21.10 — project-scoped route support. When mounted under
 * `/workshop/projects/:projectId/scenes`, the page shows a project header
 * (name, code, customer) and hides the project-switch affordance in the
 * create dialog (project is already known). The flat
 * `/workshop/scenes` mount still works for back-compat; it accepts
 * `?projectId=` as a filter but shows the global browser.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { SceneBrowser } from '../components/scene/SceneBrowser';
import { getProject } from '@/modules/design-manager/services';
import type { DesignProject } from '@/modules/design-manager/types';

export default function SceneListPage() {
  const navigate = useNavigate();
  const params = useParams<{ projectId?: string }>();
  const [searchParams] = useSearchParams();
  // Route param wins over query param — the former is the new, canonical
  // shape; the latter is the old `?projectId=` query form that some deep
  // links still use.
  const projectId = params.projectId ?? searchParams.get('projectId') ?? undefined;

  const [project, setProject] = useState<DesignProject | null>(null);
  useEffect(() => {
    if (!projectId) {
      setProject(null);
      return;
    }
    let cancelled = false;
    getProject(projectId)
      .then(p => {
        if (!cancelled) setProject(p);
      })
      .catch(() => {
        if (!cancelled) setProject(null);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleSceneSelect = useCallback(
    (sceneId: string) => {
      // Prefer the project-scoped route when we know the project — keeps
      // the URL hierarchy clean and gives the workspace page the same
      // context on refresh.
      if (projectId) {
        navigate(`/workshop/projects/${projectId}/scenes/${sceneId}`);
      } else {
        navigate(`/workshop/scenes/${sceneId}`);
      }
    },
    [navigate, projectId],
  );

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-4">
      {project && (
        <div className="rounded-lg border border-border bg-card p-4">
          <button
            type="button"
            onClick={() => navigate(`/design/project/${project.id}`)}
            className="text-[11px] text-blue-600 hover:underline inline-flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to project in Design Manager
          </button>
          <div className="flex items-baseline justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-base font-semibold truncate">{project.name}</h1>
              <div className="text-[11px] text-muted-foreground space-x-2">
                {project.code && (
                  <span className="font-mono">{project.code}</span>
                )}
                {project.customerName && <span>· {project.customerName}</span>}
              </div>
            </div>
          </div>
        </div>
      )}
      <SceneBrowser
        projectId={projectId}
        onSceneSelect={handleSceneSelect}
      />
    </div>
  );
}
