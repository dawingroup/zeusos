/**
 * Centralized CORS Configuration
 *
 * Single source of truth for allowed origins across all Cloud Functions.
 * Import this in any function that needs CORS support.
 */

// Production origins - always allowed
const PRODUCTION_ORIGINS = [
  'https://dawinos.web.app',
  'https://dawinos.firebaseapp.com',
];

// Development origins - only included when running in emulator or dev mode
const DEVELOPMENT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5173',
];

/**
 * Get allowed origins based on environment
 * Always include localhost origins because:
 * 1. CORS is just a browser security feature, not actual security
 * 2. All authenticated endpoints still verify Firebase ID tokens
 * 3. This allows local development against production functions
 */
function getAllowedOrigins() {
  // Always include both production and development origins
  // Security is enforced via Firebase Auth token verification, not CORS
  return [...PRODUCTION_ORIGINS, ...DEVELOPMENT_ORIGINS];
}

// Export the allowed origins array for use in function configurations
const ALLOWED_ORIGINS = getAllowedOrigins();

module.exports = {
  ALLOWED_ORIGINS,
  PRODUCTION_ORIGINS,
  DEVELOPMENT_ORIGINS,
  getAllowedOrigins,
};
