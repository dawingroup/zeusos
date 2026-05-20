/**
 * ProjectBrowserPanel — Browse design projects, items, and their workshop files
 */

import { useState, useCallback, useMemo } from 'react';
import { Search, X, ChevronRight, Download } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Skeleton } from '@/core/components/ui/skeleton';
import { ScrollArea } from '@/core/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/core/components/ui/tooltip';
import { getProjects, getDesignItems, subscribeToDeliverables } from '@/modules/design-manager/services';
import { subscribeToProjectFiles } from '@/shared/services/fileManager/fileManagerService';
import type { Deliverable, DesignProject, DesignItem } from '@/modules/design-manager/types';
import type { ManagedFile } from '@/shared/services/fileManager/types';
import type { ProjectContext } from '../types/workshop-viewer.types';
import { resolveFromDesignItem } from '../services/projectContextService';
import FileTypeIndicator, { formatFileSize, getFileExtension } from './FileTypeIndicator';

const WORKSHOP_FILES_RE = /\.(3ds|dxf|obj|fbx|skp|csv)$/i;
const CSV_EXTENSION_RE = /\.csv$/i;

interface ProjectBrowserPanelProps {
  onFileLoaded: (file: File, isCsv: boolean) => void;
  onCsvFile: (file: File) => void;
  onProjectContextChange?: (ctx: ProjectContext | null) => void;
  onClose: () => void;
}

export default function ProjectBrowserPanel({
  onFileLoaded,
  onCsvFile,
  onProjectContextChange,
  onClose,
}: ProjectBrowserPanelProps) {
  const [projects, setProjects] = useState<DesignProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<DesignProject | null>(null);
  const [projectItems, setProjectItems] = useState<DesignItem[]>([]);
  const [itemDeliverables, setItemDeliverables] = useState<Record<string, Deliverable[]>>({});
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Load projects on mount
  useState(() => {
    (async () => {
      try {
        const allProjects = await getProjects();
        setProjects(allProjects.filter(p => p.status === 'active' || !p.status));
      } catch (err) {
        console.warn('Failed to load projects:', err);
      } finally {
        setLoadingProjects(false);
      }
    })();
  });

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(
      p => (p.name || '').toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q)
    );
  }, [projects, searchQuery]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return projectItems;
    const q = searchQuery.toLowerCase();
    return projectItems.filter(
      i => (i.name || '').toLowerCase().includes(q) || ((i as unknown as Record<string, unknown>).itemCode as string || '').toLowerCase().includes(q)
    );
  }, [projectItems, searchQuery]);

  const handleSelectProject = useCallback(async (project: DesignProject) => {
    setSelectedProject(project);
    setLoadingItems(true);
    setItemDeliverables({});
    setSearchQuery('');
    try {
      const items = await getDesignItems(project.id);
      setProjectItems(items);

      // Build a set of valid storageUrls from projectFiles (source of truth)
      const pfFiles = await new Promise<ManagedFile[]>((resolve) => {
        const unsub = subscribeToProjectFiles(project.id, undefined, ({ files }) => {
          unsub();
          resolve(files);
        });
      });
      const pfUrlSet = new Set(pfFiles.filter(f => f.storageUrl).map(f => f.storageUrl));
      const hasPf = pfUrlSet.size > 0;

      // Fetch deliverables for each item, filtered against projectFiles
      const delivMap: Record<string, Deliverable[]> = {};
      for (const item of items) {
        try {
          await new Promise<void>((resolve) => {
            const unsub = subscribeToDeliverables(project.id, item.id, (deliverables) => {
              let workshopFiles = deliverables.filter(
                (d) => WORKSHOP_FILES_RE.test(d.fileName || d.name || '') && d.storageUrl,
              );
              if (hasPf) {
                workshopFiles = workshopFiles.filter(d => pfUrlSet.has(d.storageUrl));
              }
              if (workshopFiles.length > 0) {
                delivMap[item.id] = workshopFiles;
              }
              unsub();
              resolve();
            });
          });
        } catch {
          // Skip items with no deliverables
        }
      }

      // Add non-mirrored projectFiles entries not matched to any deliverable
      if (hasPf) {
        const allDelivUrls = new Set(Object.values(delivMap).flat().map(d => d.storageUrl));
        const unmatchedPf = pfFiles.filter(f => {
          if (!WORKSHOP_FILES_RE.test(f.fileName || f.name || '') || !f.storageUrl) return false;
          if (allDelivUrls.has(f.storageUrl)) return false;
          const fAny = f as unknown as Record<string, unknown>;
          if (fAny._sourceId && fAny._sourceCollection === 'deliverables') return false;
          return true;
        });
        if (unmatchedPf.length > 0) {
          const mapped = unmatchedPf.map(f => ({
            id: f.id,
            name: f.name,
            fileName: f.fileName,
            storageUrl: f.storageUrl,
            storagePath: f.storagePath,
            fileSize: f.fileSize,
            mimeType: f.mimeType,
            uploadedAt: f.uploadedAt,
            uploadedBy: f.uploadedBy,
          } as unknown as Deliverable));
          for (const pf of unmatchedPf) {
            const key = pf.itemId || '_project-files';
            if (!delivMap[key]) delivMap[key] = [];
            delivMap[key].push(mapped.find(m => m.id === pf.id)!);
          }
        }
      }

      setItemDeliverables(delivMap);
    } catch (err) {
      console.warn('Failed to load items:', err);
    } finally {
      setLoadingItems(false);
    }
  }, []);

  const handleLoadFile = useCallback(async (
    project: DesignProject,
    item: DesignItem,
    deliverable: Deliverable,
  ) => {
    setLoadingFileId(deliverable.id);
    setError(null);
    const displayName = deliverable.fileName || deliverable.name || 'model';
    const isCsv = CSV_EXTENSION_RE.test(displayName);
    try {
      // Set project context
      const ctx = await resolveFromDesignItem(project.id, item.id);
      if (ctx && onProjectContextChange) {
        onProjectContextChange(ctx);
      }

      const resp = await fetch(deliverable.storageUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      if (isCsv) {
        const text = await resp.text();
        const blob = new Blob([text], { type: 'text/csv' });
        const file = new File([blob], displayName, { type: 'text/csv' });
        onFileLoaded(file, true);
      } else {
        const blob = await resp.blob();
        const file = new File([blob], displayName, { type: blob.type });
        onFileLoaded(file, false);

        // Auto-load CSV cut list from the same design item if available
        if (ctx?.csvFileUrls?.length) {
          try {
            const csvInfo = ctx.csvFileUrls[0];
            const csvResp = await fetch(csvInfo.storageUrl);
            if (csvResp.ok) {
              const csvText = await csvResp.text();
              const csvBlob = new Blob([csvText], { type: 'text/csv' });
              const csvFile = new File([csvBlob], csvInfo.fileName, { type: 'text/csv' });
              onCsvFile(csvFile);
            }
          } catch (csvErr) {
            console.warn('Auto-load CSV failed:', csvErr);
          }
        }
      }
      onClose();
    } catch (err) {
      setError(`Failed to load ${displayName}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoadingFileId(null);
    }
  }, [onFileLoaded, onCsvFile, onProjectContextChange, onClose]);

  const formatDate = (ts?: { seconds: number } | null) => {
    if (!ts) return '';
    const d = new Date(ts.seconds * 1000);
    const now = Date.now();
    const diffDays = Math.floor((now - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="border rounded-lg overflow-hidden">
        {/* Header with breadcrumb */}
        <div className="flex items-center gap-2 px-3 py-2 bg-muted border-b">
          {selectedProject ? (
            <>
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => { setSelectedProject(null); setProjectItems([]); setItemDeliverables({}); setSearchQuery(''); }}
              >
                Projects
              </button>
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground truncate">
                {selectedProject.name}
              </span>
            </>
          ) : (
            <span className="text-xs font-medium text-foreground">Design Projects</span>
          )}
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={onClose}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder={selectedProject ? 'Search items...' : 'Search projects...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 pl-7 text-xs"
            />
          </div>
        </div>

        {/* Loading skeletons */}
        {(loadingProjects || loadingItems) && (
          <div className="p-3 space-y-2">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-10 w-full rounded" />
            ))}
          </div>
        )}

        {/* Project List */}
        {!selectedProject && !loadingProjects && (
          <ScrollArea className="max-h-80">
            {filteredProjects.length === 0 && (
              <div className="text-xs text-muted-foreground py-6 text-center">
                {searchQuery ? 'No matching projects' : 'No active projects'}
              </div>
            )}
            <div className="divide-y">
              {filteredProjects.map((p) => (
                <button
                  key={p.id}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                  onClick={() => handleSelectProject(p)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
                    {p.code && <p className="text-[10px] text-muted-foreground">{p.code}</p>}
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
                </button>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Item List with Files */}
        {selectedProject && !loadingItems && (
          <ScrollArea className="max-h-96">
            {filteredItems.length === 0 && (
              <div className="text-xs text-muted-foreground py-6 text-center">
                {searchQuery ? 'No matching items' : 'No design items'}
              </div>
            )}
            <div className="divide-y">
              {filteredItems.map((item) => {
                const files = itemDeliverables[item.id] || [];
                return (
                  <div key={item.id} className="px-3 py-2">
                    <p className="text-xs font-medium text-foreground truncate">
                      {item.name || (item as unknown as Record<string, unknown>).itemCode as string || 'Untitled Item'}
                    </p>
                    {files.length > 0 ? (
                      <div className="mt-1.5 space-y-0.5">
                        {files.map((d) => {
                          const fileName = d.fileName || d.name || '';
                          const isCsv = CSV_EXTENSION_RE.test(fileName);
                          const size = (d as unknown as Record<string, unknown>).fileSize as number | undefined;
                          return (
                            <Tooltip key={d.id}>
                              <TooltipTrigger asChild>
                                <button
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-primary/5 transition-colors text-left"
                                  disabled={loadingFileId === d.id}
                                  onClick={() => handleLoadFile(selectedProject, item, d)}
                                >
                                  <FileTypeIndicator fileName={fileName} iconSize="w-3.5 h-3.5" showBadge={false} />
                                  <span className="text-xs text-foreground truncate flex-1">{fileName}</span>
                                  {size && (
                                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                                      {formatFileSize(size)}
                                    </span>
                                  )}
                                  {loadingFileId === d.id ? (
                                    <span className="text-[10px] text-muted-foreground animate-pulse">Loading...</span>
                                  ) : (
                                    <Download className="w-3 h-3 text-primary/60 flex-shrink-0" />
                                  )}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="left">
                                <p className="font-medium">{fileName}</p>
                                <p className="text-muted-foreground">
                                  {isCsv ? 'CSV Cut List' : `${getFileExtension(fileName).slice(1).toUpperCase()} Model`}
                                  {size ? ` · ${formatFileSize(size)}` : ''}
                                  {d.uploadedAt ? ` · ${formatDate(d.uploadedAt as { seconds: number })}` : ''}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground mt-0.5">No workshop files</p>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {error && (
          <div className="px-3 py-2 text-xs text-red-500 border-t">{error}</div>
        )}
      </div>
    </TooltipProvider>
  );
}
