/**
 * Rollback Manager
 * Handles migration rollback procedures and backups
 */

import {
  collection,
  doc,
  getDocs,
  deleteDoc,
  setDoc,
  getDoc,
  query,
  where,
  writeBatch,
  Timestamp,
  orderBy,
  limit,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import {
  MigrationJob,
  BackupInfo,
  RollbackResult,
} from '../types/migration-types';

export class RollbackManager {
  /**
   * Create backup before migration
   */
  async createBackup(
    collectionName: string,
    backupSuffix: string = `_backup_${Date.now()}`
  ): Promise<BackupInfo> {
    const backupCollection = `${collectionName}${backupSuffix}`;
    let documentCount = 0;
    const startTime = Date.now();

    console.log(`Creating backup of ${collectionName} to ${backupCollection}`);

    try {
      const sourceSnapshot = await getDocs(collection(db, collectionName));
      const batchSize = 500;
      let batch = writeBatch(db);
      let batchCount = 0;

      for (const docSnap of sourceSnapshot.docs) {
        const backupRef = doc(db, backupCollection, docSnap.id);
        batch.set(backupRef, {
          ...docSnap.data(),
          _backupTimestamp: Timestamp.now(),
          _sourceCollection: collectionName,
        });
        documentCount++;
        batchCount++;

        // Commit every 500 docs
        if (batchCount >= batchSize) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
          console.log(`Backed up ${documentCount} documents...`);
        }
      }

      // Commit remaining
      if (batchCount > 0) {
        await batch.commit();
      }

      // Record backup info
      const backupInfo: BackupInfo = {
        id: `backup_${Date.now()}`,
        sourceCollection: collectionName,
        backupCollection,
        documentCount,
        createdAt: new Date(),
      };

      await setDoc(doc(db, 'migrationBackups', backupInfo.id), {
        ...backupInfo,
        createdAt: Timestamp.now(),
      });

      const duration = (Date.now() - startTime) / 1000;
      console.log(`Backup complete: ${documentCount} documents in ${duration.toFixed(1)}s`);

      return backupInfo;
    } catch (error) {
      console.error('Backup failed:', error);
      throw error;
    }
  }

  /**
   * Rollback a migration job
   */
  async rollbackMigration(jobId: string): Promise<RollbackResult> {
    const errors: string[] = [];
    let documentsRolledBack = 0;
    let documentsRestored = 0;
    const startTime = Date.now();

    console.log(`Starting rollback for job: ${jobId}`);

    try {
      // Get migration job
      const jobDoc = await getDoc(doc(db, 'migrationJobs', jobId));

      if (!jobDoc.exists()) {
        return {
          success: false,
          jobId,
          documentsRolledBack: 0,
          documentsRestored: 0,
          errors: ['Migration job not found'],
          duration: 0,
        };
      }

      const job = jobDoc.data() as MigrationJob;

      // Find all documents created by this migration
      const targetSnapshot = await getDocs(
        query(
          collection(db, job.config.targetCollection),
          where('migratedFrom.migratedAt', '!=', null)
        )
      );

      // Filter to only documents from this migration job's timeframe
      const jobStartTime = job.startedAt instanceof Date 
        ? Timestamp.fromDate(job.startedAt)
        : job.startedAt;

      const docsToDelete = targetSnapshot.docs.filter(docSnap => {
        const migratedAt = docSnap.data().migratedFrom?.migratedAt;
        if (!migratedAt || !jobStartTime) return false;
        
        const migratedTimestamp = migratedAt instanceof Timestamp 
          ? migratedAt 
          : Timestamp.fromDate(new Date(migratedAt));
        
        return migratedTimestamp.toMillis() >= jobStartTime.toMillis();
      });

      console.log(`Found ${docsToDelete.length} documents to rollback`);

      // Delete in batches
      const batchSize = 500;
      let batch = writeBatch(db);
      let batchCount = 0;

      for (const docSnap of docsToDelete) {
        batch.delete(docSnap.ref);
        batchCount++;
        documentsRolledBack++;

        if (batchCount >= batchSize) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
          console.log(`Rolled back ${documentsRolledBack} documents...`);
        }
      }

      // Commit remaining
      if (batchCount > 0) {
        await batch.commit();
      }

      // Update job status
      await updateDoc(doc(db, 'migrationJobs', jobId), {
        status: 'rolled_back',
        rolledBackAt: Timestamp.now(),
        documentsRolledBack,
      });

      const duration = Date.now() - startTime;
      console.log(`Rollback complete: ${documentsRolledBack} documents in ${(duration / 1000).toFixed(1)}s`);

      return {
        success: true,
        jobId,
        documentsRolledBack,
        documentsRestored,
        errors,
        duration,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Rollback failed';
      errors.push(errorMessage);
      console.error('Rollback error:', error);
      
      return {
        success: false,
        jobId,
        documentsRolledBack,
        documentsRestored,
        errors,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(
    backupCollection: string,
    targetCollection: string,
    options?: { clearTarget?: boolean }
  ): Promise<{ success: boolean; documentsRestored: number; errors: string[] }> {
    const errors: string[] = [];
    let documentsRestored = 0;
    const startTime = Date.now();

    console.log(`Restoring from ${backupCollection} to ${targetCollection}`);

    try {
      // Optionally clear target collection first
      if (options?.clearTarget) {
        console.log('Clearing target collection...');
        const targetSnapshot = await getDocs(collection(db, targetCollection));
        const batchSize = 500;
        let batch = writeBatch(db);
        let batchCount = 0;

        for (const docSnap of targetSnapshot.docs) {
          batch.delete(docSnap.ref);
          batchCount++;

          if (batchCount >= batchSize) {
            await batch.commit();
            batch = writeBatch(db);
            batchCount = 0;
          }
        }

        if (batchCount > 0) {
          await batch.commit();
        }
      }

      // Restore from backup
      const backupSnapshot = await getDocs(collection(db, backupCollection));
      const batchSize = 500;
      let batch = writeBatch(db);
      let batchCount = 0;

      for (const docSnap of backupSnapshot.docs) {
        const data = { ...docSnap.data() };
        
        // Remove backup metadata
        delete data._backupTimestamp;
        delete data._sourceCollection;

        const targetRef = doc(db, targetCollection, docSnap.id);
        batch.set(targetRef, data);
        documentsRestored++;
        batchCount++;

        if (batchCount >= batchSize) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
          console.log(`Restored ${documentsRestored} documents...`);
        }
      }

      // Commit remaining
      if (batchCount > 0) {
        await batch.commit();
      }

      const duration = (Date.now() - startTime) / 1000;
      console.log(`Restore complete: ${documentsRestored} documents in ${duration.toFixed(1)}s`);

      return {
        success: true,
        documentsRestored,
        errors,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Restore failed';
      errors.push(errorMessage);
      console.error('Restore error:', error);
      
      return {
        success: false,
        documentsRestored,
        errors,
      };
    }
  }

  /**
   * Delete backup
   */
  async deleteBackup(backupCollection: string): Promise<{ success: boolean; documentsDeleted: number }> {
    let documentsDeleted = 0;

    try {
      const backupSnapshot = await getDocs(collection(db, backupCollection));
      const batchSize = 500;
      let batch = writeBatch(db);
      let batchCount = 0;

      for (const docSnap of backupSnapshot.docs) {
        batch.delete(docSnap.ref);
        documentsDeleted++;
        batchCount++;

        if (batchCount >= batchSize) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      // Also delete backup info record
      const backupInfoSnapshot = await getDocs(
        query(
          collection(db, 'migrationBackups'),
          where('backupCollection', '==', backupCollection)
        )
      );

      for (const doc of backupInfoSnapshot.docs) {
        await deleteDoc(doc.ref);
      }

      console.log(`Deleted backup: ${backupCollection} (${documentsDeleted} documents)`);

      return { success: true, documentsDeleted };
    } catch (error) {
      console.error('Delete backup error:', error);
      return { success: false, documentsDeleted };
    }
  }

  /**
   * Get all backups
   */
  async getBackups(): Promise<BackupInfo[]> {
    const snapshot = await getDocs(
      query(collection(db, 'migrationBackups'), orderBy('createdAt', 'desc'))
    );

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as BackupInfo;
    });
  }

  /**
   * Get backup by source collection
   */
  async getBackupBySource(sourceCollection: string): Promise<BackupInfo | null> {
    const snapshot = await getDocs(
      query(
        collection(db, 'migrationBackups'),
        where('sourceCollection', '==', sourceCollection),
        orderBy('createdAt', 'desc'),
        limit(1)
      )
    );

    if (snapshot.empty) return null;

    const data = snapshot.docs[0].data();
    return {
      ...data,
      id: snapshot.docs[0].id,
      createdAt: data.createdAt?.toDate() || new Date(),
    } as BackupInfo;
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupCollection: string): Promise<{
    isValid: boolean;
    documentCount: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    let documentCount = 0;

    try {
      const backupSnapshot = await getDocs(collection(db, backupCollection));
      documentCount = backupSnapshot.size;

      // Check for required backup metadata
      for (const docSnap of backupSnapshot.docs) {
        const data = docSnap.data();
        if (!data._backupTimestamp) {
          issues.push(`Document ${docSnap.id} missing backup timestamp`);
        }
      }

      return {
        isValid: issues.length === 0,
        documentCount,
        issues,
      };
    } catch (error) {
      issues.push(error instanceof Error ? error.message : 'Verification failed');
      return {
        isValid: false,
        documentCount,
        issues,
      };
    }
  }
}

export const rollbackManager = new RollbackManager();
