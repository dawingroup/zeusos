/**
 * Unit Tests: Strategy Validation
 *
 * Tests for strategyValidation service and Zod schemas
 */

import { describe, it, expect } from 'vitest';
import {
  SpaceParametersSchema,
  BudgetFrameworkSchema,
  ProjectContextSchema,
  validateField,
  validateSection,
  type ValidationResult,
} from '@/modules/design-manager/services/strategyValidation';

describe('Strategy Validation - Space Parameters', () => {
  it('should validate correct space parameters', () => {
    const validData = {
      totalArea: 1000,
      areaUnit: 'sqm',
      spaceType: 'hotel',
      circulationPercent: 25,
    };

    const result = SpaceParametersSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject negative area', () => {
    const invalidData = {
      totalArea: -100,
      areaUnit: 'sqm',
      spaceType: 'hotel',
    };

    const result = SpaceParametersSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('greater than 0');
    }
  });

  it('should reject circulation percent > 100', () => {
    const invalidData = {
      totalArea: 1000,
      areaUnit: 'sqm',
      spaceType: 'hotel',
      circulationPercent: 150,
    };

    const result = SpaceParametersSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('circulationPercent');
    }
  });

  it('should accept valid area units', () => {
    const units = ['sqm', 'sqft'];

    for (const unit of units) {
      const data = {
        totalArea: 1000,
        areaUnit: unit,
        spaceType: 'office',
      };

      const result = SpaceParametersSchema.safeParse(data);
      expect(result.success).toBe(true);
    }
  });
});

describe('Strategy Validation - Budget Framework', () => {
  it('should validate budget framework with all tiers', () => {
    const tiers = ['economy', 'standard', 'premium', 'luxury'];

    for (const tier of tiers) {
      const data = {
        tier,
        targetAmount: 100000,
        currency: 'UGX',
      };

      const result = BudgetFrameworkSchema.safeParse(data);
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid budget tier', () => {
    const invalidData = {
      tier: 'super-luxury', // Not a valid tier
      targetAmount: 100000,
      currency: 'UGX',
    };

    const result = BudgetFrameworkSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject negative budget amount', () => {
    const invalidData = {
      tier: 'standard',
      targetAmount: -5000,
      currency: 'UGX',
    };

    const result = BudgetFrameworkSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should allow priorities array', () => {
    const data = {
      tier: 'premium',
      targetAmount: 500000,
      currency: 'UGX',
      priorities: ['quality', 'timeline', 'sustainability'],
    };

    const result = BudgetFrameworkSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

describe('Strategy Validation - Project Context', () => {
  it('should validate complete project context', () => {
    const validData = {
      type: 'hospitality',
      location: 'Kampala',
      country: 'Uganda',
      timeline: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      },
      style: {
        aestheticDirection: 'Modern Contemporary',
        materialPreferences: ['wood', 'stone', 'metal'],
      },
    };

    const result = ProjectContextSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject end date before start date', () => {
    const invalidData = {
      type: 'office',
      location: 'Nairobi',
      timeline: {
        startDate: new Date('2024-12-31'),
        endDate: new Date('2024-01-01'), // Before start
      },
    };

    const result = ProjectContextSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should allow optional fields to be undefined', () => {
    const minimalData = {
      type: 'residential',
      location: 'Kigali',
    };

    const result = ProjectContextSchema.safeParse(minimalData);
    expect(result.success).toBe(true);
  });
});

describe('Strategy Validation - validateField helper', () => {
  it('should validate single field with schema', () => {
    const result = validateField(1000, SpaceParametersSchema.shape.totalArea);

    expect(result.isValid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('should return error for invalid field', () => {
    const result = validateField(-100, SpaceParametersSchema.shape.totalArea);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain('greater than 0');
  });

  it('should handle string validation', () => {
    const result = validateField('hotel', SpaceParametersSchema.shape.spaceType);

    expect(result.isValid).toBe(true);
    expect(result.error).toBeNull();
  });
});

describe('Strategy Validation - validateSection helper', () => {
  it('should validate complete section', () => {
    const sectionData = {
      totalArea: 1000,
      areaUnit: 'sqm',
      spaceType: 'hotel',
      circulationPercent: 25,
    };

    const result: ValidationResult = validateSection(sectionData, SpaceParametersSchema as any);

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('should return all field errors for invalid section', () => {
    const invalidData = {
      totalArea: -100, // Invalid
      areaUnit: 'invalid', // Invalid
      spaceType: '', // Invalid (empty)
      circulationPercent: 150, // Invalid
    };

    const result: ValidationResult = validateSection(invalidData, SpaceParametersSchema as any);

    expect(result.isValid).toBe(false);
    expect(Object.keys(result.errors).length).toBeGreaterThan(0);
  });

  it('should handle partial section data', () => {
    const partialData = {
      totalArea: 1000,
      areaUnit: 'sqm',
      // Missing spaceType (required)
    };

    const result: ValidationResult = validateSection(partialData, SpaceParametersSchema);

    expect(result.isValid).toBe(false);
    expect(result.errors.spaceType).toBeDefined();
  });
});

describe('Strategy Validation - Edge Cases', () => {
  it('should handle very large area values', () => {
    const data = {
      totalArea: 1000000, // 1 million sqm
      areaUnit: 'sqm',
      spaceType: 'mixed-use',
    };

    const result = SpaceParametersSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should handle zero circulation percent', () => {
    const data = {
      totalArea: 1000,
      areaUnit: 'sqm',
      spaceType: 'warehouse',
      circulationPercent: 0,
    };

    const result = SpaceParametersSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should trim whitespace from string fields', () => {
    const data = {
      type: '  hotel  ',
      location: '  Kampala  ',
    };

    const result = ProjectContextSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('hotel');
      expect(result.data.location).toBe('Kampala');
    }
  });

  it('should handle empty arrays for preferences', () => {
    const data = {
      type: 'office',
      location: 'Dar es Salaam',
      style: {
        aestheticDirection: 'Modern',
        materialPreferences: [],
        avoidMaterials: [],
      },
    };

    const result = ProjectContextSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});
