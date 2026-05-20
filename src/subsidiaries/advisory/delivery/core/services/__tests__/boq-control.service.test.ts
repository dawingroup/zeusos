/**
 * BOQ CONTROL SERVICE TESTS
 *
 * Unit tests for BOQ Control Service with ADD-FIN-001 functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Timestamp, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import type { ControlBOQItem } from '../../../types/control-boq';
import { BOQControlService } from '../boq-control.service';

describe('BOQControlService', () => {
  let service: BOQControlService;
  const mockFirestore = {} as any;
  const projectId = 'test-project-123';
  const boqItemId = 'boq-item-456';

  beforeEach(() => {
    service = new BOQControlService(mockFirestore);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ───────────────────────────────────────────────────────────────
  // VALIDATION TESTS
  // ───────────────────────────────────────────────────────────────

  describe('validateRequisition', () => {
    it('should validate successful requisition within budget', async () => {
      const mockBOQItem: ControlBOQItem = {
        id: boqItemId,
        projectId,
        itemCode: 'A.001',
        itemNumber: 'A.001',
        description: 'Test BOQ Item',
        billNumber: '1',
        unit: 'm3',
        quantityContract: 100,
        quantityRequisitioned: 20,
        quantityExecuted: 10,
        quantityRemaining: 90,
        rate: 1000,
        amount: 100000,
        currency: 'UGX',
        status: 'partial',
        linkedRequisitionIds: [],
        budgetControl: {
          budgetLineId: 'budget-1',
          allocatedAmount: 100000,
          committedAmount: 20000,
          spentAmount: 10000,
          remainingBudget: 80000,
          varianceAmount: -10000,
          variancePercentage: -50,
          varianceStatus: 'on_budget',
          alertThreshold: 90,
          criticalThreshold: 100,
          lastUpdated: Timestamp.now(),
        },
        source: 'import',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        id: boqItemId,
        data: () => mockBOQItem,
      } as any);

      const result = await service.validateRequisition(
        projectId,
        boqItemId,
        30, // quantity
        30000 // amount
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.boqItem).toEqual(expect.objectContaining({ id: boqItemId }));
    });

    it('should reject requisition exceeding available quantity', async () => {
      const mockBOQItem: ControlBOQItem = {
        id: boqItemId,
        projectId,
        itemCode: 'A.001',
        itemNumber: 'A.001',
        description: 'Test BOQ Item',
        billNumber: '1',
        unit: 'm3',
        quantityContract: 100,
        quantityRequisitioned: 90,
        quantityExecuted: 0,
        quantityRemaining: 10,
        rate: 1000,
        amount: 100000,
        currency: 'UGX',
        status: 'partial',
        linkedRequisitionIds: [],
        source: 'import',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        id: boqItemId,
        data: () => mockBOQItem,
      } as any);

      const result = await service.validateRequisition(
        projectId,
        boqItemId,
        20, // requesting 20, but only 10 available
        20000
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.toLowerCase().includes('exceeds') || e.toLowerCase().includes('quantity'))).toBe(true);
    });

    it('should reject requisition exceeding budget', async () => {
      const mockBOQItem: ControlBOQItem = {
        id: boqItemId,
        projectId,
        itemCode: 'A.001',
        itemNumber: 'A.001',
        description: 'Test BOQ Item',
        billNumber: '1',
        unit: 'm3',
        quantityContract: 100,
        quantityRequisitioned: 20,
        quantityExecuted: 0,
        quantityRemaining: 80,
        rate: 1000,
        amount: 100000,
        currency: 'UGX',
        status: 'partial',
        linkedRequisitionIds: [],
        budgetControl: {
          budgetLineId: 'budget-1',
          allocatedAmount: 100000,
          committedAmount: 20000,
          spentAmount: 10000,
          remainingBudget: 80000,
          varianceAmount: -10000,
          variancePercentage: -50,
          varianceStatus: 'on_budget',
          alertThreshold: 90,
          criticalThreshold: 100,
          lastUpdated: Timestamp.now(),
        },
        source: 'import',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        id: boqItemId,
        data: () => mockBOQItem,
      } as any);

      const result = await service.validateRequisition(
        projectId,
        boqItemId,
        50,
        90000 // exceeds remaining budget of 80000
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.toLowerCase().includes('budget'))).toBe(true);
    });

    it('should warn when requisition pushes to alert threshold', async () => {
      const mockBOQItem: ControlBOQItem = {
        id: boqItemId,
        projectId,
        itemCode: 'A.001',
        itemNumber: 'A.001',
        description: 'Test BOQ Item',
        billNumber: '1',
        unit: 'm3',
        quantityContract: 100,
        quantityRequisitioned: 50,
        quantityExecuted: 0,
        quantityRemaining: 50,
        rate: 1000,
        amount: 100000,
        currency: 'UGX',
        status: 'partial',
        linkedRequisitionIds: [],
        budgetControl: {
          budgetLineId: 'budget-1',
          allocatedAmount: 100000,
          committedAmount: 50000,
          spentAmount: 25000,
          remainingBudget: 50000,
          varianceAmount: -25000,
          variancePercentage: -50,
          varianceStatus: 'on_budget',
          alertThreshold: 90,
          criticalThreshold: 100,
          lastUpdated: Timestamp.now(),
        },
        source: 'import',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        id: boqItemId,
        data: () => mockBOQItem,
      } as any);

      const result = await service.validateRequisition(
        projectId,
        boqItemId,
        42, // will push commitment to 92% (alert threshold is 90%)
        42000
      );

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should reject requisition for completed BOQ item', async () => {
      const mockBOQItem: ControlBOQItem = {
        id: boqItemId,
        projectId,
        itemCode: 'A.001',
        itemNumber: 'A.001',
        description: 'Test BOQ Item',
        billNumber: '1',
        unit: 'm3',
        quantityContract: 100,
        quantityRequisitioned: 100,
        quantityExecuted: 100,
        quantityRemaining: 0,
        rate: 1000,
        amount: 100000,
        currency: 'UGX',
        status: 'completed',
        linkedRequisitionIds: [],
        source: 'import',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        id: boqItemId,
        data: () => mockBOQItem,
      } as any);

      const result = await service.validateRequisition(
        projectId,
        boqItemId,
        10,
        10000
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.toLowerCase().includes('completed'))).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────
  // QUANTITY MANAGEMENT TESTS
  // ───────────────────────────────────────────────────────────────

  describe('reserveQuantity', () => {
    it('should update BOQ item with reserved quantity', async () => {
      const mockBOQItem: ControlBOQItem = {
        id: boqItemId,
        projectId,
        itemCode: 'A.001',
        itemNumber: 'A.001',
        description: 'Test BOQ Item',
        billNumber: '1',
        unit: 'm3',
        quantityContract: 100,
        quantityRequisitioned: 20,
        quantityExecuted: 10,
        quantityRemaining: 90,
        rate: 1000,
        amount: 100000,
        currency: 'UGX',
        status: 'partial',
        linkedRequisitionIds: [],
        budgetControl: {
          budgetLineId: 'budget-1',
          allocatedAmount: 100000,
          committedAmount: 20000,
          spentAmount: 10000,
          remainingBudget: 80000,
          varianceAmount: -10000,
          variancePercentage: -50,
          varianceStatus: 'on_budget',
          alertThreshold: 90,
          criticalThreshold: 100,
          lastUpdated: Timestamp.now(),
        },
        source: 'import',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        id: boqItemId,
        data: () => mockBOQItem,
      } as any);

      await service.reserveQuantity(projectId, boqItemId, 30, 30000, 'req-123');

      expect(updateDoc).toHaveBeenCalled();
      const updateCall = vi.mocked(updateDoc).mock.calls[0];
      expect(updateCall[1]).toMatchObject({
        quantityRequisitioned: 50, // 20 + 30
        linkedRequisitionIds: ['req-123'],
      });
    });
  });

  describe('executeQuantity', () => {
    it('should update BOQ item with executed quantity', async () => {
      const mockBOQItem: ControlBOQItem = {
        id: boqItemId,
        projectId,
        itemCode: 'A.001',
        itemNumber: 'A.001',
        description: 'Test BOQ Item',
        billNumber: '1',
        unit: 'm3',
        quantityContract: 100,
        quantityRequisitioned: 50,
        quantityExecuted: 10,
        quantityRemaining: 90,
        rate: 1000,
        amount: 100000,
        currency: 'UGX',
        status: 'partial',
        linkedRequisitionIds: ['req-123'],
        budgetControl: {
          budgetLineId: 'budget-1',
          allocatedAmount: 100000,
          committedAmount: 50000,
          spentAmount: 10000,
          remainingBudget: 50000,
          varianceAmount: -40000,
          variancePercentage: -80,
          varianceStatus: 'on_budget',
          alertThreshold: 90,
          criticalThreshold: 100,
          lastUpdated: Timestamp.now(),
        },
        source: 'import',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        id: boqItemId,
        data: () => mockBOQItem,
      } as any);

      await service.executeQuantity(projectId, boqItemId, 40, 40000);

      expect(updateDoc).toHaveBeenCalled();
      const updateCall = vi.mocked(updateDoc).mock.calls[0];
      expect(updateCall[1]).toMatchObject({
        quantityExecuted: 50, // 10 + 40
      });
    });

    it('should mark BOQ item as completed when fully executed', async () => {
      const mockBOQItem: ControlBOQItem = {
        id: boqItemId,
        projectId,
        itemCode: 'A.001',
        itemNumber: 'A.001',
        description: 'Test BOQ Item',
        billNumber: '1',
        unit: 'm3',
        quantityContract: 100,
        quantityRequisitioned: 100,
        quantityExecuted: 80,
        quantityRemaining: 20,
        rate: 1000,
        amount: 100000,
        currency: 'UGX',
        status: 'in_progress',
        linkedRequisitionIds: ['req-123'],
        source: 'import',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        id: boqItemId,
        data: () => mockBOQItem,
      } as any);

      await service.executeQuantity(projectId, boqItemId, 20, 20000);

      expect(updateDoc).toHaveBeenCalled();
      const updateCall = vi.mocked(updateDoc).mock.calls[0];
      expect(updateCall[1]).toMatchObject({
        quantityExecuted: 100,
        status: 'completed',
      });
    });
  });

  // ───────────────────────────────────────────────────────────────
  // VARIANCE DETECTION TESTS
  // ───────────────────────────────────────────────────────────────

  describe('detectVarianceAlerts', () => {
    it('should detect budget variance alerts', async () => {
      const mockBOQItems: ControlBOQItem[] = [
        {
          id: 'item-1',
          projectId,
          itemCode: 'A.001',
          itemNumber: 'A.001',
          description: 'Item with alert',
          billNumber: '1',
          unit: 'm3',
          quantityContract: 100,
          quantityRequisitioned: 90,
          quantityExecuted: 50,
          quantityRemaining: 10,
          rate: 1000,
          amount: 100000,
          currency: 'UGX',
          status: 'in_progress',
          linkedRequisitionIds: [],
          budgetControl: {
            budgetLineId: 'budget-1',
            allocatedAmount: 100000,
            committedAmount: 95000,
            spentAmount: 50000,
            remainingBudget: 5000,
            varianceAmount: -45000,
            variancePercentage: -47.4,
            varianceStatus: 'alert',
            alertThreshold: 90,
            criticalThreshold: 100,
            lastUpdated: Timestamp.now(),
          },
          source: 'import',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        {
          id: 'item-2',
          projectId,
          itemCode: 'A.002',
          itemNumber: 'A.002',
          description: 'Item exceeded budget',
          billNumber: '1',
          unit: 'm2',
          quantityContract: 50,
          quantityRequisitioned: 60,
          quantityExecuted: 30,
          quantityRemaining: -10,
          rate: 2000,
          amount: 100000,
          currency: 'UGX',
          status: 'in_progress',
          linkedRequisitionIds: [],
          budgetControl: {
            budgetLineId: 'budget-2',
            allocatedAmount: 100000,
            committedAmount: 120000,
            spentAmount: 60000,
            remainingBudget: -20000,
            varianceAmount: -60000,
            variancePercentage: -50,
            varianceStatus: 'exceeded',
            alertThreshold: 90,
            criticalThreshold: 100,
            lastUpdated: Timestamp.now(),
          },
          source: 'import',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
      ];

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockBOQItems.map(item => ({
          id: item.id,
          data: () => item,
        })),
      } as any);

      const alerts = await service.detectVarianceAlerts(projectId);

      expect(alerts.length).toBeGreaterThan(0);
      // Just verify we get alerts for items with variance issues
      expect(alerts.some(a => a.varianceStatus === 'exceeded' || a.varianceStatus === 'alert')).toBe(true);
    });
  });
});
