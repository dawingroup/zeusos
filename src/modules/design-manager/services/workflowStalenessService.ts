/**
 * Workflow Staleness Detection Service
 * Tracks when pricing/estimation data becomes outdated
 */

import type { DesignItem } from '../types';
import type { Project, Timestamp } from '@/shared/types';

export interface StalenessReport {
  isStale: boolean;
  reasons: string[];
  affectedItems: string[];
  requiredActions: string[];
  severity: 'none' | 'warning' | 'error';
}

export interface StalenessCheck {
  context: string;
  isStale: boolean;
  reason?: string;
  timestamp?: Timestamp;
}

/**
 * Compare two timestamps to see if 'a' is newer than 'b'
 */
function isNewerThan(a: Timestamp | undefined, b: Timestamp | undefined): boolean {
  if (!a || !b) return false;
  return a.seconds > b.seconds || (a.seconds === b.seconds && a.nanoseconds > b.nanoseconds);
}

/**
 * Detect if optimization is stale relative to item costs
 * Returns true if any item has been costed/modified after optimization was last run
 */
export function detectOptimizationStaleness(
  project: Project,
  designItems: DesignItem[]
): StalenessCheck {
  const optimization = project.optimizationState?.estimation;
  const optimizationTimestamp = optimization?.validAt;

  // If no optimization has been run, it's not "stale" - it's just "not run"
  if (!optimizationTimestamp) {
    return {
      context: 'optimization',
      isStale: false,
      reason: 'No optimization has been run yet',
    };
  }

  // Check if optimization was explicitly invalidated
  if (optimization.invalidatedAt && isNewerThan(optimization.invalidatedAt, optimizationTimestamp)) {
    return {
      context: 'optimization',
      isStale: true,
      reason: 'Optimization was explicitly invalidated',
      timestamp: optimization.invalidatedAt,
    };
  }

  // Check if any design item was modified after optimization
  const modifiedItems = designItems.filter(item => {
    // Check item's general updatedAt
    if (item.updatedAt && isNewerThan(item.updatedAt, optimizationTimestamp)) {
      return true;
    }

    // Check manufacturing costing timestamp
    const costingTimestamp = (item.manufacturing as any)?.estimatedAt || (item.manufacturing as any)?.lastAutoCalcAt;
    if (costingTimestamp && isNewerThan(costingTimestamp, optimizationTimestamp)) {
      return true;
    }

    return false;
  });

  if (modifiedItems.length > 0) {
    return {
      context: 'optimization',
      isStale: true,
      reason: `${modifiedItems.length} item(s) modified since last optimization`,
    };
  }

  return {
    context: 'optimization',
    isStale: false,
  };
}

/**
 * Detect if estimate is stale relative to item costs or optimization
 * Returns true if items were costed after estimate was generated
 */
export function detectEstimateStaleness(
  project: Project,
  designItems: DesignItem[]
): StalenessCheck {
  const estimate = project.consolidatedEstimate;
  const estimateTimestamp = estimate?.generatedAt;

  // If no estimate has been generated, it's not "stale" - it's just "not generated"
  if (!estimateTimestamp) {
    return {
      context: 'estimate',
      isStale: false,
      reason: 'No estimate has been generated yet',
    };
  }

  // Check if estimate was explicitly marked stale
  if (estimate.isStale) {
    return {
      context: 'estimate',
      isStale: true,
      reason: estimate.staleReason || 'Estimate was marked as stale',
    };
  }

  // Check if any design item was costed after estimate generation
  const recostedItems = designItems.filter(item => {
    const costingTimestamp = (item.manufacturing as any)?.estimatedAt || (item.manufacturing as any)?.lastAutoCalcAt;
    if (costingTimestamp && isNewerThan(costingTimestamp, estimateTimestamp)) {
      return true;
    }

    // Check procurement updates
    const procurementTimestamp = (item.procurement as any)?.updatedAt;
    if (procurementTimestamp && isNewerThan(procurementTimestamp, estimateTimestamp)) {
      return true;
    }

    return false;
  });

  if (recostedItems.length > 0) {
    return {
      context: 'estimate',
      isStale: true,
      reason: `${recostedItems.length} item(s) re-costed since last estimate`,
    };
  }

  // Check if optimization ran after estimate (estimate should use new optimization)
  const optimization = project.optimizationState?.estimation;
  const optimizationTimestamp = optimization?.validAt;
  if (optimizationTimestamp && isNewerThan(optimizationTimestamp, estimateTimestamp)) {
    return {
      context: 'estimate',
      isStale: true,
      reason: 'Optimization was re-run after estimate generation',
      timestamp: optimizationTimestamp,
    };
  }

  return {
    context: 'estimate',
    isStale: false,
  };
}

/**
 * Detect if item costing is stale relative to parts changes
 * Returns true if parts were modified after costing was calculated
 */
export function detectItemCostingStaleness(
  item: DesignItem
): StalenessCheck {
  const costingTimestamp = (item.manufacturing as any)?.estimatedAt || (item.manufacturing as any)?.lastAutoCalcAt;

  // If no costing has been done, it's not "stale" - it's just "not costed"
  if (!costingTimestamp) {
    return {
      context: 'item-costing',
      isStale: false,
      reason: 'Item has not been costed yet',
    };
  }

  // Check if item was modified after costing
  if (item.updatedAt && isNewerThan(item.updatedAt, costingTimestamp)) {
    // This could mean parts were added/modified
    return {
      context: 'item-costing',
      isStale: true,
      reason: 'Item was modified after costing',
      timestamp: item.updatedAt,
    };
  }

  return {
    context: 'item-costing',
    isStale: false,
  };
}

/**
 * Comprehensive staleness detection for a project
 * Returns a full report of all staleness issues
 */
export function detectProjectStaleness(
  project: Project,
  designItems: DesignItem[]
): StalenessReport {
  const report: StalenessReport = {
    isStale: false,
    reasons: [],
    affectedItems: [],
    requiredActions: [],
    severity: 'none',
  };

  // Check optimization staleness
  const optimizationCheck = detectOptimizationStaleness(project, designItems);
  if (optimizationCheck.isStale) {
    report.isStale = true;
    report.reasons.push(`Optimization: ${optimizationCheck.reason}`);
    report.requiredActions.push('Re-run optimization in NestingStudio tab');
    report.severity = 'warning';
  }

  // Check estimate staleness
  const estimateCheck = detectEstimateStaleness(project, designItems);
  if (estimateCheck.isStale) {
    report.isStale = true;
    report.reasons.push(`Estimate: ${estimateCheck.reason}`);
    report.requiredActions.push('Regenerate estimate in Estimate tab');
    if (report.severity === 'none') {
      report.severity = 'warning';
    }
  }

  // Check item costing staleness
  const staleItems = designItems.filter(item => {
    const check = detectItemCostingStaleness(item);
    return check.isStale;
  });

  if (staleItems.length > 0) {
    report.isStale = true;
    report.reasons.push(`${staleItems.length} item(s) have stale costing`);
    report.affectedItems = staleItems.map(item => item.id);
    report.requiredActions.push(`Re-cost ${staleItems.length} item(s) in Parts tab`);
    report.severity = 'error';
  }

  return report;
}

/**
 * Get user-friendly staleness message
 */
export function getStalenessSummary(report: StalenessReport): string {
  if (!report.isStale) {
    return 'All pricing data is up to date';
  }

  const parts = [
    report.reasons.join('; '),
    report.requiredActions.length > 0 ? `Action needed: ${report.requiredActions.join(', ')}` : null,
  ].filter(Boolean);

  return parts.join('. ');
}

/**
 * Get severity color for UI display
 */
export function getStalenessColor(severity: StalenessReport['severity']): string {
  switch (severity) {
    case 'error':
      return 'red';
    case 'warning':
      return 'yellow';
    default:
      return 'green';
  }
}

/**
 * Check if item has valid costing data
 */
export function hasValidCosting(item: DesignItem): boolean {
  const manufacturing = item.manufacturing;

  if (!manufacturing) return false;

  // Check if costPerUnit or totalCost is set and > 0
  const hasCostPerUnit = manufacturing.costPerUnit !== undefined &&
                          manufacturing.costPerUnit !== null &&
                          manufacturing.costPerUnit >= 0;

  const hasTotalCost = manufacturing.totalCost !== undefined &&
                        manufacturing.totalCost !== null &&
                        manufacturing.totalCost >= 0;

  return hasCostPerUnit || hasTotalCost;
}

/**
 * Get list of items missing costing
 */
export function getItemsMissingCosting(designItems: DesignItem[]): DesignItem[] {
  return designItems.filter(item => {
    // Only check items that need manufacturing costing
    if (item.sourcingType === 'MANUFACTURED' || item.sourcingType === 'CUSTOM_FURNITURE_MILLWORK') {
      return !hasValidCosting(item);
    }

    // Check procurement items
    if (item.sourcingType === 'PROCURED') {
      const procurement = item.procurement;
      return !procurement || !procurement.totalLandedCost || procurement.totalLandedCost === 0;
    }

    // Check design document items
    if (item.sourcingType === 'DESIGN_DOCUMENT') {
      const architectural = item.architectural;
      return !architectural || !architectural.totalCost || architectural.totalCost === 0;
    }

    // Check construction items
    if (item.sourcingType === 'CONSTRUCTION') {
      const construction = (item as any).construction;
      return !construction || !construction.totalCost || construction.totalCost === 0;
    }

    return false;
  });
}
