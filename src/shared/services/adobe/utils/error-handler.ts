/**
 * Adobe API Error Handler
 *
 * Centralizes error handling for all Adobe API calls.
 *
 * @see docs/ADOBE_INTEGRATION_IMPLEMENTATION_PLAN.md for full implementation
 */

import { AdobeError } from '../types/common';

// Adobe API error codes
export const ADOBE_ERROR_CODES = {
  // Authentication
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // File operations
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  INVALID_FILE_FORMAT: 'INVALID_FILE_FORMAT',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  CORRUPTED_FILE: 'CORRUPTED_FILE',

  // Operations
  OPERATION_TIMEOUT: 'OPERATION_TIMEOUT',
  OPERATION_FAILED: 'OPERATION_FAILED',
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',

  // Network
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

// Retryable error codes
const RETRYABLE_ERRORS = new Set([
  ADOBE_ERROR_CODES.RATE_LIMIT_EXCEEDED,
  ADOBE_ERROR_CODES.OPERATION_TIMEOUT,
  ADOBE_ERROR_CODES.NETWORK_ERROR,
  ADOBE_ERROR_CODES.SERVICE_UNAVAILABLE,
]);

export function parseAdobeError(error: unknown): AdobeError {
  // Handle Adobe SDK errors
  if (error && typeof error === 'object' && 'code' in error) {
    const adobeError = error as {
      code: string;
      message?: string;
      details?: unknown;
    };
    return {
      code: adobeError.code,
      message: adobeError.message || 'Unknown Adobe API error',
      details: adobeError.details as Record<string, unknown>,
      retryable: RETRYABLE_ERRORS.has(adobeError.code as any),
    };
  }

  // Handle fetch/network errors
  if (error instanceof Error) {
    if (error.message.includes('fetch')) {
      return {
        code: ADOBE_ERROR_CODES.NETWORK_ERROR,
        message: error.message,
        retryable: true,
      };
    }
    return {
      code: ADOBE_ERROR_CODES.OPERATION_FAILED,
      message: error.message,
      retryable: false,
    };
  }

  // Unknown error
  return {
    code: ADOBE_ERROR_CODES.OPERATION_FAILED,
    message: String(error),
    retryable: false,
  };
}

export function isRetryableError(error: AdobeError): boolean {
  return error.retryable;
}

export function getRetryDelay(attempt: number, baseDelay = 1000): number {
  // Exponential backoff with jitter
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 1000;
  return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
}
