/**
 * Program Migration Script
 * Migrates v5 Programs to v6 Engagements
 */

import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { BatchProcessor } from '../utils/batch-processor';
import { ProgressTracker } from '../utils/progress-tracker';
import { RollbackManager } from '../utils/rollback-manager';
import {
  V5Program,
  V6Engagement,
  V6FundingConfig,
  MigrationResult,
  MigrationError,
  MigrationConfig,
} from '../types/migration-types';

// Funding source mapping
const FUNDING_TYPE_MAP: Record<string, V6FundingConfig['type']> = {
  'AMH': 'grant',
  'Government': 'government',
  'GoU': 'government',
  'Private': 'private',
  'Mixed': 'mixed',
  'Grant': 'grant',
  'Donor': 'grant',
  'Budget': 'government',
  'World Bank': 'grant',
  'AfDB': 'grant',
  'EU': 'grant',
  'USAID': 'grant',
  'JICA': 'grant',
};

// Status mapping
const STATUS_MAP: Record<string, string> = {
  'Active': 'active',
  'Completed': 'completed',
  'On Hold': 'on_hold',
  'Cancelled': 'cancelled',
  'Draft': 'draft',
  'Planning': 'planning',
  'Closed': 'completed',
  'Suspended': 'on_hold',
};

export class ProgramMigration {
  private batchProcessor: BatchProcessor;
  private progressTracker: ProgressTracker;
  private rollbackManager: RollbackManager;
  private errors: MigrationError[] = [];
  private config: MigrationConfig;

  constructor() {
    this.progressTracker = new ProgressTracker();
    this.rollbackManager = new RollbackManager();
    this.batchProcessor = new BatchProcessor({
      batchSize: 100,
      onProgress: this.handleProgress.bind(this),
      onError: this.handleError.bind(this),
    });
    this.config = {
      sourceCollection: 'programs',
      targetCollection: 'engagements',
      entityType: 'program',
      batchSize: 100,
      validateBefore: true,
      validateAfter: true,
      createBackup: true,
      dryRun: false,
    };
  }

  /**
   * Run the migration
   */
  async migrate(options: { dryRun?: boolean; createBackup?: boolean } = {}): Promise<MigrationResult> {
    const dryRun = options.dryRun ?? true;
    const createBackup = options.createBackup ?? true;

    console.log(`\n========================================`);
    console.log(`Starting Program Migration`);
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log(`Backup: ${createBackup ? 'Yes' : 'No'}`);
    console.log(`========================================\n`);

    const startTime = Date.now();

    // Create migration job
    await this.progressTracker.createJob(this.config, 'migration_script');

    try {
      // Create backup if requested
      if (createBackup && !dryRun) {
        console.log('Creating backup...');
        await this.rollbackManager.createBackup(this.config.sourceCollection);
      }

      // Get total count
      const totalCount = await this.batchProcessor.getCollectionCount(this.config.sourceCollection);
      await this.progressTracker.startJob(totalCount);

      // Process programs
      const result = await this.batchProcessor.processCollection<V5Program, V6Engagement>(
        this.config.sourceCollection,
        async (program, id) => {
          return this.transformProgram(program, id);
        }
      );

      if (!dryRun && result.results.length > 0) {
        // Write transformed engagements
        console.log(`\nWriting ${result.results.length} engagements...`);
        const writeResult = await this.batchProcessor.writeBatch(
          this.config.targetCollection,
          result.results
        );

        // Complete job
        await this.progressTracker.completeJob('completed', {
          total: result.processed,
          migrated: writeResult.written,
          failed: writeResult.failed + result.failed,
          skipped: result.skipped,
        });

        return {
          jobId: this.progressTracker.getJobId(),
          status: 'completed',
          summary: {
            total: result.processed,
            migrated: writeResult.written,
            failed: writeResult.failed + result.failed,
            skipped: result.skipped,
          },
          duration: Date.now() - startTime,
          errors: [...result.errors, ...writeResult.errors],
        };
      }

      // Dry run - just return what would be migrated
      await this.progressTracker.completeJob('completed', {
        total: result.processed,
        migrated: result.successful,
        failed: result.failed,
        skipped: result.skipped,
      });

      console.log(`\n========================================`);
      console.log(`DRY RUN COMPLETE`);
      console.log(`Would migrate: ${result.successful} programs`);
      console.log(`Would fail: ${result.failed} programs`);
      console.log(`Would skip: ${result.skipped} programs`);
      console.log(`========================================\n`);

      return {
        jobId: this.progressTracker.getJobId(),
        status: 'completed',
        summary: {
          total: result.processed,
          migrated: result.successful,
          failed: result.failed,
          skipped: result.skipped,
        },
        duration: Date.now() - startTime,
        errors: result.errors,
      };
    } catch (error) {
      console.error('Migration failed:', error);
      await this.progressTracker.completeJob('failed', {
        total: 0,
        migrated: 0,
        failed: 0,
        skipped: 0,
      });
      throw error;
    }
  }

  /**
   * Transform v5 Program to v6 Engagement
   */
  private async transformProgram(
    program: V5Program,
    id: string
  ): Promise<{ success: boolean; data?: V6Engagement; error?: string; skipped?: boolean }> {
    try {
      // Validate required fields
      if (!program.name) {
        return {
          success: false,
          error: 'Missing required field: name',
        };
      }

      // Generate code if missing
      const code = program.code || this.generateCode(program.name);

      // Determine funding type
      const fundingType = this.resolveFundingType(program.fundingSource);

      // Build funding config
      const funding: V6FundingConfig = {
        type: fundingType,
        sources: [{
          name: program.fundingSource || 'Unknown',
          type: fundingType,
          amount: program.budget || 0,
          percentage: 100,
        }],
        totalBudget: program.budget || 0,
        currency: 'UGX',
      };

      // Resolve client ID
      const clientId = await this.resolveClientId(program);

      // Create engagement
      const engagement: V6Engagement = {
        id: id,
        type: 'program',
        name: program.name,
        code: code,
        clientId: clientId,
        status: this.mapStatus(program.status),
        funding,
        timeline: {
          startDate: this.normalizeDate(program.startDate),
          endDate: this.normalizeDate(program.endDate),
          milestones: [],
        },
        description: program.description,
        createdAt: this.normalizeDate(program.createdAt) || Timestamp.now(),
        updatedAt: Timestamp.now(),
        migratedFrom: {
          version: 'v5.0',
          sourceId: id,
          sourceCollection: 'programs',
          migratedAt: Timestamp.now(),
        },
      };

      return { success: true, data: engagement };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transform failed',
      };
    }
  }

  /**
   * Resolve funding type from source name
   */
  private resolveFundingType(fundingSource: string | undefined): V6FundingConfig['type'] {
    if (!fundingSource) return 'grant';

    // Check exact match
    if (FUNDING_TYPE_MAP[fundingSource]) {
      return FUNDING_TYPE_MAP[fundingSource];
    }

    // Check partial matches
    const lowerSource = fundingSource.toLowerCase();
    if (lowerSource.includes('government') || lowerSource.includes('gou')) {
      return 'government';
    }
    if (lowerSource.includes('private')) {
      return 'private';
    }
    if (lowerSource.includes('mixed') || lowerSource.includes('blend')) {
      return 'mixed';
    }

    return 'grant';
  }

  /**
   * Resolve or create client ID for program
   */
  private async resolveClientId(program: V5Program): Promise<string> {
    try {
      // Check if client exists based on funding source
      const clientQuery = query(
        collection(db, 'clients'),
        where('name', '==', program.fundingSource)
      );
      const snapshot = await getDocs(clientQuery);

      if (!snapshot.empty) {
        return snapshot.docs[0].id;
      }
    } catch {
      // Ignore errors, use default
    }

    // Return default client ID
    return 'amh_default_client';
  }

  /**
   * Map v5 status to v6 status
   */
  private mapStatus(v5Status: string | undefined): string {
    if (!v5Status) return 'active';
    return STATUS_MAP[v5Status] || 'active';
  }

  /**
   * Generate code from name
   */
  private generateCode(name: string): string {
    return name
      .split(' ')
      .map(word => word[0]?.toUpperCase() || '')
      .join('')
      .slice(0, 6) + '_' + Date.now().toString(36).slice(-4).toUpperCase();
  }

  /**
   * Normalize date to Timestamp
   */
  private normalizeDate(date: any): Timestamp | null {
    if (!date) return null;
    if (date instanceof Timestamp) return date;
    if (date instanceof Date) return Timestamp.fromDate(date);
    if (date.toDate) return Timestamp.fromDate(date.toDate());
    if (typeof date === 'string') {
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        return Timestamp.fromDate(parsed);
      }
    }
    return null;
  }

  private handleProgress(processed: number, total: number): void {
    const percent = Math.round((processed / total) * 100);
    if (processed % 10 === 0 || processed === total) {
      console.log(`Progress: ${processed}/${total} (${percent}%)`);
    }
  }

  private handleError(error: MigrationError): void {
    this.errors.push(error);
    console.error(`Error migrating ${error.documentId}: ${error.error}`);
  }
}

/**
 * Run program migration
 */
export async function migratePrograms(
  options: { dryRun?: boolean; createBackup?: boolean } = { dryRun: true }
): Promise<MigrationResult> {
  const migration = new ProgramMigration();
  return migration.migrate(options);
}
