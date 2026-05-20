/**
 * Validation Schemas - DawinOS v2.0
 * Reusable validation functions
 */

import { ValidationError } from '../types/base.types';

// ============================================
// Validation Result Type
// ============================================

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// ============================================
// Field Validators
// ============================================

export function required(value: any, fieldName: string): ValidationError | null {
  if (value === null || value === undefined || value === '') {
    return {
      field: fieldName,
      message: `${fieldName} is required`,
      code: 'REQUIRED',
    };
  }
  return null;
}

export function minLength(
  value: string,
  min: number,
  fieldName: string
): ValidationError | null {
  if (value && value.length < min) {
    return {
      field: fieldName,
      message: `${fieldName} must be at least ${min} characters`,
      code: 'MIN_LENGTH',
    };
  }
  return null;
}

export function maxLength(
  value: string,
  max: number,
  fieldName: string
): ValidationError | null {
  if (value && value.length > max) {
    return {
      field: fieldName,
      message: `${fieldName} must be at most ${max} characters`,
      code: 'MAX_LENGTH',
    };
  }
  return null;
}

export function minValue(
  value: number,
  min: number,
  fieldName: string
): ValidationError | null {
  if (value < min) {
    return {
      field: fieldName,
      message: `${fieldName} must be at least ${min}`,
      code: 'MIN_VALUE',
    };
  }
  return null;
}

export function maxValue(
  value: number,
  max: number,
  fieldName: string
): ValidationError | null {
  if (value > max) {
    return {
      field: fieldName,
      message: `${fieldName} must be at most ${max}`,
      code: 'MAX_VALUE',
    };
  }
  return null;
}

export function pattern(
  value: string,
  regex: RegExp,
  fieldName: string,
  message?: string
): ValidationError | null {
  if (value && !regex.test(value)) {
    return {
      field: fieldName,
      message: message || `${fieldName} has an invalid format`,
      code: 'PATTERN',
    };
  }
  return null;
}

// ============================================
// Composite Validators
// ============================================

export function validateEmail(email: string): ValidationResult {
  const errors: ValidationError[] = [];
  
  const requiredError = required(email, 'Email');
  if (requiredError) errors.push(requiredError);
  
  const patternError = pattern(
    email,
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    'Email',
    'Invalid email format'
  );
  if (patternError) errors.push(patternError);
  
  return { isValid: errors.length === 0, errors };
}

export function validatePhone(phone: string): ValidationResult {
  const errors: ValidationError[] = [];
  
  const cleaned = phone.replace(/\D/g, '');
  if (!/^(0|256)?[37]\d{8}$/.test(cleaned)) {
    errors.push({
      field: 'Phone',
      message: 'Invalid Uganda phone number',
      code: 'INVALID_PHONE',
    });
  }
  
  return { isValid: errors.length === 0, errors };
}

export function validateMoney(
  amount: number,
  fieldName: string,
  options?: { min?: number; max?: number }
): ValidationResult {
  const errors: ValidationError[] = [];
  
  if (isNaN(amount)) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be a valid number`,
      code: 'INVALID_NUMBER',
    });
    return { isValid: false, errors };
  }
  
  if (options?.min !== undefined) {
    const minError = minValue(amount, options.min, fieldName);
    if (minError) errors.push(minError);
  }
  
  if (options?.max !== undefined) {
    const maxError = maxValue(amount, options.max, fieldName);
    if (maxError) errors.push(maxError);
  }
  
  return { isValid: errors.length === 0, errors };
}

// ============================================
// Schema-based Validation
// ============================================

export type ValidatorFn<T> = (value: T) => ValidationError | null;

export interface FieldSchema<T> {
  validators: ValidatorFn<T>[];
}

export function validateObject<T extends object>(
  obj: T,
  schema: Partial<Record<keyof T, FieldSchema<any>>>
): ValidationResult {
  const errors: ValidationError[] = [];
  
  for (const [key, fieldSchema] of Object.entries(schema)) {
    if (!fieldSchema) continue;
    const value = obj[key as keyof T];
    
    for (const validator of (fieldSchema as FieldSchema<any>).validators) {
      const error = validator(value);
      if (error) {
        errors.push({ ...error, field: key });
      }
    }
  }
  
  return { isValid: errors.length === 0, errors };
}
