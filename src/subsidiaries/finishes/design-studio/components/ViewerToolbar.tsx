/**
 * ViewerToolbar — Top toolbar with file info, linkage badge, and export button
 */

import { Printer, Link2 } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import type { MeshCutListLink } from '../types/workshop-viewer.types';

interface ViewerToolbarProps {
  modelFileName?: string;
  csvFileName?: string;
  meshLinks: MeshCutListLink[];
  onExportPdf: () => void;
  hasModel: boolean;
}

export default function ViewerToolbar({
  modelFileName,
  csvFileName,
  meshLinks,
  onExportPdf,
  hasModel,
}: ViewerToolbarProps) {
  const totalMeshes = meshLinks.length;
  const linkedCount = meshLinks.filter(l => l.confidence !== 'unmatched').length;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-slate-900 text-white">
      <span className="text-sm font-semibold tracking-wide">DAWIN Design Studio</span>

      <div className="flex-1" />

      {modelFileName && (
        <span className="text-xs text-slate-300">{modelFileName}</span>
      )}
      {csvFileName && (
        <span className="text-xs text-slate-300">+ {csvFileName}</span>
      )}

      {totalMeshes > 0 && (
        <Badge
          variant="outline"
          className={`text-xs border-white/30 ${
            linkedCount === totalMeshes
              ? 'text-green-300'
              : linkedCount > 0
                ? 'text-yellow-300'
                : 'text-red-300'
          }`}
        >
          <Link2 className="w-3 h-3 mr-1" />
          {linkedCount}/{totalMeshes} linked
        </Badge>
      )}

      <Button
        variant="secondary"
        size="sm"
        className="text-xs"
        disabled={!hasModel}
        onClick={onExportPdf}
      >
        <Printer className="w-3.5 h-3.5 mr-1.5" />
        Export PDF
      </Button>
    </div>
  );
}
