/**
 * Project Migration Script
 * Migrates v5 Projects with engagement linking
 */

import {
  collection,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { BatchProcessor } from '../utils/batch-processor';
import { ProgressTracker } from '../utils/progress-tracker';
import { RollbackManager } from '../utils/rollback-manager';
import {
  V5Project,
  V6Project,
  MigrationResult,
  MigrationError,
  MigrationConfig,
} from '../types/migration-types';

// Status mapping
const STATUS_MAP: Record<string, string> = {
  'Active': 'in_progress',
  'Completed': 'completed',
  'On Hold': 'on_hold',
  'Planning': 'planning',
  'Tendering': 'procurement',
  'Design': 'planning',
  'Construction': 'in_progress',
  'Defects Liability': 'in_progress',
  'Cancelled': 'cancelled',
  'Draft': 'draft',
};

export class ProjectMigration {
  private batchProcessor: BatchProcessor;
  private progressTracker: ProgressTracker;
  private rollbackManager: RollbackManager;
  private errors: MigrationError[] = [];
  private engagementMap: Map<string, string> = new Map();
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
      sourceCollection: 'projects',
      targetCollection: 'v6_projects',
      entityType: 'project',
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
    console.log(`Starting Project Migration`);
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log(`========================================\n`);

    const startTime = Date.now();

    // Create migration job
    await this.progressTracker.createJob(this.config, 'migration_script');

    try {
      // Build engagement map (old programId -> new engagementId)
      await this.buildEngagementMap();

      if (this.engagementMap.size === 0) {
        console.warn('Warning: No engagements found. Projects may not link correctly.');
      }

      // Create backup if requested
      if (createBackup && !dryRun) {
        console.log('Creating backup...');
        await this.rollbackManager.createBackup(this.config.sourceCollection);
      }

      // Get total count
      const totalCount = await this.batchProcessor.getCollectionCount(this.config.sourceCollection);
      await this.progressTracker.startJob(totalCount);

      // Process projects
      const result = await this.batchProcessor.processCollection<V5Project, V6Project>(
        this.config.sourceCollection,
        async (project, id) => {
          return this.transformProject(project, id);
        }
      );

      if (!dryRun && result.results.length > 0) {
        // Write transformed projects
        console.log(`\nWriting ${result.results.length} projects...`);
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

      // Dry run result
      await this.progressTracker.completeJob('completed', {
        total: result.processed,
        migrated: result.successful,
        failed: result.failed,
        skipped: result.skipped,
      });

      console.log(`\n========================================`);
      console.log(`DRY RUN COMPLETE`);
      console.log(`Would migrate: ${result.successful} projects`);
      console.log(`Would fail: ${result.failed} projects`);
      console.log(`Would skip: ${result.skipped} projects`);
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
   * Build map of old program IDs to new engagement IDs
   */
  private async buildEngagementMap(): Promise<void> {
    console.log('Building engagement map...');
    
    const engagementsSnapshot = await getDocs(collection(db, 'engagements'));

    for (const doc of engagementsSnapshot.docs) {
      const data = doc.data();
      if (data.migratedFrom?.sourceId) {
        this.engagementMap.set(data.migratedFrom.sourceId, doc.id);
      }
      // Also map by ID directly for cases where ID hasn't changed
      this.engagementMap.set(doc.id, doc.id);
    }

    console.log(`Built engagement map with ${this.engagementMap.size} entries`);
  }

  /**
   * Transform v5 Project to v6 Project
   */
  private async transformProject(
    project: V5Project,
    id: string
  ): Promise<{ success: boolean; data?: V6Project; error?: string; skipped?: boolean }> {
    try {
      // Validate required fields
      if (!project.name) {
        return {
          success: false,
          error: 'Missing required field: name',
        };
      }

      // Resolve engagement ID
      let engagementId = this.engagementMap.get(project.programId);

      if (!engagementId) {
        // Try to use programId directly if it exists in engagements
        engagementId = project.programId;
        console.warn(`No engagement found for program ${project.programId}, using programId directly`);
      }

      // Generate code if missing
      const code = project.code || this.generateCode(project.name);

      // Create v6 project
      const v6Project: V6Project = {
        id: id,
        engagementId: engagementId || 'orphan_' + project.programId,
        name: project.name,
        code: code,
        location: {
          name: project.location || 'Unknown',
        },
        implementationType: project.implementationType || 'contractor',
        budget: {
          allocated: project.budget || 0,
          committed: 0,
          spent: 0,
          currency: 'UGX',
        },
        status: this.mapStatus(project.status),
        timeline: {
          plannedStart: this.normalizeDate(project.createdAt) || undefined,
        },
        createdAt: this.normalizeDate(project.createdAt) || Timestamp.now(),
        updatedAt: Timestamp.now(),
        migratedFrom: {
          version: 'v5.0',
          sourceId: id,
          sourceCollection: 'projects',
          additionalSourceIds: {
            programId: project.programId,
          },
          migratedAt: Timestamp.now(),
        },
      };

      // Add contractor if present
      if (project.contractor) {
        v6Project.contractor = {
          name: project.contractor,
          contact: project.contractorContact,
        };
      }

      // Add progress if present
      if (project.progressPercent !== undefined) {
        v6Project.progress = {
          percent: project.progressPercent,
          lastUpdated: Timestamp.now(),
        };
      }

      return { success: true, data: v6Project };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transform failed',
      };
    }
  }

  /**
   * Map v5 status to v6 status
   */
  private mapStatus(v5Status: string | undefined): string {
    if (!v5Status) return 'draft';
    return STATUS_MAP[v5Status] || 'draft';
  }

  /**
   * Generate code from name
   */
  private generateCode(name: string): string {
    return 'PRJ_' + name
      .split(' ')
      .map(word => word[0]?.toUpperCase() || '')
      .join('')
      .slice(0, 4) + '_' + Date.now().toString(36).slice(-4).toUpperCase();
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
 * Run project migration
 */
export async function migrateProjects(
  options: { dryRun?: boolean; createBackup?: boolean } = { dryRun: true }
): Promise<MigrationResult> {
  const migration = new ProjectMigration();
  return migration.migrate(options);
}
