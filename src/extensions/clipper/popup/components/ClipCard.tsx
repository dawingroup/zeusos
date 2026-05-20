import { Trash2, RefreshCw, Image as ImageIcon } from 'lucide-react';
import type { PopupClipRecord } from '../types';
import { SyncBadge } from './SyncBadge';

interface ClipCardProps {
  clip: PopupClipRecord;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRetry?: () => void;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(date).toLocaleDateString();
}

export function ClipCard({
  clip,
  isSelected,
  onSelect,
  onDelete,
  onRetry,
}: ClipCardProps) {
  const thumbnailUrl = clip.thumbnailDataUrl || clip.imageUrl;

  return (
    <div
      className={`flex gap-3 p-2 bg-white rounded-lg border transition-all ${
        isSelected ? 'ring-2 ring-blue-500 border-blue-200' : 'border-gray-200'
      }`}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onSelect}
        className="mt-2 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />

      {/* Thumbnail */}
      <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0 bg-gray-100">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={clip.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-6 h-6 text-gray-400" />
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {clip.title || 'Untitled'}
        </p>
        <p className="text-xs text-gray-500 truncate">{clip.sourceUrl}</p>
        <div className="flex items-center gap-2 mt-1">
          <SyncBadge status={clip.syncStatus} />
          <span className="text-xs text-gray-400">
            {formatRelativeTime(clip.createdAt)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1">
        {clip.syncStatus === 'error' && onRetry && (
          <button
            onClick={onRetry}
            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
            title="Retry sync"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onDelete}
          className="p-1 text-red-600 hover:bg-red-50 rounded"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
