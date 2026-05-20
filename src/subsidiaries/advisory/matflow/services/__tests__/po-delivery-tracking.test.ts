/**
 * PHASE 1 VERIFICATION TESTS: PO Delivery Tracking
 *
 * Tests for purchase order delivery tracking functionality:
 * - Linking deliveries to PO items
 * - Quantity tracking (delivered, received, rejected, accepted)
 * - Auto-status updates (approved → partially_fulfilled → fulfilled)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { procurementService } from '../procurement-service';


describe('Phase 1: PO Delivery Tracking', () => {
  let testPOId: string;
  let testDeliveryId: string;
  const testUserId = 'test-user-phase1';
  const testProjectId = 'test-project-001';

  beforeEach(async () => {
    // Setup: Create test PO with 3 items
    testPOId = await procurementService.createPurchaseOrder({
      projectId: testProjectId,
      supplierId: 'supplier-001',
      supplierName: 'Test Supplier A',
      items: [
        {
          materialId: 'mat-001',
          materialName: 'Cement - 50kg bags',
          unit: 'bags',
          quantity: 100,
          unitPrice: 35000,
          amount: 3500000,
          boqItemIds: ['boq-001'],
          deliveredQuantity: 0,
          receivedQuantity: 0,
          rejectedQuantity: 0,
          acceptedQuantity: 0,
          deliveryEntryIds: []
        },
        {
          materialId: 'mat-002',
          materialName: 'Steel bars - 12mm',
          unit: 'pieces',
          quantity: 200,
          unitPrice: 25000,
          amount: 5000000,
          boqItemIds: ['boq-002'],
          deliveredQuantity: 0,
          receivedQuantity: 0,
          rejectedQuantity: 0,
          acceptedQuantity: 0,
          deliveryEntryIds: []
        },
        {
          materialId: 'mat-003',
          materialName: 'Sand - River sand',
          unit: 'tonnes',
          quantity: 50,
          unitPrice: 45000,
          amount: 2250000,
          boqItemIds: ['boq-003'],
          deliveredQuantity: 0,
          receivedQuantity: 0,
          rejectedQuantity: 0,
          acceptedQuantity: 0,
          deliveryEntryIds: []
        }
      ],
      subtotal: 10750000,
      taxAmount: 1935000,
      totalAmount: 12685000,
      currency: 'UGX',
      notes: 'Phase 1 test PO with 3 items'
    }, testUserId);

    // Approve PO
    await procurementService.updatePurchaseOrder(testPOId, {
      status: 'approved'
    }, testUserId);
  });

  describe('1.1 Partial Delivery Tracking', () => {
    it('should link first delivery to PO and update quantities', async () => {
      // Record delivery for first item (Cement - 60 out of 100 bags)
      testDeliveryId = await procurementService.createProcurementEntry(
      testProjectId,
      {
        type: 'delivery',
        materialId: 'mat-001',
        materialName: 'Cement - 50kg bags',
        unit: 'bags',
        quantityReceived: 60,
        quantityAccepted: 58,
        quantityRejected: 2,
        unitPrice: 35000,
        supplierName: 'Test Supplier A',
        deliveryDate: new Date(),
        deliveryCondition: 'partial',
        boqItemIds: ['boq-001'],
        notes: 'First partial delivery of cement'
      } as any,
      testUserId,
      'Test User'
    );

      // Link delivery to PO
      await procurementService.linkDeliveryToPO(
        testDeliveryId,
        testPOId,
        'mat-001',
        testUserId
      );

      // Verify PO item quantities updated
      const po = await procurementService.getPurchaseOrder(testPOId);
      expect(po).toBeDefined();

      const cementItem = po!.items.find(i => i.materialId === 'mat-001');
      expect(cementItem).toBeDefined();
      expect(cementItem!.deliveredQuantity).toBe(60);
      expect(cementItem!.acceptedQuantity).toBe(58);
      expect(cementItem!.rejectedQuantity).toBe(2);
      expect(cementItem!.deliveryEntryIds).toContain(testDeliveryId);

      // Verify delivery has PO reference
      const delivery = await procurementService.getProcurementEntry(testDeliveryId);
      expect(delivery!.purchaseOrderId).toBe(testPOId);
      expect(delivery!.poItemId).toBe('mat-001');
      expect(delivery!.poItemLineNumber).toBe(1);
    });

    it('should update PO status to partially_fulfilled', async () => {
      // Record delivery for first item
      const deliveryId = await procurementService.createProcurementEntry(
      testProjectId,
      {
        type: 'delivery',
        materialId: 'mat-001',
        materialName: 'Cement - 50kg bags',
        unit: 'bags',
        quantityReceived: 60,
        quantityAccepted: 60,
        unitPrice: 35000,
        supplierName: 'Test Supplier A',
        deliveryDate: new Date(),
        boqItemIds: ['boq-001']
      } as any,
      testUserId,
      'Test User'
    );

      await procurementService.linkDeliveryToPO(deliveryId, testPOId, 'mat-001', testUserId);

      // Check PO status changed from 'approved' to 'partially_fulfilled'
      const po = await procurementService.getPurchaseOrder(testPOId);
      expect(po!.status).toBe('partially_fulfilled');
    });
  });

  describe('1.2 Multiple Deliveries for Same Item', () => {
    it('should accumulate quantities across multiple deliveries', async () => {
      // First delivery: 60 bags
      const delivery1Id = await procurementService.createProcurementEntry(
      testProjectId,
      {
        type: 'delivery',
        materialId: 'mat-001',
        materialName: 'Cement - 50kg bags',
        unit: 'bags',
        quantityReceived: 60,
        quantityAccepted: 60,
        unitPrice: 35000,
        supplierName: 'Test Supplier A',
        deliveryDate: new Date(),
        boqItemIds: ['boq-001']
      } as any,
      testUserId,
      'Test User'
    );

      await procurementService.linkDeliveryToPO(delivery1Id, testPOId, 'mat-001', testUserId);

      // Second delivery: 40 bags (completing the order)
      const delivery2Id = await procurementService.createProcurementEntry(
      testProjectId,
      {
        type: 'delivery',
        materialId: 'mat-001',
        materialName: 'Cement - 50kg bags',
        unit: 'bags',
        quantityReceived: 40,
        quantityAccepted: 38,
        quantityRejected: 2,
        unitPrice: 35000,
        supplierName: 'Test Supplier A',
        deliveryDate: new Date(),
        boqItemIds: ['boq-001']
      } as any,
      testUserId,
      'Test User'
    );

      await procurementService.linkDeliveryToPO(delivery2Id, testPOId, 'mat-001', testUserId);

      // Verify accumulated quantities
      const po = await procurementService.getPurchaseOrder(testPOId);
      const cementItem = po!.items.find(i => i.materialId === 'mat-001');

      expect(cementItem!.deliveredQuantity).toBe(100); // 60 + 40
      expect(cementItem!.acceptedQuantity).toBe(98);   // 60 + 38
      expect(cementItem!.rejectedQuantity).toBe(2);     // 0 + 2
      expect(cementItem!.deliveryEntryIds).toHaveLength(2);
      expect(cementItem!.deliveryEntryIds).toContain(delivery1Id);
      expect(cementItem!.deliveryEntryIds).toContain(delivery2Id);
    });
  });

  describe('1.3 Complete Fulfillment Status', () => {
    it('should update PO status to fulfilled when all items delivered', async () => {
      // Deliver all 3 items completely
      const deliveries = [
        { materialId: 'mat-001', quantity: 100, name: 'Cement - 50kg bags', unit: 'bags', price: 35000 },
        { materialId: 'mat-002', quantity: 200, name: 'Steel bars - 12mm', unit: 'pieces', price: 25000 },
        { materialId: 'mat-003', quantity: 50, name: 'Sand - River sand', unit: 'tonnes', price: 45000 }
      ];

      for (const delivery of deliveries) {
        const deliveryId = await procurementService.createProcurementEntry(
      testProjectId,
      {
          type: 'delivery',
          materialId: delivery.materialId,
          materialName: delivery.name,
          unit: delivery.unit,
          quantityReceived: delivery.quantity,
          quantityAccepted: delivery.quantity,
          unitPrice: delivery.price,
          supplierName: 'Test Supplier A',
          deliveryDate: new Date(),
          boqItemIds: [`boq-${delivery.materialId}`]
        } as any,
      testUserId,
      'Test User'
    );

        await procurementService.linkDeliveryToPO(deliveryId, testPOId, delivery.materialId, testUserId);
      }

      // Verify PO status is 'fulfilled'
      const po = await procurementService.getPurchaseOrder(testPOId);
      expect(po!.status).toBe('fulfilled');

      // Verify all items fully delivered
      po!.items.forEach(item => {
        expect(item.deliveredQuantity).toBe(item.quantity);
      });
    });
  });

  describe('1.4 Rejection Tracking', () => {
    it('should track rejected quantities separately', async () => {
      // Delivery with 10% rejection rate
      const deliveryId = await procurementService.createProcurementEntry(
      testProjectId,
      {
        type: 'delivery',
        materialId: 'mat-002',
        materialName: 'Steel bars - 12mm',
        unit: 'pieces',
        quantityReceived: 100,
        quantityAccepted: 90,
        quantityRejected: 10,
        unitPrice: 25000,
        supplierName: 'Test Supplier A',
        deliveryDate: new Date(),
        deliveryCondition: 'partial',
        boqItemIds: ['boq-002'],
        notes: '10 pieces rejected due to rust'
      } as any,
      testUserId,
      'Test User'
    );

      await procurementService.linkDeliveryToPO(deliveryId, testPOId, 'mat-002', testUserId);

      const po = await procurementService.getPurchaseOrder(testPOId);
      const steelItem = po!.items.find(i => i.materialId === 'mat-002');

      expect(steelItem!.deliveredQuantity).toBe(100);
      expect(steelItem!.acceptedQuantity).toBe(90);
      expect(steelItem!.rejectedQuantity).toBe(10);

      // PO should still be partially fulfilled since only 90/200 delivered
      expect(po!.status).toBe('partially_fulfilled');
    });
  });

  describe('1.5 Error Handling', () => {
    it('should throw error when linking to non-existent PO', async () => {
      const deliveryId = await procurementService.createProcurementEntry(
      testProjectId,
      {
        type: 'delivery',
        materialId: 'mat-001',
        materialName: 'Cement',
        unit: 'bags',
        quantityReceived: 50,
        quantityAccepted: 50,
        unitPrice: 35000,
        supplierName: 'Test Supplier A',
        deliveryDate: new Date(),
        boqItemIds: []
      } as any,
      testUserId,
      'Test User'
    );

      await expect(
        procurementService.linkDeliveryToPO(deliveryId, 'non-existent-po', 'mat-001', testUserId)
      ).rejects.toThrow('Purchase order not found');
    });

    it('should throw error when linking to non-existent PO item', async () => {
      const deliveryId = await procurementService.createProcurementEntry(
      testProjectId,
      {
        type: 'delivery',
        materialId: 'mat-999',
        materialName: 'Unknown Material',
        unit: 'units',
        quantityReceived: 10,
        quantityAccepted: 10,
        unitPrice: 1000,
        supplierName: 'Test Supplier A',
        deliveryDate: new Date(),
        boqItemIds: []
      } as any,
      testUserId,
      'Test User'
    );

      await expect(
        procurementService.linkDeliveryToPO(deliveryId, testPOId, 'mat-999', testUserId)
      ).rejects.toThrow('PO item not found');
    });
  });
});
