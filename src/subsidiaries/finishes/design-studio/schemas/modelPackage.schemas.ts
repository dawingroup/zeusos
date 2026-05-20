/**
 * ModelPackage Zod Schemas
 */
import { z } from 'zod';

export const modelGroupingSchema = z.object({
  source: z.enum(['ai', 'heuristic', 'manual']),
  model: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  assemblies: z.array(z.unknown()),
  parts: z.array(z.unknown()),
  unmapped: z.array(z.object({
    meshName: z.string(),
    reason: z.string(),
  })),
});

export const modelMaterialsSchema = z.object({
  source: z.enum(['ai', 'exact', 'fuzzy', 'manual']),
  mappings: z.array(z.object({
    threeDSName: z.string(),
    threeDSColor: z.string().optional(),
    finishLibraryId: z.string(),
    finishLibraryName: z.string(),
    finishCategory: z.string().optional(),
    confidence: z.number().min(0).max(1),
    matchedOn: z.enum(['code', 'name', 'fuzzy_name', 'fuzzy_code', 'color', 'manual']),
  })),
  unresolved: z.array(z.object({
    materialName: z.string(),
    reason: z.string(),
  })),
});

export const modelRendersSchema = z.object({
  thumbnail: z.string().optional(),
  productCatalog: z.string().optional(),
  isometric: z.string().optional(),
  walkthrough: z.object({
    front: z.string().optional(),
    side: z.string().optional(),
    top: z.string().optional(),
  }).optional(),
});

export const createModelPackageSchema = z.object({
  sourceType: z.enum(['cabinet', 'design-item', 'session']),
  sourceId: z.string().min(1),
  sceneId: z.string().min(1),
  cabinetId: z.string().min(1),
  modelRef: z.object({
    fileName: z.string().optional(),
    fileType: z.enum(['3ds', 'dxf', 'glb', 'csv', 'unknown']),
    fileSize: z.number().optional(),
    glbUrl: z.string().optional(),
    cutlistUrl: z.string().optional(),
  }),
  grouping: modelGroupingSchema,
  materials: modelMaterialsSchema,
  renders: modelRendersSchema,
  context: z.object({
    archetypeId: z.string().optional(),
    furnitureTypeId: z.string().optional(),
    projectId: z.string().optional(),
    customerId: z.string().optional(),
  }),
});

export type CreateModelPackageInput = z.infer<typeof createModelPackageSchema>;
