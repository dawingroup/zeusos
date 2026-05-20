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
  minor_edit: { label: 'Minor Edit', Icon: Pencil, color: 'text-blue-500 bg-blue-50' },
  assessment_only: { label: 'Assessment', Icon: Eye, color: 'text-indigo-500 bg-indigo-50' },
  manual_edit: { label: 'Manual Edit', Icon: Pencil, color: 'text-gray-500 bg-gray-50' },
  new_section: { label: 'Section Added', Icon: Plus, color: 'text-green-500 bg-green-50' },
  removed: { label: 'Section Removed', Icon: Trash2, color: 'text-red-500 bg-red-50' },
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
      <div className="flex items-center justify-center py-8 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading audit log...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No audit entries yet.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200" />

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
              <div className="rounded-lg border bg-white shadow-sm">
                <div
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {config.label}
                      </span>
                      <span className="text-xs text-gray-400">
                        {entry.sectionHeading}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatTimestamp(entry.timestamp as { seconds: number })}
                      {entry.approvedBy && (
                        <> &middot; by {entry.approvedBy}</>
                      )}
                    </p>
                  </div>

                  {/* Score change indicator */}
                  {scoreChanged && (
                    <div className="flex items-center gap-1 mr-2 text-xs">
                      <span className="text-gray-400">
                        {entry.alignmentScoreBefore ?? '—'}
                      </span>
                      <span className="text-gray-300">&rarr;</span>
                      <span
                        className={
                          (entry.alignmentScoreAfter || 0) > (entry.alignmentScoreBefore || 0)
                            ? 'text-green-600 font-medium'
                            : 'text-red-600 font-medium'
                        }
                      >
                        {entry.alignmentScoreAfter}
                      </span>
                    </div>
                  )}

                  {entry.changeType === 'rewrite' ? (
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : entry.changeType === 'removed' ? (
                    <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  ) : null}

                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-gray-400 ml-2" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400 ml-2" />
                  )}
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2 border-t pt-2">
                    {/* Rationale */}
                    <div>
                      <span className="text-xs font-medium text-gray-500">Rationale:</span>
                      <p className="text-xs text-gray-700 mt-0.5">{entry.rationale}</p>
                    </div>

                    {/* Before/After Summaries */}
                    {entry.beforeSummary !== entry.afterSummary && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] font-medium text-gray-500 uppercase">
                            Before
                          </span>
                          <p className="text-xs text-gray-600 mt-0.5 line-clamp-3">
                            {entry.beforeSummary}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] font-medium text-gray-500 uppercase">
                            After
                          </span>
                          <p className="text-xs text-gray-600 mt-0.5 line-clamp-3">
                            {entry.afterSummary}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Data Sources */}
                    {entry.dataSourcesQueried.length > 0 && (
                      <div>
                        <span className="text-[10px] font-medium text-gray-500 uppercase">
                          Data Sources
                        </span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {entry.dataSourcesQueried.map((src) => (
                            <span
                              key={src}
                              className="text-[10px] px-1 py-0.5 bg-gray-100 text-gray-600 rounded"
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
