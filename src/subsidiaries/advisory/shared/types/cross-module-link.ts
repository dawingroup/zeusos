/**
 * Cross-Module Linking Types
 * 
 * Defines the relationships between different modules
 * (Investment, Delivery, Advisory, MatFlow)
 */

import { Timestamp } from 'firebase/firestore';

export interface CrossModuleLink {
  id: string;
  
  // Link definition
  sourceModule: ModuleType;
  sourceEntityType: EntityType;
  sourceEntityId: string;
  
  targetModule: ModuleType;
  targetEntityType: EntityType;
  targetEntityId: string;
  
  // Link type
  linkType: LinkType;
  
  // Sync configuration
  syncConfig: SyncConfiguration;
  
  // Link status
  status: LinkStatus;
  
  // Sync status
  lastSyncedAt?: Timestamp;
  syncErrors?: SyncError[];
  
  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}

export type ModuleType = 
  | 'investment'
  | 'delivery'
  | 'advisory'
  | 'matflow';

export type EntityType = 
  | 'deal'
  | 'program'
  | 'project'
  | 'portfolio'
  | 'holding'
  | 'boq'
  | 'procurement';

export type LinkType = 
  | 'deal_to_project'      // Investment deal → Delivery project
  | 'project_to_deal'      // Delivery project → Investment deal (reverse reference)
  | 'deal_to_matflow'      // Investment deal → MatFlow BOQ
  | 'project_to_matflow'   // Delivery project → MatFlow BOQ
  | 'holding_to_deal'      // Advisory holding → Investment deal
  | 'program_to_deal';     // Delivery program → Investment deal (funding source)

export type LinkStatus = 
  | 'active'
  | 'pending'       // Awaiting confirmation
  | 'suspended'     // Temporarily disabled
  | 'terminated';   // Permanently disabled

export interface SyncConfiguration {
  // What to sync
  syncFields: SyncFieldConfig[];
  
  // When to sync
  syncTriggers: SyncTrigger[];
  
  // Direction
  syncDirection: 'one_way' | 'bidirectional';
  
  // Conflict resolution
  conflictResolution: ConflictResolution;
  
  // Notifications
  notifyOnSync: boolean;
  notifyOnError: boolean;
  notifyRecipients?: string[];
}

export interface SyncFieldConfig {
  sourceField: string;
  targetField: string;
  transform?: SyncTransform;
  enabled: boolean;
}

export type SyncTransform = 
  | 'direct'           // Copy directly
  | 'aggregate'        // Aggregate from children
  | 'calculate'        // Calculate derived value
  | 'map_status'       // Map status values
  | 'convert_currency' // Currency conversion
  | 'percentage';      // Convert to percentage

export type SyncTrigger = 
  | 'on_source_update'
  | 'on_target_update'
  | 'scheduled_daily'
  | 'scheduled_weekly'
  | 'manual';

export type ConflictResolution = 
  | 'source_wins'
  | 'target_wins'
  | 'newest_wins'
  | 'manual_review';

export interface SyncError {
  timestamp: Timestamp;
  field: string;
  sourceValue: unknown;
  targetValue: unknown;
  errorType: 'conflict' | 'validation' | 'transform' | 'permission';
  errorMessage: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Timestamp;
}

/**
 * Deal-Project Link - Specific configuration for investment to delivery
 */
export interface DealProjectLink extends CrossModuleLink {
  linkType: 'deal_to_project';
  
  // Deal-specific data
  dealData: DealLinkData;
  
  // Project-specific data
  projectData: ProjectLinkData;
  
  // Sync mappings
  progressMapping: ProgressMapping;
  financialMapping: FinancialMapping;
  milestoneMapping: MilestoneMapping;
}

export interface DealLinkData {
  dealId: string;
  dealName: string;
  dealStage: string;
  investmentAmount: number;
  investmentStructure: string;
  equityPercentage?: number;
  closingDate?: Date;
  engagementId?: string;
  currency?: string;
}

export interface ProjectLinkData {
  projectId: string;
  projectName: string;
  projectStatus: string;
  totalBudget: number;
  spentToDate: number;
  progressPercentage: number;
  expectedCompletion?: Date;
}

export interface ProgressMapping {
  // Map project progress to deal construction status
  constructionStarted: boolean;
  physicalProgress: number;
  financialProgress: number;
  
  // Key milestones achieved
  foundationComplete: boolean;
  structureComplete: boolean;
  mepComplete: boolean;
  handoverComplete: boolean;
  
  // Schedule status
  onSchedule: boolean;
  daysAheadOrBehind: number;
}

export interface FinancialMapping {
  // Budget vs actual
  originalBudget: number;
  currentBudget: number;
  budgetVariance: number;
  budgetVariancePercentage: number;
  
  // Costs
  totalCommitted: number;
  totalSpent: number;
  totalRemaining: number;
  
  // Projections
  estimatedFinalCost: number;
  costVarianceFromModel: number;
  
  // Currency
  sourceCurrency: string;
  targetCurrency: string;
  exchangeRate: number;
}

export interface MilestoneMapping {
  dealMilestones: DealMilestone[];
  projectMilestones: ProjectMilestone[];
  mappings: MilestoneMap[];
}

export interface DealMilestone {
  id: string;
  name: string;
  expectedDate: Date;
  actualDate?: Date;
  status: 'pending' | 'achieved' | 'delayed' | 'at_risk';
}

export interface ProjectMilestone {
  id: string;
  name: string;
  plannedDate: Date;
  actualDate?: Date;
  status: 'not_started' | 'in_progress' | 'complete' | 'delayed';
  progressPercentage: number;
}

export interface MilestoneMap {
  dealMilestoneId: string;
  projectMilestoneId: string;
  autoSync: boolean;
}

/**
 * Link Creation Request
 */
export interface CreateLinkRequest {
  sourceModule: ModuleType;
  sourceEntityType: EntityType;
  sourceEntityId: string;
  targetModule: ModuleType;
  targetEntityType: EntityType;
  targetEntityId: string;
  linkType: LinkType;
  syncConfig?: Partial<SyncConfiguration>;
}

/**
 * Project Creation from Deal
 */
export interface ProjectCreationFromDeal {
  dealId: string;
  programId: string; // Parent program for the project
  
  // Project configuration
  projectConfig: ProjectCreationConfig;
  
  // MatFlow configuration
  matflowConfig?: MatFlowConfig;
  
  // What to auto-link
  autoLink: AutoLinkConfig;
}

export interface ProjectCreationConfig {
  name: string;
  implementationType: 'contractor' | 'direct';
  startDate: Date;
  expectedEndDate: Date;
  
  // Location
  region: string;
  district: string;
  location: string;
  coordinates?: { lat: number; lng: number };
  
  // Budget from deal
  budgetFromDeal: boolean;
  budgetOverride?: number;
  
  // Team
  projectManagerId?: string;
  siteTeam?: string[];
  
  // Contractor (if contractor implementation)
  contractorId?: string;
  contractValue?: number;
}

export interface MatFlowConfig {
  createBoq: boolean;
  boqFromDealDocuments?: string; // Document ID to parse
  trackProcurement: boolean;
}

export interface AutoLinkConfig {
  documents: boolean;
  contacts: boolean;
  milestones: boolean;
}

/**
 * Sync Result
 */
export interface SyncResult {
  success: boolean;
  syncedAt: Timestamp;
  fieldsUpdated: string[];
  errors: SyncError[];
  warnings: string[];
}

/**
 * Cross-Module Dashboard Data
 */
export interface CrossModuleDashboard {
  // Investment perspective
  investmentSummary: InvestmentSummary;
  
  // Delivery perspective
  deliverySummary: DeliverySummary;
  
  // Linked entities
  links: DealProjectLink[];
  
  // Recent sync activities
  recentSyncs: SyncResult[];
  
  // Alerts
  alerts: CrossModuleAlert[];
}

export interface InvestmentSummary {
  totalDealsWithProjects: number;
  totalInvestedAmount: number;
  portfolioConstructionProgress: number;
  projectsOnTrack: number;
  projectsDelayed: number;
  projectsAtRisk: number;
}

export interface DeliverySummary {
  projectsWithInvestmentLinks: number;
  totalBudgetFromInvestments: number;
  budgetUtilization: number;
  activeConstructionValue: number;
}

export interface CrossModuleAlert {
  id: string;
  type: 'budget_variance' | 'schedule_delay' | 'sync_error' | 'milestone_risk';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  sourceModule: ModuleType;
  sourceEntityId: string;
  targetModule?: ModuleType;
  targetEntityId?: string;
  createdAt: Timestamp;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Timestamp;
}

// Default sync configuration for deal-project links
export const DEFAULT_DEAL_PROJECT_SYNC: SyncConfiguration = {
  syncFields: [
    { sourceField: 'project.progressPercentage', targetField: 'deal.constructionProgress', transform: 'direct', enabled: true },
    { sourceField: 'project.spentToDate', targetField: 'deal.constructionSpend', transform: 'direct', enabled: true },
    { sourceField: 'project.status', targetField: 'deal.constructionStatus', transform: 'map_status', enabled: true },
    { sourceField: 'project.estimatedCompletion', targetField: 'deal.expectedCOD', transform: 'direct', enabled: true },
  ],
  syncTriggers: ['on_source_update', 'scheduled_daily'],
  syncDirection: 'one_way',
  conflictResolution: 'source_wins',
  notifyOnSync: false,
  notifyOnError: true,
};

// Helper functions
export function getLinkStatusDisplayName(status: LinkStatus): string {
  const names: Record<LinkStatus, string> = {
    active: 'Active',
    pending: 'Pending',
    suspended: 'Suspended',
    terminated: 'Terminated',
  };
  return names[status] || status;
}

export function getLinkStatusColor(status: LinkStatus): string {
  const colors: Record<LinkStatus, string> = {
    active: '#22c55e',
    pending: '#f59e0b',
    suspended: '#6b7280',
    terminated: '#ef4444',
  };
  return colors[status] || '#6b7280';
}

export function getModuleDisplayName(module: ModuleType): string {
  const names: Record<ModuleType, string> = {
    investment: 'Investment',
    delivery: 'Delivery',
    advisory: 'Advisory',
    matflow: 'MatFlow',
  };
  return names[module] || module;
}

export function getAlertSeverityColor(severity: CrossModuleAlert['severity']): string {
  const colors = {
    low: '#22c55e',
    medium: '#f59e0b',
    high: '#f97316',
    critical: '#ef4444',
  };
  return colors[severity] || '#6b7280';
}
