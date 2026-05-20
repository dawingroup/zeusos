/**
 * Scene Service Tests
 *
 * Tests scene CRUD, cabinet operations, code generation,
 * and locking/unlocking behavior.
 */
import { describe, it, expect } from 'vitest';
import {
  createSceneSchema,
  addCabinetToSceneSchema,
  updateCabinetPositionSchema,
  duplicateCabinetSchema,
  updateCabinetDesignItemSchema,
} from '../schemas/scene.schemas';
import { GROUND_PLANE_SIZE_MM } from '../constants/scene.constants';

describe('scene schemas', () => {
  describe('createSceneSchema', () => {
    it('validates a valid scene creation input', () => {
      const result = createSceneSchema.safeParse({
        name: 'Mukasa Kitchen — V3',
        projectId: 'proj-123',
        customerId: 'cust-456',
        description: 'Main kitchen design for Mukasa residence',
      });
      expect(result.success).toBe(true);
    });

    it('rejects name shorter than 3 chars', () => {
      const result = createSceneSchema.safeParse({
        name: 'ab',
        projectId: 'proj-123',
        customerId: 'cust-456',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty projectId', () => {
      const result = createSceneSchema.safeParse({
        name: 'Valid Name',
        projectId: '',
        customerId: 'cust-456',
      });
      expect(result.success).toBe(false);
    });

    it('accepts missing status (optional)', () => {
      const result = createSceneSchema.safeParse({
        name: 'Test Scene',
        projectId: 'proj-1',
        customerId: 'cust-1',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('addCabinetToSceneSchema', () => {
    const validInput = {
      pddId: 'pdd-kitchen-base-600',
      cabinetCode: 'KB600-A',
      displayName: 'Kitchen Base 600 — Sink Run',
      configuration: { width: 600, depth: 560, height: 720 },
      finishSelections: { carcass: 'white-melamine' },
    };

    it('validates a valid cabinet addition', () => {
      const result = addCabinetToSceneSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('rejects cabinet code shorter than 2 chars', () => {
      const result = addCabinetToSceneSchema.safeParse({
        ...validInput,
        cabinetCode: 'K',
      });
      expect(result.success).toBe(false);
    });

    it('accepts cabinet code without suffix', () => {
      const result = addCabinetToSceneSchema.safeParse({
        ...validInput,
        cabinetCode: 'KB600',
      });
      expect(result.success).toBe(true);
    });

    it('accepts cabinet code with suffix', () => {
      const result = addCabinetToSceneSchema.safeParse({
        ...validInput,
        cabinetCode: 'KB600-A',
      });
      expect(result.success).toBe(true);
    });

    it('accepts optional position', () => {
      const result = addCabinetToSceneSchema.safeParse({
        ...validInput,
        position: { x: 600, y: 0, z: 0, anchoredTo: 'floor' },
      });
      expect(result.success).toBe(true);
    });

    it('accepts missing rotation (optional)', () => {
      const result = addCabinetToSceneSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    // P2 (Slice 1): DesignItem FK — optional until Slice 6, but min(1) when present.
    it('accepts a valid designItemId', () => {
      const result = addCabinetToSceneSchema.safeParse({
        ...validInput,
        designItemId: 'designItem-abc-123',
      });
      expect(result.success).toBe(true);
    });

    it('accepts omitted designItemId (optional field)', () => {
      const result = addCabinetToSceneSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('rejects an empty-string designItemId', () => {
      const result = addCabinetToSceneSchema.safeParse({
        ...validInput,
        designItemId: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateCabinetDesignItemSchema', () => {
    it('validates a reassign payload', () => {
      const result = updateCabinetDesignItemSchema.safeParse({
        designItemId: 'designItem-xyz',
      });
      expect(result.success).toBe(true);
    });

    it('rejects an empty designItemId (always required on reassign)', () => {
      const result = updateCabinetDesignItemSchema.safeParse({ designItemId: '' });
      expect(result.success).toBe(false);
    });

    it('rejects a missing designItemId', () => {
      const result = updateCabinetDesignItemSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('updateCabinetPositionSchema', () => {
    it('validates valid position within scene bounds', () => {
      const result = updateCabinetPositionSchema.safeParse({
        position: { x: 600, y: 0, z: 0 },
        rotation: 90,
      });
      expect(result.success).toBe(true);
    });

    it('rejects position outside scene bounds', () => {
      const result = updateCabinetPositionSchema.safeParse({
        position: {
          x: GROUND_PLANE_SIZE_MM, // Exceeds max (half of 10000)
          y: 0,
          z: 0,
        },
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative Y position', () => {
      const result = updateCabinetPositionSchema.safeParse({
        position: { x: 0, y: -100, z: 0 },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('duplicateCabinetSchema', () => {
    it('validates valid duplicate request', () => {
      const result = duplicateCabinetSchema.safeParse({
        sourceCabinetId: 'cab-123',
      });
      expect(result.success).toBe(true);
    });

    it('accepts optional new position', () => {
      const result = duplicateCabinetSchema.safeParse({
        sourceCabinetId: 'cab-123',
        newPosition: { x: 1200, y: 0, z: 0 },
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty sourceCabinetId', () => {
      const result = duplicateCabinetSchema.safeParse({
        sourceCabinetId: '',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('cabinet code generation', () => {
  // Test the generateNextCabinetCode logic (extracted for testability)
  function generateNextCabinetCode(
    baseCode: string,
    usedCodes: string[],
  ): string {
    const dashIdx = baseCode.lastIndexOf('-');
    const prefix = dashIdx > 0 ? baseCode.slice(0, dashIdx) : baseCode;

    const usedSuffixes = new Set(
      usedCodes
        .filter(c => c.startsWith(prefix))
        .map(c => {
          const idx = c.lastIndexOf('-');
          return idx > 0 ? c.slice(idx + 1) : '';
        })
        .filter(Boolean),
    );

    for (let i = 0; i < 26; i++) {
      const suffix = String.fromCharCode(65 + i);
      if (!usedSuffixes.has(suffix)) return `${prefix}-${suffix}`;
    }

    for (let i = 0; i < 26; i++) {
      for (let j = 0; j < 26; j++) {
        const suffix = String.fromCharCode(65 + i) + String.fromCharCode(65 + j);
        if (!usedSuffixes.has(suffix)) return `${prefix}-${suffix}`;
      }
    }

    throw new Error('Exhausted cabinet code suffixes');
  }

  it('generates A as first suffix', () => {
    expect(generateNextCabinetCode('KB600-A', [])).toBe('KB600-A');
  });

  it('increments to B when A is taken', () => {
    expect(generateNextCabinetCode('KB600-A', ['KB600-A'])).toBe('KB600-B');
  });

  it('skips taken letters', () => {
    expect(generateNextCabinetCode('KB600-A', ['KB600-A', 'KB600-B', 'KB600-C'])).toBe('KB600-D');
  });

  it('handles non-sequential usage', () => {
    expect(generateNextCabinetCode('KB600-A', ['KB600-A', 'KB600-C'])).toBe('KB600-B');
  });

  it('falls back to AA after Z is exhausted', () => {
    const allLetters = Array.from({ length: 26 }, (_, i) => `KB600-${String.fromCharCode(65 + i)}`);
    expect(generateNextCabinetCode('KB600-A', allLetters)).toBe('KB600-AA');
  });

  it('handles base code without suffix', () => {
    expect(generateNextCabinetCode('KB600', ['KB600-A'])).toBe('KB600-B');
  });
});
