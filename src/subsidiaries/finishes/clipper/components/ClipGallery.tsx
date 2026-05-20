/**
 * ClipGallery Component
 * Grid display of design clips with filtering
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Grid, List, RefreshCw, Image, Lightbulb, Puzzle, ShoppingCart, Palette, Wrench, Rocket, Link2, Sparkles } from 'lucide-react';
import { ClipCard } from './ClipCard';
import { useClips } from '../hooks/useClips';
import type { DesignClip, ClipType } from '../types';

const MATERIAL_CLIP_TYPES: ClipType[] = ['material', 'procurement', 'parts-source'];

const CLIP_TYPE_ICONS: Record<ClipType, React.ElementType> = {
  'inspiration': Lightbulb,
  'reference': Image,
  'parts-source': Puzzle,
  'procurement': ShoppingCart,
  'material': Palette,
  'asset': Wrench,
  'product-idea': Rocket,
};

const CLIP_TYPE_COLORS: Record<ClipType, string> = {
  'inspiration': 'bg-yellow-100 text-yellow-700',
  'reference': 'bg-blue-100 text-blue-700',
  'parts-source': 'bg-purple-100 text-purple-700',
  'procurement': 'bg-green-100 text-green-700',
  'material': 'bg-pink-100 text-pink-700',
  'asset': 'bg-orange-100 text-orange-700',
  'product-idea': 'bg-indigo-100 text-indigo-700',
};

interface ClipGalleryProps {
  projectId?: string;
  onClipSelect?: (clip: DesignClip) => void;
  onLinkClip?: (clip: DesignClip) => void;
  selectable?: boolean;
  className?: string;
}

export function ClipGallery({ 
  projectId, 
  onClipSelect, 
  onLinkClip,
  selectable = false,
  className = '' 
}: ClipGalleryProps) {
  const navigate = useNavigate();
  const { clips, loading, refresh } = useClips({ projectId });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Filter clips by search
  const filteredClips = clips.filter(clip => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      clip.title.toLowerCase().includes(query) ||
      clip.brand?.toLowerCase().includes(query) ||
      clip.tags.some(tag => tag.toLowerCase().includes(query))
    );
  });

  const handleClipClick = (clip: DesignClip) => {
    if (selectable) {
      setSelectedClip(selectedClip === clip.id ? null : clip.id);
    }
    onClipSelect?.(clip);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search clips..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <span>{filteredClips.length} clips</span>
        {projectId && <span className="text-primary">Filtered by project</span>}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : filteredClips.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Image className="w-12 h-12 text-gray-300 mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No clips yet</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-sm">
            Use the Dawin Clipper Chrome extension to capture design inspiration from any website
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredClips.map(clip => (
            <ClipCard
              key={clip.id}
              clip={clip}
              onClick={() => handleClipClick(clip)}
              onLink={onLinkClip ? () => onLinkClip(clip) : undefined}
              selected={selectedClip === clip.id}
              linkMode={!!onLinkClip}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredClips.map(clip => (
            <div
              key={clip.id}
              onClick={() => onLinkClip && !clip.designItemId ? onLinkClip(clip) : handleClipClick(clip)}
              className={`flex items-center gap-4 p-3 bg-white rounded-lg border cursor-pointer hover:shadow-sm ${
                selectedClip === clip.id ? 'ring-2 ring-primary border-primary' : 'border-gray-200'
              } ${clip.designItemId && onLinkClip ? 'opacity-50' : ''}`}
            >
              <img 
                src={clip.thumbnailUrl || clip.imageUrl} 
                alt={clip.title}
                className="w-16 h-16 object-cover rounded"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-gray-900 truncate">{clip.title}</h3>
                  {clip.clipType && CLIP_TYPE_ICONS[clip.clipType] && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${CLIP_TYPE_COLORS[clip.clipType]}`}>
                      {React.createElement(CLIP_TYPE_ICONS[clip.clipType], { className: 'w-3 h-3' })}
                      {clip.clipType.replace('-', ' ')}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 truncate">{clip.brand || clip.sourceUrl}</p>
                {clip.price && (
                  <p className="text-sm text-gray-600">{clip.price.formatted}</p>
                )}
              </div>
              {clip.designItemId && (
                <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">Linked</span>
              )}
              {onLinkClip && !clip.designItemId && (
                <button
                  onClick={(e) => { e.stopPropagation(); onLinkClip(clip); }}
                  className="px-3 py-1.5 bg-[#1d1d1f] text-white text-xs font-medium rounded-lg hover:bg-[#424245] flex items-center gap-1"
                >
                  <Link2 className="w-3 h-3" />
                  Link
                </button>
              )}
              {clip.clipType && MATERIAL_CLIP_TYPES.includes(clip.clipType) && (
                <button
                  onClick={(e) => { e.stopPropagation(); navigate('/design/materials?tab=clipper'); }}
                  className="px-3 py-1.5 bg-pink-600 text-white text-xs font-medium rounded-lg hover:bg-pink-700 flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  Convert to Material
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
