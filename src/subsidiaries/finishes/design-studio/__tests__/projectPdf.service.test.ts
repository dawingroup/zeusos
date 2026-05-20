/**
 * Project PDF Service Tests
 *
 * Tests data preparation for PDF generation.
 * Actual PDF rendering requires browser/node canvas — tested via integration.
 */
import { describe, it, expect } from 'vitest';
import { projectPdfRequestSchema } from '../schemas/projectPdf.schemas';

describe('projectPdf', () => {
  describe('projectPdfRequestSchema', () => {
    it('validates a valid detailed request', () => {
      const result = projectPdfRequestSchema.safeParse({
        sceneId: 'scene-123',
        sections: ['cover', 'project_summary', 'cabinet_detail', 'project_cutlist'],
        includeAssemblyDrawings: false,
        includeRenders: true,
        renderQuality: 'standard',
        layout: 'detailed',
      });
      expect(result.success).toBe(true);
    });

    it('validates a workshop layout', () => {
      const result = projectPdfRequestSchema.safeParse({
        sceneId: 'scene-123',
        sections: ['project_cutlist', 'project_hardware_schedule'],
        includeAssemblyDrawings: false,
        includeRenders: false,
        renderQuality: 'standard',
        layout: 'workshop',
      });
      expect(result.success).toBe(true);
    });

    it('validates a client presentation layout', () => {
      const result = projectPdfRequestSchema.safeParse({
        sceneId: 'scene-123',
        sections: ['cover', 'project_summary'],
        includeAssemblyDrawings: false,
        includeRenders: true,
        renderQuality: 'high',
        layout: 'client_presentation',
        customer: { name: 'John Mukasa', address: 'Kampala' },
        notes: 'Final presentation version',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty sceneId', () => {
      const result = projectPdfRequestSchema.safeParse({
        sceneId: '',
        sections: ['cover'],
        includeAssemblyDrawings: false,
        includeRenders: false,
        renderQuality: 'standard',
        layout: 'detailed',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty sections array', () => {
      const result = projectPdfRequestSchema.safeParse({
        sceneId: 'scene-123',
        sections: [],
        includeAssemblyDrawings: false,
        includeRenders: false,
        renderQuality: 'standard',
        layout: 'detailed',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid layout', () => {
      const result = projectPdfRequestSchema.safeParse({
        sceneId: 'scene-123',
        sections: ['cover'],
        includeAssemblyDrawings: false,
        includeRenders: false,
        renderQuality: 'standard',
        layout: 'invalid_layout',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid render quality', () => {
      const result = projectPdfRequestSchema.safeParse({
        sceneId: 'scene-123',
        sections: ['cover'],
        includeAssemblyDrawings: false,
        includeRenders: false,
        renderQuality: 'ultra',
        layout: 'detailed',
      });
      expect(result.success).toBe(false);
    });

    it('accepts optional customer and notes', () => {
      const result = projectPdfRequestSchema.safeParse({
        sceneId: 'scene-123',
        sections: ['cover'],
        includeAssemblyDrawings: false,
        includeRenders: false,
        renderQuality: 'standard',
        layout: 'detailed',
      });
      expect(result.success).toBe(true);
    });
  });
});
