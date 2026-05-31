import React from 'react';
import { ArrowRight, Calendar, CheckCircle2, MoreHorizontal, Target, User } from 'lucide-react';
import type { OKRObjective } from '../../types/okr.types';
import {
  CONFIDENCE_LEVEL,
  OKR_LEVEL_LABELS,
  OKR_STATUS_LABELS,
  formatProgress,
  formatScore,
  getScoreColor,
} from '../../constants/okr.constants';

interface ObjectiveCardProps {
  objective: OKRObjective;
  onOpen: (id: string) => void;
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  active: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  deferred: 'bg-amber-50 text-amber-700 border-amber-200',
};

const CONFIDENCE_DOT_CLASS: Record<string, string> = {
  [CONFIDENCE_LEVEL.ON_TRACK]: 'bg-green-500',
  [CONFIDENCE_LEVEL.AT_RISK]: 'bg-amber-500',
  [CONFIDENCE_LEVEL.OFF_TRACK]: 'bg-red-500',
};

function overallConfidence(o: OKRObjective): string {
  if (o.keyResults.length === 0) return CONFIDENCE_LEVEL.ON_TRACK;
  const scores = o.keyResults.map((kr) => {
    if (kr.confidence === CONFIDENCE_LEVEL.ON_TRACK) return 3;
    if (kr.confidence === CONFIDENCE_LEVEL.AT_RISK) return 2;
    return 1;
  });
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (avg > 2.5) return CONFIDENCE_LEVEL.ON_TRACK;
  if (avg > 1.5) return CONFIDENCE_LEVEL.AT_RISK;
  return CONFIDENCE_LEVEL.OFF_TRACK;
}

export const ObjectiveCard: React.FC<ObjectiveCardProps> = ({ objective, onOpen }) => {
  const completedKRs = objective.keyResults.filter((kr) => kr.isComplete).length;
  const totalKRs = objective.keyResults.length;
  const confidence = overallConfidence(objective);
  const scoreColor = getScoreColor(objective.score);

  return (
    <button
      type="button"
      onClick={() => onOpen(objective.id)}
      className="w-full text-left bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                STATUS_BADGE_CLASS[objective.status] || STATUS_BADGE_CLASS.draft
              }`}
            >
              {OKR_STATUS_LABELS[objective.status]}
            </span>
            <span className="text-[11px] text-gray-500 uppercase tracking-wide">
              {OKR_LEVEL_LABELS[objective.level]}
            </span>
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${CONFIDENCE_DOT_CLASS[confidence]}`} />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">{objective.title}</h3>
          {objective.description && (
            <p className="mt-1 text-[12px] text-gray-500 line-clamp-1">{objective.description}</p>
          )}
        </div>
        <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors flex-shrink-0 mt-0.5" />
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-1.5 rounded-full transition-all"
            style={{
              width: `${Math.min(objective.progress || 0, 100)}%`,
              backgroundColor: scoreColor,
            }}
          />
        </div>
        <span
          className="text-xs font-semibold tabular-nums w-12 text-right"
          style={{ color: scoreColor }}
        >
          {formatProgress(objective.progress || 0)}
        </span>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-gray-500">
        <span className="inline-flex items-center gap-1">
          <Target className="h-3 w-3" />
          {totalKRs} {totalKRs === 1 ? 'KR' : 'KRs'}
        </span>
        {totalKRs > 0 && (
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {completedKRs}/{totalKRs} done
          </span>
        )}
        {objective.ownerName && (
          <span className="inline-flex items-center gap-1 truncate">
            <User className="h-3 w-3" />
            <span className="truncate max-w-[120px]">{objective.ownerName}</span>
          </span>
        )}
        {objective.lastCheckInDate && (
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {objective.lastCheckInDate.toDate().toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        )}
        {objective.score > 0 && (
          <span className="ml-auto font-medium" style={{ color: scoreColor }}>
            {formatScore(objective.score)}
          </span>
        )}
      </div>

      {objective.tags && objective.tags.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
          {objective.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 bg-gray-50 text-gray-600 rounded border border-gray-200"
            >
              {tag}
            </span>
          ))}
          {objective.tags.length > 4 && (
            <span className="text-[10px] text-gray-400">+{objective.tags.length - 4}</span>
          )}
        </div>
      )}
    </button>
  );
};

export const ObjectiveCardMenuButton: React.FC<{ onClick: (e: React.MouseEvent) => void }> = ({
  onClick,
}) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onClick(e);
    }}
    className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
    aria-label="Actions"
  >
    <MoreHorizontal className="h-4 w-4" />
  </button>
);
