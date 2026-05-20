/**
 * Response Transformer
 * Transforms v6 API responses to v5 format when needed
 */

import {
  APIResponse,
  APIVersion,
  V5ProgramResponse,
  V5ProjectResponse,
  V5IPCResponse,
  V5DealResponse,
  V6EngagementResponse,
  V6ProjectResponse,
  V6PaymentResponse,
  DeprecationWarning,
  PaginationMeta,
} from '../types/api-compat-types';
import { FieldMapper } from '../utils/field-mapper';
import { coerceToDateString } from '../utils/type-coercer';

export class ResponseTransformer {
  /**
   * Transform response based on requested version
   */
  static transformResponse<T>(
    data: any,
    entityType: string,
    targetVersion: APIVersion,
    sourceVersion: APIVersion = 'v6'
  ): APIResponse<T> {
    if (targetVersion === sourceVersion) {
      return {
        version: targetVersion,
        status: 200,
        data,
      };
    }

    // v6 to v5 transformation
    if (targetVersion === 'v5' && sourceVersion === 'v6') {
      const transformed = this.transformV6ToV5(data, entityType);
      return {
        version: 'v5',
        status: 200,
        data: transformed as T,
        meta: {
          deprecation: this.getDeprecationWarning(entityType),
        },
      };
    }

    return {
      version: targetVersion,
      status: 200,
      data,
    };
  }

  /**
   * Transform v6 data to v5 format
   */
  private static transformV6ToV5(data: any, entityType: string): any {
    if (Array.isArray(data)) {
      return data.map(item => this.transformSingleV6ToV5(item, entityType));
    }
    return this.transformSingleV6ToV5(data, entityType);
  }

  /**
   * Transform single entity from v6 to v5
   */
  private static transformSingleV6ToV5(data: any, entityType: string): any {
    if (!data) return null;

    switch (entityType) {
      case 'program':
      case 'engagement':
        return this.transformEngagementToProgram(data);

      case 'project':
        return this.transformV6ProjectToV5(data);

      case 'payment':
      case 'ipc':
        return this.transformPaymentToIPC(data);

      case 'deal':
        return this.transformEngagementToDeal(data);

      default:
        return FieldMapper.mapV6ToV5(data, { v5Entity: entityType, v6Entity: entityType, fields: [] });
    }
  }

  /**
   * Transform v6 Engagement to v5 Program
   */
  private static transformEngagementToProgram(
    engagement: V6EngagementResponse | Record<string, any>
  ): V5ProgramResponse {
    return {
      id: engagement.id,
      name: engagement.name || '',
      code: engagement.code || '',
      fundingSource: engagement.funding?.sources?.[0]?.name || 'Unknown',
      budget: engagement.funding?.totalBudget || 0,
      startDate: coerceToDateString(engagement.timeline?.startDate) || '',
      endDate: coerceToDateString(engagement.timeline?.endDate) || '',
      status: this.mapStatusV6ToV5(engagement.status),
      projects: [], // Deprecated - not populated
      description: engagement.description,
      createdAt: coerceToDateString(engagement.createdAt) || '',
      updatedAt: coerceToDateString(engagement.updatedAt) || '',
    };
  }

  /**
   * Transform v6 Engagement to v5 Deal
   */
  private static transformEngagementToDeal(
    engagement: V6EngagementResponse | Record<string, any>
  ): V5DealResponse {
    return {
      id: engagement.id,
      name: engagement.name || '',
      stage: this.mapStatusV6ToV5Deal(engagement.status),
      value: engagement.funding?.totalBudget || 0,
      sector: engagement.metadata?.sector || '',
      subsector: engagement.metadata?.subsector,
      projectId: engagement.metadata?.linkedProjectId,
      description: engagement.description,
      clientName: engagement.client?.name,
      dueDate: coerceToDateString(engagement.timeline?.endDate) || undefined,
      createdAt: coerceToDateString(engagement.createdAt) || '',
      updatedAt: coerceToDateString(engagement.updatedAt) || '',
    };
  }

  /**
   * Transform v6 Project to v5 format
   */
  private static transformV6ProjectToV5(
    project: V6ProjectResponse | Record<string, any>
  ): V5ProjectResponse {
    return {
      id: project.id,
      programId: project.engagementId || '',
      programName: project.engagement?.name || '',
      name: project.name || '',
      code: project.code || '',
      location: project.location?.name || '',
      contractor: project.contractor?.name || '',
      budget: project.budget?.allocated || 0,
      spent: project.budget?.spent || 0,
      progress: project.timeline?.percentComplete || 0,
      status: this.mapStatusV6ToV5(project.status),
      implementationType: project.implementationType || 'contractor',
      createdAt: coerceToDateString(project.createdAt) || '',
      updatedAt: coerceToDateString(project.updatedAt) || '',
    };
  }

  /**
   * Transform v6 Payment to v5 IPC
   */
  private static transformPaymentToIPC(
    payment: V6PaymentResponse | Record<string, any>
  ): V5IPCResponse {
    return {
      id: payment.id,
      projectId: payment.projectId || '',
      projectName: payment.project?.name || '',
      certificateNumber: payment.reference || '',
      periodFrom: coerceToDateString(payment.period?.from) || '',
      periodTo: coerceToDateString(payment.period?.to) || '',
      workDone: payment.amounts?.cumulative || 0,
      previousCertificates: payment.amounts?.previous || 0,
      currentCertificate: payment.amounts?.current || 0,
      retention: payment.amounts?.retention || 0,
      netPayable: payment.amounts?.net || 0,
      status: this.mapStatusV6ToV5(payment.status),
      createdAt: coerceToDateString(payment.createdAt) || '',
    };
  }

  /**
   * Map v6 status to v5 format
   */
  private static mapStatusV6ToV5(status: string | undefined): string {
    if (!status) return 'Draft';

    const mapping: Record<string, string> = {
      'active': 'Active',
      'in_progress': 'Active',
      'completed': 'Completed',
      'on_hold': 'On Hold',
      'cancelled': 'Cancelled',
      'planning': 'Planning',
      'draft': 'Draft',
      'submitted': 'Submitted',
      'approved': 'Approved',
      'paid': 'Paid',
      'rejected': 'Rejected',
      'certified': 'Certified',
      'pending_approval': 'Pending',
    };

    return mapping[status] || status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
  }

  /**
   * Map v6 status to v5 deal stage format
   */
  private static mapStatusV6ToV5Deal(status: string | undefined): string {
    if (!status) return 'Lead';

    const mapping: Record<string, string> = {
      'lead': 'Lead',
      'qualified': 'Qualified',
      'proposal': 'Proposal',
      'negotiation': 'Negotiation',
      'closed_won': 'Closed Won',
      'closed_lost': 'Closed Lost',
      'on_hold': 'On Hold',
    };

    return mapping[status] || status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  /**
   * Get deprecation warning for entity type
   */
  private static getDeprecationWarning(entityType: string): DeprecationWarning {
    const warnings: Record<string, DeprecationWarning> = {
      program: {
        message: 'The /api/v5/programs endpoint is deprecated. Please migrate to /api/v6/engagements.',
        deprecatedAt: '2025-12-01',
        sunsetDate: '2026-06-01',
        migrationGuide: 'https://docs.dawin.co/migration/v5-to-v6',
        replacementEndpoint: '/api/v6/engagements',
      },
      project: {
        message: 'Some fields in the v5 project response are deprecated. Please migrate to /api/v6/projects.',
        deprecatedAt: '2025-12-01',
        sunsetDate: '2026-06-01',
        migrationGuide: 'https://docs.dawin.co/migration/v5-to-v6#projects',
        replacementEndpoint: '/api/v6/projects',
      },
      ipc: {
        message: 'The /api/v5/ipcs endpoint is deprecated. Please use /api/v6/payments.',
        deprecatedAt: '2025-12-01',
        sunsetDate: '2026-06-01',
        migrationGuide: 'https://docs.dawin.co/migration/v5-to-v6#payments',
        replacementEndpoint: '/api/v6/payments',
      },
      payment: {
        message: 'The /api/v5/payments endpoint is deprecated. Please use /api/v6/payments.',
        deprecatedAt: '2025-12-01',
        sunsetDate: '2026-06-01',
        migrationGuide: 'https://docs.dawin.co/migration/v5-to-v6#payments',
        replacementEndpoint: '/api/v6/payments',
      },
      deal: {
        message: 'The /api/v5/deals endpoint is deprecated. Please use /api/v6/engagements with type="deal".',
        deprecatedAt: '2025-12-01',
        sunsetDate: '2026-06-01',
        migrationGuide: 'https://docs.dawin.co/migration/v5-to-v6#deals',
        replacementEndpoint: '/api/v6/engagements',
      },
    };

    return warnings[entityType] || {
      message: 'This endpoint is deprecated.',
      deprecatedAt: '2025-12-01',
      sunsetDate: '2026-06-01',
      migrationGuide: 'https://docs.dawin.co/migration/v5-to-v6',
    };
  }

  /**
   * Add pagination to response
   */
  static addPagination<T>(
    response: APIResponse<T[]>,
    page: number,
    pageSize: number,
    totalItems: number
  ): APIResponse<T[]> {
    const totalPages = Math.ceil(totalItems / pageSize);

    const pagination: PaginationMeta = {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };

    return {
      ...response,
      meta: {
        ...response.meta,
        pagination,
      },
    };
  }

  /**
   * Add HATEOAS links to response
   */
  static addLinks<T>(
    response: APIResponse<T>,
    baseUrl: string,
    resourceId?: string
  ): APIResponse<T> {
    const links: {
      self: string;
      next?: string;
      prev?: string;
      first?: string;
      last?: string;
    } = {
      self: resourceId ? `${baseUrl}/${resourceId}` : baseUrl,
    };

    if (response.meta?.pagination) {
      const { page, totalPages } = response.meta.pagination;
      if (page > 1) {
        links.prev = `${baseUrl}?page=${page - 1}`;
        links.first = `${baseUrl}?page=1`;
      }
      if (page < totalPages) {
        links.next = `${baseUrl}?page=${page + 1}`;
        links.last = `${baseUrl}?page=${totalPages}`;
      }
    }

    return {
      ...response,
      meta: {
        ...response.meta,
        links,
      },
    };
  }

  /**
   * Create error response
   */
  static createErrorResponse(
    status: number,
    message: string,
    version: APIVersion = 'v6'
  ): APIResponse<null> {
    return {
      version,
      status,
      data: null,
      meta: {
        warnings: [message],
      },
    };
  }
}
