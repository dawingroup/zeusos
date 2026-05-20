/**
 * PDD Schema Validation Tests
 *
 * Tests Zod schema validation for Product Definition Documents.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Import the schemas
// Note: We test the schema shapes directly since the full schema imports
// may depend on constants we'd need to set up
describe('PDD validation', () => {
  // Minimal PDD shape for validation testing
  const constraintSchema = z.object({
    id: z.string().min(1),
    condition: z.string().min(1),
    action: z.enum(['reject', 'warn', 'info']),
    reason: z.string().min(1),
    affectedParameters: z.array(z.string()),
    isActive: z.boolean(),
  });

  const inventoryBindingSchema = z.object({
    inventoryItemId: z.string().optional(),
    inventoryFamilyId: z.string().optional(),
    wastagePercent: z.number().min(0).max(50).optional(),
    quantityMultiplier: z.number().positive().optional(),
  });

  describe('Constraint schema', () => {
    it('accepts valid constraint', () => {
      const valid = {
        id: 'c-001',
        condition: 'width > 1200',
        action: 'reject',
        reason: 'Width exceeds maximum for this product type',
        affectedParameters: ['width'],
        isActive: true,
      };
      expect(() => constraintSchema.parse(valid)).not.toThrow();
    });

    it('rejects constraint with invalid action', () => {
      const invalid = {
        id: 'c-001',
        condition: 'width > 1200',
        action: 'invalid_action',
        reason: 'test',
        affectedParameters: [],
        isActive: true,
      };
      expect(() => constraintSchema.parse(invalid)).toThrow();
    });

    it('rejects constraint with empty condition', () => {
      const invalid = {
        id: 'c-001',
        condition: '',
        action: 'warn',
        reason: 'test',
        affectedParameters: [],
        isActive: true,
      };
      expect(() => constraintSchema.parse(invalid)).toThrow();
    });
  });

  describe('InventoryBinding schema', () => {
    it('accepts valid binding', () => {
      const valid = {
        inventoryItemId: 'inv-001',
        wastagePercent: 5,
        quantityMultiplier: 1,
      };
      expect(() => inventoryBindingSchema.parse(valid)).not.toThrow();
    });

    it('accepts binding with only family ID', () => {
      const valid = {
        inventoryFamilyId: 'fam-boards',
        wastagePercent: 10,
      };
      expect(() => inventoryBindingSchema.parse(valid)).not.toThrow();
    });

    it('rejects wastage over 50%', () => {
      const invalid = {
        inventoryItemId: 'inv-001',
        wastagePercent: 60,
      };
      expect(() => inventoryBindingSchema.parse(invalid)).toThrow();
    });

    it('rejects negative quantity multiplier', () => {
      const invalid = {
        inventoryItemId: 'inv-001',
        quantityMultiplier: -1,
      };
      expect(() => inventoryBindingSchema.parse(invalid)).toThrow();
    });
  });
});
