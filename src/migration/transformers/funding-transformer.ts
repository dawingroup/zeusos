/**
 * Funding Transformer
 * Utilities for transforming funding configurations
 */

import { V6FundingConfig, V6FundingSource } from '../types/migration-types';

// Funding source type mapping
const FUNDING_SOURCE_TYPES: Record<string, V6FundingConfig['type']> = {
  // Government sources
  'GoU': 'government',
  'Government': 'government',
  'Government of Uganda': 'government',
  'Budget': 'government',
  'Treasury': 'government',
  
  // Grant/Donor sources
  'AMH': 'grant',
  'Grant': 'grant',
  'Donor': 'grant',
  'World Bank': 'grant',
  'AfDB': 'grant',
  'African Development Bank': 'grant',
  'EU': 'grant',
  'European Union': 'grant',
  'USAID': 'grant',
  'JICA': 'grant',
  'DFID': 'grant',
  'GIZ': 'grant',
  'UNDP': 'grant',
  'UNICEF': 'grant',
  
  // Private sources
  'Private': 'private',
  'Private Sector': 'private',
  'Equity': 'private',
  'Debt': 'private',
  'Investment': 'private',
  
  // Mixed sources
  'Mixed': 'mixed',
  'PPP': 'mixed',
  'Blended': 'mixed',
};

/**
 * Create funding config from a single source
 */
export function createFundingConfig(
  sourceName: string,
  amount: number,
  currency: string = 'UGX'
): V6FundingConfig {
  const type = resolveFundingType(sourceName);
  
  return {
    type,
    sources: [{
      name: sourceName,
      type,
      amount,
      percentage: 100,
    }],
    totalBudget: amount,
    currency,
  };
}

/**
 * Create funding config from multiple sources
 */
export function createMultiSourceFunding(
  sources: Array<{ name: string; amount: number }>,
  currency: string = 'UGX'
): V6FundingConfig {
  const totalBudget = sources.reduce((sum, s) => sum + s.amount, 0);
  
  const fundingSources: V6FundingSource[] = sources.map(s => ({
    name: s.name,
    type: resolveFundingType(s.name),
    amount: s.amount,
    percentage: totalBudget > 0 ? (s.amount / totalBudget) * 100 : 0,
  }));
  
  const types = new Set(fundingSources.map(s => s.type));
  let overallType: V6FundingConfig['type'] = 'grant';
  
  if (types.size > 1) {
    overallType = 'mixed';
  } else if (types.size === 1) {
    overallType = fundingSources[0].type as V6FundingConfig['type'];
  }
  
  return {
    type: overallType,
    sources: fundingSources,
    totalBudget,
    currency,
  };
}

/**
 * Resolve funding type from source name
 */
export function resolveFundingType(sourceName: string): V6FundingConfig['type'] {
  if (!sourceName) return 'grant';
  
  // Check exact match first
  if (FUNDING_SOURCE_TYPES[sourceName]) {
    return FUNDING_SOURCE_TYPES[sourceName];
  }
  
  // Check partial matches
  const lower = sourceName.toLowerCase();
  
  if (lower.includes('government') || lower.includes('gou') || lower.includes('budget')) {
    return 'government';
  }
  
  if (lower.includes('private') || lower.includes('equity') || lower.includes('debt')) {
    return 'private';
  }
  
  if (lower.includes('mixed') || lower.includes('blend') || lower.includes('ppp')) {
    return 'mixed';
  }
  
  // Default to grant for donor-like sources
  return 'grant';
}

/**
 * Merge funding configs
 */
export function mergeFundingConfigs(
  configs: V6FundingConfig[]
): V6FundingConfig {
  if (configs.length === 0) {
    return {
      type: 'grant',
      sources: [],
      totalBudget: 0,
      currency: 'UGX',
    };
  }
  
  if (configs.length === 1) {
    return configs[0];
  }
  
  const allSources: V6FundingSource[] = [];
  let totalBudget = 0;
  const currency = configs[0].currency;
  
  for (const config of configs) {
    totalBudget += config.totalBudget;
    allSources.push(...config.sources);
  }
  
  // Recalculate percentages
  const normalizedSources = allSources.map(s => ({
    ...s,
    percentage: totalBudget > 0 ? (s.amount / totalBudget) * 100 : 0,
  }));
  
  const types = new Set(normalizedSources.map(s => s.type));
  const overallType: V6FundingConfig['type'] = types.size > 1 ? 'mixed' : 
    (normalizedSources[0]?.type as V6FundingConfig['type']) || 'grant';
  
  return {
    type: overallType,
    sources: normalizedSources,
    totalBudget,
    currency,
  };
}

/**
 * Validate funding config
 */
export function validateFundingConfig(config: V6FundingConfig): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!config.type) {
    errors.push('Funding type is required');
  }
  
  if (config.totalBudget < 0) {
    errors.push('Total budget cannot be negative');
  }
  
  if (!config.currency) {
    errors.push('Currency is required');
  }
  
  if (config.sources.length === 0 && config.totalBudget > 0) {
    errors.push('Funding sources are required when total budget is positive');
  }
  
  const sourcesTotal = config.sources.reduce((sum, s) => sum + s.amount, 0);
  if (Math.abs(sourcesTotal - config.totalBudget) > 0.01) {
    errors.push(`Sources total (${sourcesTotal}) does not match total budget (${config.totalBudget})`);
  }
  
  const percentageTotal = config.sources.reduce((sum, s) => sum + s.percentage, 0);
  if (config.sources.length > 0 && Math.abs(percentageTotal - 100) > 0.1) {
    errors.push(`Source percentages total (${percentageTotal.toFixed(1)}%) should equal 100%`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Format funding for display
 */
export function formatFundingDisplay(config: V6FundingConfig): string {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: config.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(config.totalBudget);
  
  return `${formattedAmount} (${config.type})`;
}
