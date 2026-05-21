// ============================================================================
// SECTION REVIEW CARD COMPONENT
// ZeusOS v2.0 - CEO Strategy Command
// Reusable card for each strategy review section with score, status, notes
// ============================================================================

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Sparkles,
  Star,
  Plus,
  X,
  Wand2,
  Copy,
  Check,
} from 'lucide-react';
import type { SectionReview, ReviewSectionStatus } from '../../types/strategy.types';
import {
  REVIEW_SECTION_STATUS_LABELS,
  REVIEW_SECTION_STATUS_COLORS,
  REVIEW_SCORE_LABELS,
  REVIEW_SCORE_COLORS,
  REVIEW_SECTION_LABELS,
  REVIEW_SECTION_DESCRIPTIONS,
  type ReviewSectionKey,
} from '../../constants/strategyReview.constants';

export interface SectionReviewCardProps {
  sectionKey: ReviewSectionKey;
  review: SectionReview;
  onChange: (review: SectionReview) => void;
  onRequestAI?: () => void;
  isAILoading?: boolean;
  children?: React.ReactNode;
  readOnly?: boolean;
}

export const SectionReviewCard: React.FC<SectionReviewCardProps> = ({
  sectionKey,
  review,
  onChange,
  onRequestAI,
  isAILoading = false,
  children,
  readOnly = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [newRecommendation, setNewRecommendation] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const label = REVIEW_SECTION_LABELS[sectionKey];
  const description = REVIEW_SECTION_DESCRIPTIONS[sectionKey];
  const statusLabel = REVIEW_SECTION_STATUS_LABELS[review.status] || 'Not Started';
  const statusColor = REVIEW_SECTION_STATUS_COLORS[review.status] || 'bg-gray-100 text-gray-600';

  const handleStatusChange = (status: ReviewSectionStatus) => {
    onChange({ ...review, status, lastReviewedAt: new Date().toISOString() });
  };

  const handleScoreChange = (score: number) => {
    onChange({ ...review, score });
  };

  const handleAddRecommendation = () => {
    const text = newRecommendation.trim();
    if (!text) return;
    onChange({ ...review, recommendations: [...review.recommendations, text] });
    setNewRecommendation('');
  };

  const handleRemoveRecommendation = (index: number) => {
    const updated = [...review.recommendations];
    updated.splice(index, 1);
    onChange({ ...review, recommendations: updated });
  };

  const handleApplyAISuggestions = () => {
    const parts: string[] = [];
    if (review.currentContent) {
      parts.push('## AI Analysis\n' + review.currentContent);
    }
    if (review.recommendations.length > 0) {
      parts.push('\n## Recommendations\n' + review.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n'));
    }
    if (parts.length > 0) {
      onChange({ ...review, updatedContent: parts.join('\n\n') });
    }
  };

  const handleCopyContent = (field: 'currentContent' | 'updatedContent') => {
    const text = review[field];
    if (text) {
      navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900">{label}</h3>
          </div>
          <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${statusColor}`}>
            {statusLabel}
          </span>
          {review.score > 0 && (
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-3.5 h-3.5 ${s <= review.score ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`}
                />
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onRequestAI && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRequestAI();
              }}
              disabled={isAILoading}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-100 rounded-lg hover:bg-purple-200 disabled:opacity-50 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isAILoading ? 'Analyzing...' : 'AI Assist'}
            </button>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Body */}
      {isExpanded && (
        <div className="px-5 pb-5 space-y-5 border-t border-gray-100">
          {/* Description */}
          <p className="text-sm text-gray-500 pt-3">{description}</p>

          {/* Custom content (BMC, SWOT, etc.) */}
          {children}

          {/* Review Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Current Content (AI Analysis) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Current State (AI Analysis)
                </label>
                {review.currentContent && (
                  <button
                    onClick={() => handleCopyContent('currentContent')}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                    title="Copy to clipboard"
                  >
                    {copiedField === 'currentContent' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}
              </div>
              <textarea
                value={review.currentContent}
                onChange={(e) => onChange({ ...review, currentContent: e.target.value })}
                placeholder="Document the current state of this section..."
                rows={6}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                readOnly={readOnly}
              />
            </div>

            {/* Updated Content (User Editable) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Revised Strategy
                </label>
                <div className="flex items-center gap-2">
                  {review.currentContent && !readOnly && (
                    <button
                      onClick={handleApplyAISuggestions}
                      className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded-md transition-colors"
                      title="Pre-fill with AI analysis and recommendations"
                    >
                      <Wand2 className="w-3 h-3" />
                      Apply AI Suggestions
                    </button>
                  )}
                  {review.updatedContent && (
                    <button
                      onClick={() => handleCopyContent('updatedContent')}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                      title="Copy to clipboard"
                    >
                      {copiedField === 'updatedContent' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>
              <textarea
                value={review.updatedContent}
                onChange={(e) => onChange({ ...review, updatedContent: e.target.value })}
                placeholder="Write your improved strategy content here. Use 'Apply AI Suggestions' to pre-fill from the analysis..."
                rows={6}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                readOnly={readOnly}
              />
            </div>
          </div>

          {/* Review Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Review Notes
            </label>
            <textarea
              value={review.reviewNotes}
              onChange={(e) => onChange({ ...review, reviewNotes: e.target.value })}
              placeholder="Add notes, observations, and commentary..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              readOnly={readOnly}
            />
          </div>

          {/* Score & Status Row */}
          {!readOnly && (
            <div className="flex flex-wrap items-center gap-4 pt-2">
              {/* Score */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Score</label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      onClick={() => handleScoreChange(s)}
                      className="p-0.5 hover:scale-110 transition-transform"
                      title={REVIEW_SCORE_LABELS[s]}
                    >
                      <Star
                        className={`w-5 h-5 ${s <= review.score ? 'text-amber-400 fill-amber-400' : 'text-gray-300 hover:text-amber-300'}`}
                      />
                    </button>
                  ))}
                  {review.score > 0 && (
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${REVIEW_SCORE_COLORS[review.score]}`}>
                      {REVIEW_SCORE_LABELS[review.score]}
                    </span>
                  )}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select
                  value={review.status}
                  onChange={(e) => handleStatusChange(e.target.value as ReviewSectionStatus)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="not_started">Not Started</option>
                  <option value="in_review">In Review</option>
                  <option value="needs_update">Needs Update</option>
                  <option value="approved">Approved</option>
                </select>
              </div>
            </div>
          )}

          {/* Recommendations */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recommendations ({review.recommendations.length})
            </label>
            <div className="space-y-1.5 mb-2">
              {review.recommendations.map((rec, i) => (
                <div key={i} className="group flex items-start gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="text-xs font-medium text-blue-600 mt-0.5">{i + 1}.</span>
                  <span className="flex-1 text-sm text-blue-800">{rec}</span>
                  {!readOnly && (
                    <button
                      onClick={() => handleRemoveRecommendation(i)}
                      className="text-blue-300 hover:text-red-500 opacity-0 group-hover:opacity-100 flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {!readOnly && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newRecommendation}
                  onChange={(e) => setNewRecommendation(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddRecommendation()}
                  placeholder="Add a recommendation..."
                  className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={handleAddRecommendation}
                  disabled={!newRecommendation.trim()}
                  className="p-1.5 text-gray-500 hover:text-blue-600 disabled:opacity-30"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SectionReviewCard;
