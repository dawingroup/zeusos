import { Timestamp } from 'firebase/firestore';
import { Money } from './money';

/**
 * COVENANT TYPE
 */
export type CovenantType =
  // Financial Covenants
  | 'dscr'                    // Debt Service Coverage Ratio
  | 'ltv'                     // Loan-to-Value
  | 'leverage'                // Debt/Equity ratio
  | 'current_ratio'           // Current Assets / Current Liabilities
  | 'minimum_liquidity'       // Minimum cash/liquid assets
  | 'maximum_capex'           // Capital expenditure limit
  | 'dividend_restriction'    // Restrictions on distributions
  
  // Operational Covenants
  | 'progress_milestone'      // Construction/implementation progress
  | 'completion_date'         // Project completion deadline
  | 'quality_standard'        // Quality metrics
  | 'utilization_rate'        // Asset utilization
  
  // Social/Environmental Covenants
  | 'environmental'           // Environmental standards
  | 'social_safeguards'       // Social protection measures
  | 'gender_targets'          // Gender-related targets
  | 'local_content'           // Local procurement/hiring
  | 'community_benefit'       // Community impact
  
  // Reporting Covenants
  | 'reporting_deadline'      // Must submit reports by date
  | 'audit_completion'        // Must complete audit by date
  
  // Negative Covenants
  | 'no_additional_debt'      // Restriction on new debt
  | 'no_asset_sale'           // Restriction on asset disposal
  | 'no_change_of_control'    // Ownership change restriction
  | 'no_material_change'      // Business change restriction
  
  // Positive Covenants
  | 'maintain_insurance'      // Insurance requirements
  | 'maintain_permits'        // License/permit requirements
  | 'maintain_accounts'       // Banking requirements
  
  // Custom
  | 'custom';

/**
 * COVENANT MEASUREMENT TYPE
 */
export type CovenantMeasurementType =
  | 'ratio'
  | 'amount'
  | 'percentage'
  | 'date'
  | 'boolean'
  | 'text';

/**
 * COVENANT CONDITION
 */
export type CovenantCondition =
  | 'minimum'            // Must be >= threshold
  | 'maximum'            // Must be <= threshold
  | 'equal'              // Must equal threshold
  | 'before_date'        // Must occur before date
  | 'maintain'           // Must maintain (boolean)
  | 'not_occur';         // Must not occur (negative covenant)

/**
 * COVENANT STATUS
 */
export type CovenantStatus =
  | 'compliant'           // Currently in compliance
  | 'at_risk'             // Within 10% of threshold
  | 'in_grace_period'     // Breached but in grace period
  | 'in_cure_period'      // After grace, trying to cure
  | 'breached'            // Formally breached
  | 'waived'              // Waiver granted
  | 'not_yet_effective'   // Future effective date
  | 'expired';            // No longer applicable

/**
 * COVENANT BREACH CONSEQUENCE
 */
export type CovenantBreachConsequence =
  | 'reporting_only'      // Must report to funder
  | 'interest_step_up'    // Higher interest rate
  | 'margin_call'         // Additional collateral
  | 'acceleration'        // Loan acceleration
  | 'default'             // Event of default
  | 'termination';        // Agreement termination

/**
 * COVENANT MONITORING FREQUENCY
 */
export type CovenantMonitoringFrequency = 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'one_time';

/**
 * COVENANT
 * A compliance obligation from a funding agreement
 */
export interface Covenant {
  id: string;
  
  /** Funding source this covenant comes from */
  fundingSourceId: string;
  
  /** Engagement ID */
  engagementId: string;
  
  // ─────────────────────────────────────────────────────────────────
  // COVENANT DETAILS
  // ─────────────────────────────────────────────────────────────────
  
  /** Covenant type */
  type: CovenantType;
  
  /** Name */
  name: string;
  
  /** Description */
  description: string;
  
  /** Section reference in agreement */
  agreementSection?: string;
  
  // ─────────────────────────────────────────────────────────────────
  // MEASUREMENT
  // ─────────────────────────────────────────────────────────────────
  
  /** How is this measured */
  measurementType: CovenantMeasurementType;
  
  /** Condition to satisfy */
  condition: CovenantCondition;
  
  /** Threshold value (for ratio/amount/percentage) */
  threshold?: number;
  
  /** Threshold date (for date-based) */
  thresholdDate?: Timestamp;
  
  /** Currency (for amount-based) */
  currency?: string;
  
  /** Unit (for display, e.g., "x", "%", "days") */
  unit?: string;
  
  // ─────────────────────────────────────────────────────────────────
  // MONITORING
  // ─────────────────────────────────────────────────────────────────
  
  /** Monitoring frequency */
  monitoringFrequency: CovenantMonitoringFrequency;
  
  /** Effective date */
  effectiveDate: Timestamp;
  
  /** Expiry date (if covenant expires) */
  expiryDate?: Timestamp;
  
  /** Grace period days */
  gracePeriodDays: number;
  
  /** Cure period days */
  curePeriodDays: number;
  
  // ─────────────────────────────────────────────────────────────────
  // STATUS
  // ─────────────────────────────────────────────────────────────────
  
  /** Is covenant active */
  isActive: boolean;
  
  /** Current compliance status */
  currentStatus: CovenantStatus;
  
  /** Last measurement date */
  lastMeasuredAt?: Timestamp;
  
  /** Last measured value */
  lastMeasuredValue?: number | boolean | string;
  
  /** Current headroom (for ratio/amount) */
  currentHeadroom?: number;
  
  /** Consequence of breach */
  breachConsequence: CovenantBreachConsequence;
  
  // ─────────────────────────────────────────────────────────────────
  // METADATA
  // ─────────────────────────────────────────────────────────────────
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * COVENANT MEASUREMENT
 * Historical measurement record
 */
export interface CovenantMeasurement {
  id: string;
  covenantId: string;
  
  /** Measurement date */
  measurementDate: Timestamp;
  
  /** Reporting period */
  periodStart: Timestamp;
  periodEnd: Timestamp;
  
  /** Measured value */
  value: number | boolean | string;
  
  /** Is compliant */
  isCompliant: boolean;
  
  /** Headroom (distance from threshold) */
  headroom?: number;
  
  /** Supporting documentation */
  documentIds: string[];
  
  /** Notes */
  notes?: string;
  
  /** Measured by */
  measuredBy: string;
  
  createdAt: Timestamp;
}

/**
 * COVENANT WAIVER TYPE
 */
export type CovenantWaiverType = 'temporary' | 'permanent' | 'amendment';

/**
 * COVENANT WAIVER
 */
export interface CovenantWaiver {
  id: string;
  covenantId: string;
  
  /** Waiver type */
  type: CovenantWaiverType;
  
  /** Effective date */
  effectiveDate: Timestamp;
  
  /** Expiry date (for temporary) */
  expiryDate?: Timestamp;
  
  /** New threshold (for amendment) */
  newThreshold?: number;
  
  /** Conditions for waiver */
  conditions?: string[];
  
  /** Fee paid (if any) */
  feeAmount?: Money;
  
  /** Approved by (at funder) */
  approvedBy: string;
  
  /** Document reference */
  documentId?: string;
  
  createdAt: Timestamp;
}

/**
 * CREATE COVENANT DATA
 */
export interface CreateCovenantData {
  fundingSourceId: string;
  engagementId: string;
  type: CovenantType;
  name: string;
  description: string;
  measurementType: CovenantMeasurementType;
  condition: CovenantCondition;
  threshold?: number;
  thresholdDate?: Date;
  currency?: string;
  unit?: string;
  monitoringFrequency: CovenantMonitoringFrequency;
  effectiveDate: Date;
  expiryDate?: Date;
  gracePeriodDays?: number;
  curePeriodDays?: number;
  breachConsequence: CovenantBreachConsequence;
}

/**
 * Get covenant type display name
 */
export function getCovenantTypeDisplayName(type: CovenantType): string {
  const names: Record<CovenantType, string> = {
    dscr: 'Debt Service Coverage Ratio',
    ltv: 'Loan-to-Value',
    leverage: 'Leverage Ratio',
    current_ratio: 'Current Ratio',
    minimum_liquidity: 'Minimum Liquidity',
    maximum_capex: 'Maximum Capital Expenditure',
    dividend_restriction: 'Dividend Restriction',
    progress_milestone: 'Progress Milestone',
    completion_date: 'Completion Date',
    quality_standard: 'Quality Standard',
    utilization_rate: 'Utilization Rate',
    environmental: 'Environmental Covenant',
    social_safeguards: 'Social Safeguards',
    gender_targets: 'Gender Targets',
    local_content: 'Local Content',
    community_benefit: 'Community Benefit',
    reporting_deadline: 'Reporting Deadline',
    audit_completion: 'Audit Completion',
    no_additional_debt: 'No Additional Debt',
    no_asset_sale: 'No Asset Sale',
    no_change_of_control: 'No Change of Control',
    no_material_change: 'No Material Change',
    maintain_insurance: 'Maintain Insurance',
    maintain_permits: 'Maintain Permits',
    maintain_accounts: 'Maintain Accounts',
    custom: 'Custom Covenant',
  };
  return names[type];
}

/**
 * Get covenant type category
 */
export function getCovenantTypeCategory(type: CovenantType): string {
  const financial: CovenantType[] = ['dscr', 'ltv', 'leverage', 'current_ratio', 'minimum_liquidity', 'maximum_capex', 'dividend_restriction'];
  const operational: CovenantType[] = ['progress_milestone', 'completion_date', 'quality_standard', 'utilization_rate'];
  const socialEnv: CovenantType[] = ['environmental', 'social_safeguards', 'gender_targets', 'local_content', 'community_benefit'];
  const reporting: CovenantType[] = ['reporting_deadline', 'audit_completion'];
  const negative: CovenantType[] = ['no_additional_debt', 'no_asset_sale', 'no_change_of_control', 'no_material_change'];
  const positive: CovenantType[] = ['maintain_insurance', 'maintain_permits', 'maintain_accounts'];
  
  if (financial.includes(type)) return 'Financial';
  if (operational.includes(type)) return 'Operational';
  if (socialEnv.includes(type)) return 'Social/Environmental';
  if (reporting.includes(type)) return 'Reporting';
  if (negative.includes(type)) return 'Negative';
  if (positive.includes(type)) return 'Positive';
  return 'Custom';
}

/**
 * Get covenant status display name
 */
export function getCovenantStatusDisplayName(status: CovenantStatus): string {
  const names: Record<CovenantStatus, string> = {
    compliant: 'Compliant',
    at_risk: 'At Risk',
    in_grace_period: 'In Grace Period',
    in_cure_period: 'In Cure Period',
    breached: 'Breached',
    waived: 'Waived',
    not_yet_effective: 'Not Yet Effective',
    expired: 'Expired',
  };
  return names[status];
}

/**
 * Get covenant status color
 */
export function getCovenantStatusColor(status: CovenantStatus): string {
  const colors: Record<CovenantStatus, string> = {
    compliant: 'green',
    at_risk: 'yellow',
    in_grace_period: 'orange',
    in_cure_period: 'red',
    breached: 'red',
    waived: 'blue',
    not_yet_effective: 'gray',
    expired: 'gray',
  };
  return colors[status];
}

/**
 * Get breach consequence display name
 */
export function getBreachConsequenceDisplayName(consequence: CovenantBreachConsequence): string {
  const names: Record<CovenantBreachConsequence, string> = {
    reporting_only: 'Reporting Only',
    interest_step_up: 'Interest Rate Step-Up',
    margin_call: 'Margin Call',
    acceleration: 'Loan Acceleration',
    default: 'Event of Default',
    termination: 'Agreement Termination',
  };
  return names[consequence];
}

/**
 * Get breach consequence severity
 */
export function getBreachConsequenceSeverity(consequence: CovenantBreachConsequence): 'low' | 'medium' | 'high' | 'critical' {
  const severities: Record<CovenantBreachConsequence, 'low' | 'medium' | 'high' | 'critical'> = {
    reporting_only: 'low',
    interest_step_up: 'medium',
    margin_call: 'high',
    acceleration: 'critical',
    default: 'critical',
    termination: 'critical',
  };
  return severities[consequence];
}

/**
 * Calculate covenant headroom
 */
export function calculateHeadroom(
  measured: number,
  threshold: number,
  condition: CovenantCondition
): number {
  if (condition === 'minimum') {
    return measured - threshold;
  } else if (condition === 'maximum') {
    return threshold - measured;
  }
  return 0;
}

/**
 * Calculate headroom percentage
 */
export function calculateHeadroomPercentage(
  measured: number,
  threshold: number,
  condition: CovenantCondition
): number {
  if (threshold === 0) return 0;
  const headroom = calculateHeadroom(measured, threshold, condition);
  return (headroom / threshold) * 100;
}

/**
 * Determine covenant status from measurement
 */
export function determineCovenantStatus(
  measured: number,
  threshold: number,
  condition: CovenantCondition,
  isInGracePeriod: boolean,
  isInCurePeriod: boolean
): CovenantStatus {
  const headroom = calculateHeadroom(measured, threshold, condition);
  const percentageHeadroom = calculateHeadroomPercentage(measured, threshold, condition);
  
  if (condition === 'minimum' || condition === 'maximum') {
    if (headroom >= 0) {
      if (percentageHeadroom < 10) return 'at_risk';
      return 'compliant';
    } else {
      if (isInGracePeriod) return 'in_grace_period';
      if (isInCurePeriod) return 'in_cure_period';
      return 'breached';
    }
  }
  
  return 'compliant';
}

/**
 * Check if covenant is active
 */
export function isCovenantActive(covenant: Covenant): boolean {
  if (!covenant.isActive) return false;
  
  const now = new Date();
  const effective = covenant.effectiveDate.toDate();
  if (now < effective) return false;
  
  if (covenant.expiryDate) {
    const expiry = covenant.expiryDate.toDate();
    if (now > expiry) return false;
  }
  
  return true;
}

/**
 * Check if covenant has issues
 */
export function hasCovenantIssues(status: CovenantStatus): boolean {
  return ['at_risk', 'in_grace_period', 'in_cure_period', 'breached'].includes(status);
}
