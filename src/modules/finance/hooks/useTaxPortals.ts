// ============================================================================
// USE TAX PORTALS HOOK
// DawinOS v2.0 - Financial Management Module
// React hook for tax portal link management
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import type { TaxPortalLink, TaxPortalCategory } from '../types/integrations.types';
import {
  getTaxPortalLinks,
  addTaxPortalLink,
  updateTaxPortalLink,
  deleteTaxPortalLink,
} from '../services/financeAdminService';

export interface UseTaxPortalsOptions {
  companyId: string;
  autoLoad?: boolean;
}

export interface UseTaxPortalsReturn {
  links: TaxPortalLink[];
  loading: boolean;
  error: string | null;

  // CRUD
  addLink: (link: Omit<TaxPortalLink, 'id' | 'isDefault'>) => Promise<TaxPortalLink>;
  updateLink: (linkId: string, updates: Partial<TaxPortalLink>) => Promise<void>;
  removeLink: (linkId: string) => Promise<void>;
  refresh: () => Promise<void>;

  // Grouped
  groupedByCategory: Record<TaxPortalCategory, TaxPortalLink[]>;
}

export function useTaxPortals({
  companyId,
  autoLoad = true,
}: UseTaxPortalsOptions): UseTaxPortalsReturn {
  const [links, setLinks] = useState<TaxPortalLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTaxPortalLinks(companyId);
      setLinks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tax portal links');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const addLink = useCallback(
    async (link: Omit<TaxPortalLink, 'id' | 'isDefault'>) => {
      setError(null);
      try {
        const newLink = await addTaxPortalLink(companyId, link);
        setLinks((prev) => [...prev, newLink].sort((a, b) => a.order - b.order));
        return newLink;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add link');
        throw err;
      }
    },
    [companyId]
  );

  const updateLinkFn = useCallback(
    async (linkId: string, updates: Partial<TaxPortalLink>) => {
      setError(null);
      try {
        await updateTaxPortalLink(companyId, linkId, updates);
        setLinks((prev) =>
          prev.map((l) => (l.id === linkId ? { ...l, ...updates } : l))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update link');
      }
    },
    [companyId]
  );

  const removeLink = useCallback(
    async (linkId: string) => {
      try {
        await deleteTaxPortalLink(companyId, linkId);
        setLinks((prev) => prev.filter((l) => l.id !== linkId));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete link');
      }
    },
    [companyId]
  );

  // Group by category
  const groupedByCategory = links.reduce(
    (acc, link) => {
      if (!acc[link.category]) acc[link.category] = [];
      acc[link.category].push(link);
      return acc;
    },
    {} as Record<TaxPortalCategory, TaxPortalLink[]>
  );

  useEffect(() => {
    if (autoLoad && companyId) {
      refresh();
    }
  }, [autoLoad, companyId, refresh]);

  return {
    links,
    loading,
    error,
    addLink,
    updateLink: updateLinkFn,
    removeLink,
    refresh,
    groupedByCategory,
  };
}
