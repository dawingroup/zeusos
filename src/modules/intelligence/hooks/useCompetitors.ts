// ============================================================================
// USE COMPETITORS HOOK
// DawinOS v2.0 - Market Intelligence Module
// Competitor data fetching and management (Firestore-backed)
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { competitorService } from '../services/competitorService';
import { Competitor, CompetitorFormInput } from '../types/competitor.types';
import { ThreatLevel } from '../constants/competitor.constants';
import { CompetitorFilters } from '../types/competitor.types';

interface UseCompetitorsOptions {
  search?: string;
  sector?: string;
  threatLevel?: ThreatLevel;
}

interface UseCompetitorsReturn {
  competitors: Competitor[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  addCompetitor: (input: CompetitorFormInput, userId: string) => Promise<string>;
  removeCompetitor: (id: string) => Promise<void>;
  toggleTracking: (competitorId: string) => Promise<void>;
  toggleAlerts: (competitorId: string) => Promise<void>;
}

export const useCompetitors = (options: UseCompetitorsOptions = {}): UseCompetitorsReturn => {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCompetitors = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const filters: CompetitorFilters = {};
      if (options.threatLevel) filters.threatLevel = options.threatLevel;
      if (options.search) filters.searchTerm = options.search;

      let results = await competitorService.getCompetitors(filters);

      // Client-side sector filter (maps to industries array)
      if (options.sector) {
        results = results.filter(c =>
          c.industries.includes(options.sector as never)
        );
      }

      setCompetitors(results);
    } catch (err) {
      console.error('Error fetching competitors:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch competitors'));
    } finally {
      setLoading(false);
    }
  }, [options.search, options.sector, options.threatLevel]);

  const addCompetitor = useCallback(async (input: CompetitorFormInput, userId: string): Promise<string> => {
    const id = await competitorService.createCompetitor(input, userId);
    await fetchCompetitors();
    return id;
  }, [fetchCompetitors]);

  const removeCompetitor = useCallback(async (id: string) => {
    await competitorService.deleteCompetitor(id);
    setCompetitors(prev => prev.filter(c => c.id !== id));
  }, []);

  const toggleTracking = useCallback(async (competitorId: string) => {
    const competitor = competitors.find(c => c.id === competitorId);
    if (!competitor) return;
    const newStatus = competitor.status === 'active' ? 'watching' : 'active';
    await competitorService.updateStatus(competitorId, newStatus as never);
    setCompetitors(prev =>
      prev.map(c =>
        c.id === competitorId ? { ...c, status: newStatus as never } : c
      )
    );
  }, [competitors]);

  const toggleAlerts = useCallback(async (competitorId: string) => {
    const competitor = competitors.find(c => c.id === competitorId);
    if (!competitor) return;
    const newFreq = competitor.monitoringFrequency === 'weekly' ? 'monthly' : 'weekly';
    await competitorService.updateCompetitor(competitorId, { monitoringFrequency: newFreq });
    setCompetitors(prev =>
      prev.map(c =>
        c.id === competitorId ? { ...c, monitoringFrequency: newFreq } : c
      )
    );
  }, [competitors]);

  useEffect(() => {
    fetchCompetitors();
  }, [fetchCompetitors]);

  return {
    competitors,
    loading,
    error,
    refresh: fetchCompetitors,
    addCompetitor,
    removeCompetitor,
    toggleTracking,
    toggleAlerts,
  };
};

export default useCompetitors;
