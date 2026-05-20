/**
 * Part Processing Service Tests
 */
import { describe, it, expect } from 'vitest';
import {
  computePartCutList,
  groupPartsByMaterial,
  estimateSheetCount,
  extractHardwareSchedule,
  validatePartProcessability,
  bulkValidateParts,
} from '../services/partProcessing.service';
import type { ScenePart } from '../types/assembly.types';

const makePart = (overrides: Partial<ScenePart> = {}): ScenePart => ({
  id: `part-${Math.random().toString(36).slice(2, 6)}`,
  assemblyId: 'asm-1',
  cabinetId: 'cab-1',
  partCode: 'P1',
  partName: 'Test Panel',
  partCategory: 'panel',
  inventoryItemId: 'inv-board-18',
  inventoryItemName: '18mm MFC',
  quantity: 1,
  unit: 'pcs',
  unitCost: 100,
  totalCost: 100,
  currency: 'UGX',
  materialDescription: '18mm MFC White',
  dimensions: { length: 720, width: 560, thickness: 18, grainDirection: 'length' as const },
  ...overrides,
});

describe('partProcessing.service', () => {
  describe('computePartCutList', () => {
    it('converts panel to CutListEntry', () => {
      const part = makePart();
      const entry = computePartCutList(part);

      expect(entry).not.toBeNull();
      expect(entry!.length).toBe(720);
      expect(entry!.width).toBe(560);
      expect(entry!.thickness).toBe(18);
      expect(entry!.grainDirection).toBe('length');
    });

    it('returns null for non-panel parts', () => {
      const part = makePart({ partCategory: 'hardware', dimensions: undefined });
      expect(computePartCutList(part)).toBeNull();
    });
  });

  describe('groupPartsByMaterial', () => {
    it('groups panels by inventoryItemId + finishLibraryId', () => {
      const parts = [
        makePart({ inventoryItemId: 'board-18', finishLibraryId: 'white' }),
        makePart({ inventoryItemId: 'board-18', finishLibraryId: 'white' }),
        makePart({ inventoryItemId: 'board-18', finishLibraryId: 'oak' }),
        makePart({ inventoryItemId: 'mdf-8', finishLibraryId: undefined }),
      ];

      const groups = groupPartsByMaterial(parts);
      expect(groups.size).toBe(3);
    });

    it('skips non-panel parts', () => {
      const parts = [
        makePart({ partCategory: 'hardware' }),
        makePart({ partCategory: 'panel' }),
      ];
      const groups = groupPartsByMaterial(parts);
      expect(groups.size).toBe(1);
    });
  });

  describe('estimateSheetCount', () => {
    it('estimates sheets from total area + wastage', () => {
      // 4 panels of 720×560 = 4 × 0.4032 = 1.6128 m²
      // Sheet 2750×1830 = 5.0325 m², with 10% waste → 4.529 usable
      // 1.6128 * 1.1 / 5.0325 ≈ 0.35 → ceil = 1
      const parts = Array.from({ length: 4 }, () => makePart());
      const count = estimateSheetCount(parts, { length: 2750, width: 1830 }, 10);
      expect(count).toBe(1);
    });

    it('returns 0 for empty parts', () => {
      expect(estimateSheetCount([], { length: 2750, width: 1830 })).toBe(0);
    });
  });

  describe('extractHardwareSchedule', () => {
    it('groups hardware parts by inventoryItemId', () => {
      const parts = [
        makePart({ partCategory: 'hardware', inventoryItemId: 'hinge-1', inventoryItemName: 'Hinge', quantity: 2 }),
        makePart({ partCategory: 'hardware', inventoryItemId: 'hinge-1', inventoryItemName: 'Hinge', quantity: 2 }),
        makePart({ partCategory: 'fastener', inventoryItemId: 'cam-lock', inventoryItemName: 'Cam Lock', quantity: 8 }),
      ];

      const schedule = extractHardwareSchedule(parts);
      expect(schedule.length).toBe(2);
      const hinges = schedule.find(h => h.inventoryItemId === 'hinge-1');
      expect(hinges?.quantity).toBe(4);
    });
  });

  describe('validatePartProcessability', () => {
    it('passes for valid panel', () => {
      const { processable, issues } = validatePartProcessability(makePart());
      expect(processable).toBe(true);
      expect(issues).toHaveLength(0);
    });

    it('fails for panel missing dimensions', () => {
      const { processable, issues } = validatePartProcessability(makePart({ dimensions: undefined }));
      expect(processable).toBe(false);
      expect(issues.some(i => i.includes('dimensions'))).toBe(true);
    });

    it('fails for part missing inventory item', () => {
      const { processable } = validatePartProcessability(makePart({ inventoryItemId: '' }));
      expect(processable).toBe(false);
    });

    it('fails for panel exceeding max sheet size', () => {
      const { processable, issues } = validatePartProcessability(
        makePart({ dimensions: { length: 3000, width: 560, thickness: 18, grainDirection: 'length' } }),
      );
      expect(processable).toBe(false);
      expect(issues.some(i => i.includes('exceeds'))).toBe(true);
    });
  });

  describe('bulkValidateParts', () => {
    it('returns ready when all parts are valid', () => {
      const { ready } = bulkValidateParts({ 'cab-1': [makePart(), makePart()] });
      expect(ready).toBe(true);
    });

    it('returns issues grouped by cabinet', () => {
      const { ready, issuesByCabinet } = bulkValidateParts({
        'cab-1': [makePart(), makePart({ dimensions: undefined })],
        'cab-2': [makePart()],
      });
      expect(ready).toBe(false);
      expect(issuesByCabinet['cab-1']).toBeDefined();
      expect(issuesByCabinet['cab-2']).toBeUndefined();
    });
  });
});
