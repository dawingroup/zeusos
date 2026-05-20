/**
 * Zod validation schemas for constraint engine requests
 */
import { z } from 'zod';

/** Schema for a constraint validation request */
export const constraintValidationRequestSchema = z.object({
  pddId: z.string().min(1, 'PDD ID is required'),
  configuration: z.record(z.string(), z.unknown()).refine(
    (val) => Object.keys(val).length > 0,
    { message: 'Configuration must have at least one parameter' }
  ),
  finishSelections: z.record(z.string(), z.string()),
});

export type ConstraintValidationRequestInput = z.infer<typeof constraintValidationRequestSchema>;
