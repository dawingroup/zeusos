/**
 * ViewerActionBar — Persistent toolbar above viewport when model is loaded
 *
 * Shows model context, quick actions (add model, reference image, browse files),
 * save status indicator, and export button.
 */

import { useRef, useCallback } from 'react';
import { Upload, Image, FolderOpen, Printer, Link2, Save, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import type { MeshCutListLink, ProjectContext } from '../types/workshop-viewer.types';
import type { SaveStatus } from '../hooks/useAutoSave';

interface ViewerActionBarProps {
  modelFileName?: string;
  csvFileName?: string;
  meshLinks: MeshCutListLink[];
  projectContext: ProjectContext | null;
  onExportPdf: () => void;
  hasModel: boolean;
  saveStatus: SaveStatus;
  onAddModel: (file: File) => void;
  onAddCsv: (file: File) => void;
  onGenerateFromImage: () => void;
  onBrowseFiles: () => void;
}

const SAVE_STATUS_CONFIG: Record<SaveStatus, { icon: typeof Save; label: string; color: string }> = {
  idle: { icon: Save, label: '', color: 'text-muted-foreground' },
  saving: { icon: Loader2, label: 'Saving...', color: 'text-amber-500' },
  saved: { icon: Check, label: 'Saved', color: 'text-green-500' },
  error: { icon: AlertCircle, label: 'Save failed', color: 'text-red-500' },
};

export default function ViewerActionBar({
  modelFileName,
  csvFileName,
  meshLinks,
  projectContext,
  onExportPdf,
  hasModel,
  saveStatus,
  onAddModel,
  onAddCsv,
  onGenerateFromImage,
  onBrowseFiles,
}: ViewerActionBarProps) {
  const modelInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const totalMeshes = meshLinks.length;
  const linkedCount = meshLinks.filter(l => l.confidence !== 'unmatched').length;

  const statusCfg = SAVE_STATUS_CONFIG[saveStatus];
  const StatusIcon = statusCfg.icon;

  const handleModelInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onAddModel(file);
    e.target.value = '';
  }, [onAddModel]);

  const handleCsvInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onAddCsv(file);
    e.target.value = '';
  }, [onAddCsv]);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white text-xs">
      {/* Left: Model info */}
      <span className="font-semibold tracking-wide text-sm shrink-0">DAWIN Workshop</span>

      {projectContext?.designItemName && (
        <Badge variant="outline" className="text-[10px] border-white/20 text-slate-300 shrink-0">
          {projectContext.designItemName}
        </Badge>
      )}

      {modelFileName && (
        <span className="text-slate-400 truncate max-w-[150px]">{modelFileName}</span>
      )}
      {csvFileName && (
        <span className="text-slate-400 truncate max-w-[100px]">+ {csvFileName}</span>
      )}

      {totalMeshes > 0 && (
        <Badge
          variant="outline"
          className={`text-[10px] border-white/20 shrink-0 ${
            linkedCount === totalMeshes ? 'text-green-300' : linkedCount > 0 ? 'text-yellow-300' : 'text-red-300'
          }`}
        >
          <Link2 className="w-3 h-3 mr-0.5" />
          {linkedCount}/{totalMeshes}
        </Badge>
      )}

      <div className="flex-1" />

      {/* Center: Quick actions */}
      <div className="flex items-center gap-1 relative">
        <button
          onClick={() => modelInputRef.current?.click()}
          className="px-2 py-1 rounded hover:bg-white/10 transition-colors flex items-center gap-1 text-slate-300 hover:text-white"
          title="Add or replace model file"
        >
          <Upload className="h-3 w-3" />
          <span className="hidden sm:inline">Add Model</span>
        </button>
        <input ref={modelInputRef} type="file" accept=".3ds,.dxf,.glb,.gltf,.obj" onChange={handleModelInput} className="hidden" />

        <button
          onClick={onGenerateFromImage}
          className="px-2 py-1 rounded hover:bg-white/10 transition-colors flex items-center gap-1 text-slate-300 hover:text-white"
          title="Generate 3D from reference image"
        >
          <Image className="h-3 w-3" />
          <span className="hidden sm:inline">Reference Image</span>
        </button>

        <button
          onClick={onBrowseFiles}
          className="px-2 py-1 rounded hover:bg-white/10 transition-colors flex items-center gap-1 text-slate-300 hover:text-white"
          title="Browse project files"
        >
          <FolderOpen className="h-3 w-3" />
          <span className="hidden sm:inline">Project Files</span>
        </button>

        {!csvFileName && (
          <>
            <button
              onClick={() => csvInputRef.current?.click()}
              className="px-2 py-1 rounded hover:bg-white/10 transition-colors text-slate-300 hover:text-white"
              title="Add CSV cut list"
            >
              + CSV
            </button>
            <input ref={csvInputRef} type="file" accept=".csv" onChange={handleCsvInput} className="hidden" />
          </>
        )}
      </div>

      {/* Right: Save status + Export */}
      <div className="flex items-center gap-2 shrink-0">
        {saveStatus !== 'idle' && (
          <span className={`flex items-center gap-1 text-[10px] ${statusCfg.color}`}>
            <StatusIcon className={`h-3 w-3 ${saveStatus === 'saving' ? 'animate-spin' : ''}`} />
            {statusCfg.label}
          </span>
        )}

        <Button
          variant="secondary"
          size="sm"
          className="text-xs h-7"
          disabled={!hasModel}
          onClick={onExportPdf}
        >
          <Printer className="w-3 h-3 mr-1" />
          PDF
        </Button>
      </div>
    </div>
  );
}
