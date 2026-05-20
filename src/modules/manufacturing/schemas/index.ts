import { z } from 'zod';

// ────────────────────────────────────────────────────────────────────────────
// SHARED ENUMS
// ────────────────────────────────────────────────────────────────────────────

// Status enums — available for reuse in form schemas
export const moStatusEnum = z.enum([
  'draft', 'planned', 'ready', 'in_progress', 'on_hold',
  'quality_review', 'completed', 'cancelled',
]);

export const stepStatusEnum = z.enum([
  'queued', 'ready', 'in_progress', 'paused', 'qc_pending',
  'completed', 'failed', 'skipped',
]);

const workstationTypeEnum = z.enum([
  'cutting_cnc', 'cutting_panel_saw', 'cutting_manual', 'edgebanding',
  'drilling', 'assembly', 'finishing_spray', 'finishing_hand', 'sanding',
  'hardware_installation', 'upholstery', 'glass_cutting', 'quality_control',
  'packing', 'custom',
]);

const priorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);

const bomCategoryEnum = z.enum([
  'sheet_material', 'linear_material', 'hardware', 'glass', 'finishing',
  'adhesive', 'consumable', 'packaging', 'subcontracted', 'labor',
]);

const defectTypeEnum = z.enum([
  'dimension_error', 'surface_damage', 'edge_defect', 'hardware_misalignment',
  'finish_defect', 'material_defect', 'assembly_error', 'missing_component', 'other',
]);

const workstationStatusEnum = z.enum(['operational', 'maintenance', 'offline', 'setup']);

// ────────────────────────────────────────────────────────────────────────────
// MANUFACTURING ORDER
// ────────────────────────────────────────────────────────────────────────────

export const manufacturingOrderSchema = z.object({
  designItemId: z.string().min(1, 'Design item is required'),
  projectId: z.string().min(1, 'Project is required'),
  projectCode: z.string().min(1),
  designItemName: z.string().min(1),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  priority: priorityEnum.default('medium'),
  instructions: z.string().default(''),
  handoverNotes: z.string().default(''),
  subsidiaryId: z.string().min(1),
  routingTemplateId: z.string().optional(),
  scheduledStartDate: z.date().optional(),
  dueDate: z.date().optional(),
  customerName: z.string().optional(),
  customerId: z.string().optional(),
  projectName: z.string().optional(),
});

export type ManufacturingOrderInput = z.infer<typeof manufacturingOrderSchema>;

// ────────────────────────────────────────────────────────────────────────────
// MANUFACTURING STEP
// ────────────────────────────────────────────────────────────────────────────

export const manufacturingStepSchema = z.object({
  stepIndex: z.number().int().nonnegative(),
  name: z.string().min(1, 'Step name is required'),
  workstationType: workstationTypeEnum,
  workstationId: z.string().optional(),
  assignedOperatorId: z.string().optional(),
  estimatedDurationMinutes: z.number().positive('Duration must be positive'),
  qcRequired: z.boolean().default(false),
  dependsOnStepIds: z.array(z.string()).default([]),
  isRework: z.boolean().default(false),
});

export type ManufacturingStepInput = z.infer<typeof manufacturingStepSchema>;

// ────────────────────────────────────────────────────────────────────────────
// BOM LINE
// ────────────────────────────────────────────────────────────────────────────

export const bomLineSchema = z.object({
  lineNumber: z.number().int().positive(),
  category: bomCategoryEnum,
  inventoryItemId: z.string().optional(),
  featureId: z.string().optional(),
  materialName: z.string().min(1, 'Material name is required'),
  materialCode: z.string().optional(),
  specification: z.string().optional(),
  requiredQuantity: z.number().positive('Quantity must be positive'),
  unit: z.string().min(1, 'Unit is required'),
  dimensions: z.object({
    length: z.number().positive().optional(),
    width: z.number().positive().optional(),
    thickness: z.number().positive().optional(),
  }).optional(),
  unitCost: z.number().nonnegative().default(0),
  fromOptimization: z.boolean().default(false),
  notes: z.string().optional(),
});

export type BOMLineInput = z.infer<typeof bomLineSchema>;

// ────────────────────────────────────────────────────────────────────────────
// WORKSTATION
// ────────────────────────────────────────────────────────────────────────────

export const workstationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  code: z.string().min(1, 'Code is required').max(20),
  type: workstationTypeEnum,
  location: z.string().optional(),
  capacityPerHour: z.number().positive().optional(),
  maxConcurrentJobs: z.number().int().positive().default(1),
  operatingHoursPerDay: z.number().positive().max(24).default(8),
  status: workstationStatusEnum.default('operational'),
  isActive: z.boolean().default(true),
  assetId: z.string().optional(),
});

export type WorkstationInput = z.infer<typeof workstationSchema>;

// ────────────────────────────────────────────────────────────────────────────
// ROUTING TEMPLATE
// ────────────────────────────────────────────────────────────────────────────

export const routingTemplateStepSchema = z.object({
  stepIndex: z.number().int().nonnegative(),
  name: z.string().min(1, 'Step name is required'),
  workstationType: workstationTypeEnum,
  defaultWorkstationId: z.string().optional(),
  estimatedDurationMinutes: z.number().positive('Duration must be positive'),
  qcRequired: z.boolean().default(false),
  dependsOnStepIndices: z.array(z.number().int().nonnegative()).default([]),
  isOptional: z.boolean().default(false),
  triggerFeatures: z.array(z.string()).optional(),
});

export const routingTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(1000).optional(),
  productType: z.string().min(1, 'Product type is required'),
  isDefault: z.boolean().default(false),
  steps: z.array(routingTemplateStepSchema).min(1, 'At least one step is required'),
  isActive: z.boolean().default(true),
});

export type RoutingTemplateInput = z.infer<typeof routingTemplateSchema>;

// ────────────────────────────────────────────────────────────────────────────
// QUALITY EVENT
// ────────────────────────────────────────────────────────────────────────────

export const qualityEventSchema = z.object({
  stepId: z.string().optional(),
  type: z.enum(['inspection', 'defect', 'rework_request', 'rework_complete', 'scrap']),
  result: z.enum(['pass', 'fail', 'conditional']).optional(),
  defectType: defectTypeEnum.optional(),
  defectSeverity: z.enum(['minor', 'major', 'critical']).optional(),
  defectDescription: z.string().max(2000).optional(),
  affectedQuantity: z.number().int().nonnegative().optional(),
  resolution: z.enum(['rework', 'scrap', 'use_as_is', 'pending']).optional(),
  scrapCost: z.number().nonnegative().optional(),
  photos: z.array(z.string()).default([]),
  notes: z.string().max(2000).optional(),
}).refine(
  (data) => {
    if (data.result === 'fail') {
      return !!data.defectType && !!data.defectSeverity;
    }
    return true;
  },
  { message: 'Defect type and severity are required when result is fail' }
);

export type QualityEventInput = z.infer<typeof qualityEventSchema>;

// ────────────────────────────────────────────────────────────────────────────
// RELEASE TO PRODUCTION
// ────────────────────────────────────────────────────────────────────────────

export const releaseToProductionSchema = z.object({
  designProjectId: z.string().min(1, 'Project is required'),
  designItemIds: z.array(z.string()).min(1, 'Select at least one item'),
  routingTemplateId: z.string().optional(),
  priority: priorityEnum.default('medium'),
  scheduledStartDate: z.date().optional(),
  dueDate: z.date().optional(),
  batchMode: z.boolean().default(false),
  autoReserveMaterials: z.boolean().default(true),
  notes: z.string().max(2000).optional(),
});

export type ReleaseToProductionInput = z.infer<typeof releaseToProductionSchema>;

// ────────────────────────────────────────────────────────────────────────────
// STEP MATERIAL CONSUMPTION (form)
// ────────────────────────────────────────────────────────────────────────────

export const stepMaterialConsumptionSchema = z.object({
  inventoryItemId: z.string().min(1),
  materialName: z.string().min(1),
  quantityConsumed: z.number().positive('Quantity must be positive'),
  unit: z.string().min(1),
  wasteQuantity: z.number().nonnegative().optional(),
  wasteReason: z.string().optional(),
});

export type StepMaterialConsumptionInput = z.infer<typeof stepMaterialConsumptionSchema>;
