// ============================================================================
// useJournalEntries HOOK
// ZeusOS v2.0 - Financial Management Module
// React hooks for journal entry management
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { DocumentSnapshot } from 'firebase/firestore';
import { journalService } from '../services/journalService';
import { useCurrentUserId } from '@/contexts/AuthContext';
import {
  JournalEntry,
  JournalEntryCreateInput,
  JournalEntryUpdateInput,
  JournalFilter,
  JournalSort,
} from '../types/journal.types';

/**
 * Hook options for useJournalEntries
 */
export interface UseJournalEntriesOptions {
  companyId: string;
  filter?: JournalFilter;
  sort?: JournalSort;
  pageSize?: number;
  autoFetch?: boolean;
}

/**
 * Hook return type for useJournalEntries
 */
export interface UseJournalEntriesReturn {
  journals: JournalEntry[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  createJournal: (input: JournalEntryCreateInput) => Promise<JournalEntry>;
  updateJournal: (id: string, input: JournalEntryUpdateInput) => Promise<JournalEntry>;
  postJournal: (id: string) => Promise<JournalEntry>;
  reverseJournal: (id: string, reversalDate: Date, description?: string) => Promise<JournalEntry>;
  voidJournal: (id: string, reason: string) => Promise<JournalEntry>;
}

/**
 * Hook for managing journal entries list
 */
export function useJournalEntries(options: UseJournalEntriesOptions): UseJournalEntriesReturn {
  const { companyId, filter, sort, pageSize = 50, autoFetch = true } = options;
  const userId = useCurrentUserId();

  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchJournals = useCallback(async (isLoadMore = false) => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await journalService.getAll(
        companyId,
        filter,
        sort,
        pageSize,
        isLoadMore ? lastDoc || undefined : undefined
      );

      if (isLoadMore) {
        setJournals((prev) => [...prev, ...result.journals]);
      } else {
        setJournals(result.journals);
      }

      setLastDoc(result.lastDoc);
      setHasMore(result.journals.length === pageSize);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch journals'));
    } finally {
      setLoading(false);
    }
  }, [companyId, filter, sort, pageSize, lastDoc]);

  const refresh = useCallback(async () => {
    setLastDoc(null);
    setHasMore(true);
    await fetchJournals(false);
  }, [fetchJournals]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    await fetchJournals(true);
  }, [fetchJournals, hasMore, loading]);

  const createJournal = useCallback(async (input: JournalEntryCreateInput): Promise<JournalEntry> => {
    if (!companyId) throw new Error('Company ID is required');
    const journal = await journalService.create(companyId, userId, input);
    setJournals((prev) => [journal, ...prev]);
    return journal;
  }, [companyId]);

  const updateJournal = useCallback(async (id: string, input: JournalEntryUpdateInput): Promise<JournalEntry> => {
    if (!companyId) throw new Error('Company ID is required');
    const updated = await journalService.update(companyId, id, userId, input);
    setJournals((prev) => prev.map((j) => (j.id === id ? updated : j)));
    return updated;
  }, [companyId]);

  const postJournal = useCallback(async (id: string): Promise<JournalEntry> => {
    if (!companyId) throw new Error('Company ID is required');
    const posted = await journalService.post(companyId, id, userId);
    setJournals((prev) => prev.map((j) => (j.id === id ? posted : j)));
    return posted;
  }, [companyId]);

  const reverseJournal = useCallback(async (
    id: string,
    reversalDate: Date,
    description?: string
  ): Promise<JournalEntry> => {
    if (!companyId) throw new Error('Company ID is required');
    const reversal = await journalService.reverse(companyId, id, userId, reversalDate, description);
    // Add reversal and update original
    setJournals((prev) => [reversal, ...prev]);
    await refresh();
    return reversal;
  }, [companyId, refresh]);

  const voidJournal = useCallback(async (id: string, reason: string): Promise<JournalEntry> => {
    if (!companyId) throw new Error('Company ID is required');
    const voided = await journalService.void(companyId, id, userId, reason);
    setJournals((prev) => prev.map((j) => (j.id === id ? voided : j)));
    return voided;
  }, [companyId]);

  useEffect(() => {
    if (autoFetch && companyId) {
      fetchJournals(false);
    }
  }, [autoFetch, companyId, filter, sort]);

  return {
    journals,
    loading,
    error,
    hasMore,
    refresh,
    loadMore,
    createJournal,
    updateJournal,
    postJournal,
    reverseJournal,
    voidJournal,
  };
}

/**
 * Hook for single journal entry
 */
export interface UseJournalEntryOptions {
  companyId: string;
  journalId: string;
  autoFetch?: boolean;
}

export interface UseJournalEntryReturn {
  journal: JournalEntry | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  update: (input: JournalEntryUpdateInput) => Promise<JournalEntry>;
  post: () => Promise<JournalEntry>;
  reverse: (reversalDate: Date, description?: string) => Promise<JournalEntry>;
  void: (reason: string) => Promise<JournalEntry>;
}

export function useJournalEntry(options: UseJournalEntryOptions): UseJournalEntryReturn {
  const { companyId, journalId, autoFetch = true } = options;
  const userId = useCurrentUserId();

  const [journal, setJournal] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchJournal = useCallback(async () => {
    if (!companyId || !journalId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await journalService.getById(companyId, journalId);
      setJournal(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch journal'));
    } finally {
      setLoading(false);
    }
  }, [companyId, journalId]);

  const refresh = useCallback(async () => {
    await fetchJournal();
  }, [fetchJournal]);

  const update = useCallback(async (input: JournalEntryUpdateInput): Promise<JournalEntry> => {
    if (!companyId || !journalId) throw new Error('Company ID and Journal ID are required');
    const updated = await journalService.update(companyId, journalId, userId, input);
    setJournal(updated);
    return updated;
  }, [companyId, journalId]);

  const post = useCallback(async (): Promise<JournalEntry> => {
    if (!companyId || !journalId) throw new Error('Company ID and Journal ID are required');
    const posted = await journalService.post(companyId, journalId, userId);
    setJournal(posted);
    return posted;
  }, [companyId, journalId]);

  const reverse = useCallback(async (reversalDate: Date, description?: string): Promise<JournalEntry> => {
    if (!companyId || !journalId) throw new Error('Company ID and Journal ID are required');
    return journalService.reverse(companyId, journalId, userId, reversalDate, description);
  }, [companyId, journalId]);

  const voidJournal = useCallback(async (reason: string): Promise<JournalEntry> => {
    if (!companyId || !journalId) throw new Error('Company ID and Journal ID are required');
    const voided = await journalService.void(companyId, journalId, userId, reason);
    setJournal(voided);
    return voided;
  }, [companyId, journalId]);

  useEffect(() => {
    if (autoFetch && companyId && journalId) {
      fetchJournal();
    }
  }, [autoFetch, companyId, journalId]);

  return {
    journal,
    loading,
    error,
    refresh,
    update,
    post,
    reverse,
    void: voidJournal,
  };
}

/**
 * Hook for account ledger
 */
export interface UseAccountLedgerOptions {
  companyId: string;
  accountId: string;
  fiscalYear?: number;
  dateFrom?: Date;
  dateTo?: Date;
  autoFetch?: boolean;
}

export interface UseAccountLedgerReturn {
  entries: JournalEntry[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useAccountLedger(options: UseAccountLedgerOptions): UseAccountLedgerReturn {
  const { companyId, accountId, fiscalYear, dateFrom, dateTo, autoFetch = true } = options;

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchLedger = useCallback(async () => {
    if (!companyId || !accountId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await journalService.getAccountLedger(companyId, accountId, {
        fiscalYear,
        dateFrom,
        dateTo,
      });
      setEntries(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch ledger'));
    } finally {
      setLoading(false);
    }
  }, [companyId, accountId, fiscalYear, dateFrom, dateTo]);

  const refresh = useCallback(async () => {
    await fetchLedger();
  }, [fetchLedger]);

  useEffect(() => {
    if (autoFetch && companyId && accountId) {
      fetchLedger();
    }
  }, [autoFetch, companyId, accountId, fiscalYear, dateFrom, dateTo]);

  return {
    entries,
    loading,
    error,
    refresh,
  };
}
