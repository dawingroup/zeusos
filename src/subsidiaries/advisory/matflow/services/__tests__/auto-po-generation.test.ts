/**
 * PHASE 3 VERIFICATION TESTS: Auto-PO Generation
 *
 * Tests for automatic purchase order generation from requisitions:
 * - Single supplier scenarios
 * - Multi-supplier grouping
 * - Items without suppliers (unassigned group)
 * - PO linkage back to requisition
 * - Requisition workflow completion
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { autoPOGenerationService } from '../auto-po-generation.service';
import { requisitionService } from '../requisition-service';
import { procurementService } from '../procurement-service';

describe('Phase 3: Auto-PO Generation', () => {
  const testUserId = 'test-user-phase3';
  const testProjectId = 'test-project-003';

  describe('3.1 Single Supplier Scenario', () => {
    let requisitionId: string;

    beforeEach(async () => {
      // Create requisition with 3 items, all from same supplier
      requisitionId = await requisitionService.createRequisition({
        projectId: testProjectId,
        requestedBy: testUserId,
        department: 'construction',
        priority: 'normal',
        requiredDate: { toDate: () => new Date('2026-03-01'), seconds: 0, nanoseconds: 0 } as any,
        purpose: 'Foundation work materials',
        items: [
          {
            materialId: 'mat-001',
            materialName: 'Cement - 50kg bags',
            description: 'Portland cement for foundation',
            unit: 'bags',
            requestedQuantity: 100,
            estimatedRate: { amount: 35000, currency: 'UGX' },
            estimatedAmount: { amount: 3500000, currency: 'UGX' },
            boqItemId: 'boq-001',
            justification: 'Foundation concrete work',
            suggestedSuppliers: ['supplier-A']
          },
          {
            materialId: 'mat-002',
            materialName: 'Steel bars - 12mm',
            description: 'Reinforcement steel',
            unit: 'pieces',
            requestedQuantity: 200,
            estimatedRate: { amount: 25000, currency: 'UGX' },
            estimatedAmount: { amount: 5000000, currency: 'UGX' },
            boqItemId: 'boq-002',
            justification: 'Foundation reinforcement',
            suggestedSuppliers: ['supplier-A']
          },
          {
            materialId: 'mat-003',
            materialName: 'Sand - River sand',
            description: 'Clean river sand for concrete',
            unit: 'tonnes',
            requestedQuantity: 50,
            estimatedRate: { amount: 45000, currency: 'UGX' },
            estimatedAmount: { amount: 2250000, currency: 'UGX' },
            boqItemId: 'boq-003',
            justification: 'Foundation concrete mix',
            suggestedSuppliers: ['supplier-A']
          }
        ]
      } as any, testUserId);

      // Approve requisition
      await requisitionService.approveRequisition(
        requisitionId,
        'Approved for foundation work',
        testUserId
      );
    });

    it('should generate single PO for all items from same supplier', async () => {
      const result = await autoPOGenerationService.generatePOsFromRequisition(
        requisitionId,
        testUserId
      );

      expect(result.success).toBe(true);
      expect(result.purchaseOrderIds).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(result.summary.totalPOs).toBe(1);
      expect(result.summary.totalItems).toBe(3);
      expect(result.summary.totalAmount).toBe(12685000); // (3.5M + 5M + 2.25M) * 1.18 VAT

      // Verify supplier breakdown
      expect(result.summary.supplierBreakdown).toHaveLength(1);
      expect(result.summary.supplierBreakdown[0].supplierId).toBe('supplier-A');
      expect(result.summary.supplierBreakdown[0].itemCount).toBe(3);
    });

    it('should link generated PO back to requisition', async () => {
      const result = await autoPOGenerationService.generatePOsFromRequisition(
        requisitionId,
        testUserId
      );

      const requisition = await requisitionService.getRequisition(requisitionId);
      expect(requisition!.purchaseOrderIds).toBeDefined();
      expect(requisition!.purchaseOrderIds).toContain(result.purchaseOrderIds[0]);
    });

    it('should initialize delivery tracking fields to zero', async () => {
      const result = await autoPOGenerationService.generatePOsFromRequisition(
        requisitionId,
        testUserId
      );

      const po = await procurementService.getPurchaseOrder(result.purchaseOrderIds[0]);
      expect(po).toBeDefined();

      po!.items.forEach(item => {
        expect(item.deliveredQuantity).toBe(0);
        expect(item.receivedQuantity).toBe(0);
        expect(item.rejectedQuantity).toBe(0);
        expect(item.acceptedQuantity).toBe(0);
        expect(item.deliveryEntryIds).toEqual([]);
      });
    });
  });

  describe('3.2 Multi-Supplier Scenario', () => {
    let requisitionId: string;

    beforeEach(async () => {
      // Create requisition with 5 items from 2 different suppliers
      requisitionId = await requisitionService.createRequisition({
        projectId: testProjectId,
        requestedBy: testUserId,
        department: 'construction',
        priority: 'high',
        requiredDate: { toDate: () => new Date('2026-03-01'), seconds: 0, nanoseconds: 0 } as any,
        purpose: 'Mixed supplier materials',
        items: [
          {
            materialId: 'mat-cement',
            materialName: 'Cement',
            unit: 'bags',
            requestedQuantity: 100,
            estimatedRate: { amount: 35000, currency: 'UGX' },
            estimatedAmount: { amount: 3500000, currency: 'UGX' },
            boqItemId: 'boq-cement',
            suggestedSuppliers: ['supplier-A']
          },
          {
            materialId: 'mat-steel',
            materialName: 'Steel bars',
            unit: 'pieces',
            requestedQuantity: 200,
            estimatedRate: { amount: 25000, currency: 'UGX' },
            estimatedAmount: { amount: 5000000, currency: 'UGX' },
            boqItemId: 'boq-steel',
            suggestedSuppliers: ['supplier-A']
          },
          {
            materialId: 'mat-paint',
            materialName: 'Paint - White',
            unit: 'litres',
            requestedQuantity: 50,
            estimatedRate: { amount: 15000, currency: 'UGX' },
            estimatedAmount: { amount: 750000, currency: 'UGX' },
            boqItemId: 'boq-paint',
            suggestedSuppliers: ['supplier-B']
          },
          {
            materialId: 'mat-tiles',
            materialName: 'Floor tiles',
            unit: 'sqm',
            requestedQuantity: 100,
            estimatedRate: { amount: 25000, currency: 'UGX' },
            estimatedAmount: { amount: 2500000, currency: 'UGX' },
            boqItemId: 'boq-tiles',
            suggestedSuppliers: ['supplier-B']
          },
          {
            materialId: 'mat-grout',
            materialName: 'Tile grout',
            unit: 'bags',
            requestedQuantity: 20,
            estimatedRate: { amount: 8000, currency: 'UGX' },
            estimatedAmount: { amount: 160000, currency: 'UGX' },
            boqItemId: 'boq-grout',
            suggestedSuppliers: ['supplier-B']
          }
        ]
      } as any, testUserId);

      await requisitionService.approveRequisition(requisitionId, 'Approved', testUserId);
    });

    it('should generate 2 POs grouped by supplier', async () => {
      const result = await autoPOGenerationService.generatePOsFromRequisition(
        requisitionId,
        testUserId
      );

      expect(result.success).toBe(true);
      expect(result.purchaseOrderIds).toHaveLength(2);
      expect(result.summary.totalPOs).toBe(2);
      expect(result.summary.supplierBreakdown).toHaveLength(2);
    });

    it('should group items correctly by supplier', async () => {
      const result = await autoPOGenerationService.generatePOsFromRequisition(
        requisitionId,
        testUserId
      );

      const supplierABreakdown = result.summary.supplierBreakdown.find(
        s => s.supplierId === 'supplier-A'
      );
      const supplierBBreakdown = result.summary.supplierBreakdown.find(
        s => s.supplierId === 'supplier-B'
      );

      expect(supplierABreakdown).toBeDefined();
      expect(supplierABreakdown!.itemCount).toBe(2); // Cement + Steel

      expect(supplierBBreakdown).toBeDefined();
      expect(supplierBBreakdown!.itemCount).toBe(3); // Paint + Tiles + Grout
    });

    it('should calculate correct totals per supplier', async () => {
      const result = await autoPOGenerationService.generatePOsFromRequisition(
        requisitionId,
        testUserId
      );

      const supplierABreakdown = result.summary.supplierBreakdown.find(
        s => s.supplierId === 'supplier-A'
      );
      const supplierBBreakdown = result.summary.supplierBreakdown.find(
        s => s.supplierId === 'supplier-B'
      );

      // Supplier A: (3.5M + 5M) * 1.18 = 10.03M
      expect(supplierABreakdown!.totalAmount).toBeCloseTo(10030000, -3);

      // Supplier B: (750k + 2.5M + 160k) * 1.18 = 4.02M
      expect(supplierBBreakdown!.totalAmount).toBeCloseTo(4023800, -3);
    });
  });

  describe('3.3 Unassigned Supplier Handling', () => {
    let requisitionId: string;

    beforeEach(async () => {
      // Create requisition with items that have no suggested suppliers
      requisitionId = await requisitionService.createRequisition({
        projectId: testProjectId,
        requestedBy: testUserId,
        department: 'construction',
        priority: 'normal',
        requiredDate: { toDate: () => new Date('2026-03-01'), seconds: 0, nanoseconds: 0 } as any,
        purpose: 'Items without supplier assignment',
        items: [
          {
            materialId: 'mat-special',
            materialName: 'Special equipment',
            unit: 'units',
            requestedQuantity: 5,
            estimatedRate: { amount: 500000, currency: 'UGX' },
            estimatedAmount: { amount: 2500000, currency: 'UGX' },
            boqItemId: 'boq-special',
            suggestedSuppliers: [] // No supplier
          },
          {
            materialId: 'mat-custom',
            materialName: 'Custom materials',
            unit: 'lots',
            requestedQuantity: 1,
            estimatedRate: { amount: 1000000, currency: 'UGX' },
            estimatedAmount: { amount: 1000000, currency: 'UGX' },
            boqItemId: 'boq-custom'
            // No suggestedSuppliers field
          }
        ]
      } as any, testUserId);

      await requisitionService.approveRequisition(requisitionId, 'Approved', testUserId);
    });

    it('should create PO with "unassigned" supplier', async () => {
      const result = await autoPOGenerationService.generatePOsFromRequisition(
        requisitionId,
        testUserId
      );

      expect(result.success).toBe(true);
      expect(result.purchaseOrderIds).toHaveLength(1);

      const unassignedBreakdown = result.summary.supplierBreakdown.find(
        s => s.supplierId === 'unassigned'
      );
      expect(unassignedBreakdown).toBeDefined();
      expect(unassignedBreakdown!.itemCount).toBe(2);
      expect(unassignedBreakdown!.supplierName).toBe('To Be Assigned');
    });

    it('should generate warning for unassigned items', async () => {
      const result = await autoPOGenerationService.generatePOsFromRequisition(
        requisitionId,
        testUserId
      );

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('requiring supplier assignment');
    });

    it('should allow manual supplier assignment later', async () => {
      const result = await autoPOGenerationService.generatePOsFromRequisition(
        requisitionId,
        testUserId
      );

      const poId = result.purchaseOrderIds[0];
      const po = await procurementService.getPurchaseOrder(poId);

      expect(po!.supplierId).toBeUndefined();
      expect(po!.supplierName).toBe('To Be Assigned');

      // Manually update supplier
      await procurementService.updatePurchaseOrder(poId, {
        supplierId: 'supplier-new',
        supplierName: 'New Supplier Ltd'
      } as any, testUserId);

      const updatedPO = await procurementService.getPurchaseOrder(poId);
      expect(updatedPO!.supplierId).toBe('supplier-new');
      expect(updatedPO!.supplierName).toBe('New Supplier Ltd');
    });
  });

  describe('3.4 Requisition Status Management', () => {
    it('should only generate POs for approved requisitions', async () => {
      // Create requisition but don't approve it
      const requisitionId = await requisitionService.createRequisition({
        projectId: testProjectId,
        requestedBy: testUserId,
        department: 'construction',
        priority: 'normal',
        requiredDate: { toDate: () => new Date('2026-03-01'), seconds: 0, nanoseconds: 0 } as any,
        purpose: 'Test unapproved requisition',
        items: [
          {
            materialId: 'mat-test',
            materialName: 'Test material',
            unit: 'units',
            requestedQuantity: 10,
            estimatedRate: { amount: 10000, currency: 'UGX' },
            estimatedAmount: { amount: 100000, currency: 'UGX' },
            boqItemId: 'boq-test',
            suggestedSuppliers: ['supplier-A']
          }
        ]
      } as any, testUserId);

      // Try to generate POs without approval
      const result = await autoPOGenerationService.generatePOsFromRequisition(
        requisitionId,
        testUserId
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Requisition must be approved before generating POs');
      expect(result.purchaseOrderIds).toHaveLength(0);
    });

    it('should keep requisition in approved status after PO generation', async () => {
      const requisitionId = await requisitionService.createRequisition({
        projectId: testProjectId,
        requestedBy: testUserId,
        department: 'construction',
        priority: 'normal',
        requiredDate: { toDate: () => new Date('2026-03-01'), seconds: 0, nanoseconds: 0 } as any,
        purpose: 'Test status retention',
        items: [
          {
            materialId: 'mat-status',
            materialName: 'Status test material',
            unit: 'units',
            requestedQuantity: 10,
            estimatedRate: { amount: 10000, currency: 'UGX' },
            estimatedAmount: { amount: 100000, currency: 'UGX' },
            boqItemId: 'boq-status',
            suggestedSuppliers: ['supplier-A']
          }
        ]
      } as any, testUserId);

      await requisitionService.approveRequisition(requisitionId, 'Approved', testUserId);

      await autoPOGenerationService.generatePOsFromRequisition(requisitionId, testUserId);

      const requisition = await requisitionService.getRequisition(requisitionId);
      expect(requisition!.status).toBe('approved');
      // Status will change to fulfilled only when deliveries are recorded
    });
  });

  describe('3.5 PO Content Validation', () => {
    it('should use approved quantities and rates', async () => {
      const requisitionId = await requisitionService.createRequisition({
        projectId: testProjectId,
        requestedBy: testUserId,
        department: 'construction',
        priority: 'normal',
        requiredDate: { toDate: () => new Date('2026-03-01'), seconds: 0, nanoseconds: 0 } as any,
        purpose: 'Test approved values',
        items: [
          {
            materialId: 'mat-qty',
            materialName: 'Quantity test material',
            unit: 'units',
            requestedQuantity: 100,
            estimatedRate: { amount: 10000, currency: 'UGX' },
            estimatedAmount: { amount: 1000000, currency: 'UGX' },
            boqItemId: 'boq-qty',
            suggestedSuppliers: ['supplier-A']
          }
        ]
      } as any, testUserId);

      await requisitionService.approveRequisition(requisitionId, 'Approved', testUserId);

      const result = await autoPOGenerationService.generatePOsFromRequisition(
        requisitionId,
        testUserId
      );

      const po = await procurementService.getPurchaseOrder(result.purchaseOrderIds[0]);
      const poItem = po!.items[0];

      expect(poItem.quantity).toBe(100); // approvedQuantity || requestedQuantity
      expect(poItem.unitPrice).toBe(10000);
      expect(poItem.amount).toBe(1000000);
    });

    it('should include requisition reference in PO notes', async () => {
      const requisitionId = await requisitionService.createRequisition({
        projectId: testProjectId,
        requestedBy: testUserId,
        department: 'construction',
        priority: 'normal',
        requiredDate: { toDate: () => new Date('2026-03-01'), seconds: 0, nanoseconds: 0 } as any,
        purpose: 'Test PO notes',
        items: [
          {
            materialId: 'mat-notes',
            materialName: 'Notes test material',
            unit: 'units',
            requestedQuantity: 10,
            estimatedRate: { amount: 10000, currency: 'UGX' },
            estimatedAmount: { amount: 100000, currency: 'UGX' },
            boqItemId: 'boq-notes',
            suggestedSuppliers: ['supplier-A']
          }
        ]
      } as any, testUserId);

      await requisitionService.approveRequisition(requisitionId, 'Approved', testUserId);

      const requisition = await requisitionService.getRequisition(requisitionId);
      const result = await autoPOGenerationService.generatePOsFromRequisition(
        requisitionId,
        testUserId
      );

      const po = await procurementService.getPurchaseOrder(result.purchaseOrderIds[0]);
      expect(po!.notes).toContain('Auto-generated from requisition');
      expect(po!.notes).toContain(requisition!.requisitionNumber);
    });

    it('should apply 18% VAT to PO totals', async () => {
      const requisitionId = await requisitionService.createRequisition({
        projectId: testProjectId,
        requestedBy: testUserId,
        department: 'construction',
        priority: 'normal',
        requiredDate: { toDate: () => new Date('2026-03-01'), seconds: 0, nanoseconds: 0 } as any,
        purpose: 'Test VAT calculation',
        items: [
          {
            materialId: 'mat-vat',
            materialName: 'VAT test material',
            unit: 'units',
            requestedQuantity: 10,
            estimatedRate: { amount: 100000, currency: 'UGX' },
            estimatedAmount: { amount: 1000000, currency: 'UGX' },
            boqItemId: 'boq-vat',
            suggestedSuppliers: ['supplier-A']
          }
        ]
      } as any, testUserId);

      await requisitionService.approveRequisition(requisitionId, 'Approved', testUserId);

      const result = await autoPOGenerationService.generatePOsFromRequisition(
        requisitionId,
        testUserId
      );

      const po = await procurementService.getPurchaseOrder(result.purchaseOrderIds[0]);

      expect(po!.subtotal).toBe(1000000);
      expect(po!.taxAmount).toBe(180000); // 18% of 1M
      expect(po!.totalAmount).toBe(1180000); // 1M + 180k
    });
  });
});
