/**
 * AI Assembly Grouper Service Tests
 *
 * Tests heuristic fallback + grouping validation.
 * The AI path itself is mocked — actual Claude calls happen in the Cloud Function.
 */
import { describe, it, expect, vi } from 'vitest';
import { validateGrouping } from '../services/aiAssemblyGrouper.service';
import type { ModelGrouping } from '../types/modelPackage.types';
import type { ParsedModel } from '../types/workshop-viewer.types';

// Mock the firebase functions import so the module loads without Firebase
vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => vi.fn()),
}));

vi.mock('@/firebase/config', () => ({
  functions: {},
}));

const mockParsedModel = (meshNames: string[]): ParsedModel => ({
  name: 'test-model',
  objects: meshNames.map(n => ({
    name: n,
    vertices: new Float32Array(0),
    indices: new Uint32Array(0),
    normals: new Float32Array(0),
    uvs: new Float32Array(0),
  })) as unknown as ParsedModel['objects'],
  materials: {},
  metadata: {},
} as unknown as ParsedModel);

describe('aiAssemblyGrouper', () => {
  describe('validateGrouping', () => {
    it('reports missing meshes as issues', () => {
      const parsedModel = mockParsedModel(['side_L', 'side_R', 'bottom', 'orphan']);
      const grouping: ModelGrouping = {
        source: 'ai',
        model: 'test',
        confidence: 0.9,
        reasoning: 'test',
        assemblies: [{
          id: 'a1',
          cabinetId: 'c1',
          assemblyType: 'carcass',
          assemblyCode: 'carcass-1',
          displayName: 'Carcass',
          parts: [],
          meshNodeIds: ['side_L', 'side_R', 'bottom'],
          boundingBox: { min:{x:0,y:0,z:0}, max:{x:0,y:0,z:0}, center:{x:0,y:0,z:0}, size:{x:0,y:0,z:0} },
          jointSpec: [], assemblySequence: [],
          isComplete: true, totalPartCount: 3, totalArea: 0, totalCost: 0, sequence: 0,
        }],
        parts: [],
        unmapped: [],
      };

      const result = validateGrouping(grouping, parsedModel);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0]).toContain('orphan');
    });

    it('passes when all meshes are assigned', () => {
      const parsedModel = mockParsedModel(['side_L', 'side_R']);
      const grouping: ModelGrouping = {
        source: 'ai',
        model: 'test',
        confidence: 0.9,
        reasoning: 'test',
        assemblies: [{
          id: 'a1',
          cabinetId: 'c1',
          assemblyType: 'carcass',
          assemblyCode: 'carcass-1',
          displayName: 'Carcass',
          parts: [],
          meshNodeIds: ['side_L', 'side_R'],
          boundingBox: { min:{x:0,y:0,z:0}, max:{x:0,y:0,z:0}, center:{x:0,y:0,z:0}, size:{x:0,y:0,z:0} },
          jointSpec: [], assemblySequence: [],
          isComplete: true, totalPartCount: 2, totalArea: 0, totalCost: 0, sequence: 0,
        }],
        parts: [],
        unmapped: [],
      };

      const result = validateGrouping(grouping, parsedModel);
      expect(result.issues).toHaveLength(0);
    });

    it('warns when confidence is low', () => {
      const parsedModel = mockParsedModel([]);
      const grouping: ModelGrouping = {
        source: 'heuristic',
        model: 'test',
        confidence: 0.3,
        reasoning: 'low confidence',
        assemblies: [],
        parts: [],
        unmapped: [],
      };

      const result = validateGrouping(grouping, parsedModel);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('confidence');
    });

    it('counts unmapped meshes as assigned', () => {
      const parsedModel = mockParsedModel(['side_L', 'weird_mesh']);
      const grouping: ModelGrouping = {
        source: 'ai',
        model: 'test',
        confidence: 0.9,
        reasoning: 'test',
        assemblies: [{
          id: 'a1', cabinetId: 'c1', assemblyType: 'carcass',
          assemblyCode: 'carcass-1', displayName: 'Carcass',
          parts: [], meshNodeIds: ['side_L'],
          boundingBox: { min:{x:0,y:0,z:0}, max:{x:0,y:0,z:0}, center:{x:0,y:0,z:0}, size:{x:0,y:0,z:0} },
          jointSpec: [], assemblySequence: [],
          isComplete: true, totalPartCount: 1, totalArea: 0, totalCost: 0, sequence: 0,
        }],
        parts: [],
        unmapped: [{ meshName: 'weird_mesh', reason: 'Unclear role' }],
      };

      const result = validateGrouping(grouping, parsedModel);
      expect(result.issues).toHaveLength(0);
    });
  });
});
