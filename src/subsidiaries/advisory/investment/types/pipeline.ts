/**
 * Pipeline configuration and view types
 * 
 * Defines how deals are organized and visualized in the pipeline.
 */

import { DealStage, StageConfig } from './deal-stage';
import { DealSummary, DealPriority, MoneyAmount } from './deal';

// Pipeline configuration
export interface PipelineConfig {
  id: string;
  name: string;
  description?: string;
  stages: StageConfig[];
  defaultFilters: PipelineFilters;
  notifications: StageNotification[];
  automations: PipelineAutomation[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Pipeline filters
export interface PipelineFilters {
  sectors?: string[];
  dealTypes?: string[];
  countries?: string[];
  priorities?: DealPriority[];
  assignedTo?: string[];
  minValue?: number;
  maxValue?: number;
  dateRange?: {
    start: Date;
    end: Date;
    field: 'createdAt' | 'expectedCloseDate' | 'stageEnteredAt';
  };
}

// Stage notification configuration
export interface StageNotification {
  id: string;
  triggerStage: DealStage;
  event: StageEvent;
  recipients: NotificationRecipient[];
  template: string;
  enabled: boolean;
}

export type StageEvent = 
  | 'stage_entered'
  | 'stage_exited'
  | 'days_in_stage_exceeded'
  | 'gate_criteria_met'
  | 'gate_criteria_failed';

export interface NotificationRecipient {
  type: 'role' | 'user' | 'team';
  value: string;  // Role name, user ID, or team ID
}

// Pipeline automation rules
export interface PipelineAutomation {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  enabled: boolean;
}

export interface AutomationTrigger {
  type: 'stage_change' | 'time_based' | 'field_change';
  config: Record<string, unknown>;
}

export interface AutomationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
  value: unknown;
}

export interface AutomationAction {
  type: 'notify' | 'assign' | 'update_field' | 'create_task' | 'webhook';
  config: Record<string, unknown>;
}

// Pipeline column for Kanban view
export interface PipelineColumn {
  stage: DealStage;
  config: StageConfig;
  deals: DealSummary[];
  totalValue: MoneyAmount;
  count: number;
  isCollapsed: boolean;
}

// Pipeline statistics
export interface PipelineStats {
  totalDeals: number;
  totalValue: MoneyAmount;
  averageDaysInPipeline: number;
  conversionRate: number;        // Screening to closed_won
  velocityByStage: StageVelocity[];
  dealsByMonth: MonthlyStats[];
  topSectors: SectorStats[];
}

export interface StageVelocity {
  stage: DealStage;
  averageDays: number;
  medianDays: number;
  deals: number;
}

export interface MonthlyStats {
  month: string;              // YYYY-MM format
  dealsEntered: number;
  dealsClosed: number;
  valueEntered: MoneyAmount;
  valueClosed: MoneyAmount;
}

export interface SectorStats {
  sector: string;
  dealCount: number;
  totalValue: MoneyAmount;
  conversionRate: number;
}

// Stage transition request
export interface StageTransitionRequest {
  dealId: string;
  fromStage: DealStage;
  toStage: DealStage;
  requestedBy: string;
  notes?: string;
  gateCheckResults?: GateCheckResult[];
}

export interface GateCheckResult {
  criterionId: string;
  criterionName: string;
  passed: boolean;
  details?: string;
}

// Stage transition approval
export interface StageTransitionApproval {
  id: string;
  transitionRequest: StageTransitionRequest;
  status: 'pending' | 'approved' | 'rejected';
  approver?: string;
  approvedAt?: Date;
  rejectionReason?: string;
}

// Deal movement (for drag-and-drop)
export interface DealMovement {
  dealId: string;
  fromStage: DealStage;
  toStage: DealStage;
  fromPosition: number;
  toPosition: number;
}

// Helper functions
export function getStageEventDisplayName(event: StageEvent): string {
  const names: Record<StageEvent, string> = {
    stage_entered: 'Stage Entered',
    stage_exited: 'Stage Exited',
    days_in_stage_exceeded: 'Days in Stage Exceeded',
    gate_criteria_met: 'Gate Criteria Met',
    gate_criteria_failed: 'Gate Criteria Failed',
  };
  return names[event] || event;
}

export function getAutomationActionDisplayName(type: AutomationAction['type']): string {
  const names: Record<AutomationAction['type'], string> = {
    notify: 'Send Notification',
    assign: 'Assign to User',
    update_field: 'Update Field',
    create_task: 'Create Task',
    webhook: 'Call Webhook',
  };
  return names[type] || type;
}
