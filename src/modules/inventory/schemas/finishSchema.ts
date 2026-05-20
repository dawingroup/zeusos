/**
 * Zod Validation Schemas for Finish Library & Attribute System
 */

import { z } from 'zod';

// ============================================
// Finish Document Schema
// ============================================

export const finishDocumentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  code: z.string()
    .min(1, 'Code is required')
    .max(20)
    .regex(/^[A-Z0-9-]+$/, 'Code must be uppercase alphanumeric with hyphens'),
  category: z.enum([
    'board', 'paint', 'tile', 'laminate', 'veneer',
    'fabric', 'metal', 'stone', 'glass', 'custom',
  ]),
  subtype: z.string().min(1, 'Subtype is required'),
  hexColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color').optional().or(z.literal('')),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().or(z.literal('')),
  patternType: z.enum([
    'solid', 'woodgrain', 'marble', 'textile', 'geometric', 'speckled', 'custom',
  ]).optional(),
  costModifier: z.number().optional(),
  costModifierType: z.enum(['percentage', 'absolute']).optional(),
  costModifierUnit: z.string().optional(),
  availability: z.enum(['in_stock', 'made_to_order', 'discontinued', 'seasonal']),
  tags: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  notes: z.string().max(500).optional(),
}).refine(
  (data) => data.costModifierType !== 'absolute' || !!data.costModifierUnit,
  { message: 'costModifierUnit is required when type is absolute', path: ['costModifierUnit'] }
);

export type FinishDocumentFormData = z.infer<typeof finishDocumentSchema>;

// ============================================
// Product Finish Config Schema
// ============================================

export const productFinishConfigSchema = z.object({
  finishCategory: z.enum([
    'board', 'paint', 'tile', 'laminate', 'veneer',
    'fabric', 'metal', 'stone', 'glass', 'custom',
  ]).optional(),
  finishSubtype: z.string().optional(),
  requiredAttributes: z.array(z.string()).optional(),
  attributeConstraints: z.record(
    z.string(),
    z.array(z.union([z.string(), z.number(), z.boolean()]))
  ).optional(),
});

export type ProductFinishConfigFormData = z.infer<typeof productFinishConfigSchema>;

// ============================================
// Attribute Definition Schema
// ============================================

export const attributeDefinitionSchema = z.object({
  key: z.string()
    .min(1, 'Key is required')
    .max(50)
    .regex(/^[a-z][a-z0-9_]*$/, 'Key must be lowercase with underscores'),
  label: z.string().min(1, 'Label is required').max(100),
  type: z.enum(['string', 'number', 'boolean', 'enum', 'number_array']),
  enumValues: z.array(z.union([z.string(), z.number()])).optional(),
  unit: z.string().max(20).optional(),
  required: z.boolean().default(false),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  category: z.array(z.enum([
    'board', 'paint', 'tile', 'laminate', 'veneer',
    'fabric', 'metal', 'stone', 'glass', 'custom',
  ])).min(1, 'At least one category is required'),
  subtype: z.array(z.string()).optional(),
  sortOrder: z.number().int().min(0).default(0),
  validationMin: z.number().optional(),
  validationMax: z.number().optional(),
}).refine(
  (data) => data.type !== 'enum' || (data.enumValues && data.enumValues.length > 0),
  { message: 'Enum values are required for enum type', path: ['enumValues'] }
);

export type AttributeDefinitionFormData = z.infer<typeof attributeDefinitionSchema>;
