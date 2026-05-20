/**
 * ENHANCED REQUISITION SERVICE TESTS
 *
 * Unit tests for EnhancedRequisitionService with ADD-FIN-001 functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Timestamp, getDoc, getDocs } from 'firebase/firestore';
import type { RequisitionFormData } from '../../../types/requisition';
import type { ApprovalConfiguration } from '../../../types/approval-config';
import { EnhancedRequisitionService } from '../enhanced-requisition.service';

describe('EnhancedRequisitionService', () => {
  let service: EnhancedRequisitionService;
  const mockFirestore = {} as any;
  const projectId = 'test-project-123';
  const userId = 'user-456';

  // Helper to create valid form data
  const createFormData = (overrides: Partial<RequisitionFormData> = {}): any => ({
    projectId,
    purpose: 'Test requisition',
    budgetLineId: 'budget-1',
    advanceType: 'materials',
    sourceType: 'manual',
    items: [
      {
        description: 'Test item',
        category: 'construction_materials',
        quantity: 10,
        unit: 'm3',
        unitCost: 1000,
        totalCost: 10000,
      },
    ],
    accountabilityDueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    expectedReturnDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ...overrides,
  });

  beforeEach(() => {
    service = new EnhancedRequisitionService(mockFirestore);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ───────────────────────────────────────────────────────────────
  // VALIDATION TESTS
  // ───────────────────────────────────────────────────────────────

  describe('validateRequisition', () => {
    it('should validate requisition successfully with no overdue accountabilities', async () => {
      const formData = createFormData();

      // Mock no overdue accountabilities
      vi.mocked(getDocs).mockResolvedValue({ empty: true } as any);
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => false,
        data: () => ({}),
      } as any);

      const result = await service.validateRequisition(formData, userId);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject requisition if user has overdue accountabilities', async () => {
      const formData = createFormData();

      // Mock project has no custom policy
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => false,
        data: () => ({}),
      } as any);

      // Mock overdue accountabilities exist
      vi.mocked(getDocs).mockResolvedValue({
        empty: false,
        docs: [{ id: 'req-old-1', data: () => ({}) }],
      } as any);

      const result = await service.validateRequisition(formData, userId);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.toLowerCase().includes('overdue'))).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // APPROVAL CONFIGURATION TESTS
  // ───────────────────────────────────────────────────────────────

  describe('resolveApprovalConfiguration', () => {
    it('should use project-level custom configuration if available', async () => {
      const customConfig: ApprovalConfiguration = {
        id: 'custom-1',
        name: 'Custom Project Approval',
        description: 'Custom approval for project',
        type: 'requisition',
        level: 'project',
        entityId: projectId,
        isDefault: false,
        isActive: true,
        overridesDefault: true,
        stages: [
          {
            id: 'stage-1',
            sequence: 1,
            name: 'Project Manager Review',
            description: 'PM review',
            requiredRole: 'PROJECT_MANAGER',
            slaHours: 24,
            isRequired: true,
            canSkip: false,
            canRunInParallel: false,
            isExternalApproval: false,
            notifyOnAssignment: true,
            notifyOnOverdue: true,
          },
        ],
        createdBy: userId,
        createdAt: Timestamp.now(),
        updatedBy: userId,
        updatedAt: Timestamp.now(),
        version: 1,
      };

      // Mock project config query
      vi.mocked(getDocs).mockResolvedValueOnce({
        empty: false,
        docs: [{ id: 'custom-1', data: () => customConfig }],
      } as any);

      const result = await service.resolveApprovalConfiguration(projectId);

      expect(result.id).toBe('custom-1');
      expect(result.level).toBe('project');
      expect(result.stages).toHaveLength(1);
      expect(result.stages[0].name).toBe('Project Manager Review');
    });

    it('should fall back to ADD-FIN-001 default if no custom config', async () => {
      // Mock no custom configs
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({ programId: null, organizationId: null }),
      } as any);
      vi.mocked(getDocs).mockResolvedValue({ empty: true } as any);

      const result = await service.resolveApprovalConfiguration(projectId);

      expect(result.isDefault).toBe(true);
      expect(result.type).toBe('requisition');
      expect(result.stages).toHaveLength(2); // Technical + Financial
      expect(result.stages[0].name).toBe('Technical Review');
      expect(result.stages[1].name).toBe('Financial Approval');
    });
  });

  describe('buildApprovalChain', () => {
    it('should build approval chain from configuration', async () => {
      const config: ApprovalConfiguration = {
        id: 'config-1',
        name: 'Test Config',
        type: 'requisition',
        level: 'organization',
        entityId: 'org-1',
        isDefault: true,
        isActive: true,
        overridesDefault: false,
        stages: [
          {
            id: 'stage-1',
            sequence: 1,
            name: 'Technical Review',
            requiredRole: 'ICE_MANAGER',
            slaHours: 48,
            isRequired: true,
            canSkip: false,
            canRunInParallel: false,
            isExternalApproval: false,
            notifyOnAssignment: true,
            notifyOnOverdue: true,
          },
          {
            id: 'stage-2',
            sequence: 2,
            name: 'Financial Approval',
            requiredRole: 'FINANCE',
            slaHours: 72,
            isRequired: true,
            canSkip: false,
            canRunInParallel: false,
            isExternalApproval: false,
            notifyOnAssignment: true,
            notifyOnOverdue: true,
          },
        ],
        createdBy: userId,
        createdAt: Timestamp.now(),
        updatedBy: userId,
        updatedAt: Timestamp.now(),
        version: 1,
      };

      const chain = service.buildApprovalChain(config, 10000, 'UGX');

      expect(chain).toHaveLength(2);
      expect(chain[0].name).toBe('Technical Review');
      expect(chain[0].approverRole).toBe('ICE_MANAGER');
      expect(chain[0].slaHours).toBe(48);
      expect(chain[1].name).toBe('Financial Approval');
      expect(chain[1].approverRole).toBe('FINANCE');
      expect(chain[1].slaHours).toBe(72);
    });

    it('should skip stages with skip conditions', async () => {
      const config: ApprovalConfiguration = {
        id: 'config-1',
        name: 'Test Config',
        type: 'requisition',
        level: 'organization',
        entityId: 'org-1',
        isDefault: false,
        isActive: true,
        overridesDefault: true,
        stages: [
          {
            id: 'stage-1',
            sequence: 1,
            name: 'Technical Review',
            requiredRole: 'ICE_MANAGER',
            slaHours: 48,
            isRequired: true,
            canSkip: true,
            skipConditions: [
              {
                id: 'skip-1',
                type: 'amount',
                operator: 'lt',
                value: 5000,
                description: 'Skip for amounts < 5000',
              },
            ],
            canRunInParallel: false,
            isExternalApproval: false,
            notifyOnAssignment: true,
            notifyOnOverdue: true,
          },
          {
            id: 'stage-2',
            sequence: 2,
            name: 'Financial Approval',
            requiredRole: 'FINANCE',
            slaHours: 72,
            isRequired: true,
            canSkip: false,
            canRunInParallel: false,
            isExternalApproval: false,
            notifyOnAssignment: true,
            notifyOnOverdue: true,
          },
        ],
        createdBy: userId,
        createdAt: Timestamp.now(),
        updatedBy: userId,
        updatedAt: Timestamp.now(),
        version: 1,
      };

      // Amount < 5000, should skip Technical Review
      const chain = service.buildApprovalChain(config, 3000, 'UGX');

      expect(chain).toHaveLength(1);
      expect(chain[0].name).toBe('Financial Approval');
    });
  });

  // ───────────────────────────────────────────────────────────────
  // ADVANCE POLICY TESTS
  // ───────────────────────────────────────────────────────────────

  describe('calculateAccountabilityDueDate', () => {
    it('should calculate 14 days for materials', () => {
      const approvalDate = new Date('2026-01-01');
      const dueDate = service.calculateAccountabilityDueDate(
        'materials',
        approvalDate
      );

      const expected = new Date('2026-01-15');
      expect(dueDate.getTime()).toBe(expected.getTime());
    });

    it('should calculate 7 days for labor', () => {
      const approvalDate = new Date('2026-01-01');
      const dueDate = service.calculateAccountabilityDueDate(
        'labor',
        approvalDate
      );

      const expected = new Date('2026-01-08');
      expect(dueDate.getTime()).toBe(expected.getTime());
    });

    it('should default to 14 days for unknown type', () => {
      const approvalDate = new Date('2026-01-01');
      const dueDate = service.calculateAccountabilityDueDate(
        'unknown_type',
        approvalDate
      );

      const expected = new Date('2026-01-15');
      expect(dueDate.getTime()).toBe(expected.getTime());
    });
  });
});
