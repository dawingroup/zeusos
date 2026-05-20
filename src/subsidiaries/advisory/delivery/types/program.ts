/**
 * PROGRAM TYPES
 * 
 * Program model for Infrastructure Delivery Module.
 * Programs are funding-agnostic containers for related projects.
 */

import { Timestamp } from 'firebase/firestore';
import { Money } from '../../core/types/money';
import { Sector } from '../../core/types/engagement-domain';
import { GeoLocation } from '../../core/types/geo';
import { StakeholderRef } from '../../core/types/stakeholder';
import { ProgramBudget, BudgetAllocation } from './program-budget';
import { ProgramTeamMember } from './program-team';

// ─────────────────────────────────────────────────────────────────
// IMPLEMENTATION TYPE
// ─────────────────────────────────────────────────────────────────

/**
 * IMPLEMENTATION TYPE
 * How work is executed - determines payment workflow, NOT funding source
 * 
 * contractor: Third-party contractor builds → IPCs, retention, variations
 * direct: Organization builds directly → Requisitions, accountability
 * hybrid: Mix of both approaches within same program
 */
export type ImplementationType = 'contractor' | 'direct' | 'hybrid';

/**
 * Reference to payment type available for implementation type
 */
export interface PaymentTypeRef {
  type: string;
  label: string;
  description: string;
}

/**
 * Implementation type configuration
 */
export interface ImplementationTypeConfig {
  type: ImplementationType;
  label: string;
  description: string;
  paymentTypes: PaymentTypeRef[];
  features: string[];
}

/**
 * Implementation type definitions
 */
export const IMPLEMENTATION_TYPES: Record<ImplementationType, ImplementationTypeConfig> = {
  contractor: {
    type: 'contractor',
    label: 'Contractor Implemented',
    description: 'Work executed by third-party contractors under formal contracts',
    paymentTypes: [
      { type: 'interim_payment_certificate', label: 'IPC', description: 'Interim Payment Certificate based on measured work' },
      { type: 'advance_payment', label: 'Advance Payment', description: 'Upfront payment to contractor for mobilization' },
      { type: 'final_payment_certificate', label: 'Final Payment', description: 'Final payment after practical completion' },
      { type: 'retention_release', label: 'Retention Release', description: 'Release of retention after defects liability' },
      { type: 'variation_order', label: 'Variation Order', description: 'Payment for approved variations to scope' },
    ],
    features: [
      'Contract management',
      'Interim Payment Certificates (IPCs)',
      'Retention tracking',
      'Defects liability period',
      'Variation orders',
      'Performance bonds',
    ],
  },
  direct: {
    type: 'direct',
    label: 'Direct Implementation',
    description: 'Work executed directly by the organization or client',
    paymentTypes: [
      { type: 'requisition', label: 'Requisition', description: 'Request for funds to execute work' },
      { type: 'accountability', label: 'Accountability', description: 'Accounting for spent funds with supporting documents' },
      { type: 'imprest_request', label: 'Imprest Request', description: 'Request for petty cash/imprest funds' },
      { type: 'imprest_replenishment', label: 'Imprest Replenishment', description: 'Replenish imprest account after accountability' },
    ],
    features: [
      'Requisition workflow',
      'Accountability packages',
      'Imprest management',
      'Direct procurement',
      'Site team management',
      'Material tracking',
    ],
  },
  hybrid: {
    type: 'hybrid',
    label: 'Hybrid Implementation',
    description: 'Mix of contractor and direct implementation',
    paymentTypes: [
      { type: 'interim_payment_certificate', label: 'IPC', description: 'For contractor components' },
      { type: 'requisition', label: 'Requisition', description: 'For direct implementation components' },
      { type: 'accountability', label: 'Accountability', description: 'For direct implementation components' },
      { type: 'advance_payment', label: 'Advance Payment', description: 'For contractor components' },
      { type: 'variation_order', label: 'Variation Order', description: 'For contractor components' },
    ],
    features: [
      'Mixed payment workflows',
      'Component-level tracking',
      'Flexible implementation',
      'Both IPC and requisition workflows',
    ],
  },
};

// ─────────────────────────────────────────────────────────────────
// PROGRAM STATUS
// ─────────────────────────────────────────────────────────────────

/**
 * Program lifecycle status
 */
export type ProgramStatus =
  | 'planning'       // Program setup and project planning
  | 'active'         // Projects actively executing
  | 'on_hold'        // Temporarily paused (funding issues, etc.)
  | 'closing'        // Wrapping up remaining projects
  | 'completed'      // All projects completed
  | 'cancelled';     // Program terminated

/**
 * Program status configuration
 */
export interface ProgramStatusConfig {
  status: ProgramStatus;
  label: string;
  description: string;
  color: string;
  allowedTransitions: ProgramStatus[];
}

export const PROGRAM_STATUSES: Record<ProgramStatus, ProgramStatusConfig> = {
  planning: {
    status: 'planning',
    label: 'Planning',
    description: 'Program setup and project planning phase',
    color: 'blue',
    allowedTransitions: ['active', 'cancelled'],
  },
  active: {
    status: 'active',
    label: 'Active',
    description: 'Program with actively executing projects',
    color: 'green',
    allowedTransitions: ['on_hold', 'closing', 'cancelled'],
  },
  on_hold: {
    status: 'on_hold',
    label: 'On Hold',
    description: 'Program temporarily paused',
    color: 'yellow',
    allowedTransitions: ['active', 'closing', 'cancelled'],
  },
  closing: {
    status: 'closing',
    label: 'Closing',
    description: 'Wrapping up remaining projects and activities',
    color: 'orange',
    allowedTransitions: ['completed', 'active'],
  },
  completed: {
    status: 'completed',
    label: 'Completed',
    description: 'All program activities completed',
    color: 'gray',
    allowedTransitions: [],
  },
  cancelled: {
    status: 'cancelled',
    label: 'Cancelled',
    description: 'Program terminated before completion',
    color: 'red',
    allowedTransitions: [],
  },
};

// ─────────────────────────────────────────────────────────────────
// PROJECT STATS
// ─────────────────────────────────────────────────────────────────

/**
 * Summary statistics of projects within program
 */
export interface ProjectStats {
  total: number;
  
  byStatus: {
    planning: number;
    procurement: number;
    mobilization: number;
    construction: number;
    on_hold: number;
    practical_completion: number;
    defects_liability: number;
    completed: number;
    cancelled: number;
  };
  
  byHealth: {
    onTrack: number;
    atRisk: number;
    delayed: number;
  };
  
  financial: {
    totalBudget: Money;
    totalCommitted: Money;
    totalSpent: Money;
    totalCertified: Money;
  };
  
  progress: {
    averagePhysical: number;
    averageFinancial: number;
    weightedPhysical: number;
    weightedFinancial: number;
  };
}

// ─────────────────────────────────────────────────────────────────
// MATFLOW CONFIG
// ─────────────────────────────────────────────────────────────────

/**
 * MatFlow integration configuration
 * MatFlow is enabled by default for all delivery programs
 */
export interface ProgramMatFlowConfig {
  enabled: true;
  autoSyncBOQ: boolean;
  formulaSetId: string;
  defaultSuppliers: string[];
  consolidation: {
    enabled: boolean;
    frequency: 'weekly' | 'biweekly' | 'monthly';
    autoProcurement: boolean;
  };
}

// ─────────────────────────────────────────────────────────────────
// PROGRAM SETTINGS
// ─────────────────────────────────────────────────────────────────

/**
 * Program-level settings
 */
export interface ProgramSettings {
  requireProjectApproval: boolean;
  autoCalculateBudgets: boolean;
  defaultRetentionPercent: number;
  defaultDefectsLiabilityMonths: number;
  notifications: {
    projectMilestones: boolean;
    budgetAlerts: boolean;
    scheduleAlerts: boolean;
    paymentApprovals: boolean;
  };
  reporting: {
    autoGenerateMonthly: boolean;
    includeSitePhotos: boolean;
    includeFinancialDetails: boolean;
  };
}

// ─────────────────────────────────────────────────────────────────
// PROGRAM EXTENSION
// ─────────────────────────────────────────────────────────────────

/**
 * Program extension record
 */
export interface ProgramExtension {
  id: string;
  originalEndDate: Timestamp;
  newEndDate: Timestamp;
  durationDays: number;
  reason: string;
  approvalRef?: string;
  requestedBy: string;
  approvedBy?: string;
  approvedAt?: Timestamp;
  createdAt: Timestamp;
}

/**
 * Status change record
 */
export interface StatusChange {
  fromStatus: ProgramStatus;
  toStatus: ProgramStatus;
  reason?: string;
  changedBy: string;
  changedAt: Timestamp;
}

// ─────────────────────────────────────────────────────────────────
// PROGRAM ENTITY
// ─────────────────────────────────────────────────────────────────

/**
 * PROGRAM
 * A collection of related projects under common governance
 * Funding-agnostic: same workflows regardless of funding source
 */
export interface Program {
  id: string;
  
  // Linkage
  engagementId: string;
  clientId: string;
  
  // Customer (links to global customers collection)
  customerId?: string;
  customerName?: string;
  
  // Identity
  name: string;
  code: string;
  description: string;
  icon?: string;
  
  // Classification (Funding-Agnostic)
  implementationType: ImplementationType;
  fundingSource?: string;
  implementingAgency?: string;
  objectives?: string[];
  sectors: Sector[];
  coverage: {
    countries: string[];
    regions?: string[];
    primaryLocation?: GeoLocation;
  };
  
  // Budget
  budget: ProgramBudget;
  
  // Projects
  projectIds: string[];
  projectStats: ProjectStats;
  
  // Team
  managerId: string;
  team: ProgramTeamMember[];
  supervisionConsultant?: StakeholderRef;
  
  // Timeline
  startDate: Timestamp;
  endDate: Timestamp;
  actualStartDate?: Timestamp;
  actualEndDate?: Timestamp;
  extensions: ProgramExtension[];
  
  // Status
  status: ProgramStatus;
  statusHistory: StatusChange[];
  
  // MatFlow
  matflowConfig: ProgramMatFlowConfig;
  
  // Settings
  settings: ProgramSettings;

  // Multi-currency budget infrastructure
  fundLocationIds?: string[];
  activeBudgetPeriodId?: string;

  // Metadata
  createdBy: string;
  createdAt: Timestamp;
  updatedBy: string;
  updatedAt: Timestamp;
}

// ─────────────────────────────────────────────────────────────────
// CREATE/UPDATE DTOs
// ─────────────────────────────────────────────────────────────────

/**
 * Data required to create a new program
 */
export interface CreateProgramData {
  engagementId?: string;  // Optional - standalone programs allowed
  clientId?: string;      // Can be provided directly if no engagement
  // Customer linking (from global customers collection)
  customerId?: string;
  customerName?: string;
  name: string;
  code?: string;
  description: string;
  icon?: string;
  implementationType: ImplementationType;
  sectors: Sector[];
  coverage?: {
    countries: string[];
    regions?: string[];
    primaryLocation?: GeoLocation;
  };
  startDate: Date;
  endDate: Date;
  managerId: string;
  budgetAllocations?: BudgetAllocation[];
  settings?: Partial<ProgramSettings>;
  matflowConfig?: Partial<Omit<ProgramMatFlowConfig, 'enabled'>>;
}

/**
 * Data for updating a program
 */
export interface UpdateProgramData {
  name?: string;
  description?: string;
  icon?: string;
  implementationType?: ImplementationType;
  sectors?: Sector[];
  coverage?: {
    countries: string[];
    regions?: string[];
    primaryLocation?: GeoLocation;
  };
  endDate?: Date;
  managerId?: string;
  settings?: Partial<ProgramSettings>;
  matflowConfig?: Partial<Omit<ProgramMatFlowConfig, 'enabled'>>;
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Check if status transition is allowed
 */
export function isStatusTransitionAllowed(
  from: ProgramStatus,
  to: ProgramStatus
): boolean {
  return PROGRAM_STATUSES[from].allowedTransitions.includes(to);
}

/**
 * Get available payment types for implementation type
 */
export function getPaymentTypesForImplementation(
  implementationType: ImplementationType
): PaymentTypeRef[] {
  return IMPLEMENTATION_TYPES[implementationType].paymentTypes;
}

/**
 * Get implementation type features
 */
export function getImplementationFeatures(
  implementationType: ImplementationType
): string[] {
  return IMPLEMENTATION_TYPES[implementationType].features;
}

/**
 * Generate program code from name
 */
export function generateProgramCode(name: string, sequence: number): string {
  const prefix = name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .slice(0, 3)
    .padEnd(3, 'X');
  
  const seq = sequence.toString().padStart(3, '0');
  return `PRG-${prefix}-${seq}`;
}

/**
 * Calculate program health based on project stats
 */
export function calculateProgramHealth(stats: ProjectStats): 'healthy' | 'at_risk' | 'critical' {
  const total = stats.total;
  if (total === 0) return 'healthy';
  
  const delayedPercent = (stats.byHealth.delayed / total) * 100;
  const atRiskPercent = (stats.byHealth.atRisk / total) * 100;
  
  if (delayedPercent > 30) return 'critical';
  if (delayedPercent > 10 || atRiskPercent > 30) return 'at_risk';
  return 'healthy';
}

/**
 * Default program settings
 */
export function getDefaultProgramSettings(): ProgramSettings {
  return {
    requireProjectApproval: true,
    autoCalculateBudgets: true,
    defaultRetentionPercent: 10,
    defaultDefectsLiabilityMonths: 12,
    notifications: {
      projectMilestones: true,
      budgetAlerts: true,
      scheduleAlerts: true,
      paymentApprovals: true,
    },
    reporting: {
      autoGenerateMonthly: true,
      includeSitePhotos: true,
      includeFinancialDetails: true,
    },
  };
}

/**
 * Default MatFlow configuration
 */
export function getDefaultMatFlowConfig(): ProgramMatFlowConfig {
  return {
    enabled: true,
    autoSyncBOQ: true,
    formulaSetId: 'default',
    defaultSuppliers: [],
    consolidation: {
      enabled: false,
      frequency: 'monthly',
      autoProcurement: false,
    },
  };
}

/**
 * Initialize empty project stats
 */
export function getEmptyProjectStats(currency: string = 'USD'): ProjectStats {
  return {
    total: 0,
    byStatus: {
      planning: 0,
      procurement: 0,
      mobilization: 0,
      construction: 0,
      on_hold: 0,
      practical_completion: 0,
      defects_liability: 0,
      completed: 0,
      cancelled: 0,
    },
    byHealth: {
      onTrack: 0,
      atRisk: 0,
      delayed: 0,
    },
    financial: {
      totalBudget: { amount: 0, currency },
      totalCommitted: { amount: 0, currency },
      totalSpent: { amount: 0, currency },
      totalCertified: { amount: 0, currency },
    },
    progress: {
      averagePhysical: 0,
      averageFinancial: 0,
      weightedPhysical: 0,
      weightedFinancial: 0,
    },
  };
}

/**
 * Get status display color class
 */
export function getStatusColorClass(status: ProgramStatus): string {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-600 bg-blue-100',
    green: 'text-green-600 bg-green-100',
    yellow: 'text-yellow-600 bg-yellow-100',
    orange: 'text-orange-600 bg-orange-100',
    gray: 'text-gray-600 bg-gray-100',
    red: 'text-red-600 bg-red-100',
  };
  return colorMap[PROGRAM_STATUSES[status].color] || colorMap.gray;
}
