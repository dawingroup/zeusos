/**
 * Zod validation schemas for Design Knowledge Base entries
 *
 * Used by both the Firestore runtime API and the wiki compiler.
 */
import { z } from 'zod';
import {
  DKB_ENTRY_TYPES,
  COMPONENT_CATEGORIES,
  STANDARD_PANEL_THICKNESSES_MM,
} from '../constants/knowledgeBase.constants';
import { PRODUCT_TYPES } from '../constants/productDefinition.constants';

const dimensionAxisSchema = z.object({
  min: z.number().positive(),
  max: z.number().positive(),
  default: z.number().positive(),
  step: z.number().positive(),
}).refine(d => d.min < d.max, { message: 'min must be less than max' })
  .refine(d => d.default >= d.min && d.default <= d.max, { message: 'default must be within min/max' });

const dimensionRangeSchema = z.object({
  width: dimensionAxisSchema,
  depth: dimensionAxisSchema,
  height: dimensionAxisSchema,
  unit: z.literal('mm'),
});

const componentMaterialSchema = z.object({
  role: z.string().min(1),
  defaultThicknessMm: z.number().refine(
    (v) => (STANDARD_PANEL_THICKNESSES_MM as readonly number[]).includes(v),
    { message: `Thickness must be one of ${STANDARD_PANEL_THICKNESSES_MM.join(', ')}mm` }
  ),
  compatibleCategories: z.array(z.string()).min(1),
  compatibleFinishCategories: z.array(z.string()).min(1),
});

const componentHardwareSchema = z.object({
  hardwareFamily: z.string().min(1),
  quantityPer: z.number().positive(),
  defaultInventoryItemId: z.string().optional(),
  boringSpec: z.object({
    diameter: z.number().positive(),
    depth: z.number().positive(),
    offsetFromEdge: z.number().positive(),
    pattern: z.enum(['single', 'line_32mm', 'custom']),
    positions: z.array(z.number()).optional(),
  }).optional(),
});

const edgeBandingRuleSchema = z.object({
  edge: z.enum(['top', 'bottom', 'left', 'right', 'front']),
  required: z.boolean(),
  defaultType: z.string().min(1),
  matchFinish: z.boolean(),
});

const jointSpecSchema = z.object({
  type: z.string().min(1),
  connectsTo: z.array(z.string()).min(1),
  notes: z.string().optional(),
});

/** Component entry schema */
export const createComponentSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  tags: z.array(z.string()).min(1),
  componentCategory: z.enum(COMPONENT_CATEGORIES),
  dimensions: dimensionRangeSchema,
  materialRequirements: z.array(componentMaterialSchema).min(1),
  hardwareRequirements: z.array(componentHardwareSchema).default([]),
  edgeBandingRules: z.array(edgeBandingRuleSchema).default([]),
  jointTypes: z.array(jointSpecSchema).default([]),
  cadQuerySnippet: z.string().optional(),
});

/** Product archetype entry schema */
export const createArchetypeSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  tags: z.array(z.string()).min(1),
  productType: z.enum(PRODUCT_TYPES),
  standardDimensions: dimensionRangeSchema,
  assemblyPatternId: z.string().min(1),
  defaultFinishCategory: z.string().min(1),
  typicalHardware: z.array(z.object({
    family: z.string().min(1),
    quantity: z.number().positive(),
    inventoryItemId: z.string().optional(),
  })).default([]),
  bomEstimate: z.array(z.object({
    materialCategory: z.string().min(1),
    quantityExpression: z.string().min(1),
    unit: z.string().min(1),
  })).default([]),
  searchTerms: z.array(z.string()).min(1),
  aiPromptContext: z.string().min(50, 'AI prompt context must be at least 50 characters'),
  constraints: z.array(z.object({
    id: z.string().min(1),
    condition: z.string().min(1),
    action: z.enum(['reject', 'warn', 'info']),
    reason: z.string().min(1),
    affectedParameters: z.array(z.string()).min(1),
    isActive: z.boolean().default(true),
  })).optional(),
});

/** Hardware spec entry schema */
export const createHardwareSpecSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  tags: z.array(z.string()).min(1),
  hardwareFamily: z.string().min(1),
  inventoryItemId: z.string().min(1),
  manufacturer: z.string().optional(),
  modelNumber: z.string().optional(),
  boringSpec: z.object({
    diameter: z.number().positive(),
    depth: z.number().positive(),
    offsetFromEdge: z.number().positive(),
    pattern: z.enum(['single', 'line_32mm', 'custom']),
    positions: z.array(z.number()).optional(),
  }),
  mountingClearances: z.object({
    top: z.number().min(0),
    bottom: z.number().min(0),
    side: z.number().min(0),
  }),
  weightCapacityKg: z.number().positive().optional(),
  compatibilityRules: z.array(z.string()).default([]),
});

/** Material rule entry schema */
export const createMaterialRuleSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  tags: z.array(z.string()).min(1),
  ruleCategory: z.enum(['finish_substrate', 'edge_board', 'adhesive_material', 'structural']),
  condition: z.string().min(1),
  compatiblePairs: z.array(z.object({ a: z.string(), b: z.string() })).default([]),
  incompatiblePairs: z.array(z.object({ a: z.string(), b: z.string(), reason: z.string() })).default([]),
}).refine(
  (data) => data.compatiblePairs.length > 0 || data.incompatiblePairs.length > 0,
  { message: 'At least one compatible or incompatible pair is required' }
);

/** Dimensional standard entry schema */
export const createDimensionalStandardSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  tags: z.array(z.string()).min(1),
  scope: z.enum(['industry', 'dawin', 'regional']),
  standardName: z.string().min(1),
  values: z.record(z.string(), z.number()).refine(
    (v) => Object.keys(v).length > 0,
    { message: 'Values must have at least one entry' }
  ),
  unit: z.literal('mm'),
  source: z.string().optional(),
});

/** Wiki article frontmatter schema */
export const wikiArticleSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'ID must be kebab-case'),
  title: z.string().min(1),
  category: z.string().min(1),
  tags: z.array(z.string()).min(1),
  sources: z.array(z.string()).default([]),
  related: z.array(z.string()).default([]),
  confidence: z.enum(['high', 'medium', 'low', 'draft']),
  lastCompiled: z.string().optional(),
  dkbEntryType: z.enum(DKB_ENTRY_TYPES).optional(),
});

export type CreateComponentInput = z.infer<typeof createComponentSchema>;
export type CreateArchetypeInput = z.infer<typeof createArchetypeSchema>;
export type CreateHardwareSpecInput = z.infer<typeof createHardwareSpecSchema>;
export type CreateMaterialRuleInput = z.infer<typeof createMaterialRuleSchema>;
export type CreateDimensionalStandardInput = z.infer<typeof createDimensionalStandardSchema>;
export type WikiArticleInput = z.infer<typeof wikiArticleSchema>;
