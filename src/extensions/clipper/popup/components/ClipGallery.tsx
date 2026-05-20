/**
 * ClipGallery - Grid view of clipped images with filters
 */

import { useState, useMemo } from 'react';
import { 
  Grid, 
  List, 
  Search, 
  Filter, 
  Tag, 
  Trash2, 
  FolderPlus,
  Check,
} from 'lucide-react';
import { ClipCard } from './ClipCard';
import type { PopupClipRecord } from '../types';

interface ClipGalleryProps {
  clips: PopupClipRecord[];
  onDelete: (id: string) => void;
  onSelect: (clip: PopupClipRecord) => void;
  onBulkAction: (action: 'delete' | 'tag' | 'project', ids: string[]) => void;
}

type ViewMode = 'grid' | 'list';
type SortBy = 'newest' | 'oldest' | 'price-high' | 'price-low';

export function ClipGallery({ clips, onDelete, onSelect, onBulkAction }: ClipGalleryProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterTag, setFilterTag] = useState<string | null>(null);

  // Get all unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    clips.forEach((clip) => clip.tags?.forEach((tag) => tags.add(tag)));
    return Array.from(tags).sort();
  }, [clips]);

  // Filter and sort clips
  const filteredClips = useMemo(() => {
    let result = [...clips];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (clip) =>
          clip.title?.toLowerCase().includes(query) ||
          clip.description?.toLowerCase().includes(query) ||
          clip.brand?.toLowerCase().includes(query) ||
          clip.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Tag filter
    if (filterTag) {
      result = result.filter((clip) => clip.tags?.includes(filterTag));
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'price-high':
          return (b.price?.amount || 0) - (a.price?.amount || 0);
        case 'price-low':
          return (a.price?.amount || 0) - (b.price?.amount || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [clips, searchQuery, sortBy, filterTag]);

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredClips.map((c) => c.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const isSelectionMode = selectedIds.size > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Search and Filters */}
      <div className="p-3 border-b border-gray-200 space-y-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search clips..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        {/* Filter Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Tag filter dropdown */}
            <select
              value={filterTag || ''}
              onChange={(e) => setFilterTag(e.target.value || null)}
              className="text-xs px-2 py-1.5 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All tags</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>

            {/* Sort dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="text-xs px-2 py-1.5 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="price-high">Price: High to Low</option>
              <option value="price-low">Price: Low to High</option>
            </select>
          </div>

          {/* View toggle */}
          <div className="flex items-center border border-gray-200 rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 ${viewMode === 'grid' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 ${viewMode === 'list' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Selection Actions */}
      {isSelectionMode && (
        <div className="px-3 py-2 bg-primary/10 border-b border-primary/20 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-primary">{selectedIds.size} selected</span>
            <button onClick={selectAll} className="text-primary hover:underline">Select all</button>
            <button onClick={clearSelection} className="text-gray-500 hover:underline">Clear</button>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onBulkAction('tag', Array.from(selectedIds))}
              className="p-1.5 text-gray-600 hover:bg-white rounded"
              title="Add tags"
            >
              <Tag className="w-4 h-4" />
            </button>
            <button
              onClick={() => onBulkAction('project', Array.from(selectedIds))}
              className="p-1.5 text-gray-600 hover:bg-white rounded"
              title="Add to project"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
            <button
              onClick={() => onBulkAction('delete', Array.from(selectedIds))}
              className="p-1.5 text-error hover:bg-white rounded"
              title="Delete selected"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Results count */}
      <div className="px-3 py-1.5 text-xs text-gray-500 border-b border-gray-100">
        {filteredClips.length} clip{filteredClips.length !== 1 ? 's' : ''}
        {searchQuery && ` matching "${searchQuery}"`}
      </div>

      {/* Clip Grid/List */}
      <div className="flex-1 overflow-y-auto p-3">
        {filteredClips.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Filter className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-sm">No clips found</p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-xs text-primary hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 gap-2">
            {filteredClips.map((clip) => (
              <div
                key={clip.id}
                className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                  selectedIds.has(clip.id) ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-gray-200'
                }`}
                onClick={() => isSelectionMode ? toggleSelection(clip.id) : onSelect(clip)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  toggleSelection(clip.id);
                }}
              >
                {/* Selection checkbox */}
                {isSelectionMode && (
                  <div className={`absolute top-2 left-2 z-10 w-5 h-5 rounded border-2 flex items-center justify-center ${
                    selectedIds.has(clip.id) ? 'bg-primary border-primary' : 'bg-white/80 border-gray-300'
                  }`}>
                    {selectedIds.has(clip.id) && <Check className="w-3 h-3 text-white" />}
                  </div>
                )}
                
                {/* Thumbnail */}
                <div className="aspect-square bg-gray-100">
                  <img
                    src={clip.thumbnailDataUrl || clip.imageUrl}
                    alt={clip.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback to imageUrl if thumbnail fails
                      (e.target as HTMLImageElement).src = clip.imageUrl;
                    }}
                  />
                </div>

                {/* Info overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                  <p className="text-white text-xs font-medium truncate">{clip.title || 'Untitled'}</p>
                  {clip.price && (
                    <p className="text-white/80 text-xs">{clip.price.formatted}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredClips.map((clip) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                isSelected={selectedIds.has(clip.id)}
                onSelect={() => isSelectionMode ? toggleSelection(clip.id) : onSelect(clip)}
                onDelete={() => onDelete(clip.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
