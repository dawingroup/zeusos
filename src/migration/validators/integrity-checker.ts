/**
 * Integrity Checker
 * Validates referential integrity across collections
 */

import {
  collection,
  getDocs,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { MigrationError } from '../types/migration-types';

export interface IntegrityCheckResult {
  isValid: boolean;
  checks: IntegrityCheck[];
  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    orphanedRecords: number;
  };
}

export interface IntegrityCheck {
  name: string;
  sourceCollection: string;
  targetCollection: string;
  sourceField: string;
  status: 'passed' | 'failed' | 'warning';
  validCount: number;
  invalidCount: number;
  orphanedIds: string[];
  errors: MigrationError[];
}

// Reference definitions for integrity checking
interface ReferenceDefinition {
  name: string;
  sourceCollection: string;
  targetCollection: string;
  sourceField: string;
  required: boolean;
}

// V5 Reference Definitions
const V5_REFERENCES: ReferenceDefinition[] = [
  {
    name: 'Project -> Program',
    sourceCollection: 'projects',
    targetCollection: 'programs',
    sourceField: 'programId',
    required: true,
  },
  {
    name: 'IPC -> Project',
    sourceCollection: 'ipcs',
    targetCollection: 'projects',
    sourceField: 'projectId',
    required: true,
  },
  {
    name: 'Requisition -> Project',
    sourceCollection: 'requisitions',
    targetCollection: 'projects',
    sourceField: 'projectId',
    required: true,
  },
  {
    name: 'BOQ -> Project',
    sourceCollection: 'boqs',
    targetCollection: 'projects',
    sourceField: 'projectId',
    required: true,
  },
  {
    name: 'Deal -> Project (optional)',
    sourceCollection: 'deals',
    targetCollection: 'projects',
    sourceField: 'projectId',
    required: false,
  },
];

// V6 Reference Definitions
const V6_REFERENCES: ReferenceDefinition[] = [
  {
    name: 'V6 Project -> Engagement',
    sourceCollection: 'v6_projects',
    targetCollection: 'engagements',
    sourceField: 'engagementId',
    required: true,
  },
  {
    name: 'V6 Payment -> Project',
    sourceCollection: 'v6_payments',
    targetCollection: 'v6_projects',
    sourceField: 'projectId',
    required: true,
  },
  {
    name: 'V6 Payment -> Engagement',
    sourceCollection: 'v6_payments',
    targetCollection: 'engagements',
    sourceField: 'engagementId',
    required: true,
  },
  {
    name: 'Engagement -> Client',
    sourceCollection: 'engagements',
    targetCollection: 'clients',
    sourceField: 'clientId',
    required: true,
  },
];

export class IntegrityChecker {
  /**
   * Run all v5 integrity checks
   */
  async checkV5Integrity(): Promise<IntegrityCheckResult> {
    console.log('Running v5 integrity checks...');
    return this.runIntegrityChecks(V5_REFERENCES);
  }

  /**
   * Run all v6 integrity checks
   */
  async checkV6Integrity(): Promise<IntegrityCheckResult> {
    console.log('Running v6 integrity checks...');
    return this.runIntegrityChecks(V6_REFERENCES);
  }

  /**
   * Run custom integrity checks
   */
  async runIntegrityChecks(references: ReferenceDefinition[]): Promise<IntegrityCheckResult> {
    const checks: IntegrityCheck[] = [];
    let totalOrphaned = 0;

    for (const ref of references) {
      const check = await this.checkReference(ref);
      checks.push(check);
      totalOrphaned += check.orphanedIds.length;
    }

    const passed = checks.filter(c => c.status === 'passed').length;
    const failed = checks.filter(c => c.status === 'failed').length;

    return {
      isValid: failed === 0,
      checks,
      summary: {
        totalChecks: checks.length,
        passed,
        failed,
        orphanedRecords: totalOrphaned,
      },
    };
  }

  /**
   * Check a single reference relationship
   */
  async checkReference(ref: ReferenceDefinition): Promise<IntegrityCheck> {
    console.log(`Checking: ${ref.name}`);

    const errors: MigrationError[] = [];
    const orphanedIds: string[] = [];
    let validCount = 0;
    let invalidCount = 0;

    try {
      // Check if source collection exists
      const sourceSnapshot = await getDocs(collection(db, ref.sourceCollection));
      
      if (sourceSnapshot.empty) {
        console.log(`  Source collection ${ref.sourceCollection} is empty`);
        return {
          name: ref.name,
          sourceCollection: ref.sourceCollection,
          targetCollection: ref.targetCollection,
          sourceField: ref.sourceField,
          status: 'passed',
          validCount: 0,
          invalidCount: 0,
          orphanedIds: [],
          errors: [],
        };
      }

      // Build set of valid target IDs for faster lookup
      const targetSnapshot = await getDocs(collection(db, ref.targetCollection));
      const validTargetIds = new Set(targetSnapshot.docs.map(d => d.id));

      // Check each source document
      for (const docSnap of sourceSnapshot.docs) {
        const data = docSnap.data();
        const refValue = this.getNestedValue(data, ref.sourceField);

        if (refValue) {
          if (validTargetIds.has(refValue)) {
            validCount++;
          } else {
            invalidCount++;
            orphanedIds.push(docSnap.id);
            
            if (ref.required) {
              errors.push({
                documentId: docSnap.id,
                field: ref.sourceField,
                error: `Broken reference: ${refValue} not found in ${ref.targetCollection}`,
                severity: 'high',
                timestamp: new Date(),
              });
            }
          }
        } else if (ref.required) {
          invalidCount++;
          errors.push({
            documentId: docSnap.id,
            field: ref.sourceField,
            error: `Missing required reference field: ${ref.sourceField}`,
            severity: 'high',
            timestamp: new Date(),
          });
        } else {
          validCount++; // Null is okay for optional references
        }
      }

      const status = invalidCount === 0 ? 'passed' : ref.required ? 'failed' : 'warning';
      console.log(`  Result: ${validCount} valid, ${invalidCount} invalid (${status})`);

      return {
        name: ref.name,
        sourceCollection: ref.sourceCollection,
        targetCollection: ref.targetCollection,
        sourceField: ref.sourceField,
        status,
        validCount,
        invalidCount,
        orphanedIds,
        errors,
      };
    } catch (error) {
      console.error(`  Error checking ${ref.name}:`, error);
      return {
        name: ref.name,
        sourceCollection: ref.sourceCollection,
        targetCollection: ref.targetCollection,
        sourceField: ref.sourceField,
        status: 'failed',
        validCount: 0,
        invalidCount: 0,
        orphanedIds: [],
        errors: [{
          documentId: 'system',
          error: error instanceof Error ? error.message : 'Check failed',
          severity: 'critical',
          timestamp: new Date(),
        }],
      };
    }
  }

  /**
   * Check bidirectional integrity (parent has children, children have parent)
   */
  async checkBidirectionalIntegrity(
    parentCollection: string,
    parentField: string, // e.g., 'projects' array in program
    childCollection: string,
    childField: string // e.g., 'programId' in project
  ): Promise<{
    orphanedChildren: string[];
    missingChildren: { parentId: string; missingIds: string[] }[];
    inconsistencies: number;
  }> {
    const orphanedChildren: string[] = [];
    const missingChildren: { parentId: string; missingIds: string[] }[] = [];

    // Get all parents
    const parentSnapshot = await getDocs(collection(db, parentCollection));
    const parentChildMap = new Map<string, string[]>();

    for (const docSnap of parentSnapshot.docs) {
      const data = docSnap.data();
      const children = this.getNestedValue(data, parentField) || [];
      parentChildMap.set(docSnap.id, Array.isArray(children) ? children : []);
    }

    // Get all children
    const childSnapshot = await getDocs(collection(db, childCollection));
    const childParentMap = new Map<string, string>();

    for (const docSnap of childSnapshot.docs) {
      const data = docSnap.data();
      const parentId = this.getNestedValue(data, childField);
      if (parentId) {
        childParentMap.set(docSnap.id, parentId);
      }
    }

    // Check for orphaned children (children with non-existent parents)
    for (const [childId, parentId] of childParentMap) {
      if (!parentChildMap.has(parentId)) {
        orphanedChildren.push(childId);
      }
    }

    // Check for missing children (parent lists child that doesn't exist)
    for (const [parentId, childIds] of parentChildMap) {
      const missing = childIds.filter(id => !childParentMap.has(id));
      if (missing.length > 0) {
        missingChildren.push({ parentId, missingIds: missing });
      }
    }

    return {
      orphanedChildren,
      missingChildren,
      inconsistencies: orphanedChildren.length + missingChildren.reduce((sum, m) => sum + m.missingIds.length, 0),
    };
  }

  /**
   * Check for duplicate IDs across collections
   */
  async checkForDuplicates(
    collections: string[]
  ): Promise<{ collection: string; duplicates: string[] }[]> {
    const results: { collection: string; duplicates: string[] }[] = [];

    for (const collectionName of collections) {
      const snapshot = await getDocs(collection(db, collectionName));
      const idCounts = new Map<string, number>();

      for (const docSnap of snapshot.docs) {
        const count = idCounts.get(docSnap.id) || 0;
        idCounts.set(docSnap.id, count + 1);
      }

      const duplicates = Array.from(idCounts.entries())
        .filter(([, count]) => count > 1)
        .map(([id]) => id);

      if (duplicates.length > 0) {
        results.push({ collection: collectionName, duplicates });
      }
    }

    return results;
  }

  /**
   * Verify migration completeness
   */
  async verifyMigrationCompleteness(
    sourceCollection: string,
    targetCollection: string,
    linkField: string = 'migratedFrom.sourceId'
  ): Promise<{
    sourceCount: number;
    targetCount: number;
    migratedCount: number;
    unmigrated: string[];
    completionRate: number;
  }> {
    const sourceSnapshot = await getDocs(collection(db, sourceCollection));
    const targetSnapshot = await getDocs(collection(db, targetCollection));

    const sourceIds = new Set(sourceSnapshot.docs.map(d => d.id));
    const migratedSourceIds = new Set<string>();

    for (const docSnap of targetSnapshot.docs) {
      const sourceId = this.getNestedValue(docSnap.data(), linkField);
      if (sourceId && sourceIds.has(sourceId)) {
        migratedSourceIds.add(sourceId);
      }
    }

    const unmigrated = Array.from(sourceIds).filter(id => !migratedSourceIds.has(id));
    const completionRate = sourceIds.size > 0 
      ? (migratedSourceIds.size / sourceIds.size) * 100 
      : 100;

    return {
      sourceCount: sourceIds.size,
      targetCount: targetSnapshot.size,
      migratedCount: migratedSourceIds.size,
      unmigrated,
      completionRate,
    };
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

export const integrityChecker = new IntegrityChecker();
