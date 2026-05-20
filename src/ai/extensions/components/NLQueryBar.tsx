/**
 * NLQueryBar Component
 * Natural language query input with suggestions and history
 */

import React, { useState, useRef } from 'react';
import {
  Search,
  Loader2,
  Send,
  X,
  Clock,
  Sparkles,
  Table,
  BarChart3,
  LayoutGrid,
} from 'lucide-react';
import { NLQueryResponse } from '../types/ai-extensions';

interface NLQueryBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  onExecute: () => void;
  isProcessing: boolean;
  history: NLQueryResponse[];
  suggestions?: string[];
  placeholder?: string;
}

export const NLQueryBar: React.FC<NLQueryBarProps> = ({
  query,
  onQueryChange,
  onExecute,
  isProcessing,
  history,
  suggestions = [
    'Show all projects over budget',
    'List deals closing this month',
    'Compare portfolio performance by sector',
    'Find requisitions pending approval',
  ],
  placeholder = 'Ask anything about your data...',
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onExecute();
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      setShowHistory(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    onQueryChange(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleHistoryClick = (item: NLQueryResponse) => {
    onQueryChange(item.query.originalQuery);
    setShowHistory(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => !query && setShowSuggestions(true)}
            onBlur={() =>
              setTimeout(() => {
                setShowSuggestions(false);
                setShowHistory(false);
              }, 200)
            }
            placeholder={placeholder}
            className="w-full pl-10 pr-20 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
            disabled={isProcessing}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {query && (
              <button
                onClick={() => onQueryChange('')}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {history.length > 0 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`p-1 rounded ${showHistory ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <Clock className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <button
          onClick={onExecute}
          disabled={!query.trim() || isProcessing}
          className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isProcessing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && !query && (
        <div className="absolute top-full mt-2 w-full bg-white rounded-xl border border-gray-200 shadow-lg z-50">
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
              <Sparkles className="w-3 h-3" />
              Try asking
            </div>
            <div className="space-y-1">
              {suggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* History Dropdown */}
      {showHistory && history.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-white rounded-xl border border-gray-200 shadow-lg z-50">
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              Recent queries
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {history.slice(0, 5).map((item, i) => (
                <button
                  key={i}
                  onClick={() => handleHistoryClick(item)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="text-sm text-gray-700 truncate">
                    {item.query.originalQuery}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {item.totalCount} results
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * NLQueryResults Component
 * Displays query results with visualization options
 */
interface NLQueryResultsProps {
  response: NLQueryResponse | null;
  isLoading: boolean;
}

export const NLQueryResults: React.FC<NLQueryResultsProps> = ({
  response,
  isLoading,
}) => {
  const [viewMode, setViewMode] = useState<'table' | 'cards' | 'chart'>('table');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Processing query...</span>
      </div>
    );
  }

  if (!response) {
    return null;
  }

  return (
    <div className="mt-4">
      {/* Summary */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600">{response.summary}</p>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
          >
            <Table className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('cards')}
            className={`p-1.5 rounded ${viewMode === 'cards' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('chart')}
            className={`p-1.5 rounded ${viewMode === 'chart' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
          >
            <BarChart3 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Results */}
      {response.results.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No results found</p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                {Object.keys(response.results[0] || {})
                  .filter((key) => key !== 'id')
                  .slice(0, 5)
                  .map((key) => (
                    <th key={key} className="text-left py-2 px-3 font-medium text-gray-600">
                      {key}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {response.results.slice(0, 20).map((row, i) => (
                <tr key={row.id || i} className="border-b border-gray-100 hover:bg-gray-50">
                  {Object.entries(row)
                    .filter(([key]) => key !== 'id')
                    .slice(0, 5)
                    .map(([key, value]) => (
                      <td key={key} className="py-2 px-3 text-gray-700">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value ?? '-')}
                      </td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
          {response.results.length > 20 && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              Showing 20 of {response.results.length} results
            </p>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {response.results.slice(0, 12).map((item, i) => (
            <div key={item.id || i} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="font-medium text-gray-900 truncate">
                {item.name || item.title || `Item ${i + 1}`}
              </h4>
              {item.status && (
                <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                  {item.status}
                </span>
              )}
              {item.amount && (
                <p className="text-sm text-gray-600 mt-2">
                  Amount: {typeof item.amount === 'number' ? item.amount.toLocaleString() : item.amount}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-center text-gray-500">
            <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Chart visualization coming soon</p>
          </div>
        </div>
      )}

      {/* Query confidence */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Query type: {response.query.queryType}</span>
          <span>Confidence: {Math.round(response.query.confidence * 100)}%</span>
        </div>
      </div>
    </div>
  );
};

export default NLQueryBar;
