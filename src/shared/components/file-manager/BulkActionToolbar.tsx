/**
 * BulkActionToolbar
 * Floating toolbar when files are selected — delete, download ZIP
 */

import { Trash2, Download, X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface BulkActionToolbarProps {
  selectedCount: number;
  onDelete: () => void;
  onDownloadZip: () => void;
  onClearSelection: () => void;
  deleting?: boolean;
  downloading?: boolean;
}

export function BulkActionToolbar({
  selectedCount,
  onDelete,
  onDownloadZip,
  onClearSelection,
  deleting,
  downloading,
}: BulkActionToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg shadow-lg">
      <span className="text-sm font-medium mr-2">
        {selectedCount} selected
      </span>

      <button
        onClick={onDownloadZip}
        disabled={downloading}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md',
          'bg-white/10 hover:bg-white/20 transition-colors',
          downloading && 'opacity-50 cursor-not-allowed'
        )}
      >
        <Download className="h-3.5 w-3.5" />
        {downloading ? 'Zipping...' : 'Download ZIP'}
      </button>

      <button
        onClick={onDelete}
        disabled={deleting}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md',
          'bg-red-500/20 hover:bg-red-500/30 text-red-200 transition-colors',
          deleting && 'opacity-50 cursor-not-allowed'
        )}
      >
        <Trash2 className="h-3.5 w-3.5" />
        {deleting ? 'Deleting...' : 'Delete'}
      </button>

      <button
        onClick={onClearSelection}
        className="ml-1 p-1 hover:bg-white/10 rounded transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
