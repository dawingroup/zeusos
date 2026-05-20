/**
 * ExportPanel — Export 3D models for external editing in Shapr3D or SketchUp
 *
 * Path A: Shapr3D — Download Parasolid X_T or STEP file
 * Path B: SketchUp — Push to Trimble Connect (future)
 */

import { useState, useCallback, useEffect } from 'react';
import { Download, ExternalLink, Box, Layers, RefreshCw, AlertCircle } from 'lucide-react';
import type { DesignRevision } from '../../types/designRevision.types';
import { checkTrimbleUpdates } from '../../services/trimbleConnectService';

interface ExportPanelProps {
  revision: DesignRevision | null;
  onExportShapr3D: (revisionId: string) => Promise<string | null>;
  onExportSketchUp?: (revisionId: string, projectName: string) => Promise<void>;
  onImportTrimbleUpdate?: (fileId: string, projectId: string) => Promise<void>;
  trimbleProjectId?: string;
  trimbleFileId?: string;
}

export default function ExportPanel({
  revision,
  onExportShapr3D,
  onExportSketchUp,
  onImportTrimbleUpdate,
  trimbleProjectId,
  trimbleFileId,
}: ExportPanelProps) {
  const [exporting, setExporting] = useState(false);
  const [exportingSketchUp, setExportingSketchUp] = useState(false);
  const [, setExportedUrl] = useState<string | null>(null);
  const [trimbleHasUpdate, setTrimbleHasUpdate] = useState(false);
  const [trimbleChecking, setTrimbleChecking] = useState(false);
  const [trimbleUpdateFile, setTrimbleUpdateFile] = useState<{ modifiedAt: string; modifiedBy?: string } | null>(null);

  // Check for Trimble Connect updates when projectId is available
  useEffect(() => {
    if (!trimbleProjectId) return;
    let cancelled = false;
    const check = async () => {
      setTrimbleChecking(true);
      try {
        const result = await checkTrimbleUpdates(trimbleProjectId);
        if (cancelled) return;
        setTrimbleHasUpdate(result.hasChanges);
        if (result.hasChanges && result.updatedFiles.length > 0) {
          const latest = result.updatedFiles[0];
          setTrimbleUpdateFile({ modifiedAt: latest.modifiedAt, modifiedBy: latest.modifiedBy });
        }
      } catch {
        // Silently fail — update check is non-critical
      } finally {
        if (!cancelled) setTrimbleChecking(false);
      }
    };
    check();
    return () => { cancelled = true; };
  }, [trimbleProjectId]);

  const handleShapr3DExport = useCallback(async () => {
    if (!revision) return;
    setExporting(true);
    try {
      const url = await onExportShapr3D(revision.id);
      if (url) {
        setExportedUrl(url);
        // Auto-download
        const a = document.createElement('a');
        a.href = url;
        a.download = `revision-${revision.revisionNumber}.x_t`;
        a.click();
      }
    } finally {
      setExporting(false);
    }
  }, [revision, onExportShapr3D]);

  if (!revision) {
    return (
      <div className="p-3 text-center text-xs text-muted-foreground">
        <Box className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p>No active revision to export</p>
        <p className="text-[10px] mt-1">Generate or upload a model first.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-2 text-xs">
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
        Export for External Editing
      </div>

      {/* Path A: Shapr3D */}
      <div className="border rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <Box className="h-4 w-4 text-blue-600" />
          <div>
            <div className="font-semibold">Shapr3D</div>
            <div className="text-[10px] text-muted-foreground">
              Precision editing for product design
            </div>
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground mb-2">
          Downloads as Parasolid X_T (zero geometry loss). Opens directly in Shapr3D on macOS/iPad.
        </div>
        <button
          onClick={handleShapr3DExport}
          disabled={exporting || (!revision.files.xtUrl && !revision.files.stepUrl)}
          className="w-full py-1.5 rounded-md bg-blue-600 text-white text-[11px] font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          {exporting ? 'Preparing...' : 'Download for Shapr3D'}
        </button>
        {!revision.files.xtUrl && !revision.files.stepUrl && (
          <p className="text-[9px] text-amber-600 mt-1 text-center">
            No STEP/X_T file available for this revision
          </p>
        )}
      </div>

      {/* Path B: SketchUp */}
      <div className="border rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="h-4 w-4 text-green-600" />
          <div>
            <div className="font-semibold">SketchUp + Trimble Connect</div>
            <div className="text-[10px] text-muted-foreground">
              BIM-classified spatial layouts
            </div>
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground mb-2">
          Pushes STEP to Trimble Connect for editing in SketchUp Desktop. Supports IFC classification.
        </div>
        <button
          onClick={async () => {
            if (!revision || !onExportSketchUp) return;
            setExportingSketchUp(true);
            try {
              await onExportSketchUp(revision.id, `DawinOS-R${revision.revisionNumber}`);
            } finally {
              setExportingSketchUp(false);
            }
          }}
          disabled={exportingSketchUp || !onExportSketchUp || (!revision?.files.stepUrl && !revision?.files.xtUrl)}
          className="w-full py-1.5 rounded-md bg-green-600 text-white text-[11px] font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {exportingSketchUp ? 'Uploading...' : 'Push to Trimble Connect'}
        </button>
        {!revision?.files.stepUrl && !revision?.files.xtUrl && (
          <p className="text-[9px] text-amber-600 mt-1 text-center">
            No STEP/X_T file available for this revision
          </p>
        )}
        {/* Trimble update indicator */}
        {trimbleProjectId && (
          <div className="mt-2 pt-2 border-t border-border/50">
            {trimbleChecking ? (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Checking for updates...
              </div>
            ) : trimbleHasUpdate ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-[10px] text-amber-600">
                  <AlertCircle className="h-3 w-3" />
                  Updated in SketchUp
                  {trimbleUpdateFile?.modifiedBy && (
                    <span className="text-muted-foreground">by {trimbleUpdateFile.modifiedBy}</span>
                  )}
                </div>
                {trimbleUpdateFile?.modifiedAt && (
                  <div className="text-[9px] text-muted-foreground pl-4.5">
                    {new Date(trimbleUpdateFile.modifiedAt).toLocaleDateString()}
                  </div>
                )}
                {onImportTrimbleUpdate && trimbleFileId && (
                  <button
                    onClick={() => onImportTrimbleUpdate(trimbleFileId, trimbleProjectId)}
                    className="w-full py-1 rounded bg-amber-50 text-amber-700 text-[10px] font-medium hover:bg-amber-100 flex items-center justify-center gap-1"
                  >
                    <Download className="h-3 w-3" />
                    Import Updated Model
                  </button>
                )}
              </div>
            ) : (
              <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                <RefreshCw className="h-3 w-3" />
                Trimble Connect — up to date
              </div>
            )}
          </div>
        )}
      </div>

      {/* Current revision info */}
      <div className="border rounded-lg p-2 bg-muted/10 text-[10px]">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Revision</span>
          <span className="font-medium">R{revision.revisionNumber}</span>
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-muted-foreground">Source</span>
          <span className="font-medium capitalize">{revision.source.replace('_', ' ')}</span>
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-muted-foreground">Status</span>
          <span className="font-medium capitalize">{revision.status.replace('_', ' ')}</span>
        </div>
      </div>
    </div>
  );
}
