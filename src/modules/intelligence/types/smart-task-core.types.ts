/**
 * Smart Task Core Types - ZeusOS v2.0
 * Unified types for the Intelligence Layer integration
 */

import { Timestamp } from 'firebase/firestore';
import {
  SubsidiaryId,
  DepartmentId,
  TaskPriority,
} from '../config/constants';
import { Task, TaskId, TaskAssigneeRef } from './task-generation.types';
import { GreyArea, GreyAreaId, GreyAreaSeverity } from './grey-area.types';
import { BusinessEvent } from './business-event.types';

// ============================================
// Dashboard & Summary Types
// ============================================

/**
 * Employee's daily work summary
 */
export interface DailyWorkSummary {
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  
  // Tasks
  tasks: {
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
    dueToday: number;
    byPriority: Record<TaskPriority, number>;
  };
  
  // Grey Areas
  greyAreas: {
    total: number;
    critical: number;
    pendingInput: number;
    escalated: number;
  };
  
  // Events
  eventsTriggered: number;
  eventsToAcknowledge: number;
  
  // Performance
  completionRate: number; // 0-100
  avgResponseTime: number; // Hours
  
  // Generated
  generatedAt: Timestamp;
}

/**
 * Department/Team work summary
 */
export interface TeamWorkSummary {
  departmentId: DepartmentId;
  departmentName: string;
  subsidiaryId: SubsidiaryId;
  date: string;
  
  // Team members
  totalMembers: number;
  activeMembers: number;
  
  // Tasks
  tasks: {
    total: number;
    unassigned: number;
    overdue: number;
    completedToday: number;
    byStatus: Record<string, number>;
    byPriority: Record<TaskPriority, number>;
  };
  
  // Grey Areas
  greyAreas: {
    total: number;
    bySeverity: Record<GreyAreaSeverity, number>;
  };
  
  // Performance
  teamCompletionRate: number;
  avgTaskAge: number; // Days
  
  // Bottlenecks
  bottlenecks?: {
    type: 'overloaded_member' | 'skill_gap' | 'process_delay' | 'approval_backlog';
    description: string;
    affectedTasks: number;
    suggestion: string;
  }[];
  
  generatedAt: Timestamp;
}

/**
 * Morning briefing content
 */
export interface MorningBriefing {
  employeeId: string;
  employeeName: string;
  date: string;
  
  // Greeting
  greeting: string;
  
  // Priority items
  priorityItems: {
    type: 'task' | 'grey_area' | 'event' | 'deadline';
    id: string;
    title: string;
    description: string;
    urgency: 'immediate' | 'today' | 'soon';
    actionRequired: string;
  }[];
  
  // Summary stats
  stats: {
    tasksTotal: number;
    tasksDueToday: number;
    greyAreasPending: number;
    meetingsToday: number;
  };
  
  // AI insights
  insights?: {
    observation: string;
    recommendation: string;
    confidence: number;
  }[];
  
  // Today's focus
  focusSuggestion?: string;
  
  generatedAt: Timestamp;
  aiGenerated: boolean;
}

// ============================================
// Event Processing Types
// ============================================

/**
 * Event processing pipeline stage
 */
export type PipelineStage = 
  | 'received'
  | 'validated'
  | 'enriched'
  | 'tasks_generated'
  | 'grey_areas_checked'
  | 'notifications_sent'
  | 'completed'
  | 'failed';

/**
 * Event processing result
 */
export interface EventProcessingResult {
  eventId: string;
  eventType: string;
  
  stages: {
    stage: PipelineStage;
    status: 'pending' | 'success' | 'failed' | 'skipped';
    startedAt?: Timestamp;
    completedAt?: Timestamp;
    error?: string;
    output?: any;
  }[];
  
  // Outputs
  tasksCreated: TaskId[];
  greyAreasCreated: GreyAreaId[];
  notificationsSent: number;
  
  // Timing
  totalDuration: number; // ms
  
  // Overall status
  success: boolean;
  error?: string;
}

// ============================================
// AI Integration Types
// ============================================

/**
 * AI analysis request
 */
export interface AIAnalysisRequest {
  type: 'task_prioritization' | 'grey_area_assessment' | 'briefing_generation' | 'workload_optimization';
  context: {
    employeeId?: string;
    departmentId?: DepartmentId;
    subsidiaryId: SubsidiaryId;
    tasks?: Task[];
    greyAreas?: GreyArea[];
    events?: BusinessEvent[];
  };
  parameters?: Record<string, any>;
}

/**
 * AI analysis response
 */
export interface AIAnalysisResponse {
  requestType: string;
  success: boolean;
  
  // Results
  result: any;
  confidence: number;
  reasoning?: string[];
  
  // Suggestions
  suggestions?: {
    action: string;
    rationale: string;
    priority: 'high' | 'medium' | 'low';
  }[];
  
  // Metadata
  modelUsed: string;
  tokensUsed: number;
  latency: number;
  generatedAt: Timestamp;
}

/**
 * Task prioritization result
 */
export interface TaskPrioritizationResult {
  tasks: {
    taskId: TaskId;
    originalPriority: TaskPriority;
    suggestedPriority: TaskPriority;
    priorityScore: number; // 0-100
    factors: string[];
    suggestedOrder: number;
  }[];
  
  recommendations: string[];
}

/**
 * Workload optimization result
 */
export interface WorkloadOptimizationResult {
  currentDistribution: {
    employeeId: string;
    employeeName: string;
    taskCount: number;
    estimatedHours: number;
    utilizationPercent: number;
  }[];
  
  suggestedReassignments: {
    taskId: TaskId;
    taskTitle: string;
    fromEmployeeId: string;
    toEmployeeId: string;
    reason: string;
    savingsHours: number;
  }[];
  
  bottlenecks: {
    type: string;
    description: string;
    impact: number;
    suggestion: string;
  }[];
}

// ============================================
// Unified Query Types
// ============================================

/**
 * Unified work item (task or grey area)
 */
export interface WorkItem {
  id: string;
  type: 'task' | 'grey_area';
  
  // Common fields
  title: string;
  description: string;
  priority: TaskPriority | GreyAreaSeverity;
  status: string;
  
  // Assignment
  assignedTo?: TaskAssigneeRef;
  
  // Timing
  createdAt: Timestamp;
  dueDate?: Timestamp;
  isOverdue: boolean;
  
  // Source
  subsidiaryId: SubsidiaryId;
  departmentId?: DepartmentId;
  
  // Original entity
  entity: Task | GreyArea;
}

/**
 * Work inbox filters
 */
export interface WorkInboxFilters {
  types?: ('task' | 'grey_area')[];
  statuses?: string[];
  priorities?: string[];
  subsidiaryIds?: SubsidiaryId[];
  departmentIds?: DepartmentId[];
  assigneeIds?: string[];
  dueBefore?: Timestamp;
  dueAfter?: Timestamp;
  includeOverdue?: boolean;
  includeCompleted?: boolean;
  searchQuery?: string;
}

/**
 * Work inbox sort options
 */
export interface WorkInboxSort {
  field: 'priority' | 'dueDate' | 'createdAt' | 'title';
  direction: 'asc' | 'desc';
}

// ============================================
// Module Configuration
// ============================================

/**
 * Smart Task Core configuration
 */
export interface SmartTaskCoreConfig {
  // Feature flags
  enableAIBriefings: boolean;
  enableAIPrioritization: boolean;
  enableWorkloadOptimization: boolean;
  enableAutoEscalation: boolean;
  
  // AI settings
  aiModel: string;
  briefingGenerationHour: number; // 0-23, hour to generate briefings
  briefingTimezone: string;
  
  // Processing
  maxConcurrentEvents: number;
  eventProcessingTimeout: number; // ms
  retryFailedEvents: boolean;
  maxRetries: number;
  
  // Notifications
  enablePushNotifications: boolean;
  enableEmailNotifications: boolean;
  enableSMSNotifications: boolean;
  smsForCriticalOnly: boolean;
  
  // Performance
  cacheEnabled: boolean;
  cacheTTL: number; // seconds
}

/**
 * Default configuration for Uganda operations
 */
export const DEFAULT_CORE_CONFIG: SmartTaskCoreConfig = {
  enableAIBriefings: true,
  enableAIPrioritization: true,
  enableWorkloadOptimization: true,
  enableAutoEscalation: true,
  
  aiModel: 'gemini-pro',
  briefingGenerationHour: 6, // 6 AM EAT
  briefingTimezone: 'Africa/Kampala',
  
  maxConcurrentEvents: 10,
  eventProcessingTimeout: 30000, // 30s
  retryFailedEvents: true,
  maxRetries: 3,
  
  enablePushNotifications: true,
  enableEmailNotifications: true,
  enableSMSNotifications: true,
  smsForCriticalOnly: true,
  
  cacheEnabled: true,
  cacheTTL: 300, // 5 minutes
};
