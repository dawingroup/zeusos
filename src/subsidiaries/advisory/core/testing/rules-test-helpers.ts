/**
 * RULES-TEST-HELPERS.TS
 * Testing utilities for Firestore security rules
 * 
 * Use with @firebase/rules-unit-testing package
 */

import { UserProfile, EngagementRole } from '../security/roles';

/**
 * Test user profile factory
 */
export function createTestUserProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    uid: 'test-user-id',
    email: 'test@example.com',
    displayName: 'Test User',
    platformRole: 'staff',
    engagementRoles: {},
    isActive: true,
    ...overrides,
  };
}

/**
 * Create a platform admin test user
 */
export function createAdminUser(uid: string = 'admin-user'): UserProfile {
  return createTestUserProfile({
    uid,
    email: 'admin@example.com',
    displayName: 'Admin User',
    platformRole: 'super_admin',
  });
}

/**
 * Create a staff user with engagement access
 */
export function createEngagementTeamMember(
  uid: string,
  engagementId: string,
  role: EngagementRole
): UserProfile {
  return createTestUserProfile({
    uid,
    email: `${uid}@example.com`,
    displayName: `User ${uid}`,
    platformRole: 'staff',
    engagementRoles: {
      [engagementId]: role,
    },
  });
}

/**
 * Create an external client user
 */
export function createClientUser(
  uid: string,
  clientId: string,
  role: 'client_admin' | 'client_authorized' | 'client_user' | 'client_viewer' = 'client_user'
): UserProfile {
  return createTestUserProfile({
    uid,
    email: `${uid}@client.com`,
    displayName: `Client User ${uid}`,
    platformRole: 'external',
    clientAssociations: [{ clientId, role }],
  });
}

/**
 * Create an external funder user
 */
export function createFunderUser(
  uid: string,
  funderId: string,
  role: 'funder_admin' | 'funder_officer' | 'funder_viewer' = 'funder_officer'
): UserProfile {
  return createTestUserProfile({
    uid,
    email: `${uid}@funder.org`,
    displayName: `Funder User ${uid}`,
    platformRole: 'external',
    funderAssociations: [{ funderId, role }],
  });
}

/**
 * Test engagement data factory
 */
export function createTestEngagement(
  id: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id,
    name: `Test Engagement ${id}`,
    domain: 'infrastructure_delivery',
    status: 'active',
    clientId: 'test-client',
    country: 'UG',
    team: {
      leadId: 'lead-user',
      members: [],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Test client data factory
 */
export function createTestClient(
  id: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id,
    legalName: `Test Client ${id}`,
    displayName: `Client ${id}`,
    type: 'corporate',
    relationshipStatus: 'active',
    relationshipManagerId: 'rm-user',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Test funder data factory
 */
export function createTestFunder(
  id: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id,
    name: `Test Funder ${id}`,
    type: 'multilateral_dfi',
    relationshipStatus: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Test funding source data factory
 */
export function createTestFundingSource(
  id: string,
  funderId: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id,
    category: 'grant',
    instrumentType: 'restricted_grant',
    funderId,
    funder: { id: funderId, name: `Funder ${funderId}` },
    committedAmount: { amount: 1000000, currency: 'USD' },
    disbursedAmount: { amount: 0, currency: 'USD' },
    status: 'committed',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Test approval request data factory
 */
export function createTestApprovalRequest(
  id: string,
  requestedBy: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id,
    type: 'payment_request',
    title: `Approval Request ${id}`,
    description: 'Test approval request',
    status: 'pending',
    priority: 'normal',
    requestedBy,
    requestedAt: new Date(),
    updatedAt: new Date(),
    approvalChain: [],
    currentStepIndex: 0,
    isComplete: false,
    documentIds: [],
    ...overrides,
  };
}

/**
 * Test covenant data factory
 */
export function createTestCovenant(
  id: string,
  fundingSourceId: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id,
    fundingSourceId,
    type: 'dscr',
    name: `Covenant ${id}`,
    description: 'Test covenant',
    measurementType: 'ratio',
    condition: 'minimum',
    threshold: 1.2,
    monitoringFrequency: 'quarterly',
    effectiveDate: new Date(),
    gracePeriodDays: 30,
    curePeriodDays: 60,
    isActive: true,
    currentStatus: 'compliant',
    breachConsequence: 'reporting_only',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Role permission test matrix
 * Defines expected access for each role
 */
export const ROLE_ACCESS_MATRIX: Record<EngagementRole, {
  canRead: boolean;
  canWrite: boolean;
  canManage: boolean;
  canApprove: boolean;
}> = {
  engagement_owner: { canRead: true, canWrite: true, canManage: true, canApprove: true },
  engagement_lead: { canRead: true, canWrite: true, canManage: true, canApprove: true },
  program_manager: { canRead: true, canWrite: true, canManage: false, canApprove: true },
  project_manager: { canRead: true, canWrite: true, canManage: false, canApprove: true },
  site_manager: { canRead: true, canWrite: false, canManage: false, canApprove: false },
  quantity_surveyor: { canRead: true, canWrite: false, canManage: false, canApprove: false },
  deal_lead: { canRead: true, canWrite: true, canManage: false, canApprove: true },
  portfolio_manager: { canRead: true, canWrite: true, canManage: false, canApprove: true },
  finance_officer: { canRead: true, canWrite: true, canManage: false, canApprove: true },
  compliance_officer: { canRead: true, canWrite: true, canManage: false, canApprove: false },
  team_member: { canRead: true, canWrite: false, canManage: false, canApprove: false },
  viewer: { canRead: true, canWrite: false, canManage: false, canApprove: false },
};

/**
 * Example test suite structure
 * Copy this to create actual tests
 */
export const EXAMPLE_TEST_SUITE = `
/**
 * Firestore Security Rules Test Suite
 * 
 * Run with: npx vitest run src/subsidiaries/advisory/core/testing/rules.test.ts
 */

import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { setDoc, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import {
  createTestUserProfile,
  createAdminUser,
  createEngagementTeamMember,
  createTestEngagement,
  ROLE_ACCESS_MATRIX,
} from './rules-test-helpers';

describe('Advisory Platform Security Rules', () => {
  let testEnv: RulesTestEnvironment;
  
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'test-project-' + Date.now(),
      firestore: {
        rules: readFileSync('firestore.rules', 'utf8'),
      },
    });
  });
  
  afterAll(async () => {
    await testEnv.cleanup();
  });
  
  beforeEach(async () => {
    await testEnv.clearFirestore();
  });
  
  describe('Engagements Collection', () => {
    const engagementId = 'test-engagement';
    
    beforeEach(async () => {
      // Setup test data using admin context
      const adminDb = testEnv.authenticatedContext('admin').firestore();
      
      // Create admin user
      await setDoc(doc(adminDb, 'users', 'admin'), createAdminUser('admin'));
      
      // Create engagement
      await setDoc(
        doc(adminDb, 'engagements', engagementId),
        createTestEngagement(engagementId)
      );
    });
    
    it('should allow team members to read engagement', async () => {
      // Create team member
      const adminDb = testEnv.authenticatedContext('admin').firestore();
      await setDoc(
        doc(adminDb, 'users', 'team-user'),
        createEngagementTeamMember('team-user', engagementId, 'team_member')
      );
      
      // Test read access
      const userDb = testEnv.authenticatedContext('team-user').firestore();
      await assertSucceeds(
        getDoc(doc(userDb, 'engagements', engagementId))
      );
    });
    
    it('should deny non-team members from reading engagement', async () => {
      // Create non-team user
      const adminDb = testEnv.authenticatedContext('admin').firestore();
      await setDoc(
        doc(adminDb, 'users', 'other-user'),
        createTestUserProfile({ uid: 'other-user' })
      );
      
      // Test read access
      const userDb = testEnv.authenticatedContext('other-user').firestore();
      await assertFails(
        getDoc(doc(userDb, 'engagements', engagementId))
      );
    });
    
    it('should allow engagement lead to update engagement', async () => {
      // Create engagement lead
      const adminDb = testEnv.authenticatedContext('admin').firestore();
      await setDoc(
        doc(adminDb, 'users', 'lead-user'),
        createEngagementTeamMember('lead-user', engagementId, 'engagement_lead')
      );
      
      // Test update access
      const userDb = testEnv.authenticatedContext('lead-user').firestore();
      await assertSucceeds(
        setDoc(doc(userDb, 'engagements', engagementId), 
          { name: 'Updated Name' }, 
          { merge: true }
        )
      );
    });
    
    it('should deny team member from updating engagement', async () => {
      // Create team member
      const adminDb = testEnv.authenticatedContext('admin').firestore();
      await setDoc(
        doc(adminDb, 'users', 'team-user'),
        createEngagementTeamMember('team-user', engagementId, 'team_member')
      );
      
      // Test update access
      const userDb = testEnv.authenticatedContext('team-user').firestore();
      await assertFails(
        setDoc(doc(userDb, 'engagements', engagementId), 
          { name: 'Updated Name' }, 
          { merge: true }
        )
      );
    });
  });
  
  describe('Clients Collection', () => {
    it('should allow platform staff to read clients', async () => {
      // Setup
      const adminDb = testEnv.authenticatedContext('admin').firestore();
      await setDoc(doc(adminDb, 'users', 'admin'), createAdminUser('admin'));
      await setDoc(doc(adminDb, 'users', 'staff'), createTestUserProfile({
        uid: 'staff',
        platformRole: 'staff',
      }));
      await setDoc(doc(adminDb, 'clients', 'client-1'), {
        legalName: 'Test Client',
        displayName: 'Test',
        type: 'corporate',
      });
      
      // Test
      const staffDb = testEnv.authenticatedContext('staff').firestore();
      await assertSucceeds(getDoc(doc(staffDb, 'clients', 'client-1')));
    });
  });
});
`;

/**
 * Generate test file content
 */
export function generateTestFile(): string {
  return EXAMPLE_TEST_SUITE;
}
