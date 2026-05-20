import { Money } from './money';
import { FundingCategory } from './funding-category';

/**
 * CONCESSION LEVEL
 */
export type ConcessionLevel = 
  | 'none'          // Fully commercial
  | 'low'           // < 20% concessional
  | 'moderate'      // 20-50% concessional
  | 'high'          // > 50% concessional
  | 'fully';        // 100% concessional/grant

/**
 * FUNDING SOURCE REF
 * Lightweight reference for blended finance analysis
 */
export interface FundingSourceRef {
  id: string;
  category: FundingCategory;
  funderName: string;
  committedAmount: Money;
  disbursedAmount: Money;
}

/**
 * LAYER ANALYSIS
 */
export interface LayerAnalysis {
  /** Amount in this layer */
  amount: Money;
  
  /** Percentage of total */
  percentageOfTotal: number;
  
  /** Number of sources in this layer */
  sourceCount: number;
  
  /** Source IDs in this layer */
  sourceIds: string[];
  
  /** Weighted average cost (for debt/concessional) */
  weightedAverageCost: number;
}

/**
 * BLENDED FINANCE STRUCTURE
 * Analysis of blended finance in an engagement
 */
export interface BlendedFinanceStructure {
  /** Is this a blended finance engagement */
  isBlendedFinance: boolean;
  
  /** Number of funding sources */
  sourceCount: number;
  
  /** Categories present */
  categoriesPresent: FundingCategory[];
  
  /** Total engagement value */
  totalValue: Money;
  
  /** Grant/first-loss layer analysis */
  grantLayer: LayerAnalysis;
  
  /** Concessional layer analysis */
  concessionalLayer: LayerAnalysis;
  
  /** Commercial layer analysis */
  commercialLayer: LayerAnalysis;
  
  /** Government layer analysis */
  governmentLayer: LayerAnalysis;
  
  /** Leverage ratio (commercial / concessional+grant) */
  leverageRatio: number;
  
  /** Blended cost of capital (weighted average) */
  blendedCostOfCapital: number;
  
  /** Concessionality level */
  concessionality: ConcessionLevel;
  
  /** Mobilization ratio (total / DFI contribution) */
  mobilizationRatio: number;
}

/**
 * Create empty layer analysis
 */
export function createEmptyLayer(currency: string): LayerAnalysis {
  return {
    amount: { amount: 0, currency },
    percentageOfTotal: 0,
    sourceCount: 0,
    sourceIds: [],
    weightedAverageCost: 0,
  };
}

/**
 * Analyze blended finance structure
 */
export function analyzeBlendedFinance(
  sources: FundingSourceRef[],
  baseCurrency: string = 'USD'
): BlendedFinanceStructure {
  const categories = new Set<FundingCategory>();
  sources.forEach(s => categories.add(s.category));
  
  const categoriesPresent = Array.from(categories);
  const isBlendedFinance = categoriesPresent.length > 1 || (
    categoriesPresent.includes('grant') && sources.length > 1
  );
  
  // Calculate total value
  const totalAmount = sources.reduce((sum, s) => sum + s.committedAmount.amount, 0);
  const totalValue: Money = { amount: totalAmount, currency: baseCurrency };
  
  // Helper to calculate layer
  const calcLayer = (categoryFilter: FundingCategory[]): LayerAnalysis => {
    const layerSources = sources.filter(s => categoryFilter.includes(s.category));
    const amount = layerSources.reduce((sum, s) => sum + s.committedAmount.amount, 0);
    
    return {
      amount: { amount, currency: baseCurrency },
      percentageOfTotal: totalAmount > 0 ? (amount / totalAmount) * 100 : 0,
      sourceCount: layerSources.length,
      sourceIds: layerSources.map(s => s.id),
      weightedAverageCost: 0, // Would need terms to calculate
    };
  };
  
  const grantLayer = calcLayer(['grant', 'guarantee']);
  const concessionalLayer = calcLayer(['concessional']);
  const commercialLayer = calcLayer(['commercial_debt', 'equity']);
  const governmentLayer = calcLayer(['government']);
  
  // Calculate leverage ratio
  const subsidizedAmount = grantLayer.amount.amount + concessionalLayer.amount.amount;
  const leverageRatio = subsidizedAmount > 0 
    ? commercialLayer.amount.amount / subsidizedAmount 
    : 0;
  
  // Calculate mobilization ratio (assuming DFI = grant + concessional)
  const dfiContribution = grantLayer.amount.amount + concessionalLayer.amount.amount;
  const mobilizationRatio = dfiContribution > 0
    ? totalAmount / dfiContribution
    : 1;
  
  // Determine concession level
  const concessionPercentage = grantLayer.percentageOfTotal + concessionalLayer.percentageOfTotal;
  let concessionality: ConcessionLevel = 'none';
  if (concessionPercentage >= 100) concessionality = 'fully';
  else if (concessionPercentage > 50) concessionality = 'high';
  else if (concessionPercentage > 20) concessionality = 'moderate';
  else if (concessionPercentage > 0) concessionality = 'low';
  
  return {
    isBlendedFinance,
    sourceCount: sources.length,
    categoriesPresent,
    totalValue,
    grantLayer,
    concessionalLayer,
    commercialLayer,
    governmentLayer,
    leverageRatio,
    blendedCostOfCapital: 0, // Would need detailed calculation with terms
    concessionality,
    mobilizationRatio,
  };
}

/**
 * Get concession level display
 */
export function getConcessionLevelDisplay(level: ConcessionLevel): string {
  const displays: Record<ConcessionLevel, string> = {
    none: 'Fully Commercial',
    low: 'Low Concessionality',
    moderate: 'Moderate Concessionality',
    high: 'High Concessionality',
    fully: 'Fully Concessional',
  };
  return displays[level];
}

/**
 * Get concession level color
 */
export function getConcessionLevelColor(level: ConcessionLevel): string {
  const colors: Record<ConcessionLevel, string> = {
    none: 'purple',
    low: 'blue',
    moderate: 'teal',
    high: 'green',
    fully: 'emerald',
  };
  return colors[level];
}

/**
 * Get concession level description
 */
export function getConcessionLevelDescription(level: ConcessionLevel): string {
  const descriptions: Record<ConcessionLevel, string> = {
    none: 'No concessional or grant funding - fully commercial terms',
    low: 'Less than 20% of funding is concessional or grant',
    moderate: '20-50% of funding is concessional or grant',
    high: 'More than 50% of funding is concessional or grant',
    fully: '100% concessional or grant funding',
  };
  return descriptions[level];
}

/**
 * Check if blended finance qualifies for specific reporting
 */
export function requiresBlendedFinanceReporting(structure: BlendedFinanceStructure): boolean {
  return structure.isBlendedFinance && structure.sourceCount >= 2;
}

/**
 * Calculate grant element (simplified)
 * Full calculation would need NPV of cash flows
 */
export function calculateGrantElement(
  nominalAmount: Money,
  concessionality: ConcessionLevel
): Money {
  // Simplified estimation based on concessionality level
  const grantElementRatios: Record<ConcessionLevel, number> = {
    none: 0,
    low: 0.1,
    moderate: 0.25,
    high: 0.5,
    fully: 1.0,
  };
  
  const ratio = grantElementRatios[concessionality];
  return {
    amount: nominalAmount.amount * ratio,
    currency: nominalAmount.currency,
  };
}
