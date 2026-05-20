/**
 * Request Transformer
 * Transforms v5 API requests to v6 format
 */

import { APIRequest, APIVersion, TransformResult } from '../types/api-compat-types';
import {
  FieldMapper,
  PROGRAM_MAPPING,
  PROJECT_MAPPING,
  IPC_MAPPING,
  DEAL_MAPPING,
  REQUISITION_MAPPING,
} from '../utils/field-mapper';
import { typeCoercer } from '../utils/type-coercer';

export class RequestTransformer {
  /**
   * Transform request body from v5 to v6
   */
  static transformRequest(
    request: APIRequest,
    entityType: string
  ): TransformResult {
    const warnings: string[] = [];

    if (request.version === 'v6' || !request.body) {
      return { transformed: request.body, warnings };
    }

    // Coerce types first
    const coercedBody = typeCoercer.coerce(request.body, entityType);

    let transformed: any;

    switch (entityType) {
      case 'program':
        transformed = this.transformProgramRequest(coercedBody, warnings);
        break;

      case 'project':
        transformed = this.transformProjectRequest(coercedBody, warnings);
        break;

      case 'ipc':
      case 'payment':
        transformed = this.transformIPCRequest(coercedBody, warnings);
        break;

      case 'deal':
        transformed = this.transformDealRequest(coercedBody, warnings);
        break;

      case 'requisition':
        transformed = this.transformRequisitionRequest(coercedBody, warnings);
        break;

      default:
        transformed = coercedBody;
    }

    return { transformed, warnings };
  }

  /**
   * Transform program request (v5 -> v6 engagement)
   */
  private static transformProgramRequest(
    body: Record<string, any>,
    warnings: string[]
  ): Record<string, any> {
    const transformed = FieldMapper.mapV5ToV6(body, PROGRAM_MAPPING);

    // Add v6-specific fields
    transformed.type = 'program';

    // Build proper funding structure
    if (body.fundingSource || body.budget) {
      transformed.funding = {
        type: this.resolveFundingType(body.fundingSource),
        sources: [{
          name: body.fundingSource || 'Unknown',
          type: this.resolveFundingType(body.fundingSource),
          amount: body.budget || 0,
          percentage: 100,
        }],
        totalBudget: body.budget || 0,
        currency: 'UGX',
      };
    }

    // Build timeline structure
    if (body.startDate || body.endDate) {
      transformed.timeline = {
        startDate: body.startDate || null,
        endDate: body.endDate || null,
        milestones: [],
      };
    }

    // Warn about deprecated fields
    if (body.projects) {
      warnings.push('Field "projects" is deprecated. Project associations are managed via engagementId on projects.');
    }

    return transformed;
  }

  /**
   * Transform project request
   */
  private static transformProjectRequest(
    body: Record<string, any>,
    warnings: string[]
  ): Record<string, any> {
    const transformed = FieldMapper.mapV5ToV6(body, PROJECT_MAPPING);

    // Map programId to engagementId
    if (body.programId && !transformed.engagementId) {
      transformed.engagementId = body.programId;
      warnings.push('Field "programId" is deprecated. Use "engagementId" instead.');
    }

    // Build location structure
    if (body.location && typeof body.location === 'string') {
      transformed.location = { name: body.location };
    }

    // Build contractor structure
    if (body.contractor && typeof body.contractor === 'string') {
      transformed.contractor = { name: body.contractor };
    }

    // Build budget structure
    if (body.budget !== undefined) {
      transformed.budget = {
        allocated: body.budget || 0,
        committed: 0,
        spent: body.spent || 0,
        currency: 'UGX',
      };
    }

    // Build timeline structure
    if (body.progress !== undefined) {
      transformed.timeline = {
        ...transformed.timeline,
        percentComplete: body.progress || 0,
      };
    }

    return transformed;
  }

  /**
   * Transform IPC request (v5 -> v6 payment)
   */
  private static transformIPCRequest(
    body: Record<string, any>,
    warnings: string[]
  ): Record<string, any> {
    const transformed = FieldMapper.mapV5ToV6(body, IPC_MAPPING);

    // Add payment type
    transformed.type = 'ipc';

    // Map certificate number to reference
    if (body.certificateNumber) {
      transformed.reference = body.certificateNumber;
    }

    // Build period structure
    if (body.periodFrom || body.periodTo) {
      transformed.period = {
        from: body.periodFrom,
        to: body.periodTo,
      };
    }

    // Build amounts structure
    transformed.amounts = {
      cumulative: body.workDone || 0,
      previous: body.previousCertificates || 0,
      current: body.currentCertificate || 0,
      retention: body.retention || 0,
      net: body.netPayable || (body.currentCertificate - (body.retention || 0)),
    };

    // Warn about deprecated field names
    if (body.workDone !== undefined) {
      warnings.push('Field "workDone" is deprecated. Use "amounts.cumulative" instead.');
    }
    if (body.netPayable !== undefined) {
      warnings.push('Field "netPayable" is deprecated. Use "amounts.net" instead.');
    }

    return transformed;
  }

  /**
   * Transform deal request (v5 -> v6 engagement)
   */
  private static transformDealRequest(
    body: Record<string, any>,
    _warnings: string[]
  ): Record<string, any> {
    const transformed = FieldMapper.mapV5ToV6(body, DEAL_MAPPING);

    // Add engagement type
    transformed.type = 'deal';

    // Build funding structure from value
    if (body.value) {
      transformed.funding = {
        type: 'private',
        sources: [{
          name: body.sector || 'Investment',
          type: 'private',
          amount: body.value,
          percentage: 100,
        }],
        totalBudget: body.value,
        currency: 'USD',
      };
    }

    // Build timeline from dueDate
    if (body.dueDate) {
      transformed.timeline = {
        startDate: body.createdAt || null,
        endDate: body.dueDate,
        milestones: [],
      };
    }

    // Store sector info in metadata
    if (body.sector || body.subsector || body.projectId) {
      transformed.metadata = {
        sector: body.sector,
        subsector: body.subsector,
        linkedProjectId: body.projectId,
      };
    }

    return transformed;
  }

  /**
   * Transform requisition request (v5 -> v6 payment)
   */
  private static transformRequisitionRequest(
    body: Record<string, any>,
    _warnings: string[]
  ): Record<string, any> {
    const transformed = FieldMapper.mapV5ToV6(body, REQUISITION_MAPPING);

    // Add payment type
    transformed.type = 'requisition';

    // Map requisition number to reference
    if (body.requisitionNumber) {
      transformed.reference = body.requisitionNumber;
    }

    // Build amounts structure
    transformed.amounts = {
      cumulative: body.amount || 0,
      previous: 0,
      current: body.amount || 0,
      retention: 0,
      net: body.amount || 0,
    };

    // Map items to lineItems
    if (body.items && Array.isArray(body.items)) {
      transformed.lineItems = body.items;
    }

    return transformed;
  }

  /**
   * Transform query parameters
   */
  static transformQueryParams(
    params: Record<string, string>,
    entityType: string,
    fromVersion: APIVersion
  ): TransformResult {
    const warnings: string[] = [];
    const transformed = { ...params };

    if (fromVersion === 'v5') {
      const paramMappings: Record<string, Record<string, string>> = {
        program: {
          fundingSource: 'funding.type',
          programStatus: 'status',
        },
        project: {
          programId: 'engagementId',
          projectStatus: 'status',
        },
        ipc: {
          ipcStatus: 'status',
          certificateNumber: 'reference',
        },
        deal: {
          stage: 'status',
          dealValue: 'funding.totalBudget',
        },
      };

      const mappings = paramMappings[entityType] || {};

      for (const [oldKey, newKey] of Object.entries(mappings)) {
        if (transformed[oldKey]) {
          transformed[newKey] = transformed[oldKey];
          delete transformed[oldKey];
          warnings.push(`Query param "${oldKey}" is deprecated. Use "${newKey}" instead.`);
        }
      }
    }

    return { transformed, warnings };
  }

  /**
   * Transform sort parameters
   */
  static transformSortParams(
    sort: string | undefined,
    entityType: string,
    fromVersion: APIVersion
  ): string | undefined {
    if (!sort || fromVersion === 'v6') return sort;

    const sortMappings: Record<string, Record<string, string>> = {
      program: {
        budget: 'funding.totalBudget',
        startDate: 'timeline.startDate',
        endDate: 'timeline.endDate',
      },
      project: {
        budget: 'budget.allocated',
        spent: 'budget.spent',
        progress: 'timeline.percentComplete',
        programId: 'engagementId',
      },
      ipc: {
        workDone: 'amounts.cumulative',
        netPayable: 'amounts.net',
        certificateNumber: 'reference',
      },
    };

    const mappings = sortMappings[entityType] || {};
    const direction = sort.startsWith('-') ? '-' : '';
    const field = sort.replace(/^-/, '');

    return direction + (mappings[field] || field);
  }

  /**
   * Resolve funding type from source name
   */
  private static resolveFundingType(source: string | undefined): string {
    if (!source) return 'grant';

    const lower = source.toLowerCase();
    if (lower.includes('government') || lower.includes('gou')) return 'government';
    if (lower.includes('private')) return 'private';
    if (lower.includes('mixed') || lower.includes('blend')) return 'mixed';
    return 'grant';
  }
}
