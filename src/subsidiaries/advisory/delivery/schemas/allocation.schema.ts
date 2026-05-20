/**
 * ALLOCATION SCHEMA
 *
 * Zod validation for multi-project allocation forms.
 * Enforces: min 2 entries, amounts sum to total, percentages sum to 100%.
 */

import { z } from 'zod';

export const allocationEntrySchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  projectName: z.string().min(1),
  programId: z.string().min(1),
  budgetCategory: z.string().min(1, 'Budget category is required'),
  budgetCategoryLabel: z.string().default(''),
  availableBudget: z.number().min(0),
  percentage: z.number().min(0.1, 'Minimum 0.1%').max(99.9, 'Maximum 99.9%'),
  allocatedAmount: z.number().positive('Amount must be positive'),
  rationale: z.string().default(''),
});

export const allocationGroupSchema = z.object({
  date: z.date(),
  vendorName: z.string().min(1, 'Vendor name is required').max(200),
  description: z.string().min(1, 'Description is required').max(500),
  totalAmount: z.number().positive('Total amount must be positive'),
  currency: z.enum(['UGX', 'USD']).default('UGX'),
  allocationMethod: z.enum(['Percentage', 'FixedAmount', 'ProRata']).default('Percentage'),
  rationale: z.string().min(1, 'Allocation rationale is required').max(1000),
  allocations: z.array(allocationEntrySchema).min(2, 'At least 2 projects required for allocation'),
  sourceDocumentUrls: z.array(z.string()).default([]),
}).refine(
  (data) => {
    // Percentages must sum to ~100% (0.5% tolerance)
    const totalPct = data.allocations.reduce((sum, a) => sum + a.percentage, 0);
    return Math.abs(totalPct - 100) <= 0.5;
  },
  { message: 'Percentages must sum to 100%', path: ['allocations'] }
).refine(
  (data) => {
    // Amounts must sum to total (UGX: 1 tolerance, USD: 0.01 tolerance)
    const totalAllocated = data.allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
    const tolerance = data.currency === 'UGX' ? 1 : 0.01;
    return Math.abs(totalAllocated - data.totalAmount) <= tolerance;
  },
  { message: 'Allocated amounts must equal the total amount', path: ['allocations'] }
);

export type AllocationEntryInput = z.infer<typeof allocationEntrySchema>;
export type AllocationGroupInput = z.infer<typeof allocationGroupSchema>;
