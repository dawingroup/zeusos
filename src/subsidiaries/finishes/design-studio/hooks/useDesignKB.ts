/**
 * useDesignKB — Search and browse Design Knowledge Base entries
 */
import { useQuery } from '@tanstack/react-query';
import {
  searchEntries,
  getEntry,
  getWikiArticleContent,
} from '../services/knowledgeBase.service';
import type { DKBEntryType } from '../constants/knowledgeBase.constants';

const DKB_KEYS = {
  all: ['designKnowledgeBase'] as const,
  search: (query: string, entryType?: DKBEntryType) =>
    [...DKB_KEYS.all, 'search', query, entryType] as const,
  detail: (id: string) => [...DKB_KEYS.all, 'detail', id] as const,
  article: (path: string) => [...DKB_KEYS.all, 'article', path] as const,
};

/** Search DKB entries by query and optional type filter */
export function useDKBSearch(
  searchQuery: string,
  entryType?: DKBEntryType,
  enabled = true,
) {
  return useQuery({
    queryKey: DKB_KEYS.search(searchQuery, entryType),
    queryFn: () => searchEntries(searchQuery, entryType),
    enabled: enabled && searchQuery.length >= 2,
  });
}

/** Fetch a single DKB entry by ID */
export function useDKBEntry(entryId: string | undefined) {
  return useQuery({
    queryKey: DKB_KEYS.detail(entryId || ''),
    queryFn: () => getEntry(entryId!),
    enabled: !!entryId,
  });
}

/** Fetch wiki article markdown content */
export function useWikiArticle(articlePath: string | undefined) {
  return useQuery({
    queryKey: DKB_KEYS.article(articlePath || ''),
    queryFn: () => getWikiArticleContent(articlePath!),
    enabled: !!articlePath,
  });
}
