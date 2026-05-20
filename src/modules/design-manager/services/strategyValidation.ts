/**
 * Strategy Validation Service
 * Zod-based validation schemas for strategy canvas forms
 */

import { z } from 'zod';
import { useState, useEffect, useCallback } from 'react';
import type {
  ProjectStrategy,
  ValidationResult,
} from '../types/strategy';

// Re-export ValidationResult for test imports
export type { ValidationResult };

// ============================================
// Zod Schemas
// ============================================

/**
 * Customer schema
 */
export const CustomerSchema = z.object({
  name: z.string().min(1, 'Customer name is required'),
  company: z.string().optional(),
  industry: z.string().optional(),
  previousProjects: z.number().int().min(0).optional(),
  preferredStyle: z.string().optional(),
});

/**
 * Project schema
 */
export const ProjectSchema = z.object({
  type: z.string().min(1, 'Project type is required'),
  subType: z.string().optional(),
  location: z.string().min(1, 'Project location is required'),
  country: z.string().min(1, 'Country is required'),
  region: z.string().optional(),
});

/**
 * Timeline schema
 */
export const TimelineSchema = z.object({
  startDate: z.string().optional(),
  targetCompletion: z.string().optional(),
  urgency: z.enum(['flexible', 'normal', 'urgent', 'critical']),
  milestones: z.array(z.string()).optional(),
}).refine(
  (data) => {
    // If both dates provided, target should be after start
    if (data.startDate && data.targetCompletion) {
      return new Date(data.targetCompletion) > new Date(data.startDate);
    }
    return true;
  },
  {
    message: 'Target completion must be after start date',
    path: ['targetCompletion'],
  }
);

/**
 * Style schema
 */
export const StyleSchema = z.object({
  primary: z.string().min(1, 'Primary style is required'),
  secondary: z.string().optional(),
  colorPreferences: z.array(z.string()).optional(),
  materialPreferences: z.array(z.string()).optional(),
  avoidStyles: z.array(z.string()).optional(),
  inspirationNotes: z.string().optional(),
});

/**
 * Target users schema
 */
export const TargetUsersSchema = z.object({
  demographic: z.string().optional(),
  capacity: z.number().int().min(0).optional(),
  usagePattern: z.string().optional(),
  specialNeeds: z.array(z.string()).optional(),
});

/**
 * Requirements schema
 */
export const RequirementsSchema = z.object({
  sustainability: z.boolean().optional(),
  localSourcing: z.boolean().optional(),
  accessibilityCompliant: z.boolean().optional(),
  brandGuidelines: z.boolean().optional(),
  customFinishes: z.boolean().optional(),
  notes: z.string().optional(),
});

/**
 * Simple timeline schema for flat project context
 */
export const SimpleTimelineSchema = z.object({
  startDate: z.union([z.string(), z.date()]).optional(),
  endDate: z.union([z.string(), z.date()]).optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return end > start;
    }
    return true;
  },
  {
    message: 'End date must be after start date',
    path: ['endDate'],
  }
);

/**
 * Simple style schema for flat project context
 */
export const SimpleStyleSchema = z.object({
  aestheticDirection: z.string().optional(),
  materialPreferences: z.array(z.string()).optional(),
  avoidMaterials: z.array(z.string()).optional(),
});

/**
 * Project context schema (flat structure for forms)
 * Supports both simple flat structure and nested structure
 */
export const ProjectContextSchema = z.object({
  // Flat structure fields (for simple forms)
  type: z.string().transform(s => s.trim()).optional(),
  location: z.string().transform(s => s.trim()).optional(),
  country: z.string().optional(),
  timeline: SimpleTimelineSchema.optional(),
  style: SimpleStyleSchema.optional(),
  // Nested structure fields (for complete forms)
  customer: CustomerSchema.optional(),
  project: ProjectSchema.optional(),
  targetUsers: TargetUsersSchema.optional(),
  requirements: RequirementsSchema.optional(),
});

/**
 * Full project context schema (nested structure - for backward compat)
 */
export const FullProjectContextSchema = z.object({
  customer: CustomerSchema,
  project: ProjectSchema,
  timeline: TimelineSchema.optional(),
  style: StyleSchema.optional(),
  targetUsers: TargetUsersSchema.optional(),
  requirements: RequirementsSchema.optional(),
});

/**
 * Design brief schema
 */
export const DesignBriefSchema = z.object({
  designBrief: z.string()
    .min(20, 'Design brief must be at least 20 characters')
    .max(10000, 'Design brief must not exceed 10,000 characters'),
});

/**
 * Challenges schema
 */
export const ChallengesSchema = z.object({
  painPoints: z.array(z.string()),
  goals: z.array(z.string()),
  constraints: z.array(z.string()),
});

/**
 * Space parameters schema
 */
export const SpaceParametersSchema = z.object({
  totalArea: z.number()
    .positive('Area must be greater than 0')
    .max(1000000, 'Area seems unrealistically large'),
  areaUnit: z.enum(['sqm', 'sqft']),
  spaceType: z.string().min(1, 'Space type is required'),
  circulationPercent: z.number()
    .min(0, 'Circulation percentage cannot be negative')
    .max(100, 'Circulation percentage cannot exceed 100')
    .optional(),
  calculatedCapacity: z.object({
    minimum: z.number().int().min(0),
    optimal: z.number().int().min(0),
    maximum: z.number().int().min(0),
  }).optional(),
});

/**
 * Budget framework schema
 */
export const BudgetFrameworkSchema = z.object({
  tier: z.enum(['economy', 'standard', 'premium', 'luxury'] as const),
  targetAmount: z.number().positive().optional(),
  currency: z.string().optional(),
  priorities: z.array(z.string()).optional(),
}).refine(
  (data) => {
    // If target amount provided, currency should be provided
    if (data.targetAmount && !data.currency) {
      return false;
    }
    return true;
  },
  {
    message: 'Currency is required when target budget amount is specified',
    path: ['currency'],
  }
);

/**
 * Complete project strategy schema
 */
export const ProjectStrategySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  projectContext: ProjectContextSchema.optional(),
  designBrief: z.string().optional(),
  challenges: ChallengesSchema,
  spaceParameters: SpaceParametersSchema,
  budgetFramework: BudgetFrameworkSchema,
  researchFindings: z.array(z.any()),
  scopingResult: z.any().optional(),
  updatedAt: z.any().optional(),
  updatedBy: z.string().optional(),
  createdAt: z.any().optional(),
  createdBy: z.string().optional(),
});

// ============================================
// Validation Helper Functions
// ============================================

/**
 * Validate a single field value against a Zod schema
 */
export function validateField<T>(value: T, schema: z.ZodType<T>): { isValid: boolean; error: string | null } {
  try {
    schema.parse(value);
    return { isValid: true, error: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { isValid: false, error: error.issues[0]?.message || 'Validation failed' };
    }
    return { isValid: false, error: 'Validation failed' };
  }
}

/**
 * Validate a section of data against a Zod schema
 */
export function validateSection<T>(data: T, schema: z.ZodType<T>): ValidationResult {
  try {
    schema.parse(data);
    return { isValid: true, errors: {} };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string[]> = {};
      error.issues.forEach((issue) => {
        const path = issue.path.join('.') || '_root';
        if (!errors[path]) {
          errors[path] = [];
        }
        errors[path].push(issue.message);
      });
      return { isValid: false, errors };
    }
    return { isValid: false, errors: { _general: ['Validation failed'] } };
  }
}

// ============================================
// Validation Functions
// ============================================

/**
 * Validate project context
 */
export function validateProjectContext(data: unknown): ValidationResult {
  try {
    ProjectContextSchema.parse(data);
    return { isValid: true, errors: {} };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string[]> = {};
      error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        if (!errors[path]) {
          errors[path] = [];
        }
        errors[path].push(issue.message);
      });
      return { isValid: false, errors };
    }
    return { isValid: false, errors: { _general: ['Validation failed'] } };
  }
}

/**
 * Validate design brief
 */
export function validateDesignBrief(designBrief: string): ValidationResult {
  try {
    DesignBriefSchema.parse({ designBrief });
    return { isValid: true, errors: {} };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string[]> = {};
      error.issues.forEach((issue) => {
        errors['designBrief'] = [issue.message];
      });
      return { isValid: false, errors };
    }
    return { isValid: false, errors: { _general: ['Validation failed'] } };
  }
}

/**
 * Validate challenges section
 */
export function validateChallenges(data: unknown): ValidationResult {
  try {
    ChallengesSchema.parse(data);
    return { isValid: true, errors: {} };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string[]> = {};
      error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        if (!errors[path]) {
          errors[path] = [];
        }
        errors[path].push(issue.message);
      });
      return { isValid: false, errors };
    }
    return { isValid: false, errors: { _general: ['Validation failed'] } };
  }
}

/**
 * Validate space parameters
 */
export function validateSpaceParameters(data: unknown): ValidationResult {
  try {
    SpaceParametersSchema.parse(data);
    return { isValid: true, errors: {} };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string[]> = {};
      const warnings: Record<string, string[]> = {};

      error.issues.forEach((issue) => {
        const path = issue.path.join('.');

        // Circulation warning is a warning, not an error
        if (path === 'circulationPercent' && issue.message.includes('typically')) {
          if (!warnings[path]) {
            warnings[path] = [];
          }
          warnings[path].push(issue.message);
        } else {
          if (!errors[path]) {
            errors[path] = [];
          }
          errors[path].push(issue.message);
        }
      });

      return {
        isValid: Object.keys(errors).length === 0,
        errors,
        warnings: Object.keys(warnings).length > 0 ? warnings : undefined,
      };
    }
    return { isValid: false, errors: { _general: ['Validation failed'] } };
  }
}

/**
 * Validate budget framework
 */
export function validateBudgetFramework(data: unknown): ValidationResult {
  try {
    BudgetFrameworkSchema.parse(data);
    return { isValid: true, errors: {} };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string[]> = {};
      error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        if (!errors[path]) {
          errors[path] = [];
        }
        errors[path].push(issue.message);
      });
      return { isValid: false, errors };
    }
    return { isValid: false, errors: { _general: ['Validation failed'] } };
  }
}

/**
 * Validate complete strategy
 */
export function validateStrategy(strategy: Partial<ProjectStrategy>): ValidationResult {
  try {
    ProjectStrategySchema.parse(strategy);
    return { isValid: true, errors: {} };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string[]> = {};
      error.issues.forEach((issue) => {
        const path = issue.path.join('.');
        if (!errors[path]) {
          errors[path] = [];
        }
        errors[path].push(issue.message);
      });
      return { isValid: false, errors };
    }
    return { isValid: false, errors: { _general: ['Validation failed'] } };
  }
}

// ============================================
// React Hooks
// ============================================

/**
 * Hook for field-level validation
 */
export function useFieldValidation<T>(
  value: T,
  schema: z.ZodSchema<T>,
  debounceMs: number = 300
) {
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(true);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    setIsValidating(true);
    const timer = setTimeout(() => {
      try {
        schema.parse(value);
        setError(null);
        setIsValid(true);
      } catch (err) {
        if (err instanceof z.ZodError) {
          setError(err.issues[0]?.message || 'Validation failed');
          setIsValid(false);
        }
      } finally {
        setIsValidating(false);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [value, schema, debounceMs]);

  return { error, isValid, isValidating };
}

/**
 * Hook for section-level validation
 */
export function useSectionValidation<T>(
  data: T,
  validateFn: (data: T) => ValidationResult
) {
  const [validationResult, setValidationResult] = useState<ValidationResult>({
    isValid: true,
    errors: {},
  });

  const validate = useCallback(() => {
    const result = validateFn(data);
    setValidationResult(result);
    return result;
  }, [data, validateFn]);

  useEffect(() => {
    validate();
  }, [validate]);

  return {
    ...validationResult,
    validate,
  };
}

/**
 * Hook for strategy validation with section tracking
 */
export function useStrategyValidation(strategy: Partial<ProjectStrategy>) {
  const [sectionCompleteness, setSectionCompleteness] = useState<Record<string, {
    completed: number;
    total: number;
    isComplete: boolean;
  }>>({});

  useEffect(() => {
    const completeness: typeof sectionCompleteness = {};

    // Project Context
    const projectContext = strategy.projectContext;
    if (projectContext) {
      let completed = 0;
      const total = 3; // customer.name, project.type, project.location

      if (projectContext.customer?.name) completed++;
      if (projectContext.project?.type) completed++;
      if (projectContext.project?.location) completed++;

      completeness.projectContext = {
        completed,
        total,
        isComplete: completed === total,
      };
    }

    // Design Brief
    if (strategy.designBrief !== undefined) {
      const isComplete = strategy.designBrief.length >= 20;
      completeness.designBrief = {
        completed: isComplete ? 1 : 0,
        total: 1,
        isComplete,
      };
    }

    // Space Parameters
    const spaceParams = strategy.spaceParameters;
    if (spaceParams) {
      let completed = 0;
      const total = 2; // totalArea, spaceType

      if (spaceParams.totalArea && spaceParams.totalArea > 0) completed++;
      if (spaceParams.spaceType) completed++;

      completeness.spaceParameters = {
        completed,
        total,
        isComplete: completed === total,
      };
    }

    // Budget Framework
    const budgetFramework = strategy.budgetFramework;
    if (budgetFramework) {
      const isComplete = !!budgetFramework.tier;
      completeness.budgetFramework = {
        completed: isComplete ? 1 : 0,
        total: 1,
        isComplete,
      };
    }

    setSectionCompleteness(completeness);
  }, [strategy]);

  const overallProgress = Object.values(sectionCompleteness).reduce(
    (acc, section) => ({
      completed: acc.completed + section.completed,
      total: acc.total + section.total,
    }),
    { completed: 0, total: 0 }
  );

  return {
    sectionCompleteness,
    overallProgress,
    isStrategyComplete: overallProgress.completed === overallProgress.total,
    completionPercentage: overallProgress.total > 0
      ? Math.round((overallProgress.completed / overallProgress.total) * 100)
      : 0,
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get required fields for a section
 */
export function getRequiredFields(section: 'projectContext' | 'designBrief' | 'spaceParameters' | 'budgetFramework'): string[] {
  const fieldMap = {
    projectContext: ['customer.name', 'project.type', 'project.location'],
    designBrief: ['designBrief'],
    spaceParameters: ['totalArea', 'spaceType'],
    budgetFramework: ['tier'],
  };

  return fieldMap[section] || [];
}

/**
 * Check if a field is required
 */
export function isFieldRequired(section: string, fieldPath: string): boolean {
  const requiredFields = getRequiredFields(section as 'projectContext' | 'designBrief' | 'spaceParameters' | 'budgetFramework');
  return requiredFields.includes(fieldPath);
}

/**
 * Format validation error for display
 */
export function formatValidationError(error: string): string {
  // Capitalize first letter and ensure it ends with a period
  const formatted = error.charAt(0).toUpperCase() + error.slice(1);
  return formatted.endsWith('.') ? formatted : `${formatted}.`;
}
