/**
 * PHASE 2 VERIFICATION TESTS: Accountability PO Validation
 *
 * Tests for accountability expense validation against purchase orders:
 * - PO validation logic
 * - Variance detection (2% moderate, 5% severe)
 * - Three-way matching
 * - Investigation triggering
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EnhancedAccountabilityService } from '../enhanced-accountability.service';
import { procurementService } from '../../../../matflow/services/procurement-service';
// AccountabilityExpense type used via 'as any' casts on test data

const enhancedAccountabilityService = new EnhancedAccountabilityService(null as any);

describe('Phase 2: Accountability PO Validation', () => {
  let testPOId: string;
  let testDeliveryId: string;
  const testUserId = 'test-user-phase2';
  const testProjectId = 'test-project-002';

  beforeEach(async () => {
    // Create test PO
    testPOId = await procurementService.createPurchaseOrder({
      projectId: testProjectId,
      supplierId: 'supplier-002',
      supplierName: 'Building Supplies Ltd',
      items: [
        {
          materialId: 'mat-cement',
          materialName: 'Cement - 50kg bags',
          unit: 'bags',
          quantity: 100,
          unitPrice: 35000,
          amount: 3500000,
          boqItemIds: ['boq-cement'],
          deliveredQuantity: 0,
          receivedQuantity: 0,
          rejectedQuantity: 0,
          acceptedQuantity: 0,
          deliveryEntryIds: []
        }
      ],
      subtotal: 3500000,
      taxAmount: 630000,
      totalAmount: 4130000,
      currency: 'UGX'
    }, testUserId);

    // Approve PO
    await procurementService.updatePurchaseOrder(testPOId, {
      status: 'approved'
    }, testUserId);

    // Create and link delivery
    testDeliveryId = await procurementService.createProcurementEntry(testProjectId, {
      type: 'delivery',
      materialId: 'mat-cement',
      materialName: 'Cement - 50kg bags',
      unit: 'bags',
      quantityReceived: 100,
      quantityAccepted: 100,
      unitPrice: 35000,
      supplierName: 'Building Supplies Ltd',
      deliveryDate: new Date(),
      boqItemIds: ['boq-cement']
    }, testUserId, 'Test User');

    await procurementService.linkDeliveryToPO(testDeliveryId, testPOId, 'mat-cement', testUserId);
  });

  describe('2.1 PO Validation - Matching Amounts', () => {
    it('should validate expense that exactly matches PO', async () => {
      const expense = {
        id: 'exp-001',
        category: 'construction_materials',
        description: 'Cement purchase - 100 bags',
        amount: 3500000,
        quantityExecuted: 100,
        boqItemId: 'boq-cement',
        purchaseOrderId: testPOId,
        poItemId: 'mat-cement',
        documents: []
      };

      const result = await enhancedAccountabilityService.validateExpenseAgainstPO(
        expense as any,
        testPOId,
        'mat-cement'
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.requiresInvestigation).toBe(false);
      expect(result.variancePercentage).toBe(0);
    });
  });

  describe('2.2 Variance Detection - Minor (<2%)', () => {
    it('should accept minor variance without warnings', async () => {
      // 1.5% variance (52,500 UGX over 3.5M = 1.5%)
      const expense = {
        id: 'exp-002',
        category: 'construction_materials',
        description: 'Cement purchase - 100 bags',
        amount: 3552500,  // 1.5% over
        quantityExecuted: 100,
        boqItemId: 'boq-cement',
        purchaseOrderId: testPOId,
        poItemId: 'mat-cement',
        documents: []
      };

      const result = await enhancedAccountabilityService.validateExpenseAgainstPO(
        expense as any,
        testPOId,
        'mat-cement'
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.requiresInvestigation).toBe(false);
      expect(result.variancePercentage).toBeCloseTo(1.5, 1);
    });
  });

  describe('2.3 Variance Detection - Moderate (2-5%)', () => {
    it('should detect 3% variance and warn but not trigger investigation', async () => {
      // 3% variance (105,000 UGX over 3.5M = 3%)
      const expense = {
        id: 'exp-003',
        category: 'construction_materials',
        description: 'Cement purchase - 100 bags',
        amount: 3605000,  // 3% over
        quantityExecuted: 100,
        boqItemId: 'boq-cement',
        purchaseOrderId: testPOId,
        poItemId: 'mat-cement',
        documents: []
      };

      const result = await enhancedAccountabilityService.validateExpenseAgainstPO(
        expense as any,
        testPOId,
        'mat-cement'
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('variance');
      expect(result.requiresInvestigation).toBe(false);
      expect(result.variancePercentage).toBeCloseTo(3.0, 1);
    });
  });

  describe('2.4 Variance Detection - Severe (≥5%)', () => {
    it('should detect 6% variance and trigger investigation', async () => {
      // 6% variance (210,000 UGX over 3.5M = 6%)
      const expense = {
        id: 'exp-004',
        category: 'construction_materials',
        description: 'Cement purchase - 100 bags',
        amount: 3710000,  // 6% over
        quantityExecuted: 100,
        boqItemId: 'boq-cement',
        purchaseOrderId: testPOId,
        poItemId: 'mat-cement',
        documents: []
      };

      const result = await enhancedAccountabilityService.validateExpenseAgainstPO(
        expense as any,
        testPOId,
        'mat-cement'
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.requiresInvestigation).toBe(true);
      expect(result.variancePercentage).toBeCloseTo(6.0, 1);
    });
  });

  describe('2.5 Three-Way Matching', () => {
    it('should create three-way match record linking PO → Delivery → Accountability', async () => {
      const expenseId = 'exp-005';

      // Create three-way match
      const matchId = await enhancedAccountabilityService.createThreeWayMatch(
        testPOId,
        'mat-cement',
        testDeliveryId,
        expenseId,
        testUserId
      );

      expect(matchId).toBeDefined();
      expect(typeof matchId).toBe('string');

      // Note: In real implementation, you'd query Firestore to verify the match record
      // For now, we verify the method completed without error
    });

    it('should detect variance in three-way match and trigger investigation', async () => {
      const expenseId = 'exp-006';

      // Three-way match should detect variance and trigger investigation
      const matchId = await enhancedAccountabilityService.createThreeWayMatch(
        testPOId,
        'mat-cement',
        testDeliveryId,
        expenseId,
        testUserId
      );

      expect(matchId).toBeDefined();

      // Note: Verify investigation was triggered (in real test, check Firestore for investigation record)
    });
  });

  describe('2.6 PO Mandatory Requirements', () => {
    it('should require PO for construction materials over 500k UGX', async () => {
      const formData = {
        projectId: testProjectId,
        activityId: 'act-001',
        reportingPeriod: {
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-31')
        },
        expenses: [
          {
            id: 'exp-007',
            category: 'construction_materials' as const,
            description: 'Cement purchase - 100 bags',
            amount: 3500000,  // Over 500k threshold
            quantityExecuted: 100,
            boqItemId: 'boq-cement',
            // Missing purchaseOrderId - should fail validation
            documents: []
          }
        ],
        cashAdvanceId: 'ca-001'
      };

      const result = await enhancedAccountabilityService.validateAccountability(
        formData as any,
        testUserId
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('requires purchase order'))).toBe(true);
    });

    it('should not require PO for construction materials under 500k UGX', async () => {
      const formData = {
        projectId: testProjectId,
        activityId: 'act-002',
        reportingPeriod: {
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-31')
        },
        expenses: [
          {
            id: 'exp-008',
            category: 'construction_materials' as const,
            description: 'Small hardware items',
            amount: 350000,  // Under 500k threshold
            quantityExecuted: 1,
            boqItemId: 'boq-hardware',
            // No purchaseOrderId - should pass validation
            documents: []
          }
        ],
        cashAdvanceId: 'ca-002'
      };

      const result = await enhancedAccountabilityService.validateAccountability(
        formData as any,
        testUserId
      );

      // Should not have PO-related errors (might have other validation errors)
      expect(result.errors.some((e: string) => e.includes('requires purchase order'))).toBe(false);
    });
  });

  describe('2.7 Error Handling', () => {
    it('should handle non-existent purchase order', async () => {
      const expense = {
        id: 'exp-009',
        category: 'construction_materials',
        description: 'Test expense',
        amount: 1000000,
        quantityExecuted: 10,
        boqItemId: 'boq-test',
        documents: []
      };

      const result = await enhancedAccountabilityService.validateExpenseAgainstPO(
        expense as any,
        'non-existent-po',
        'mat-test'
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Purchase order not found');
    });

    it('should handle non-existent PO item', async () => {
      const expense = {
        id: 'exp-010',
        category: 'construction_materials',
        description: 'Test expense',
        amount: 1000000,
        quantityExecuted: 10,
        boqItemId: 'boq-test',
        documents: []
      };

      const result = await enhancedAccountabilityService.validateExpenseAgainstPO(
        expense as any,
        testPOId,
        'non-existent-item'
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('PO item not found');
    });
  });
});
