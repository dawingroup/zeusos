/**
 * Cross-Module Integration Tests
 * Tests for workflows spanning multiple modules
 * 
 * Prerequisites:
 * - Java installed (for Firebase emulators)
 * - Run: npm run emulators
 * - Then: npm run test:integration
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { doc, setDoc, getDoc, getDocs, collection, query, where, updateDoc } from 'firebase/firestore';
import { testEnvManager } from '../utils/test-environment';
import { TestDataFactory } from '../factories/test-data.factory';
import { testCollections } from '../config/test.config';

// Initialize test environment
beforeAll(async () => {
  await testEnvManager.initialize({ useEmulator: true });
});

describe('Cross-Module Integration Tests', () => {
  beforeEach(async () => {
    await testEnvManager.reset();
  });

  describe('Infrastructure Delivery Workflow', () => {
    it('should complete full project lifecycle', async () => {
      const db = testEnvManager.getFirestore();

      // 1. Create client
      const client = TestDataFactory.createClient();
      await setDoc(doc(db, testCollections.clients, client.id), client);

      // 2. Create engagement
      const engagement = TestDataFactory.createEngagement({
        clientId: client.id,
        type: 'infrastructure',
        status: 'active',
      });
      await setDoc(doc(db, testCollections.engagements, engagement.id), engagement);

      // 3. Create project under engagement
      const project = TestDataFactory.createProject(engagement.id, {
        status: 'planning',
      });
      await setDoc(doc(db, testCollections.projects, project.id), project);

      // 4. Create BOQ for project
      const boq = TestDataFactory.createBOQ(engagement.id, project.id, {
        status: 'draft',
      });
      await setDoc(doc(db, testCollections.boqs, boq.id), boq);

      // 5. Create payment against project
      const payment = TestDataFactory.createPayment(engagement.id, project.id, {
        type: 'ipc',
        status: 'draft',
      });
      await setDoc(doc(db, testCollections.payments, payment.id), payment);

      // Verify all entities exist and are linked
      const engDoc = await getDoc(doc(db, testCollections.engagements, engagement.id));
      expect(engDoc.exists()).toBe(true);

      const projectsQuery = query(
        collection(db, testCollections.projects),
        where('engagementId', '==', engagement.id)
      );
      const projectsSnapshot = await getDocs(projectsQuery);
      expect(projectsSnapshot.docs).toHaveLength(1);

      const paymentsQuery = query(
        collection(db, testCollections.payments),
        where('projectId', '==', project.id)
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);
      expect(paymentsSnapshot.docs).toHaveLength(1);
    });

    it('should handle IPC approval workflow', async () => {
      const db = testEnvManager.getFirestore();

      // Setup
      const engagement = TestDataFactory.createEngagement({ type: 'infrastructure' });
      const project = TestDataFactory.createProject(engagement.id);
      const payment = TestDataFactory.createPayment(engagement.id, project.id, {
        type: 'ipc',
        status: 'draft',
      });

      await setDoc(doc(db, testCollections.engagements, engagement.id), engagement);
      await setDoc(doc(db, testCollections.projects, project.id), project);
      await setDoc(doc(db, testCollections.payments, payment.id), payment);

      // Submit for review
      await updateDoc(doc(db, testCollections.payments, payment.id), {
        status: 'submitted',
        submittedAt: new Date(),
      });

      let paymentDoc = await getDoc(doc(db, testCollections.payments, payment.id));
      expect(paymentDoc.data()?.status).toBe('submitted');

      // QS Review approval
      await updateDoc(doc(db, testCollections.payments, payment.id), {
        status: 'under_review',
        approvals: [{
          stage: 'qs_review',
          action: 'approve',
          userId: 'qs-user-id',
          timestamp: new Date(),
        }],
      });

      paymentDoc = await getDoc(doc(db, testCollections.payments, payment.id));
      expect(paymentDoc.data()?.approvals).toHaveLength(1);

      // PM Approval
      await updateDoc(doc(db, testCollections.payments, payment.id), {
        approvals: [
          ...paymentDoc.data()?.approvals,
          {
            stage: 'pm_approval',
            action: 'approve',
            userId: 'pm-user-id',
            timestamp: new Date(),
          },
        ],
      });

      // Finance Approval (final)
      await updateDoc(doc(db, testCollections.payments, payment.id), {
        status: 'approved',
        approvals: [
          ...paymentDoc.data()?.approvals,
          {
            stage: 'pm_approval',
            action: 'approve',
            userId: 'pm-user-id',
            timestamp: new Date(),
          },
          {
            stage: 'finance_approval',
            action: 'approve',
            userId: 'finance-user-id',
            timestamp: new Date(),
          },
        ],
        approvedAt: new Date(),
      });

      paymentDoc = await getDoc(doc(db, testCollections.payments, payment.id));
      expect(paymentDoc.data()?.status).toBe('approved');
    });

    it('should handle payment rejection workflow', async () => {
      const db = testEnvManager.getFirestore();

      const engagement = TestDataFactory.createEngagement({ type: 'infrastructure' });
      const project = TestDataFactory.createProject(engagement.id);
      const payment = TestDataFactory.createPayment(engagement.id, project.id, {
        type: 'ipc',
        status: 'submitted',
      });

      await setDoc(doc(db, testCollections.engagements, engagement.id), engagement);
      await setDoc(doc(db, testCollections.projects, project.id), project);
      await setDoc(doc(db, testCollections.payments, payment.id), payment);

      // Reject payment
      await updateDoc(doc(db, testCollections.payments, payment.id), {
        status: 'rejected',
        rejectedAt: new Date(),
        rejectionReason: 'Quantities do not match site measurements',
        rejectedBy: 'qs-user-id',
      });

      const paymentDoc = await getDoc(doc(db, testCollections.payments, payment.id));
      expect(paymentDoc.data()?.status).toBe('rejected');
      expect(paymentDoc.data()?.rejectionReason).toBeDefined();
    });
  });

  describe('Investment Deal Workflow', () => {
    it('should progress deal through pipeline stages', async () => {
      const db = testEnvManager.getFirestore();

      const engagement = TestDataFactory.createEngagement({ type: 'investment' });
      const deal = TestDataFactory.createDeal(engagement.id, { stage: 'origination' });

      await setDoc(doc(db, testCollections.engagements, engagement.id), engagement);
      await setDoc(doc(db, 'deals', deal.id), deal);

      // Progress through stages
      const stages = ['screening', 'due_diligence', 'structuring', 'negotiation', 'closing'];
      
      for (const stage of stages) {
        await updateDoc(doc(db, 'deals', deal.id), {
          stage,
          stageUpdatedAt: new Date(),
        });

        const dealDoc = await getDoc(doc(db, 'deals', deal.id));
        expect(dealDoc.data()?.stage).toBe(stage);
      }

      // Final close
      await updateDoc(doc(db, 'deals', deal.id), {
        stage: 'closed',
        closedAt: new Date(),
      });

      const finalDealDoc = await getDoc(doc(db, 'deals', deal.id));
      expect(finalDealDoc.data()?.stage).toBe('closed');
    });
  });

  describe('Advisory Portfolio Workflow', () => {
    it('should link portfolio holdings to deals', async () => {
      const db = testEnvManager.getFirestore();

      // Create deal engagement
      const dealEngagement = TestDataFactory.createEngagement({ type: 'investment' });
      const deal = TestDataFactory.createDeal(dealEngagement.id, { stage: 'closed' });

      // Create portfolio engagement
      const portfolioEngagement = TestDataFactory.createEngagement({ type: 'advisory' });
      const portfolio = TestDataFactory.createPortfolio(portfolioEngagement.id);

      await setDoc(doc(db, testCollections.engagements, dealEngagement.id), dealEngagement);
      await setDoc(doc(db, 'deals', deal.id), deal);
      await setDoc(doc(db, testCollections.engagements, portfolioEngagement.id), portfolioEngagement);
      await setDoc(doc(db, 'portfolios', portfolio.id), portfolio);

      // Add holding linked to deal
      const holding = {
        id: `holding-${Date.now()}`,
        portfolioId: portfolio.id,
        linkedDealId: deal.id,
        linkedEngagementId: dealEngagement.id,
        name: deal.name,
        investmentAmount: 5000000,
        currentValue: 6500000,
        currency: 'USD',
        acquisitionDate: new Date(),
      };

      await setDoc(doc(db, 'holdings', holding.id), holding);

      // Verify link
      const holdingsQuery = query(
        collection(db, 'holdings'),
        where('linkedDealId', '==', deal.id)
      );
      const holdingsSnapshot = await getDocs(holdingsQuery);
      expect(holdingsSnapshot.docs).toHaveLength(1);
      expect(holdingsSnapshot.docs[0].data().portfolioId).toBe(portfolio.id);
    });
  });

  describe('MatFlow BOQ Workflow', () => {
    it('should sync BOQ with project financials', async () => {
      const db = testEnvManager.getFirestore();

      const engagement = TestDataFactory.createEngagement({ type: 'infrastructure' });
      const project = TestDataFactory.createProject(engagement.id);
      const boq = TestDataFactory.createBOQ(engagement.id, project.id, {
        status: 'draft',
        summary: {
          totalItems: 50,
          totalAmount: 500000000,
          currency: 'UGX',
        },
      });

      await setDoc(doc(db, testCollections.engagements, engagement.id), engagement);
      await setDoc(doc(db, testCollections.projects, project.id), project);
      await setDoc(doc(db, testCollections.boqs, boq.id), boq);

      // Approve BOQ
      await updateDoc(doc(db, testCollections.boqs, boq.id), {
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: 'qs-user-id',
      });

      // Update project with BOQ total
      await updateDoc(doc(db, testCollections.projects, project.id), {
        boqTotal: 500000000,
        boqApprovedAt: new Date(),
      });

      const projectDoc = await getDoc(doc(db, testCollections.projects, project.id));
      expect(projectDoc.data()?.boqTotal).toBe(500000000);
    });

    it('should create requisitions from BOQ items', async () => {
      const db = testEnvManager.getFirestore();

      const engagement = TestDataFactory.createEngagement({ type: 'infrastructure' });
      const project = TestDataFactory.createProject(engagement.id, { implementationType: 'direct' });
      const boq = TestDataFactory.createBOQ(engagement.id, project.id);

      await setDoc(doc(db, testCollections.engagements, engagement.id), engagement);
      await setDoc(doc(db, testCollections.projects, project.id), project);
      await setDoc(doc(db, testCollections.boqs, boq.id), boq);

      // Create requisition from BOQ items
      const selectedItems = boq.items.slice(0, 5);
      const requisition = {
        id: `req-${Date.now()}`,
        engagementId: engagement.id,
        projectId: project.id,
        boqId: boq.id,
        type: 'requisition',
        status: 'draft',
        items: selectedItems,
        linkedBoqItems: selectedItems.map((i: any) => i.id),
        totalAmount: selectedItems.reduce((sum: number, i: any) => sum + i.amount, 0),
        createdAt: new Date(),
      };

      await setDoc(doc(db, testCollections.payments, requisition.id), requisition);

      const reqDoc = await getDoc(doc(db, testCollections.payments, requisition.id));
      expect(reqDoc.data()?.boqId).toBe(boq.id);
      expect(reqDoc.data()?.items).toHaveLength(5);
    });
  });

  describe('Engagement Status Cascade', () => {
    it('should notify related entities on status change', async () => {
      const db = testEnvManager.getFirestore();

      const engagement = TestDataFactory.createEngagement({ status: 'active' });
      const projects = TestDataFactory.createBatch(
        () => TestDataFactory.createProject(engagement.id, { status: 'construction' }),
        3
      );

      await setDoc(doc(db, testCollections.engagements, engagement.id), engagement);
      for (const project of projects) {
        await setDoc(doc(db, testCollections.projects, project.id), project);
      }

      // Put engagement on hold
      await updateDoc(doc(db, testCollections.engagements, engagement.id), {
        status: 'on_hold',
        statusChangedAt: new Date(),
      });

      // Simulate cascade update to projects
      for (const project of projects) {
        await updateDoc(doc(db, testCollections.projects, project.id), {
          engagementStatus: 'on_hold',
          statusNotifiedAt: new Date(),
        });
      }

      // Verify projects reflect engagement status
      const projectsQuery = query(
        collection(db, testCollections.projects),
        where('engagementId', '==', engagement.id)
      );
      const projectsSnapshot = await getDocs(projectsQuery);
      
      for (const projectDoc of projectsSnapshot.docs) {
        expect(projectDoc.data().engagementStatus).toBe('on_hold');
      }
    });
  });
});
