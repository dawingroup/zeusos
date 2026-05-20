/**
 * Bottom-Up Pricing Calculator Types
 * Types for the A&E firm bottom-up pricing calculator
 * that estimates costs based on hours, complexity, and deliverables.
 */

import type { Timestamp } from '@/shared/types';

// ============================================
// Configuration & Rates
// ============================================

/**
 * Staff roles with hourly billing rates
 */
export type StaffRole = 'principal' | 'senior-engineer' | 'mid-level-architect' | 'junior-drafter';

/**
 * Design disciplines for A&E projects
 */
export type PricingDiscipline = 'architecture' | 'interior-design' | 'mep' | 'structural';

/**
 * Design stages for deliverables
 */
export type PricingDesignStage = 'concept' | 'schematic' | 'design-development' | 'construction-docs';

/**
 * Role configuration with rate and label
 */
export interface RoleConfig {
  id: StaffRole;
  label: string;
  hourlyRate: number;
  currency: string;
}

/**
 * Full pricing configuration (editable by admin)
 */
export interface BottomUpPricingConfig {
  roles: RoleConfig[];
  adminFeePercent: number;
  currency: string;
}

// ============================================
// Input Structures
// ============================================

/**
 * A single deliverable within a discipline
 */
export interface PricingDeliverable {
  id: string;
  name: string;
  estimatedHours: number;
  role: StaffRole;
  designStage: PricingDesignStage;
}

/**
 * A discipline section containing deliverables
 */
export interface PricingDisciplineEntry {
  id: string;
  discipline: PricingDiscipline;
  deliverables: PricingDeliverable[];
}

/**
 * A logistics (pass-through) cost item
 */
export interface LogisticsCostItem {
  id: string;
  description: string;
  amount: number;
}

/**
 * An external study (pass-through with admin fee)
 */
export interface ExternalStudyItem {
  id: string;
  description: string;
  amount: number;
}

/**
 * Complete pricing proposal input
 */
export interface BottomUpPricingProposal {
  id: string;
  projectName: string;
  disciplines: PricingDisciplineEntry[];
  logistics: LogisticsCostItem[];
  externalStudies: ExternalStudyItem[];
  adminFeePercent: number;
  currency: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
}

// ============================================
// Calculation Output
// ============================================

/**
 * Summary row for a single deliverable
 */
export interface DeliverableCostSummary {
  deliverableId: string;
  name: string;
  role: StaffRole;
  roleLabel: string;
  hourlyRate: number;
  hours: number;
  designStage: PricingDesignStage;
  cost: number;
}

/**
 * Cost breakdown per discipline
 */
export interface DisciplineCostSummary {
  discipline: PricingDiscipline;
  label: string;
  deliverables: DeliverableCostSummary[];
  totalHours: number;
  totalCost: number;
}

/**
 * Cost breakdown per design stage
 */
export interface StageCostSummary {
  stage: PricingDesignStage;
  label: string;
  totalHours: number;
  totalCost: number;
}

/**
 * Complete pricing calculation result
 */
export interface BottomUpPricingResult {
  // Labor
  laborCost: number;
  totalLaborHours: number;
  byDiscipline: DisciplineCostSummary[];
  byStage: StageCostSummary[];

  // Pass-through
  logisticsCost: number;
  externalStudiesCost: number;
  adminFeeAmount: number;
  externalStudiesTotalWithFee: number;

  // Grand total
  grandTotal: number;
}

// ============================================
// Label Maps
// ============================================

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  'principal': 'Principal',
  'senior-engineer': 'Senior Engineer',
  'mid-level-architect': 'Mid-Level Architect',
  'junior-drafter': 'Junior Drafter',
};

export const PRICING_DISCIPLINE_LABELS: Record<PricingDiscipline, string> = {
  'architecture': 'Architecture',
  'interior-design': 'Interior Design',
  'mep': 'MEP (Mechanical, Electrical, Plumbing)',
  'structural': 'Structural',
};

export const PRICING_DESIGN_STAGE_LABELS: Record<PricingDesignStage, string> = {
  'concept': 'Concept',
  'schematic': 'Schematic',
  'design-development': 'Design Development (DD)',
  'construction-docs': 'Construction Documents (CD)',
};

// ============================================
// Default Configuration
// ============================================

export const DEFAULT_BOTTOM_UP_PRICING_CONFIG: BottomUpPricingConfig = {
  roles: [
    { id: 'principal', label: 'Principal', hourlyRate: 550000, currency: 'UGX' },
    { id: 'senior-engineer', label: 'Senior Engineer', hourlyRate: 440000, currency: 'UGX' },
    { id: 'mid-level-architect', label: 'Mid-Level Architect', hourlyRate: 330000, currency: 'UGX' },
    { id: 'junior-drafter', label: 'Junior Drafter', hourlyRate: 220000, currency: 'UGX' },
  ],
  adminFeePercent: 10,
  currency: 'UGX',
};

/**
 * Suggested deliverable names per discipline
 */
export const SUGGESTED_DELIVERABLES: Record<PricingDiscipline, string[]> = {
  'architecture': [
    'Floor Plans',
    'Elevations',
    'Sections',
    'Reflected Ceiling Plans',
    '3D Views / Renderings',
    'Site Plan',
    'Roof Plan',
    'Detail Drawings',
    'Door & Window Schedule',
  ],
  'interior-design': [
    'Space Planning Layouts',
    'Furniture Plans',
    'Finish Schedules',
    'Material Boards',
    'Lighting Design',
    'Millwork Details',
    'FF&E Specifications',
    'Color Palette',
  ],
  'mep': [
    'Electrical Layout',
    'Plumbing Layout',
    'HVAC Layout',
    'Fire Protection Plan',
    'Mechanical Schedules',
    'Single Line Diagrams',
    'Load Calculations',
  ],
  'structural': [
    'Foundation Plan',
    'Structural Analysis',
    'Framing Plans',
    'Beam Schedules',
    'Column Schedules',
    'Connection Details',
    'Structural Calculations',
  ],
};
