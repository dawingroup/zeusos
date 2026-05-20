/**
 * Phone number utilities for WhatsApp module
 * Matches the normalization logic in functions/src/integrations/meta/utils.js
 */

/**
 * Normalize a phone number for WhatsApp Cloud API
 * Strips formatting and ensures country code prefix
 */
export function normalizePhoneNumber(phone: string, defaultCountryCode = '256'): string {
  if (!phone) return '';

  // Strip all non-digit characters
  let cleaned = phone.replace(/[^\d]/g, '');

  // If starts with '0', replace with country code
  if (cleaned.startsWith('0')) {
    cleaned = defaultCountryCode + cleaned.substring(1);
  }

  // If too short to include a country code, prepend default
  if (cleaned.length <= 9) {
    cleaned = defaultCountryCode + cleaned;
  }

  return cleaned;
}

/**
 * Format a phone number for display
 */
export function formatPhoneForDisplay(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/[^\d]/g, '');
  return '+' + cleaned;
}

/**
 * Validate a phone number
 */
export function isValidPhoneNumber(phone: string): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/[^\d]/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}
