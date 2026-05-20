/**
 * Performance Benchmark Tests
 * Benchmark tests for operations performance
 * 
 * Prerequisites:
 * - Java installed (for Firebase emulators)
 * - Run: npm run emulators
 * - Then: npm run test:integration
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { doc, setDoc, getDoc, getDocs, collection, query, where, orderBy, limit, writeBatch } from 'firebase/firestore';
import { testEnvManager } from '../utils/test-environment';
import { TestDataFactory } from '../factories/test-data.factory';
import { testCollections } from '../config/test.config';
import { validatePerformance, formatPerformanceResult } from './thresholds.config';

// Initialize test environment
beforeAll(async () => {
  await testEnvManager.initialize({ useEmulator: true });
});

interface BenchmarkResult {
  operation: string;
  recordCount: number;
  duration: number;
  avgLatency: number;
  throughput: number;
  memoryUsage: number;
}

const benchmarkResults: BenchmarkResult[] = [];

function recordBenchmark(
  operation: string,
  recordCount: number,
  duration: number
): BenchmarkResult {
  const memoryUsage = process.memoryUsage?.().heapUsed || 0;
  const result: BenchmarkResult = {
    operation,
    recordCount,
    duration,
    avgLatency: duration / recordCount,
    throughput: (recordCount / duration) * 1000,
    memoryUsage,
  };
  benchmarkResults.push(result);
  return result;
}

describe('Performance Benchmarks', () => {
  beforeEach(async () => {
    await testEnvManager.reset();
  });

  describe('Write Performance', () => {
    it('should benchmark single engagement creation', async () => {
      const db = testEnvManager.getFirestore();
      const engagement = TestDataFactory.createEngagement();

      const startTime = performance.now();
      await setDoc(doc(db, testCollections.engagements, engagement.id), engagement);
      const duration = performance.now() - startTime;

      const result = recordBenchmark('create_engagement', 1, duration);
      const validation = validatePerformance('create_engagement', result.avgLatency, result.throughput, result.memoryUsage);
      
      console.log(formatPerformanceResult(validation));
      expect(result.avgLatency).toBeLessThan(500); // Generous threshold for emulator
    });

    it('should benchmark bulk engagement creation', async () => {
      const db = testEnvManager.getFirestore();
      const engagements = TestDataFactory.createBatch(
        () => TestDataFactory.createEngagement(),
        50
      );

      const startTime = performance.now();
      for (const engagement of engagements) {
        await setDoc(doc(db, testCollections.engagements, engagement.id), engagement);
      }
      const duration = performance.now() - startTime;

      const result = recordBenchmark('bulk_create_engagement', 50, duration);
      
      expect(result.avgLatency).toBeLessThan(200);
      expect(result.throughput).toBeGreaterThan(2);
    });

    it('should benchmark batch write operations', async () => {
      const db = testEnvManager.getFirestore();
      const engagements = TestDataFactory.createBatch(
        () => TestDataFactory.createEngagement(),
        100
      );

      const startTime = performance.now();

      // Write in batches of 500 (Firestore limit)
      const batchSize = 500;
      for (let i = 0; i < engagements.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = engagements.slice(i, i + batchSize);

        for (const engagement of chunk) {
          batch.set(doc(db, testCollections.engagements, engagement.id), engagement);
        }

        await batch.commit();
      }

      const duration = performance.now() - startTime;
      const result = recordBenchmark('batch_write', 100, duration);

      expect(result.avgLatency).toBeLessThan(50);
    });
  });

  describe('Read Performance', () => {
    it('should benchmark single engagement read', async () => {
      const db = testEnvManager.getFirestore();
      const engagement = TestDataFactory.createEngagement();
      await setDoc(doc(db, testCollections.engagements, engagement.id), engagement);

      const startTime = performance.now();
      await getDoc(doc(db, testCollections.engagements, engagement.id));
      const duration = performance.now() - startTime;

      const result = recordBenchmark('read_engagement', 1, duration);
      
      expect(result.avgLatency).toBeLessThan(200);
    });

    it('should benchmark engagement list query', async () => {
      const db = testEnvManager.getFirestore();

      // Setup: Create 100 engagements
      const engagements = TestDataFactory.createBatch(
        () => TestDataFactory.createEngagement(),
        100
      );
      for (const eng of engagements) {
        await setDoc(doc(db, testCollections.engagements, eng.id), eng);
      }

      const startTime = performance.now();
      const snapshot = await getDocs(collection(db, testCollections.engagements));
      const duration = performance.now() - startTime;

      const result = recordBenchmark('list_engagements', snapshot.docs.length, duration);

      expect(result.duration).toBeLessThan(2000);
    });

    it('should benchmark filtered query performance', async () => {
      const db = testEnvManager.getFirestore();

      // Setup: Create mixed engagements
      const infraEngagements = TestDataFactory.createBatch(
        () => TestDataFactory.createEngagement({ type: 'infrastructure', status: 'active' }),
        50
      );
      const investEngagements = TestDataFactory.createBatch(
        () => TestDataFactory.createEngagement({ type: 'investment', status: 'active' }),
        50
      );

      for (const eng of [...infraEngagements, ...investEngagements]) {
        await setDoc(doc(db, testCollections.engagements, eng.id), eng);
      }

      const startTime = performance.now();

      const q = query(
        collection(db, testCollections.engagements),
        where('type', '==', 'infrastructure'),
        where('status', '==', 'active'),
        limit(25)
      );
      const snapshot = await getDocs(q);

      const duration = performance.now() - startTime;
      const result = recordBenchmark('filtered_query', snapshot.docs.length, duration);

      expect(result.duration).toBeLessThan(1000);
    });

    it('should benchmark pagination performance', async () => {
      const db = testEnvManager.getFirestore();

      // Setup: Create 100 engagements
      const engagements = TestDataFactory.createBatch(
        () => TestDataFactory.createEngagement(),
        100
      );
      for (const eng of engagements) {
        await setDoc(doc(db, testCollections.engagements, eng.id), eng);
      }

      const pageSize = 25;
      let totalDuration = 0;
      let pageCount = 0;

      // Paginate through results
      for (let i = 0; i < 4; i++) {
        const startTime = performance.now();

        const q = query(
          collection(db, testCollections.engagements),
          orderBy('createdAt', 'desc'),
          limit(pageSize)
        );
        await getDocs(q);

        totalDuration += performance.now() - startTime;
        pageCount++;
      }

      const result = recordBenchmark(`paginated_query`, pageCount, totalDuration);

      expect(result.avgLatency).toBeLessThan(300);
    });
  });

  describe('Migration Performance', () => {
    it('should benchmark migration transformation', async () => {
      const db = testEnvManager.getFirestore();

      // Setup: Create v5 data
      const { programs, projects, payments } = TestDataFactory.createFullV5Dataset(5, 5, 2);

      for (const prog of programs) {
        await setDoc(doc(db, testCollections.v5Programs, prog.id), prog);
      }
      for (const proj of projects) {
        await setDoc(doc(db, testCollections.v5Projects, proj.id), proj);
      }
      for (const pay of payments) {
        await setDoc(doc(db, testCollections.v5Payments, pay.id), pay);
      }

      const totalRecords = programs.length + projects.length + payments.length;
      const startTime = performance.now();

      // Simulate migration (read and transform)
      const programsSnapshot = await getDocs(collection(db, testCollections.v5Programs));
      const projectsSnapshot = await getDocs(collection(db, testCollections.v5Projects));
      const paymentsSnapshot = await getDocs(collection(db, testCollections.v5Payments));

      // Transform and write
      const batch = writeBatch(db);
      
      for (const docSnap of programsSnapshot.docs) {
        const data = docSnap.data();
        batch.set(doc(db, testCollections.engagements, `eng_${docSnap.id}`), {
          ...data,
          type: 'infrastructure',
          migratedAt: new Date(),
        });
      }

      for (const docSnap of projectsSnapshot.docs) {
        const data = docSnap.data();
        batch.set(doc(db, testCollections.projects, `proj_${docSnap.id}`), {
          ...data,
          engagementId: `eng_${data.programId}`,
          migratedAt: new Date(),
        });
      }

      for (const docSnap of paymentsSnapshot.docs) {
        const data = docSnap.data();
        batch.set(doc(db, testCollections.payments, `pay_${docSnap.id}`), {
          ...data,
          migratedAt: new Date(),
        });
      }

      await batch.commit();

      const duration = performance.now() - startTime;
      const result = recordBenchmark('migration', totalRecords, duration);

      console.log(`Migration Performance:
        - Total Records: ${totalRecords}
        - Programs: ${programs.length}
        - Projects: ${projects.length}
        - Payments: ${payments.length}
        - Duration: ${duration.toFixed(2)}ms
        - Throughput: ${result.throughput.toFixed(2)} records/sec
      `);

      expect(result.throughput).toBeGreaterThan(5);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent read operations', async () => {
      const db = testEnvManager.getFirestore();

      // Setup: Create engagements
      const engagements = TestDataFactory.createBatch(
        () => TestDataFactory.createEngagement(),
        50
      );
      for (const eng of engagements) {
        await setDoc(doc(db, testCollections.engagements, eng.id), eng);
      }

      const concurrentReads = 10;
      const startTime = performance.now();

      // Execute concurrent reads
      const promises = Array.from({ length: concurrentReads }, () =>
        getDocs(collection(db, testCollections.engagements))
      );

      await Promise.all(promises);

      const duration = performance.now() - startTime;
      const result = recordBenchmark('concurrent_read', concurrentReads, duration);

      expect(result.avgLatency).toBeLessThan(500);
    });

    it('should handle concurrent write operations', async () => {
      const db = testEnvManager.getFirestore();

      const concurrentWrites = 10;
      const engagements = TestDataFactory.createBatch(
        () => TestDataFactory.createEngagement(),
        concurrentWrites
      );

      const startTime = performance.now();

      // Execute concurrent writes
      const promises = engagements.map(eng =>
        setDoc(doc(db, testCollections.engagements, eng.id), eng)
      );

      await Promise.all(promises);

      const duration = performance.now() - startTime;
      const result = recordBenchmark('concurrent_write', concurrentWrites, duration);

      expect(result.avgLatency).toBeLessThan(300);
    });

    it('should handle mixed concurrent operations', async () => {
      const db = testEnvManager.getFirestore();

      // Setup some data first
      const existingEngagements = TestDataFactory.createBatch(
        () => TestDataFactory.createEngagement(),
        20
      );
      for (const eng of existingEngagements) {
        await setDoc(doc(db, testCollections.engagements, eng.id), eng);
      }

      const newEngagements = TestDataFactory.createBatch(
        () => TestDataFactory.createEngagement(),
        10
      );

      const startTime = performance.now();

      // Mix of reads and writes
      const promises = [
        ...newEngagements.map(eng =>
          setDoc(doc(db, testCollections.engagements, eng.id), eng)
        ),
        ...Array.from({ length: 10 }, () =>
          getDocs(collection(db, testCollections.engagements))
        ),
      ];

      await Promise.all(promises);

      const duration = performance.now() - startTime;
      const result = recordBenchmark('mixed_concurrent', 20, duration);

      expect(result.avgLatency).toBeLessThan(400);
    });
  });
});

// Vitest bench examples - only run with `npm run test:benchmark`
// These are commented out for regular test runs
// To run benchmarks: npm run test:benchmark
/*
describe('Vitest Benchmarks', () => {
  bench('engagement creation', async () => {
    const db = testEnvManager.getFirestore();
    const engagement = TestDataFactory.createEngagement();
    await setDoc(doc(db, testCollections.engagements, engagement.id), engagement);
  });

  bench('engagement read', async () => {
    const db = testEnvManager.getFirestore();
    const engagement = TestDataFactory.createEngagement();
    await setDoc(doc(db, testCollections.engagements, engagement.id), engagement);
    await getDoc(doc(db, testCollections.engagements, engagement.id));
  });

  bench('batch write 10 items', async () => {
    const db = testEnvManager.getFirestore();
    const engagements = TestDataFactory.createBatch(
      () => TestDataFactory.createEngagement(),
      10
    );

    const batch = writeBatch(db);
    for (const eng of engagements) {
      batch.set(doc(db, testCollections.engagements, eng.id), eng);
    }
    await batch.commit();
  });
});
*/
