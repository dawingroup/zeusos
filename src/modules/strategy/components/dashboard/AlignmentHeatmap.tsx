// ============================================================================
// ALIGNMENT HEATMAP - Strategy Plan Update Tool
// Grid of sections coloured by alignment score (red/amber/green)
// ============================================================================

import type { DocumentSection, SectionType } from '../../types/documentSection.types';
import { ALIGNMENT_SCORE_LABELS } from '../../constants/sectionMapping.constants';

// ----------------------------------------------------------------------------
// Props
// ----------------------------------------------------------------------------

interface AlignmentHeatmapProps {
  sections: DocumentSection[];
  onSectionClick?: (sectionId: string) => void;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

const SCORE_BG: Record<number, string> = {
  5: 'bg-[var(--rag-green)]',
  4: 'bg-lime-400',
  3: 'bg-[var(--rag-amber)]',
  2: 'bg-[var(--rag-amber)]',
  1: 'bg-[var(--rag-red)]',
  0: 'bg-[var(--bg-sunken)]',
};

const SCORE_TEXT: Record<number, string> = {
  5: 'text-white',
  4: 'text-white',
  3: 'text-foreground',
  2: 'text-white',
  1: 'text-white',
  0: 'text-[var(--fg-tertiary)]',
};

const TYPE_LABELS: Record<SectionType, string> = {
  financial: 'FIN',
  market: 'MKT',
  operations: 'OPS',
  growth: 'GRW',
  risk: 'RSK',
  people: 'PPL',
  governance: 'GOV',
  general: 'GEN',
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function AlignmentHeatmap({ sections, onSectionClick }: AlignmentHeatmapProps) {
  if (sections.length === 0) {
    return (
      <div className="text-center py-4 text-[var(--fg-tertiary)] text-sm">
        No sections to display
      </div>
    );
  }

  // Compute stats
  const assessed = sections.filter((s) => s.alignmentScore !== null);
  const avgScore = assessed.length > 0
    ? Math.round(assessed.reduce((sum, s) => sum + (s.alignmentScore || 0), 0) / assessed.length * 10) / 10
    : 0;

  return (
    <div>
      {/* Summary */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">{assessed.length}</span>/{sections.length} assessed
        </div>
        {avgScore > 0 && (
          <div className="text-sm">
            Avg: <span className="font-semibold">{avgScore}/5</span>
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-1.5">
        {sections.map((section) => {
          const score = section.alignmentScore || 0;
          const bg = SCORE_BG[score];
          const text = SCORE_TEXT[score];

          return (
            <button
              key={section.id}
              onClick={() => onSectionClick?.(section.id)}
              className={`${bg} ${text} rounded-md p-2 text-center transition-transform hover:scale-105 hover:shadow-md`}
              title={`${section.headingText}\nScore: ${score ? `${score}/5 — ${ALIGNMENT_SCORE_LABELS[score]?.label}` : 'Not assessed'}`}
            >
              <div className="text-[10px] font-medium opacity-80">
                {TYPE_LABELS[section.sectionType]}
              </div>
              <div className="text-lg font-bold leading-tight">
                {score || '—'}
              </div>
              <div className="text-[9px] truncate mt-0.5 opacity-90">
                {section.headingText.length > 12
                  ? section.headingText.substring(0, 12) + '…'
                  : section.headingText}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-2 mt-3">
        {[1, 2, 3, 4, 5].map((score) => (
          <div key={score} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded ${SCORE_BG[score]}`} />
            <span className="text-[10px] text-muted-foreground">{score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
