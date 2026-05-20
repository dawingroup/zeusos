/**
 * Sales Order Module — Zod Validation Schemas
 */

import { z } from 'zod';

// ============================================================================
// SALES ORDER SCHEMAS
// ============================================================================

export const createSalesOrderSchema = z.object({
  designProjectId: z.string().min(1, 'Design project is required'),
  quoteId: z.string().optional(),
  dealId: z.string().optional(),
  customerId: z.string().min(1, 'Customer is required'),
  customerName: z.string().min(1, 'Customer name is required'),
  customerEmail: z.string().email().optional().or(z.literal('')),
  customerPhone: z.string().optional(),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  currency: z.enum(['UGX', 'USD']).default('UGX'),
  paymentTerms: z.object({
    depositRequired: z.boolean().default(true),
    depositPercent: z.number().min(0).max(100).optional(),
    depositAmount: z.number().min(0).optional(),
    billingMilestones: z.array(z.string()).optional(),
    paymentDueDays: z.number().int().min(0).max(365).default(30),
    retentionPercent: z.number().min(0).max(100).optional(),
  }),
  expectedDeliveryDate: z.date().optional(),
  deliveryAddress: z.string().max(500).optional(),
  deliveryNotes: z.string().max(1000).optional(),
  installationRequired: z.boolean().default(false),
  expiresAt: z.date().optional(),
});

export type CreateSalesOrderInput = z.infer<typeof createSalesOrderSchema>;

export const updateSalesOrderSchema = createSalesOrderSchema.partial().omit({
  designProjectId: true,
  customerId: true,
});

export type UpdateSalesOrderInput = z.infer<typeof updateSalesOrderSchema>;

// ============================================================================
// SALES ORDER ITEM SCHEMAS
// ============================================================================

export const salesOrderItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  specification: z.string().optional(),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().min(1).default('pcs'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
  category: z.enum(['furniture', 'fitout', 'installation', 'design_fee', 'consultation', 'other']),
  designItemId: z.string().optional(),
});

export type SalesOrderItemInput = z.infer<typeof salesOrderItemSchema>;

// ============================================================================
// DISCOUNT SCHEMAS
// ============================================================================

export const requestDiscountSchema = z.object({
  type: z.enum(['percentage', 'fixed_amount', 'line_item']),
  value: z.number().positive('Discount value must be positive'),
  reason: z.string().min(1, 'Discount reason is required').max(500),
  lineItemId: z.string().optional(),
}).refine(
  (data) => {
    if (data.type === 'percentage' && data.value > 100) return false;
    if (data.type === 'line_item' && !data.lineItemId) return false;
    return true;
  },
  {
    message: 'Percentage discount cannot exceed 100%. Line item discount requires a line item ID.',
  },
);

export type RequestDiscountInput = z.infer<typeof requestDiscountSchema>;

// ============================================================================
// CHANGE ORDER SCHEMAS
// ============================================================================

export const changeOrderItemChangeSchema = z.object({
  action: z.enum(['add', 'remove', 'modify']),
  itemId: z.string().optional(),
  description: z.string().min(1),
  field: z.string().optional(),
  oldValue: z.string().optional(),
  newValue: z.string().optional(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  unitPrice: z.number().optional(),
  totalPrice: z.number().optional(),
  priceImpact: z.number().default(0),
});

export const createChangeOrderSchema = z.object({
  salesOrderId: z.string().min(1, 'Sales order is required'),
  type: z.enum([
    'scope_addition',
    'scope_removal',
    'scope_modification',
    'price_adjustment',
    'timeline_change',
    'specification_change',
  ]),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required').max(2000),
  reason: z.string().min(1, 'Reason is required').max(500),
  requestedBy: z.enum(['client', 'internal']),
  itemsAdded: z.array(salesOrderItemSchema).default([]),
  itemsRemoved: z.array(z.object({
    itemId: z.string().min(1),
    description: z.string(),
    amount: z.number(),
  })).default([]),
  itemsModified: z.array(changeOrderItemChangeSchema).default([]),
  negotiatedPriceAdjustment: z.number().optional(),
  negotiatedAdjustmentNote: z.string().max(500).optional(),
  deliveryDateImpact: z.number().int().optional(),
  clientApprovalRequired: z.boolean().default(true),
  internalApprovalRequired: z.boolean().default(true),
});

export type CreateChangeOrderInput = z.infer<typeof createChangeOrderSchema>;

// ============================================================================
// DESIGN SIGN-OFF SCHEMAS
// ============================================================================

export const signOffDocumentSchema = z.object({
  fileName: z.string().min(1),
  storagePath: z.string().min(1),
  type: z.enum([
    'floor_plan',
    'elevation',
    '3d_render',
    'material_board',
    'specification_sheet',
    'quote_breakdown',
    'scope_document',
  ]),
  description: z.string().optional(),
  pageCount: z.number().int().positive().optional(),
});

export const requestDesignSignOffSchema = z.object({
  salesOrderId: z.string().min(1, 'Sales order is required'),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required').max(2000),
  documents: z.array(signOffDocumentSchema).min(1, 'At least one document is required'),
  itemsCovered: z.array(z.string()).default([]),
  specificationsSnapshot: z.string().default(''),
  sendVia: z.enum(['email', 'client_portal', 'whatsapp', 'in_person']).default('client_portal'),
  disclaimerText: z.string().optional(),
});

export type RequestDesignSignOffInput = z.infer<typeof requestDesignSignOffSchema>;

// ============================================================================
// GATE ACTION SCHEMA
// ============================================================================

export const gateActionSchema = z.object({
  gate: z.enum([
    'clientAcceptance',
    'discountApproval',
    'designSignOff',
    'scopeFreeze',
    'internalReview',
    'depositReceived',
  ]),
  evidence: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export type GateActionInput = z.infer<typeof gateActionSchema>;

export const waiveGateSchema = gateActionSchema.extend({
  reason: z.string().min(1, 'Waiver reason is required').max(1000),
});

export type WaiveGateInput = z.infer<typeof waiveGateSchema>;

// ============================================================================
// DISCOUNT POLICY SCHEMA
// ============================================================================

export const discountPolicySchema = z.object({
  subsidiaryId: z.string().optional(),
  autoApproveMaxPercent: z.number().min(0).max(100).default(5),
  autoApproveMaxAmount: z.number().min(0).default(500_000),
  managerApproveMaxPercent: z.number().min(0).max(100).default(15),
  ceoApproveMaxPercent: z.number().min(0).max(100).default(25),
  minimumMarginPercent: z.number().min(0).max(100).default(15),
  minimumMarginWarning: z.number().min(0).max(100).default(20),
  categoryRules: z.array(z.object({
    category: z.string(),
    maxDiscountPercent: z.number().min(0).max(100),
    notes: z.string(),
  })).default([]),
  repeatClientBonusPercent: z.number().min(0).max(100).optional(),
});

export type DiscountPolicyInput = z.infer<typeof discountPolicySchema>;

// ============================================================================
// ATTACHMENT SCHEMA
// ============================================================================

export const attachmentSchema = z.object({
  fileName: z.string().min(1),
  storagePath: z.string().min(1),
  type: z.enum([
    'signed_quote',
    'signed_design',
    'scope_document',
    'change_order',
    'client_correspondence',
    'photo',
    'contract',
    'other',
  ]),
  description: z.string().optional(),
  isClientFacing: z.boolean().default(false),
});

export type AttachmentInput = z.infer<typeof attachmentSchema>;
