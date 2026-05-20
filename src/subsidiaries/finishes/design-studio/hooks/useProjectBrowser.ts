/**
 * useProjectBrowser — Reusable project/item/file browsing logic
 *
 * Extracted from FileUploadZone. Fetches design projects, items, and
 * deliverables with cross-referencing against projectFiles (UFM).
 */

import { useState, useCallback } from 'react';
import { getProjects, getDesignItems, subscribeToDeliverables } from '@/modules/design-manager/services';
import type { DesignProject, DesignItem, Deliverable } from '@/modules/design-manager/types';
import { subscribeToProjectFiles } from '@/shared/services/fileManager/fileManagerService';
import type { ManagedFile } from '@/shared/services/fileManager/types';
import type { ProjectContext } from '../types/workshop-viewer.types';
import { resolveFromDesignItem } from '../services/projectContextService';

const WORKSHOP_FILES_RE = /\.(3ds|dxf|obj|fbx|skp|glb|gltf|csv)$/i;
const CSV_RE = /\.csv$/i;

export interface BrowsableFile {
  id: string;
  fileName: string;
  storageUrl: string;
  itemId: string;
  itemName: string;
  isCsv: boolean;
}

interface UseProjectBrowserReturn {
  // State
  projects: DesignProject[];
  selectedProject: DesignProject | null;
  items: DesignItem[];
  files: Record<string, BrowsableFile[]>; // itemId → files
  loading: boolean;
  loadingFiles: boolean;

  // Actions
  openBrowser: () => Promise<void>;
  selectProject: (project: DesignProject) => Promise<void>;
  loadFile: (file: BrowsableFile) => Promise<{ file: File; context: ProjectContext | null }>;
  reset: () => void;
}

export function useProjectBrowser(): UseProjectBrowserReturn {
  const [projects, setProjects] = useState<DesignProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<DesignProject | null>(null);
  const [items, setItems] = useState<DesignItem[]>([]);
  const [files, setFiles] = useState<Record<string, BrowsableFile[]>>({});
  const [loading, setLoading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const openBrowser = useCallback(async () => {
    setLoading(true);
    try {
      const allProjects = await getProjects();
      setProjects(allProjects.filter(p => p.status === 'active' || !p.status));
    } catch (err) {
      console.warn('[useProjectBrowser] Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const selectProject = useCallback(async (project: DesignProject) => {
    setSelectedProject(project);
    setLoadingFiles(true);
    setFiles({});

    try {
      const projectItems = await getDesignItems(project.id);
      setItems(projectItems);

      // Get projectFiles as source of truth
      const pfFiles = await new Promise<ManagedFile[]>((resolve) => {
        const unsub = subscribeToProjectFiles(project.id, undefined, ({ files: f }) => {
          unsub();
          resolve(f);
        });
      });
      const pfUrlSet = new Set(pfFiles.filter(f => f.storageUrl).map(f => f.storageUrl));
      const hasPf = pfUrlSet.size > 0;

      const fileMap: Record<string, BrowsableFile[]> = {};

      for (const item of projectItems) {
        try {
          await new Promise<void>((resolve) => {
            const unsub = subscribeToDeliverables(project.id, item.id, (deliverables: Deliverable[]) => {
              let workshopFiles = deliverables.filter(
                (d: Deliverable) => WORKSHOP_FILES_RE.test(d.fileName || d.name || '') && d.storageUrl,
              );
              if (hasPf) {
                workshopFiles = workshopFiles.filter((d: Deliverable) => pfUrlSet.has(d.storageUrl));
              }
              if (workshopFiles.length > 0) {
                fileMap[item.id] = workshopFiles.map((d: Deliverable) => ({
                  id: d.id,
                  fileName: d.fileName || d.name || '',
                  storageUrl: d.storageUrl,
                  itemId: item.id,
                  itemName: item.name || (item as unknown as Record<string, unknown>).itemCode as string || '',
                  isCsv: CSV_RE.test(d.fileName || d.name || ''),
                }));
              }
              unsub();
              resolve();
            });
          });
        } catch {
          // Skip items with no deliverables
        }
      }

      setFiles(fileMap);
    } catch (err) {
      console.warn('[useProjectBrowser] Failed to load items:', err);
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  const loadFile = useCallback(async (file: BrowsableFile): Promise<{ file: File; context: ProjectContext | null }> => {
    const resp = await fetch(file.storageUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const blob = await resp.blob();
    const loadedFile = new File([blob], file.fileName, { type: blob.type });

    // Resolve project context
    let context: ProjectContext | null = null;
    if (selectedProject) {
      context = await resolveFromDesignItem(selectedProject.id, file.itemId);
    }

    return { file: loadedFile, context };
  }, [selectedProject]);

  const reset = useCallback(() => {
    setSelectedProject(null);
    setItems([]);
    setFiles({});
  }, []);

  return {
    projects,
    selectedProject,
    items,
    files,
    loading,
    loadingFiles,
    openBrowser,
    selectProject,
    loadFile,
    reset,
  };
}
