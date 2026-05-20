/**
 * Field Mapper
 * Maps fields between v5 and v6 schemas
 */

import { EntityMapping } from '../types/api-compat-types';

// ============================================================================
// Status Transformers
// ============================================================================

function transformStatus(value: string, direction: 'v5_to_v6' | 'v6_to_v5'): string {
  const v5ToV6: Record<string, string> = {
    'Active': 'active',
    'Completed': 'completed',
    'On Hold': 'on_hold',
    'Cancelled': 'cancelled',
    'Planning': 'planning',
    'Draft': 'draft',
    'Suspended': 'on_hold',
    'Closed': 'completed',
  };

  const v6ToV5: Record<string, string> = {
    'active': 'Active',
    'completed': 'Completed',
    'on_hold': 'On Hold',
    'cancelled': 'Cancelled',
    'planning': 'Planning',
    'in_progress': 'Active',
    'draft': 'Draft',
  };

  if (direction === 'v5_to_v6') {
    return v5ToV6[value] || value.toLowerCase().replace(/\s+/g, '_');
  } else {
    return v6ToV5[value] || value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
  }
}

function transformPaymentStatus(value: string, direction: 'v5_to_v6' | 'v6_to_v5'): string {
  const v5ToV6: Record<string, string> = {
    'Draft': 'draft',
    'Submitted': 'submitted',
    'Certified': 'certified',
    'Approved': 'approved',
    'Paid': 'paid',
    'Rejected': 'rejected',
    'Pending': 'pending_approval',
  };

  const v6ToV5: Record<string, string> = {
    'draft': 'Draft',
    'submitted': 'Submitted',
    'certified': 'Certified',
    'approved': 'Approved',
    'paid': 'Paid',
    'rejected': 'Rejected',
    'pending_approval': 'Pending',
  };

  if (direction === 'v5_to_v6') {
    return v5ToV6[value] || value.toLowerCase();
  } else {
    return v6ToV5[value] || value.charAt(0).toUpperCase() + value.slice(1);
  }
}

function transformDealStage(value: string, direction: 'v5_to_v6' | 'v6_to_v5'): string {
  const v5ToV6: Record<string, string> = {
    'Lead': 'lead',
    'Qualified': 'qualified',
    'Proposal': 'proposal',
    'Negotiation': 'negotiation',
    'Closed Won': 'closed_won',
    'Closed Lost': 'closed_lost',
    'On Hold': 'on_hold',
  };

  const v6ToV5: Record<string, string> = {
    'lead': 'Lead',
    'qualified': 'Qualified',
    'proposal': 'Proposal',
    'negotiation': 'Negotiation',
    'closed_won': 'Closed Won',
    'closed_lost': 'Closed Lost',
    'on_hold': 'On Hold',
  };

  if (direction === 'v5_to_v6') {
    return v5ToV6[value] || value.toLowerCase().replace(/\s+/g, '_');
  } else {
    return v6ToV5[value] || value.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
}

// ============================================================================
// Entity Mappings
// ============================================================================

// Program -> Engagement mapping
export const PROGRAM_MAPPING: EntityMapping = {
  v5Entity: 'program',
  v6Entity: 'engagement',
  fields: [
    { v5Field: 'id', v6Field: 'id', required: true },
    { v5Field: 'name', v6Field: 'name', required: true },
    { v5Field: 'code', v6Field: 'code', required: true },
    { v5Field: 'fundingSource', v6Field: 'funding.sources[0].name' },
    { v5Field: 'budget', v6Field: 'funding.totalBudget' },
    { v5Field: 'startDate', v6Field: 'timeline.startDate' },
    { v5Field: 'endDate', v6Field: 'timeline.endDate' },
    { v5Field: 'status', v6Field: 'status', transform: transformStatus },
    { v5Field: 'description', v6Field: 'description' },
    { v5Field: 'projects', v6Field: 'metrics.projectIds', deprecated: true },
    { v5Field: 'createdAt', v6Field: 'createdAt' },
    { v5Field: 'updatedAt', v6Field: 'updatedAt' },
  ],
};

// Project mapping
export const PROJECT_MAPPING: EntityMapping = {
  v5Entity: 'project',
  v6Entity: 'project',
  fields: [
    { v5Field: 'id', v6Field: 'id', required: true },
    { v5Field: 'programId', v6Field: 'engagementId', deprecated: true },
    { v5Field: 'programName', v6Field: 'engagement.name' },
    { v5Field: 'name', v6Field: 'name', required: true },
    { v5Field: 'code', v6Field: 'code', required: true },
    { v5Field: 'location', v6Field: 'location.name' },
    { v5Field: 'contractor', v6Field: 'contractor.name' },
    { v5Field: 'budget', v6Field: 'budget.allocated' },
    { v5Field: 'spent', v6Field: 'budget.spent' },
    { v5Field: 'progress', v6Field: 'timeline.percentComplete' },
    { v5Field: 'status', v6Field: 'status', transform: transformStatus },
    { v5Field: 'implementationType', v6Field: 'implementationType' },
    { v5Field: 'createdAt', v6Field: 'createdAt' },
    { v5Field: 'updatedAt', v6Field: 'updatedAt' },
  ],
};

// IPC -> Payment mapping
export const IPC_MAPPING: EntityMapping = {
  v5Entity: 'ipc',
  v6Entity: 'payment',
  fields: [
    { v5Field: 'id', v6Field: 'id', required: true },
    { v5Field: 'projectId', v6Field: 'projectId', required: true },
    { v5Field: 'projectName', v6Field: 'project.name' },
    { v5Field: 'certificateNumber', v6Field: 'reference' },
    { v5Field: 'periodFrom', v6Field: 'period.from' },
    { v5Field: 'periodTo', v6Field: 'period.to' },
    { v5Field: 'workDone', v6Field: 'amounts.cumulative' },
    { v5Field: 'previousCertificates', v6Field: 'amounts.previous' },
    { v5Field: 'currentCertificate', v6Field: 'amounts.current' },
    { v5Field: 'retention', v6Field: 'amounts.retention' },
    { v5Field: 'netPayable', v6Field: 'amounts.net' },
    { v5Field: 'status', v6Field: 'status', transform: transformPaymentStatus },
    { v5Field: 'createdAt', v6Field: 'createdAt' },
  ],
};

// Deal mapping
export const DEAL_MAPPING: EntityMapping = {
  v5Entity: 'deal',
  v6Entity: 'engagement',
  fields: [
    { v5Field: 'id', v6Field: 'id', required: true },
    { v5Field: 'name', v6Field: 'name', required: true },
    { v5Field: 'stage', v6Field: 'status', transform: transformDealStage },
    { v5Field: 'value', v6Field: 'funding.totalBudget' },
    { v5Field: 'sector', v6Field: 'metadata.sector' },
    { v5Field: 'subsector', v6Field: 'metadata.subsector' },
    { v5Field: 'projectId', v6Field: 'metadata.linkedProjectId' },
    { v5Field: 'description', v6Field: 'description' },
    { v5Field: 'clientName', v6Field: 'client.name' },
    { v5Field: 'dueDate', v6Field: 'timeline.endDate' },
    { v5Field: 'createdAt', v6Field: 'createdAt' },
    { v5Field: 'updatedAt', v6Field: 'updatedAt' },
  ],
};

// Requisition mapping
export const REQUISITION_MAPPING: EntityMapping = {
  v5Entity: 'requisition',
  v6Entity: 'payment',
  fields: [
    { v5Field: 'id', v6Field: 'id', required: true },
    { v5Field: 'projectId', v6Field: 'projectId', required: true },
    { v5Field: 'projectName', v6Field: 'project.name' },
    { v5Field: 'requisitionNumber', v6Field: 'reference' },
    { v5Field: 'amount', v6Field: 'amounts.current' },
    { v5Field: 'type', v6Field: 'metadata.requisitionType' },
    { v5Field: 'status', v6Field: 'status', transform: transformPaymentStatus },
    { v5Field: 'description', v6Field: 'description' },
    { v5Field: 'items', v6Field: 'lineItems' },
    { v5Field: 'createdAt', v6Field: 'createdAt' },
  ],
};

// ============================================================================
// Field Mapper Class
// ============================================================================

export class FieldMapper {
  /**
   * Map object from v5 to v6 format
   */
  static mapV5ToV6<T = any>(
    data: Record<string, any>,
    mapping: EntityMapping
  ): T {
    const result: Record<string, any> = {};

    for (const field of mapping.fields) {
      const v5Value = this.getNestedValue(data, field.v5Field);

      if (v5Value !== undefined) {
        const transformedValue = field.transform
          ? field.transform(v5Value, 'v5_to_v6')
          : v5Value;

        this.setNestedValue(result, field.v6Field, transformedValue);
      }
    }

    return result as T;
  }

  /**
   * Map object from v6 to v5 format
   */
  static mapV6ToV5<T = any>(
    data: Record<string, any>,
    mapping: EntityMapping
  ): T {
    const result: Record<string, any> = {};

    for (const field of mapping.fields) {
      // Include deprecated fields in v6->v5 for backward compatibility
      const v6Value = this.getNestedValue(data, field.v6Field);

      if (v6Value !== undefined) {
        const transformedValue = field.transform
          ? field.transform(v6Value, 'v6_to_v5')
          : v6Value;

        this.setNestedValue(result, field.v5Field, transformedValue);
      }
    }

    return result as T;
  }

  /**
   * Map array of objects
   */
  static mapArrayV5ToV6<T = any>(
    data: Record<string, any>[],
    mapping: EntityMapping
  ): T[] {
    return data.map(item => this.mapV5ToV6<T>(item, mapping));
  }

  /**
   * Map array of objects
   */
  static mapArrayV6ToV5<T = any>(
    data: Record<string, any>[],
    mapping: EntityMapping
  ): T[] {
    return data.map(item => this.mapV6ToV5<T>(item, mapping));
  }

  /**
   * Get nested value from object using dot notation
   */
  static getNestedValue(obj: any, path: string): any {
    if (!obj || !path) return undefined;

    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      // Handle array notation like "sources[0]"
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, key, index] = arrayMatch;
        current = current?.[key]?.[parseInt(index)];
      } else {
        current = current?.[part];
      }

      if (current === undefined) break;
    }

    return current;
  }

  /**
   * Set nested value in object using dot notation
   */
  static setNestedValue(obj: any, path: string, value: any): void {
    if (!obj || !path) return;

    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];

      // Handle array notation
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, key, index] = arrayMatch;
        if (!current[key]) current[key] = [];
        if (!current[key][parseInt(index)]) current[key][parseInt(index)] = {};
        current = current[key][parseInt(index)];
      } else {
        if (!current[part]) current[part] = {};
        current = current[part];
      }
    }

    const lastPart = parts[parts.length - 1];
    const arrayMatch = lastPart.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, index] = arrayMatch;
      if (!current[key]) current[key] = [];
      current[key][parseInt(index)] = value;
    } else {
      current[lastPart] = value;
    }
  }

  /**
   * Get mapping for entity type
   */
  static getMappingForEntity(entityType: string): EntityMapping | null {
    const mappings: Record<string, EntityMapping> = {
      program: PROGRAM_MAPPING,
      project: PROJECT_MAPPING,
      ipc: IPC_MAPPING,
      payment: IPC_MAPPING,
      deal: DEAL_MAPPING,
      requisition: REQUISITION_MAPPING,
    };

    return mappings[entityType] || null;
  }
}
