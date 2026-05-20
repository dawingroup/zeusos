/**
 * Invalidation Detector Service
 * Detects when optimization results need to be recalculated
 */

import type { ProjectSnapshot, OptimizationState } from '@/shared/types';
import { Timestamp as FirestoreTimestamp } from 'firebase/firestore';

// ============================================
// Types
// ============================================

/**
 * Triggers that can invalidate optimization results
 */
export type InvalidationTrigger =
  | 'PART_ADDED'
  | 'PART_REMOVED'
  | 'PART_DIMENSIONS_CHANGED'
  | 'PART_QUANTITY_CHANGED'
  | 'PART_MATERIAL_CHANGED'
  | 'MATERIAL_CHANGED'
  | 'PALETTE_MAPPING_CHANGED'
  | 'STOCK_CONFIG_CHANGED'
  | 'KERF_CHANGED'
  | 'EDGE_BANDING_CHANGED'
  | 'GRAIN_SETTINGS_CHANGED'
  | 'DESIGN_ITEM_ADDED'
  | 'DESIGN_ITEM_REMOVED'
  | 'DESIGN_ITEM_MODIFIED'
  | 'DESIGN_ITEM_QUANTITY_CHANGED'
  | 'STANDARD_PARTS_CHANGED'
  | 'SPECIAL_PARTS_CHANGED';

/**
 * Result of invalidation detection
 */
export interface InvalidationResult {
  /** Whether estimation results are now invalid */
  estimationInvalidated: boolean;

  /** Whether production results are now invalid */
  productionInvalidated: boolean;

  /** List of triggers that caused invalidation */
  triggers: InvalidationTrigger[];

  /** Human-readable reasons for invalidation */
  reasons: string[];
}

/**
 * Snapshot comparison details
 */
interface SnapshotDiff {
  partsChanged: boolean;
  materialsChanged: boolean;
  configChanged: boolean;
  designItemsChanged: boolean;
  addedDesignItems: string[];
  removedDesignItems: string[];
}

// ============================================
// Invalidation Detector Class
// ============================================

export class InvalidationDetector {
  /**
   * Compare previous and current state to detect what's invalidated
   */
  detect(
    previousSnapshot: ProjectSnapshot | undefined,
    currentSnapshot: ProjectSnapshot,
    optimizationState?: OptimizationState
  ): InvalidationResult {
    const result: InvalidationResult = {
      estimationInvalidated: false,
      productionInvalidated: false,
      triggers: [],
      reasons: [],
    };

    // If no previous snapshot, nothing to compare
    if (!previousSnapshot) {
      return result;
    }

    // If no optimization state, nothing can be invalidated
    if (!optimizationState) {
      return result;
    }

    // Compare snapshots
    const diff = this.compareSnapshots(previousSnapshot, currentSnapshot);

    // Check parts changes
    if (diff.partsChanged) {
      this.handlePartsChanged(result, previousSnapshot, currentSnapshot);
    }

    // Check material mappings changes
    if (diff.materialsChanged) {
      result.triggers.push('PALETTE_MAPPING_CHANGED');
      result.reasons.push('Material palette mappings have changed');
      result.estimationInvalidated = true;
      result.productionInvalidated = true;
    }

    // Check config changes
    if (diff.configChanged) {
      this.handleConfigChanged(result);
    }

    // Check design items changes
    if (diff.designItemsChanged) {
      this.handleDesignItemsChanged(result, diff);
    }

    return result;
  }

  /**
   * Compare two snapshots and return differences
   */
  private compareSnapshots(
    previous: ProjectSnapshot,
    current: ProjectSnapshot
  ): SnapshotDiff {
    const addedDesignItems = current.designItemIds.filter(
      id => !previous.designItemIds.includes(id)
    );
    const removedDesignItems = previous.designItemIds.filter(
      id => !current.designItemIds.includes(id)
    );

    return {
      partsChanged: previous.partsHash !== current.partsHash,
      materialsChanged: previous.materialMappingsHash !== current.materialMappingsHash,
      configChanged: previous.configHash !== current.configHash,
      designItemsChanged: previous.designItemsHash !== current.designItemsHash,
      addedDesignItems,
      removedDesignItems,
    };
  }

  /**
   * Handle parts-related changes
   */
  private handlePartsChanged(
    result: InvalidationResult,
    previous: ProjectSnapshot,
    current: ProjectSnapshot
  ): void {
    if (current.totalParts > previous.totalParts) {
      result.triggers.push('PART_ADDED');
      result.reasons.push(`Parts added (${previous.totalParts} → ${current.totalParts})`);
    } else if (current.totalParts < previous.totalParts) {
      result.triggers.push('PART_REMOVED');
      result.reasons.push(`Parts removed (${previous.totalParts} → ${current.totalParts})`);
    } else {
      // Same count but different hash - dimensions or other properties changed
      result.triggers.push('PART_DIMENSIONS_CHANGED');
      result.reasons.push('Part dimensions or properties modified');
    }

    result.estimationInvalidated = true;
    result.productionInvalidated = true;
  }

  /**
   * Handle configuration changes
   */
  private handleConfigChanged(result: InvalidationResult): void {
    // Config changes can include kerf, stock sheets, edge banding, etc.
    // All of these invalidate both estimation and production
    result.triggers.push('STOCK_CONFIG_CHANGED');
    result.reasons.push('Optimization configuration has changed');
    result.estimationInvalidated = true;
    result.productionInvalidated = true;
  }

  /**
   * Handle design items changes
   */
  private handleDesignItemsChanged(
    result: InvalidationResult,
    diff: SnapshotDiff
  ): void {
    if (diff.addedDesignItems.length > 0) {
      result.triggers.push('DESIGN_ITEM_ADDED');
      result.reasons.push(`${diff.addedDesignItems.length} design item(s) added`);
      result.estimationInvalidated = true;
      result.productionInvalidated = true;
    }

    if (diff.removedDesignItems.length > 0) {
      result.triggers.push('DESIGN_ITEM_REMOVED');
      result.reasons.push(`${diff.removedDesignItems.length} design item(s) removed`);
      result.estimationInvalidated = true;
      result.productionInvalidated = true;
    }

    // If items changed but none added/removed, content was modified
    if (diff.addedDesignItems.length === 0 && diff.removedDesignItems.length === 0) {
      result.triggers.push('DESIGN_ITEM_MODIFIED');
      result.reasons.push('Design item content modified');
      result.estimationInvalidated = true;
      result.productionInvalidated = true;
    }
  }

  /**
   * Format invalidation reasons for display
   */
  formatReasons(result: InvalidationResult): string[] {
    const formatted: string[] = [];

    if (result.estimationInvalidated) {
      formatted.push('⚠️ Estimation results are outdated');
    }

    if (result.productionInvalidated) {
      formatted.push('⚠️ Production nesting is outdated');
    }

    // Add specific reasons
    result.reasons.forEach(reason => {
      formatted.push(`  • ${reason}`);
    });

    return formatted;
  }

  /**
   * Get a summary message for the invalidation
   */
  getSummaryMessage(result: InvalidationResult): string {
    if (!result.estimationInvalidated && !result.productionInvalidated) {
      return 'Optimization results are up to date';
    }

    const parts: string[] = [];
    
    if (result.estimationInvalidated) {
      parts.push('estimation');
    }
    
    if (result.productionInvalidated) {
      parts.push('production nesting');
    }
    
    return `Changes detected - ${parts.join(', ')} need${parts.length === 1 ? 's' : ''} to be re-run`;
  }
}

// ============================================
// Singleton Instance
// ============================================

export const invalidationDetector = new InvalidationDetector();

// ============================================
// Utility Functions
// ============================================

/**
 * Create a simple hash from an object (for change detection)
 */
export function createHash(obj: unknown): string {
  const str = JSON.stringify(obj, Object.keys(obj as object).sort());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Create a project snapshot from current state
 */
export function createProjectSnapshot(
  parts: Array<{ id: string; length: number; width: number; thickness: number; materialId?: string; quantity: number }>,
  designItemIds: string[],
  materialMappings: Record<string, string>,
  config: unknown
): ProjectSnapshot {
  return {
    takenAt: FirestoreTimestamp.now() as unknown as import('@/shared/types').Timestamp,
    partsHash: createHash(parts),
    totalParts: parts.reduce((sum, p) => sum + p.quantity, 0),
    materialMappingsHash: createHash(materialMappings),
    configHash: createHash(config),
    designItemIds,
    designItemsHash: createHash(designItemIds),
  };
}
