/**
 * EntryHub — 3-card landing page for the Workshop Viewer
 *
 * Shows three entry paths: Upload Model, Browse Projects, Generate from Image.
 * Below the cards, shows Recent Sessions for resuming previous work.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, FolderOpen, Wand2, Clock, ChevronRight, ArrowLeft, FileType, Image, Loader2, Layout } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProjectBrowser, type BrowsableFile } from '../hooks/useProjectBrowser';
import { listRecentSessions } from '../services/workshopViewerService';
import { useAuth } from '@/shared/hooks/useAuth';
import type { ViewerSession, ProjectContext } from '../types/workshop-viewer.types';

const MODEL_EXTENSIONS = ['.3ds', '.dxf', '.glb', '.gltf', '.obj'];
const CSV_EXTENSION = '.csv';
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 50 * 1024 * 1024;

interface EntryHubProps {
  onModelFile: (file: File) => void;
  onMultipleModelFiles?: (files: File[]) => void;
  onCsvFile: (file: File) => void;
  onProjectContextChange?: (ctx: ProjectContext | null) => void;
  onGenerateFromImage: (file: File, dimensions?: { width: number; depth: number; height: number }) => Promise<void>;
  onResumeSession: (sessionId: string) => void;
}

type ActiveCard = null | 'upload' | 'projects' | 'generate';

export default function EntryHub({
  onModelFile,
  onMultipleModelFiles: _onMultipleModelFiles,
  onCsvFile,
  onProjectContextChange,
  onGenerateFromImage,
  onResumeSession,
}: EntryHubProps) {
  const { user } = useAuth();
  const [activeCard, setActiveCard] = useState<ActiveCard>(null);
  const [recentSessions, setRecentSessions] = useState<ViewerSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Load recent sessions
  useEffect(() => {
    if (!user?.uid) return;
    setLoadingSessions(true);
    listRecentSessions(user.uid, 5)
      .then(setRecentSessions)
      .catch(() => setRecentSessions([]))
      .finally(() => setLoadingSessions(false));
  }, [user?.uid]);

  // Top-level card selection (null = show all 3 cards)
  if (activeCard === 'upload') return <UploadCard onBack={() => setActiveCard(null)} onModelFile={onModelFile} onCsvFile={onCsvFile} />;
  if (activeCard === 'projects') return <ProjectsCard onBack={() => setActiveCard(null)} onModelFile={onModelFile} onCsvFile={onCsvFile} onProjectContextChange={onProjectContextChange} />;
  if (activeCard === 'generate') return <GenerateCard onBack={() => setActiveCard(null)} onGenerate={onGenerateFromImage} />;

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 overflow-auto">
      <div className="max-w-3xl w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-lg font-semibold text-foreground">Design Studio</h2>
          <p className="text-sm text-muted-foreground mt-1">Choose how to start working</p>
        </div>

        {/* Entry cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <EntryCard
            icon={Upload}
            title="Upload Model"
            description="Drop a 3DS, DXF, or GLB file from your computer"
            onClick={() => setActiveCard('upload')}
            color="blue"
          />
          <EntryCard
            icon={FolderOpen}
            title="Browse Projects"
            description="Select from existing design projects and items"
            onClick={() => setActiveCard('projects')}
            color="emerald"
          />
          <EntryCard
            icon={Wand2}
            title="Generate from Image"
            description="Upload a reference photo to create a 3D concept"
            onClick={() => setActiveCard('generate')}
            color="purple"
          />
          <SceneEntryCard />
        </div>

        {/* Recent Sessions */}
        {!loadingSessions && recentSessions.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-muted-foreground">Recent Sessions</h3>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {recentSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => onResumeSession(session.id)}
                  className="flex-shrink-0 w-48 border rounded-lg p-3 text-left hover:border-primary/50 hover:bg-muted/20 transition-colors"
                >
                  <div className="text-xs font-medium truncate">{session.name || 'Untitled'}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {session.linkedDesignItemId ? 'Design Item' : session.linkedMoId ? 'Manufacturing Order' : 'Upload'}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {session.updatedAt?.toDate?.()?.toLocaleDateString?.() || ''}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Entry Card
// ============================================================================

function EntryCard({ icon: Icon, title, description, onClick, color }: {
  icon: typeof Upload;
  title: string;
  description: string;
  onClick: () => void;
  color: 'blue' | 'emerald' | 'purple';
}) {
  const colorClasses = {
    blue: 'hover:border-blue-400 group-hover:text-blue-600',
    emerald: 'hover:border-emerald-400 group-hover:text-emerald-600',
    purple: 'hover:border-purple-400 group-hover:text-purple-600',
  };
  const iconColors = {
    blue: 'text-blue-500',
    emerald: 'text-emerald-500',
    purple: 'text-purple-500',
  };

  return (
    <button
      onClick={onClick}
      className={`group flex flex-col items-center gap-3 p-6 border-2 border-dashed rounded-xl transition-all hover:bg-muted/20 ${colorClasses[color]}`}
    >
      <div className={`p-3 rounded-full bg-muted/30 ${iconColors[color]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="text-center">
        <div className="font-medium text-sm">{title}</div>
        <div className="text-xs text-muted-foreground mt-1">{description}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// ============================================================================
// Scene Entry Card — navigates to /workshop/scenes
// ============================================================================

function SceneEntryCard() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate('/workshop/scenes')}
      className="group flex flex-col items-center gap-3 p-6 border-2 border-dashed rounded-xl transition-all hover:bg-muted/20 hover:border-amber-400"
    >
      <div className="p-3 rounded-full bg-muted/30 text-amber-500">
        <Layout className="h-6 w-6" />
      </div>
      <div className="text-center">
        <div className="font-medium text-sm">Compose Scene</div>
        <div className="text-xs text-muted-foreground mt-1">Arrange multiple cabinets into a project scene</div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// ============================================================================
// Upload Card (expanded)
// ============================================================================

function UploadCard({ onBack, onModelFile, onCsvFile }: {
  onBack: () => void;
  onModelFile: (file: File) => void;
  onCsvFile: (file: File) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((fileList: FileList) => {
    setError(null);
    for (const file of Array.from(fileList)) {
      if (file.size > MAX_FILE_SIZE) { setError(`${file.name} exceeds 50MB limit`); continue; }
      const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
      if (ext === CSV_EXTENSION) { onCsvFile(file); }
      else if (MODEL_EXTENSIONS.includes(ext)) { onModelFile(file); }
      else { setError(`Unsupported format: ${ext}`); }
    }
  }, [onModelFile, onCsvFile]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-6">
      <div className="max-w-md w-full">
        <button onClick={onBack} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-3 w-3" /> Back
        </button>
        <div
          onDrop={(e) => { e.preventDefault(); setIsDragOver(false); handleFiles(e.dataTransfer.files); }}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
            isDragOver ? 'border-blue-400 bg-blue-50/50' : 'border-border hover:border-blue-300 hover:bg-muted/10'
          }`}
        >
          <Upload className="h-10 w-10 mx-auto mb-3 text-blue-500" />
          <div className="font-medium">Drop files here or click to browse</div>
          <div className="text-xs text-muted-foreground mt-2">
            3DS, DXF, GLB, OBJ models + CSV cut lists (max 50MB)
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".3ds,.dxf,.glb,.gltf,.obj,.csv"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            className="hidden"
          />
        </div>
        {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
      </div>
    </div>
  );
}

// ============================================================================
// Projects Card (expanded)
// ============================================================================

function ProjectsCard({ onBack, onModelFile, onCsvFile, onProjectContextChange }: {
  onBack: () => void;
  onModelFile: (file: File) => void;
  onCsvFile: (file: File) => void;
  onProjectContextChange?: (ctx: ProjectContext | null) => void;
}) {
  const browser = useProjectBrowser();
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);

  useEffect(() => { browser.openBrowser(); }, []);

  const handleLoadFile = useCallback(async (file: BrowsableFile) => {
    setLoadingFileId(file.id);
    try {
      const result = await browser.loadFile(file);
      if (result.context && onProjectContextChange) onProjectContextChange(result.context);
      if (file.isCsv) onCsvFile(result.file);
      else onModelFile(result.file);
    } catch (err) {
      console.error('Failed to load file:', err);
    } finally {
      setLoadingFileId(null);
    }
  }, [browser, onModelFile, onCsvFile, onProjectContextChange]);

  return (
    <div className="flex flex-col h-full p-4 overflow-auto">
      <button onClick={() => browser.selectedProject ? browser.reset() : onBack()} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 shrink-0">
        <ArrowLeft className="h-3 w-3" /> {browser.selectedProject ? 'Back to projects' : 'Back'}
      </button>

      {!browser.selectedProject ? (
        /* Project list */
        <div className="space-y-1.5">
          <div className="text-sm font-medium mb-2">Design Projects</div>
          {browser.loading ? (
            <div className="text-center py-8 text-muted-foreground text-sm"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-1" /> Loading projects...</div>
          ) : browser.projects.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">No active projects found</div>
          ) : (
            browser.projects.map((p) => (
              <button
                key={p.id}
                onClick={() => browser.selectProject(p)}
                className="w-full text-left px-3 py-2 rounded-lg border hover:border-primary/50 hover:bg-muted/20 transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="text-sm font-medium">{p.name || p.code || p.id}</div>
                  <div className="text-xs text-muted-foreground">{p.code}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))
          )}
        </div>
      ) : (
        /* Item/file list */
        <div className="space-y-2">
          <div className="text-sm font-medium">{browser.selectedProject.name}</div>
          {browser.loadingFiles ? (
            <div className="text-center py-8 text-muted-foreground text-sm"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-1" /> Loading files...</div>
          ) : Object.keys(browser.files).length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">No workshop files found in this project</div>
          ) : (
            browser.items.filter(item => browser.files[item.id]?.length > 0).map((item) => (
              <div key={item.id} className="border rounded-lg overflow-hidden">
                <div className="px-3 py-1.5 bg-muted/20 text-xs font-medium">{item.name || (item as unknown as Record<string, unknown>).itemCode as string || item.id}</div>
                <div className="divide-y">
                  {browser.files[item.id]?.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => handleLoadFile(file)}
                      disabled={loadingFileId === file.id}
                      className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-muted/10 transition-colors text-xs disabled:opacity-50"
                    >
                      <FileType className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{file.fileName}</span>
                      {loadingFileId === file.id ? (
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">{file.isCsv ? 'CSV' : '3D'}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Generate Card (expanded)
// ============================================================================

function GenerateCard({ onBack, onGenerate }: {
  onBack: () => void;
  onGenerate: (file: File, dimensions?: { width: number; depth: number; height: number }) => Promise<void>;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [width, setWidth] = useState('');
  const [depth, setDepth] = useState('');
  const [height, setHeight] = useState('');
  const [generating, setGenerating] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!IMAGE_TYPES.includes(file.type)) { return; }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!selectedFile) return;
    setGenerating(true);
    try {
      const dims = width && depth && height
        ? { width: parseFloat(width), depth: parseFloat(depth), height: parseFloat(height) }
        : undefined;
      await onGenerate(selectedFile, dims);
    } finally {
      setGenerating(false);
    }
  }, [selectedFile, width, depth, height, onGenerate]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-6">
      <div className="max-w-md w-full">
        <button onClick={onBack} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-3 w-3" /> Back
        </button>

        {!selectedFile ? (
          <div
            onDrop={(e) => { e.preventDefault(); setIsDragOver(false); e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]); }}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
              isDragOver ? 'border-purple-400 bg-purple-50/50' : 'border-border hover:border-purple-300 hover:bg-muted/10'
            }`}
          >
            <Image className="h-10 w-10 mx-auto mb-3 text-purple-500" />
            <div className="font-medium">Drop a reference image</div>
            <div className="text-xs text-muted-foreground mt-2">Photo, sketch, or screenshot (JPG, PNG, WebP)</div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="hidden"
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative border rounded-xl overflow-hidden">
              <img src={previewUrl!} alt="Reference" className="w-full aspect-video object-contain bg-gray-50" />
              <button onClick={() => { setSelectedFile(null); if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }} className="absolute top-2 right-2 px-2 py-1 rounded bg-background/80 text-xs hover:bg-background">Change</button>
            </div>

            <div>
              <div className="text-xs font-medium mb-1.5">Target Dimensions (optional, mm)</div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">Width</label>
                  <input type="number" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="2400" className="w-full px-2 py-1.5 text-sm border rounded" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Depth</label>
                  <input type="number" value={depth} onChange={(e) => setDepth(e.target.value)} placeholder="900" className="w-full px-2 py-1.5 text-sm border rounded" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Height</label>
                  <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="850" className="w-full px-2 py-1.5 text-sm border rounded" />
                </div>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full py-2.5 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {generating ? 'Generating 3D Model...' : 'Generate 3D Model'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
