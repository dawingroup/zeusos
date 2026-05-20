/**
 * Middleware Index
 * Export all compatibility middleware
 */

export {
  extractVersion,
  getDeprecationHeaders,
  createVersionContext,
  isVersionSupported,
  mapEndpointV5ToV6,
  getEntityTypeFromEndpoint,
  useVersionRouter,
} from './version-router';
export type { VersionedRequest, VersionContext } from './version-router';

export {
  logDeprecatedUsage,
  getDeprecationStats,
  getDeprecatedFeatureStats,
  generateDeprecationReport,
  isEndpointDeprecated,
  getReplacementEndpoint,
  getSunsetDate,
  DEPRECATED_ENDPOINTS,
  DEPRECATED_FIELDS,
  DEPRECATED_PARAMS,
} from './deprecation-logger';
export type { DeprecationLog, DeprecationStats } from './deprecation-logger';
