/**
 * SearchResultCard Component
 * Renders a single reverse image search result for selection.
 */

import React from 'react';
import { ExternalLink } from 'lucide-react';
import type { ReverseSearchMatch } from '../types';

interface SearchResultCardProps {
  match: ReverseSearchMatch;
  selected: boolean;
  onSelect: () => void;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return '';
  }
}

export const SearchResultCard: React.FC<SearchResultCardProps> = ({ match, selected, onSelect }) => {
  const domain = match.pageUrl ? extractDomain(match.pageUrl) : extractDomain(match.url);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        relative group rounded-lg overflow-hidden border-2 transition-all text-left
        ${selected
          ? 'border-[#1d1d1f] ring-2 ring-[#1d1d1f] ring-offset-1'
          : 'border-gray-200 hover:border-gray-400'
        }
      `}
    >
      {/* Image */}
      <div className="aspect-square bg-gray-100 overflow-hidden">
        <img
          src={match.url}
          alt={match.pageTitle || 'Search result'}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23f3f4f6" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%239ca3af" font-size="12">No preview</text></svg>';
          }}
        />
      </div>

      {/* Info overlay */}
      <div className="p-2 bg-white">
        {match.pageTitle && (
          <p className="text-xs text-gray-700 font-medium truncate">
            {match.pageTitle}
          </p>
        )}
        {domain && (
          <p className="text-[10px] text-gray-400 truncate flex items-center gap-1">
            <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
            {domain}
          </p>
        )}
      </div>

      {/* Selection indicator */}
      {selected && (
        <div className="absolute top-2 right-2 w-5 h-5 bg-[#1d1d1f] rounded-full flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* Score badge */}
      {match.score != null && match.score > 0 && (
        <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
          {Math.round(match.score * 100)}% match
        </div>
      )}
    </button>
  );
};
