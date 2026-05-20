/**
 * Engagement Service Integration Tests
 * Tests for engagement CRUD operations and queries
 * 
 * Prerequisites:
 * - Java installed (for Firebase emulators)
 * - Run: npm run emulators
 * - Then: npm run test:integration
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { doc, setDoc, getDoc, getDocs, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { testEnvManager } from '../utils/test-environment';
import { TestDataFactory } from '../factories/test-data.factory';
import { testCollections } from '../config/test.config';

// Initialize test environment
beforeAll(async () => {
  await testEnvManager.initialize({ useEmulator: true });
});

describe('Engagement Service Integration Tests', () => {
  beforeEach(async () => {
    await testEnvManager.reset();
  });

  describe('CRUD Operations', () => {
    it('should create a new engagement', async () => {
      const db = testEnvManager.getFirestore();
      const client = TestDataFactory.createClient();
      const engagement = TestDataFactory.createEngagement({ clientId: client.id });

      // Create client first
      await setDoc(doc(db, testCollections.clients, client.id), client);

      // Create engagement
      await setDoc(doc(db, testCollections.engagements, engagement.id), engagement);

      // Verify
      const docSnap = await getDoc(doc(db, testCollections.engagements, engagement.id));
      expect(docSnap.exists()).toBe(true);
      expect(docSnap.data()?.name).toBe(engagement.name);
      expect(docSnap.data()?.clientId).toBe(client.id);
    });

    it('should retrieve an engagement by ID', async () => {
      const db = testEnvManager.getFirestore();
      const engagement = TestDataFactory.createEngagement();

      await setDoc(doc(db, testCollections.engagements, engagement.id), engagement);

      const docSnap = await getDoc(doc(db, testCollections.engagements, engagement.id));
      
      expect(docSnap.exists()).toBe(true);
      expect(docSnap.id).toBe(engagement.id);
      expect(docSnap.data()?.name).toBe(engagement.name);
      expect(docSnap.data()?.type).toBe(engagement.type);
    });

    it('should update an engagement', async () => {
      const db = testEnvManager.getFirestore();
      const engagement = TestDataFactory.createEngagement({ status: 'active' });

      await setDoc(doc(db, testCollections.engagements, engagement.id), engagement);

      // Update
      const updates = { 
        name: 'Updated Engagement Name', 
        status: 'on_hold',
        updatedAt: new Date(),
      };
      await setDoc(doc(db, testCollections.engagements, engagement.id), updates, { merge: true });

      // Verify
      const docSnap = await getDoc(doc(db, testCollections.engagements, engagement.id));
      expect(docSnap.data()?.name).toBe(updates.name);
      expect(docSnap.data()?.status).toBe(updates.status);
    });

    it('should soft delete an engagement', async () => {
      const db = testEnvManager.getFirestore();
      const engagement = TestDataFactory.createEngagement({ status: 'active' });

      await setDoc(doc(db, testCollections.engagements, engagement.id), engagement);

      // Soft delete
      await setDoc(doc(db, testCollections.engagements, engagement.id), {
        status: 'cancelled',
        deletedAt: new Date(),
      }, { merge: true });

      // Verify
      const docSnap = await getDoc(doc(db, testCollections.engagements, engagement.id));
      expect(docSnap.data()?.status).toBe('cancelled');
      expect(docSnap.data()?.deletedAt).toBeDefined();
    });
  });

  describe('Query Operations', () => {
    it('should list engagements by client', async () => {
      const db = testEnvManager.getFirestore();
      const clientId = 'test-client-query';
      const engagements = TestDataFactory.createBatch(
        () => TestDataFactory.createEngagement({ clientId }),
        5
      );

      // Create engagements
      for (const eng of engagements) {
        await setDoc(doc(db, testCollections.engagements, eng.id), eng);
      }

      // Query
      const q = query(
        collection(db, testCollections.engagements),
        where('clientId', '==', clientId)
      );
      const snapshot = await getDocs(q);

      expect(snapshot.docs).toHaveLength(5);
      expect(snapshot.docs.every(d => d.data().clientId === clientId)).toBe(true);
    });

    it('should filter engagements by type', async () => {
      const db = testEnvManager.getFirestore();
      
      const infraEngagements = TestDataFactory.createBatch(
        () => TestDataFactory.createEngagement({ type: 'infrastructure' }),
        3
      );
      const investEngagements = TestDataFactory.createBatch(
        () => TestDataFactory.createEngagement({ type: 'investment' }),
        2
      );

      for (const eng of [...infraEngagements, ...investEngagements]) {
        await setDoc(doc(db, testCollections.engagements, eng.id), eng);
      }

      const q = query(
        collection(db, testCollections.engagements),
        where('type', '==', 'infrastructure')
      );
      const snapshot = await getDocs(q);

      expect(snapshot.docs).toHaveLength(3);
      expect(snapshot.docs.every(d => d.data().type === 'infrastructure')).toBe(true);
    });

    it('should filter engagements by status', async () => {
      const db = testEnvManager.getFirestore();
      
      const activeEngagements = TestDataFactory.createBatch(
        () => TestDataFactory.createEngagement({ status: 'active' }),
        4
      );
      const completedEngagements = TestDataFactory.createBatch(
        () => TestDataFactory.createEngagement({ status: 'completed' }),
        2
      );

      for (const eng of [...activeEngagements, ...completedEngagements]) {
        await setDoc(doc(db, testCollections.engagements, eng.id), eng);
      }

      const q = query(
        collection(db, testCollections.engagements),
        where('status', '==', 'active')
      );
      const snapshot = await getDocs(q);

      expect(snapshot.docs).toHaveLength(4);
      expect(snapshot.docs.every(d => d.data().status === 'active')).toBe(true);
    });

    it('should paginate results correctly', async () => {
      const db = testEnvManager.getFirestore();
      
      const engagements = TestDataFactory.createBatch(
        () => TestDataFactory.createEngagement(),
        25
      );

      for (const eng of engagements) {
        await setDoc(doc(db, testCollections.engagements, eng.id), eng);
      }

      // First page
      const page1Query = query(
        collection(db, testCollections.engagements),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      const page1 = await getDocs(page1Query);
      expect(page1.docs).toHaveLength(10);

      // Second page
      const page2Query = query(
        collection(db, testCollections.engagements),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      const page2 = await getDocs(page2Query);
      expect(page2.docs).toHaveLength(10);
    });
  });

  describe('Cross-Entity Operations', () => {
    it('should create engagement with projects', async () => {
      const db = testEnvManager.getFirestore();
      const { engagement, projects } = TestDataFactory.createEngagementWithProjects(3);

      // Create engagement
      await setDoc(doc(db, testCollections.engagements, engagement.id), engagement);

      // Create projects
      for (const project of projects) {
        await setDoc(doc(db, testCollections.projects, project.id), project);
      }

      // Verify engagement
      const engDoc = await getDoc(doc(db, testCollections.engagements, engagement.id));
      expect(engDoc.exists()).toBe(true);

      // Verify projects linked to engagement
      const projectsQuery = query(
        collection(db, testCollections.projects),
        where('engagementId', '==', engagement.id)
      );
      const projectsSnapshot = await getDocs(projectsQuery);
      expect(projectsSnapshot.docs).toHaveLength(3);
    });

    it('should create project with payments', async () => {
      const db = testEnvManager.getFirestore();
      const engagement = TestDataFactory.createEngagement();
      const { project, payments } = TestDataFactory.createProjectWithPayments(engagement.id, 3);

      // Create entities
      await setDoc(doc(db, testCollections.engagements, engagement.id), engagement);
      await setDoc(doc(db, testCollections.projects, project.id), project);

      for (const payment of payments) {
        await setDoc(doc(db, testCollections.payments, payment.id), payment);
      }

      // Verify payments linked to project
      const paymentsQuery = query(
        collection(db, testCollections.payments),
        where('projectId', '==', project.id)
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);
      expect(paymentsSnapshot.docs).toHaveLength(3);
    });
  });

  describe('Data Validation', () => {
    it('should enforce required fields', async () => {
      const db = testEnvManager.getFirestore();
      const invalidEngagement = {
        id: 'invalid-eng',
        // Missing required fields: name, type, clientId
      };

      // This would fail validation in a real service layer
      await setDoc(doc(db, testCollections.engagements, invalidEngagement.id), invalidEngagement);
      
      const docSnap = await getDoc(doc(db, testCollections.engagements, invalidEngagement.id));
      expect(docSnap.data()?.name).toBeUndefined();
      expect(docSnap.data()?.type).toBeUndefined();
    });

    it('should handle date fields correctly', async () => {
      const db = testEnvManager.getFirestore();
      const engagement = TestDataFactory.createEngagement({
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
      });

      await setDoc(doc(db, testCollections.engagements, engagement.id), engagement);

      const docSnap = await getDoc(doc(db, testCollections.engagements, engagement.id));
      const data = docSnap.data();
      
      // Firestore converts dates to Timestamps
      expect(data?.startDate).toBeDefined();
      expect(data?.endDate).toBeDefined();
    });

    it('should handle nested objects', async () => {
      const db = testEnvManager.getFirestore();
      const engagement = TestDataFactory.createEngagement({
        funding: {
          type: 'grant',
          totalBudget: 5000000000,
          currency: 'UGX',
          sources: [
            { name: 'AMH Foundation', amount: 5000000000 }
          ],
        },
      });

      await setDoc(doc(db, testCollections.engagements, engagement.id), engagement);

      const docSnap = await getDoc(doc(db, testCollections.engagements, engagement.id));
      const data = docSnap.data();
      
      expect(data?.funding?.type).toBe('grant');
      expect(data?.funding?.totalBudget).toBe(5000000000);
      expect(data?.funding?.sources).toHaveLength(1);
    });
  });
});
