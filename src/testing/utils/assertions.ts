// ============================================================================
// CUSTOM ASSERTIONS
// DawinOS v2.0 - Testing Strategy
// Custom test assertions and matchers
// ============================================================================

import { expect } from 'vitest';

// =============================================================================
// EXTEND VITEST MATCHERS
// =============================================================================

expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);

    return {
      pass,
      message: () => (pass ? `Expected ${received} not to be a valid UUID` : `Expected ${received} to be a valid UUID`),
    };
  },

  toBeValidUGXAmount(received: number) {
    const pass = Number.isInteger(received) && received >= 0;

    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be a valid UGX amount`
          : `Expected ${received} to be a valid UGX amount (non-negative integer)`,
    };
  },

  toBeValidEmail(received: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);

    return {
      pass,
      message: () => (pass ? `Expected ${received} not to be a valid email` : `Expected ${received} to be a valid email`),
    };
  },

  toBeValidPhone(received: string) {
    // Uganda phone format: +256XXXXXXXXX
    const phoneRegex = /^\+256[0-9]{9}$/;
    const pass = phoneRegex.test(received);

    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be a valid Uganda phone number`
          : `Expected ${received} to be a valid Uganda phone number (+256XXXXXXXXX)`,
    };
  },

  toBeWithinRange(received: number, min: number, max: number) {
    const pass = received >= min && received <= max;

    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be within range [${min}, ${max}]`
          : `Expected ${received} to be within range [${min}, ${max}]`,
    };
  },

  toHavePermission(this: any, received: { permissions?: string[] }, permission: string) {
    const pass = received.permissions?.includes(permission) || received.permissions?.includes('*') || false;

    return {
      pass,
      message: () =>
        pass ? `Expected user not to have permission ${permission}` : `Expected user to have permission ${permission}`,
    };
  },

  toBeInPhase(received: { phase?: string }, phase: string) {
    const pass = received.phase === phase;

    return {
      pass,
      message: () =>
        pass
          ? `Expected entity not to be in phase ${phase}`
          : `Expected entity to be in phase ${phase}, but was ${received.phase}`,
    };
  },
});

// =============================================================================
// HELPER ASSERTIONS
// =============================================================================

export function expectValidTimestamp(timestamp: unknown): void {
  expect(timestamp).toBeDefined();
  if (typeof timestamp === 'object' && timestamp !== null && 'toDate' in timestamp) {
    expect(typeof (timestamp as { toDate: () => Date }).toDate).toBe('function');
  } else if (timestamp instanceof Date) {
    expect(timestamp.getTime()).not.toBeNaN();
  } else {
    expect(typeof timestamp).toBe('number');
  }
}

export function expectFirestoreDoc<T>(doc: unknown, expectedFields: Array<keyof T>): void {
  expect(doc).toBeDefined();
  expect(typeof doc).toBe('object');

  for (const field of expectedFields) {
    expect(doc).toHaveProperty(String(field));
  }
}

export function expectPaginatedResult<T>(result: unknown): void {
  expect(result).toBeDefined();
  expect(typeof result).toBe('object');
  expect(result).toHaveProperty('data');
  expect(result).toHaveProperty('pagination');

  const typedResult = result as { data: T[]; pagination: unknown };
  expect(Array.isArray(typedResult.data)).toBe(true);
}

export function expectUgandaCompliance(employee: {
  nationalId?: string;
  tinNumber?: string;
  nssfNumber?: string;
}): void {
  // National ID should be 14 characters
  if (employee.nationalId) {
    expect(employee.nationalId).toHaveLength(14);
  }

  // TIN should be 10 digits
  if (employee.tinNumber) {
    expect(employee.tinNumber).toMatch(/^\d{10}$/);
  }

  // NSSF number format
  if (employee.nssfNumber) {
    expect(employee.nssfNumber).toMatch(/^NSSF\d{10}$/);
  }
}
