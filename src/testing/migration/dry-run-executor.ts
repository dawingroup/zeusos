/**
 * Migration Dry-Run Executor
 * Executes migration dry-runs with validation and rollback
 */

import {
  Firestore,
  collection,
  getDocs,
  writeBatch,
  doc,
  query,
  limit,
  where,
} from 'firebase/firestore';
import { testCollections } from '../config/test.config';

export interface DryRunConfig {
  sampleSize: number;
  validateOnly: boolean;
  verbose: boolean;
  stopOnError: boolean;
  rollbackOnComplete: boolean;
}

export interface DryRunResult {
  success: boolean;
  duration: number;
  recordsProcessed: {
    programs: number;
    projects: number;
    payments: number;
    deals: number;
    portfolios: number;
    boqs: number;
    requisitions: number;
  };
  validationErrors: ValidationError[];
  transformationErrors: TransformationError[];
  warnings: string[];
  recommendations: string[];
}

export interface ValidationError {
  entityType: string;
  entityId: string;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface TransformationError {
  sourceEntity: string;
  sourceId: string;
  targetEntity: string;
  operation: string;
  error: string;
  stackTrace?: string;
}

const defaultConfig: DryRunConfig = {
  sampleSize: 100,
  validateOnly: false,
  verbose: true,
  stopOnError: false,
  rollbackOnComplete: true,
};

export class DryRunExecutor {
  private db: Firestore;
  private config: DryRunConfig;
  private logs: string[] = [];

  constructor(db: Firestore, config: Partial<DryRunConfig> = {}) {
    this.db = db;
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Execute migration dry-run
   */
  async executeDryRun(): Promise<DryRunResult> {
    const startTime = Date.now();
    const result: DryRunResult = {
      success: true,
      duration: 0,
      recordsProcessed: {
        programs: 0,
        projects: 0,
        payments: 0,
        deals: 0,
        portfolios: 0,
        boqs: 0,
        requisitions: 0,
      },
      validationErrors: [],
      transformationErrors: [],
      warnings: [],
      recommendations: [],
    };

    try {
      this.log('Starting migration dry-run...');

      // Phase 1: Pre-migration validation
      this.log('Phase 1: Pre-migration validation');
      const preValidation = await this.validateSourceData();
      result.validationErrors.push(...preValidation.errors);
      result.warnings.push(...preValidation.warnings);

      if (preValidation.hasBlockingErrors) {
        result.success = false;
        result.recommendations.push('Fix blocking validation errors before proceeding with migration');
        return this.finalizeResult(result, startTime);
      }

      if (this.config.validateOnly) {
        this.log('Validation-only mode. Skipping transformation.');
        return this.finalizeResult(result, startTime);
      }

      // Phase 2: Sample transformation
      this.log('Phase 2: Sample transformation');
      const transformResult = await this.transformSampleData();
      result.recordsProcessed = transformResult.counts;
      result.transformationErrors.push(...transformResult.errors);

      if (transformResult.errors.length > 0 && this.config.stopOnError) {
        result.success = false;
        result.recommendations.push('Review transformation errors and update migration logic');
        return this.finalizeResult(result, startTime);
      }

      // Phase 3: Post-migration validation
      this.log('Phase 3: Post-migration validation');
      const postValidation = await this.validateTransformedData();
      result.validationErrors.push(...postValidation.errors);
      result.warnings.push(...postValidation.warnings);

      // Phase 4: Rollback (if configured)
      if (this.config.rollbackOnComplete) {
        this.log('Phase 4: Rolling back dry-run data');
        await this.rollbackDryRunData();
      }

      // Generate recommendations
      result.recommendations = this.generateRecommendations(result);

      return this.finalizeResult(result, startTime);
    } catch (error) {
      result.success = false;
      result.transformationErrors.push({
        sourceEntity: 'unknown',
        sourceId: 'unknown',
        targetEntity: 'unknown',
        operation: 'dry-run',
        error: error instanceof Error ? error.message : String(error),
        stackTrace: error instanceof Error ? error.stack : undefined,
      });
      return this.finalizeResult(result, startTime);
    }
  }

  /**
   * Validate source data before migration
   */
  private async validateSourceData(): Promise<{
    errors: ValidationError[];
    warnings: string[];
    hasBlockingErrors: boolean;
  }> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // Validate programs
    this.log('Validating programs...');
    const programsQuery = query(
      collection(this.db, testCollections.v5Programs),
      limit(this.config.sampleSize)
    );
    const programsSnapshot = await getDocs(programsQuery);

    for (const docSnapshot of programsSnapshot.docs) {
      const data = docSnapshot.data();

      if (!data.name) {
        errors.push({
          entityType: 'program',
          entityId: docSnapshot.id,
          field: 'name',
          message: 'Program name is required',
          severity: 'error',
        });
      }

      if (!data.totalBudget || data.totalBudget <= 0) {
        warnings.push(`Program ${docSnapshot.id} has invalid budget: ${data.totalBudget}`);
      }

      if (!data.funder) {
        warnings.push(`Program ${docSnapshot.id} has no funder specified`);
      }
    }

    // Validate projects
    this.log('Validating projects...');
    const projectsQuery = query(
      collection(this.db, testCollections.v5Projects),
      limit(this.config.sampleSize)
    );
    const projectsSnapshot = await getDocs(projectsQuery);

    for (const docSnapshot of projectsSnapshot.docs) {
      const data = docSnapshot.data();

      if (!data.programId) {
        errors.push({
          entityType: 'project',
          entityId: docSnapshot.id,
          field: 'programId',
          message: 'Project must belong to a program',
          severity: 'error',
        });
      }

      if (!data.name) {
        errors.push({
          entityType: 'project',
          entityId: docSnapshot.id,
          field: 'name',
          message: 'Project name is required',
          severity: 'error',
        });
      }

      // Check for orphaned projects
      if (data.programId) {
        const programExists = programsSnapshot.docs.some(p => p.id === data.programId);
        if (!programExists) {
          errors.push({
            entityType: 'project',
            entityId: docSnapshot.id,
            field: 'programId',
            message: `Referenced program ${data.programId} does not exist`,
            severity: 'error',
          });
        }
      }
    }

    // Validate payments
    this.log('Validating payments...');
    const paymentsQuery = query(
      collection(this.db, testCollections.v5Payments),
      limit(this.config.sampleSize)
    );
    const paymentsSnapshot = await getDocs(paymentsQuery);

    for (const docSnapshot of paymentsSnapshot.docs) {
      const data = docSnapshot.data();

      if (!data.projectId) {
        errors.push({
          entityType: 'payment',
          entityId: docSnapshot.id,
          field: 'projectId',
          message: 'Payment must belong to a project',
          severity: 'error',
        });
      }

      if (data.grossAmount < 0) {
        errors.push({
          entityType: 'payment',
          entityId: docSnapshot.id,
          field: 'grossAmount',
          message: 'Gross amount cannot be negative',
          severity: 'error',
        });
      }

      if (data.netAmount > data.grossAmount) {
        warnings.push(`Payment ${docSnapshot.id} has net amount greater than gross amount`);
      }
    }

    this.log(`Validation complete: ${errors.length} errors, ${warnings.length} warnings`);

    return {
      errors,
      warnings,
      hasBlockingErrors: errors.some(e => e.severity === 'error'),
    };
  }

  /**
   * Transform sample data
   */
  private async transformSampleData(): Promise<{
    counts: DryRunResult['recordsProcessed'];
    errors: TransformationError[];
  }> {
    const counts: DryRunResult['recordsProcessed'] = {
      programs: 0,
      projects: 0,
      payments: 0,
      deals: 0,
      portfolios: 0,
      boqs: 0,
      requisitions: 0,
    };
    const errors: TransformationError[] = [];

    try {
      // Transform programs to engagements
      this.log('Transforming programs to engagements...');
      const programsResult = await this.transformPrograms();
      counts.programs = programsResult.count;
      errors.push(...programsResult.errors);

      // Transform projects
      this.log('Transforming projects...');
      const projectsResult = await this.transformProjects();
      counts.projects = projectsResult.count;
      errors.push(...projectsResult.errors);

      // Transform payments
      this.log('Transforming payments...');
      const paymentsResult = await this.transformPayments();
      counts.payments = paymentsResult.count;
      errors.push(...paymentsResult.errors);

      this.log(`Transformation complete: ${counts.programs} programs, ${counts.projects} projects, ${counts.payments} payments`);

    } catch (error) {
      errors.push({
        sourceEntity: 'unknown',
        sourceId: 'unknown',
        targetEntity: 'unknown',
        operation: 'batch_transform',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return { counts, errors };
  }

  /**
   * Transform programs to engagements
   */
  private async transformPrograms(): Promise<{
    count: number;
    errors: TransformationError[];
  }> {
    const errors: TransformationError[] = [];
    let count = 0;

    const programsQuery = query(
      collection(this.db, testCollections.v5Programs),
      limit(this.config.sampleSize)
    );
    const snapshot = await getDocs(programsQuery);

    const batch = writeBatch(this.db);

    for (const docSnapshot of snapshot.docs) {
      try {
        const v5Data = docSnapshot.data();

        // Transform to v6 engagement
        const engagement = {
          id: `eng_${docSnapshot.id}`,
          type: 'infrastructure',
          name: v5Data.name,
          code: v5Data.projectCode || `PRG_${docSnapshot.id.slice(-6).toUpperCase()}`,
          clientId: 'amh_default_client',
          status: this.mapStatus(v5Data.status),
          funding: {
            type: this.mapFundingType(v5Data.funder),
            sources: [{
              name: v5Data.funder || 'Unknown',
              type: this.mapFundingType(v5Data.funder),
              amount: v5Data.totalBudget || 0,
              percentage: 100,
            }],
            totalBudget: v5Data.totalBudget || 0,
            currency: v5Data.currency || 'UGX',
          },
          timeline: {
            startDate: v5Data.startDate,
            endDate: v5Data.endDate,
            milestones: [],
          },
          metadata: {
            region: v5Data.region,
            countryManager: v5Data.countryManager,
          },
          v5SourceId: docSnapshot.id,
          isDryRun: true,
          migratedAt: new Date(),
          createdAt: v5Data.createdAt || new Date(),
          updatedAt: new Date(),
        };

        batch.set(doc(this.db, testCollections.engagements, engagement.id), engagement);

        // Create ID mapping
        batch.set(doc(this.db, testCollections.migrationMappings, `prog_${docSnapshot.id}`), {
          v5Collection: 'programs',
          v5Id: docSnapshot.id,
          v6Collection: 'engagements',
          v6Id: engagement.id,
          isDryRun: true,
          migratedAt: new Date(),
        });

        count++;
      } catch (error) {
        errors.push({
          sourceEntity: 'program',
          sourceId: docSnapshot.id,
          targetEntity: 'engagement',
          operation: 'transform',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await batch.commit();
    return { count, errors };
  }

  /**
   * Transform projects
   */
  private async transformProjects(): Promise<{
    count: number;
    errors: TransformationError[];
  }> {
    const errors: TransformationError[] = [];
    let count = 0;

    const projectsQuery = query(
      collection(this.db, testCollections.v5Projects),
      limit(this.config.sampleSize)
    );
    const snapshot = await getDocs(projectsQuery);

    const batch = writeBatch(this.db);

    for (const docSnapshot of snapshot.docs) {
      try {
        const v5Data = docSnapshot.data();

        // Find engagement ID from mapping
        const engagementId = `eng_${v5Data.programId}`;

        const project = {
          id: `proj_${docSnapshot.id}`,
          engagementId,
          name: v5Data.name,
          code: v5Data.projectCode || `PRJ_${docSnapshot.id.slice(-6).toUpperCase()}`,
          status: this.mapStatus(v5Data.status),
          implementationType: v5Data.implementationType || 'contractor',
          location: {
            name: v5Data.district || 'Unknown',
            district: v5Data.district,
            subcounty: v5Data.subcounty,
          },
          contractor: v5Data.contractorName ? {
            name: v5Data.contractorName,
          } : null,
          budget: {
            allocated: v5Data.contractValue || 0,
            committed: 0,
            spent: 0,
            currency: 'UGX',
          },
          timeline: {
            percentComplete: v5Data.physicalProgress || 0,
          },
          v5SourceId: docSnapshot.id,
          v5ProgramId: v5Data.programId,
          isDryRun: true,
          migratedAt: new Date(),
          createdAt: v5Data.createdAt || new Date(),
          updatedAt: new Date(),
        };

        batch.set(doc(this.db, testCollections.projects, project.id), project);

        // Create ID mapping
        batch.set(doc(this.db, testCollections.migrationMappings, `proj_${docSnapshot.id}`), {
          v5Collection: 'projects',
          v5Id: docSnapshot.id,
          v6Collection: 'v6_projects',
          v6Id: project.id,
          isDryRun: true,
          migratedAt: new Date(),
        });

        count++;
      } catch (error) {
        errors.push({
          sourceEntity: 'project',
          sourceId: docSnapshot.id,
          targetEntity: 'project',
          operation: 'transform',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await batch.commit();
    return { count, errors };
  }

  /**
   * Transform payments
   */
  private async transformPayments(): Promise<{
    count: number;
    errors: TransformationError[];
  }> {
    const errors: TransformationError[] = [];
    let count = 0;

    const paymentsQuery = query(
      collection(this.db, testCollections.v5Payments),
      limit(this.config.sampleSize)
    );
    const snapshot = await getDocs(paymentsQuery);

    const batch = writeBatch(this.db);

    for (const docSnapshot of snapshot.docs) {
      try {
        const v5Data = docSnapshot.data();

        const projectId = `proj_${v5Data.projectId}`;
        const engagementId = `eng_${v5Data.programId}`;

        const payment = {
          id: `pay_${docSnapshot.id}`,
          projectId,
          engagementId,
          type: this.mapPaymentType(v5Data.paymentType),
          reference: v5Data.certificateNumber || `PAY_${docSnapshot.id.slice(-6).toUpperCase()}`,
          status: this.mapPaymentStatus(v5Data.status),
          period: {
            from: v5Data.periodFrom,
            to: v5Data.periodTo,
          },
          amounts: {
            cumulative: v5Data.grossAmount || 0,
            previous: 0,
            current: v5Data.grossAmount || 0,
            retention: v5Data.retentionAmount || 0,
            net: v5Data.netAmount || 0,
          },
          v5SourceId: docSnapshot.id,
          v5ProjectId: v5Data.projectId,
          v5ProgramId: v5Data.programId,
          isDryRun: true,
          migratedAt: new Date(),
          createdAt: v5Data.createdAt || new Date(),
          updatedAt: new Date(),
        };

        batch.set(doc(this.db, testCollections.payments, payment.id), payment);

        // Create ID mapping
        batch.set(doc(this.db, testCollections.migrationMappings, `pay_${docSnapshot.id}`), {
          v5Collection: 'payments',
          v5Id: docSnapshot.id,
          v6Collection: 'v6_payments',
          v6Id: payment.id,
          isDryRun: true,
          migratedAt: new Date(),
        });

        count++;
      } catch (error) {
        errors.push({
          sourceEntity: 'payment',
          sourceId: docSnapshot.id,
          targetEntity: 'payment',
          operation: 'transform',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await batch.commit();
    return { count, errors };
  }

  /**
   * Validate transformed data
   */
  private async validateTransformedData(): Promise<{
    errors: ValidationError[];
    warnings: string[];
  }> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // Validate engagements
    this.log('Validating transformed engagements...');
    const engagementsQuery = query(
      collection(this.db, testCollections.engagements),
      where('isDryRun', '==', true)
    );
    const engagementsSnapshot = await getDocs(engagementsQuery);

    for (const docSnapshot of engagementsSnapshot.docs) {
      const data = docSnapshot.data();

      if (!data.type) {
        errors.push({
          entityType: 'engagement',
          entityId: docSnapshot.id,
          field: 'type',
          message: 'Engagement type is required',
          severity: 'error',
        });
      }

      if (!data.funding || !data.funding.type) {
        errors.push({
          entityType: 'engagement',
          entityId: docSnapshot.id,
          field: 'funding',
          message: 'Funding information is required',
          severity: 'error',
        });
      }

      if (!data.v5SourceId) {
        warnings.push(`Engagement ${docSnapshot.id} missing v5 source ID reference`);
      }
    }

    // Validate projects referential integrity
    this.log('Validating transformed projects...');
    const projectsQuery = query(
      collection(this.db, testCollections.projects),
      where('isDryRun', '==', true)
    );
    const projectsSnapshot = await getDocs(projectsQuery);

    for (const projectDoc of projectsSnapshot.docs) {
      const data = projectDoc.data();

      if (data.engagementId) {
        const engagementExists = engagementsSnapshot.docs.some(
          e => e.id === data.engagementId
        );
        if (!engagementExists) {
          errors.push({
            entityType: 'project',
            entityId: projectDoc.id,
            field: 'engagementId',
            message: `Referenced engagement ${data.engagementId} does not exist`,
            severity: 'error',
          });
        }
      }
    }

    this.log(`Post-migration validation complete: ${errors.length} errors, ${warnings.length} warnings`);

    return { errors, warnings };
  }

  /**
   * Rollback dry-run data
   */
  private async rollbackDryRunData(): Promise<void> {
    this.log('Rolling back dry-run data...');

    const batch = writeBatch(this.db);
    let deleteCount = 0;

    // Delete dry-run engagements
    const engagementsQuery = query(
      collection(this.db, testCollections.engagements),
      where('isDryRun', '==', true)
    );
    const engagementsSnapshot = await getDocs(engagementsQuery);
    for (const docSnapshot of engagementsSnapshot.docs) {
      batch.delete(docSnapshot.ref);
      deleteCount++;
    }

    // Delete dry-run projects
    const projectsQuery = query(
      collection(this.db, testCollections.projects),
      where('isDryRun', '==', true)
    );
    const projectsSnapshot = await getDocs(projectsQuery);
    for (const docSnapshot of projectsSnapshot.docs) {
      batch.delete(docSnapshot.ref);
      deleteCount++;
    }

    // Delete dry-run payments
    const paymentsQuery = query(
      collection(this.db, testCollections.payments),
      where('isDryRun', '==', true)
    );
    const paymentsSnapshot = await getDocs(paymentsQuery);
    for (const docSnapshot of paymentsSnapshot.docs) {
      batch.delete(docSnapshot.ref);
      deleteCount++;
    }

    // Delete dry-run mappings
    const mappingsQuery = query(
      collection(this.db, testCollections.migrationMappings),
      where('isDryRun', '==', true)
    );
    const mappingsSnapshot = await getDocs(mappingsQuery);
    for (const docSnapshot of mappingsSnapshot.docs) {
      batch.delete(docSnapshot.ref);
      deleteCount++;
    }

    await batch.commit();
    this.log(`Rollback complete: ${deleteCount} documents deleted`);
  }

  /**
   * Map v5 status to v6
   */
  private mapStatus(v5Status: string | undefined): string {
    const mapping: Record<string, string> = {
      'active': 'active',
      'Active': 'active',
      'completed': 'completed',
      'Completed': 'completed',
      'suspended': 'on_hold',
      'Suspended': 'on_hold',
      'planning': 'planning',
      'Planning': 'planning',
      'construction': 'in_progress',
      'Construction': 'in_progress',
    };
    return mapping[v5Status || ''] || 'draft';
  }

  /**
   * Map funding type from funder name
   */
  private mapFundingType(funder: string | undefined): string {
    if (!funder) return 'grant';
    const lower = funder.toLowerCase();
    if (lower.includes('government') || lower.includes('gou')) return 'government';
    if (lower.includes('private')) return 'private';
    if (lower.includes('mixed')) return 'mixed';
    return 'grant';
  }

  /**
   * Map payment type
   */
  private mapPaymentType(v5Type: string | undefined): string {
    const mapping: Record<string, string> = {
      'IPC': 'ipc',
      'Requisition': 'requisition',
      'Advance': 'advance',
    };
    return mapping[v5Type || ''] || 'ipc';
  }

  /**
   * Map payment status
   */
  private mapPaymentStatus(v5Status: string | undefined): string {
    const mapping: Record<string, string> = {
      'draft': 'draft',
      'Draft': 'draft',
      'approved': 'approved',
      'Approved': 'approved',
      'paid': 'paid',
      'Paid': 'paid',
    };
    return mapping[v5Status || ''] || 'draft';
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(result: DryRunResult): string[] {
    const recommendations: string[] = [];

    if (result.validationErrors.length > 0) {
      const errorCount = result.validationErrors.filter(e => e.severity === 'error').length;
      recommendations.push(
        `Fix ${errorCount} blocking validation errors before production migration`
      );
    }

    if (result.transformationErrors.length > 0) {
      recommendations.push(
        `Review ${result.transformationErrors.length} transformation errors and update migration logic`
      );
    }

    const totalRecords = Object.values(result.recordsProcessed).reduce((a, b) => a + b, 0);
    if (totalRecords > 0) {
      const estimatedTime = (totalRecords / this.config.sampleSize) * (result.duration / 1000);
      recommendations.push(
        `Estimated full migration time: ${Math.ceil(estimatedTime / 60)} minutes`
      );
    }

    if (result.warnings.length > 10) {
      recommendations.push(
        'Consider data cleanup before migration to reduce warnings'
      );
    }

    recommendations.push('Run dry-run on full dataset before production migration');
    recommendations.push('Schedule migration during low-traffic period');
    recommendations.push('Ensure backup is created before production migration');

    return recommendations;
  }

  /**
   * Finalize result
   */
  private finalizeResult(result: DryRunResult, startTime: number): DryRunResult {
    result.duration = Date.now() - startTime;
    this.log(`Dry-run completed in ${result.duration}ms`);
    this.log(`Success: ${result.success}`);
    this.log(`Validation errors: ${result.validationErrors.length}`);
    this.log(`Transformation errors: ${result.transformationErrors.length}`);
    return result;
  }

  /**
   * Log message
   */
  private log(message: string): void {
    const logEntry = `[DryRun] ${new Date().toISOString()} - ${message}`;
    this.logs.push(logEntry);
    if (this.config.verbose) {
      console.log(logEntry);
    }
  }

  /**
   * Get logs
   */
  getLogs(): string[] {
    return [...this.logs];
  }
}
