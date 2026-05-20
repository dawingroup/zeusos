/**
 * Stage Progress Types
 * Types for construction stage tracking and milestone management
 */

import { Timestamp } from 'firebase/firestore';

// ============================================================================
// STAGE STATUS TYPES
// ============================================================================

export type StageStatus = 
  | 'not_started'      // No materials procured, no work begun
  | 'materials_pending' // Awaiting materials
  | 'in_progress'      // Active work
  | 'on_hold'          // Temporarily paused
  | 'materials_complete' // All materials procured
  | 'work_complete'    // Work finished, pending verification
  | 'verified'         // Verified by supervisor
  | 'signed_off';      // Final sign-off complete

export type StageHealth = 
  | 'healthy'          // On schedule, within budget
  | 'at_risk'          // Minor delays or cost concerns
  | 'critical'         // Significant issues
  | 'blocked';         // Cannot proceed

// ============================================================================
// STAGE MILESTONE
// ============================================================================

export interface StageMilestone {
  id: string;
  stageId: string;
  projectId: string;
  
  // Milestone details
  name: string;
  description?: string;
  type: MilestoneType;
  
  // Dates
  plannedDate: Timestamp;
  actualDate?: Timestamp;
  
  // Status
  status: MilestoneStatus;
  completedBy?: string;
  completedByName?: string;
  
  // Dependencies
  dependsOn: string[];           // Other milestone IDs
  blockedReason?: string;
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type MilestoneType = 
  | 'material_procurement'   // Materials ordered/delivered
  | 'work_start'            // Work begins
  | 'inspection'            // Quality inspection point
  | 'work_complete'         // Work finished
  | 'sign_off'              // Final approval
  | 'custom';               // User-defined milestone

export type MilestoneStatus = 
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'overdue'
  | 'skipped';

// ============================================================================
// STAGE PROGRESS RECORD
// ============================================================================

export interface StageProgress {
  id: string;
  projectId: string;
  stageId: string;
  
  // Stage identification (denormalized)
  stageName: string;
  stageOrder: number;
  
  // Status tracking
  status: StageStatus;
  health: StageHealth;
  
  // Schedule
  plannedStartDate?: Timestamp;
  plannedEndDate?: Timestamp;
  actualStartDate?: Timestamp;
  actualEndDate?: Timestamp;
  
  // Progress metrics
  materialProgress: ProgressMetric;
  workProgress: ProgressMetric;
  overallProgress: number;        // 0-100 weighted average
  
  // Cost tracking
  budgetedCost: number;
  actualCost: number;
  committedCost: number;          // Including pending procurement
  costVariancePercent: number;
  
  // BOQ summary
  totalBOQItems: number;
  completedBOQItems: number;
  
  // Milestones
  totalMilestones: number;
  completedMilestones: number;
  nextMilestone?: {
    id: string;
    name: string;
    dueDate: Timestamp;
    daysUntilDue: number;
  };
  
  // Issues and blockers
  activeBlockers: StageBlocker[];
  
  // Approval workflow
  requiresApproval: boolean;
  approvalStatus?: ApprovalStatus;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: Timestamp;
  
  // Metadata
  lastUpdatedAt: Timestamp;
  lastUpdatedBy: string;
}

export interface ProgressMetric {
  current: number;               // Current value
  target: number;                // Target value
  percent: number;               // 0-100
  trend: 'improving' | 'stable' | 'declining';
}

export interface StageBlocker {
  id: string;
  type: BlockerType;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Timestamp;
  resolvedAt?: Timestamp;
  resolution?: string;
}

export type BlockerType = 
  | 'material_shortage'
  | 'material_delay'
  | 'quality_issue'
  | 'weather'
  | 'labor_shortage'
  | 'equipment'
  | 'permit'
  | 'design_change'
  | 'payment'
  | 'other';

export type ApprovalStatus = 
  | 'not_required'
  | 'pending'
  | 'approved'
  | 'rejected';

// ============================================================================
// STAGE TIMELINE EVENT
// ============================================================================

export interface StageTimelineEvent {
  id: string;
  stageId: string;
  projectId: string;
  
  type: TimelineEventType;
  title: string;
  description?: string;
  
  timestamp: Timestamp;
  userId: string;
  userName: string;
  
  // Related entities
  relatedMilestoneId?: string;
  relatedProcurementId?: string;
  relatedBOQItemId?: string;
  
  // Additional data
  metadata?: Record<string, unknown>;
}

export type TimelineEventType = 
  | 'status_change'
  | 'milestone_completed'
  | 'milestone_overdue'
  | 'material_delivered'
  | 'blocker_added'
  | 'blocker_resolved'
  | 'approval_requested'
  | 'approval_granted'
  | 'approval_rejected'
  | 'note_added';

// ============================================================================
// PROJECT STAGE OVERVIEW
// ============================================================================

export interface ProjectStageOverview {
  projectId: string;
  calculatedAt: Timestamp;
  
  // Overall project progress
  totalStages: number;
  completedStages: number;
  inProgressStages: number;
  notStartedStages: number;
  blockedStages: number;
  
  // Progress percentages
  overallMaterialProgress: number;
  overallWorkProgress: number;
  overallProgress: number;
  
  // Schedule health
  onScheduleStages: number;
  delayedStages: number;
  aheadOfScheduleStages: number;
  
  // Budget health
  totalBudget: number;
  totalSpent: number;
  totalCommitted: number;
  budgetVariancePercent: number;
  
  // Critical path
  criticalPathStages: string[];   // Stage IDs on critical path
  projectedCompletionDate?: Timestamp;
  daysAheadOrBehind: number;      // Positive = ahead, negative = behind
  
  // Stages array (ordered)
  stages: StageProgress[];
}

// ============================================================================
// CREATE/UPDATE DTOS
// ============================================================================

export interface CreateMilestoneDTO {
  stageId: string;
  name: string;
  description?: string;
  type: MilestoneType;
  plannedDate: Date;
  dependsOn?: string[];
}

export interface UpdateStageStatusDTO {
  status: StageStatus;
  notes?: string;
}

export interface AddBlockerDTO {
  stageId: string;
  type: BlockerType;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ResolveBlockerDTO {
  blockerId: string;
  resolution: string;
}

export interface RequestApprovalDTO {
  stageId: string;
  notes?: string;
}

export interface ProcessApprovalDTO {
  stageId: string;
  approved: boolean;
  notes?: string;
}
