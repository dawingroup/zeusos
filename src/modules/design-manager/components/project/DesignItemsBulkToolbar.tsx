/**
 * DesignItemsBulkToolbar Component
 * Floating dark toolbar at bottom of viewport when design items are selected.
 * Shows bulk actions: advance stage, upload files, and merge (when applicable).
 */

import { X, GitMerge, ArrowUpCircle, Upload } from 'lucide-react';

interface DesignItemsBulkToolbarProps {
  selectedCount: number;
  onMerge: () => void;
  onAdvanceStage: () => void;
  onUploadFiles: () => void;
  onClearSelection: () => void;
  canMerge?: boolean;
  disabled?: boolean;
}

export function DesignItemsBulkToolbar({
  selectedCount,
  onMerge,
  onAdvanceStage,
  onUploadFiles,
  onClearSelection,
  canMerge = false,
  disabled = false,
}: DesignItemsBulkToolbarProps) {
  if (selectedCount < 1) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white rounded-xl shadow-2xl px-6 py-3 flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-white/20 text-sm font-medium">
          {selectedCount}
        </span>
        <span className="text-sm">item{selectedCount !== 1 ? 's' : ''} selected</span>
      </div>

      <div className="w-px h-6 bg-white/20" />

      <button
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-white hover:bg-white/10 transition-colors disabled:opacity-50"
        onClick={onAdvanceStage}
        disabled={disabled}
        title="Advance selected items to next stage"
      >
        <ArrowUpCircle className="w-4 h-4" />
        Advance Stage
      </button>

      <button
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-white hover:bg-white/10 transition-colors disabled:opacity-50"
        onClick={onUploadFiles}
        disabled={disabled}
        title="Upload file and assign to selected items"
      >
        <Upload className="w-4 h-4" />
        Upload Files
      </button>

      {canMerge && (
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          onClick={onMerge}
          disabled={disabled}
        >
          <GitMerge className="w-4 h-4" />
          Merge Items
        </button>
      )}

      <button
        onClick={onClearSelection}
        className="ml-2 p-1.5 rounded-full hover:bg-white/10 transition-colors"
        title="Clear selection"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
