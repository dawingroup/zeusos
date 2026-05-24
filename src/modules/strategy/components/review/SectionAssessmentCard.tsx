// ============================================================================
// SECTION ASSESSMENT CARD - Strategy Plan Update Tool
// Displays assessment score, gaps, data sources, and recommendation
// ============================================================================

import {
  AlertTriangle,
  CheckCircle,
  Flag,
  Wand2,
  Pencil,
  Minus,
} from 'lucide-react';
import type { SectionAssessment } from '../../types/documentSection.types';
import { ALIGNMENT_SCORE_LABELS } from '../../constants/sectionMapping.constants';

// ----------------------------------------------------------------------------
// Props
// ----------------------------------------------------------------------------

interface SectionAssessmentCardProps {
  assessment: SectionAssessment;
  onGenerateRewrite?: () => void;
  isRewriting?: boolean;
}

// ----------------------------------------------------------------------------
// Score Gauge (circular)
// ----------------------------------------------------------------------------

function ScoreGauge({ score }: { score: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 5) * circumference;
  const remaining = circumference - progress;

  const colors: Record<number, { stroke: string; text: string; bg: string }> = {
    5: { stroke: '#16a34a', text: 'text-green-700', bg: 'bg-green-50' },
    4: { stroke: '#65a30d', text: 'text-lime-700', bg: 'bg-lime-50' },
    3: { stroke: '#ca8a04', text: 'text-yellow-700', bg: 'bg-yellow-50' },
    2: { stroke: '#ea580c', text: 'text-orange-700', bg: 'bg-orange-50' },
    1: { stroke: '#dc2626', text: 'text-red-700', bg: 'bg-red-50' },
  };

  const color = colors[score] || colors[3];
  const label = ALIGNMENT_SCORE_LABELS[score]?.label || 'Unknown';

  return (
    <div className={`flex flex-col items-center p-4 rounded-lg ${color.bg}`}>
      <svg width="88" height="88" className="-rotate-90">
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="6"
        />
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke={color.stroke}
          strokeWidth="6"
          strokeDasharray={`${progress} ${remaining}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ marginTop: '16px' }}>
        <span className={`text-2xl font-bold ${color.text}`}>{score}</span>
        <span className="text-[10px] text-muted-foreground">/5</span>
      </div>
      <p className={`text-xs font-medium mt-2 ${color.text}`}>{label}</p>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Recommendation Badge
// ----------------------------------------------------------------------------

const RECOMMENDATION_CONFIG = {
  rewrite: { label: 'Rewrite Recommended', Icon: Wand2, className: 'bg-purple-100 text-purple-700' },
  minor_update: { label: 'Minor Update', Icon: Pencil, className: 'bg-blue-100 text-blue-700' },
  no_action: { label: 'No Action Needed', Icon: CheckCircle, className: 'bg-green-100 text-green-700' },
  flag_for_ceo: { label: 'Flag for CEO', Icon: Flag, className: 'bg-red-100 text-red-700' },
} as const;

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function SectionAssessmentCard({
  assessment,
  onGenerateRewrite,
  isRewriting,
}: SectionAssessmentCardProps) {
  const recConfig = RECOMMENDATION_CONFIG[assessment.recommendation];
  const RecIcon = recConfig.Icon;

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h4 className="text-sm font-semibold text-foreground truncate">
          {assessment.sectionHeading}
        </h4>
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${recConfig.className}`}>
          <RecIcon className="h-3 w-3" />
          {recConfig.label}
        </span>
      </div>

      <div className="p-4 grid grid-cols-[auto_1fr] gap-4">
        {/* Score Gauge */}
        <div className="relative">
          <ScoreGauge score={assessment.score} />
        </div>

        {/* Details */}
        <div className="space-y-3">
          {/* Gaps */}
          {assessment.gaps.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Gaps Identified
              </h5>
              <ul className="space-y-1">
                {assessment.gaps.map((gap, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <AlertTriangle className="h-3 w-3 text-yellow-500 mt-0.5 flex-shrink-0" />
                    {gap}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Outdated Claims */}
          {assessment.outdatedClaims.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Outdated Claims
              </h5>
              <ul className="space-y-1">
                {assessment.outdatedClaims.map((claim, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Minus className="h-3 w-3 text-red-400 mt-0.5 flex-shrink-0" />
                    {claim}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Data Sources */}
          {assessment.dataSourcesQueried.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Data Sources
              </h5>
              <div className="flex flex-wrap gap-1">
                {assessment.dataSourcesQueried.map((source) => (
                  <span
                    key={source}
                    className="text-[10px] px-1.5 py-0.5 bg-[var(--bg-sunken)] text-muted-foreground rounded"
                  >
                    {source.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action */}
      {assessment.recommendation !== 'no_action' && onGenerateRewrite && (
        <div className="px-4 pb-4">
          <button
            onClick={onGenerateRewrite}
            disabled={isRewriting}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
          >
            <Wand2 className="h-4 w-4" />
            {isRewriting ? 'Generating Rewrite...' : 'Generate AI Rewrite'}
          </button>
        </div>
      )}
    </div>
  );
}
