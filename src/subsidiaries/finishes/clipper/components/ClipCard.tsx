/**
 * ClipCard Component
 * Displays a single clip in gallery view
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Tag, Link2, Lightbulb, Image, Puzzle, ShoppingCart, Palette, Wrench, Rocket, Sparkles, Clock, ArrowRight } from 'lucide-react';
import type { DesignClip, ClipType } from '../types';

/** Clip types eligible for material conversion */
const MATERIAL_CLIP_TYPES: ClipType[] = ['material', 'procurement', 'parts-source'];

const CLIP_TYPE_CONFIG: Record<ClipType, { icon: React.ElementType; label: string; color: string }> = {
  'inspiration': { icon: Lightbulb, label: 'Inspiration', color: 'bg-yellow-100 text-yellow-700' },
  'reference': { icon: Image, label: 'Reference', color: 'bg-blue-100 text-blue-700' },
  'parts-source': { icon: Puzzle, label: 'Parts', color: 'bg-purple-100 text-purple-700' },
  'procurement': { icon: ShoppingCart, label: 'Procure', color: 'bg-green-100 text-green-700' },
  'material': { icon: Palette, label: 'Material', color: 'bg-pink-100 text-pink-700' },
  'asset': { icon: Wrench, label: 'Asset', color: 'bg-orange-100 text-orange-700' },
  'product-idea': { icon: Rocket, label: 'Product', color: 'bg-indigo-100 text-indigo-700' },
};

interface ClipCardProps {
  clip: DesignClip;
  onClick?: () => void;
  onLink?: () => void;
  selected?: boolean;
  linkMode?: boolean;
}

export function ClipCard({ clip, onClick, onLink, selected, linkMode }: ClipCardProps) {
  const navigate = useNavigate();
  const isLinked = !!clip.designItemId;
  const isMaterialType = clip.clipType && MATERIAL_CLIP_TYPES.includes(clip.clipType);

  return (
    <div 
      className={`group relative bg-white rounded-lg border overflow-hidden cursor-pointer transition-all hover:shadow-md ${
        selected ? 'ring-2 ring-primary border-primary' : 'border-gray-200'
      } ${isLinked && linkMode ? 'opacity-50' : ''}`}
      onClick={linkMode && onLink && !isLinked ? onLink : onClick}
    >
      {/* Image */}
      <div className="aspect-square bg-gray-100 relative overflow-hidden">
        <img 
          src={clip.thumbnailUrl || clip.imageUrl} 
          alt={clip.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="flex gap-2">
            <a 
              href={clip.sourceUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-2 bg-white rounded-full hover:bg-gray-100"
            >
              <ExternalLink className="w-4 h-4 text-gray-700" />
            </a>
            {onLink && (
              <button 
                onClick={(e) => { e.stopPropagation(); onLink(); }}
                className="p-2 bg-white rounded-full hover:bg-gray-100"
              >
                <Link2 className="w-4 h-4 text-gray-700" />
              </button>
            )}
          </div>
        </div>
        
        {/* Clip type badge */}
        {clip.clipType && CLIP_TYPE_CONFIG[clip.clipType] && (
          <div className={`absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 ${CLIP_TYPE_CONFIG[clip.clipType].color}`}>
            {React.createElement(CLIP_TYPE_CONFIG[clip.clipType].icon, { className: 'w-3 h-3' })}
            {CLIP_TYPE_CONFIG[clip.clipType].label}
          </div>
        )}
        
        {/* Analysis status badge */}
        {clip.analysisStatus === 'pending' && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Analyzing
          </div>
        )}
        {clip.analysisStatus === 'completed' && clip.aiAnalysis && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            AI
          </div>
        )}
        
        {/* Sync status badge (only show if not synced) */}
        {clip.syncStatus !== 'synced' && (
          <div className={`absolute bottom-2 right-2 px-2 py-0.5 rounded text-xs font-medium ${
            clip.syncStatus === 'pending' ? 'bg-amber-100 text-amber-700' :
            clip.syncStatus === 'syncing' ? 'bg-blue-100 text-blue-700' :
            'bg-red-100 text-red-700'
          }`}>
            {clip.syncStatus}
          </div>
        )}
      </div>
      
      {/* Info */}
      <div className="p-3">
        <h3 className="font-medium text-gray-900 text-sm line-clamp-1">{clip.title}</h3>
        
        {clip.price && (
          <p className="text-sm text-gray-600 mt-0.5">{clip.price.formatted}</p>
        )}
        
        {clip.brand && (
          <p className="text-xs text-gray-500 mt-0.5">{clip.brand}</p>
        )}
        
        {/* Tags */}
        {clip.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {clip.tags.slice(0, 3).map(tag => (
              <span key={tag} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </span>
            ))}
            {clip.tags.length > 3 && (
              <span className="text-xs text-gray-400">+{clip.tags.length - 3}</span>
            )}
          </div>
        )}
        
        {/* Linked indicator */}
        {clip.designItemId && (
          <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
            <Link2 className="w-3 h-3" />
            Linked to design
          </div>
        )}

        {/* Convert to Material button for material-type clips */}
        {isMaterialType && !linkMode && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate('/design/materials?tab=clipper');
            }}
            className="w-full mt-2 px-3 py-1.5 bg-pink-600 text-white text-xs font-medium rounded-lg hover:bg-pink-700 flex items-center justify-center gap-1"
          >
            <Sparkles className="w-3 h-3" />
            Convert to Material
            <ArrowRight className="w-3 h-3" />
          </button>
        )}

        {/* Link button for link mode */}
        {linkMode && onLink && !isLinked && (
          <button
            onClick={(e) => { e.stopPropagation(); onLink(); }}
            className="w-full mt-2 px-3 py-1.5 bg-[#1d1d1f] text-white text-xs font-medium rounded-lg hover:bg-[#424245] flex items-center justify-center gap-1"
          >
            <Link2 className="w-3 h-3" />
            Link to Design
          </button>
        )}
        
        {/* Already linked indicator for link mode */}
        {linkMode && isLinked && (
          <div className="mt-2 px-3 py-1.5 bg-gray-100 text-gray-500 text-xs rounded-lg text-center">
            Already linked
          </div>
        )}
      </div>
    </div>
  );
}
