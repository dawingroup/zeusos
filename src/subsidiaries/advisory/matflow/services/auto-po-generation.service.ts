/**
 * AUTO-PO GENERATION SERVICE
 *
 * Automatically generates purchase orders when requisitions are approved.
 * Handles supplier selection, item grouping, and multi-supplier scenarios.
 */

import { requisitionService } from './requisition-service';
import { procurementService } from './procurement-service';
import type { Requisition, RequisitionItem } from '../types/requisition';
import type { PurchaseOrderItem } from '../types/procurement';

// ============================================================================
// TYPES
// ============================================================================

export interface POGenerationConfig {
  // Auto-generation settings
  autoGenerateOnApproval: boolean;
  requireUserConfirmation: boolean;

  // Supplier selection
  preferSuggestedSuppliers: boolean;
  allowMultipleSuppliers: boolean;

  // Item grouping
  groupBySupplier: boolean;
  maxItemsPerPO: number;

  // Pricing
  useApprovedRates: boolean;
}

export interface POGenerationResult {
  success: boolean;
  purchaseOrderIds: string[];
  errors: string[];
  warnings: string[];
  summary: {
    totalPOs: number;
    totalItems: number;
    totalAmount: number;
    supplierBreakdown: {
      supplierId: string;
      supplierName: string;
      poId: string;
      itemCount: number;
      totalAmount: number;
    }[];
  };
}

// ============================================================================
// AUTO-PO GENERATION SERVICE
// ============================================================================

export class AutoPOGenerationService {
  private config: POGenerationConfig;

  constructor(config?: Partial<POGenerationConfig>) {
    this.config = {
      autoGenerateOnApproval: true,
      requireUserConfirmation: false,
      preferSuggestedSuppliers: true,
      allowMultipleSuppliers: true,
      groupBySupplier: true,
      maxItemsPerPO: 50,
      useApprovedRates: true,
      ...config
    };
  }

  /**
   * Main entry point: Generate POs from approved requisition
   */
  async generatePOsFromRequisition(
    requisitionId: string,
    userId: string
  ): Promise<POGenerationResult> {
    const requisition = await requisitionService.getRequisition(requisitionId);
    if (!requisition) {
      return {
        success: false,
        purchaseOrderIds: [],
        errors: ['Requisition not found'],
        warnings: [],
        summary: { totalPOs: 0, totalItems: 0, totalAmount: 0, supplierBreakdown: [] }
      };
    }

    // Validate requisition status
    if (requisition.status !== 'approved') {
      return {
        success: false,
        purchaseOrderIds: [],
        errors: ['Requisition must be approved before generating POs'],
        warnings: [],
        summary: { totalPOs: 0, totalItems: 0, totalAmount: 0, supplierBreakdown: [] }
      };
    }

    // Only generate POs for materials requisitions (not funds or labour)
    const reqType = requisition.requisitionType as string;
    if (reqType !== 'materials' && reqType !== 'materials_services') {
      return {
        success: false,
        purchaseOrderIds: [],
        errors: [`${requisition.requisitionType} requisitions do not require purchase orders. POs are only generated for materials requisitions.`],
        warnings: [],
        summary: { totalPOs: 0, totalItems: 0, totalAmount: 0, supplierBreakdown: [] }
      };
    }

    // Group items by supplier
    const supplierGroups = await this.groupItemsBySupplier(requisition.items);

    // Generate PO for each supplier group
    const poIds: string[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const supplierBreakdown: POGenerationResult['summary']['supplierBreakdown'] = [];

    for (const [supplierId, items] of Object.entries(supplierGroups)) {
      try {
        const result = await this.createPOForSupplierGroup(
          requisition,
          supplierId,
          items,
          userId
        );

        poIds.push(result.poId);
        supplierBreakdown.push({
          supplierId,
          supplierName: result.supplierName,
          poId: result.poId,
          itemCount: items.length,
          totalAmount: result.totalAmount
        });

        if (supplierId === 'unassigned') {
          warnings.push(`PO ${result.poId} created with ${items.length} items requiring supplier assignment`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Failed to create PO for supplier ${supplierId}: ${errorMessage}`);
      }
    }

    // Link generated POs back to requisition
    for (const poId of poIds) {
      await requisitionService.linkPurchaseOrder(requisitionId, poId, userId);
    }

    // Update requisition status if POs were generated
    if (poIds.length > 0) {
      // Requisition stays in 'approved' status until items are fulfilled
      // Status will change to 'partially_fulfilled' or 'fulfilled' as deliveries come in
    }

    // Calculate summary
    const totalAmount = supplierBreakdown.reduce((sum, s) => sum + s.totalAmount, 0);

    return {
      success: poIds.length > 0,
      purchaseOrderIds: poIds,
      errors,
      warnings,
      summary: {
        totalPOs: poIds.length,
        totalItems: requisition.items.length,
        totalAmount,
        supplierBreakdown
      }
    };
  }

  /**
   * Group requisition items by supplier
   */
  private async groupItemsBySupplier(
    items: RequisitionItem[]
  ): Promise<Record<string, RequisitionItem[]>> {
    const groups: Record<string, RequisitionItem[]> = {};

    for (const item of items) {
      // Try to find best supplier for this item
      const supplierId = await this.selectSupplierForItem(item);

      if (!supplierId) {
        // Use "unassigned" group for items without supplier
        if (!groups['unassigned']) groups['unassigned'] = [];
        groups['unassigned'].push(item);
        continue;
      }

      if (!groups[supplierId]) {
        groups[supplierId] = [];
      }
      groups[supplierId].push(item);
    }

    return groups;
  }

  /**
   * Select best supplier for a requisition item
   */
  private async selectSupplierForItem(
    item: RequisitionItem
  ): Promise<string | null> {
    // 1. Check if item has suggested suppliers
    if (this.config.preferSuggestedSuppliers && (item.suggestedSuppliers?.length ?? 0) > 0) {
      return item.suggestedSuppliers![0]; // Use first suggested supplier
    }

    // 2. Fallback: Return null (will need manual assignment)
    return null;
  }

  /**
   * Create PO for a supplier group
   */
  private async createPOForSupplierGroup(
    requisition: Requisition,
    supplierId: string,
    items: RequisitionItem[],
    userId: string
  ): Promise<{ poId: string; supplierName: string; totalAmount: number }> {
    // Convert requisition items to PO items
    const poItems: PurchaseOrderItem[] = items.map(item => ({
      materialId: item.materialId || '',
      materialName: item.materialName || item.description,
      unit: item.unit,
      quantity: item.approvedQuantity || item.requestedQuantity,
      unitPrice: item.approvedRate?.amount || item.estimatedRate.amount,
      amount: (item.approvedAmount?.amount || item.estimatedAmount.amount),
      boqItemIds: item.boqItemId ? [item.boqItemId] : [],

      // Initialize delivery tracking
      deliveredQuantity: 0,
      receivedQuantity: 0,
      rejectedQuantity: 0,
      acceptedQuantity: 0,
      deliveryEntryIds: []
    }));

    // Calculate totals
    const subtotal = poItems.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = subtotal * 0.18; // 18% VAT
    const totalAmount = subtotal + taxAmount;

    // Get supplier info
    const supplier = supplierId !== 'unassigned'
      ? await procurementService.getSupplier(supplierId)
      : null;

    // Create PO
    const poId = await procurementService.createPurchaseOrder({
      projectId: requisition.projectId,
      supplierId: supplier?.id,
      supplierName: supplier?.name || 'To Be Assigned',
      items: poItems,
      subtotal,
      taxAmount,
      totalAmount,
      currency: 'UGX',
      expectedDeliveryDate: requisition.requiredDate,
      notes: `Auto-generated from requisition ${requisition.requisitionNumber}`,
    }, userId);

    return {
      poId,
      supplierName: supplier?.name || 'To Be Assigned',
      totalAmount
    };
  }

  /**
   * Handle multi-supplier scenario (for future enhancement)
   */
  async splitRequisitionBySuppliers(
    requisitionId: string,
    supplierAssignments: { itemId: string; supplierId: string }[],
    userId: string
  ): Promise<POGenerationResult> {
    const result: POGenerationResult = {
      success: false,
      purchaseOrderIds: [],
      errors: [],
      warnings: [],
      summary: { totalPOs: 0, totalAmount: 0, totalItems: 0, supplierBreakdown: [] },
    };

    try {
      const requisition = await requisitionService.getRequisition(requisitionId);
      if (!requisition) {
        result.errors.push('Requisition not found');
        return result;
      }

      // Group items by assigned supplier
      const supplierGroups = new Map<string, { itemId: string; supplierId: string }[]>();
      for (const assignment of supplierAssignments) {
        const group = supplierGroups.get(assignment.supplierId) || [];
        group.push(assignment);
        supplierGroups.set(assignment.supplierId, group);
      }

      // Generate a PO for each supplier group
      for (const [supplierId, assignments] of supplierGroups) {
        const itemIds = assignments.map((a) => a.itemId);
        const items = (requisition.items || []).filter((item: RequisitionItem) =>
          itemIds.includes(item.id)
        );

        if (items.length === 0) {
          result.warnings.push(`No matching items for supplier ${supplierId}`);
          continue;
        }

        const poItems: PurchaseOrderItem[] = items.map((item: RequisitionItem) => {
          const qty = item.approvedQuantity ?? item.requestedQuantity;
          const unitPrice = item.approvedRate?.amount ?? item.estimatedRate?.amount ?? 0;
          return {
            materialId: item.materialId ?? '',
            materialName: item.materialName ?? item.description,
            unit: item.unit,
            quantity: qty,
            unitPrice,
            amount: unitPrice * qty,
            boqItemIds: item.boqItemId ? [item.boqItemId] : [],
            deliveredQuantity: 0,
            receivedQuantity: 0,
            rejectedQuantity: 0,
            acceptedQuantity: 0,
            deliveryEntryIds: [],
          };
        });

        const totalAmount = poItems.reduce((sum, i) => sum + i.amount, 0);

        const poId = await procurementService.createPurchaseOrder({
          projectId: requisition.projectId ?? '',
          requisitionId,
          supplierId,
          supplierName: '',
          items: poItems,
          subtotal: totalAmount,
          taxAmount: 0,
          totalAmount,
          currency: 'UGX' as const,
          notes: `Generated from requisition ${requisition.requisitionNumber} (manual assignment)`,
        }, userId);

        result.purchaseOrderIds.push(poId);
        result.summary.totalAmount += totalAmount;
        result.summary.totalItems += poItems.length;
      }

      result.summary.totalPOs = result.purchaseOrderIds.length;
      result.success = result.purchaseOrderIds.length > 0;
    } catch (error: any) {
      result.errors.push(error.message || 'Failed to split requisition');
    }

    return result;
  }
}

// Export singleton instance
export const autoPOGenerationService = new AutoPOGenerationService();

export default autoPOGenerationService;
