/**
 * Stock Adjustment Zod Validation Schema
 */

import { z } from 'zod';

const adjustmentLineItemSchema = z.object({
  lineId: z.string().uuid(),
  itemId: z.string(),                // Can be empty for offcut-only lines
  itemName: z.string(),
  itemSku: z.string(),
  direction: z.enum(['increase', 'decrease']),
  quantity: z.number().min(0, 'Quantity must be zero or positive'),
  unitOfMeasure: z.string().min(1),
  unitCostAtAdjustment: z.number().min(0),
  totalValue: z.number().min(0),
  lotNumber: z.string().optional(),
  locationFrom: z.string().optional(),
  locationTo: z.string().optional(),
  notes: z.string().max(500).optional(),
  offcutId: z.string().optional(),
  offcutDimensions: z.string().optional(),
  // Count-based adjustment fields
  currentStock: z.number().optional(),
  countedQuantity: z.number().optional(),
});

export const stockAdjustmentSchema = z.object({
  adjustmentType: z.enum([
    'physical_count_variance', 'damage_spoilage', 'shrinkage_loss',
    'production_consumption', 'production_output', 'internal_transfer',
    'opening_balance', 'reclassification', 'goods_received',
    'customer_return', 'supplier_return', 'offcut_adjustment',
  ]),
  lineItems: z.array(adjustmentLineItemSchema).min(1, 'At least one line item required'),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(1000),
  referenceType: z.enum([
    'cycle_count', 'manufacturing_order', 'purchase_order',
    'sales_order', 'damage_report', 'other',
  ]).optional(),
  referenceId: z.string().optional(),
  referenceNumber: z.string().optional(),
  attachments: z.array(z.string().url()).optional(),
}).refine(
  (data) => {
    if (data.adjustmentType === 'internal_transfer') {
      return data.lineItems.every(
        line => line.locationFrom && line.locationTo && line.locationFrom !== line.locationTo
      );
    }
    return true;
  },
  {
    message: 'Internal transfers require distinct locationFrom and locationTo on every line',
    path: ['lineItems'],
  }
).refine(
  (data) => {
    if (data.adjustmentType === 'offcut_adjustment') {
      return data.lineItems.every(line => !!line.offcutId);
    }
    return true;
  },
  {
    message: 'Offcut adjustments require an offcut to be selected for every line',
    path: ['lineItems'],
  }
).refine(
  (data) => {
    // For non-offcut adjustments, every line must have an itemId
    if (data.adjustmentType !== 'offcut_adjustment') {
      return data.lineItems.every(line => !!line.itemId);
    }
    return true;
  },
  {
    message: 'Every line item must have an inventory item selected',
    path: ['lineItems'],
  }
);

export type StockAdjustmentFormData = z.infer<typeof stockAdjustmentSchema>;
