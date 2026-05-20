/**
 * RevisionTimeline — Vertical timeline showing design revision history
 *
 * Phase A placeholder: displays basic revision entries.
 * Phase F will populate with full revision diff data and editing controls.
 */

import { GitBranch, Upload, Cpu, Pencil, Image } from 'lucide-react';
import type { RevisionEntry, RevisionStatus, GenerationSource } from '../types/workshop-viewer.types';

const STATUS_BADGE: Record<RevisionStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Draft' },
  in_review: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'In Review' },
  editing: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Editing' },
  final: { bg: 'bg-green-100', text: 'text-green-700', label: 'Final' },
};

const SOURCE_ICON: Record<GenerationSource, typeof GitBranch> = {
  parametric: Cpu,
  ai_mesh: Image,
  manual_upload: Upload,
  external_edit: Pencil,
};

const SOURCE_LABEL: Record<GenerationSource, string> = {
  parametric: 'Parametric',
  ai_mesh: 'AI Generated',
  manual_upload: 'Uploaded',
  external_edit: 'External Edit',
};

interface RevisionTimelineProps {
  revisions: RevisionEntry[];
  activeRevisionId?: string | null;
  onSelectRevision?: (id: string) => void;
}

export default function RevisionTimeline({
  revisions,
  activeRevisionId,
  onSelectRevision,
}: RevisionTimelineProps) {
  if (revisions.length === 0) {
    return (
      <div className="p-3 text-center text-xs text-muted-foreground">
        <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p>No revisions yet</p>
        <p className="text-[10px] mt-1">
          Revisions will appear here when models are generated or uploaded.
        </p>
      </div>
    );
  }

  return (
    <div className="p-2">
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">
        Revisions ({revisions.length})
      </div>
      <div className="relative pl-4">
        {/* Vertical timeline line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

        {revisions.map((rev, idx) => {
          const isActive = rev.id === activeRevisionId;
          const badge = STATUS_BADGE[rev.status];
          const SourceIcon = SOURCE_ICON[rev.source] || Upload;

          return (
            <button
              key={rev.id}
              onClick={() => onSelectRevision?.(rev.id)}
              className={`
                relative w-full text-left mb-2 pl-4 pr-2 py-1.5 rounded-md text-xs
                transition-colors
                ${isActive
                  ? 'bg-primary/10 border border-primary/30'
                  : 'hover:bg-muted/50'
                }
              `}
            >
              {/* Timeline dot */}
              <div
                className={`
                  absolute left-[-9px] top-3 w-3 h-3 rounded-full border-2
                  ${isActive
                    ? 'bg-primary border-primary'
                    : idx === 0
                      ? 'bg-background border-primary'
                      : 'bg-background border-border'
                  }
                `}
              />

              <div className="flex items-center gap-1.5">
                <span className="font-semibold">R{rev.revisionNumber}</span>
                <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${badge.bg} ${badge.text}`}>
                  {badge.label}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-0.5 text-muted-foreground text-[10px]">
                <SourceIcon className="h-3 w-3" />
                <span>{SOURCE_LABEL[rev.source]}</span>
                <span>·</span>
                <span>{new Date(rev.createdAt).toLocaleDateString()}</span>
              </div>
              {rev.editNotes && (
                <div className="mt-0.5 text-[10px] text-muted-foreground truncate">
                  {rev.editNotes}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
