/**
 * PaletteBulkToolbar Component
 * Floating dark toolbar at bottom of viewport when palette entries are selected.
 * Mirrors inventory/components/BulkActionsToolbar.tsx pattern.
 */

import { X, Trash2, Unlink, ArrowRightLeft } from 'lucide-react';

export type PaletteBulkAction = 'reclassify' | 'unmap' | 'delete';

interface PaletteBulkToolbarProps {
  selectedCount: number;
  onAction: (action: PaletteBulkAction) => void;
  onClearSelection: () => void;
  disabled?: boolean;
}

export function PaletteBulkToolbar({
  selectedCount,
  onAction,
  onClearSelection,
  disabled = false,
}: PaletteBulkToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white rounded-xl shadow-2xl px-6 py-3 flex items-center gap-4">
      {/* Selection count */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-white/20 text-sm font-medium">
          {selectedCount}
        </span>
        <span className="text-sm">selected</span>
      </div>

      <div className="w-px h-6 bg-white/20" />

      {/* Action buttons */}
      <button
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-white hover:bg-white/10 transition-colors disabled:opacity-50"
        onClick={() => onAction('reclassify')}
        disabled={disabled}
      >
        <ArrowRightLeft className="w-4 h-4" />
        Reclassify
      </button>

      <button
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-white hover:bg-white/10 transition-colors disabled:opacity-50"
        onClick={() => onAction('unmap')}
        disabled={disabled}
      >
        <Unlink className="w-4 h-4" />
        Unmap
      </button>

      <div className="w-px h-6 bg-white/20" />

      <button
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors disabled:opacity-50"
        onClick={() => onAction('delete')}
        disabled={disabled}
      >
        <Trash2 className="w-4 h-4" />
        Delete
      </button>

      {/* Clear selection */}
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
