/**
 * Clip Browser Component
 * Inline panel for browsing and attaching clips from the clipper library
 * to the Design Chat AI conversation for assessment.
 */

import { useState, useEffect } from 'react';
import { Search, X, Library, Plus, Loader2, ChevronDown } from 'lucide-react';
import { subscribeToClips } from '@/subsidiaries/finishes/clipper/services/clipService';
import type { DesignClip, ClipType } from '@/subsidiaries/finishes/clipper/types';

interface ClipBrowserProps {
  userId: string;
  projectId?: string;
  onAttachClip: (clip: DesignClip) => Promise<void>;
  onClose: () => void;
  isSending: boolean;
}

const CLIP_TYPE_LABELS: Record<ClipType, string> = {
  inspiration: 'Inspiration',
  reference: 'Reference',
  'parts-source': 'Parts Source',
  procurement: 'Procurement',
  material: 'Material',
  asset: 'Asset',
  'product-idea': 'Product Idea',
};

export function ClipBrowser({ userId, projectId, onAttachClip, onClose, isSending }: ClipBrowserProps) {
  const [clips, setClips] = useState<DesignClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ClipType | ''>('');
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  // Subscribe to clips
  useEffect(() => {
    if (!userId) return;

    setLoading(true);
    const unsubscribe = subscribeToClips(
      userId,
      {
        projectId: projectId || undefined,
        search: search || undefined,
      },
      (loadedClips) => {
        let filtered = loadedClips;
        if (typeFilter) {
          filtered = filtered.filter(c => c.clipType === typeFilter);
        }
        setClips(filtered);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId, projectId, search, typeFilter]);

  const handleAttach = async (clip: DesignClip) => {
    setAttachingId(clip.id);
    try {
      await onAttachClip(clip);
      onClose();
    } catch {
      // Error handled by parent
    } finally {
      setAttachingId(null);
    }
  };

  return (
    <div className="border-t border-gray-200 bg-gray-50 max-h-[300px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2">
          <Library className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-medium text-gray-700">Clip Library</span>
          <span className="text-xs text-gray-400">({clips.length})</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clips..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>

        {/* Type Filter */}
        <div className="relative">
          <button
            onClick={() => setShowTypeDropdown(!showTypeDropdown)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            {typeFilter ? CLIP_TYPE_LABELS[typeFilter] : 'All Types'}
            <ChevronDown className="w-3 h-3" />
          </button>
          {showTypeDropdown && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[140px]">
              <button
                onClick={() => { setTypeFilter(''); setShowTypeDropdown(false); }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50"
              >
                All Types
              </button>
              {(Object.keys(CLIP_TYPE_LABELS) as ClipType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => { setTypeFilter(type); setShowTypeDropdown(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${
                    typeFilter === type ? 'bg-purple-50 text-purple-700' : ''
                  }`}
                >
                  {CLIP_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Clips Grid */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
          </div>
        ) : clips.length === 0 ? (
          <div className="text-center py-6">
            <Library className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-400">
              {search || typeFilter ? 'No clips match your filters' : 'No clips in library yet'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {clips.map((clip) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                onAttach={handleAttach}
                isAttaching={attachingId === clip.id}
                disabled={isSending || !!attachingId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Clip Card Sub-component
// ============================================

interface ClipCardProps {
  clip: DesignClip;
  onAttach: (clip: DesignClip) => void;
  isAttaching: boolean;
  disabled: boolean;
}

function ClipCard({ clip, onAttach, isAttaching, disabled }: ClipCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-purple-300 transition-colors group">
      {/* Thumbnail */}
      <div className="relative aspect-[4/3] bg-gray-100">
        <img
          src={clip.thumbnailUrl || clip.imageUrl}
          alt={clip.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {/* Attach Button Overlay */}
        <button
          onClick={() => onAttach(clip)}
          disabled={disabled}
          className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 disabled:cursor-not-allowed"
        >
          {isAttaching ? (
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          ) : (
            <div className="bg-purple-600 text-white rounded-full p-2 shadow-lg">
              <Plus className="w-4 h-4" />
            </div>
          )}
        </button>

        {/* Type Badge */}
        <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 text-white text-[10px] rounded">
          {clip.clipType}
        </span>
      </div>

      {/* Info */}
      <div className="p-2">
        <p className="text-xs font-medium text-gray-800 truncate" title={clip.title}>
          {clip.title}
        </p>
        {clip.aiAnalysis && (
          <div className="mt-1 flex flex-wrap gap-1">
            {clip.aiAnalysis.primaryMaterials?.slice(0, 2).map((mat, i) => (
              <span key={i} className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px]">
                {mat}
              </span>
            ))}
            {clip.aiAnalysis.millworkAssessment && (
              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px]">
                {clip.aiAnalysis.millworkAssessment.complexity}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
