/**
 * Search Service
 * Global search utilities across configured entity types
 */

import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import type { SearchResult } from '@/integration/types';
import { SEARCH_CONFIGS } from '@/integration/constants/navigation.constants';

export interface SearchQuery {
  text: string;
  entityTypes?: string[];
  modules?: string[];
  dateRange?: { start: Date; end: Date };
  limit?: number;
  /** When true, ignores subsidiaryIds allow-list on configs (deep find). */
  includeAllSubsidiaries?: boolean;
}

export interface SearchScope {
  organizationId: string;
  subsidiaryId?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  hasMore: boolean;
  executionTime: number;
}

export async function globalSearch(
  scopeOrOrgId: SearchScope | string,
  searchQuery: SearchQuery
): Promise<SearchResponse> {
  const startTime = Date.now();

  const scope: SearchScope =
    typeof scopeOrOrgId === 'string' ? { organizationId: scopeOrOrgId } : scopeOrOrgId;

  const pageSize = searchQuery.limit || 20;

  const searchText = searchQuery.text.trim();
  if (!searchText) {
    return {
      results: [],
      totalCount: 0,
      hasMore: false,
      executionTime: Date.now() - startTime,
    };
  }

  const searchTerms = searchText
    .toLowerCase()
    .split(' ')
    .map((t) => t.trim())
    .filter(Boolean);

  const candidateConfigs = SEARCH_CONFIGS.filter((cfg) => {
    if (searchQuery.entityTypes?.length && !searchQuery.entityTypes.includes(cfg.type)) {
      return false;
    }
    if (searchQuery.modules?.length && !searchQuery.modules.includes(cfg.module)) {
      return false;
    }
    if (
      !searchQuery.includeAllSubsidiaries &&
      cfg.subsidiaryIds?.length &&
      scope.subsidiaryId &&
      !cfg.subsidiaryIds.includes(scope.subsidiaryId)
    ) {
      return false;
    }
    return true;
  });

  const perCollectionLimit = Math.max(20, pageSize * 2);

  const perConfigResults = await Promise.all(
    candidateConfigs.map(async (cfg) => {
      try {
        const constraints: any[] = [];
        if (cfg.scopeField === 'organizationId' && scope.organizationId) {
          constraints.push(where('organizationId', '==', scope.organizationId));
        } else if (cfg.scopeField === 'subsidiaryId' && scope.subsidiaryId) {
          constraints.push(where('subsidiaryId', '==', scope.subsidiaryId));
        }
        // fullScan collections skip the limit — otherwise limit(N) without a filter
        // returns an arbitrary window of docs and the target record is usually missing.
        if (!cfg.fullScan) {
          constraints.push(limit(perCollectionLimit));
        }

        const snap = await getDocs(query(collection(db, cfg.collection), ...constraints));

        const matches: SearchResult[] = [];
        for (const d of snap.docs) {
          const data = d.data() as Record<string, unknown>;
          const score = calculateSearchScore(data, searchTerms, cfg.searchFields);
          if (score <= 0) continue;

          const title = String(getFieldValue(data, cfg.displayField) ?? d.id);
          const subtitle = cfg.subtitleField
            ? String(getFieldValue(data, cfg.subtitleField) ?? '')
            : undefined;

          matches.push({
            id: d.id,
            type: cfg.type,
            title,
            subtitle: subtitle || undefined,
            module: cfg.module,
            path: cfg.urlTemplate.replace('{id}', d.id),
            icon: cfg.icon,
            score,
            highlights: generateHighlights(data, searchTerms, cfg.searchFields),
          });
        }
        return matches;
      } catch (error) {
        // Permission-denied is expected — user may not have rules/access for this
        // collection. Silently skip so we don't spam the console on every keystroke.
        const code = (error as { code?: string } | null)?.code;
        if (code !== 'permission-denied') {
          console.warn('[SearchService] Search skipped for', cfg.type, code || error);
        }
        return [] as SearchResult[];
      }
    })
  );

  const results = perConfigResults.flat();
  results.sort((a, b) => (b.score || 0) - (a.score || 0));
  const limitedResults = results.slice(0, pageSize);

  return {
    results: limitedResults,
    totalCount: results.length,
    hasMore: results.length > pageSize,
    executionTime: Date.now() - startTime,
  };
}

function calculateSearchScore(
  data: Record<string, unknown>,
  searchTerms: string[],
  searchFields: string[]
): number {
  let score = 0;

  for (const field of searchFields) {
    const value = getFieldValue(data, field);
    if (value == null) continue;

    const fieldValue = String(value).toLowerCase();

    for (const term of searchTerms) {
      if (!term) continue;
      if (!fieldValue.includes(term)) continue;

      if (fieldValue === term) score += 10;
      else if (new RegExp(`\\b${escapeRegExp(term)}\\b`).test(fieldValue)) score += 5;
      else score += 2;
    }
  }

  return score;
}

function generateHighlights(
  data: Record<string, unknown>,
  searchTerms: string[],
  searchFields: string[]
): string[] {
  const highlights: string[] = [];

  for (const field of searchFields) {
    const value = getFieldValue(data, field);
    if (value == null) continue;

    const text = String(value);

    for (const term of searchTerms) {
      if (!term) continue;
      const regex = new RegExp(`(.{0,30})(${escapeRegExp(term)})(.{0,30})`, 'i');
      const match = regex.exec(text);
      if (match) {
        highlights.push(`...${match[1]}**${match[2]}**${match[3]}...`);
      }
    }
  }

  return highlights.slice(0, 3);
}

function getFieldValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc, part) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj as unknown);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}

const RECENT_SEARCHES_KEY = 'dawinos_recent_searches';
const MAX_RECENT_SEARCHES = 10;

export function saveRecentSearch(searchText: string): void {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    const searches: string[] = stored ? JSON.parse(stored) : [];

    const filtered = searches.filter((s) => s !== searchText);
    filtered.unshift(searchText);

    const limited = filtered.slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(limited));
  } catch (error) {
    console.error('[SearchService] Failed to save recent search:', error);
  }
}

export function getRecentSearches(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function clearRecentSearches(): void {
  localStorage.removeItem(RECENT_SEARCHES_KEY);
}

export async function getSearchSuggestions(
  _organizationId: string,
  partialText: string,
  maxSuggestions: number = 5
): Promise<string[]> {
  if (partialText.length < 2) return [];

  const suggestions = new Set<string>();

  for (const search of getRecentSearches()) {
    if (search.toLowerCase().includes(partialText.toLowerCase())) {
      suggestions.add(search);
    }
    if (suggestions.size >= maxSuggestions) break;
  }

  return Array.from(suggestions);
}

export async function searchModule(
  scope: SearchScope | string,
  moduleId: string,
  searchText: string,
  pageSize: number = 20
): Promise<SearchResult[]> {
  const response = await globalSearch(scope, {
    text: searchText,
    modules: [moduleId],
    limit: pageSize,
  });

  return response.results;
}

export async function quickSearch(
  scope: SearchScope | string,
  entityType: string,
  searchText: string,
  limit_: number = 5
): Promise<{ id: string; title: string; subtitle?: string }[]> {
  const response = await globalSearch(scope, {
    text: searchText,
    entityTypes: [entityType],
    limit: limit_,
  });

  return response.results.map((r) => ({
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
  }));
}
