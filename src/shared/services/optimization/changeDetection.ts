/**
 * Change Detection Service
 * Implements dependency invalidation system for optimization state
 */

import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { Timestamp } from '@/shared/types';

// ============================================
// Types
// ============================================

/**
 * Checksums for change detection
 */
export interface OptimizationChecksums {
  parts: string;        // Hash of all parts data
  materials: string;    // Hash of material assignments
  settings: string;     // Hash of optimization settings
}

/**
 * Extended optimization status for dependency tracking
 */
export interface OptimizationStatus {
  status: 'fresh' | 'stale' | 'optimizing' | 'error';
  lastOptimizedAt: Timestamp | null;
  checksums: OptimizationChecksums;
  invalidationReasons: string[];
  version: number;
}

/**
 * Result of change detection
 */
export interface ChangeDetectionResult {
  isStale: boolean;
  reasons: string[];
  changedFields: ('parts' | 'materials' | 'settings')[];
}

// ============================================
// Checksum Utilities
// ============================================

/**
 * Calculate a deterministic checksum from data
 * Uses a simple but effective hash algorithm
 */
export function calculateChecksum(data: unknown): string {
  // Sort keys for deterministic output
  const str = JSON.stringify(data, (_key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value).sort().reduce((sorted: Record<string, unknown>, k) => {
        sorted[k] = value[k];
        return sorted;
      }, {});
    }
    return value;
  });
  
  // Simple hash function (djb2)
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to base36 for compact representation
  return Math.abs(hash).toString(36);
}

/**
 * Calculate checksums for parts data
 */
export function calculatePartsChecksum(parts: Array<{
  id: string;
  length: number;
  width: number;
  thickness: number;
  quantity: number;
  materialId?: string;
  grainDirection?: string;
  edgeBanding?: unknown;
}>): string {
  // Sort parts by ID for deterministic order
  const sortedParts = [...parts].sort((a, b) => a.id.localeCompare(b.id));
  
  // Extract only relevant fields for checksum
  const relevantData = sortedParts.map(p => ({
    id: p.id,
    length: p.length,
    width: p.width,
    thickness: p.thickness,
    quantity: p.quantity,
    materialId: p.materialId || '',
    grainDirection: p.grainDirection || 'none',
    edgeBanding: p.edgeBanding || null,
  }));
  
  return calculateChecksum(relevantData);
}

/**
 * Calculate checksums for material mappings
 */
export function calculateMaterialsChecksum(materials: Array<{
  id: string;
  designName: string;
  inventoryId?: string;
  thickness: number;
  stockSheets?: Array<{ length: number; width: number; quantity: number }>;
}>): string {
  const sortedMaterials = [...materials].sort((a, b) => a.id.localeCompare(b.id));
  
  const relevantData = sortedMaterials.map(m => ({
    id: m.id,
    designName: m.designName,
    inventoryId: m.inventoryId || '',
    thickness: m.thickness,
    stockSheets: (m.stockSheets || []).map(s => ({
      length: s.length,
      width: s.width,
      quantity: s.quantity,
    })),
  }));
  
  return calculateChecksum(relevantData);
}

/**
 * Calculate checksums for optimization settings
 */
export function calculateSettingsChecksum(settings: {
  kerf?: number;
  grainMatching?: boolean;
  allowRotation?: boolean;
  targetYield?: number;
  minimumUsableCutoff?: { length: number; width: number };
}): string {
  return calculateChecksum({
    kerf: settings.kerf ?? 4,
    grainMatching: settings.grainMatching ?? true,
    allowRotation: settings.allowRotation ?? true,
    targetYield: settings.targetYield ?? 80,
    minimumUsableCutoff: settings.minimumUsableCutoff ?? { length: 200, width: 200 },
  });
}

// ============================================
// Change Detection Service
// ============================================

export class ChangeDetectionService {
  /**
   * Calculate all checksums for current project state
   */
  calculateAllChecksums(
    parts: Array<{ id: string; length: number; width: number; thickness: number; quantity: number; materialId?: string; grainDirection?: string; edgeBanding?: unknown }>,
    materials: Array<{ id: string; designName: string; inventoryId?: string; thickness: number; stockSheets?: Array<{ length: number; width: number; quantity: number }> }>,
    settings: { kerf?: number; grainMatching?: boolean; allowRotation?: boolean; targetYield?: number; minimumUsableCutoff?: { length: number; width: number } }
  ): OptimizationChecksums {
    return {
      parts: calculatePartsChecksum(parts),
      materials: calculateMaterialsChecksum(materials),
      settings: calculateSettingsChecksum(settings),
    };
  }

  /**
   * Detect changes between current state and stored checksums
   */
  detectChanges(
    currentChecksums: OptimizationChecksums,
    storedChecksums: OptimizationChecksums | null
  ): ChangeDetectionResult {
    const result: ChangeDetectionResult = {
      isStale: false,
      reasons: [],
      changedFields: [],
    };

    // If no stored checksums, consider fresh (first optimization)
    if (!storedChecksums) {
      return result;
    }

    // Compare each checksum
    if (currentChecksums.parts !== storedChecksums.parts) {
      result.isStale = true;
      result.reasons.push('Parts modified');
      result.changedFields.push('parts');
    }

    if (currentChecksums.materials !== storedChecksums.materials) {
      result.isStale = true;
      result.reasons.push('Materials changed');
      result.changedFields.push('materials');
    }

    if (currentChecksums.settings !== storedChecksums.settings) {
      result.isStale = true;
      result.reasons.push('Settings updated');
      result.changedFields.push('settings');
    }

    return result;
  }

  /**
   * Mark a project's optimization as stale
   */
  async markStale(projectId: string, reason: string): Promise<void> {
    try {
      const projectRef = doc(db, 'designProjects', projectId);
      const projectDoc = await getDoc(projectRef);
      
      if (!projectDoc.exists()) {
        console.error('Project not found:', projectId);
        return;
      }

      const currentData = projectDoc.data();
      const currentStatus = currentData.optimizationStatus as OptimizationStatus | undefined;
      const currentReasons = currentStatus?.invalidationReasons || [];

      // Only add reason if not already present
      const updatedReasons = currentReasons.includes(reason) 
        ? currentReasons 
        : [...currentReasons, reason];

      await updateDoc(projectRef, {
        'optimizationStatus.status': 'stale',
        'optimizationStatus.invalidationReasons': updatedReasons,
        'optimizationStatus.version': (currentStatus?.version || 0) + 1,
        updatedAt: new Date(),
      });

      console.log(`Project ${projectId} marked as stale:`, reason);
    } catch (error) {
      console.error('Error marking project as stale:', error);
      throw error;
    }
  }

  /**
   * Mark a project's optimization as fresh (after successful optimization)
   */
  async markFresh(projectId: string, checksums: OptimizationChecksums): Promise<void> {
    try {
      const projectRef = doc(db, 'designProjects', projectId);
      
      await updateDoc(projectRef, {
        'optimizationStatus.status': 'fresh',
        'optimizationStatus.checksums': checksums,
        'optimizationStatus.invalidationReasons': [],
        'optimizationStatus.lastOptimizedAt': new Date(),
        'optimizationStatus.version': 1,
        updatedAt: new Date(),
      });

      console.log(`Project ${projectId} marked as fresh`);
    } catch (error) {
      console.error('Error marking project as fresh:', error);
      throw error;
    }
  }

  /**
   * Mark a project's optimization as currently running
   */
  async markOptimizing(projectId: string): Promise<void> {
    try {
      const projectRef = doc(db, 'designProjects', projectId);
      
      await updateDoc(projectRef, {
        'optimizationStatus.status': 'optimizing',
        updatedAt: new Date(),
      });

      console.log(`Project ${projectId} marked as optimizing`);
    } catch (error) {
      console.error('Error marking project as optimizing:', error);
      throw error;
    }
  }

  /**
   * Mark a project's optimization as errored
   */
  async markError(projectId: string, errorMessage: string): Promise<void> {
    try {
      const projectRef = doc(db, 'designProjects', projectId);
      const projectDoc = await getDoc(projectRef);
      
      const currentData = projectDoc.data();
      const currentStatus = currentData?.optimizationStatus as OptimizationStatus | undefined;

      await updateDoc(projectRef, {
        'optimizationStatus.status': 'error',
        'optimizationStatus.invalidationReasons': [
          ...(currentStatus?.invalidationReasons || []),
          `Error: ${errorMessage}`,
        ],
        updatedAt: new Date(),
      });

      console.log(`Project ${projectId} marked as error:`, errorMessage);
    } catch (error) {
      console.error('Error marking project as error:', error);
      throw error;
    }
  }

  /**
   * Get current optimization status for a project
   */
  async getStatus(projectId: string): Promise<OptimizationStatus | null> {
    try {
      const projectRef = doc(db, 'designProjects', projectId);
      const projectDoc = await getDoc(projectRef);
      
      if (!projectDoc.exists()) {
        return null;
      }

      return projectDoc.data().optimizationStatus as OptimizationStatus || null;
    } catch (error) {
      console.error('Error getting optimization status:', error);
      return null;
    }
  }

  /**
   * Check and update staleness based on current project data
   * Call this after any save operation
   */
  async checkAndUpdateStaleness(
    projectId: string,
    parts: Array<{ id: string; length: number; width: number; thickness: number; quantity: number; materialId?: string; grainDirection?: string; edgeBanding?: unknown }>,
    materials: Array<{ id: string; designName: string; inventoryId?: string; thickness: number; stockSheets?: Array<{ length: number; width: number; quantity: number }> }>,
    settings: { kerf?: number; grainMatching?: boolean; allowRotation?: boolean; targetYield?: number; minimumUsableCutoff?: { length: number; width: number } }
  ): Promise<ChangeDetectionResult> {
    const currentStatus = await this.getStatus(projectId);
    const currentChecksums = this.calculateAllChecksums(parts, materials, settings);
    const storedChecksums = currentStatus?.checksums || null;

    const result = this.detectChanges(currentChecksums, storedChecksums);

    // If changes detected, mark as stale
    if (result.isStale && currentStatus?.status !== 'stale') {
      for (const reason of result.reasons) {
        await this.markStale(projectId, reason);
      }
    }

    return result;
  }
}

// ============================================
// Singleton Instance
// ============================================

export const changeDetectionService = new ChangeDetectionService();
