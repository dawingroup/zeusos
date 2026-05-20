/**
 * Due Diligence Finding
 * 
 * Individual observations, issues, or risks identified during DD.
 */

import { Timestamp } from 'firebase/firestore';
import { WorkstreamType } from './due-diligence';

export interface DDFinding {
  id: string;
  dueDiligenceId: string;
  workstreamId: string;
  workstreamType: WorkstreamType;
  
  // Classification
  title: string;
  description: string;
  category: FindingCategory;
  severity: FindingSeverity;
  
  // Impact assessment
  financialImpact?: FinancialImpact;
  operationalImpact?: string;
  legalImpact?: string;
  reputationalImpact?: string;
  
  // Mitigation
  mitigationStrategy?: string;
  mitigationStatus: MitigationStatus;
  mitigationOwner?: string;
  mitigationDueDate?: Date;
  
  // Resolution
  resolution?: string;
  resolvedAt?: Timestamp;
  resolvedBy?: string;
  
  // Evidence
  supportingDocuments: FindingDocument[];
  references?: string[];
  
  // Flag status
  isRedFlag: boolean;
  isYellowFlag: boolean;
  flagReason?: string;
  escalatedTo?: string;
  escalatedAt?: Timestamp;
  
  // Deal impact
  dealImpact: DealImpact;
  valuationImpact?: ValuationImpact;
  
  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

export type FindingCategory = 
  | 'risk'              // Identified risk
  | 'issue'             // Current issue needing resolution
  | 'opportunity'       // Value creation opportunity
  | 'observation'       // Neutral observation
  | 'clarification'     // Needs further clarification
  | 'compliance'        // Compliance-related
  | 'disclosure';       // SPA disclosure item

export type FindingSeverity = 
  | 'critical'          // Deal breaker potential
  | 'high'              // Significant concern
  | 'medium'            // Moderate concern
  | 'low'               // Minor concern
  | 'informational';    // For information only

export interface FinancialImpact {
  estimatedAmount?: number;
  currency?: string;
  amountRange?: {
    low: number;
    mid: number;
    high: number;
  };
  impactType: FinancialImpactType;
  timing: ImpactTiming;
  probability?: number;     // Percentage likelihood
  notes?: string;
}

export type FinancialImpactType = 
  | 'one_time_cost'
  | 'recurring_cost'
  | 'revenue_impact'
  | 'working_capital'
  | 'capex'
  | 'valuation_adjustment'
  | 'contingent_liability'
  | 'tax_exposure';

export type ImpactTiming = 
  | 'immediate'
  | 'short_term'      // < 1 year
  | 'medium_term'     // 1-3 years
  | 'long_term'       // > 3 years
  | 'ongoing';

export type MitigationStatus = 
  | 'not_required'
  | 'identified'
  | 'in_progress'
  | 'implemented'
  | 'verified'
  | 'accepted';       // Risk accepted

export type DealImpact = 
  | 'none'
  | 'price_adjustment'
  | 'warranty_indemnity'
  | 'condition_precedent'
  | 'post_closing_action'
  | 'deal_structure'
  | 'termination_risk';

export interface ValuationImpact {
  adjustmentType: 'addition' | 'deduction' | 'neutral';
  estimatedImpact?: number;
  currency?: string;
  rationale: string;
}

export interface FindingDocument {
  id: string;
  name: string;
  url?: string;
  type: string;
  uploadedAt: Timestamp;
}

// Red flag summary for dashboard
export interface RedFlagSummary {
  id: string;
  title: string;
  workstream: WorkstreamType;
  severity: FindingSeverity;
  financialImpact?: FinancialImpact;
  mitigationStatus: MitigationStatus;
  daysOpen: number;
  assignee?: string;
}

// Finding filter options
export interface FindingFilters {
  workstream?: WorkstreamType;
  severity?: FindingSeverity[];
  category?: FindingCategory[];
  mitigationStatus?: MitigationStatus[];
  isRedFlag?: boolean;
  isResolved?: boolean;
  assignee?: string;
}

// Helper functions
export function getFindingCategoryDisplayName(category: FindingCategory): string {
  const names: Record<FindingCategory, string> = {
    risk: 'Risk',
    issue: 'Issue',
    opportunity: 'Opportunity',
    observation: 'Observation',
    clarification: 'Clarification Needed',
    compliance: 'Compliance',
    disclosure: 'SPA Disclosure',
  };
  return names[category] || category;
}

export function getFindingSeverityDisplayName(severity: FindingSeverity): string {
  const names: Record<FindingSeverity, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    informational: 'Informational',
  };
  return names[severity] || severity;
}

export function getFindingSeverityColor(severity: FindingSeverity): string {
  const colors: Record<FindingSeverity, string> = {
    critical: '#dc2626',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e',
    informational: '#6b7280',
  };
  return colors[severity] || '#6b7280';
}

export function getMitigationStatusDisplayName(status: MitigationStatus): string {
  const names: Record<MitigationStatus, string> = {
    not_required: 'Not Required',
    identified: 'Identified',
    in_progress: 'In Progress',
    implemented: 'Implemented',
    verified: 'Verified',
    accepted: 'Risk Accepted',
  };
  return names[status] || status;
}

export function getDealImpactDisplayName(impact: DealImpact): string {
  const names: Record<DealImpact, string> = {
    none: 'None',
    price_adjustment: 'Price Adjustment',
    warranty_indemnity: 'Warranty/Indemnity',
    condition_precedent: 'Condition Precedent',
    post_closing_action: 'Post-Closing Action',
    deal_structure: 'Deal Structure',
    termination_risk: 'Termination Risk',
  };
  return names[impact] || impact;
}

export function getFinancialImpactTypeDisplayName(type: FinancialImpactType): string {
  const names: Record<FinancialImpactType, string> = {
    one_time_cost: 'One-Time Cost',
    recurring_cost: 'Recurring Cost',
    revenue_impact: 'Revenue Impact',
    working_capital: 'Working Capital',
    capex: 'CapEx',
    valuation_adjustment: 'Valuation Adjustment',
    contingent_liability: 'Contingent Liability',
    tax_exposure: 'Tax Exposure',
  };
  return names[type] || type;
}
