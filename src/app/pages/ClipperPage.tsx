/**
 * ClipperPage
 * Main page for the Dawin Clipper module.
 * Migrated to portal redesign tokens + shared <KPICard> / <KPIGrid>.
 */

import { useState } from 'react';
import {
  Image,
  Download,
  Lightbulb,
  Puzzle,
  ExternalLink,
  Sparkles,
  Search,
  Tag,
} from 'lucide-react';
import { ClipGallery } from '@/subsidiaries/finishes/clipper/components';
import { useClips } from '@/subsidiaries/finishes/clipper/hooks';
import type { DesignClip } from '@/subsidiaries/finishes/clipper/types';
import { ClipDetail } from '@/subsidiaries/finishes/clipper/components/ClipDetail';
import { ClipEditModal } from '@/subsidiaries/finishes/clipper/components/ClipEditModal';
import { QuickActionsGrid, KPICard, KPIGrid } from '@/shared/components/data-display';
import { Button } from '@/core/components/ui/button';

export default function ClipperPage() {
  const { clips, loading, deleteClip, updateClip } = useClips();
  const [selectedClip, setSelectedClip] = useState<DesignClip | null>(null);
  const [editingClip, setEditingClip] = useState<DesignClip | null>(null);
  const [_isDeleting, setIsDeleting] = useState(false);

  const inspirationCount = clips.filter((c) => c.clipType === 'inspiration').length;
  const partsCount = clips.filter((c) => c.clipType === 'parts-source').length;
  const procurementCount = clips.filter((c) => c.clipType === 'procurement').length;
  const aiAnalyzedCount = clips.filter((c) => c.analysisStatus === 'completed').length;

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[1640px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2">
            <Image className="h-5 w-5" style={{ color: 'var(--accent)' }} />
            Design Clipper
          </h1>
          <p
            className="mt-1 text-[12.5px]"
            style={{ color: 'var(--fg-secondary)' }}
          >
            Capture and organize design inspiration from anywhere on the web
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
          >
            <a
              href="https://chrome.google.com/webstore"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Get Extension
              <ExternalLink className="w-3 h-3" />
            </a>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <KPIGrid cols={5}>
        <KPICard
          label="Total Clips"
          value={clips.length}
          sparkColor="var(--boysenberry)"
        />
        <KPICard
          label="Inspiration"
          value={inspirationCount}
          sparkColor="var(--rag-amber)"
        />
        <KPICard
          label="Parts Source"
          value={partsCount}
          sparkColor="var(--boysenberry)"
        />
        <KPICard
          label="Procurement"
          value={procurementCount}
          sparkColor="var(--rag-green)"
        />
        <KPICard
          label="AI Analyzed"
          value={aiAnalyzedCount}
          delta={
            clips.length > 0
              ? `${Math.round((aiAnalyzedCount / clips.length) * 100)}% of clips`
              : undefined
          }
          trend="up"
          sparkColor="var(--accent)"
        />
      </KPIGrid>

      {/* Quick Actions */}
      <QuickActionsGrid
        columns={4}
        actions={[
          {
            label: 'Get Extension',
            description: 'Install Chrome clipper',
            icon: Download,
            onClick: () => window.open('https://chrome.google.com/webstore', '_blank'),
          },
          {
            label: 'Browse Clips',
            description: 'Search your collection',
            icon: Search,
            onClick: () => {},
          },
          {
            label: 'By Category',
            description: 'Filter by clip type',
            icon: Tag,
            onClick: () => {},
          },
          {
            label: 'AI Analysis',
            description: 'Analyze unprocessed clips',
            icon: Sparkles,
            onClick: () => {},
          },
        ]}
      />

      {/* How it works — shown when no clips */}
      {!loading && clips.length === 0 && (
        <div
          className="rounded-[10px] border p-8"
          style={{
            backgroundColor: 'var(--accent-soft)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <h2 className="text-[14.5px] font-semibold mb-4 m-0" style={{ color: 'var(--fg-primary)' }}>
            How it works
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { n: 1, icon: Download, title: 'Install Extension', body: 'Get the Dawin Clipper Chrome extension' },
              { n: 2, icon: Lightbulb, title: 'Clip Designs', body: 'Browse Wayfair, Pinterest, Houzz and clip furniture you like' },
              { n: 3, icon: Puzzle, title: 'Use in Projects', body: 'Link clips to design items as inspiration' },
            ].map((step) => (
              <div key={step.n} className="text-center">
                <div
                  className="w-10 h-10 rounded-full grid place-items-center mx-auto mb-3"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
                >
                  <span className="text-[15px] font-semibold tabular-nums">{step.n}</span>
                </div>
                <h3
                  className="text-[13.5px] font-semibold m-0"
                  style={{ color: 'var(--fg-primary)' }}
                >
                  {step.title}
                </h3>
                <p
                  className="text-[12px] mt-1 m-0"
                  style={{ color: 'var(--fg-secondary)' }}
                >
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clip Gallery */}
      <div
        className="rounded-[10px] border bg-[var(--bg-surface)] shadow-[var(--shadow-sm)] p-4"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <ClipGallery onClipSelect={(clip) => setSelectedClip(clip)} />
      </div>

      {/* Clip Detail Modal */}
      {selectedClip && (
        <ClipDetail
          clip={selectedClip}
          onClose={() => setSelectedClip(null)}
          onEdit={() => {
            setEditingClip(selectedClip);
            setSelectedClip(null);
          }}
          onDelete={async () => {
            if (window.confirm('Are you sure you want to delete this clip?')) {
              setIsDeleting(true);
              try {
                await deleteClip(selectedClip.id);
                setSelectedClip(null);
              } catch (error) {
                console.error('Failed to delete clip:', error);
                alert('Failed to delete clip');
              } finally {
                setIsDeleting(false);
              }
            }
          }}
        />
      )}

      {/* Edit Modal */}
      {editingClip && (
        <ClipEditModal
          clip={editingClip}
          onClose={() => setEditingClip(null)}
          onSave={async (updates) => {
            try {
              await updateClip(editingClip.id, updates);
              setEditingClip(null);
            } catch (error) {
              console.error('Failed to update clip:', error);
              alert('Failed to update clip');
            }
          }}
        />
      )}
    </div>
  );
}
