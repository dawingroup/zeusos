/**
 * ProjectInspirationSummary Component
 * Shows all inspiration clips linked to design items in this project
 * Allows converting clips to project parts
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { Lightbulb, ExternalLink, Sparkles, ChevronRight, ArrowRight, Package, Loader2, Check, Rocket } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectParts } from '../../hooks/useProjectParts';
import { createLaunchProductFromClip } from '@/modules/launch-pipeline/services/clipConversionService';
import type { DesignClip } from '@/subsidiaries/finishes/clipper/types';

interface ProjectInspirationSummaryProps {
  projectId: string;
}

interface ClipWithItemName extends DesignClip {
  designItemName?: string;
  convertedToPartId?: string;
}

export function ProjectInspirationSummary({ projectId }: ProjectInspirationSummaryProps) {
  const { user } = useAuth();
  const { parts, createFromClip, bulkConvertFromClips } = useProjectParts(projectId, user?.uid || '');
  const [clips, setClips] = useState<ClipWithItemName[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [bulkConverting, setBulkConverting] = useState(false);
  const [sendingToLaunchId, setSendingToLaunchId] = useState<string | null>(null);

  useEffect(() => {
    const clipsRef = collection(db, 'designClips');
    const q = query(clipsRef, where('projectId', '==', projectId));
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const clipData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
      })) as ClipWithItemName[];
      
      // Fetch design item names for linked clips
      const clipsWithNames = await Promise.all(
        clipData.map(async (clip) => {
          if (clip.designItemId) {
            try {
              const itemRef = doc(db, 'designProjects', projectId, 'designItems', clip.designItemId);
              const itemSnap = await getDoc(itemRef);
              if (itemSnap.exists()) {
                return { ...clip, designItemName: itemSnap.data().name };
              }
            } catch (e) {
              console.error('Error fetching design item:', e);
            }
          }
          return clip;
        })
      );
      
      // Mark clips that are already converted to parts
      const clipsWithConversion = clipsWithNames.map(clip => ({
        ...clip,
        convertedToPartId: parts.find(p => p.clipId === clip.id)?.id,
      }));
      
      setClips(clipsWithConversion);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching project clips:', error);
      setLoading(false);
    });
    
    return unsubscribe;
  }, [projectId, parts]);

  // Convert a single clip to project part
  const handleConvertToPart = async (clip: ClipWithItemName) => {
    setConvertingId(clip.id);
    try {
      await createFromClip(clip);
    } catch (error) {
      console.error('Failed to convert clip to part:', error);
      alert('Failed to convert clip to part');
    } finally {
      setConvertingId(null);
    }
  };

  // Bulk convert all unconverted clips to parts
  const handleBulkConvert = async () => {
    const unconvertedClips = clips.filter(c => !c.convertedToPartId);
    if (unconvertedClips.length === 0) return;
    
    if (!confirm(`Convert ${unconvertedClips.length} clips to project parts?`)) return;
    
    setBulkConverting(true);
    try {
      await bulkConvertFromClips(unconvertedClips);
    } catch (error) {
      console.error('Failed to bulk convert clips:', error);
      alert('Failed to convert some clips');
    } finally {
      setBulkConverting(false);
    }
  };

  // Send a product-idea clip to the launch pipeline
  const handleSendToLaunchPipeline = async (clip: ClipWithItemName) => {
    if (!user?.uid) return;
    setSendingToLaunchId(clip.id);
    try {
      const product = await createLaunchProductFromClip(clip, user.uid);
      alert(`Product "${product.name}" created in Launch Pipeline!`);
    } catch (error) {
      console.error('Failed to send to launch pipeline:', error);
      alert('Failed to create product in launch pipeline');
    } finally {
      setSendingToLaunchId(null);
    }
  };

  const unconvertedCount = clips.filter(c => !c.convertedToPartId).length;

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="animate-pulse flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-32"></div>
        </div>
      </div>
    );
  }

  if (clips.length === 0) {
    return null;
  }

  // Responsive: show fewer clips on mobile
  const mobileLimit = 4;
  const desktopLimit = 6;
  const displayClips = expanded ? clips : clips.slice(0, window.innerWidth < 640 ? mobileLimit : desktopLimit);
  const hasMore = clips.length > (window.innerWidth < 640 ? mobileLimit : desktopLimit);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
      {/* Header - Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 sm:mb-4">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-yellow-600" />
          <span className="hidden sm:inline">Project Inspiration</span>
          <span className="sm:hidden">Inspiration</span>
          <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-xs font-medium">
            {clips.length}
          </span>
        </h2>
        
        {unconvertedCount > 0 && (
          <button
            onClick={handleBulkConvert}
            disabled={bulkConverting}
            className="flex items-center justify-center gap-2 px-3 py-1.5 bg-[#0A7C8E] text-white text-xs font-medium rounded-lg hover:bg-[#086a7a] disabled:opacity-50 transition-colors w-full sm:w-auto"
          >
            {bulkConverting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Package className="w-3 h-3" />
            )}
            <span className="hidden sm:inline">Convert {unconvertedCount} to Parts</span>
            <span className="sm:hidden">Convert All ({unconvertedCount})</span>
          </button>
        )}
      </div>

      {/* Grid - Responsive sizing */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4">
        {displayClips.map((clip) => (
          <div
            key={clip.id}
            className="group relative bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-all"
          >
            {/* Image - Smaller on mobile */}
            <div className="aspect-square bg-gray-100 relative overflow-hidden">
              <img
                src={clip.thumbnailUrl || clip.imageUrl}
                alt={clip.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              
              {/* Overlay - Always visible on mobile (touch), hover on desktop */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent sm:bg-black/0 sm:group-hover:bg-black/50 transition-all flex items-end sm:items-center justify-center sm:opacity-0 sm:group-hover:opacity-100">
                <a
                  href={clip.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 sm:p-2 bg-white rounded-full hover:bg-gray-100 m-1.5 sm:m-0"
                >
                  <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 text-gray-700" />
                </a>
              </div>

              {/* AI badge */}
              {clip.aiAnalysis && (
                <div className="absolute top-1 right-1 p-0.5 sm:p-1 bg-purple-500 rounded-full">
                  <Sparkles className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-white" />
                </div>
              )}
            </div>

            {/* Info - Compact on mobile */}
            <div className="p-1.5 sm:p-2">
              <p className="text-xs font-medium text-gray-900 truncate">{clip.title}</p>
              
              {/* Linked design item - Hide on very small screens */}
              {clip.designItemId && clip.designItemName && (
                <Link
                  to={`/design/${projectId}/item/${clip.designItemId}`}
                  className="mt-0.5 sm:mt-1 hidden xs:flex items-center gap-1 text-xs text-[#0A7C8E] hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="truncate">{clip.designItemName}</span>
                  <ArrowRight className="w-3 h-3 flex-shrink-0" />
                </Link>
              )}
              
              {/* Actions: Convert to Part or Send to Pipeline */}
              {clip.convertedToPartId ? (
                <div className="mt-0.5 sm:mt-1 flex items-center gap-1 text-xs text-green-600">
                  <Check className="w-3 h-3" />
                  <span className="hidden sm:inline">In Parts Library</span>
                  <span className="sm:hidden">Added</span>
                </div>
              ) : clip.clipType === 'product-idea' ? (
                <button
                  onClick={(e) => { e.stopPropagation(); handleSendToLaunchPipeline(clip); }}
                  disabled={sendingToLaunchId === clip.id}
                  className="mt-0.5 sm:mt-1 flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
                >
                  {sendingToLaunchId === clip.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Rocket className="w-3 h-3" />
                  )}
                  <span className="hidden sm:inline">Send to Pipeline</span>
                  <span className="sm:hidden">Launch</span>
                </button>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); handleConvertToPart(clip); }}
                  disabled={convertingId === clip.id}
                  className="mt-0.5 sm:mt-1 flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 disabled:opacity-50"
                >
                  {convertingId === clip.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Package className="w-3 h-3" />
                  )}
                  <span className="hidden sm:inline">Convert to Part</span>
                  <span className="sm:hidden">Add</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 sm:mt-3 w-full py-2 text-sm text-gray-600 hover:text-gray-900 flex items-center justify-center gap-1 hover:bg-gray-50 rounded-lg transition-colors"
        >
          {expanded ? 'Show less' : `View all ${clips.length}`}
          <ChevronRight className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
      )}
    </div>
  );
}
