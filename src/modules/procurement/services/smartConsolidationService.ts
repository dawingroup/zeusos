/**
 * Smart Consolidation Service
 *
 * Identifies consolidation opportunities when creating POs.
 * Shows users which other Manufacturing Orders need materials from the same supplier,
 * enabling bulk purchasing for better pricing.
 */

import {
  getRequirementsGroupedBySupplier,
  getProcurementRequirements,
  consolidateIntoPO,
} from './procurementRequirementService';
import type { ProcurementRequirement } from '../types/procurement';
import { getSupplierById } from './supplierBridgeService';

/**
 * Represents a single MO that has pending requirements for a supplier
 */
export interface MORequirementSummary {
  moId: string;
  moNumber: string;
  designItemName: string;
  projectCode: string;
  requirementCount: number;
  totalEstimatedCost: number;
  currency: string;
  requirements: ProcurementRequirement[];
}

/**
 * Consolidation opportunity for a specific supplier
 * Shows all MOs (excluding current) that need materials from this supplier
 */
export interface ConsolidationOpportunity {
  supplierId: string;
  supplierName: string;
  supplierRating?: number;
  /** MOs that have pending requirements for this supplier */
  otherMOs: MORequirementSummary[];
  /** Total value across all other MOs */
  totalPotentialValue: number;
  currency: string;
  /** Total number of pending requirements */
  totalRequirementCount: number;
}

/**
 * Summary of all consolidation opportunities across suppliers
 */
export interface ConsolidationSummary {
  /** Total number of suppliers with pending requirements */
  suppliersWithOpportunities: number;
  /** Total potential savings if all requirements were consolidated */
  totalPendingValue: number;
  currency: string;
  /** Top consolidation opportunities sorted by value */
  topOpportunities: ConsolidationOpportunity[];
}

/**
 * Get consolidation opportunities for a specific supplier.
 * Returns info about other MOs that have pending requirements for this supplier.
 *
 * @param supplierId - The supplier to check
 * @param excludeMoId - Optional MO to exclude (e.g., the current MO being worked on)
 * @param subsidiaryId - The subsidiary to filter by
 */
export async function getConsolidationOpportunitiesForSupplier(
  supplierId: string,
  subsidiaryId: string,
  excludeMoId?: string,
): Promise<ConsolidationOpportunity | null> {
  // Get all pending requirements for this supplier
  const requirements = await getProcurementRequirements({
    subsidiaryId,
    status: 'pending',
    supplierId,
  });

  if (requirements.length === 0) {
    return null;
  }

  // Filter out excluded MO if provided
  const filteredRequirements = excludeMoId
    ? requirements.filter((r) => r.moId !== excludeMoId)
    : requirements;

  if (filteredRequirements.length === 0) {
    return null;
  }

  // Group by MO
  const moMap = new Map<string, ProcurementRequirement[]>();
  for (const req of filteredRequirements) {
    if (!moMap.has(req.moId)) {
      moMap.set(req.moId, []);
    }
    moMap.get(req.moId)!.push(req);
  }

  // Build MO summaries
  const otherMOs: MORequirementSummary[] = [];
  for (const [moId, moReqs] of moMap.entries()) {
    otherMOs.push({
      moId,
      moNumber: moReqs[0].moNumber,
      designItemName: moReqs[0].designItemName,
      projectCode: moReqs[0].projectCode,
      requirementCount: moReqs.length,
      totalEstimatedCost: moReqs.reduce((sum, r) => sum + r.estimatedTotalCost, 0),
      currency: moReqs[0].currency,
      requirements: moReqs,
    });
  }

  // Sort MOs by value (highest first)
  otherMOs.sort((a, b) => b.totalEstimatedCost - a.totalEstimatedCost);

  // Get supplier info for rating
  const supplier = await getSupplierById(supplierId);

  const totalPotentialValue = otherMOs.reduce((sum, mo) => sum + mo.totalEstimatedCost, 0);

  return {
    supplierId,
    supplierName: filteredRequirements[0]?.supplierName ?? supplier?.name ?? 'Unknown',
    supplierRating: supplier?.rating,
    otherMOs,
    totalPotentialValue,
    currency: filteredRequirements[0]?.currency ?? 'USD',
    totalRequirementCount: filteredRequirements.length,
  };
}

/**
 * Get a summary of all consolidation opportunities across all suppliers.
 * Useful for a procurement dashboard "Smart Suggestions" panel.
 *
 * @param subsidiaryId - The subsidiary to filter by
 * @param limit - Maximum number of top opportunities to return (default 5)
 */
export async function getConsolidationSummary(
  subsidiaryId: string,
  limit: number = 5,
): Promise<ConsolidationSummary> {
  const groups = await getRequirementsGroupedBySupplier(subsidiaryId);

  // Filter out unassigned and single-MO groups (no consolidation benefit)
  const consolidatableGroups = groups.filter(
    (g) => g.supplierId !== 'unassigned' && g.moCount > 1,
  );

  // Build opportunities from groups
  const opportunities: ConsolidationOpportunity[] = [];

  for (const group of consolidatableGroups) {
    // Group requirements by MO
    const moMap = new Map<string, ProcurementRequirement[]>();
    for (const req of group.requirements) {
      if (!moMap.has(req.moId)) {
        moMap.set(req.moId, []);
      }
      moMap.get(req.moId)!.push(req);
    }

    const moSummaries: MORequirementSummary[] = [];
    for (const [moId, moReqs] of moMap.entries()) {
      moSummaries.push({
        moId,
        moNumber: moReqs[0].moNumber,
        designItemName: moReqs[0].designItemName,
        projectCode: moReqs[0].projectCode,
        requirementCount: moReqs.length,
        totalEstimatedCost: moReqs.reduce((sum, r) => sum + r.estimatedTotalCost, 0),
        currency: moReqs[0].currency,
        requirements: moReqs,
      });
    }

    // Sort MO summaries by value
    moSummaries.sort((a, b) => b.totalEstimatedCost - a.totalEstimatedCost);

    // Get supplier rating
    const supplier = await getSupplierById(group.supplierId);

    opportunities.push({
      supplierId: group.supplierId,
      supplierName: group.supplierName,
      supplierRating: supplier?.rating,
      otherMOs: moSummaries,
      totalPotentialValue: group.totalEstimatedCost,
      currency: group.currency,
      totalRequirementCount: group.requirements.length,
    });
  }

  // Sort by total value and take top N
  opportunities.sort((a, b) => b.totalPotentialValue - a.totalPotentialValue);
  const topOpportunities = opportunities.slice(0, limit);

  // Calculate totals
  const totalPendingValue = groups
    .filter((g) => g.supplierId !== 'unassigned')
    .reduce((sum, g) => sum + g.totalEstimatedCost, 0);

  return {
    suppliersWithOpportunities: consolidatableGroups.length,
    totalPendingValue,
    currency: groups[0]?.currency ?? 'USD',
    topOpportunities,
  };
}

/**
 * Get all pending requirement IDs for a supplier (optionally excluding an MO).
 * Useful for "Add all to PO" actions.
 */
export async function getPendingRequirementIdsForSupplier(
  supplierId: string,
  subsidiaryId: string,
  excludeMoId?: string,
): Promise<string[]> {
  const requirements = await getProcurementRequirements({
    subsidiaryId,
    status: 'pending',
    supplierId,
  });

  const filtered = excludeMoId
    ? requirements.filter((r) => r.moId !== excludeMoId)
    : requirements;

  return filtered.map((r) => r.id);
}

/**
 * Consolidate all pending requirements from multiple MOs into a single PO.
 * Wraps the existing consolidateIntoPO function with convenience.
 *
 * @param requirementIds - IDs of requirements to consolidate
 * @param supplierId - The supplier for the PO
 * @param userId - User creating the PO
 */
export async function consolidateRequirementsIntoPO(
  requirementIds: string[],
  supplierId: string,
  userId: string,
): Promise<string> {
  return consolidateIntoPO(requirementIds, supplierId, userId);
}

/**
 * Get a formatted message describing consolidation opportunity
 * for display in UI alerts.
 */
export function formatConsolidationMessage(opportunity: ConsolidationOpportunity): string {
  const { otherMOs, totalPotentialValue, currency, totalRequirementCount } = opportunity;

  const moCount = otherMOs.length;
  const moNumbers = otherMOs.slice(0, 3).map((mo) => mo.moNumber).join(', ');
  const moreCount = moCount > 3 ? ` and ${moCount - 3} more` : '';

  const valueFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(totalPotentialValue);

  return `${totalRequirementCount} items (${valueFormatted}) from ${moNumbers}${moreCount} can be consolidated.`;
}
