/**
 * Data Validator
 * Validates data integrity before and after migration
 */

import {
  collection,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import {
  ValidationRule,
  MigrationWarning,
  MigrationError,
} from '../types/migration-types';

export interface ValidationResult {
  isValid: boolean;
  errors: MigrationError[];
  warnings: MigrationWarning[];
  summary: {
    totalChecked: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

export class DataValidator {
  /**
   * Validate a single document
   */
  validateDocument(
    documentId: string,
    data: Record<string, any>,
    rules: ValidationRule[]
  ): { errors: MigrationError[]; warnings: MigrationWarning[] } {
    const errors: MigrationError[] = [];
    const warnings: MigrationWarning[] = [];

    for (const rule of rules) {
      const value = this.getNestedValue(data, rule.field);
      let isValid = true;

      switch (rule.rule) {
        case 'required':
          isValid = value !== undefined && value !== null && value !== '';
          break;

        case 'type':
          if (value !== undefined && value !== null) {
            isValid = typeof value === rule.params?.type;
          }
          break;

        case 'range':
          if (typeof value === 'number') {
            const min = rule.params?.min ?? -Infinity;
            const max = rule.params?.max ?? Infinity;
            isValid = value >= min && value <= max;
          }
          break;

        case 'enum':
          if (value !== undefined && value !== null) {
            isValid = rule.params?.values?.includes(value) ?? false;
          }
          break;

        case 'reference':
          // Reference validation is handled separately (async)
          break;

        case 'custom':
          if (rule.params?.validator) {
            isValid = rule.params.validator(value, data);
          }
          break;
      }

      if (!isValid) {
        const severity = rule.params?.severity || 'medium';
        if (severity === 'low') {
          warnings.push({
            documentId,
            field: rule.field,
            warning: rule.message,
            timestamp: new Date(),
          });
        } else {
          errors.push({
            documentId,
            field: rule.field,
            error: rule.message,
            severity,
            timestamp: new Date(),
          });
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate entire collection
   */
  async validateCollection(
    collectionName: string,
    rules: ValidationRule[]
  ): Promise<ValidationResult> {
    const errors: MigrationError[] = [];
    const warnings: MigrationWarning[] = [];
    let totalChecked = 0;
    let passed = 0;
    let failed = 0;

    console.log(`Validating collection: ${collectionName}`);

    const snapshot = await getDocs(collection(db, collectionName));

    for (const docSnap of snapshot.docs) {
      totalChecked++;
      const result = this.validateDocument(docSnap.id, docSnap.data(), rules);

      errors.push(...result.errors);
      warnings.push(...result.warnings);

      if (result.errors.length === 0) {
        passed++;
      } else {
        failed++;
      }
    }

    console.log(`Validation complete: ${passed} passed, ${failed} failed, ${warnings.length} warnings`);

    return {
      isValid: failed === 0,
      errors,
      warnings,
      summary: {
        totalChecked,
        passed,
        failed,
        warnings: warnings.length,
      },
    };
  }

  /**
   * Validate referential integrity
   */
  async validateReferences(
    sourceCollection: string,
    sourceField: string,
    targetCollection: string
  ): Promise<ValidationResult> {
    const errors: MigrationError[] = [];
    let totalChecked = 0;
    let passed = 0;
    let failed = 0;

    console.log(`Validating references: ${sourceCollection}.${sourceField} -> ${targetCollection}`);

    const sourceSnapshot = await getDocs(collection(db, sourceCollection));

    for (const docSnap of sourceSnapshot.docs) {
      totalChecked++;
      const data = docSnap.data();
      const refId = this.getNestedValue(data, sourceField);

      if (refId) {
        try {
          const targetDoc = await getDoc(doc(db, targetCollection, refId));

          if (targetDoc.exists()) {
            passed++;
          } else {
            failed++;
            errors.push({
              documentId: docSnap.id,
              field: sourceField,
              error: `Reference not found: ${refId} in ${targetCollection}`,
              severity: 'high',
              timestamp: new Date(),
            });
          }
        } catch (error) {
          failed++;
          errors.push({
            documentId: docSnap.id,
            field: sourceField,
            error: `Error checking reference: ${error instanceof Error ? error.message : 'Unknown error'}`,
            severity: 'high',
            timestamp: new Date(),
          });
        }
      } else {
        passed++; // Null/undefined reference is okay if not required
      }
    }

    console.log(`Reference validation: ${passed} valid, ${failed} broken`);

    return {
      isValid: failed === 0,
      errors,
      warnings: [],
      summary: {
        totalChecked,
        passed,
        failed,
        warnings: 0,
      },
    };
  }

  /**
   * Compare source and target collections after migration
   */
  async compareCollections(
    sourceCollection: string,
    targetCollection: string,
    linkField: string = 'migratedFrom.sourceId'
  ): Promise<{
    matched: number;
    missing: string[];
    extra: string[];
    comparison: {
      sourceCount: number;
      targetCount: number;
      matchRate: number;
    };
  }> {
    console.log(`Comparing collections: ${sourceCollection} vs ${targetCollection}`);

    const sourceSnapshot = await getDocs(collection(db, sourceCollection));
    const targetSnapshot = await getDocs(collection(db, targetCollection));

    const sourceIds = new Set(sourceSnapshot.docs.map(d => d.id));
    const targetSourceIds = new Set<string>();

    for (const docSnap of targetSnapshot.docs) {
      const sourceId = this.getNestedValue(docSnap.data(), linkField);
      if (sourceId) {
        targetSourceIds.add(sourceId);
      }
    }

    const missing: string[] = [];
    const extra: string[] = [];
    let matched = 0;

    for (const sourceId of sourceIds) {
      if (targetSourceIds.has(sourceId)) {
        matched++;
      } else {
        missing.push(sourceId);
      }
    }

    for (const targetId of targetSourceIds) {
      if (!sourceIds.has(targetId)) {
        extra.push(targetId);
      }
    }

    const matchRate = sourceIds.size > 0 ? (matched / sourceIds.size) * 100 : 0;

    console.log(`Comparison: ${matched} matched, ${missing.length} missing, ${extra.length} extra`);
    console.log(`Match rate: ${matchRate.toFixed(1)}%`);

    return {
      matched,
      missing,
      extra,
      comparison: {
        sourceCount: sourceIds.size,
        targetCount: targetSnapshot.size,
        matchRate,
      },
    };
  }

  /**
   * Validate schema compliance
   */
  async validateSchema(
    collectionName: string,
    requiredFields: string[],
    fieldTypes: Record<string, string>
  ): Promise<ValidationResult> {
    const errors: MigrationError[] = [];
    const warnings: MigrationWarning[] = [];
    let totalChecked = 0;
    let passed = 0;
    let failed = 0;

    const snapshot = await getDocs(collection(db, collectionName));

    for (const docSnap of snapshot.docs) {
      totalChecked++;
      const data = docSnap.data();
      let docValid = true;

      // Check required fields
      for (const field of requiredFields) {
        const value = this.getNestedValue(data, field);
        if (value === undefined || value === null) {
          errors.push({
            documentId: docSnap.id,
            field,
            error: `Missing required field: ${field}`,
            severity: 'high',
            timestamp: new Date(),
          });
          docValid = false;
        }
      }

      // Check field types
      for (const [field, expectedType] of Object.entries(fieldTypes)) {
        const value = this.getNestedValue(data, field);
        if (value !== undefined && value !== null) {
          const actualType = typeof value;
          if (actualType !== expectedType) {
            warnings.push({
              documentId: docSnap.id,
              field,
              warning: `Type mismatch: expected ${expectedType}, got ${actualType}`,
              timestamp: new Date(),
            });
          }
        }
      }

      if (docValid) {
        passed++;
      } else {
        failed++;
      }
    }

    return {
      isValid: failed === 0,
      errors,
      warnings,
      summary: {
        totalChecked,
        passed,
        failed,
        warnings: warnings.length,
      },
    };
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

// ============================================================================
// Predefined Validation Rules
// ============================================================================

export const PROGRAM_VALIDATION_RULES: ValidationRule[] = [
  { field: 'name', rule: 'required', message: 'Program name is required' },
  { field: 'code', rule: 'required', message: 'Program code is required' },
  { field: 'budget', rule: 'type', params: { type: 'number' }, message: 'Budget must be a number' },
  { field: 'budget', rule: 'range', params: { min: 0 }, message: 'Budget must be positive' },
  {
    field: 'status',
    rule: 'enum',
    params: { values: ['Active', 'Completed', 'On Hold', 'Cancelled', 'Draft', 'Planning'] },
    message: 'Invalid program status',
  },
];

export const PROJECT_VALIDATION_RULES: ValidationRule[] = [
  { field: 'name', rule: 'required', message: 'Project name is required' },
  { field: 'code', rule: 'required', message: 'Project code is required' },
  { field: 'programId', rule: 'required', message: 'Program ID is required' },
  { field: 'budget', rule: 'range', params: { min: 0 }, message: 'Budget must be positive' },
  {
    field: 'implementationType',
    rule: 'enum',
    params: { values: ['contractor', 'direct'] },
    message: 'Invalid implementation type',
  },
];

export const ENGAGEMENT_VALIDATION_RULES: ValidationRule[] = [
  { field: 'name', rule: 'required', message: 'Engagement name is required' },
  { field: 'code', rule: 'required', message: 'Engagement code is required' },
  { field: 'type', rule: 'required', message: 'Engagement type is required' },
  {
    field: 'type',
    rule: 'enum',
    params: { values: ['program', 'deal', 'advisory_mandate'] },
    message: 'Invalid engagement type',
  },
  { field: 'clientId', rule: 'required', message: 'Client ID is required' },
  { field: 'funding.totalBudget', rule: 'type', params: { type: 'number' }, message: 'Total budget must be a number' },
];

export const V6_PROJECT_VALIDATION_RULES: ValidationRule[] = [
  { field: 'name', rule: 'required', message: 'Project name is required' },
  { field: 'code', rule: 'required', message: 'Project code is required' },
  { field: 'engagementId', rule: 'required', message: 'Engagement ID is required' },
  { field: 'location.name', rule: 'required', message: 'Location name is required' },
  { field: 'budget.allocated', rule: 'type', params: { type: 'number' }, message: 'Budget must be a number' },
  {
    field: 'implementationType',
    rule: 'enum',
    params: { values: ['contractor', 'direct'] },
    message: 'Invalid implementation type',
  },
];

export const dataValidator = new DataValidator();
