/**
 * Utility Functions - DawinOS v2.0
 * Shared helper functions used across modules
 */

import { Timestamp } from 'firebase/firestore';
import { Money, Period, DateRange } from '../types/base.types';
import { PAYE_BANDS_UGX, NSSF_RATES } from '../config/constants';

// ============================================
// ID Generation
// ============================================

/**
 * Generate a unique ID with optional prefix
 */
export function generateId(prefix?: string): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}_${timestamp}${randomPart}` : `${timestamp}${randomPart}`;
}

/**
 * Generate a sequential ID (for employee numbers, etc.)
 */
export function generateSequentialId(prefix: string, sequence: number, padLength = 4): string {
  return `${prefix}${sequence.toString().padStart(padLength, '0')}`;
}

// ============================================
// Date & Time Utilities
// ============================================

/**
 * Convert Date to Firestore Timestamp
 */
export function toTimestamp(date: Date | string | number): Timestamp {
  if (date instanceof Date) {
    return Timestamp.fromDate(date);
  }
  return Timestamp.fromDate(new Date(date));
}

/**
 * Get current timestamp
 */
export function now(): Timestamp {
  return Timestamp.now();
}

/**
 * Get start and end of a period
 */
export function getPeriodRange(period: Period): DateRange {
  const start = new Date(period.year, period.month - 1, 1);
  const end = new Date(period.year, period.month, 0, 23, 59, 59);
  return {
    start: Timestamp.fromDate(start),
    end: Timestamp.fromDate(end),
  };
}

/**
 * Get days between two timestamps
 */
export function daysBetween(start: Timestamp, end: Timestamp): number {
  const diff = end.toMillis() - start.toMillis();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Check if a date is in the past
 */
export function isPast(date: Timestamp): boolean {
  return date.toMillis() < Date.now();
}

/**
 * Check if a date is today
 */
export function isToday(date: Timestamp): boolean {
  const today = new Date();
  const d = date.toDate();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

/**
 * Format timestamp to locale string
 */
export function formatDate(
  timestamp: Timestamp,
  options?: Intl.DateTimeFormatOptions
): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  return timestamp.toDate().toLocaleDateString('en-UG', options || defaultOptions);
}

/**
 * Format timestamp to time string
 */
export function formatTime(timestamp: Timestamp): string {
  return timestamp.toDate().toLocaleTimeString('en-UG', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format timestamp to datetime string
 */
export function formatDateTime(timestamp: Timestamp): string {
  return `${formatDate(timestamp)} ${formatTime(timestamp)}`;
}

/**
 * Get relative time description
 */
export function relativeTime(timestamp: Timestamp): string {
  const nowMs = Date.now();
  const diff = nowMs - timestamp.toMillis();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 30) return formatDate(timestamp);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

// ============================================
// Money & Currency Utilities
// ============================================

/**
 * Format money amount
 */
export function formatMoney(money: Money): string {
  const formatter = new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: money.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return formatter.format(money.amount);
}

/**
 * Format number with commas
 */
export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-UG', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Convert between currencies
 */
export function convertCurrency(
  amount: number,
  _fromCurrency: string,
  toCurrency: string,
  rate: number
): Money {
  return {
    amount: amount * rate,
    currency: toCurrency,
  };
}

/**
 * Calculate percentage
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100 * 100) / 100;
}

// ============================================
// Uganda Tax Calculations
// ============================================

/**
 * Calculate PAYE (Pay As You Earn) tax
 */
export function calculatePAYE(grossSalary: number): number {
  let tax = 0;
  let remainingSalary = grossSalary;
  
  for (const band of PAYE_BANDS_UGX) {
    if (remainingSalary <= 0) break;
    
    if (grossSalary > band.min) {
      const taxableInBand = Math.min(
        remainingSalary,
        band.max === Infinity ? remainingSalary : band.max - Math.max(band.min, grossSalary - remainingSalary)
      );
      tax += taxableInBand * band.rate;
      remainingSalary -= taxableInBand;
    }
  }
  
  return Math.round(tax);
}

/**
 * Calculate NSSF contributions
 */
export function calculateNSSF(grossSalary: number): {
  employee: number;
  employer: number;
  total: number;
} {
  const employee = Math.round(grossSalary * NSSF_RATES.EMPLOYEE);
  const employer = Math.round(grossSalary * NSSF_RATES.EMPLOYER);
  return {
    employee,
    employer,
    total: employee + employer,
  };
}

/**
 * Calculate net salary
 */
export function calculateNetSalary(grossSalary: number): {
  gross: number;
  paye: number;
  nssf: { employee: number; employer: number };
  net: number;
} {
  const paye = calculatePAYE(grossSalary);
  const nssf = calculateNSSF(grossSalary);
  
  return {
    gross: grossSalary,
    paye,
    nssf: { employee: nssf.employee, employer: nssf.employer },
    net: grossSalary - paye - nssf.employee,
  };
}

// ============================================
// String Utilities
// ============================================

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert to title case
 */
export function toTitleCase(str: string): string {
  return str
    .split(' ')
    .map(word => capitalize(word))
    .join(' ');
}

/**
 * Convert to slug
 */
export function toSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 3)}...`;
}

/**
 * Get initials from name
 */
export function getInitials(name: string, maxLength = 2): string {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, maxLength)
    .join('');
}

/**
 * Format phone number for Uganda
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('256')) {
    return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  if (cleaned.startsWith('0')) {
    return `+256 ${cleaned.slice(1, 4)} ${cleaned.slice(4)}`;
  }
  return phone;
}

// ============================================
// Array Utilities
// ============================================

/**
 * Group array by key
 */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const groupKey = String(item[key]);
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

/**
 * Sort array by key
 */
export function sortBy<T>(
  array: T[],
  key: keyof T,
  order: 'asc' | 'desc' = 'asc'
): T[] {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return order === 'asc' ? comparison : -comparison;
  });
}

/**
 * Remove duplicates from array
 */
export function uniqueBy<T>(array: T[], key: keyof T): T[] {
  const seen = new Set();
  return array.filter(item => {
    const value = item[key];
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

/**
 * Chunk array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// ============================================
// Object Utilities
// ============================================

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Pick specific keys from object
 */
export function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  return keys.reduce((result, key) => {
    if (key in obj) {
      result[key] = obj[key];
    }
    return result;
  }, {} as Pick<T, K>);
}

/**
 * Omit specific keys from object
 */
export function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

/**
 * Check if object is empty
 */
export function isEmpty(obj: object): boolean {
  return Object.keys(obj).length === 0;
}

/**
 * Remove undefined values from object
 */
export function compact<T extends object>(obj: T): Partial<T> {
  return Object.entries(obj).reduce((result, [key, value]) => {
    if (value !== undefined) {
      (result as any)[key] = value;
    }
    return result;
  }, {} as Partial<T>);
}

// ============================================
// Validation Utilities
// ============================================

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate Uganda phone number
 */
export function isValidUgandaPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  // Valid formats: 0XXX..., 256XXX..., +256XXX...
  return /^(0|256|\+256)?[37]\d{8}$/.test(cleaned);
}

/**
 * Validate NSSF number format
 */
export function isValidNSSF(nssf: string): boolean {
  return /^[A-Z]{2}\d{8}[A-Z]?$/.test(nssf);
}

/**
 * Validate TIN (Tax Identification Number) format
 */
export function isValidTIN(tin: string): boolean {
  return /^\d{10}$/.test(tin);
}

// ============================================
// Error Handling
// ============================================

/**
 * Create a standardized error
 */
export function createError(code: string, message: string, details?: any): Error {
  const error = new Error(message);
  (error as any).code = code;
  (error as any).details = details;
  return error;
}

/**
 * Extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unknown error occurred';
}

// Re-export validators
export * from './validators';
