/**
 * Migration Dry-Run Tests
 * Tests for migration validation and transformation
 * 
 * Prerequisites:
 * - Java installed (for Firebase emulators)
 * - Run: npm run emulators
 * - Then: npm run test:migration
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { doc, setDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { testEnvManager } from '../utils/test-environment';
import { TestDataFactory } from '../factories/test-data.factory';
import { DryRunExecutor } from './dry-run-executor';
import { testCollections } from '../config/test.config';

// Initialize test environment
beforeAll(async () => {
  await testEnvManager.initialize({ useEmulator: true });
});

describe('Migration Dry-Run Tests', () => {
  let dryRunExecutor: DryRunExecutor;

  beforeEach(async () => {
    await testEnvManager.reset();
    const db = testEnvManager.getFirestore();
    dryRunExecutor = new DryRunExecutor(db, {
      sampleSize: 10,
      verbose: false,
      rollbackOnComplete: true,
    });
  });

  describe('Validation Phase', () => {
    it('should detect missing required fields', async () => {
      const db = testEnvManager.getFirestore();

      // Create program with missing name
      await setDoc(doc(db, testCollections.v5Programs, 'prog-1'), {
        totalBudget: 1000000,
        currency: 'UGX',
        // Missing: name
      });

      const result = await dryRunExecutor.executeDryRun();

      expect(result.validationErrors.some(
        e => e.entityType === 'program' && e.field === 'name'
      )).toBe(true);
    });

    it('should detect orphaned project references', async () => {
      const db = testEnvManager.getFirestore();

      // Create project referencing non-existent program
      await setDoc(doc(db, testCollections.v5Projects, 'proj-1'), {
        programId: 'non-existent-program',
        name: 'Test Project',
      });

      const result = await dryRunExecutor.executeDryRun();

      expect(result.validationErrors.some(
        e => e.entityType === 'project' && e.message.includes('does not exist')
      )).toBe(true);
    });

    it('should detect negative payment amounts', async () => {
      const db = testEnvManager.getFirestore();

      const program = TestDataFactory.createV5Program();
      const project = TestDataFactory.createV5Project(program.id);

      await setDoc(doc(db, testCollections.v5Programs, program.id), program);
      await setDoc(doc(db, testCollections.v5Projects, project.id), project);

      // Create payment with negative amount
      await setDoc(doc(db, testCollections.v5Payments, 'pay-1'), {
        programId: program.id,
        projectId: project.id,
        grossAmount: -100000,
        netAmount: -95000,
      });

      const result = await dryRunExecutor.executeDryRun();

      expect(result.validationErrors.some(
        e => e.entityType === 'payment' && e.field === 'grossAmount'
      )).toBe(true);
    });

    it('should pass validation for valid data', async () => {
      const db = testEnvManager.getFirestore();

      const program = TestDataFactory.createV5Program();
      const project = TestDataFactory.createV5Project(program.id);
      const payment = TestDataFactory.createV5Payment(program.id, project.id);

      await setDoc(doc(db, testCollections.v5Programs, program.id), program);
      await setDoc(doc(db, testCollections.v5Projects, project.id), project);
      await setDoc(doc(db, testCollections.v5Payments, payment.id), payment);

      const result = await dryRunExecutor.executeDryRun();

      const blockingErrors = result.validationErrors.filter(e => e.severity === 'error');
      expect(blockingErrors).toHaveLength(0);
    });
  });

  describe('Transformation Phase', () => {
    it('should transform programs to engagements', async () => {
      const db = testEnvManager.getFirestore();

      const programs = TestDataFactory.createBatch(
        () => TestDataFactory.createV5Program(),
        5
      );

      for (const prog of programs) {
        await setDoc(doc(db, testCollections.v5Programs, prog.id), prog);
      }

      const executor = new DryRunExecutor(db, {
        sampleSize: 10,
        rollbackOnComplete: false,
        verbose: false,
      });

      const result = await executor.executeDryRun();

      expect(result.recordsProcessed.programs).toBe(5);
      expect(result.transformationErrors).toHaveLength(0);

      // Verify engagements created
      const engagementsQuery = query(
        collection(db, testCollections.engagements),
        where('isDryRun', '==', true)
      );
      const engagementsSnapshot = await getDocs(engagementsQuery);
      expect(engagementsSnapshot.docs.length).toBe(5);
    });

    it('should maintain referential integrity', async () => {
      const db = testEnvManager.getFirestore();

      const program = TestDataFactory.createV5Program();
      const projects = TestDataFactory.createBatch(
        () => TestDataFactory.createV5Project(program.id),
        3
      );
      const payments = projects.flatMap(proj =>
        TestDataFactory.createBatch(
          () => TestDataFactory.createV5Payment(program.id, proj.id),
          2
        )
      );

      await setDoc(doc(db, testCollections.v5Programs, program.id), program);
      for (const proj of projects) {
        await setDoc(doc(db, testCollections.v5Projects, proj.id), proj);
      }
      for (const pay of payments) {
        await setDoc(doc(db, testCollections.v5Payments, pay.id), pay);
      }

      const executor = new DryRunExecutor(db, {
        sampleSize: 20,
        rollbackOnComplete: false,
        verbose: false,
      });

      const result = await executor.executeDryRun();

      expect(result.success).toBe(true);
      expect(result.recordsProcessed.programs).toBe(1);
      expect(result.recordsProcessed.projects).toBe(3);
      expect(result.recordsProcessed.payments).toBe(6);
    });

    it('should create ID mappings', async () => {
      const db = testEnvManager.getFirestore();

      const program = TestDataFactory.createV5Program();
      await setDoc(doc(db, testCollections.v5Programs, program.id), program);

      const executor = new DryRunExecutor(db, {
        sampleSize: 10,
        rollbackOnComplete: false,
        verbose: false,
      });

      await executor.executeDryRun();

      // Verify mapping created
      const mappingsQuery = query(
        collection(db, testCollections.migrationMappings),
        where('v5Id', '==', program.id)
      );
      const mappingsSnapshot = await getDocs(mappingsQuery);
      expect(mappingsSnapshot.docs.length).toBe(1);
      expect(mappingsSnapshot.docs[0].data().v5Collection).toBe('programs');
      expect(mappingsSnapshot.docs[0].data().v6Collection).toBe('engagements');
    });

    it('should map status correctly', async () => {
      const db = testEnvManager.getFirestore();

      const activeProgram = TestDataFactory.createV5Program({ status: 'active' });
      const completedProgram = TestDataFactory.createV5Program({ status: 'completed' });
      const suspendedProgram = TestDataFactory.createV5Program({ status: 'suspended' });

      await setDoc(doc(db, testCollections.v5Programs, activeProgram.id), activeProgram);
      await setDoc(doc(db, testCollections.v5Programs, completedProgram.id), completedProgram);
      await setDoc(doc(db, testCollections.v5Programs, suspendedProgram.id), suspendedProgram);

      const executor = new DryRunExecutor(db, {
        sampleSize: 10,
        rollbackOnComplete: false,
        verbose: false,
      });

      await executor.executeDryRun();

      // Verify status mapping
      const engagementsSnapshot = await getDocs(collection(db, testCollections.engagements));
      const statuses = engagementsSnapshot.docs.map(d => d.data().status);
      
      expect(statuses).toContain('active');
      expect(statuses).toContain('completed');
      expect(statuses).toContain('on_hold'); // suspended -> on_hold
    });
  });

  describe('Rollback Phase', () => {
    it('should rollback all dry-run data', async () => {
      const db = testEnvManager.getFirestore();

      const programs = TestDataFactory.createBatch(
        () => TestDataFactory.createV5Program(),
        3
      );

      for (const prog of programs) {
        await setDoc(doc(db, testCollections.v5Programs, prog.id), prog);
      }

      const executor = new DryRunExecutor(db, {
        sampleSize: 10,
        rollbackOnComplete: true,
        verbose: false,
      });

      await executor.executeDryRun();

      // Verify dry-run engagements are removed
      const engagementsQuery = query(
        collection(db, testCollections.engagements),
        where('isDryRun', '==', true)
      );
      const engagementsSnapshot = await getDocs(engagementsQuery);
      expect(engagementsSnapshot.docs).toHaveLength(0);

      // Verify mappings are removed
      const mappingsQuery = query(
        collection(db, testCollections.migrationMappings),
        where('isDryRun', '==', true)
      );
      const mappingsSnapshot = await getDocs(mappingsQuery);
      expect(mappingsSnapshot.docs).toHaveLength(0);
    });
  });

  describe('Recommendations', () => {
    it('should generate recommendations based on results', async () => {
      const db = testEnvManager.getFirestore();

      const programs = TestDataFactory.createBatch(
        () => TestDataFactory.createV5Program(),
        5
      );

      for (const prog of programs) {
        await setDoc(doc(db, testCollections.v5Programs, prog.id), prog);
      }

      const result = await dryRunExecutor.executeDryRun();

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.some(r => r.includes('dry-run'))).toBe(true);
    });

    it('should estimate migration time', async () => {
      const db = testEnvManager.getFirestore();

      const { programs, projects, payments } = TestDataFactory.createFullV5Dataset(2, 5, 3);

      for (const prog of programs) {
        await setDoc(doc(db, testCollections.v5Programs, prog.id), prog);
      }
      for (const proj of projects) {
        await setDoc(doc(db, testCollections.v5Projects, proj.id), proj);
      }
      for (const pay of payments) {
        await setDoc(doc(db, testCollections.v5Payments, pay.id), pay);
      }

      const result = await dryRunExecutor.executeDryRun();

      expect(result.recommendations.some(r => r.includes('Estimated'))).toBe(true);
    });
  });

  describe('Full Dataset Migration', () => {
    it('should handle full v5 dataset', async () => {
      const db = testEnvManager.getFirestore();

      // Create comprehensive v5 dataset
      const { programs, projects, payments } = TestDataFactory.createFullV5Dataset(3, 5, 2);

      for (const prog of programs) {
        await setDoc(doc(db, testCollections.v5Programs, prog.id), prog);
      }
      for (const proj of projects) {
        await setDoc(doc(db, testCollections.v5Projects, proj.id), proj);
      }
      for (const pay of payments) {
        await setDoc(doc(db, testCollections.v5Payments, pay.id), pay);
      }

      const executor = new DryRunExecutor(db, {
        sampleSize: 100,
        rollbackOnComplete: false,
        verbose: false,
      });

      const result = await executor.executeDryRun();

      expect(result.success).toBe(true);
      expect(result.recordsProcessed.programs).toBe(3);
      expect(result.recordsProcessed.projects).toBe(15); // 3 * 5
      expect(result.recordsProcessed.payments).toBe(30); // 3 * 5 * 2
      expect(result.transformationErrors).toHaveLength(0);
    });
  });
});
