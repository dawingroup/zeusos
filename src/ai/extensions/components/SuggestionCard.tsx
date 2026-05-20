/**
 * SuggestionCard Component
 * Displays AI suggestion with actions
 */

import React, { useState } from 'react';
import {
  Lightbulb,
  Link,
  AlertTriangle,
  TrendingUp,
  Search,
  CheckCircle,
  X,
  ThumbsDown,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AISuggestion, SuggestionType, SuggestionPriority } from '../types/ai-extensions';

interface SuggestionCardProps {
  suggestion: AISuggestion;
  onApply: (suggestion: AISuggestion) => void;
  onDismiss: (id: string, feedback?: 'not_helpful' | 'incorrect') => void;
  compact?: boolean;
}

const TYPE_ICONS: Record<SuggestionType, React.ReactNode> = {
  entity_link: <Link className="w-4 h-4" />,
  next_action: <CheckCircle className="w-4 h-4" />,
  risk_alert: <AlertTriangle className="w-4 h-4" />,
  optimization: <TrendingUp className="w-4 h-4" />,
  anomaly: <AlertTriangle className="w-4 h-4" />,
  completion: <CheckCircle className="w-4 h-4" />,
  similar_entity: <Search className="w-4 h-4" />,
  trend_insight: <Lightbulb className="w-4 h-4" />,
};

const PRIORITY_STYLES: Record<SuggestionPriority, { bg: string; border: string; text: string }> = {
  critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
  high: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  medium: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
  low: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  info: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700' },
};

const PRIORITY_BORDER_LEFT: Record<SuggestionPriority, string> = {
  critical: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-yellow-500',
  low: 'border-l-blue-500',
  info: 'border-l-gray-400',
};

export const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  onApply,
  onDismiss,
  compact = false,
}) => {
  const [showFeedback, setShowFeedback] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleDismiss = (feedback?: 'not_helpful' | 'incorrect') => {
    onDismiss(suggestion.id, feedback);
    setShowFeedback(false);
  };

  const priorityStyle = PRIORITY_STYLES[suggestion.priority];

  if (compact) {
    return (
      <div
        className={`flex items-center gap-3 p-3 rounded-lg border ${priorityStyle.bg} ${priorityStyle.border}`}
      >
        <div className={`flex-shrink-0 ${priorityStyle.text}`}>
          {TYPE_ICONS[suggestion.type]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{suggestion.title}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onApply(suggestion)}
            className="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
          >
            Apply
          </button>
          <button
            onClick={() => handleDismiss()}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-l-4 ${priorityStyle.border} ${PRIORITY_BORDER_LEFT[suggestion.priority]} bg-white shadow-sm`}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${priorityStyle.bg} ${priorityStyle.text}`}>
              {TYPE_ICONS[suggestion.type]}
            </div>
            <div>
              <h4 className="font-medium text-gray-900">{suggestion.title}</h4>
              <p className="text-sm text-gray-600 mt-0.5">{suggestion.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${priorityStyle.bg} ${priorityStyle.text}`}
            >
              {suggestion.priority}
            </span>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
              {Math.round(suggestion.confidence * 100)}%
            </span>
          </div>
        </div>

        {/* Expandable reasoning */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 mt-3 text-sm text-gray-500 hover:text-gray-700"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Why this suggestion?
        </button>

        {expanded && (
          <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
            {suggestion.reasoning}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
          <div className="flex gap-2">
            <button
              onClick={() => onApply(suggestion)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              {suggestion.actionType === 'navigate' && <ExternalLink className="w-3.5 h-3.5" />}
              {suggestion.actionType === 'link' && <Link className="w-3.5 h-3.5" />}
              Apply
            </button>

            {!showFeedback ? (
              <button
                onClick={() => setShowFeedback(true)}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Dismiss
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleDismiss('not_helpful')}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                >
                  <ThumbsDown className="w-3 h-3" />
                  Not helpful
                </button>
                <button
                  onClick={() => handleDismiss('incorrect')}
                  className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                >
                  Incorrect
                </button>
                <button
                  onClick={() => setShowFeedback(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {suggestion.targetModule && (
            <span className="text-xs text-gray-400">
              → {suggestion.targetModule}/{suggestion.targetEntityType}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * SuggestionList Component
 * Renders a list of suggestions
 */
interface SuggestionListProps {
  suggestions: AISuggestion[];
  onApply: (suggestion: AISuggestion) => void;
  onDismiss: (id: string, feedback?: 'not_helpful' | 'incorrect') => void;
  compact?: boolean;
  maxVisible?: number;
}

export const SuggestionList: React.FC<SuggestionListProps> = ({
  suggestions,
  onApply,
  onDismiss,
  compact = false,
  maxVisible = 5,
}) => {
  const [showAll, setShowAll] = useState(false);
  const visibleSuggestions = showAll ? suggestions : suggestions.slice(0, maxVisible);
  const hasMore = suggestions.length > maxVisible;

  if (suggestions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No suggestions available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visibleSuggestions.map((suggestion) => (
        <SuggestionCard
          key={suggestion.id}
          suggestion={suggestion}
          onApply={onApply}
          onDismiss={onDismiss}
          compact={compact}
        />
      ))}

      {hasMore && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
        >
          Show {suggestions.length - maxVisible} more suggestions
        </button>
      )}
    </div>
  );
};

export default SuggestionCard;
