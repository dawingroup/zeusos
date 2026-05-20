/**
 * Zoko WhatsApp Integration - Shared Utilities
 * Phone number normalization and helper functions
 */

/**
 * Normalize a phone number to a format suitable for Zoko API
 * Strips formatting characters and ensures country code prefix
 *
 * @param {string} phone - Raw phone number
 * @param {string} defaultCountryCode - Default country code (e.g. '256' for Uganda)
 * @returns {string} Normalized phone number (e.g. '256XXXXXXXXX')
 */
function normalizePhoneNumber(phone, defaultCountryCode = '256') {
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
 * @param {string} phone - Normalized phone number
 * @returns {string} Display formatted phone number (e.g. '+256 XXX XXX XXX')
 */
function formatPhoneForDisplay(phone) {
  if (!phone) return '';
  const cleaned = phone.replace(/[^\d]/g, '');
  return '+' + cleaned;
}

/**
 * Validate that a phone number looks reasonable
 * @param {string} phone - Phone number to validate
 * @returns {boolean}
 */
function isValidPhoneNumber(phone) {
  if (!phone) return false;
  const cleaned = phone.replace(/[^\d]/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}

module.exports = {
  normalizePhoneNumber,
  formatPhoneForDisplay,
  isValidPhoneNumber,
};
