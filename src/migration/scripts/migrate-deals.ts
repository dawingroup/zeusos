/**
 * Deal Migration Script
 * Migrates v5 Deals to v6 Engagements (type: deal)
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
  V5Deal,
  V6Engagement,
  V6FundingConfig,
  MigrationResult,
  MigrationError,
  MigrationConfig,
} from '../types/migration-types';

const STAGE_STATUS_MAP: Record<string, string> = {
  'Lead': 'lead',
  'Qualified': 'qualified',
  'Proposal': 'proposal',
  'Negotiation': 'negotiation',
  'Closed Won': 'closed_won',
  'Closed Lost': 'closed_lost',
  'On Hold': 'on_hold',
};

const SECTOR_FUNDING_MAP: Record<string, V6FundingConfig['type']> = {
  'Infrastructure': 'government',
  'Agriculture': 'mixed',
  'Energy': 'private',
  'Technology': 'private',
  'Healthcare': 'mixed',
  'Education': 'government',
  'Real Estate': 'private',
  'Financial Services': 'private',
};

export class DealMigration {
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
      sourceCollection: 'deals',
      targetCollection: 'engagements',
      entityType: 'deal',
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
    console.log(`Starting Deal Migration`);
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log(`========================================\n`);

    const startTime = Date.now();

    await this.progressTracker.createJob(this.config, 'migration_script');

    try {
      if (createBackup && !dryRun) {
        console.log('Creating backup...');
        await this.rollbackManager.createBackup(this.config.sourceCollection);
      }

      const totalCount = await this.batchProcessor.getCollectionCount(this.config.sourceCollection);
      await this.progressTracker.startJob(totalCount);

      const result = await this.batchProcessor.processCollection<V5Deal, V6Engagement>(
        this.config.sourceCollection,
        async (deal, id) => this.transformDeal(deal, id)
      );

      if (!dryRun && result.results.length > 0) {
        console.log(`\nWriting ${result.results.length} deal engagements...`);
        const writeResult = await this.batchProcessor.writeBatch(
          this.config.targetCollection,
          result.results,
          { merge: true }
        );

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

      await this.progressTracker.completeJob('completed', {
        total: result.processed,
        migrated: result.successful,
        failed: result.failed,
        skipped: result.skipped,
      });

      console.log(`\n========================================`);
      console.log(`DRY RUN COMPLETE`);
      console.log(`Would migrate: ${result.successful} deals`);
      console.log(`Would fail: ${result.failed} deals`);
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
   * Transform v5 Deal to v6 Engagement
   */
  private async transformDeal(
    deal: V5Deal,
    id: string
  ): Promise<{ success: boolean; data?: V6Engagement; error?: string }> {
    try {
      if (!deal.name) {
        return {
          success: false,
          error: 'Missing required field: name',
        };
      }

      const code = this.generateCode(deal.name);
      const fundingType = SECTOR_FUNDING_MAP[deal.sector] || 'private';
      const clientId = await this.resolveClientId(deal);

      const funding: V6FundingConfig = {
        type: fundingType,
        sources: [{
          name: deal.sector || 'Private Investment',
          type: fundingType,
          amount: deal.value || 0,
          percentage: 100,
        }],
        totalBudget: deal.value || 0,
        currency: 'USD',
      };

      const engagement: V6Engagement = {
        id: `deal_${id}`,
        type: 'deal',
        name: deal.name,
        code: code,
        clientId: clientId,
        status: STAGE_STATUS_MAP[deal.stage] || 'lead',
        funding,
        description: deal.description,
        timeline: {
          startDate: this.normalizeDate(deal.createdAt),
          endDate: this.normalizeDate(deal.dueDate),
          milestones: [],
        },
        metadata: {
          sector: deal.sector,
          subsector: deal.subsector,
          originalStage: deal.stage,
          linkedProjectId: deal.projectId,
        },
        createdAt: this.normalizeDate(deal.createdAt) || Timestamp.now(),
        updatedAt: Timestamp.now(),
        migratedFrom: {
          version: 'v5.0',
          sourceId: id,
          sourceCollection: 'deals',
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
   * Resolve client ID from deal
   */
  private async resolveClientId(deal: V5Deal): Promise<string> {
    if (deal.clientName) {
      try {
        const clientQuery = query(
          collection(db, 'clients'),
          where('name', '==', deal.clientName)
        );
        const snapshot = await getDocs(clientQuery);
        if (!snapshot.empty) {
          return snapshot.docs[0].id;
        }
      } catch {
        // Ignore, use default
      }
    }
    return 'advisory_default_client';
  }

  private generateCode(name: string): string {
    return 'DEAL_' + name
      .split(' ')
      .map(word => word[0]?.toUpperCase() || '')
      .join('')
      .slice(0, 4) + '_' + Date.now().toString(36).slice(-4).toUpperCase();
  }

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
  }
}

export async function migrateDeals(
  options: { dryRun?: boolean; createBackup?: boolean } = { dryRun: true }
): Promise<MigrationResult> {
  const migration = new DealMigration();
  return migration.migrate(options);
}
