import { useState, useMemo } from 'react';
import type { ClipRecord } from '../../types/database';
import { ClipCard } from './ClipCard';
import EmptyState from './EmptyState';

interface ClipQueueProps {
  clips: ClipRecord[];
  onDelete: (clipId: string) => void;
}

type FilterType = 'all' | 'pending' | 'synced' | 'error';

export default function ClipQueue({ clips, onDelete }: ClipQueueProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredClips = useMemo(() => {
    if (filter === 'all') return clips;
    return clips.filter((c) => c.syncStatus === filter);
  }, [clips, filter]);

  const filterCounts = useMemo(() => ({
    all: clips.length,
    pending: clips.filter((c) => c.syncStatus === 'pending').length,
    synced: clips.filter((c) => c.syncStatus === 'synced').length,
    error: clips.filter((c) => c.syncStatus === 'error').length,
  }), [clips]);

  const toggleSelection = (clipId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(clipId)) {
        next.delete(clipId);
      } else {
        next.add(clipId);
      }
      return next;
    });
  };

  const handleBulkDelete = () => {
    selectedIds.forEach((id) => onDelete(id));
    setSelectedIds(new Set());
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'synced', label: 'Synced' },
    { key: 'error', label: 'Error' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Filter tabs */}
      <div className="flex border-b px-2 py-1 bg-white gap-1">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              filter === f.key
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {f.label}
            {f.key !== 'all' && filterCounts[f.key] > 0 && (
              <span className="ml-1 text-xs">({filterCounts[f.key]})</span>
            )}
          </button>
        ))}
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border-b px-4 py-2 flex items-center justify-between">
          <span className="text-sm text-blue-700">
            {selectedIds.size} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleBulkDelete}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Delete
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-sm text-gray-600 hover:text-gray-700"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Clip list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filteredClips.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          filteredClips.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip as any}
              isSelected={selectedIds.has(clip.id)}
              onSelect={() => toggleSelection(clip.id)}
              onDelete={() => onDelete(clip.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
