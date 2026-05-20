/**
 * Test Data Factory Unit Tests
 * Tests for test data generation utilities (no emulators required)
 */

import { describe, it, expect } from 'vitest';
import { TestDataFactory } from '../factories/test-data.factory';

describe('TestDataFactory', () => {
  describe('Client Generation', () => {
    it('should create a valid client', () => {
      const client = TestDataFactory.createClient();
      
      expect(client).toBeDefined();
      expect(client.id).toBeDefined();
      expect(client.name).toBeDefined();
      expect(client.type).toBeDefined();
      expect(['organization', 'individual', 'government', 'ngo', 'private']).toContain(client.type);
    });

    it('should create client with custom properties', () => {
      const client = TestDataFactory.createClient({
        name: 'Custom Client',
        type: 'government',
      });

      expect(client.name).toBe('Custom Client');
      expect(client.type).toBe('government');
    });
  });

  describe('Engagement Generation', () => {
    it('should create a valid engagement', () => {
      const engagement = TestDataFactory.createEngagement();

      expect(engagement).toBeDefined();
      expect(engagement.id).toBeDefined();
      expect(engagement.name).toBeDefined();
      expect(engagement.type).toBeDefined();
      expect(engagement.status).toBeDefined();
      expect(engagement.clientId).toBeDefined();
    });

    it('should create engagement with custom type', () => {
      const engagement = TestDataFactory.createEngagement({
        type: 'infrastructure',
        status: 'active',
      });

      expect(engagement.type).toBe('infrastructure');
      expect(engagement.status).toBe('active');
    });

    it('should generate unique IDs for each engagement', () => {
      const eng1 = TestDataFactory.createEngagement();
      const eng2 = TestDataFactory.createEngagement();

      expect(eng1.id).not.toBe(eng2.id);
    });
  });

  describe('Project Generation', () => {
    it('should create a valid project', () => {
      const engagementId = 'test-engagement-id';
      const project = TestDataFactory.createProject(engagementId);

      expect(project).toBeDefined();
      expect(project.id).toBeDefined();
      expect(project.engagementId).toBe(engagementId);
      expect(project.name).toBeDefined();
      expect(project.status).toBeDefined();
    });

    it('should create project with custom properties', () => {
      const project = TestDataFactory.createProject('eng-123', {
        name: 'Custom Project',
        status: 'construction',
      });

      expect(project.name).toBe('Custom Project');
      expect(project.status).toBe('construction');
      expect(project.engagementId).toBe('eng-123');
    });
  });

  describe('Payment Generation', () => {
    it('should create a valid payment', () => {
      const payment = TestDataFactory.createPayment('eng-1', 'proj-1');

      expect(payment).toBeDefined();
      expect(payment.id).toBeDefined();
      expect(payment.engagementId).toBe('eng-1');
      expect(payment.projectId).toBe('proj-1');
      expect(payment.type).toBeDefined();
      expect(payment.status).toBeDefined();
    });

    it('should create IPC payment type', () => {
      const payment = TestDataFactory.createPayment('eng-1', 'proj-1', {
        type: 'ipc',
      });

      expect(payment.type).toBe('ipc');
    });
  });

  describe('Deal Generation', () => {
    it('should create a valid deal', () => {
      const deal = TestDataFactory.createDeal('eng-1');

      expect(deal).toBeDefined();
      expect(deal.id).toBeDefined();
      expect(deal.engagementId).toBe('eng-1');
      expect(deal.name).toBeDefined();
      expect(deal.stage).toBeDefined();
    });

    it('should create deal at specific stage', () => {
      const deal = TestDataFactory.createDeal('eng-1', {
        stage: 'due_diligence',
      });

      expect(deal.stage).toBe('due_diligence');
    });
  });

  describe('BOQ Generation', () => {
    it('should create a valid BOQ', () => {
      const boq = TestDataFactory.createBOQ('eng-1', 'proj-1');

      expect(boq).toBeDefined();
      expect(boq.id).toBeDefined();
      expect(boq.engagementId).toBe('eng-1');
      expect(boq.projectId).toBe('proj-1');
      expect(boq.items).toBeDefined();
      expect(Array.isArray(boq.items)).toBe(true);
    });

    it('should create BOQ with items', () => {
      const boq = TestDataFactory.createBOQ('eng-1', 'proj-1');

      expect(boq.items.length).toBeGreaterThan(0);
      expect(boq.items[0].description).toBeDefined();
      expect(boq.items[0].quantity).toBeDefined();
      expect(boq.items[0].unit).toBeDefined();
    });
  });

  describe('V5 Legacy Data Generation', () => {
    it('should create v5 program', () => {
      const program = TestDataFactory.createV5Program();

      expect(program).toBeDefined();
      expect(program.id).toBeDefined();
      expect(program.name).toBeDefined();
      expect(program.totalBudget).toBeDefined();
    });

    it('should create v5 project linked to program', () => {
      const programId = 'v5-program-123';
      const project = TestDataFactory.createV5Project(programId);

      expect(project).toBeDefined();
      expect(project.programId).toBe(programId);
    });

    it('should create v5 payment', () => {
      const payment = TestDataFactory.createV5Payment('prog-1', 'proj-1');

      expect(payment).toBeDefined();
      expect(payment.programId).toBe('prog-1');
      expect(payment.projectId).toBe('proj-1');
    });
  });

  describe('Batch Generation', () => {
    it('should create batch of entities', () => {
      const engagements = TestDataFactory.createBatch(
        () => TestDataFactory.createEngagement(),
        5
      );

      expect(engagements).toHaveLength(5);
      expect(new Set(engagements.map(e => e.id)).size).toBe(5); // All unique IDs
    });

    it('should create full v5 dataset', () => {
      const { programs, projects, payments } = TestDataFactory.createFullV5Dataset(2, 3, 2);

      expect(programs).toHaveLength(2);
      expect(projects).toHaveLength(6); // 2 programs * 3 projects
      expect(payments).toHaveLength(12); // 2 programs * 3 projects * 2 payments
    });
  });

  describe('Combined Entity Generation', () => {
    it('should create engagement with projects', () => {
      const { engagement, projects } = TestDataFactory.createEngagementWithProjects(3);

      expect(engagement).toBeDefined();
      expect(projects).toHaveLength(3);
      expect(projects.every(p => p.engagementId === engagement.id)).toBe(true);
    });

    it('should create project with payments', () => {
      const { project, payments } = TestDataFactory.createProjectWithPayments('eng-1', 4);

      expect(project).toBeDefined();
      expect(payments).toHaveLength(4);
      expect(payments.every(p => p.projectId === project.id)).toBe(true);
    });
  });
});
