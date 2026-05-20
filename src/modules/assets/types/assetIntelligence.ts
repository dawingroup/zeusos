/**
 * Asset Intelligence Types
 * Types for AI-powered asset back-search, maintenance predictions,
 * utilization analysis, cost tracking, and repair parts strategy.
 */

import type { ConsumableType } from './consumable';

// ============================================================================
// ASSET ENRICHMENT (Back-Search)
// ============================================================================

/**
 * AI-enriched asset profile data from web back-search.
 * Sends brand+model to AI, returns specs, manuals, pricing, status.
 */
export interface AssetEnrichmentResult {
  specs: Record<string, string>;
  manualUrl?: string;
  productPageUrl?: string;
  currentRetailPrice?: {
    amount: number;
    currency: string;
    source: string;
  };
  discontinuedStatus?: 'active' | 'discontinued' | 'end-of-life' | 'unknown';
  replacementModel?: string;
  safetyAlerts?: string[];
  accessories?: string[];
  commonIssues?: string[];
  warrantyInfo?: string;
  yearReleased?: number;
  consumablesAndParts?: AIConsumableSuggestion[];
}

// ============================================================================
// MAINTENANCE PREDICTIONS
// ============================================================================

export interface MaintenancePrediction {
  nextFailureWindow: {
    earliest: string;
    latest: string;
  };
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  predictedIssue: string;
  recommendedAction: string;
  estimatedCost?: number;
  basedOn: string;
}

// ============================================================================
// UTILIZATION INSIGHTS
// ============================================================================

export interface UtilizationInsight {
  uptimePercentage: number;
  avgCheckoutDuration: string;
  peakUsagePeriods: string[];
  idlePeriods: string[];
  utilizationTrend: 'increasing' | 'stable' | 'decreasing';
  recommendation: string;
}

// ============================================================================
// COST ANALYSIS
// ============================================================================

export interface AssetCostAnalysis {
  totalMaintenanceCost: number;
  avgCostPerService: number;
  costTrend: 'increasing' | 'stable' | 'decreasing';
  projectedAnnualCost: number;
  costPerOperatingHour?: number;
  replacementBreakeven?: string;
}

// ============================================================================
// RECOMMENDATIONS
// ============================================================================

export type RecommendationType =
  | 'maintenance'
  | 'replacement'
  | 'upgrade'
  | 'safety'
  | 'optimization';

export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface AssetRecommendation {
  type: RecommendationType;
  priority: Priority;
  title: string;
  description: string;
  estimatedImpact: string;
  estimatedCost?: number;
}

// ============================================================================
// FULL INTELLIGENCE RESULT
// ============================================================================

export interface AssetIntelligenceResult {
  enrichment: AssetEnrichmentResult;
  maintenancePredictions: MaintenancePrediction[];
  utilization: UtilizationInsight;
  costAnalysis: AssetCostAnalysis;
  recommendations: AssetRecommendation[];
  repairPartsStrategy?: RepairPartsStrategy;
  analyzedAt: string;
}

// ============================================================================
// AI CONSUMABLE SUGGESTIONS (from Gemini enrichment)
// ============================================================================

export interface AIConsumableSuggestion {
  name: string;
  type: ConsumableType;
  partNumber?: string;
  expectedLifeHours?: number;
  isCritical: boolean;
  replacementTrigger?: string;
  estimatedCost?: { amount: number; currency: string };
  fitmentNotes?: string;
}

// ============================================================================
// REPAIR PARTS STRATEGY (from Claude analysis)
// ============================================================================

export interface CriticalSpare {
  part: string;
  reason: string;
  recommendedStock: number;
  estimatedCost?: number;
  replacementInterval?: string;
}

export interface MaintenanceKit {
  name: string;
  parts: string[];
  frequency: string;
  estimatedCost?: number;
}

export interface RepairPartsStrategy {
  criticalSpares: CriticalSpare[];
  maintenanceKits: MaintenanceKit[];
  uptimeRiskAssessment: string;
}
