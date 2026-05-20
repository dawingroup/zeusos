/**
 * Type Coercer
 * Handles type conversion between v5 and v6 formats
 */

/**
 * Coerce value to string
 */
export function coerceToString(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value.toDate) return value.toDate().toISOString(); // Firestore Timestamp
  return JSON.stringify(value);
}

/**
 * Coerce value to number
 */
export function coerceToNumber(value: any): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[^0-9.-]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Coerce value to boolean
 */
export function coerceToBoolean(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
  }
  if (typeof value === 'number') return value !== 0;
  return Boolean(value);
}

/**
 * Coerce value to date string (ISO format)
 */
export function coerceToDateString(value: any): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value.toDate) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'number') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

/**
 * Coerce value to array
 */
export function coerceToArray<T = any>(value: any): T[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

/**
 * Coerce value to object
 */
export function coerceToObject(value: any): Record<string, any> {
  if (value === null || value === undefined) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  return {};
}

/**
 * Format currency value
 */
export function formatCurrency(
  value: number,
  currency: string = 'UGX'
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Parse currency string to number
 */
export function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Parse percentage string to number
 */
export function parsePercentage(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Normalize status value
 */
export function normalizeStatus(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '_');
}

/**
 * Denormalize status value (for v5 format)
 */
export function denormalizeStatus(value: string): string {
  return value
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Convert Firestore Timestamp to ISO string
 */
export function timestampToISO(timestamp: any): string | null {
  if (!timestamp) return null;
  if (typeof timestamp === 'string') return timestamp;
  if (timestamp.toDate) {
    return timestamp.toDate().toISOString();
  }
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  return null;
}

/**
 * Deep clone object with type coercion
 */
export function deepCloneWithCoercion(
  obj: any,
  coercions: Record<string, (value: any) => any> = {}
): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepCloneWithCoercion(item, coercions));
  }

  const result: Record<string, any> = {};
  
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const coercer = coercions[key];
    
    if (coercer) {
      result[key] = coercer(value);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = deepCloneWithCoercion(value, coercions);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Type coercer class for entity-specific coercions
 */
export class TypeCoercer {
  private coercions: Record<string, Record<string, (value: any) => any>> = {
    program: {
      budget: coerceToNumber,
      startDate: coerceToDateString,
      endDate: coerceToDateString,
      createdAt: coerceToDateString,
      updatedAt: coerceToDateString,
      projects: coerceToArray,
    },
    project: {
      budget: coerceToNumber,
      spent: coerceToNumber,
      progress: coerceToNumber,
      createdAt: coerceToDateString,
      updatedAt: coerceToDateString,
    },
    ipc: {
      workDone: coerceToNumber,
      previousCertificates: coerceToNumber,
      currentCertificate: coerceToNumber,
      retention: coerceToNumber,
      netPayable: coerceToNumber,
      periodFrom: coerceToDateString,
      periodTo: coerceToDateString,
      createdAt: coerceToDateString,
    },
    deal: {
      value: coerceToNumber,
      dueDate: coerceToDateString,
      createdAt: coerceToDateString,
      updatedAt: coerceToDateString,
    },
  };

  /**
   * Coerce object fields based on entity type
   */
  coerce(data: Record<string, any>, entityType: string): Record<string, any> {
    const entityCoercions = this.coercions[entityType] || {};
    return deepCloneWithCoercion(data, entityCoercions);
  }

  /**
   * Add custom coercion for entity
   */
  addCoercion(
    entityType: string,
    field: string,
    coercer: (value: any) => any
  ): void {
    if (!this.coercions[entityType]) {
      this.coercions[entityType] = {};
    }
    this.coercions[entityType][field] = coercer;
  }
}

export const typeCoercer = new TypeCoercer();
