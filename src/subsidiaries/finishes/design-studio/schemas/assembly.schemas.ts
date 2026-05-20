/**
 * Assembly Zod Schemas — Validation for assembly and part operations
 */
import { z } from 'zod';
import { ASSEMBLY_TYPES, PART_CATEGORIES } from '../constants/assembly.constants';

/** Schema for creating an assembly */
export const createAssemblySchema = z.object({
  cabinetId: z.string().min(1),
  assemblyType: z.enum(ASSEMBLY_TYPES as unknown as [string, ...string[]]),
  assemblyCode: z.string().min(1).max(50),
  displayName: z.string().min(1).max(200),
  sequence: z.number().int().min(0).optional(),
});

/** Schema for creating a part */
export const createPartSchema = z.object({
  assemblyId: z.string().min(1),
  cabinetId: z.string().min(1),
  partCode: z.string().min(1).max(50),
  partName: z.string().min(1).max(200),
  partCategory: z.enum(PART_CATEGORIES as unknown as [string, ...string[]]),
  inventoryItemId: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  materialDescription: z.string().optional(),
  dimensions: z.object({
    length: z.number().positive(),
    width: z.number().positive(),
    thickness: z.number().positive(),
    grainDirection: z.enum(['length', 'width', 'none']),
  }).optional(),
  notes: z.string().max(1000).optional(),
});

/** Schema for bulk importing assemblies for a cabinet */
export const bulkAssemblyImportSchema = z.object({
  cabinetId: z.string().min(1),
  assemblies: z.array(createAssemblySchema.omit({ cabinetId: true })).min(1),
});

export type CreateAssemblyInput = z.infer<typeof createAssemblySchema>;
export type CreatePartInput = z.infer<typeof createPartSchema>;
export type BulkAssemblyImportInput = z.infer<typeof bulkAssemblyImportSchema>;
