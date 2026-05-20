/**
 * ProductIdeaClips Component
 * Shows unconverted product-idea clips from the clipper extension
 * Allows one-click conversion to LaunchProducts in the pipeline
 */

import { useState, useEffect } from 'react';
import {
  Scissors,
  Rocket,
  ExternalLink,
  Sparkles,
  Loader2,
  RefreshCw,
  ImageOff,
  Plus,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getUnconvertedProductIdeaClips,
  createLaunchProductFromClip,
} from '../../services/clipConversionService';
import { ManualProductIdeaDialog } from './ManualProductIdeaDialog';
import type { DesignClip } from '@/subsidiaries/finishes/clipper/types';
import type { LaunchProduct } from '../../types/product.types';

interface ProductIdeaClipsProps {
  onProductCreated?: (product: LaunchProduct) => void;
}

export function ProductIdeaClips({ onProductCreated }: ProductIdeaClipsProps) {
  const { user } = useAuth();
  const [clips, setClips] = useState<DesignClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [showManualClip, setShowManualClip] = useState(false);

  const loadClips = async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const ideaClips = await getUnconvertedProductIdeaClips(user.uid);
      setClips(ideaClips);
    } catch (error) {
      console.error('Failed to load product idea clips:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClips();
  }, [user?.uid]);

  const handleConvert = async (clip: DesignClip) => {
    if (!user?.uid) return;
    setConvertingId(clip.id);
    try {
      const product = await createLaunchProductFromClip(clip, user.uid);
      // Remove from local list
      setClips(prev => prev.filter(c => c.id !== clip.id));
      onProductCreated?.(product);
    } catch (error) {
      console.error('Failed to convert clip:', error);
      alert('Failed to create product from clip');
    } finally {
      setConvertingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (clips.length === 0) {
    return (
      <>
        <div className="text-center py-8 text-gray-500">
          <Scissors className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No product idea clips waiting</p>
          <p className="text-xs text-gray-400 mt-1">
            Use the Dawin Clipper extension or manually clip product ideas
          </p>
          <button
            onClick={() => setShowManualClip(true)}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Clip Product Idea
          </button>
        </div>
        {user && (
          <ManualProductIdeaDialog
            open={showManualClip}
            onClose={() => setShowManualClip(false)}
            userId={user.uid}
            onClipCreated={loadClips}
          />
        )}
      </>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Scissors className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-medium text-gray-900">
            Product Idea Clips
          </span>
          <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-medium">
            {clips.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowManualClip(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Clip Product Idea
          </button>
          <button
            onClick={loadClips}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {clips.map((clip) => (
          <div
            key={clip.id}
            className="group relative bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
          >
            {/* Image */}
            <div className="aspect-square bg-gray-100 relative overflow-hidden">
              {clip.thumbnailUrl || clip.imageUrl ? (
                <img
                  src={clip.thumbnailUrl || clip.imageUrl}
                  alt={clip.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageOff className="w-8 h-8 text-gray-300" />
                </div>
              )}

              {/* AI badge */}
              {clip.aiAnalysis && (
                <div className="absolute top-1.5 right-1.5 p-1 bg-purple-500 rounded-full shadow-sm">
                  <Sparkles className="w-2.5 h-2.5 text-white" />
                </div>
              )}

              {/* Source link */}
              <a
                href={clip.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute top-1.5 left-1.5 p-1 bg-white/90 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-3 h-3 text-gray-600" />
              </a>
            </div>

            {/* Info */}
            <div className="p-2">
              <p className="text-xs font-medium text-gray-900 truncate">
                {clip.title || 'Untitled'}
              </p>

              {/* AI analysis summary */}
              {clip.aiAnalysis && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {clip.aiAnalysis.productType && (
                    <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 text-[10px] rounded">
                      {clip.aiAnalysis.productType}
                    </span>
                  )}
                  {clip.aiAnalysis.style && (
                    <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] rounded">
                      {clip.aiAnalysis.style}
                    </span>
                  )}
                </div>
              )}

              {/* Price */}
              {clip.price && (
                <p className="text-xs text-green-600 font-medium mt-1">
                  {clip.price.formatted}
                </p>
              )}

              {/* Convert button */}
              <button
                onClick={() => handleConvert(clip)}
                disabled={convertingId === clip.id}
                className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {convertingId === clip.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Rocket className="w-3 h-3" />
                )}
                <span>Convert to Product</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {user && (
        <ManualProductIdeaDialog
          open={showManualClip}
          onClose={() => setShowManualClip(false)}
          userId={user.uid}
          onClipCreated={loadClips}
        />
      )}
    </div>
  );
}
