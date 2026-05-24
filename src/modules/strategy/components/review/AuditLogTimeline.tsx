// ============================================================================
// AUDIT LOG TIMELINE - Strategy Plan Update Tool
// Vertical timeline of section audit entries
// ============================================================================

import { useState } from 'react';
import {
  Clock,
  CheckCircle,
  XCircle,
  Wand2,
  Pencil,
  Eye,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import type { SectionAuditEntry, ChangeType } from '../../types/documentSection.types';

// ----------------------------------------------------------------------------
// Props
// ----------------------------------------------------------------------------

interface AuditLogTimelineProps {
  entries: SectionAuditEntry[];
  isLoading: boolean;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

const CHANGE_TYPE_CONFIG: Record<ChangeType, { label: string; Icon: typeof Clock; color: string }> = {
  rewrite: { label: 'Rewrite Applied', Icon: Wand2, color: 'text-purple-500 bg-purple-50' },
  minor_edit: { label: 'Minor Edit', Icon: Pencil, color: 'text-[var(--rag-blue)] bg-[var(--rag-blue-soft)]' },
  assessment_only: { label: 'Assessment', Icon: Eye, color: 'text-indigo-500 bg-indigo-50' },
  manual_edit: { label: 'Manual Edit', Icon: Pencil, color: 'text-muted-foreground bg-[var(--bg-sunken)]' },
  new_section: { label: 'Section Added', Icon: Plus, color: 'text-[var(--rag-green)] bg-[var(--rag-green-soft)]' },
  removed: { label: 'Section Removed', Icon: Trash2, color: 'text-[var(--rag-red)] bg-[var(--rag-red-soft)]' },
};

function formatTimestamp(ts: { seconds: number } | Date | null): string {
  if (!ts) return 'Unknown';
  const date = 'seconds' in ts ? new Date(ts.seconds * 1000) : ts;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function AuditLogTimeline({ entries, isLoading }: AuditLogTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading audit log...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No audit entries yet.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-5 top-0 bottom-0 w-px bg-[var(--bg-sunken)]" />

      <div className="space-y-4">
        {entries.map((entry) => {
          const config = CHANGE_TYPE_CONFIG[entry.changeType] || CHANGE_TYPE_CONFIG.assessment_only;
          const EntryIcon = config.Icon;
          const isExpanded = entry.id === expandedId;
          const scoreChanged =
            entry.alignmentScoreBefore !== entry.alignmentScoreAfter &&
            entry.alignmentScoreAfter !== null;

          return (
            <div key={entry.id} className="relative pl-12">
              {/* Icon */}
              <div
                className={`absolute left-2 w-7 h-7 rounded-full flex items-center justify-center ${config.color}`}
              >
                <EntryIcon className="h-3.5 w-3.5" />
              </div>

              {/* Card */}
              <div className="rounded-lg border bg-card shadow-sm">
                <div
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-[var(--bg-sunken)]"
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {config.label}
                      </span>
                      <span className="text-xs text-[var(--fg-tertiary)]">
                        {entry.sectionHeading}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatTimestamp(entry.timestamp as { seconds: number })}
                      {entry.approvedBy && (
                        <> &middot; by {entry.approvedBy}</>
                      )}
                    </p>
                  </div>

                  {/* Score change indicator */}
                  {scoreChanged && (
                    <div className="flex items-center gap-1 mr-2 text-xs">
                      <span className="text-[var(--fg-tertiary)]">
                        {entry.alignmentScoreBefore ?? '—'}
                      </span>
                      <span className="text-[var(--fg-tertiary)]">&rarr;</span>
                      <span
                        className={
                          (entry.alignmentScoreAfter || 0) > (entry.alignmentScoreBefore || 0)
                            ? 'text-[var(--rag-green)] font-medium'
                            : 'text-[var(--rag-red)] font-medium'
                        }
                      >
                        {entry.alignmentScoreAfter}
                      </span>
                    </div>
                  )}

                  {entry.changeType === 'rewrite' ? (
                    <CheckCircle className="h-4 w-4 text-[var(--rag-green)] flex-shrink-0" />
                  ) : entry.changeType === 'removed' ? (
                    <XCircle className="h-4 w-4 text-[var(--rag-red)] flex-shrink-0" />
                  ) : null}

                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-[var(--fg-tertiary)] ml-2" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-[var(--fg-tertiary)] ml-2" />
                  )}
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2 border-t pt-2">
                    {/* Rationale */}
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Rationale:</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{entry.rationale}</p>
                    </div>

                    {/* Before/After Summaries */}
                    {entry.beforeSummary !== entry.afterSummary && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] font-medium text-muted-foreground uppercase">
                            Before
                          </span>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3">
                            {entry.beforeSummary}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] font-medium text-muted-foreground uppercase">
                            After
                          </span>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3">
                            {entry.afterSummary}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Data Sources */}
                    {entry.dataSourcesQueried.length > 0 && (
                      <div>
                        <span className="text-[10px] font-medium text-muted-foreground uppercase">
                          Data Sources
                        </span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {entry.dataSourcesQueried.map((src) => (
                            <span
                              key={src}
                              className="text-[10px] px-1 py-0.5 bg-[var(--bg-sunken)] text-muted-foreground rounded"
                            >
                              {src.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
