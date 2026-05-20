/**
 * Deprecation Logger
 * Tracks usage of deprecated endpoints and features
 */

import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  getDocs,
  orderBy,
  limit,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { APIVersion } from '../types/api-compat-types';

export interface DeprecationLog {
  endpoint: string;
  method: string;
  version: string;
  userId?: string;
  userAgent?: string;
  deprecatedFeatures: string[];
  timestamp: any;
  clientInfo?: {
    ip?: string;
    origin?: string;
  };
}

export interface DeprecationStats {
  endpoint: string;
  totalCalls: number;
  uniqueUsers: number;
  lastUsed: Date;
  deprecatedSince: Date;
}

// Track deprecated endpoints
export const DEPRECATED_ENDPOINTS: Record<string, { since: string; replacement: string }> = {
  '/api/v5/programs': { since: '2025-12-01', replacement: '/api/v6/engagements' },
  '/api/v5/projects': { since: '2025-12-01', replacement: '/api/v6/projects' },
  '/api/v5/ipcs': { since: '2025-12-01', replacement: '/api/v6/payments' },
  '/api/v5/requisitions': { since: '2025-12-01', replacement: '/api/v6/payments' },
  '/api/v5/deals': { since: '2025-12-01', replacement: '/api/v6/engagements' },
  '/api/v5/portfolios': { since: '2025-12-01', replacement: '/api/v6/engagements' },
};

// Track deprecated fields by entity
export const DEPRECATED_FIELDS: Record<string, string[]> = {
  program: ['projects', 'fundingSource'],
  project: ['programId', 'programName'],
  ipc: ['workDone', 'netPayable', 'previousCertificates', 'currentCertificate'],
  deal: ['stage', 'value'],
  requisition: ['requisitionNumber'],
};

// Track deprecated query params
export const DEPRECATED_PARAMS: Record<string, string[]> = {
  program: ['fundingSource', 'programStatus'],
  project: ['programId', 'projectStatus'],
  ipc: ['ipcStatus', 'certificateNumber'],
};

/**
 * Log deprecated endpoint usage
 */
export async function logDeprecatedUsage(
  endpoint: string,
  method: string,
  version: APIVersion,
  options?: {
    userId?: string;
    userAgent?: string;
    body?: Record<string, any>;
    queryParams?: Record<string, string>;
    ip?: string;
    origin?: string;
  }
): Promise<void> {
  const deprecatedFeatures: string[] = [];

  // Check for deprecated endpoint
  const endpointBase = endpoint.replace(/\/[a-zA-Z0-9_-]+$/, '');
  if (DEPRECATED_ENDPOINTS[endpoint] || DEPRECATED_ENDPOINTS[endpointBase]) {
    deprecatedFeatures.push(`endpoint:${endpoint}`);
  }

  // Check for deprecated fields in request body
  if (options?.body) {
    const entityType = detectEntityType(endpoint);
    const deprecatedFieldsList = DEPRECATED_FIELDS[entityType] || [];

    for (const field of deprecatedFieldsList) {
      if (options.body[field] !== undefined) {
        deprecatedFeatures.push(`field:${field}`);
      }
    }
  }

  // Check for deprecated query params
  if (options?.queryParams) {
    const entityType = detectEntityType(endpoint);
    const deprecatedParamsList = DEPRECATED_PARAMS[entityType] || [];

    for (const param of deprecatedParamsList) {
      if (options.queryParams[param] !== undefined) {
        deprecatedFeatures.push(`param:${param}`);
      }
    }
  }

  // Only log if there are deprecated features
  if (deprecatedFeatures.length === 0 && version !== 'v5') {
    return;
  }

  // Always mark v5 usage as deprecated
  if (version === 'v5' && deprecatedFeatures.length === 0) {
    deprecatedFeatures.push('version:v5');
  }

  const log: DeprecationLog = {
    endpoint,
    method,
    version,
    userId: options?.userId,
    userAgent: options?.userAgent,
    deprecatedFeatures,
    timestamp: serverTimestamp(),
    clientInfo: {
      ip: options?.ip,
      origin: options?.origin,
    },
  };

  try {
    await addDoc(collection(db, 'deprecationLogs'), log);
  } catch (error) {
    console.error('Failed to log deprecated usage:', error);
  }
}

/**
 * Detect entity type from endpoint path
 */
function detectEntityType(path: string): string {
  if (path.includes('program') || path.includes('engagement')) return 'program';
  if (path.includes('project')) return 'project';
  if (path.includes('ipc') || path.includes('payment')) return 'ipc';
  if (path.includes('deal')) return 'deal';
  if (path.includes('requisition')) return 'requisition';
  if (path.includes('portfolio')) return 'portfolio';
  return 'unknown';
}

/**
 * Get deprecation statistics
 */
export async function getDeprecationStats(
  options?: {
    startDate?: Date;
    endDate?: Date;
    maxResults?: number;
  }
): Promise<DeprecationStats[]> {
  const maxResults = options?.maxResults || 10000;

  let q = query(
    collection(db, 'deprecationLogs'),
    orderBy('timestamp', 'desc'),
    limit(maxResults)
  );

  if (options?.startDate) {
    q = query(q, where('timestamp', '>=', Timestamp.fromDate(options.startDate)));
  }

  if (options?.endDate) {
    q = query(q, where('timestamp', '<=', Timestamp.fromDate(options.endDate)));
  }

  const snapshot = await getDocs(q);
  const logs = snapshot.docs.map(doc => doc.data() as DeprecationLog);

  // Aggregate by endpoint
  const statsMap = new Map<string, {
    calls: number;
    users: Set<string>;
    lastUsed: Date;
  }>();

  for (const log of logs) {
    const existing = statsMap.get(log.endpoint) || {
      calls: 0,
      users: new Set<string>(),
      lastUsed: new Date(0),
    };

    existing.calls++;
    if (log.userId) existing.users.add(log.userId);

    const logTime = log.timestamp?.toDate?.() || new Date();
    if (logTime > existing.lastUsed) {
      existing.lastUsed = logTime;
    }

    statsMap.set(log.endpoint, existing);
  }

  // Convert to stats array
  const stats: DeprecationStats[] = [];

  for (const [endpoint, data] of statsMap.entries()) {
    const deprecatedInfo = DEPRECATED_ENDPOINTS[endpoint];
    stats.push({
      endpoint,
      totalCalls: data.calls,
      uniqueUsers: data.users.size,
      lastUsed: data.lastUsed,
      deprecatedSince: deprecatedInfo ? new Date(deprecatedInfo.since) : new Date(),
    });
  }

  return stats.sort((a, b) => b.totalCalls - a.totalCalls);
}

/**
 * Get deprecation statistics by feature
 */
export async function getDeprecatedFeatureStats(
  options?: { maxResults?: number }
): Promise<Map<string, number>> {
  const maxResults = options?.maxResults || 10000;

  const q = query(
    collection(db, 'deprecationLogs'),
    orderBy('timestamp', 'desc'),
    limit(maxResults)
  );

  const snapshot = await getDocs(q);
  const featureCounts = new Map<string, number>();

  for (const doc of snapshot.docs) {
    const log = doc.data() as DeprecationLog;
    for (const feature of log.deprecatedFeatures) {
      featureCounts.set(feature, (featureCounts.get(feature) || 0) + 1);
    }
  }

  return featureCounts;
}

/**
 * Generate deprecation report
 */
export async function generateDeprecationReport(): Promise<string> {
  const stats = await getDeprecationStats();
  const featureStats = await getDeprecatedFeatureStats();

  let report = '# Deprecation Usage Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;

  // Endpoint usage section
  report += '## Deprecated Endpoint Usage\n\n';
  report += '| Endpoint | Total Calls | Unique Users | Last Used |\n';
  report += '|----------|-------------|--------------|----------|\n';

  for (const stat of stats) {
    report += `| ${stat.endpoint} | ${stat.totalCalls} | ${stat.uniqueUsers} | ${stat.lastUsed.toISOString().split('T')[0]} |\n`;
  }

  // Feature usage section
  report += '\n## Deprecated Feature Usage\n\n';
  report += '| Feature | Usage Count |\n';
  report += '|---------|-------------|\n';

  const sortedFeatures = Array.from(featureStats.entries())
    .sort((a, b) => b[1] - a[1]);

  for (const [feature, count] of sortedFeatures) {
    report += `| ${feature} | ${count} |\n`;
  }

  // Recommendations section
  report += '\n## Recommended Actions\n\n';

  for (const stat of stats.filter(s => s.totalCalls > 100)) {
    const replacement = DEPRECATED_ENDPOINTS[stat.endpoint]?.replacement;
    if (replacement) {
      report += `- **${stat.endpoint}**: ${stat.totalCalls} calls from ${stat.uniqueUsers} users - migrate to \`${replacement}\`\n`;
    }
  }

  return report;
}

/**
 * Check if endpoint is deprecated
 */
export function isEndpointDeprecated(endpoint: string): boolean {
  const endpointBase = endpoint.replace(/\/[a-zA-Z0-9_-]+$/, '');
  return Boolean(DEPRECATED_ENDPOINTS[endpoint] || DEPRECATED_ENDPOINTS[endpointBase]);
}

/**
 * Get replacement endpoint
 */
export function getReplacementEndpoint(endpoint: string): string | null {
  const endpointBase = endpoint.replace(/\/[a-zA-Z0-9_-]+$/, '');
  const info = DEPRECATED_ENDPOINTS[endpoint] || DEPRECATED_ENDPOINTS[endpointBase];
  return info?.replacement || null;
}

/**
 * Get sunset date for endpoint
 */
export function getSunsetDate(endpoint: string): Date | null {
  // All v5 endpoints sunset on June 1, 2026
  if (endpoint.includes('/v5/')) {
    return new Date('2026-06-01');
  }
  return null;
}
