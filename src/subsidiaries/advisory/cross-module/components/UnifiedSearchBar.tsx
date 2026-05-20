import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Clock, Filter } from 'lucide-react';
import { useUnifiedSearch } from '../hooks/useUnifiedSearch';
import { ModuleType, EntityReference } from '../types/cross-module';

interface UnifiedSearchBarProps {
  userId: string;
  onResultSelect?: (entity: EntityReference) => void;
  placeholder?: string;
  className?: string;
}

const MODULE_ICONS: Record<ModuleType, string> = {
  infrastructure: '🏗️',
  investment: '💰',
  advisory: '📋',
  matflow: '📦'
};

const MODULE_LABELS: Record<ModuleType, string> = {
  infrastructure: 'Infrastructure',
  investment: 'Investment',
  advisory: 'Advisory',
  matflow: 'MatFlow'
};

export const UnifiedSearchBar: React.FC<UnifiedSearchBarProps> = ({
  userId,
  onResultSelect,
  placeholder = 'Search across all modules...',
  className = ''
}) => {
  const {
    query,
    setQuery,
    results,
    suggestions,
    recentSearches,
    loading,
    filters,
    updateFilters,
    search,
    clearResults
  } = useUnifiedSearch(userId);

  const [isOpen, setIsOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      search();
      setIsOpen(true);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleResultClick = (entity: EntityReference) => {
    onResultSelect?.(entity);
    setIsOpen(false);
    clearResults();
  };

  const toggleModuleFilter = (module: ModuleType) => {
    const currentModules = filters.modules || [];
    const newModules = currentModules.includes(module)
      ? currentModules.filter(m => m !== module)
      : [...currentModules, module];
    updateFilters({ modules: newModules.length > 0 ? newModules : undefined });
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-10 pr-20 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <button onClick={clearResults} className="p-1 hover:bg-gray-100 rounded">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-1 hover:bg-gray-100 rounded ${filters.modules?.length ? 'text-blue-600' : 'text-gray-400'}`}
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <div className="text-xs font-medium text-gray-500 mb-2">Filter by Module</div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(MODULE_LABELS) as ModuleType[]).map(module => (
              <button
                key={module}
                onClick={() => toggleModuleFilter(module)}
                className={`px-3 py-1.5 text-sm rounded-full flex items-center gap-1.5 ${
                  filters.modules?.includes(module)
                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                <span>{MODULE_ICONS[module]}</span>
                <span>{MODULE_LABELS[module]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            </div>
          ) : results?.results.length ? (
            <div>
              <div className="px-3 py-2 bg-gray-50 border-b flex items-center gap-2 text-xs">
                {results.facets.modules.map(f => (
                  <span key={f.module} className="text-gray-500">
                    {MODULE_ICONS[f.module]} {f.count}
                  </span>
                ))}
                <span className="ml-auto text-gray-400">
                  {results.total} results ({results.executionTime}ms)
                </span>
              </div>

              {results.results.map(result => (
                <button
                  key={`${result.entity.module}-${result.entity.id}`}
                  onClick={() => handleResultClick(result.entity)}
                  className="w-full px-3 py-2.5 text-left hover:bg-gray-50 border-b last:border-0 flex items-start gap-3"
                >
                  <span className="text-lg">{MODULE_ICONS[result.entity.module]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {result.entity.name}
                    </div>
                    <div className="text-sm text-gray-500 flex items-center gap-2">
                      {result.entity.referenceNumber && (
                        <span className="font-mono">{result.entity.referenceNumber}</span>
                      )}
                      <span className="capitalize">{result.entity.type.replace('_', ' ')}</span>
                    </div>
                    {result.linkedEntities && result.linkedEntities.length > 0 && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                        <span>Linked:</span>
                        {result.linkedEntities.slice(0, 3).map(le => (
                          <span key={le.id} className="bg-gray-100 px-1.5 py-0.5 rounded">
                            {le.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    Score: {result.score.toFixed(1)}
                  </div>
                </button>
              ))}
            </div>
          ) : query.length >= 2 ? (
            <div className="p-4 text-center text-gray-500">No results found</div>
          ) : (
            <div>
              {suggestions.length > 0 && (
                <div className="p-2">
                  <div className="text-xs font-medium text-gray-500 px-2 mb-1">Suggestions</div>
                  {suggestions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => handleResultClick(s)}
                      className="w-full px-2 py-1.5 text-left hover:bg-gray-50 rounded flex items-center gap-2"
                    >
                      <span>{MODULE_ICONS[s.module]}</span>
                      <span className="text-sm">{s.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {recentSearches.length > 0 && (
                <div className="p-2 border-t">
                  <div className="text-xs font-medium text-gray-500 px-2 mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Recent Searches
                  </div>
                  {recentSearches.slice(0, 5).map((s, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setQuery(s);
                        search(s);
                      }}
                      className="w-full px-2 py-1.5 text-left hover:bg-gray-50 rounded text-sm text-gray-600"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UnifiedSearchBar;
