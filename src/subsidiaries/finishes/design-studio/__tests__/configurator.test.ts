/**
 * Configurator Tests
 *
 * Tests URL serialization round-trips, shareable config schema validation,
 * and configurator state reducer logic.
 */
import { describe, it, expect } from 'vitest';
import {
  serializeConfiguration,
  deserializeConfiguration,
  generateShareableUrl,
} from '../services/configurator.service';
import {
  shareableConfigSchema,
  quoteRequestSchema,
  moRequestSchema,
} from '../schemas/configurator.schemas';
import { MAX_CONFIGURATION_URL_LENGTH } from '../constants/configurator.constants';
import type { ShareableConfiguration } from '../types/configurator.types';

describe('configurator', () => {
  describe('serializeConfiguration / deserializeConfiguration', () => {
    it('round-trips a simple configuration', () => {
      const config: ShareableConfiguration = {
        pddId: 'kitchen-base-600',
        params: { width: 600, depth: 560, height: 720 },
        finishes: { carcass: 'white-melamine', door: 'grey-matt' },
        version: 1,
      };
      const encoded = serializeConfiguration(config);
      const decoded = deserializeConfiguration(encoded);

      expect(decoded).toEqual(config);
    });

    it('round-trips a configuration with boolean and string params', () => {
      const config: ShareableConfiguration = {
        pddId: 'dining-table',
        params: { width: 1800, legStyle: 'hairpin', hasDrawer: true },
        finishes: { top: 'oak-natural' },
        version: 2,
      };
      const encoded = serializeConfiguration(config);
      const decoded = deserializeConfiguration(encoded);

      expect(decoded).toEqual(config);
    });

    it('produces URL-safe output (no +, /, =)', () => {
      const config: ShareableConfiguration = {
        pddId: 'test',
        params: { a: 123 },
        finishes: {},
        version: 1,
      };
      const encoded = serializeConfiguration(config);

      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('=');
    });

    it('round-trips empty params and finishes', () => {
      const config: ShareableConfiguration = {
        pddId: 'empty-test',
        params: {},
        finishes: {},
        version: 1,
      };
      const encoded = serializeConfiguration(config);
      const decoded = deserializeConfiguration(encoded);

      expect(decoded).toEqual(config);
    });
  });

  describe('generateShareableUrl', () => {
    it('generates a URL under the max length', () => {
      const config: ShareableConfiguration = {
        pddId: 'kitchen-base-600',
        params: { width: 600, depth: 560 },
        finishes: { carcass: 'white' },
        version: 1,
      };
      const url = generateShareableUrl('https://app.dawinos.com', config);

      expect(url).not.toBeNull();
      expect(url!.length).toBeLessThanOrEqual(MAX_CONFIGURATION_URL_LENGTH);
      expect(url).toContain('/design-studio/configure?c=');
    });

    it('returns null for configurations that exceed URL length', () => {
      const largeParams: Record<string, unknown> = {};
      for (let i = 0; i < 200; i++) {
        largeParams[`param_with_long_name_${i}`] = `value_with_long_content_${i}_${'x'.repeat(20)}`;
      }

      const config: ShareableConfiguration = {
        pddId: 'oversized-test',
        params: largeParams,
        finishes: {},
        version: 1,
      };
      const url = generateShareableUrl('https://app.dawinos.com', config);

      expect(url).toBeNull();
    });
  });

  describe('shareableConfigSchema', () => {
    it('validates a valid shareable config', () => {
      const result = shareableConfigSchema.safeParse({
        pddId: 'kitchen-base-600',
        params: { width: 600 },
        finishes: { carcass: 'white' },
        version: 1,
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty pddId', () => {
      const result = shareableConfigSchema.safeParse({
        pddId: '',
        params: {},
        finishes: {},
        version: 1,
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-positive version', () => {
      const result = shareableConfigSchema.safeParse({
        pddId: 'test',
        params: {},
        finishes: {},
        version: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('quoteRequestSchema', () => {
    it('accepts request with customerId', () => {
      const result = quoteRequestSchema.safeParse({
        pddId: 'kitchen-base-600',
        configuration: { width: 600 },
        finishSelections: { carcass: 'white' },
        customerId: 'cust-123',
      });
      expect(result.success).toBe(true);
    });

    it('accepts request with customerName', () => {
      const result = quoteRequestSchema.safeParse({
        pddId: 'kitchen-base-600',
        configuration: { width: 600 },
        finishSelections: { carcass: 'white' },
        customerName: 'John Doe',
      });
      expect(result.success).toBe(true);
    });

    it('rejects request with neither customerId nor customerName', () => {
      const result = quoteRequestSchema.safeParse({
        pddId: 'kitchen-base-600',
        configuration: { width: 600 },
        finishSelections: { carcass: 'white' },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('moRequestSchema', () => {
    it('accepts valid MO request', () => {
      const result = moRequestSchema.safeParse({
        pddId: 'kitchen-base-600',
        configuration: { width: 600 },
        finishSelections: { carcass: 'white' },
        priority: 'medium',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid priority', () => {
      const result = moRequestSchema.safeParse({
        pddId: 'kitchen-base-600',
        configuration: { width: 600 },
        finishSelections: {},
        priority: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('accepts optional targetCompletionDate', () => {
      const result = moRequestSchema.safeParse({
        pddId: 'kitchen-base-600',
        configuration: { width: 600 },
        finishSelections: {},
        priority: 'high',
        targetCompletionDate: '2026-05-01',
      });
      expect(result.success).toBe(true);
    });
  });
});
