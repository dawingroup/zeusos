/**
 * Knowledge Base Service Tests
 *
 * Tests DKB queries, archetype resolution, material rules,
 * and hardware lookups via mocked Firestore.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firestore
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, name: string) => name),
  doc: vi.fn((_db: unknown, _col: string, id: string) => id),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: vi.fn((...args: unknown[]) => args),
  where: vi.fn((field: string, op: string, val: unknown) => ({ field, op, val })),
  orderBy: vi.fn((field: string) => ({ orderBy: field })),
  limit: vi.fn((n: number) => ({ limit: n })),
}));

vi.mock('@/firebase/config', () => ({
  db: {},
}));

import {
  getEntry,
  searchEntries,
  getArchetypeForProduct,
  getMaterialRules,
  getHardwareForComponent,
  getComponentsForPattern,
} from '../services/knowledgeBase.service';

describe('knowledgeBase.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getEntry', () => {
    it('returns entry when document exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'comp-shelf',
        data: () => ({
          entryType: 'component',
          name: 'Shelf Panel',
          description: 'A standard shelf panel',
          tags: ['shelf', 'panel'],
          isActive: true,
        }),
      });

      const result = await getEntry('comp-shelf');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('comp-shelf');
      expect(result?.name).toBe('Shelf Panel');
    });

    it('returns null when document does not exist', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await getEntry('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('searchEntries', () => {
    it('filters entries by text query', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: 'comp-shelf',
            data: () => ({
              entryType: 'component',
              name: 'Shelf Panel',
              description: 'A horizontal shelf',
              tags: ['shelf'],
              isActive: true,
            }),
          },
          {
            id: 'comp-door',
            data: () => ({
              entryType: 'component',
              name: 'Door Panel',
              description: 'A cabinet door',
              tags: ['door'],
              isActive: true,
            }),
          },
        ],
      });

      const results = await searchEntries('shelf');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Shelf Panel');
    });

    it('matches on tags', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: 'hw-hinge',
            data: () => ({
              entryType: 'hardware_spec',
              name: 'Blum Clip-Top',
              description: 'Soft-close hinge',
              tags: ['hinge', 'blum', 'soft-close'],
              isActive: true,
            }),
          },
        ],
      });

      const results = await searchEntries('blum');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('hw-hinge');
    });

    it('returns empty when no matches', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const results = await searchEntries('nonexistent');
      expect(results).toHaveLength(0);
    });
  });

  describe('getArchetypeForProduct', () => {
    it('returns matching archetype from direct search', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: 'arch-base-600',
            data: () => ({
              entryType: 'product_archetype',
              name: 'Kitchen Base 600',
              description: 'Standard 600mm kitchen base cabinet',
              tags: ['kitchen', 'base', 'cabinet'],
              isActive: true,
              productType: 'kitchen_cabinet',
              standardDimensions: {
                width: { min: 400, max: 900, default: 600, step: 50 },
                depth: { min: 500, max: 620, default: 560, step: 10 },
                height: { min: 700, max: 900, default: 720, step: 10 },
                unit: 'mm',
              },
              aiPromptContext: 'A standard kitchen base cabinet...',
            }),
          },
        ],
      });

      const result = await getArchetypeForProduct('kitchen base cabinet');
      expect(result).not.toBeNull();
      expect(result?.name).toBe('Kitchen Base 600');
    });

    it('returns null when no archetype matches', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await getArchetypeForProduct('alien spaceship');
      expect(result).toBeNull();
    });
  });

  describe('getMaterialRules', () => {
    it('returns rules matching finish+substrate pair', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: 'rule-veneer-mdf',
            data: () => ({
              entryType: 'material_rule',
              name: 'Veneer on MDF',
              description: 'Rules for veneering MDF panels',
              tags: ['veneer', 'mdf'],
              isActive: true,
              ruleCategory: 'finish_substrate',
              condition: 'substrate must be sealed',
              compatiblePairs: [{ a: 'veneer', b: 'mdf' }],
              incompatiblePairs: [],
            }),
          },
          {
            id: 'rule-lacquer-chipboard',
            data: () => ({
              entryType: 'material_rule',
              name: 'Lacquer on Chipboard',
              description: 'Rules for lacquer on chipboard',
              tags: ['lacquer', 'chipboard'],
              isActive: true,
              ruleCategory: 'finish_substrate',
              condition: 'not recommended',
              compatiblePairs: [],
              incompatiblePairs: [{ a: 'lacquer', b: 'chipboard', reason: 'poor adhesion' }],
            }),
          },
        ],
      });

      const results = await getMaterialRules('veneer', 'mdf');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('rule-veneer-mdf');
    });

    it('matches pairs in reverse order', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: 'rule-veneer-mdf',
            data: () => ({
              entryType: 'material_rule',
              name: 'Veneer on MDF',
              description: 'Rules for veneering MDF panels',
              tags: ['veneer', 'mdf'],
              isActive: true,
              ruleCategory: 'finish_substrate',
              condition: 'substrate must be sealed',
              compatiblePairs: [{ a: 'veneer', b: 'mdf' }],
              incompatiblePairs: [],
            }),
          },
        ],
      });

      // Pass in reverse order — should still match
      const results = await getMaterialRules('mdf', 'veneer');
      expect(results).toHaveLength(1);
    });
  });

  describe('getComponentsForPattern', () => {
    it('resolves components from assembly pattern', async () => {
      // First call: getEntry for the pattern
      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'pattern-base-cabinet',
          data: () => ({
            entryType: 'assembly_pattern',
            name: 'Base Cabinet Assembly',
            components: [
              { role: 'side_panel', componentEntryId: 'comp-side', quantity: 2, isOptional: false },
              { role: 'shelf', componentEntryId: 'comp-shelf', quantity: 1, isOptional: true },
            ],
            connections: [],
            assemblySequence: ['side_panel', 'shelf'],
            structuralNotes: '',
          }),
        })
        // Second call: getEntry for comp-side
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'comp-side',
          data: () => ({
            entryType: 'component',
            name: 'Side Panel',
            description: 'Cabinet side',
            tags: ['side'],
            isActive: true,
          }),
        })
        // Third call: getEntry for comp-shelf
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'comp-shelf',
          data: () => ({
            entryType: 'component',
            name: 'Shelf Panel',
            description: 'Shelf',
            tags: ['shelf'],
            isActive: true,
          }),
        });

      const components = await getComponentsForPattern('pattern-base-cabinet');
      expect(components).toHaveLength(2);
      expect(components[0].name).toBe('Side Panel');
      expect(components[1].name).toBe('Shelf Panel');
    });

    it('returns empty array for non-pattern entry', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'comp-shelf',
        data: () => ({
          entryType: 'component',
          name: 'Shelf',
        }),
      });

      const components = await getComponentsForPattern('comp-shelf');
      expect(components).toHaveLength(0);
    });
  });

  describe('getHardwareForComponent', () => {
    it('returns matching hardware specs', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'comp-door',
        data: () => ({
          entryType: 'component',
          name: 'Door Panel',
          hardwareRequirements: [
            { hardwareFamily: 'hinge', quantityPer: 2 },
          ],
        }),
      });

      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: 'hw-hinge',
            data: () => ({
              entryType: 'hardware_spec',
              name: 'Blum Clip-Top',
              hardwareFamily: 'hinge',
              isActive: true,
            }),
          },
          {
            id: 'hw-slide',
            data: () => ({
              entryType: 'hardware_spec',
              name: 'Blum Tandembox',
              hardwareFamily: 'drawer_slide',
              isActive: true,
            }),
          },
        ],
      });

      const hardware = await getHardwareForComponent('comp-door');
      expect(hardware).toHaveLength(1);
      expect(hardware[0].name).toBe('Blum Clip-Top');
    });
  });
});
