/**
 * InspirationPanel Component
 * Reusable panel for displaying design inspiration clips
 * Can be used as a sidebar, modal content, or standalone component
 */

import React, { useState, useEffect } from 'react';
import {
  Image,
  ExternalLink,
  X,
  Sparkles,
  Lightbulb,
  Puzzle,
  ShoppingCart,
  Palette,
  Wrench,
  Rocket,
  Clock,
  Ruler,
  Package,
  Tag,
  ChevronRight,
  Plus,
  Upload
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { DesignClip, ClipType } from '@/subsidiaries/finishes/clipper/types';
import { ManualUploadDialog } from '@/subsidiaries/finishes/clipper/components/ManualUploadDialog';

// Clip type configuration
const CLIP_TYPE_CONFIG: Record<ClipType, { icon: React.ElementType; label: string; color: string; bgColor: string }> = {
  'inspiration': { icon: Lightbulb, label: 'Inspiration', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  'reference': { icon: Image, label: 'Reference', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  'parts-source': { icon: Puzzle, label: 'Parts Source', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  'procurement': { icon: ShoppingCart, label: 'Procurement', color: 'text-green-700', bgColor: 'bg-green-100' },
  'material': { icon: Palette, label: 'Material', color: 'text-pink-700', bgColor: 'bg-pink-100' },
  'asset': { icon: Wrench, label: 'Asset', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  'product-idea': { icon: Rocket, label: 'Product Idea', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
};

interface InspirationPanelProps {
  designItemId: string;
  projectId: string;
  designItemName?: string;
  onOpenGallery?: () => void;
  compact?: boolean;
  maxItems?: number;
}

export function InspirationPanel({
  designItemId,
  projectId,
  designItemName: _designItemName,
  onOpenGallery,
  compact = false,
  maxItems,
}: InspirationPanelProps) {
  const [linkedClips, setLinkedClips] = useState<DesignClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClip, setSelectedClip] = useState<DesignClip | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Subscribe to clips linked to this design item
  useEffect(() => {
    const clipsRef = collection(db, 'designClips');
    const q = query(clipsRef, where('designItemId', '==', designItemId));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clips = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
      })) as DesignClip[];
      setLinkedClips(clips);
      setLoading(false);
    });
    
    return unsubscribe;
  }, [designItemId]);

  const handleUnlinkClip = async (clipId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm('Unlink this clip from the design item?')) return;
    
    try {
      const clipRef = doc(db, 'designClips', clipId);
      await updateDoc(clipRef, {
        designItemId: deleteField(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Failed to unlink clip:', error);
      alert('Failed to unlink clip. Please try again.');
    }
  };

  const displayClips = maxItems ? linkedClips.slice(0, maxItems) : linkedClips;
  const hasMore = maxItems && linkedClips.length > maxItems;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#1d1d1f]"></div>
      </div>
    );
  }

  // Compact view for sidebar
  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-yellow-600" />
            Inspiration
            {linkedClips.length > 0 && (
              <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs">
                {linkedClips.length}
              </span>
            )}
          </h4>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsUploadOpen(true)}
              className="text-xs text-[#1d1d1f] hover:underline flex items-center gap-1"
            >
              <Upload className="w-3 h-3" />
              Upload
            </button>
            {onOpenGallery && (
              <button
                onClick={onOpenGallery}
                className="text-xs text-[#1d1d1f] hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            )}
          </div>
        </div>

        {linkedClips.length === 0 ? (
          <button
            onClick={onOpenGallery}
            className="w-full p-3 border-2 border-dashed border-gray-200 rounded-lg text-center hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <Image className="w-6 h-6 text-gray-300 mx-auto mb-1" />
            <p className="text-xs text-gray-500">Add inspiration clips</p>
          </button>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {displayClips.map((clip) => (
              <div
                key={clip.id}
                onClick={() => setSelectedClip(clip)}
                className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-100 cursor-pointer hover:ring-2 hover:ring-[#1d1d1f] transition-all relative group"
              >
                <img
                  src={clip.thumbnailUrl || clip.imageUrl}
                  alt={clip.title}
                  className="w-full h-full object-cover"
                />
                {clip.aiAnalysis && (
                  <div className="absolute bottom-1 right-1 p-0.5 bg-purple-500 rounded-full">
                    <Sparkles className="w-2 h-2 text-white" />
                  </div>
                )}
              </div>
            ))}
            {hasMore && (
              <button
                onClick={onOpenGallery}
                className="flex-shrink-0 w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
              >
                +{linkedClips.length - (maxItems || 0)}
              </button>
            )}
          </div>
        )}

        {/* Quick Detail Modal */}
        {selectedClip && (
          <ClipDetailModal
            clip={selectedClip}
            onClose={() => setSelectedClip(null)}
            onUnlink={() => handleUnlinkClip(selectedClip.id)}
          />
        )}

        {/* Manual Upload Dialog */}
        <ManualUploadDialog
          open={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
          projectId={projectId}
          designItemId={designItemId}
        />
      </div>
    );
  }

  // Full view
  return (
    <div className="space-y-4">
      {linkedClips.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <Image className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <h3 className="font-medium text-gray-900">No inspiration clips</h3>
          <p className="text-sm text-gray-500 mt-1">
            Link clips from your library to use as design reference
          </p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              onClick={() => setIsUploadOpen(true)}
              className="px-4 py-2 bg-[#1d1d1f] text-white rounded-lg text-sm font-medium hover:bg-[#424245] flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Upload Photo
            </button>
            {onOpenGallery && (
              <button
                onClick={onOpenGallery}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Browse Clips
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {displayClips.map((clip) => (
            <InspirationCard
              key={clip.id}
              clip={clip}
              onClick={() => setSelectedClip(clip)}
              onUnlink={(e) => handleUnlinkClip(clip.id, e)}
            />
          ))}
        </div>
      )}

      {hasMore && onOpenGallery && (
        <button
          onClick={onOpenGallery}
          className="w-full py-2 text-sm text-gray-600 hover:text-gray-900 flex items-center justify-center gap-1"
        >
          View all {linkedClips.length} clips
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Detail Modal */}
      {selectedClip && (
        <ClipDetailModal
          clip={selectedClip}
          onClose={() => setSelectedClip(null)}
          onUnlink={() => handleUnlinkClip(selectedClip.id)}
        />
      )}

      {/* Manual Upload Dialog */}
      <ManualUploadDialog
        open={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        projectId={projectId}
        designItemId={designItemId}
      />
    </div>
  );
}

// Inspiration Card Component
interface InspirationCardProps {
  clip: DesignClip;
  onClick: () => void;
  onUnlink: (e: React.MouseEvent) => void;
}

function InspirationCard({ clip, onClick, onUnlink }: InspirationCardProps) {
  const typeConfig = clip.clipType ? CLIP_TYPE_CONFIG[clip.clipType] : null;
  const TypeIcon = typeConfig?.icon;

  return (
    <div
      onClick={onClick}
      className="group relative bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition-all"
    >
      {/* Image */}
      <div className="aspect-square bg-gray-100 relative">
        <img
          src={clip.thumbnailUrl || clip.imageUrl}
          alt={clip.title}
          className="w-full h-full object-cover"
        />
        
        {/* Type Badge */}
        {typeConfig && TypeIcon && (
          <div className={`absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 ${typeConfig.bgColor} ${typeConfig.color}`}>
            <TypeIcon className="w-3 h-3" />
            {typeConfig.label}
          </div>
        )}

        {/* AI Badge */}
        {clip.aiAnalysis && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            AI
          </div>
        )}

        {/* Hover Overlay */}
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
            <button 
              onClick={onUnlink}
              className="p-2 bg-red-500 rounded-full hover:bg-red-600"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <h4 className="font-medium text-gray-900 text-sm line-clamp-1">{clip.title}</h4>
        {clip.brand && (
          <p className="text-xs text-gray-500 mt-0.5">{clip.brand}</p>
        )}
        {clip.price && (
          <p className="text-sm text-gray-600 mt-0.5">{clip.price.formatted}</p>
        )}
        
        {/* AI Insights Preview */}
        {clip.aiAnalysis?.millworkAssessment && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs">
              <span className={`px-1.5 py-0.5 rounded ${
                clip.aiAnalysis.millworkAssessment.complexity === 'simple' ? 'bg-green-100 text-green-700' :
                clip.aiAnalysis.millworkAssessment.complexity === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                clip.aiAnalysis.millworkAssessment.complexity === 'complex' ? 'bg-orange-100 text-orange-700' :
                'bg-red-100 text-red-700'
              }`}>
                {clip.aiAnalysis.millworkAssessment.complexity}
              </span>
              {clip.aiAnalysis.millworkAssessment.estimatedHours && (
                <span className="text-gray-500">
                  ~{clip.aiAnalysis.millworkAssessment.estimatedHours}h
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Clip Detail Modal
interface ClipDetailModalProps {
  clip: DesignClip;
  onClose: () => void;
  onUnlink: () => void;
}

function ClipDetailModal({ clip, onClose, onUnlink }: ClipDetailModalProps) {
  const typeConfig = clip.clipType ? CLIP_TYPE_CONFIG[clip.clipType] : null;
  const TypeIcon = typeConfig?.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">{clip.title}</h3>
            {typeConfig && TypeIcon && (
              <span className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 ${typeConfig.bgColor} ${typeConfig.color}`}>
                <TypeIcon className="w-3 h-3" />
                {typeConfig.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <a
              href={clip.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
            {/* Image */}
            <div>
              <img
                src={clip.imageUrl}
                alt={clip.title}
                className="w-full rounded-lg object-contain max-h-[60vh]"
              />
            </div>

            {/* Details */}
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-3">
                {clip.description && (
                  <p className="text-gray-600">{clip.description}</p>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  {clip.brand && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Brand</p>
                      <p className="font-medium text-gray-900">{clip.brand}</p>
                    </div>
                  )}
                  {clip.price && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Price</p>
                      <p className="font-medium text-gray-900">{clip.price.formatted}</p>
                    </div>
                  )}
                  {clip.sku && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">SKU</p>
                      <p className="font-medium text-gray-900">{clip.sku}</p>
                    </div>
                  )}
                </div>

                {/* Dimensions */}
                {clip.dimensions && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Dimensions</p>
                    <div className="flex items-center gap-2 text-sm">
                      <Ruler className="w-4 h-4 text-gray-400" />
                      <span>
                        {clip.dimensions.width && `${clip.dimensions.width}`}
                        {clip.dimensions.height && ` × ${clip.dimensions.height}`}
                        {clip.dimensions.depth && ` × ${clip.dimensions.depth}`}
                        {` ${clip.dimensions.unit}`}
                      </span>
                    </div>
                  </div>
                )}

                {/* Materials */}
                {clip.materials && clip.materials.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Materials</p>
                    <div className="flex flex-wrap gap-1">
                      {clip.materials.map((mat, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                          {mat}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tags */}
                {clip.tags.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {clip.tags.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                          <Tag className="w-2.5 h-2.5" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* AI Analysis */}
              {clip.aiAnalysis && (
                <div className="bg-purple-50 rounded-lg p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    <h4 className="font-semibold text-purple-900">AI Analysis</h4>
                    <span className="text-xs text-purple-600">
                      {Math.round((clip.aiAnalysis.confidence || 0) * 100)}% confidence
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {clip.aiAnalysis.productType && (
                      <div>
                        <p className="text-xs text-purple-600 uppercase tracking-wide">Product Type</p>
                        <p className="font-medium text-purple-900">{clip.aiAnalysis.productType}</p>
                      </div>
                    )}
                    {clip.aiAnalysis.style && (
                      <div>
                        <p className="text-xs text-purple-600 uppercase tracking-wide">Style</p>
                        <p className="font-medium text-purple-900">{clip.aiAnalysis.style}</p>
                      </div>
                    )}
                  </div>

                  {/* Millwork Assessment */}
                  {clip.aiAnalysis.millworkAssessment && (
                    <div className="bg-white rounded-lg p-3 space-y-2">
                      <h5 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        Millwork Assessment
                      </h5>
                      
                      <div className="flex items-center gap-3 text-sm">
                        <span className={`px-2 py-0.5 rounded font-medium ${
                          clip.aiAnalysis.millworkAssessment.complexity === 'simple' ? 'bg-green-100 text-green-700' :
                          clip.aiAnalysis.millworkAssessment.complexity === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                          clip.aiAnalysis.millworkAssessment.complexity === 'complex' ? 'bg-orange-100 text-orange-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {clip.aiAnalysis.millworkAssessment.complexity} complexity
                        </span>
                        {clip.aiAnalysis.millworkAssessment.estimatedHours && (
                          <span className="text-gray-600 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            ~{clip.aiAnalysis.millworkAssessment.estimatedHours} hours
                          </span>
                        )}
                        {clip.aiAnalysis.millworkAssessment.isCustomCandidate && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                            Custom Candidate
                          </span>
                        )}
                      </div>

                      {clip.aiAnalysis.millworkAssessment.keyFeatures && clip.aiAnalysis.millworkAssessment.keyFeatures.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Key Features</p>
                          <ul className="text-xs text-gray-700 space-y-0.5">
                            {clip.aiAnalysis.millworkAssessment.keyFeatures.map((feat, i) => (
                              <li key={i} className="flex items-start gap-1">
                                <span className="text-gray-400">•</span>
                                {feat}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {clip.aiAnalysis.millworkAssessment.considerations && clip.aiAnalysis.millworkAssessment.considerations.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Considerations</p>
                          <ul className="text-xs text-amber-700 space-y-0.5">
                            {clip.aiAnalysis.millworkAssessment.considerations.map((item, i) => (
                              <li key={i} className="flex items-start gap-1">
                                <span>⚠️</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Suggested Tags */}
                  {clip.aiAnalysis.suggestedTags && clip.aiAnalysis.suggestedTags.length > 0 && (
                    <div>
                      <p className="text-xs text-purple-600 uppercase tracking-wide mb-1">AI Suggested Tags</p>
                      <div className="flex flex-wrap gap-1">
                        {clip.aiAnalysis.suggestedTags.map((tag, i) => (
                          <span key={i} className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={onUnlink}
                  className="px-4 py-2 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50"
                >
                  Unlink from Item
                </button>
                <a
                  href={clip.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-[#1d1d1f] text-white rounded-lg text-sm font-medium hover:bg-[#424245] flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Source
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InspirationPanel;
