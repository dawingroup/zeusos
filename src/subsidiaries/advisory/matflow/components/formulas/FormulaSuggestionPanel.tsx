/**
 * Formula Suggestion Panel Component
 * Displays AI-powered formula suggestions for BOQ items
 */

import React, { useCallback } from 'react';
import {
  Sparkles,
  Calculator,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Check,
  Loader2,
} from 'lucide-react';
import { useFormulaSuggestions, useAISuggestions } from '../../hooks/useFormulaSuggestions';
import type { FormulaSuggestion } from '../../ai/matchers';
import { SuggestionConfidence } from './SuggestionConfidence';

interface FormulaSuggestionPanelProps {
  description: string;
  unit: string;
  currentFormula?: string;
  onSelectFormula: (formulaCode: string) => void;
  showAIButton?: boolean;
  compact?: boolean;
}

export const FormulaSuggestionPanel: React.FC<FormulaSuggestionPanelProps> = ({
  description,
  unit,
  currentFormula,
  onSelectFormula,
  showAIButton = true,
  compact = false,
}) => {
  const {
    suggestions: quickSuggestions,
    loading: quickLoading,
    selectSuggestion,
    hasSuggestions,
  } = useFormulaSuggestions(description, unit);

  const {
    suggestions: aiSuggestions,
    loading: aiLoading,
    fetchSuggestions: fetchAISuggestions,
  } = useAISuggestions(description, unit);

  // Use AI suggestions if available, otherwise quick suggestions
  const suggestions = aiSuggestions.length > 0 ? aiSuggestions : quickSuggestions;
  const loading = quickLoading || aiLoading;

  const handleSelect = useCallback(async (suggestion: FormulaSuggestion) => {
    await selectSuggestion(suggestion);
    onSelectFormula(suggestion.formulaCode);
  }, [selectSuggestion, onSelectFormula]);

  if (!description || description.length < 5) {
    return null;
  }

  if (compact) {
    return (
      <CompactSuggestions
        suggestions={suggestions}
        loading={loading}
        currentFormula={currentFormula}
        onSelect={handleSelect}
      />
    );
  }

  return (
    <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <h4 className="font-medium text-purple-900">Formula Suggestions</h4>
        </div>
        
        {showAIButton && !aiLoading && aiSuggestions.length === 0 && (
          <button
            onClick={fetchAISuggestions}
            className="flex items-center gap-1 px-2 py-1 text-xs text-purple-600 hover:bg-purple-100 rounded"
          >
            <TrendingUp size={14} />
            Analyze
          </button>
        )}
        
        {aiLoading && (
          <div className="flex items-center gap-1 text-xs text-purple-600">
            <Loader2 size={14} className="animate-spin" />
            Analyzing...
          </div>
        )}
      </div>

      {/* Suggestions list */}
      {loading && !hasSuggestions ? (
        <div className="flex items-center gap-2 text-sm text-purple-600">
          <Loader2 size={16} className="animate-spin" />
          Finding matching formulas...
        </div>
      ) : suggestions.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <AlertCircle size={16} />
          No matching formulas found. Try using AI analysis.
        </div>
      ) : (
        <div className="space-y-2">
          {suggestions.map((suggestion, index) => (
            <SuggestionCard
              key={suggestion.formulaCode}
              suggestion={suggestion}
              isSelected={currentFormula === suggestion.formulaCode}
              isTopMatch={index === 0}
              onSelect={() => handleSelect(suggestion)}
            />
          ))}
        </div>
      )}

      {/* Source indicator */}
      {suggestions.length > 0 && (
        <div className="mt-3 pt-2 border-t border-purple-200/50">
          <div className="flex items-center gap-1 text-xs text-purple-500">
            {aiSuggestions.length > 0 ? (
              <>
                <Sparkles size={12} />
                AI-powered suggestions
              </>
            ) : (
              <>
                <Calculator size={12} />
                Pattern-matched suggestions
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Suggestion card component
 */
interface SuggestionCardProps {
  suggestion: FormulaSuggestion;
  isSelected: boolean;
  isTopMatch: boolean;
  onSelect: () => void;
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  isSelected,
  isTopMatch,
  onSelect,
}) => {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isSelected}
      className={`
        w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all
        ${isSelected
          ? 'bg-purple-600 text-white'
          : 'bg-white hover:bg-purple-100 border border-purple-100'
        }
      `}
    >
      <SuggestionConfidence
        confidence={suggestion.confidence}
        isSelected={isSelected}
      />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${isSelected ? 'text-white' : 'text-gray-900'}`}>
            {suggestion.formulaName}
          </span>
          {isTopMatch && !isSelected && (
            <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">
              Best match
            </span>
          )}
        </div>
        <div className={`text-sm ${isSelected ? 'text-purple-200' : 'text-gray-500'}`}>
          {suggestion.formulaCode} • {suggestion.category}
        </div>
        {suggestion.reasoning && (
          <p className={`text-xs mt-1 ${isSelected ? 'text-purple-200' : 'text-gray-400'}`}>
            {suggestion.reasoning}
          </p>
        )}
      </div>
      
      {isSelected ? (
        <Check size={20} />
      ) : (
        <ChevronRight size={20} className="text-gray-400" />
      )}
    </button>
  );
};

/**
 * Compact suggestions for inline display
 */
interface CompactSuggestionsProps {
  suggestions: FormulaSuggestion[];
  loading: boolean;
  currentFormula?: string;
  onSelect: (suggestion: FormulaSuggestion) => void;
}

const CompactSuggestions: React.FC<CompactSuggestionsProps> = ({
  suggestions,
  loading,
  currentFormula,
  onSelect,
}) => {
  if (loading) {
    return (
      <div className="inline-flex items-center gap-1 text-xs text-purple-500">
        <Loader2 size={12} className="animate-spin" />
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  const topSuggestion = suggestions[0];
  const isSelected = currentFormula === topSuggestion.formulaCode;

  return (
    <button
      type="button"
      onClick={() => onSelect(topSuggestion)}
      disabled={isSelected}
      className={`
        inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs
        ${isSelected
          ? 'bg-purple-600 text-white'
          : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
        }
      `}
    >
      <Sparkles size={12} />
      {topSuggestion.formulaCode}
      <span className={isSelected ? 'text-purple-200' : 'text-purple-400'}>
        {Math.round(topSuggestion.confidence * 100)}%
      </span>
    </button>
  );
};

export default FormulaSuggestionPanel;
