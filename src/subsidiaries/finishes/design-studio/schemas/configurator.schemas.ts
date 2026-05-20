/**
 * Zod validation schemas for the configurator
 */
import { z } from 'zod';
import { MAX_CONFIGURATION_URL_LENGTH } from '../constants/configurator.constants';

/** Schema for a shareable configuration (URL-serializable) */
export const shareableConfigSchema = z
  .object({
    pddId: z.string().min(1),
    params: z.record(z.string(), z.unknown()),
    finishes: z.record(z.string(), z.string()),
    version: z.number().int().positive(),
  })
  .refine(
    (data) => {
      const encoded = encodeURIComponent(JSON.stringify(data));
      return encoded.length < MAX_CONFIGURATION_URL_LENGTH;
    },
    { message: `Serialized configuration exceeds ${MAX_CONFIGURATION_URL_LENGTH} character URL limit` }
  );

/** Schema for a quote request from configurator */
export const quoteRequestSchema = z.object({
  pddId: z.string().min(1),
  configuration: z.record(z.string(), z.unknown()),
  finishSelections: z.record(z.string(), z.string()),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  projectId: z.string().optional(),
}).refine(
  (data) => data.customerId || data.customerName,
  { message: 'Either customerId or customerName is required', path: ['customerId'] }
);

/** Schema for a manufacturing order request from configurator */
export const moRequestSchema = z.object({
  pddId: z.string().min(1),
  configuration: z.record(z.string(), z.unknown()),
  finishSelections: z.record(z.string(), z.string()),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  targetCompletionDate: z.string().optional(),
  projectId: z.string().optional(),
});

export type ShareableConfigInput = z.infer<typeof shareableConfigSchema>;
export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>;
export type MORequestInput = z.infer<typeof moRequestSchema>;
