/**
 * Version Router Middleware
 * Routes requests to appropriate API version handlers
 */

import { APIVersion } from '../types/api-compat-types';

export interface VersionedRequest {
  apiVersion: APIVersion;
  originalVersion: APIVersion;
}

/**
 * Extract API version from request path or headers
 */
export function extractVersion(
  path: string,
  headers: Record<string, string | undefined>
): APIVersion {
  // Check URL path first (e.g., /api/v5/programs)
  const pathMatch = path.match(/\/api\/(v\d+)\//);
  if (pathMatch) {
    const version = pathMatch[1];
    if (version === 'v5' || version === 'v6') {
      return version;
    }
  }

  // Check Accept header (e.g., application/vnd.dawin.v5+json)
  const acceptHeader = headers['accept'] || headers['Accept'];
  if (acceptHeader) {
    const versionMatch = acceptHeader.match(/vnd\.dawin\.(v\d+)/);
    if (versionMatch) {
      const version = versionMatch[1];
      if (version === 'v5' || version === 'v6') {
        return version;
      }
    }
  }

  // Check X-API-Version header
  const versionHeader = headers['x-api-version'] || headers['X-API-Version'];
  if (versionHeader && /^v\d+$/.test(versionHeader)) {
    if (versionHeader === 'v5' || versionHeader === 'v6') {
      return versionHeader;
    }
  }

  // Default to v6
  return 'v6';
}

/**
 * Get deprecation headers for v5 requests
 */
export function getDeprecationHeaders(): Record<string, string> {
  return {
    'Deprecation': 'Sun, 01 Jun 2026 00:00:00 GMT',
    'Sunset': 'Sun, 01 Jun 2026 00:00:00 GMT',
    'Link': '</api/v6>; rel="successor-version"',
  };
}

/**
 * Version context for request handling
 */
export interface VersionContext {
  requestedVersion: APIVersion;
  processingVersion: APIVersion;
  shouldTransformResponse: boolean;
  deprecationHeaders: Record<string, string>;
}

/**
 * Create version context for request
 */
export function createVersionContext(
  path: string,
  headers: Record<string, string | undefined>
): VersionContext {
  const requestedVersion = extractVersion(path, headers);
  
  return {
    requestedVersion,
    processingVersion: 'v6', // Always process as v6 internally
    shouldTransformResponse: requestedVersion === 'v5',
    deprecationHeaders: requestedVersion === 'v5' ? getDeprecationHeaders() : {},
  };
}

/**
 * Check if version is supported
 */
export function isVersionSupported(version: string): version is APIVersion {
  return version === 'v5' || version === 'v6';
}

/**
 * Get endpoint mapping from v5 to v6
 */
export function mapEndpointV5ToV6(v5Endpoint: string): string {
  const mappings: Record<string, string> = {
    '/api/v5/programs': '/api/v6/engagements',
    '/api/v5/projects': '/api/v6/projects',
    '/api/v5/ipcs': '/api/v6/payments',
    '/api/v5/requisitions': '/api/v6/payments',
    '/api/v5/deals': '/api/v6/engagements',
    '/api/v5/portfolios': '/api/v6/engagements',
  };

  // Check for exact match
  if (mappings[v5Endpoint]) {
    return mappings[v5Endpoint];
  }

  // Check for pattern match (with ID)
  for (const [v5Pattern, v6Pattern] of Object.entries(mappings)) {
    if (v5Endpoint.startsWith(v5Pattern + '/')) {
      const id = v5Endpoint.slice(v5Pattern.length + 1);
      return `${v6Pattern}/${id}`;
    }
  }

  return v5Endpoint;
}

/**
 * Get entity type from endpoint
 */
export function getEntityTypeFromEndpoint(endpoint: string): string {
  if (endpoint.includes('program') || endpoint.includes('engagement')) {
    return 'program';
  }
  if (endpoint.includes('project')) {
    return 'project';
  }
  if (endpoint.includes('ipc') || endpoint.includes('payment')) {
    return 'ipc';
  }
  if (endpoint.includes('deal')) {
    return 'deal';
  }
  if (endpoint.includes('requisition')) {
    return 'requisition';
  }
  if (endpoint.includes('portfolio')) {
    return 'portfolio';
  }
  return 'unknown';
}

/**
 * Version router hook for React/service usage
 */
export function useVersionRouter() {
  return {
    extractVersion,
    createVersionContext,
    isVersionSupported,
    mapEndpointV5ToV6,
    getEntityTypeFromEndpoint,
    getDeprecationHeaders,
  };
}
