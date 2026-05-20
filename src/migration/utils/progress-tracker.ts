/**
 * Progress Tracker
 * Tracks and reports migration progress
 */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import {
  MigrationJob,
  MigrationProgress,
  MigrationSummary,
  MigrationError,
  MigrationWarning,
  EntityType,
} from '../types/migration-types';

export class ProgressTracker {
  private jobId: string;
  private startTime: number = 0;
  private lastUpdateTime: number = 0;
  private processedCounts: number[] = [];

  constructor(jobId?: string) {
    this.jobId = jobId || `migration_${Date.now()}`;
  }

  /**
   * Create a new migration job
   */
  async createJob(
    config: MigrationJob['config'],
    createdBy: string = 'system'
  ): Promise<string> {
    const job: MigrationJob = {
      id: this.jobId,
      config,
      status: 'pending',
      totalDocuments: 0,
      processedDocuments: 0,
      successfulDocuments: 0,
      failedDocuments: 0,
      errors: [],
      warnings: [],
      createdBy,
      createdAt: new Date(),
    };

    await setDoc(doc(db, 'migrationJobs', this.jobId), {
      ...job,
      createdAt: serverTimestamp(),
    });

    console.log(`Created migration job: ${this.jobId}`);
    return this.jobId;
  }

  /**
   * Start the migration job
   */
  async startJob(totalDocuments: number): Promise<void> {
    this.startTime = Date.now();
    this.lastUpdateTime = this.startTime;

    await updateDoc(doc(db, 'migrationJobs', this.jobId), {
      status: 'in_progress',
      totalDocuments,
      startedAt: serverTimestamp(),
    });

    console.log(`Started migration job: ${this.jobId} with ${totalDocuments} documents`);
  }

  /**
   * Update progress
   */
  async updateProgress(
    processed: number,
    successful: number,
    failed: number,
    _currentPhase?: MigrationProgress['phase']
  ): Promise<void> {
    const now = Date.now();
    this.processedCounts.push(processed);

    // Keep last 10 counts for rate calculation
    if (this.processedCounts.length > 10) {
      this.processedCounts.shift();
    }

    // Calculate estimated time remaining
    const elapsedSeconds = (now - this.startTime) / 1000;
    const rate = processed / elapsedSeconds;
    const remaining = await this.getJob().then(job => 
      job ? (job.totalDocuments - processed) / rate : 0
    );

    // Only update Firestore every 2 seconds to reduce writes
    if (now - this.lastUpdateTime >= 2000) {
      await updateDoc(doc(db, 'migrationJobs', this.jobId), {
        processedDocuments: processed,
        successfulDocuments: successful,
        failedDocuments: failed,
        estimatedCompletion: remaining > 0 
          ? new Date(Date.now() + remaining * 1000)
          : null,
      });
      this.lastUpdateTime = now;
    }
  }

  /**
   * Add error to job
   */
  async addError(error: MigrationError): Promise<void> {
    const job = await this.getJob();
    if (!job) return;

    const errors = [...job.errors, error];
    
    // Keep last 100 errors to prevent document size issues
    const trimmedErrors = errors.slice(-100);

    await updateDoc(doc(db, 'migrationJobs', this.jobId), {
      errors: trimmedErrors,
      failedDocuments: job.failedDocuments + 1,
    });
  }

  /**
   * Add warning to job
   */
  async addWarning(warning: MigrationWarning): Promise<void> {
    const job = await this.getJob();
    if (!job) return;

    const warnings = [...job.warnings, warning];
    const trimmedWarnings = warnings.slice(-100);

    await updateDoc(doc(db, 'migrationJobs', this.jobId), {
      warnings: trimmedWarnings,
    });
  }

  /**
   * Complete the migration job
   */
  async completeJob(
    status: 'completed' | 'failed',
    summary: { total: number; migrated: number; failed: number; skipped: number }
  ): Promise<void> {
    const duration = Date.now() - this.startTime;

    await updateDoc(doc(db, 'migrationJobs', this.jobId), {
      status,
      completedAt: serverTimestamp(),
      totalDocuments: summary.total,
      processedDocuments: summary.total,
      successfulDocuments: summary.migrated,
      failedDocuments: summary.failed,
    });

    console.log(`Migration job ${this.jobId} ${status} in ${Math.round(duration / 1000)}s`);
    console.log(`Summary: ${summary.migrated} migrated, ${summary.failed} failed, ${summary.skipped} skipped`);
  }

  /**
   * Mark job as validating
   */
  async setValidating(): Promise<void> {
    await updateDoc(doc(db, 'migrationJobs', this.jobId), {
      status: 'validating',
    });
  }

  /**
   * Get current job
   */
  async getJob(): Promise<MigrationJob | null> {
    const snapshot = await getDocs(
      query(collection(db, 'migrationJobs'), where('id', '==', this.jobId))
    );

    if (snapshot.empty) return null;

    const data = snapshot.docs[0].data();
    return {
      ...data,
      id: snapshot.docs[0].id,
      createdAt: data.createdAt?.toDate() || new Date(),
      startedAt: data.startedAt?.toDate(),
      completedAt: data.completedAt?.toDate(),
    } as MigrationJob;
  }

  /**
   * Subscribe to job updates
   */
  subscribeToJob(callback: (job: MigrationJob) => void): () => void {
    return onSnapshot(doc(db, 'migrationJobs', this.jobId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        callback({
          ...data,
          id: snapshot.id,
          createdAt: data.createdAt?.toDate() || new Date(),
          startedAt: data.startedAt?.toDate(),
          completedAt: data.completedAt?.toDate(),
        } as MigrationJob);
      }
    });
  }

  /**
   * Get job ID
   */
  getJobId(): string {
    return this.jobId;
  }
}

/**
 * Get migration summary across all jobs
 */
export async function getMigrationSummary(): Promise<MigrationSummary> {
  const snapshot = await getDocs(
    query(collection(db, 'migrationJobs'), orderBy('createdAt', 'desc'))
  );

  const jobs = snapshot.docs.map(doc => doc.data() as MigrationJob);

  const completedJobs = jobs.filter(j => j.status === 'completed').length;
  const failedJobs = jobs.filter(j => j.status === 'failed').length;
  const inProgressJobs = jobs.filter(j => j.status === 'in_progress').length;

  const totalDocumentsMigrated = jobs
    .filter(j => j.status === 'completed')
    .reduce((sum, j) => sum + j.successfulDocuments, 0);

  const totalErrors = jobs.reduce((sum, j) => sum + j.errors.length, 0);

  const lastCompleted = jobs.find(j => j.status === 'completed');

  return {
    totalJobs: jobs.length,
    completedJobs,
    failedJobs,
    inProgressJobs,
    totalDocumentsMigrated,
    totalErrors,
    lastMigrationAt: lastCompleted?.completedAt instanceof Date 
      ? lastCompleted.completedAt 
      : undefined,
  };
}

/**
 * Get all migration jobs
 */
export async function getAllMigrationJobs(): Promise<MigrationJob[]> {
  const snapshot = await getDocs(
    query(collection(db, 'migrationJobs'), orderBy('createdAt', 'desc'))
  );

  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      createdAt: data.createdAt?.toDate() || new Date(),
      startedAt: data.startedAt?.toDate(),
      completedAt: data.completedAt?.toDate(),
    } as MigrationJob;
  });
}

/**
 * Get jobs by entity type
 */
export async function getJobsByEntityType(entityType: EntityType): Promise<MigrationJob[]> {
  const snapshot = await getDocs(
    query(
      collection(db, 'migrationJobs'),
      where('config.entityType', '==', entityType),
      orderBy('createdAt', 'desc')
    )
  );

  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      createdAt: data.createdAt?.toDate() || new Date(),
      startedAt: data.startedAt?.toDate(),
      completedAt: data.completedAt?.toDate(),
    } as MigrationJob;
  });
}

/**
 * Subscribe to all migration jobs
 */
export function subscribeToMigrationJobs(
  callback: (jobs: MigrationJob[]) => void
): () => void {
  return onSnapshot(
    query(collection(db, 'migrationJobs'), orderBy('createdAt', 'desc')),
    (snapshot) => {
      const jobs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate() || new Date(),
          startedAt: data.startedAt?.toDate(),
          completedAt: data.completedAt?.toDate(),
        } as MigrationJob;
      });
      callback(jobs);
    }
  );
}
