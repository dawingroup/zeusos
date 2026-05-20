/**
 * useSmartConsolidation
 *
 * React hook for smart consolidation opportunities.
 * Shows when other MOs need materials from the same supplier.
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  ConsolidationOpportunity,
  ConsolidationSummary,
} from '../services/smartConsolidationService';
import {
  getConsolidationOpportunitiesForSupplier,
  getConsolidationSummary,
  getPendingRequirementIdsForSupplier,
  consolidateRequirementsIntoPO,
  formatConsolidationMessage,
} from '../services/smartConsolidationService';

interface UseSmartConsolidationForSupplierOptions {
  supplierId: string | null;
  subsidiaryId: string;
  /** MO to exclude from opportunities (e.g., current MO) */
  excludeMoId?: string;
}

/**
 * Hook to get consolidation opportunities for a specific supplier.
 * Use this when a supplier is selected in the Create PO dialog.
 */
export function useSmartConsolidationForSupplier({
  supplierId,
  subsidiaryId,
  excludeMoId,
}: UseSmartConsolidationForSupplierOptions) {
  const [opportunity, setOpportunity] = useState<ConsolidationOpportunity | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOpportunity = useCallback(async () => {
    if (!supplierId) {
      setOpportunity(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getConsolidationOpportunitiesForSupplier(
        supplierId,
        subsidiaryId,
        excludeMoId,
      );
      setOpportunity(data);
    } catch (e) {
      setError((e as Error).message);
      setOpportunity(null);
    } finally {
      setLoading(false);
    }
  }, [supplierId, subsidiaryId, excludeMoId]);

  useEffect(() => {
    fetchOpportunity();
  }, [fetchOpportunity]);

  // Get formatted message for UI
  const message = opportunity ? formatConsolidationMessage(opportunity) : null;

  // Get all requirement IDs for "Add all" action
  const getRequirementIds = useCallback(async () => {
    if (!supplierId) return [];
    return getPendingRequirementIdsForSupplier(supplierId, subsidiaryId, excludeMoId);
  }, [supplierId, subsidiaryId, excludeMoId]);

  // Consolidate selected requirements into a PO
  const consolidate = useCallback(
    async (requirementIds: string[], userId: string) => {
      if (!supplierId) throw new Error('No supplier selected');
      return consolidateRequirementsIntoPO(requirementIds, supplierId, userId);
    },
    [supplierId],
  );

  return {
    opportunity,
    loading,
    error,
    message,
    /** Check if there are consolidation opportunities */
    hasOpportunities: !!opportunity && opportunity.otherMOs.length > 0,
    /** Refresh the data */
    refresh: fetchOpportunity,
    /** Get all pending requirement IDs for "Add all" action */
    getRequirementIds,
    /** Consolidate requirements into a PO */
    consolidate,
  };
}

interface UseConsolidationSummaryOptions {
  subsidiaryId: string;
  /** Max number of top opportunities to return */
  limit?: number;
}

/**
 * Hook to get a summary of all consolidation opportunities.
 * Use this for the Procurement Dashboard "Smart Suggestions" panel.
 */
export function useConsolidationSummary({
  subsidiaryId,
  limit = 5,
}: UseConsolidationSummaryOptions) {
  const [summary, setSummary] = useState<ConsolidationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getConsolidationSummary(subsidiaryId, limit);
      setSummary(data);
    } catch (e) {
      setError((e as Error).message);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [subsidiaryId, limit]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return {
    summary,
    loading,
    error,
    refresh: fetchSummary,
    /** Check if there are any consolidation opportunities */
    hasOpportunities: summary ? summary.suppliersWithOpportunities > 0 : false,
  };
}
