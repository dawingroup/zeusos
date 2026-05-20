/**
 * NameCandidateCard Component
 * Display card for AI-generated product name candidates
 */

import { Check, RefreshCw, TrendingUp, Search, Sparkles } from 'lucide-react';
import type { NameCandidate } from '../../types/ai.types';

interface NameCandidateCardProps {
  candidate: NameCandidate;
  isSelected?: boolean;
  onSelect: () => void;
  onRegenerate?: () => void;
  showRegenerate?: boolean;
}

function ScoreBar({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  const getColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-gray-600">
          <Icon className="w-3 h-3" />
          {label}
        </span>
        <span className="font-medium text-gray-900">{value}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all ${getColor(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export function NameCandidateCard({ 
  candidate, 
  isSelected, 
  onSelect, 
  onRegenerate,
  showRegenerate = true,
}: NameCandidateCardProps) {
  const averageScore = Math.round(
    (candidate.scores.brandFit + candidate.scores.seoScore + candidate.scores.uniqueness) / 3
  );

  return (
    <div 
      className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-md ${
        isSelected 
          ? 'border-[#872E5C] bg-[#872E5C]/5 shadow-md' 
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
      onClick={onSelect}
    >
      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#872E5C] rounded-full flex items-center justify-center">
          <Check className="w-4 h-4 text-white" />
        </div>
      )}

      {/* Header */}
      <div className="mb-3">
        <h4 className="text-lg font-semibold text-gray-900">{candidate.name}</h4>
        <p className="text-sm text-gray-500 font-mono">/{candidate.handle}</p>
      </div>

      {/* Rationale */}
      <p className="text-sm text-gray-600 mb-4 leading-relaxed">
        {candidate.rationale}
      </p>

      {/* Scores */}
      <div className="space-y-2 mb-4">
        <ScoreBar label="Brand Fit" value={candidate.scores.brandFit} icon={Sparkles} />
        <ScoreBar label="SEO Score" value={candidate.scores.seoScore} icon={Search} />
        <ScoreBar label="Uniqueness" value={candidate.scores.uniqueness} icon={TrendingUp} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            averageScore >= 80 ? 'bg-green-100 text-green-700' :
            averageScore >= 60 ? 'bg-yellow-100 text-yellow-700' :
            'bg-red-100 text-red-700'
          }`}>
            Avg: {averageScore}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {showRegenerate && onRegenerate && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRegenerate();
              }}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Regenerate similar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              isSelected
                ? 'bg-[#872E5C] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {isSelected ? 'Selected' : 'Select'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NameCandidateCard;
