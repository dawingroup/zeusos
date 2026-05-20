/**
 * Engagement Transformer
 * Utilities for transforming various entity types to engagements
 */

import { Timestamp } from 'firebase/firestore';
import {
  V5Program,
  V5Deal,
  V6Engagement,
  V6FundingConfig,
  TransformationMap,
} from '../types/migration-types';

// Program to Engagement transformation maps
export const PROGRAM_TRANSFORMATION_MAPS: TransformationMap[] = [
  { sourceField: 'name', targetField: 'name', required: true },
  { sourceField: 'code', targetField: 'code', required: true },
  { sourceField: 'budget', targetField: 'funding.totalBudget', required: false, defaultValue: 0 },
  { sourceField: 'status', targetField: 'status', transform: mapProgramStatus, required: false, defaultValue: 'active' },
  { sourceField: 'startDate', targetField: 'timeline.startDate', transform: normalizeDate, required: false },
  { sourceField: 'endDate', targetField: 'timeline.endDate', transform: normalizeDate, required: false },
  { sourceField: 'description', targetField: 'description', required: false },
];

// Deal to Engagement transformation maps
export const DEAL_TRANSFORMATION_MAPS: TransformationMap[] = [
  { sourceField: 'name', targetField: 'name', required: true },
  { sourceField: 'value', targetField: 'funding.totalBudget', required: false, defaultValue: 0 },
  { sourceField: 'stage', targetField: 'status', transform: mapDealStage, required: false, defaultValue: 'lead' },
  { sourceField: 'sector', targetField: 'metadata.sector', required: false },
  { sourceField: 'description', targetField: 'description', required: false },
];

/**
 * Transform a program to an engagement
 */
export function transformProgramToEngagement(
  program: V5Program,
  clientId: string
): V6Engagement {
  const fundingType = resolveFundingType(program.fundingSource);

  return {
    id: program.id,
    type: 'program',
    name: program.name,
    code: program.code || generateCode(program.name, 'PRG'),
    clientId,
    status: mapProgramStatus(program.status),
    funding: {
      type: fundingType,
      sources: [{
        name: program.fundingSource || 'Unknown',
        type: fundingType,
        amount: program.budget || 0,
        percentage: 100,
      }],
      totalBudget: program.budget || 0,
      currency: 'UGX',
    },
    timeline: {
      startDate: normalizeDate(program.startDate),
      endDate: normalizeDate(program.endDate),
      milestones: [],
    },
    description: program.description,
    createdAt: normalizeDate(program.createdAt) || Timestamp.now(),
    updatedAt: Timestamp.now(),
    migratedFrom: {
      version: 'v5.0',
      sourceId: program.id,
      sourceCollection: 'programs',
      migratedAt: Timestamp.now(),
    },
  };
}

/**
 * Transform a deal to an engagement
 */
export function transformDealToEngagement(
  deal: V5Deal,
  clientId: string
): V6Engagement {
  const fundingType = resolveSectorFundingType(deal.sector);

  return {
    id: `deal_${deal.id}`,
    type: 'deal',
    name: deal.name,
    code: generateCode(deal.name, 'DEAL'),
    clientId,
    status: mapDealStage(deal.stage),
    funding: {
      type: fundingType,
      sources: [{
        name: deal.sector || 'Private',
        type: fundingType,
        amount: deal.value || 0,
        percentage: 100,
      }],
      totalBudget: deal.value || 0,
      currency: 'USD',
    },
    timeline: {
      startDate: normalizeDate(deal.createdAt),
      endDate: normalizeDate(deal.dueDate),
      milestones: [],
    },
    description: deal.description,
    metadata: {
      sector: deal.sector,
      subsector: deal.subsector,
      linkedProjectId: deal.projectId,
    },
    createdAt: normalizeDate(deal.createdAt) || Timestamp.now(),
    updatedAt: Timestamp.now(),
    migratedFrom: {
      version: 'v5.0',
      sourceId: deal.id,
      sourceCollection: 'deals',
      migratedAt: Timestamp.now(),
    },
  };
}

/**
 * Apply transformation maps to source data
 */
export function applyTransformationMaps(
  source: Record<string, any>,
  maps: TransformationMap[]
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const map of maps) {
    let value = getNestedValue(source, map.sourceField);

    if (value === undefined || value === null) {
      if (map.required) {
        throw new Error(`Missing required field: ${map.sourceField}`);
      }
      value = map.defaultValue;
    }

    if (map.transform && value !== undefined) {
      value = map.transform(value, source);
    }

    if (value !== undefined) {
      setNestedValue(result, map.targetField, value);
    }
  }

  return result;
}

// Helper functions

function mapProgramStatus(status: string | undefined): string {
  const statusMap: Record<string, string> = {
    'Active': 'active',
    'Completed': 'completed',
    'On Hold': 'on_hold',
    'Cancelled': 'cancelled',
    'Draft': 'draft',
    'Planning': 'planning',
  };
  return statusMap[status || ''] || 'active';
}

function mapDealStage(stage: string | undefined): string {
  const stageMap: Record<string, string> = {
    'Lead': 'lead',
    'Qualified': 'qualified',
    'Proposal': 'proposal',
    'Negotiation': 'negotiation',
    'Closed Won': 'closed_won',
    'Closed Lost': 'closed_lost',
  };
  return stageMap[stage || ''] || 'lead';
}

function resolveFundingType(source: string | undefined): V6FundingConfig['type'] {
  if (!source) return 'grant';
  const lower = source.toLowerCase();
  if (lower.includes('government') || lower.includes('gou')) return 'government';
  if (lower.includes('private')) return 'private';
  if (lower.includes('mixed')) return 'mixed';
  return 'grant';
}

function resolveSectorFundingType(sector: string | undefined): V6FundingConfig['type'] {
  const sectorMap: Record<string, V6FundingConfig['type']> = {
    'Infrastructure': 'government',
    'Agriculture': 'mixed',
    'Energy': 'private',
    'Technology': 'private',
    'Healthcare': 'mixed',
    'Education': 'government',
  };
  return sectorMap[sector || ''] || 'private';
}

function normalizeDate(date: any): Timestamp | null {
  if (!date) return null;
  if (date instanceof Timestamp) return date;
  if (date instanceof Date) return Timestamp.fromDate(date);
  if (date.toDate) return Timestamp.fromDate(date.toDate());
  if (typeof date === 'string') {
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      return Timestamp.fromDate(parsed);
    }
  }
  return null;
}

function generateCode(name: string, prefix: string): string {
  const initials = name
    .split(' ')
    .map(w => w[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 4);
  const suffix = Date.now().toString(36).slice(-4).toUpperCase();
  return `${prefix}_${initials}_${suffix}`;
}

function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((curr, key) => curr?.[key], obj);
}

function setNestedValue(obj: Record<string, any>, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((curr, key) => {
    if (!curr[key]) curr[key] = {};
    return curr[key];
  }, obj);
  target[lastKey] = value;
}
