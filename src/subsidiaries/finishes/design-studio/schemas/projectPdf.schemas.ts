/**
 * Project PDF Zod Schemas
 */
import { z } from 'zod';
import { PDF_SECTION_TYPES } from '../constants/projectPdf.constants';

export const projectPdfRequestSchema = z.object({
  sceneId: z.string().min(1),
  sections: z.array(z.enum(PDF_SECTION_TYPES as unknown as [string, ...string[]])).min(1),
  includeAssemblyDrawings: z.boolean(),
  includeRenders: z.boolean(),
  renderQuality: z.enum(['standard', 'high']),
  layout: z.enum(['detailed', 'workshop', 'client_presentation']),
  customer: z.object({
    name: z.string().min(1),
    address: z.string(),
  }).optional(),
  notes: z.string().max(2000).optional(),
});

export type ProjectPDFRequestInput = z.infer<typeof projectPdfRequestSchema>;
