/**
 * Unit Tests: Bottom-Up Pricing Strategy Integration
 *
 * Tests for strategy integration functions in bottomUpPricingService
 */

import { describe, it, expect } from 'vitest';
import {
  inferRoleFromDeliverableType,
  inferStageFromDeliverableType,
  estimateDeliverableHours,
  inferDisciplineFromDeliverableType,
  convertScopedDeliverablesToPricingDeliverables,
  prepopulateFromStrategy,
} from '@/modules/design-manager/services/bottomUpPricingService';
import type { ScopedDeliverable } from '@/modules/design-manager/types/strategy';

// Helper to create valid ScopedDeliverable for tests
const createScopedDeliverable = (
  overrides: Partial<ScopedDeliverable> & { id: string; name: string; category: ScopedDeliverable['category']; quantity: number }
): ScopedDeliverable => ({
  ...overrides,
  aiMetadata: {
    confidenceScore: 0.9,
    extractionMethod: 'gemini',
    requiresClarification: false,
    clarifications: [],
    validationErrors: [],
    ...((overrides as any).aiMetadata || {}),
  },
});

describe('Bottom-Up Pricing - Role Inference', () => {
  it('should infer principal role for concept work', () => {
    const role = inferRoleFromDeliverableType('Concept Design Study');
    expect(role).toBe('principal');
  });

  it('should infer principal role for master plan', () => {
    const role = inferRoleFromDeliverableType('Master Plan Development');
    expect(role).toBe('principal');
  });

  it('should infer senior-engineer for MEP work', () => {
    const role = inferRoleFromDeliverableType('MEP Coordination Drawings');
    expect(role).toBe('senior-engineer');
  });

  it('should infer senior-engineer for structural work', () => {
    const role = inferRoleFromDeliverableType('Structural Engineering Calculations');
    expect(role).toBe('senior-engineer');
  });

  it('should infer junior-drafter for schedules', () => {
    const role = inferRoleFromDeliverableType('Door & Window Schedule');
    expect(role).toBe('junior-drafter');
  });

  it('should infer junior-drafter for details', () => {
    const role = inferRoleFromDeliverableType('Detail Drawings');
    expect(role).toBe('junior-drafter');
  });

  it('should default to mid-level-architect', () => {
    const role = inferRoleFromDeliverableType('Floor Plans');
    expect(role).toBe('mid-level-architect');
  });

  it('should use complexity hint for principal', () => {
    const role = inferRoleFromDeliverableType('Custom Furniture Design', 'high');
    expect(role).toBe('principal');
  });

  it('should use complexity hint for junior', () => {
    const role = inferRoleFromDeliverableType('Simple Drafting Task', 'low');
    expect(role).toBe('junior-drafter');
  });
});

describe('Bottom-Up Pricing - Stage Inference', () => {
  it('should infer concept stage for renderings', () => {
    const stage = inferStageFromDeliverableType('3D Renderings');
    expect(stage).toBe('concept');
  });

  it('should infer concept stage for mood boards', () => {
    // Note: 'Mood Board Development' contains 'development' which matches design-development first
    // Use 'Mood Board Presentation' for concept stage
    const stage = inferStageFromDeliverableType('Mood Board Presentation');
    expect(stage).toBe('concept');
  });

  it('should infer schematic stage for floor plans', () => {
    const stage = inferStageFromDeliverableType('Floor Plan Layouts');
    expect(stage).toBe('schematic');
  });

  it('should infer schematic stage for furniture plans', () => {
    const stage = inferStageFromDeliverableType('Furniture Layout Plans');
    expect(stage).toBe('schematic');
  });

  it('should infer design-development for elevations', () => {
    const stage = inferStageFromDeliverableType('Building Elevations');
    expect(stage).toBe('design-development');
  });

  it('should infer design-development for millwork', () => {
    const stage = inferStageFromDeliverableType('Millwork Elevations');
    expect(stage).toBe('design-development');
  });

  it('should infer construction-docs for CD packages', () => {
    const stage = inferStageFromDeliverableType('Construction Documents');
    expect(stage).toBe('construction-docs');
  });

  it('should infer construction-docs for specifications', () => {
    const stage = inferStageFromDeliverableType('Technical Specifications');
    expect(stage).toBe('construction-docs');
  });

  it('should default to schematic', () => {
    const stage = inferStageFromDeliverableType('General Design Work');
    expect(stage).toBe('schematic');
  });
});

describe('Bottom-Up Pricing - Hour Estimation', () => {
  it('should estimate high hours for master plan', () => {
    const hours = estimateDeliverableHours('Master Plan Development');
    expect(hours).toBe(80);
  });

  it('should estimate medium-high hours for floor plans', () => {
    const hours = estimateDeliverableHours('Floor Plan Drawings');
    expect(hours).toBe(40);
  });

  it('should estimate medium hours for sections', () => {
    const hours = estimateDeliverableHours('Building Section Drawings');
    expect(hours).toBe(24);
  });

  it('should estimate low hours for sketches', () => {
    const hours = estimateDeliverableHours('Concept Sketches');
    expect(hours).toBe(8);
  });

  it('should apply complexity multiplier (high)', () => {
    const baseHours = estimateDeliverableHours('Floor Plans'); // 40 base
    const complexHours = estimateDeliverableHours('Floor Plans', undefined, 'high'); // 40 * 1.5 = 60

    expect(complexHours).toBe(60);
    expect(complexHours).toBeGreaterThan(baseHours);
  });

  it('should apply complexity multiplier (low)', () => {
    const baseHours = estimateDeliverableHours('Floor Plans'); // 40 base
    const simpleHours = estimateDeliverableHours('Floor Plans', undefined, 'low'); // 40 * 0.7 = 28

    expect(simpleHours).toBe(28);
    expect(simpleHours).toBeLessThan(baseHours);
  });

  it('should apply budget tier multiplier (economy)', () => {
    const hours = estimateDeliverableHours('Floor Plans', 'economy'); // 40 * 0.7 = 28
    expect(hours).toBe(28);
  });

  it('should apply budget tier multiplier (premium)', () => {
    const hours = estimateDeliverableHours('Floor Plans', 'premium'); // 40 * 1.5 = 60
    expect(hours).toBe(60);
  });

  it('should apply budget tier multiplier (luxury)', () => {
    const hours = estimateDeliverableHours('Floor Plans', 'luxury'); // 40 * 2.5 = 100
    expect(hours).toBe(100);
  });

  it('should apply both complexity and tier multipliers', () => {
    // Base: 40, complexity high: 40 * 1.5 = 60, tier luxury: 60 * 2.5 = 150
    const hours = estimateDeliverableHours('Floor Plans', 'luxury', 'high');
    expect(hours).toBe(150);
  });

  it('should round to nearest integer', () => {
    const hours = estimateDeliverableHours('Section Drawings', 'economy'); // 24 * 0.7 = 16.8 → 17
    expect(hours).toBe(17);
    expect(Number.isInteger(hours)).toBe(true);
  });
});

describe('Bottom-Up Pricing - Discipline Inference', () => {
  it('should infer interior-design for furniture', () => {
    const discipline = inferDisciplineFromDeliverableType('Furniture Layout Plans');
    expect(discipline).toBe('interior-design');
  });

  it('should infer interior-design for finishes', () => {
    const discipline = inferDisciplineFromDeliverableType('Finish Schedules');
    expect(discipline).toBe('interior-design');
  });

  it('should infer MEP for mechanical work', () => {
    const discipline = inferDisciplineFromDeliverableType('HVAC Layout Drawings');
    expect(discipline).toBe('mep');
  });

  it('should infer MEP for electrical work', () => {
    const discipline = inferDisciplineFromDeliverableType('Electrical Single Line Diagrams');
    expect(discipline).toBe('mep');
  });

  it('should infer structural for foundation', () => {
    const discipline = inferDisciplineFromDeliverableType('Foundation Plan');
    expect(discipline).toBe('structural');
  });

  it('should infer structural for framing', () => {
    const discipline = inferDisciplineFromDeliverableType('Structural Framing Plans');
    expect(discipline).toBe('structural');
  });

  it('should default to architecture', () => {
    const discipline = inferDisciplineFromDeliverableType('Floor Plans');
    expect(discipline).toBe('architecture');
  });
});

describe('Bottom-Up Pricing - Scoped Deliverables Conversion', () => {
  it('should filter for DESIGN_DOCUMENT category only', () => {
    const scopedDeliverables: ScopedDeliverable[] = [
      createScopedDeliverable({
        id: 'del-1',
        name: 'Floor Plans',
        category: 'DESIGN_DOCUMENT',
        quantity: 1,
        specifications: { complexity: 'medium' },
      }),
      createScopedDeliverable({
        id: 'del-2',
        name: 'Wardrobe',
        category: 'MANUFACTURED',
        quantity: 32,
        specifications: { complexity: 'low' },
      }),
      createScopedDeliverable({
        id: 'del-3',
        name: 'Elevations',
        category: 'DESIGN_DOCUMENT',
        quantity: 1,
        specifications: { complexity: 'medium' },
      }),
    ];

    const pricingDeliverables = convertScopedDeliverablesToPricingDeliverables(scopedDeliverables);

    expect(pricingDeliverables.length).toBe(2); // Only DESIGN_DOCUMENT items
    expect(pricingDeliverables[0].name).toBe('Floor Plans');
    expect(pricingDeliverables[1].name).toBe('Elevations');
  });

  it('should infer role, stage, and hours for each deliverable', () => {
    const scopedDeliverables: ScopedDeliverable[] = [
      createScopedDeliverable({
        id: 'del-1',
        name: 'Floor Plans',
        category: 'DESIGN_DOCUMENT',
        quantity: 1,
      }),
    ];

    const pricingDeliverables = convertScopedDeliverablesToPricingDeliverables(scopedDeliverables);

    expect(pricingDeliverables[0].role).toBe('mid-level-architect');
    expect(pricingDeliverables[0].designStage).toBe('schematic');
    expect(pricingDeliverables[0].estimatedHours).toBe(40);
  });

  it('should apply budget tier to hour estimates', () => {
    const scopedDeliverables: ScopedDeliverable[] = [
      createScopedDeliverable({
        id: 'del-1',
        name: 'Floor Plans',
        category: 'DESIGN_DOCUMENT',
        quantity: 1,
      }),
    ];

    const economyDeliverables = convertScopedDeliverablesToPricingDeliverables(scopedDeliverables, 'economy');
    const luxuryDeliverables = convertScopedDeliverablesToPricingDeliverables(scopedDeliverables, 'luxury');

    expect(economyDeliverables[0].estimatedHours).toBe(28); // 40 * 0.7
    expect(luxuryDeliverables[0].estimatedHours).toBe(100); // 40 * 2.5
  });

  it('should assign unique IDs to pricing deliverables', () => {
    const scopedDeliverables: ScopedDeliverable[] = [
      createScopedDeliverable({ id: 'del-1', name: 'Floor Plans', category: 'DESIGN_DOCUMENT', quantity: 1 }),
      createScopedDeliverable({ id: 'del-2', name: 'Elevations', category: 'DESIGN_DOCUMENT', quantity: 1 }),
    ];

    const pricingDeliverables = convertScopedDeliverablesToPricingDeliverables(scopedDeliverables);

    expect(pricingDeliverables[0].id).toBeDefined();
    expect(pricingDeliverables[1].id).toBeDefined();
    expect(pricingDeliverables[0].id).not.toBe(pricingDeliverables[1].id);
  });
});

describe('Bottom-Up Pricing - Prepopulate from Strategy', () => {
  it('should group deliverables by discipline', () => {
    const scopedDeliverables: ScopedDeliverable[] = [
      createScopedDeliverable({ id: 'del-1', name: 'Floor Plans', category: 'DESIGN_DOCUMENT', quantity: 1 }),
      createScopedDeliverable({ id: 'del-2', name: 'Furniture Layout', category: 'DESIGN_DOCUMENT', quantity: 1 }),
      createScopedDeliverable({ id: 'del-3', name: 'HVAC Layout', category: 'DESIGN_DOCUMENT', quantity: 1 }),
      createScopedDeliverable({ id: 'del-4', name: 'Structural Framing', category: 'DESIGN_DOCUMENT', quantity: 1 }),
    ];

    const result = prepopulateFromStrategy(scopedDeliverables);

    // 4 deliverables map to 4 disciplines: architecture, interior-design, mep, structural
    expect(result.disciplines.length).toBe(4);
    expect(result.totalDeliverables).toBe(4);
  });

  it('should calculate total estimated hours', () => {
    const scopedDeliverables: ScopedDeliverable[] = [
      createScopedDeliverable({ id: 'del-1', name: 'Floor Plans', category: 'DESIGN_DOCUMENT', quantity: 1 }), // 40h
      createScopedDeliverable({ id: 'del-2', name: 'Elevations', category: 'DESIGN_DOCUMENT', quantity: 1 }), // 40h
    ];

    const result = prepopulateFromStrategy(scopedDeliverables);

    expect(result.totalEstimatedHours).toBe(80);
  });

  it('should apply budget tier to all deliverables', () => {
    const scopedDeliverables: ScopedDeliverable[] = [
      createScopedDeliverable({ id: 'del-1', name: 'Floor Plans', category: 'DESIGN_DOCUMENT', quantity: 1 }),
    ];

    const economyResult = prepopulateFromStrategy(scopedDeliverables, 'economy');
    const luxuryResult = prepopulateFromStrategy(scopedDeliverables, 'luxury');

    expect(economyResult.totalEstimatedHours).toBe(28); // 40 * 0.7
    expect(luxuryResult.totalEstimatedHours).toBe(100); // 40 * 2.5
  });

  it('should handle empty scoped deliverables', () => {
    const result = prepopulateFromStrategy([]);

    expect(result.disciplines.length).toBe(0);
    expect(result.totalDeliverables).toBe(0);
    expect(result.totalEstimatedHours).toBe(0);
  });

  it('should handle only non-DESIGN_DOCUMENT items', () => {
    const scopedDeliverables: ScopedDeliverable[] = [
      createScopedDeliverable({ id: 'del-1', name: 'Wardrobe', category: 'MANUFACTURED', quantity: 32 }),
      createScopedDeliverable({ id: 'del-2', name: 'Chair', category: 'PROCURED', quantity: 40 }),
    ];

    const result = prepopulateFromStrategy(scopedDeliverables);

    expect(result.disciplines.length).toBe(0);
    expect(result.totalDeliverables).toBe(0);
  });
});

describe('Bottom-Up Pricing - Edge Cases', () => {
  it('should handle deliverables with very long names', () => {
    const longName = 'Very Long Deliverable Name That Exceeds Normal Length For Testing Purposes With Multiple Keywords Including Interior Design and Furniture and Lighting';
    const discipline = inferDisciplineFromDeliverableType(longName);

    expect(discipline).toBe('interior-design'); // Should catch 'interior' and 'furniture'
  });

  it('should handle case-insensitive matching', () => {
    const upperCase = inferDisciplineFromDeliverableType('FURNITURE LAYOUT PLANS');
    const lowerCase = inferDisciplineFromDeliverableType('furniture layout plans');
    const mixedCase = inferDisciplineFromDeliverableType('Furniture Layout Plans');

    expect(upperCase).toBe('interior-design');
    expect(lowerCase).toBe('interior-design');
    expect(mixedCase).toBe('interior-design');
  });

  it('should handle deliverables with special characters', () => {
    const hours = estimateDeliverableHours('Floor Plan (1st & 2nd Floors)');
    expect(hours).toBeGreaterThan(0);
  });

  it('should handle zero quantity deliverables', () => {
    const scopedDeliverables: ScopedDeliverable[] = [
      createScopedDeliverable({ id: 'del-1', name: 'Floor Plans', category: 'DESIGN_DOCUMENT', quantity: 0 }),
    ];

    const result = prepopulateFromStrategy(scopedDeliverables);

    expect(result.totalDeliverables).toBe(1); // Still converted, just 0 quantity
  });
});
