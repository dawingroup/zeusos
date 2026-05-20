/**
 * Zod validation schemas for Product Definition Documents
 */
import { z } from 'zod';
import {
  PRODUCT_TYPES,
  DESIGN_ORIGINS,
  CONSTRAINT_ACTIONS,
  PDD_STATUSES,
} from '../constants/productDefinition.constants';

const constraintSchema = z.object({
  id: z.string().min(1),
  condition: z.string().min(1, 'Constraint condition is required'),
  action: z.enum(CONSTRAINT_ACTIONS),
  reason: z.string().min(1, 'Constraint reason is required'),
  affectedParameters: z.array(z.string()).min(1),
  isActive: z.boolean().default(true),
});

const inventoryBindingSchema = z
  .object({
    bomTemplateLineKey: z.string().min(1),
    inventoryItemId: z.string().optional(),
    inventoryFamilyId: z.string().optional(),
    category: z.string().min(1),
    quantityMultiplier: z.number().positive(),
    wastagePercent: z.number().min(0).max(100),
  })
  .refine((data) => data.inventoryItemId || data.inventoryFamilyId, {
    message: 'Either inventoryItemId or inventoryFamilyId must be provided',
    path: ['inventoryItemId'],
  });

const pricingConfigSchema = z.object({
  estimationEngineRef: z.string().min(1),
  laborComplexityFormula: z.string().min(1),
  overheadPercent: z.number().min(0).max(100),
  marginPercent: z.number().min(0).max(100),
  taxConfig: z.object({
    vatApplicable: z.boolean(),
    whtApplicable: z.boolean(),
  }),
  currencyOverride: z.enum(['UGX', 'USD']).optional(),
});

const clientFacingConfigSchema = z.object({
  exposedParameters: z.array(z.string()),
  parameterLabels: z.record(z.string(), z.string()),
  parameterHelpText: z.record(z.string(), z.string()),
  finishGroupLabels: z.record(z.string(), z.string()),
  showPriceEstimate: z.boolean().default(true),
  showStockAvailability: z.boolean().default(true),
  allowARPreview: z.boolean().default(false),
  shareableUrl: z.boolean().default(true),
});

const manufacturingOutputConfigSchema = z.object({
  generateCutList: z.boolean().default(true),
  cutListFormat: z.enum(['csv', 'pdf', 'polyboard_native']).default('csv'),
  generateEdgeBandingSchedule: z.boolean().default(true),
  generateHardwareSchedule: z.boolean().default(true),
  generateCNCProgram: z.boolean().default(false),
  generateAssemblyInstructions: z.boolean().default(false),
  generateDrawingPackage: z.boolean().default(true),
});

const parameterDefinitionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['number', 'select', 'boolean']),
  default: z.unknown(),
  options: z
    .array(z.object({ label: z.string(), value: z.unknown() }))
    .optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  unit: z.string().optional(),
  affectsBom: z.boolean().optional(),
});

const bomTemplateLineSchema = z.object({
  materialCategory: z.string().min(1),
  quantityExpression: z.string().min(1),
  unit: z.string().min(1),
  isVariantDriven: z.boolean(),
  finishAttributeKey: z.string().optional(),
});

/** Schema for creating a new PDD */
export const createPddSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.enum(['seating', 'casegoods', 'tables', 'beds', 'fitout', 'custom']),
  productType: z.enum(PRODUCT_TYPES),
  designOrigin: z.enum(DESIGN_ORIGINS),
  description: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  parameters: z.array(parameterDefinitionSchema),
  scriptStoragePath: z.string().min(1),
  defaultFinishMappings: z.record(z.string(), z.string()),
  bomTemplate: z.array(bomTemplateLineSchema),
  classification: z.string().min(1),
  constraints: z.array(constraintSchema).default([]),
  validFinishes: z.array(z.string()).default([]),
  inventoryBindings: z.record(z.string(), inventoryBindingSchema).default({}),
  pricingConfig: pricingConfigSchema,
  clientFacingConfig: clientFacingConfigSchema,
  dkbArchetypeId: z.string().optional(),
  manufacturingOutputConfig: manufacturingOutputConfigSchema,
});

/** Schema for updating an existing PDD (all fields optional) */
export const updatePddSchema = createPddSchema.partial().extend({
  status: z.enum(PDD_STATUSES).optional(),
});

/** Inferred types from schemas */
export type CreatePddInput = z.infer<typeof createPddSchema>;
export type UpdatePddInput = z.infer<typeof updatePddSchema>;
