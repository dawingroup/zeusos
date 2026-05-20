/**
 * ClipReviewQueue Component
 * Shows unlinked Clipper clips eligible for material conversion.
 * Displayed as a tab in the Materials Library page.
 */

import { useState, useEffect } from 'react';
import {
  Image,
  ExternalLink,
  Sparkles,
  Tag,
  DollarSign,
  Ruler,
  Palette,
  Package,
  Plus,
} from 'lucide-react';
import { Card, CardContent } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Input } from '@/core/components/ui/input';
import {
  subscribeToUnlinkedMaterialClips,
  type FirestoreClipRecord,
} from '../../services/clipToMaterialService';
import { AIEnhancementDialog } from './AIEnhancementDialog';
import { ManualClipDialog } from './ManualClipDialog';

interface ClipReviewQueueProps {
  userId: string;
}

export function ClipReviewQueue({ userId }: ClipReviewQueueProps) {
  const [clips, setClips] = useState<FirestoreClipRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedClip, setSelectedClip] = useState<FirestoreClipRecord | null>(null);
  const [showManualClip, setShowManualClip] = useState(false);

  // Real-time subscription to material clips (matches clipper gallery pattern)
  useEffect(() => {
    if (!userId) {
      setClips([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToUnlinkedMaterialClips(
      userId,
      (newClips) => {
        setClips(newClips);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [userId]);

  const filteredClips = search
    ? clips.filter(
        (c) =>
          c.title.toLowerCase().includes(search.toLowerCase()) ||
          c.brand?.toLowerCase().includes(search.toLowerCase()) ||
          c.materials?.some((m) => m.toLowerCase().includes(search.toLowerCase())),
      )
    : clips;

  const handleConversionComplete = () => {
    setSelectedClip(null);
    // List auto-refreshes via real-time subscription
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {filteredClips.length} clip{filteredClips.length !== 1 ? 's' : ''} ready for conversion
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-1.5" onClick={() => setShowManualClip(true)}>
            <Plus className="h-3.5 w-3.5" />
            Manual Clip
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search clips by title, brand, or material..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Empty state */}
      {filteredClips.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <h3 className="text-lg font-medium">No clips to convert</h3>
            <p className="text-muted-foreground mt-1 max-w-md">
              {search
                ? 'Try adjusting your search'
                : 'Clip materials from the web using the Clipper extension, or use Manual Clip to upload a photo or paste a product URL.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        /* Clip cards grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClips.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              onConvert={() => setSelectedClip(clip)}
            />
          ))}
        </div>
      )}

      {/* AI Enhancement Dialog */}
      {selectedClip && (
        <AIEnhancementDialog
          open={!!selectedClip}
          clip={selectedClip}
          userId={userId}
          onClose={() => setSelectedClip(null)}
          onComplete={handleConversionComplete}
        />
      )}

      {/* Manual Clip Dialog */}
      <ManualClipDialog
        open={showManualClip}
        onClose={() => setShowManualClip(false)}
        userId={userId}
      />
    </div>
  );
}

// ============================================
// Clip Card Sub-component
// ============================================

interface ClipCardProps {
  clip: FirestoreClipRecord;
  onConvert: () => void;
}

function ClipCard({ clip, onConvert }: ClipCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      {/* Image */}
      <div className="relative aspect-video bg-muted">
        {clip.imageUrl ? (
          <img
            src={clip.thumbnailUrl || clip.imageUrl}
            alt={clip.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Image className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )}
        {clip.clipType && (
          <Badge
            variant="secondary"
            className="absolute top-2 left-2 text-xs capitalize"
          >
            {clip.clipType.replace('-', ' ')}
          </Badge>
        )}
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Title */}
        <h3 className="font-medium text-sm line-clamp-2">{clip.title}</h3>

        {/* Metadata chips */}
        <div className="flex flex-wrap gap-1.5">
          {clip.brand && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs">
              <Tag className="h-3 w-3" />
              {clip.brand}
            </span>
          )}
          {clip.price && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs">
              <DollarSign className="h-3 w-3" />
              {clip.price.formatted || `${clip.price.amount} ${clip.price.currency || ''}`}
            </span>
          )}
          {clip.dimensions && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs">
              <Ruler className="h-3 w-3" />
              {[clip.dimensions.width, clip.dimensions.height, clip.dimensions.depth]
                .filter(Boolean)
                .join(' × ')}{' '}
              {clip.dimensions.unit || 'mm'}
            </span>
          )}
          {clip.materials && clip.materials.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-xs">
              <Palette className="h-3 w-3" />
              {clip.materials.slice(0, 2).join(', ')}
              {clip.materials.length > 2 && ` +${clip.materials.length - 2}`}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <a
            href={clip.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3" />
            Source
          </a>
          <Button size="sm" className="gap-1.5" onClick={onConvert}>
            <Sparkles className="h-3.5 w-3.5" />
            Convert to Material
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
