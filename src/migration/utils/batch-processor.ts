/**
 * Batch Processor
 * Handles batch operations with rate limiting and error handling
 */

import {
  collection,
  doc,
  getDocs,
  writeBatch,
  query,
  orderBy,
  limit,
  startAfter,
  DocumentSnapshot,
  Timestamp,
  getCountFromServer,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { MigrationError } from '../types/migration-types';

interface BatchProcessorOptions {
  batchSize: number;
  delayBetweenBatches: number; // ms
  maxRetries: number;
  onProgress?: (processed: number, total: number) => void;
  onError?: (error: MigrationError) => void;
  onBatchComplete?: (batchNumber: number, batchSize: number) => void;
}

interface ProcessResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  skipped?: boolean;
}

interface BatchProcessResult<R> {
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  results: R[];
  errors: MigrationError[];
}

interface BatchWriteResult {
  written: number;
  failed: number;
  errors: MigrationError[];
}

export class BatchProcessor {
  private options: BatchProcessorOptions;

  constructor(options: Partial<BatchProcessorOptions> = {}) {
    this.options = {
      batchSize: options.batchSize || 500,
      delayBetweenBatches: options.delayBetweenBatches || 100,
      maxRetries: options.maxRetries || 3,
      onProgress: options.onProgress,
      onError: options.onError,
      onBatchComplete: options.onBatchComplete,
    };
  }

  /**
   * Get total document count in a collection
   */
  async getCollectionCount(collectionName: string): Promise<number> {
    try {
      const coll = collection(db, collectionName);
      const snapshot = await getCountFromServer(coll);
      return snapshot.data().count;
    } catch {
      // Fallback to getting all docs if count not available
      const snapshot = await getDocs(collection(db, collectionName));
      return snapshot.size;
    }
  }

  /**
   * Process all documents in a collection
   */
  async processCollection<T, R>(
    collectionName: string,
    processor: (doc: T, id: string) => Promise<ProcessResult<R>>
  ): Promise<BatchProcessResult<R>> {
    const results: R[] = [];
    const errors: MigrationError[] = [];
    let processed = 0;
    let successful = 0;
    let failed = 0;
    let skipped = 0;
    let lastDoc: DocumentSnapshot | null = null;
    let batchNumber = 0;

    // Get total count for progress tracking
    const total = await this.getCollectionCount(collectionName);
    console.log(`Starting batch processing of ${total} documents from ${collectionName}`);

    while (true) {
      // Build query with pagination
      let q = query(
        collection(db, collectionName),
        orderBy('__name__'),
        limit(this.options.batchSize)
      );

      if (lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        break;
      }

      batchNumber++;

      // Process batch
      for (const docSnap of snapshot.docs) {
        const id = docSnap.id;
        const data = docSnap.data() as T;

        let result: ProcessResult<R> | undefined;
        let retries = 0;

        while (retries < this.options.maxRetries) {
          try {
            result = await processor(data, id);
            break;
          } catch (error) {
            retries++;
            if (retries >= this.options.maxRetries) {
              result = {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
              };
            }
            await this.delay(100 * retries);
          }
        }

        processed++;

        if (result?.skipped) {
          skipped++;
        } else if (result?.success && result?.data) {
          successful++;
          results.push(result.data);
        } else {
          failed++;
          const migrationError: MigrationError = {
            documentId: id,
            error: result?.error || 'Processing failed',
            severity: 'medium',
            timestamp: new Date(),
          };
          errors.push(migrationError);
          this.options.onError?.(migrationError);
        }

        this.options.onProgress?.(processed, total);
      }

      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      this.options.onBatchComplete?.(batchNumber, snapshot.docs.length);

      // Delay between batches to avoid rate limiting
      await this.delay(this.options.delayBetweenBatches);
    }

    console.log(`Batch processing complete: ${successful} successful, ${failed} failed, ${skipped} skipped`);

    return { processed, successful, failed, skipped, results, errors };
  }

  /**
   * Write documents in batches
   */
  async writeBatch<T extends { id: string }>(
    collectionName: string,
    documents: T[],
    options?: { merge?: boolean }
  ): Promise<BatchWriteResult> {
    const errors: MigrationError[] = [];
    let written = 0;
    let failed = 0;
    const merge = options?.merge ?? false;

    console.log(`Writing ${documents.length} documents to ${collectionName}`);

    // Process in batches of 500 (Firestore limit)
    const maxBatchSize = Math.min(this.options.batchSize, 500);

    for (let i = 0; i < documents.length; i += maxBatchSize) {
      const batch = documents.slice(i, i + maxBatchSize);
      const writeBatchOp = writeBatch(db);

      for (const document of batch) {
        const { id, ...data } = document;
        const docRef = doc(db, collectionName, id);
        
        if (merge) {
          writeBatchOp.set(docRef, {
            ...data,
            migratedAt: Timestamp.now(),
          }, { merge: true });
        } else {
          writeBatchOp.set(docRef, {
            ...data,
            migratedAt: Timestamp.now(),
          });
        }
      }

      try {
        await writeBatchOp.commit();
        written += batch.length;
        console.log(`Wrote batch ${Math.floor(i / maxBatchSize) + 1}: ${batch.length} documents`);
      } catch (error) {
        failed += batch.length;
        console.error(`Batch write failed:`, error);
        for (const document of batch) {
          errors.push({
            documentId: document.id,
            error: error instanceof Error ? error.message : 'Batch write failed',
            severity: 'high',
            timestamp: new Date(),
          });
        }
      }

      this.options.onProgress?.(i + batch.length, documents.length);
      await this.delay(this.options.delayBetweenBatches);
    }

    return { written, failed, errors };
  }

  /**
   * Delete documents in batches
   */
  async deleteBatch(
    collectionName: string,
    documentIds: string[]
  ): Promise<{ deleted: number; failed: number; errors: MigrationError[] }> {
    const errors: MigrationError[] = [];
    let deleted = 0;
    let failed = 0;

    const maxBatchSize = Math.min(this.options.batchSize, 500);

    for (let i = 0; i < documentIds.length; i += maxBatchSize) {
      const batch = documentIds.slice(i, i + maxBatchSize);
      const writeBatchOp = writeBatch(db);

      for (const id of batch) {
        const docRef = doc(db, collectionName, id);
        writeBatchOp.delete(docRef);
      }

      try {
        await writeBatchOp.commit();
        deleted += batch.length;
      } catch (error) {
        failed += batch.length;
        for (const id of batch) {
          errors.push({
            documentId: id,
            error: error instanceof Error ? error.message : 'Batch delete failed',
            severity: 'high',
            timestamp: new Date(),
          });
        }
      }

      await this.delay(this.options.delayBetweenBatches);
    }

    return { deleted, failed, errors };
  }

  /**
   * Process with concurrency control
   */
  async processWithConcurrency<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    concurrency: number = 5
  ): Promise<{ results: R[]; errors: Error[] }> {
    const results: R[] = [];
    const errors: Error[] = [];
    let currentIndex = 0;

    const worker = async () => {
      while (currentIndex < items.length) {
        const index = currentIndex++;
        try {
          const result = await processor(items[index], index);
          results[index] = result;
        } catch (error) {
          errors.push(error instanceof Error ? error : new Error(String(error)));
        }
      }
    };

    const workers = Array(Math.min(concurrency, items.length))
      .fill(null)
      .map(() => worker());

    await Promise.all(workers);

    return { results: results.filter(Boolean), errors };
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create a pre-configured batch processor
 */
export function createBatchProcessor(
  options?: Partial<BatchProcessorOptions>
): BatchProcessor {
  return new BatchProcessor(options);
}

export const defaultBatchProcessor = new BatchProcessor();
