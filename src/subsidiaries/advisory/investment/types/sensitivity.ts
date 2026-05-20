/**
 * Sensitivity Analysis - Impact of assumption changes
 */

export interface SensitivityAnalysis {
  id: string;
  name: string;
  type: SensitivityType;
  
  // Input parameters
  variables: SensitivityVariable[];
  
  // Results
  results: SensitivityResult[];
  
  // Tornado chart data
  tornadoData?: TornadoData;
  
  // Spider chart data
  spiderData?: SpiderData;
  
  // Metadata
  createdAt: Date;
  createdBy: string;
}

export type SensitivityType = 
  | 'one_way'        // Single variable
  | 'two_way'        // Two variables
  | 'tornado'        // Multiple variables, tornado chart
  | 'monte_carlo';   // Probabilistic simulation

export interface SensitivityVariable {
  name: string;
  path: string; // Path to assumption in model
  baseValue: number;
  unit: string;
  
  // Range for sensitivity
  minValue: number;
  maxValue: number;
  steps: number;
  
  // For Monte Carlo
  distribution?: DistributionType;
  distributionParams?: DistributionParams;
}

export type DistributionType = 
  | 'normal'
  | 'uniform'
  | 'triangular'
  | 'lognormal'
  | 'beta';

export interface DistributionParams {
  mean?: number;
  stdDev?: number;
  min?: number;
  max?: number;
  mode?: number;
  alpha?: number;
  beta?: number;
}

export interface SensitivityResult {
  variableName: string;
  variableValue: number;
  
  // Outputs
  projectIRR: number;
  equityIRR: number;
  npv: number;
  moic: number;
  minDSCR?: number;
  
  // Delta from base
  irrDelta: number;
  npvDelta: number;
}

export interface TornadoData {
  targetMetric: 'irr' | 'npv' | 'moic';
  baseValue: number;
  variables: TornadoVariable[];
}

export interface TornadoVariable {
  name: string;
  lowValue: number;
  highValue: number;
  lowResult: number;
  highResult: number;
  range: number;
  elasticity: number; // % change in output per % change in input
}

export interface SpiderData {
  targetMetric: 'irr' | 'npv' | 'moic';
  percentageChanges: number[]; // e.g., [-20, -10, 0, 10, 20]
  variables: SpiderVariable[];
}

export interface SpiderVariable {
  name: string;
  values: SpiderPoint[];
}

export interface SpiderPoint {
  percentageChange: number;
  absoluteValue: number;
  resultValue: number;
}

// Common sensitivity variables for infrastructure
export const INFRASTRUCTURE_SENSITIVITY_VARIABLES: InfrastructureSensitivityVariable[] = [
  { name: 'Utilization Rate', path: 'revenue.utilizationRate', defaultRange: 20 },
  { name: 'Tariff/Price', path: 'revenue.tariff', defaultRange: 15 },
  { name: 'Construction Cost', path: 'capex.constructionCapex.0.amount', defaultRange: 25 },
  { name: 'Operating Costs', path: 'operatingCosts.fixedCosts.0.amount', defaultRange: 20 },
  { name: 'Discount Rate', path: 'assumptions.discountRate', defaultRange: 30 },
  { name: 'Interest Rate', path: 'financing.seniorDebt.interestRate', defaultRange: 25 },
  { name: 'Exit Multiple', path: 'terminalValue.exitMultiple', defaultRange: 20 },
  { name: 'Construction Delay', path: 'timing.constructionDelayMonths', defaultRange: 50 },
];

export interface InfrastructureSensitivityVariable {
  name: string;
  path: string;
  defaultRange: number;
}

// Helper functions
export function getSensitivityTypeDisplayName(type: SensitivityType): string {
  const names: Record<SensitivityType, string> = {
    one_way: 'One-Way Sensitivity',
    two_way: 'Two-Way Sensitivity',
    tornado: 'Tornado Chart',
    monte_carlo: 'Monte Carlo Simulation',
  };
  return names[type] || type;
}

export function getDistributionDisplayName(type: DistributionType): string {
  const names: Record<DistributionType, string> = {
    normal: 'Normal Distribution',
    uniform: 'Uniform Distribution',
    triangular: 'Triangular Distribution',
    lognormal: 'Log-Normal Distribution',
    beta: 'Beta Distribution',
  };
  return names[type] || type;
}

export function createSensitivityVariable(
  name: string,
  path: string,
  baseValue: number,
  unit: string,
  rangePercent: number = 20
): SensitivityVariable {
  const range = baseValue * (rangePercent / 100);
  return {
    name,
    path,
    baseValue,
    unit,
    minValue: baseValue - range,
    maxValue: baseValue + range,
    steps: 10,
  };
}

export function calculateElasticity(
  baseOutput: number,
  newOutput: number,
  baseInput: number,
  newInput: number
): number {
  const outputChange = (newOutput - baseOutput) / baseOutput;
  const inputChange = (newInput - baseInput) / baseInput;
  return inputChange !== 0 ? outputChange / inputChange : 0;
}

export function sortTornadoVariables(variables: TornadoVariable[]): TornadoVariable[] {
  return [...variables].sort((a, b) => b.range - a.range);
}
