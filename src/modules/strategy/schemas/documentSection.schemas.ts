// ============================================================================
// DOCUMENT SECTION SCHEMAS - Strategy Plan Update Tool
// Zod validation schemas for document sections and assessments
// ============================================================================

import { z } from 'zod';

// ----------------------------------------------------------------------------
// Section Type & Status Enums
// ----------------------------------------------------------------------------

export const sectionTypeSchema = z.enum([
  'financial',
  'market',
  'operations',
  'growth',
  'risk',
  'people',
  'governance',
  'general',
]);

export const rewriteStatusSchema = z.enum([
  'none',
  'pending_review',
  'approved',
  'rejected',
  'applied',
]);

export const changeTypeSchema = z.enum([
  'rewrite',
  'minor_edit',
  'assessment_only',
  'manual_edit',
  'new_section',
  'removed',
]);

export const triggerTypeSchema = z.enum([
  'automated',
  'manual',
  'scheduled',
]);

// ----------------------------------------------------------------------------
// Document Section Create Schema
// Used when parsing and storing sections from uploaded documents
// ----------------------------------------------------------------------------

export const documentSectionCreateSchema = z.object({
  sectionIndex: z.number().int().min(0),
  headingText: z.string().min(1, 'Heading text is required').max(500),
  headingLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  parentSectionId: z.string().nullable().default(null),
  content: z.string().min(1, 'Section content is required'),
  sectionType: sectionTypeSchema.default('general'),
  dataSourceMapping: z.array(z.string()).default([]),
  googleDocRange: z
    .object({
      startIndex: z.number().int().min(0),
      endIndex: z.number().int().min(0),
    })
    .nullable()
    .default(null),
});

export type DocumentSectionCreateInput = z.infer<typeof documentSectionCreateSchema>;

// ----------------------------------------------------------------------------
// Section Rewrite Schema
// Used when submitting a rewrite for a section
// ----------------------------------------------------------------------------

export const sectionRewriteSchema = z.object({
  sectionId: z.string().min(1),
  rewriteContent: z.string().min(1, 'Rewrite content is required'),
  rationale: z.string().max(1000).optional(),
});

export type SectionRewriteInput = z.infer<typeof sectionRewriteSchema>;

// ----------------------------------------------------------------------------
// Assessment Options Schema
// Used when configuring a full assessment cycle
// ----------------------------------------------------------------------------

export const assessmentOptionsSchema = z.object({
  rewriteThreshold: z.number().int().min(1).max(5).default(3),
  autoApplyRewrites: z.boolean().default(false),
  sectionIds: z.array(z.string()).optional(),
  skipTypes: z.array(sectionTypeSchema).optional(),
});

export type AssessmentOptionsInput = z.infer<typeof assessmentOptionsSchema>;
