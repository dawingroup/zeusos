/**
 * END-TO-END INTEGRATION TEST
 *
 * Complete workflow from requisition creation to accountability validation:
 * 1. Create requisition with multiple items and suppliers
 * 2. Approve requisition → Auto-generate POs
 * 3. Record deliveries → Update PO tracking
 * 4. PO status progression (approved → partially_fulfilled → fulfilled)
 * 5. Create accountability linking to POs
 * 6. Three-way matching validation
 * 7. Verify zero-variance scenario (no investigation)
 */

import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { requisitionService } from '../requisition-service';
import { autoPOGenerationService } from '../auto-po-generation.service';
import { procurementService } from '../procurement-service';
import { EnhancedAccountabilityService } from '../../../delivery/core/services/enhanced-accountability.service';
const enhancedAccountabilityService = new EnhancedAccountabilityService(null as any);

describe('Integration Test: Full Procurement-to-Payment Cycle', () => {
  const testUserId = 'test-user-integration';
  const testProjectId = 'test-project-integration';

  it('should complete full workflow: Requisition → POs → Deliveries → Accountability', async () => {
    // ========================================================================
    // STEP 1: Create requisition with 3 items from 2 suppliers
    // ========================================================================
    const requisitionId = await requisitionService.createRequisition({
      projectId: testProjectId,
      requestedBy: testUserId,
      department: 'construction',
      priority: 'high',
      requiredDate: { toDate: () => new Date('2026-03-15'), seconds: 0, nanoseconds: 0 } as any,
      purpose: 'Integration test - Foundation materials',
      items: [
        {
          materialId: 'mat-cement',
          materialName: 'Cement - 50kg bags',
          description: 'Portland cement',
          unit: 'bags',
          requestedQuantity: 100,
          estimatedRate: { amount: 35000, currency: 'UGX' },
          estimatedAmount: { amount: 3500000, currency: 'UGX' },
          boqItemId: 'boq-cement',
          justification: 'Foundation concrete',
          suggestedSuppliers: ['supplier-A']
        },
        {
          materialId: 'mat-steel',
          materialName: 'Steel bars - 12mm',
          description: 'Reinforcement steel',
          unit: 'pieces',
          requestedQuantity: 200,
          estimatedRate: { amount: 25000, currency: 'UGX' },
          estimatedAmount: { amount: 5000000, currency: 'UGX' },
          boqItemId: 'boq-steel',
          justification: 'Foundation reinforcement',
          suggestedSuppliers: ['supplier-A']
        },
        {
          materialId: 'mat-paint',
          materialName: 'Paint - White emulsion',
          description: 'Interior wall paint',
          unit: 'litres',
          requestedQuantity: 50,
          estimatedRate: { amount: 15000, currency: 'UGX' },
          estimatedAmount: { amount: 750000, currency: 'UGX' },
          boqItemId: 'boq-paint',
          justification: 'Interior finishing',
          suggestedSuppliers: ['supplier-B']
        }
      ]
    } as any, testUserId);

    const requisition = await requisitionService.getRequisition(requisitionId);
    expect(requisition).toBeDefined();
    expect(requisition!.status).toBe('pending');
    expect(requisition!.items).toHaveLength(3);

    console.log(`✓ Step 1: Created requisition ${requisition!.requisitionNumber}`);

    // ========================================================================
    // STEP 2: Approve requisition → Triggers auto-PO generation
    // ========================================================================
    await requisitionService.approveRequisition(
      requisitionId,
      'Approved for foundation and finishing work',
      testUserId
    );

    const approvedRequisition = await requisitionService.getRequisition(requisitionId);
    expect(approvedRequisition!.status).toBe('approved');
    expect(approvedRequisition!.workflow.approvedBy).toBe(testUserId);

    console.log(`✓ Step 2: Requisition approved`);

    // ========================================================================
    // STEP 3: Verify auto-generated POs (2 POs for 2 suppliers)
    // ========================================================================
    const poGenerationResult = await autoPOGenerationService.generatePOsFromRequisition(
      requisitionId,
      testUserId
    );

    expect(poGenerationResult.success).toBe(true);
    expect(poGenerationResult.purchaseOrderIds).toHaveLength(2);
    expect(poGenerationResult.summary.totalPOs).toBe(2);
    expect(poGenerationResult.summary.totalItems).toBe(3);

    const [poIdSupplierA, poIdSupplierB] = poGenerationResult.purchaseOrderIds;

    const poA = await procurementService.getPurchaseOrder(poIdSupplierA);
    const poB = await procurementService.getPurchaseOrder(poIdSupplierB);

    expect(poA!.status).toBe('draft');
    expect(poB!.status).toBe('draft');

    // Approve both POs
    await procurementService.updatePurchaseOrder(poIdSupplierA, { status: 'approved' } as any, testUserId);
    await procurementService.updatePurchaseOrder(poIdSupplierB, { status: 'approved' } as any, testUserId);

    console.log(`✓ Step 3: Generated 2 POs - ${poA!.orderNumber}, ${poB!.orderNumber}`);

    // ========================================================================
    // STEP 4: Record partial delivery for Supplier A (Cement only)
    // ========================================================================
    const deliveryCementId = await procurementService.createProcurementEntry(
      testProjectId,
      {
        type: 'delivery',
        materialId: 'mat-cement',
        materialName: 'Cement - 50kg bags',
        unit: 'bags',
        quantityReceived: 100,
        quantityAccepted: 100,
        unitPrice: 35000,
        supplierName: 'Supplier A Ltd',
        deliveryDate: new Date(),
        deliveryCondition: 'good',
        boqItemIds: ['boq-cement'],
        notes: 'Full delivery of cement'
      } as any,
      testUserId,
      'Test User'
    );

    await procurementService.linkDeliveryToPO(
      deliveryCementId,
      poIdSupplierA,
      'mat-cement',
      testUserId
    );

    // Verify PO A status changed to partially_fulfilled (cement delivered, steel pending)
    const poAAfterFirstDelivery = await procurementService.getPurchaseOrder(poIdSupplierA);
    expect(poAAfterFirstDelivery!.status).toBe('partially_fulfilled');

    const cementItem = poAAfterFirstDelivery!.items.find(i => i.materialId === 'mat-cement');
    expect(cementItem!.deliveredQuantity).toBe(100);
    expect(cementItem!.acceptedQuantity).toBe(100);

    console.log(`✓ Step 4: Recorded cement delivery - PO A now partially fulfilled`);

    // ========================================================================
    // STEP 5: Record remaining delivery for Supplier A (Steel)
    // ========================================================================
    const deliverySteelId = await procurementService.createProcurementEntry(
      testProjectId,
      {
      type: 'delivery',
      materialId: 'mat-steel',
      materialName: 'Steel bars - 12mm',
      unit: 'pieces',
      quantityReceived: 200,
      quantityAccepted: 198,
      quantityRejected: 2,
      unitPrice: 25000,
      supplierName: 'Supplier A Ltd',
      deliveryDate: new Date(),
      deliveryCondition: 'good',
      boqItemIds: ['boq-steel'],
      notes: '2 pieces rejected due to rust'
    } as any,
      testUserId,
      'Test User'
    );

    await procurementService.linkDeliveryToPO(
      deliverySteelId,
      poIdSupplierA,
      'mat-steel',
      testUserId
    );

    // Verify PO A status changed to fulfilled (all items delivered)
    const poAFullyFulfilled = await procurementService.getPurchaseOrder(poIdSupplierA);
    expect(poAFullyFulfilled!.status).toBe('fulfilled');

    const steelItem = poAFullyFulfilled!.items.find(i => i.materialId === 'mat-steel');
    expect(steelItem!.deliveredQuantity).toBe(200);
    expect(steelItem!.acceptedQuantity).toBe(198);
    expect(steelItem!.rejectedQuantity).toBe(2);

    console.log(`✓ Step 5: Recorded steel delivery - PO A now fully fulfilled`);

    // ========================================================================
    // STEP 6: Record delivery for Supplier B (Paint)
    // ========================================================================
    const deliveryPaintId = await procurementService.createProcurementEntry(
      testProjectId,
      {
      type: 'delivery',
      materialId: 'mat-paint',
      materialName: 'Paint - White emulsion',
      unit: 'litres',
      quantityReceived: 50,
      quantityAccepted: 50,
      unitPrice: 15000,
      supplierName: 'Supplier B Ltd',
      deliveryDate: new Date(),
      deliveryCondition: 'good',
      boqItemIds: ['boq-paint']
    } as any,
      testUserId,
      'Test User'
    );

    await procurementService.linkDeliveryToPO(
      deliveryPaintId,
      poIdSupplierB,
      'mat-paint',
      testUserId
    );

    // Verify PO B status changed to fulfilled
    const poBFulfilled = await procurementService.getPurchaseOrder(poIdSupplierB);
    expect(poBFulfilled!.status).toBe('fulfilled');

    console.log(`✓ Step 6: Recorded paint delivery - PO B now fully fulfilled`);

    // ========================================================================
    // STEP 7: Create accountability with expenses linked to POs
    // ========================================================================
    const accountabilityData = {
      projectId: testProjectId,
      activityId: 'activity-foundation',
      reportingPeriod: {
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-02-28')
      },
      expenses: [
        {
          id: 'exp-cement',
          category: 'construction_materials' as const,
          description: 'Cement purchase - 100 bags',
          amount: 3500000,
          quantityExecuted: 100,
          unit: 'bags',
          unitRate: 35000,
          boqItemId: 'boq-cement',
          purchaseOrderId: poIdSupplierA,
          poItemId: 'mat-cement',
          documents: [
            {
              id: 'doc-cement-invoice',
              type: 'invoice' as const,
              url: 'https://storage/cement-invoice.pdf',
              name: 'Cement Invoice',
              uploadedAt: Timestamp.now(),
              uploadedBy: testUserId
            },
            {
              id: 'doc-cement-po',
              type: 'purchase_order' as const,
              url: 'https://storage/po-cement.pdf',
              name: 'PO - Cement',
              uploadedAt: Timestamp.now(),
              uploadedBy: testUserId
            }
          ]
        },
        {
          id: 'exp-steel',
          category: 'construction_materials' as const,
          description: 'Steel bars purchase - 200 pieces',
          amount: 5000000,
          quantityExecuted: 200,
          unit: 'pieces',
          unitRate: 25000,
          boqItemId: 'boq-steel',
          purchaseOrderId: poIdSupplierA,
          poItemId: 'mat-steel',
          documents: [
            {
              id: 'doc-steel-invoice',
              type: 'invoice' as const,
              url: 'https://storage/steel-invoice.pdf',
              name: 'Steel Invoice',
              uploadedAt: Timestamp.now(),
              uploadedBy: testUserId
            },
            {
              id: 'doc-steel-po',
              type: 'purchase_order' as const,
              url: 'https://storage/po-steel.pdf',
              name: 'PO - Steel',
              uploadedAt: Timestamp.now(),
              uploadedBy: testUserId
            }
          ]
        },
        {
          id: 'exp-paint',
          category: 'construction_materials' as const,
          description: 'Paint purchase - 50 litres',
          amount: 750000,
          quantityExecuted: 50,
          unit: 'litres',
          unitRate: 15000,
          boqItemId: 'boq-paint',
          purchaseOrderId: poIdSupplierB,
          poItemId: 'mat-paint',
          documents: [
            {
              id: 'doc-paint-invoice',
              type: 'invoice' as const,
              url: 'https://storage/paint-invoice.pdf',
              name: 'Paint Invoice',
              uploadedAt: Timestamp.now(),
              uploadedBy: testUserId
            }
          ]
        }
      ],
      cashAdvanceId: 'ca-integration-test',
      requisitionId: 'req-integration-test',
      unspentReturned: 0,
    };

    const validationResult = await enhancedAccountabilityService.validateAccountability(
      accountabilityData as any,
      testUserId
    );

    expect(validationResult.valid).toBe(true);
    expect(validationResult.errors).toHaveLength(0);
    // Should have no warnings for zero-variance scenario
    expect(validationResult.warnings.filter((w: string) => w.includes('variance')).length).toBe(0);

    console.log(`✓ Step 7: Accountability validated - All expenses match POs (zero variance)`);

    // ========================================================================
    // STEP 8: Create three-way matches for all expenses
    // ========================================================================
    const matchCementId = await enhancedAccountabilityService.createThreeWayMatch(
      poIdSupplierA,
      'mat-cement',
      deliveryCementId,
      'exp-cement',
      testUserId
    );

    const matchSteelId = await enhancedAccountabilityService.createThreeWayMatch(
      poIdSupplierA,
      'mat-steel',
      deliverySteelId,
      'exp-steel',
      testUserId
    );

    const matchPaintId = await enhancedAccountabilityService.createThreeWayMatch(
      poIdSupplierB,
      'mat-paint',
      deliveryPaintId,
      'exp-paint',
      testUserId
    );

    expect(matchCementId).toBeDefined();
    expect(matchSteelId).toBeDefined();
    expect(matchPaintId).toBeDefined();

    console.log(`✓ Step 8: Created 3 three-way match records`);

    // ========================================================================
    // STEP 9: Verify requisition can be marked as fulfilled
    // ========================================================================
    const linkedRequisition = await requisitionService.getRequisition(requisitionId);
    expect(linkedRequisition!.purchaseOrderIds).toBeDefined();
    expect(linkedRequisition!.purchaseOrderIds!.length).toBe(2);
    expect(linkedRequisition!.workflow.has_linked_po).toBe(true);

    // In real implementation, requisition would transition to fulfilled once all POs fulfilled
    // For now, verify the linkage is correct
    expect(linkedRequisition!.purchaseOrderIds).toContain(poIdSupplierA);
    expect(linkedRequisition!.purchaseOrderIds).toContain(poIdSupplierB);

    console.log(`✓ Step 9: Requisition linked to 2 fulfilled POs`);

    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log('\n========================================');
    console.log('INTEGRATION TEST SUMMARY');
    console.log('========================================');
    console.log(`Requisition: ${requisition!.requisitionNumber}`);
    console.log(`PO Supplier A: ${poA!.orderNumber} (${poAFullyFulfilled!.status})`);
    console.log(`PO Supplier B: ${poB!.orderNumber} (poBFulfilled!.status})`);
    console.log(`Deliveries: 3 (Cement, Steel, Paint)`);
    console.log(`Accountability: Validated with 0% variance`);
    console.log(`Three-way matches: 3 created`);
    console.log('========================================\n');

    // Final assertions
    expect(poAFullyFulfilled!.status).toBe('fulfilled');
    expect(poBFulfilled!.status).toBe('fulfilled');
    expect(validationResult.valid).toBe(true);
  });

  it('should detect variance and trigger investigation', async () => {
    // ========================================================================
    // Scenario: Accountability expense 8% over PO amount
    // ========================================================================

    // Create simple requisition
    const requisitionId = await requisitionService.createRequisition({
      projectId: testProjectId,
      requestedBy: testUserId,
      department: 'construction',
      priority: 'normal',
      requiredDate: { toDate: () => new Date('2026-03-15'), seconds: 0, nanoseconds: 0 } as any,
      purpose: 'Variance test',
      items: [
        {
          materialId: 'mat-variance',
          materialName: 'Test material',
          unit: 'units',
          requestedQuantity: 100,
          estimatedRate: { amount: 10000, currency: 'UGX' },
          estimatedAmount: { amount: 1000000, currency: 'UGX' },
          boqItemId: 'boq-variance',
          suggestedSuppliers: ['supplier-test']
        }
      ]
    } as any, testUserId);

    await requisitionService.approveRequisition(requisitionId, 'Approved', testUserId);

    const poResult = await autoPOGenerationService.generatePOsFromRequisition(
      requisitionId,
      testUserId
    );
    const poId = poResult.purchaseOrderIds[0];

    await procurementService.updatePurchaseOrder(poId, { status: 'approved' } as any, testUserId);

    // Record delivery
    const deliveryId = await procurementService.createProcurementEntry(
      testProjectId,
      {
      type: 'delivery',
      materialId: 'mat-variance',
      materialName: 'Test material',
      unit: 'units',
      quantityReceived: 100,
      quantityAccepted: 100,
      unitPrice: 10000,
      supplierName: 'Test Supplier',
      deliveryDate: new Date(),
      boqItemIds: ['boq-variance']
    } as any,
      testUserId,
      'Test User'
    );

    await procurementService.linkDeliveryToPO(deliveryId, poId, 'mat-variance', testUserId);

    // Create accountability with 8% variance (80,000 over 1M)
    const expense: any = {
      id: 'exp-variance',
      category: 'construction_materials',
      description: 'Test material with variance',
      amount: 1080000,  // 8% over PO
      quantityExecuted: 100,
      unit: 'units',
      unitRate: 10800,
      boqItemId: 'boq-variance',
      purchaseOrderId: poId,
      poItemId: 'mat-variance',
      documents: []
    };

    const validation = await enhancedAccountabilityService.validateExpenseAgainstPO(
      expense,
      poId,
      'mat-variance'
    );

    expect(validation.valid).toBe(true);
    expect(validation.warnings.length).toBeGreaterThan(0);
    expect(validation.requiresInvestigation).toBe(true);
    expect(validation.variancePercentage).toBeCloseTo(8.0, 1);

    // Create three-way match (should trigger investigation)
    const matchId = await enhancedAccountabilityService.createThreeWayMatch(
      poId,
      'mat-variance',
      deliveryId,
      'exp-variance',
      testUserId
    );

    expect(matchId).toBeDefined();

    console.log(`✓ Variance test: 8% variance detected and investigation triggered`);
  });
});
