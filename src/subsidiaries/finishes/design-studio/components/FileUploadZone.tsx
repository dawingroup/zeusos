/**
 * FileUploadZone — Drag-and-drop upload for .3ds/.dxf/.csv files
 * Also supports browsing existing design files when linked to a design item.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, FileType, CheckCircle, FolderOpen, Download, ChevronRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { getProjects, getDesignItems, subscribeToDeliverables } from '@/modules/design-manager/services';
import type { Deliverable, DesignProject, DesignItem } from '@/modules/design-manager/types';
import type { ProjectContext, ProjectModelFile } from '../types/workshop-viewer.types';
import { resolveProjectModels, resolveFromDesignItem } from '../services/projectContextService';
import { subscribeToProjectFiles } from '@/shared/services/fileManager/fileManagerService';
import type { ManagedFile } from '@/shared/services/fileManager/types';

const ACCEPTED_EXTENSIONS = ['.3ds', '.dxf', '.csv'];
const CSV_EXTENSION_RE = /\.csv$/i;
const WORKSHOP_FILES_RE = /\.(3ds|dxf|obj|fbx|skp|csv)$/i;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface FileUploadZoneProps {
  onModelFile: (file: File) => void;
  onMultipleModelFiles?: (files: File[]) => void;
  onCsvFile: (file: File) => void;
  modelFileName?: string;
  csvFileName?: string;
  projectContext?: ProjectContext | null;
  onProjectContextChange?: (ctx: ProjectContext | null) => void;
}

export default function FileUploadZone({
  onModelFile,
  onMultipleModelFiles,
  onCsvFile,
  modelFileName,
  csvFileName,
  projectContext,
  onProjectContextChange,
}: FileUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [designFiles, setDesignFiles] = useState<Deliverable[]>([]);
  const [projectModels, setProjectModels] = useState<ProjectModelFile[]>([]);
  const [selectedModelUrls, setSelectedModelUrls] = useState<Set<string>>(new Set());
  const [loadingDesignFiles, setLoadingDesignFiles] = useState(false);
  const [loadingProjectModels, setLoadingProjectModels] = useState(false);
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);
  const [loadingCombined, setLoadingCombined] = useState(false);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Standalone project browser state (when no projectContext from URL)
  const [showProjectBrowser, setShowProjectBrowser] = useState(false);
  const [projects, setProjects] = useState<DesignProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<DesignProject | null>(null);
  const [projectItems, setProjectItems] = useState<DesignItem[]>([]);
  const [itemDeliverables, setItemDeliverables] = useState<Record<string, Deliverable[]>>({});
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  // Subscribe to design item deliverables (real-time) when linked
  // Merges from both deliverables subcollection and projectFiles collection
  useEffect(() => {
    if (!projectContext?.designItemId || !projectContext?.projectId) return;

    setLoadingDesignFiles(true);
    let delivResults: Deliverable[] = [];
    let pfResults: Deliverable[] = [];
    let delivLoaded = false;
    let pfLoaded = false;

    const mergeAndSet = () => {
      if (!delivLoaded || !pfLoaded) return;
      // Cross-reference both collections to filter out orphans in either direction:
      // 1. Deliverables deleted from UFM → projectFiles entry removed, deliverable still exists → filter out
      // 2. Deliverables deleted from design-manager → deliverable gone, projectFiles mirror remains → filter out
      const pfUrls = new Set(pfResults.map(pf => pf.storageUrl));
      const delivUrls = new Set(delivResults.map(d => d.storageUrl));
      const hasProjectFiles = pfResults.length > 0;

      let merged: Deliverable[];
      if (hasProjectFiles) {
        // Only show deliverables that still exist in projectFiles (handles UFM deletions)
        const validDeliverables = delivResults.filter(d => pfUrls.has(d.storageUrl));
        const validDelivUrls = new Set(validDeliverables.map(d => d.storageUrl));
        merged = [...validDeliverables];
        // Add projectFiles entries not in deliverables — but only if the source deliverable
        // was never expected (no _sourceId) or if it still exists in deliverables
        for (const pf of pfResults) {
          if (validDelivUrls.has(pf.storageUrl)) continue;
          // If this pf entry is a mirror of a deliverable that no longer exists, skip it
          const pfAny = pf as unknown as Record<string, unknown>;
          if (pfAny._sourceId && pfAny._sourceCollection === 'deliverables' && !delivUrls.has(pf.storageUrl)) continue;
          merged.push(pf);
        }
      } else {
        // No projectFiles yet — fall back to deliverables only
        merged = [...delivResults];
      }
      setDesignFiles(merged);
      setLoadingDesignFiles(false);
    };

    const unsubDeliv = subscribeToDeliverables(
      projectContext.projectId,
      projectContext.designItemId,
      (deliverables) => {
        delivResults = deliverables.filter(
          (d) => WORKSHOP_FILES_RE.test(d.fileName || d.name || '') && d.storageUrl,
        );
        delivLoaded = true;
        mergeAndSet();
      },
    );

    const unsubPf = subscribeToProjectFiles(
      projectContext.projectId,
      { itemId: projectContext.designItemId },
      ({ files }) => {
        pfResults = files
          .filter((f) => WORKSHOP_FILES_RE.test(f.fileName || f.name || '') && f.storageUrl)
          .map((f) => ({
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
        pfLoaded = true;
        mergeAndSet();
      },
    );

    return () => {
      unsubDeliv();
      unsubPf();
    };
  }, [projectContext?.designItemId, projectContext?.projectId]);

  // Fetch all 3D models across project items (for multi-model picker)
  useEffect(() => {
    if (!projectContext?.projectId || projectContext?.designItemId) return; // Only when project-level, not item-level
    setLoadingProjectModels(true);
    resolveProjectModels(projectContext.projectId)
      .then(setProjectModels)
      .catch((err) => console.warn('Failed to fetch project models:', err))
      .finally(() => setLoadingProjectModels(false));
  }, [projectContext?.projectId, projectContext?.designItemId]);

  const toggleModelSelection = useCallback((url: string) => {
    setSelectedModelUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }, []);

  const handleLoadSelectedModels = useCallback(async () => {
    if (selectedModelUrls.size === 0 || !onMultipleModelFiles) return;
    setLoadingCombined(true);
    setError(null);
    try {
      const files: File[] = [];
      for (const model of projectModels) {
        if (!selectedModelUrls.has(model.storageUrl)) continue;
        const resp = await fetch(model.storageUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${model.fileName}`);
        const blob = await resp.blob();
        files.push(new File([blob], model.fileName, { type: blob.type }));
      }
      onMultipleModelFiles(files);
    } catch (err) {
      setError(`Failed to load models: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoadingCombined(false);
    }
  }, [selectedModelUrls, projectModels, onMultipleModelFiles]);

  // Load projects when browser is opened
  const handleOpenProjectBrowser = useCallback(async () => {
    setShowProjectBrowser(true);
    setLoadingProjects(true);
    try {
      const allProjects = await getProjects();
      // Filter to active projects only
      setProjects(allProjects.filter(p => p.status === 'active' || !p.status));
    } catch (err) {
      console.warn('Failed to load projects:', err);
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  // Load items when project selected
  const handleSelectProject = useCallback(async (project: DesignProject) => {
    setSelectedProject(project);
    setLoadingItems(true);
    setItemDeliverables({});
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
              // If projectFiles has entries, only show deliverables still in projectFiles
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

      // Also add projectFiles entries not matched to any deliverable —
      // but skip orphaned mirrors whose source deliverable was deleted
      if (hasPf) {
        const allDelivUrls = new Set(Object.values(delivMap).flat().map(d => d.storageUrl));
        const unmatchedPf = pfFiles.filter(f => {
          if (!WORKSHOP_FILES_RE.test(f.fileName || f.name || '') || !f.storageUrl) return false;
          if (allDelivUrls.has(f.storageUrl)) return false;
          // Skip orphaned mirrors: has _sourceId pointing to a deliverable that no longer exists
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
          // Group by itemId or put under a generic key
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

  // Load a file from the project browser and set context
  const handleLoadFromBrowser = useCallback(async (
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

      // Fetch and load the file
      const resp = await fetch(deliverable.storageUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      if (isCsv) {
        // Route CSV files to the CSV handler
        const text = await resp.text();
        const blob = new Blob([text], { type: 'text/csv' });
        const file = new File([blob], displayName, { type: 'text/csv' });
        onCsvFile(file);
      } else {
        // Route model files to the model handler
        const blob = await resp.blob();
        const file = new File([blob], displayName, { type: blob.type });
        onModelFile(file);

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
      setShowProjectBrowser(false);
    } catch (err) {
      setError(`Failed to load ${displayName}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoadingFileId(null);
    }
  }, [onModelFile, onCsvFile, onProjectContextChange]);

  const processFile = useCallback((file: File) => {
    setError(null);
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setError(`Unsupported file type: ${ext}. Use .3ds, .dxf, or .csv`);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 50MB.`);
      return;
    }

    if (ext === '.3ds' || ext === '.dxf') {
      onModelFile(file);
    } else if (ext === '.csv') {
      onCsvFile(file);
    }
  }, [onModelFile, onCsvFile]);

  const handleLoadDesignFile = useCallback(async (entry: Deliverable) => {
    setLoadingFileId(entry.id);
    setError(null);
    const displayName = entry.fileName || entry.name || 'model';
    const isCsv = CSV_EXTENSION_RE.test(displayName);
    try {
      const resp = await fetch(entry.storageUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      if (isCsv) {
        const text = await resp.text();
        const blob = new Blob([text], { type: 'text/csv' });
        const file = new File([blob], displayName, { type: 'text/csv' });
        onCsvFile(file);
      } else {
        const blob = await resp.blob();
        const file = new File([blob], displayName, { type: blob.type });
        onModelFile(file);

        // Auto-load CSV cut list from the same design item if available
        if (projectContext?.csvFileUrls?.length) {
          try {
            const csvInfo = projectContext.csvFileUrls[0];
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
    } catch (err) {
      setError(`Failed to load ${displayName}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoadingFileId(null);
    }
  }, [onModelFile, onCsvFile, projectContext]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) processFile(file);
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>, _type: 'model' | 'csv') => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }, [processFile]);

  const formatDate = (ts?: { seconds: number } | null) => {
    if (!ts) return '';
    const d = new Date(ts.seconds * 1000);
    const now = Date.now();
    const diffMs = now - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString();
  };

  const hasModel = !!modelFileName;
  const hasCsv = !!csvFileName;

  if (hasModel) {
    // Compact status view when model is loaded
    return (
      <div className="flex items-center gap-3 px-3 py-2 bg-muted rounded-lg text-xs">
        <div className="flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5 text-green-600" />
          <span className="text-foreground">{modelFileName}</span>
        </div>
        {hasCsv && (
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-green-600" />
            <span className="text-foreground">{csvFileName}</span>
          </div>
        )}
        {!hasCsv && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs"
              onClick={() => csvInputRef.current?.click()}
            >
              Load CSV
            </Button>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => handleFileInput(e, 'csv')}
            />
          </>
        )}
      </div>
    );
  }

  // Full upload zone when no model loaded
  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div
        className={`w-full max-w-md border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
          isDragOver
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
        <p className="text-sm font-medium text-foreground mb-1">
          Drop PolyBoard files here
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          .3ds or .dxf model + .csv cut list
        </p>

        <div className="flex gap-2 justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => modelInputRef.current?.click()}
          >
            <FileType className="w-3.5 h-3.5 mr-1.5" />
            Load 3DS/DXF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => csvInputRef.current?.click()}
          >
            Load CSV
          </Button>
        </div>

        <input
          ref={modelInputRef}
          type="file"
          accept=".3ds,.dxf"
          className="hidden"
          onChange={(e) => handleFileInput(e, 'model')}
        />
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => handleFileInput(e, 'csv')}
        />
      </div>

      {/* Browse Design Projects — always available when no context from URL */}
      {!projectContext && !showProjectBrowser && (
        <div className="w-full max-w-md mt-4">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={handleOpenProjectBrowser}
          >
            <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
            Browse Design Projects
          </Button>
        </div>
      )}

      {/* Project Browser Panel */}
      {showProjectBrowser && !projectContext && (
        <div className="w-full max-w-md mt-4 border rounded-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2 bg-muted border-b">
            {selectedProject ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => { setSelectedProject(null); setProjectItems([]); setItemDeliverables({}); }}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </Button>
                <span className="text-xs font-medium text-foreground truncate">
                  {selectedProject.name}
                </span>
              </>
            ) : (
              <>
                <FolderOpen className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-foreground">Design Projects</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 ml-auto text-[10px] text-muted-foreground"
                  onClick={() => setShowProjectBrowser(false)}
                >
                  Close
                </Button>
              </>
            )}
          </div>

          {/* Loading */}
          {(loadingProjects || loadingItems) && (
            <div className="text-xs text-muted-foreground py-6 text-center">Loading...</div>
          )}

          {/* Project List */}
          {!selectedProject && !loadingProjects && (
            <div className="max-h-48 overflow-auto divide-y">
              {projects.length === 0 && (
                <div className="text-xs text-muted-foreground py-4 text-center">No active projects</div>
              )}
              {projects.map((p) => (
                <button
                  key={p.id}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-left"
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
          )}

          {/* Item List with Deliverables */}
          {selectedProject && !loadingItems && (
            <div className="max-h-64 overflow-auto divide-y">
              {projectItems.length === 0 && (
                <div className="text-xs text-muted-foreground py-4 text-center">No design items in this project</div>
              )}
              {projectItems.map((item) => {
                const files = itemDeliverables[item.id] || [];
                return (
                  <div key={item.id} className="px-3 py-2">
                    <p className="text-xs font-medium text-foreground truncate">
                      {item.name || (item as unknown as Record<string, unknown>).itemCode as string || 'Untitled Item'}
                    </p>
                    {files.length > 0 ? (
                      <div className="mt-1 space-y-1">
                        {files.map((d) => {
                          const fileName = d.fileName || d.name || '';
                          const isCsvFile = CSV_EXTENSION_RE.test(fileName);
                          return (
                            <button
                              key={d.id}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-primary/5 transition-colors text-left"
                              disabled={loadingFileId === d.id}
                              onClick={() => handleLoadFromBrowser(selectedProject, item, d)}
                            >
                              <FileType className={`w-3.5 h-3.5 flex-shrink-0 ${isCsvFile ? 'text-emerald-500' : 'text-primary'}`} />
                              <span className="text-xs text-foreground truncate flex-1">
                                {fileName}
                              </span>
                              {isCsvFile && (
                                <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 flex-shrink-0">CSV</span>
                              )}
                              {loadingFileId === d.id ? (
                                <span className="text-[10px] text-muted-foreground">Loading...</span>
                              ) : (
                                <Download className="w-3 h-3 text-primary/60 flex-shrink-0" />
                              )}
                            </button>
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
          )}
        </div>
      )}

      {/* Design Files Browser — shown when linked to a design item */}
      {projectContext?.designItemId && (
        <div className="w-full max-w-md mt-6">
          <div className="flex items-center gap-2 mb-2">
            <FolderOpen className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-foreground">
              Design Item Files
            </span>
            {projectContext.designItemName && (
              <span className="text-xs text-muted-foreground">
                ({projectContext.designItemName})
              </span>
            )}
          </div>

          {loadingDesignFiles && (
            <div className="text-xs text-muted-foreground py-3 text-center">Loading files...</div>
          )}

          {!loadingDesignFiles && designFiles.length === 0 && (
            <div className="text-xs text-muted-foreground py-3 text-center border rounded-lg">
              No workshop files found in this design item
            </div>
          )}

          {!loadingDesignFiles && designFiles.length > 0 && (
            <div className="border rounded-lg divide-y">
              {designFiles.map((entry) => {
                const entryName = entry.fileName || entry.name || '';
                const isCsvEntry = CSV_EXTENSION_RE.test(entryName);
                return (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted transition-colors"
                >
                  <FileType className={`w-4 h-4 flex-shrink-0 ${isCsvEntry ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium text-foreground truncate">
                        {entryName}
                      </p>
                      {isCsvEntry && (
                        <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 flex-shrink-0">CSV</span>
                      )}
                    </div>
                    {entry.uploadedAt && (
                      <p className="text-[10px] text-muted-foreground">
                        Uploaded {formatDate(entry.uploadedAt as { seconds: number })}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-primary hover:text-primary/80"
                    disabled={loadingFileId === entry.id}
                    onClick={() => handleLoadDesignFile(entry)}
                  >
                    {loadingFileId === entry.id ? (
                      <span className="animate-spin mr-1">...</span>
                    ) : (
                      <Download className="w-3.5 h-3.5 mr-1" />
                    )}
                    Load
                  </Button>
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Project Models Picker — shown when linked to a project (not specific item) */}
      {projectContext?.projectId && !projectContext?.designItemId && onMultipleModelFiles && (
        <div className="w-full max-w-md mt-6">
          <div className="flex items-center gap-2 mb-2">
            <FolderOpen className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-medium text-foreground">
              Project Models
            </span>
            {projectContext.projectName && (
              <span className="text-xs text-muted-foreground">
                ({projectContext.projectName})
              </span>
            )}
          </div>

          {loadingProjectModels && (
            <div className="text-xs text-muted-foreground py-3 text-center">Loading project models...</div>
          )}

          {!loadingProjectModels && projectModels.length === 0 && (
            <div className="text-xs text-muted-foreground py-3 text-center border rounded-lg">
              No 3D model files found in this project
            </div>
          )}

          {!loadingProjectModels && projectModels.length > 0 && (
            <div className="border rounded-lg">
              <div className="divide-y">
                {projectModels.map((m) => (
                  <label
                    key={`${m.itemId}-${m.fileName}`}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-muted transition-colors cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedModelUrls.has(m.storageUrl)}
                      onChange={() => toggleModelSelection(m.storageUrl)}
                      className="w-3.5 h-3.5 rounded border-border text-purple-600 focus:ring-purple-500"
                    />
                    <FileType className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {m.fileName}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {m.itemName}
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              {selectedModelUrls.size > 0 && (
                <div className="px-3 py-2 border-t bg-muted">
                  <Button
                    size="sm"
                    className="w-full h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                    disabled={loadingCombined}
                    onClick={handleLoadSelectedModels}
                  >
                    {loadingCombined ? 'Loading...' : `Load ${selectedModelUrls.size} Model${selectedModelUrls.size > 1 ? 's' : ''} (Combined)`}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 mt-3">{error}</p>
      )}
    </div>
  );
}
