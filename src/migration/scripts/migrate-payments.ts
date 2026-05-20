/**
 * Payment Migration Script
 * Migrates v5 IPCs and Requisitions to v6 Payments
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
  V5IPC,
  V5Requisition,
  V6Payment,
  MigrationResult,
  MigrationError,
  MigrationConfig,
} from '../types/migration-types';

const IPC_STATUS_MAP: Record<string, string> = {
  'Draft': 'draft',
  'Submitted': 'pending_approval',
  'Approved': 'approved',
  'Paid': 'paid',
  'Rejected': 'rejected',
  'Pending': 'pending_approval',
};

const REQUISITION_STATUS_MAP: Record<string, string> = {
  'Draft': 'draft',
  'Submitted': 'pending_approval',
  'Approved': 'approved',
  'Processed': 'paid',
  'Rejected': 'rejected',
  'Pending': 'pending_approval',
};

export class PaymentMigration {
  private batchProcessor: BatchProcessor;
  private progressTracker: ProgressTracker;
  private rollbackManager: RollbackManager;
  private errors: MigrationError[] = [];
  private projectEngagementMap: Map<string, string> = new Map();
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
      sourceCollection: 'ipcs',
      targetCollection: 'v6_payments',
      entityType: 'ipc',
      batchSize: 100,
      validateBefore: true,
      validateAfter: true,
      createBackup: true,
      dryRun: false,
    };
  }

  /**
   * Run the migration for both IPCs and Requisitions
   */
  async migrate(options: { dryRun?: boolean; createBackup?: boolean } = {}): Promise<MigrationResult> {
    const dryRun = options.dryRun ?? true;
    const createBackup = options.createBackup ?? true;

    console.log(`\n========================================`);
    console.log(`Starting Payment Migration (IPCs + Requisitions)`);
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log(`========================================\n`);

    const startTime = Date.now();

    await this.progressTracker.createJob(this.config, 'migration_script');
    await this.buildProjectEngagementMap();

    try {
      // Migrate IPCs
      console.log('\n--- Migrating IPCs ---');
      const ipcResult = await this.migrateIPCs(dryRun, createBackup);

      // Migrate Requisitions
      console.log('\n--- Migrating Requisitions ---');
      const reqResult = await this.migrateRequisitions(dryRun);

      const totalMigrated = ipcResult.migrated + reqResult.migrated;
      const totalFailed = ipcResult.failed + reqResult.failed;
      const totalProcessed = ipcResult.total + reqResult.total;

      await this.progressTracker.completeJob('completed', {
        total: totalProcessed,
        migrated: totalMigrated,
        failed: totalFailed,
        skipped: 0,
      });

      console.log(`\n========================================`);
      console.log(`Payment Migration ${dryRun ? 'DRY RUN ' : ''}Complete`);
      console.log(`IPCs: ${ipcResult.migrated} migrated, ${ipcResult.failed} failed`);
      console.log(`Requisitions: ${reqResult.migrated} migrated, ${reqResult.failed} failed`);
      console.log(`========================================\n`);

      return {
        jobId: this.progressTracker.getJobId(),
        status: 'completed',
        summary: {
          total: totalProcessed,
          migrated: totalMigrated,
          failed: totalFailed,
          skipped: 0,
        },
        duration: Date.now() - startTime,
        errors: this.errors,
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
   * Build map of projectId -> engagementId
   */
  private async buildProjectEngagementMap(): Promise<void> {
    console.log('Building project-engagement map...');
    
    const projectsSnapshot = await getDocs(collection(db, 'v6_projects'));
    
    for (const doc of projectsSnapshot.docs) {
      const data = doc.data();
      if (data.engagementId) {
        this.projectEngagementMap.set(doc.id, data.engagementId);
      }
      if (data.migratedFrom?.sourceId) {
        this.projectEngagementMap.set(data.migratedFrom.sourceId, data.engagementId);
      }
    }

    console.log(`Built map with ${this.projectEngagementMap.size} entries`);
  }

  /**
   * Migrate IPCs
   */
  private async migrateIPCs(
    dryRun: boolean,
    createBackup: boolean
  ): Promise<{ total: number; migrated: number; failed: number }> {
    if (createBackup && !dryRun) {
      await this.rollbackManager.createBackup('ipcs');
    }

    const result = await this.batchProcessor.processCollection<V5IPC, V6Payment>(
      'ipcs',
      async (ipc, id) => this.transformIPC(ipc, id)
    );

    if (!dryRun && result.results.length > 0) {
      const writeResult = await this.batchProcessor.writeBatch(
        'v6_payments',
        result.results
      );
      return {
        total: result.processed,
        migrated: writeResult.written,
        failed: writeResult.failed + result.failed,
      };
    }

    return {
      total: result.processed,
      migrated: result.successful,
      failed: result.failed,
    };
  }

  /**
   * Migrate Requisitions
   */
  private async migrateRequisitions(
    dryRun: boolean
  ): Promise<{ total: number; migrated: number; failed: number }> {
    const result = await this.batchProcessor.processCollection<V5Requisition, V6Payment>(
      'requisitions',
      async (req, id) => this.transformRequisition(req, id)
    );

    if (!dryRun && result.results.length > 0) {
      const writeResult = await this.batchProcessor.writeBatch(
        'v6_payments',
        result.results,
        { merge: true }
      );
      return {
        total: result.processed,
        migrated: writeResult.written,
        failed: writeResult.failed + result.failed,
      };
    }

    return {
      total: result.processed,
      migrated: result.successful,
      failed: result.failed,
    };
  }

  /**
   * Transform IPC to V6 Payment
   */
  private async transformIPC(
    ipc: V5IPC,
    id: string
  ): Promise<{ success: boolean; data?: V6Payment; error?: string }> {
    try {
      const engagementId = this.projectEngagementMap.get(ipc.projectId);

      if (!engagementId) {
        return {
          success: false,
          error: `No engagement found for project: ${ipc.projectId}`,
        };
      }

      const payment: V6Payment = {
        id: `ipc_${id}`,
        projectId: ipc.projectId,
        engagementId,
        type: 'ipc',
        referenceNumber: ipc.certificateNumber || `IPC-${id}`,
        amount: ipc.amount || 0,
        cumulativeAmount: ipc.cumulativeAmount,
        status: IPC_STATUS_MAP[ipc.status] || 'draft',
        period: {
          from: this.normalizeDate(ipc.periodFrom) || Timestamp.now(),
          to: this.normalizeDate(ipc.periodTo) || Timestamp.now(),
        },
        description: ipc.description,
        approvals: ipc.approvedBy ? [{
          role: 'approver',
          userId: ipc.approvedBy,
          status: 'approved',
          timestamp: this.normalizeDate(ipc.approvedAt),
        }] : [],
        createdAt: this.normalizeDate(ipc.createdAt) || Timestamp.now(),
        updatedAt: Timestamp.now(),
        migratedFrom: {
          version: 'v5.0',
          sourceId: id,
          sourceCollection: 'ipcs',
          migratedAt: Timestamp.now(),
        },
      };

      return { success: true, data: payment };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transform failed',
      };
    }
  }

  /**
   * Transform Requisition to V6 Payment
   */
  private async transformRequisition(
    req: V5Requisition,
    id: string
  ): Promise<{ success: boolean; data?: V6Payment; error?: string }> {
    try {
      const engagementId = this.projectEngagementMap.get(req.projectId);

      if (!engagementId) {
        return {
          success: false,
          error: `No engagement found for project: ${req.projectId}`,
        };
      }

      const payment: V6Payment = {
        id: `req_${id}`,
        projectId: req.projectId,
        engagementId,
        type: 'requisition',
        referenceNumber: req.requisitionNumber || `REQ-${id}`,
        amount: req.amount || 0,
        status: REQUISITION_STATUS_MAP[req.status] || 'draft',
        description: req.description,
        lineItems: req.items?.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          amount: item.amount,
        })),
        approvals: req.approvedAt ? [{
          role: 'approver',
          status: 'approved',
          timestamp: this.normalizeDate(req.approvedAt),
        }] : [],
        createdAt: this.normalizeDate(req.createdAt) || Timestamp.now(),
        updatedAt: Timestamp.now(),
        migratedFrom: {
          version: 'v5.0',
          sourceId: id,
          sourceCollection: 'requisitions',
          migratedAt: Timestamp.now(),
        },
      };

      return { success: true, data: payment };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transform failed',
      };
    }
  }

  private normalizeDate(date: any): Timestamp | undefined {
    if (!date) return undefined;
    if (date instanceof Timestamp) return date;
    if (date instanceof Date) return Timestamp.fromDate(date);
    if (date.toDate) return Timestamp.fromDate(date.toDate());
    if (typeof date === 'string') {
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        return Timestamp.fromDate(parsed);
      }
    }
    return undefined;
  }

  private handleProgress(processed: number, total: number): void {
    const percent = Math.round((processed / total) * 100);
    if (processed % 20 === 0 || processed === total) {
      console.log(`Progress: ${processed}/${total} (${percent}%)`);
    }
  }

  private handleError(error: MigrationError): void {
    this.errors.push(error);
  }
}

export async function migratePayments(
  options: { dryRun?: boolean; createBackup?: boolean } = { dryRun: true }
): Promise<MigrationResult> {
  const migration = new PaymentMigration();
  return migration.migrate(options);
}
