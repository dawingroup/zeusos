/**
 * Scenarios - Multiple case analysis
 */

import { CashFlowProjection } from './cash-flow';
import { ReturnMetrics, DebtMetrics } from './returns';

export interface Scenario {
  id: string;
  name: string;
  type: ScenarioType;
  description: string;
  
  // Assumption overrides
  assumptionOverrides: AssumptionOverride[];
  
  // Results
  cashFlows: CashFlowProjection[];
  returns: ReturnMetrics;
  debtMetrics?: DebtMetrics;
  
  // Probability weighting
  probability?: number;
  
  // Metadata
  createdAt: Date;
  createdBy: string;
}

export type ScenarioType = 
  | 'base_case'
  | 'upside'
  | 'downside'
  | 'management_case'
  | 'bank_case'
  | 'stress_test'
  | 'custom';

export interface AssumptionOverride {
  path: string; // Dot notation path to assumption
  originalValue: number;
  newValue: number;
  percentageChange?: number;
  rationale?: string;
}

export interface ScenarioComparison {
  scenarios: ScenarioSummary[];
  probabilityWeightedReturns?: ProbabilityWeightedReturns;
  sensitivityMatrix?: SensitivityMatrix;
}

export interface ScenarioSummary {
  scenarioId: string;
  scenarioName: string;
  scenarioType: ScenarioType;
  projectIRR: number;
  equityIRR: number;
  npv: number;
  moic: number;
  minDSCR?: number;
  deltaFromBase: DeltaMetrics;
}

export interface DeltaMetrics {
  irrDelta: number;
  npvDelta: number;
  moicDelta: number;
}

export interface ProbabilityWeightedReturns {
  expectedIRR: number;
  expectedNPV: number;
  expectedMOIC: number;
  irrStandardDeviation: number;
  npvStandardDeviation: number;
  probabilityOfLoss: number;
  valueAtRisk95?: number;
}

export interface SensitivityMatrix {
  xVariable: string;
  yVariable: string;
  xValues: number[];
  yValues: number[];
  results: number[][]; // IRR or NPV at each combination
}

// Pre-defined scenario templates
export const SCENARIO_TEMPLATES: Record<ScenarioType, Partial<AssumptionOverride>[]> = {
  base_case: [],
  upside: [
    { path: 'revenue.utilizationRate', percentageChange: 10 },
    { path: 'operatingCosts.fixedCosts', percentageChange: -5 },
  ],
  downside: [
    { path: 'revenue.utilizationRate', percentageChange: -15 },
    { path: 'revenue.tariff', percentageChange: -10 },
    { path: 'capex.contingencyPercentage', percentageChange: 50 },
  ],
  management_case: [
    { path: 'revenue.utilizationRate', percentageChange: 5 },
    { path: 'revenue.tariffEscalation', percentageChange: 10 },
  ],
  bank_case: [
    { path: 'revenue.utilizationRate', percentageChange: -10 },
    { path: 'capex.contingencyPercentage', percentageChange: 25 },
    { path: 'operatingCosts.omEscalation', percentageChange: 20 },
  ],
  stress_test: [
    { path: 'revenue.utilizationRate', percentageChange: -25 },
    { path: 'revenue.tariff', percentageChange: -15 },
    { path: 'capex.contingencyPercentage', percentageChange: 100 },
    { path: 'financing.seniorDebt.interestRate', percentageChange: 30 },
  ],
  custom: [],
};

// Helper functions
export function getScenarioTypeDisplayName(type: ScenarioType): string {
  const names: Record<ScenarioType, string> = {
    base_case: 'Base Case',
    upside: 'Upside Case',
    downside: 'Downside Case',
    management_case: 'Management Case',
    bank_case: 'Bank Case',
    stress_test: 'Stress Test',
    custom: 'Custom Scenario',
  };
  return names[type] || type;
}

export function getScenarioTypeColor(type: ScenarioType): string {
  const colors: Record<ScenarioType, string> = {
    base_case: '#3b82f6',
    upside: '#22c55e',
    downside: '#ef4444',
    management_case: '#8b5cf6',
    bank_case: '#f59e0b',
    stress_test: '#dc2626',
    custom: '#6b7280',
  };
  return colors[type] || '#6b7280';
}

export function formatDelta(delta: number, isPercentage = false): string {
  const prefix = delta >= 0 ? '+' : '';
  if (isPercentage) {
    return `${prefix}${(delta * 100).toFixed(2)}%`;
  }
  return `${prefix}${delta.toFixed(2)}`;
}

export function calculateProbabilityWeightedReturns(
  scenarios: Scenario[]
): ProbabilityWeightedReturns | null {
  const weightedScenarios = scenarios.filter(s => s.probability !== undefined && s.probability > 0);
  
  if (weightedScenarios.length === 0) {
    return null;
  }
  
  const totalProbability = weightedScenarios.reduce((sum, s) => sum + (s.probability || 0), 0);
  
  // Normalize probabilities
  const normalizedScenarios = weightedScenarios.map(s => ({
    ...s,
    normalizedProbability: (s.probability || 0) / totalProbability,
  }));
  
  // Calculate expected values
  const expectedIRR = normalizedScenarios.reduce(
    (sum, s) => sum + s.returns.equityIRR * s.normalizedProbability, 0
  );
  const expectedNPV = normalizedScenarios.reduce(
    (sum, s) => sum + s.returns.npv * s.normalizedProbability, 0
  );
  const expectedMOIC = normalizedScenarios.reduce(
    (sum, s) => sum + s.returns.moic * s.normalizedProbability, 0
  );
  
  // Calculate standard deviations
  const irrVariance = normalizedScenarios.reduce(
    (sum, s) => sum + Math.pow(s.returns.equityIRR - expectedIRR, 2) * s.normalizedProbability, 0
  );
  const npvVariance = normalizedScenarios.reduce(
    (sum, s) => sum + Math.pow(s.returns.npv - expectedNPV, 2) * s.normalizedProbability, 0
  );
  
  // Calculate probability of loss (NPV < 0)
  const probabilityOfLoss = normalizedScenarios
    .filter(s => s.returns.npv < 0)
    .reduce((sum, s) => sum + s.normalizedProbability, 0);
  
  return {
    expectedIRR,
    expectedNPV,
    expectedMOIC,
    irrStandardDeviation: Math.sqrt(irrVariance),
    npvStandardDeviation: Math.sqrt(npvVariance),
    probabilityOfLoss,
  };
}
