/**
 * Task Generation Types - DawinOS v2.0
 * Types for the automated task generation and routing system
 */

import { Timestamp } from 'firebase/firestore';
import {
  SubsidiaryId,
  DepartmentId,
  TaskPriority,
  TaskStatus,
} from '../config/constants';
import { TimestampFields, UserRef } from './base.types';
import { AssignmentRule } from './business-event.types';
import { RoleProfileId } from './role-profile.types';

/**
 * Simplified employee reference for task assignment
 */
export interface TaskAssigneeRef {
  id: string;
  name: string;
  email: string;
}

// ============================================
// Task Core Types
// ============================================

/**
 * Unique identifier for a task
 */
export type TaskId = string;

/**
 * Task source - how the task was created
 */
export type TaskSource = 
  | 'event_generated'  // Auto-generated from business event
  | 'manual'           // Manually created
  | 'recurring'        // From recurring schedule
  | 'escalation'       // Created by escalation
  | 'delegation'       // Delegated from another task
  | 'template'         // From task template
  | 'ai_suggested';    // AI suggested action

/**
 * Task lifecycle stage
 */
export type TaskStage = 
  | 'pending_assignment'  // Needs assignment
  | 'assigned'            // Assigned to someone
  | 'in_progress'         // Being worked on
  | 'pending_review'      // Awaiting review/approval
  | 'completed'           // Done
  | 'cancelled'           // Cancelled
  | 'blocked'             // Blocked by dependency
  | 'escalated';          // Escalated to higher level

/**
 * Completion requirement type
 */
export type CompletionType = 
  | 'manual'          // Manual completion by assignee
  | 'approval'        // Requires approval workflow
  | 'confirmation'    // Requires confirmation action
  | 'auto_complete'   // Auto-completes on condition
  | 'deliverable';    // Requires deliverable upload

// ============================================
// Task Structure
// ============================================

/**
 * Task dependency
 */
export interface TaskDependency {
  taskId: TaskId;
  type: 'blocks' | 'blocked_by' | 'related';
  status: 'pending' | 'resolved';
}

/**
 * Task assignment details
 */
export interface TaskAssignment {
  assigneeId: string;
  assigneeRef: TaskAssigneeRef;
  assignedAt: Timestamp;
  assignedBy: UserRef | 'system';
  assignmentMethod: AssignmentRule['type'];
  roleProfileId?: RoleProfileId;
  previousAssignees?: {
    employeeId: string;
    assignedAt: Timestamp;
    unassignedAt: Timestamp;
    reason: string;
  }[];
}

/**
 * Task escalation record
 */
export interface TaskEscalation {
  escalatedAt: Timestamp;
  escalatedBy: UserRef | 'system';
  reason: 'overdue' | 'priority_change' | 'manual' | 'complexity' | 'authority_required';
  fromAssignee?: TaskAssigneeRef;
  toAssignee: TaskAssigneeRef;
  notes?: string;
}

/**
 * Task completion details
 */
export interface TaskCompletion {
  completedAt: Timestamp;
  completedBy: UserRef;
  completionType: CompletionType;
  outcome: 'success' | 'partial' | 'failed' | 'not_applicable';
  notes?: string;
  deliverables?: {
    type: string;
    reference: string;
    url?: string;
  }[];
  duration?: number; // Actual minutes spent
  rating?: {
    quality: number; // 1-5
    timeliness: number; // 1-5
    ratedBy: UserRef;
    ratedAt: Timestamp;
  };
}

/**
 * Task context from generating event
 */
export interface TaskContext {
  eventId?: string;
  eventType?: string;
  eventPayload?: Record<string, any>;
  parentTaskId?: TaskId;
  relatedEntityType?: string;
  relatedEntityId?: string;
  customData?: Record<string, any>;
}

/**
 * Task comment
 */
export interface TaskComment {
  id: string;
  text: string;
  author: UserRef;
  createdAt: Timestamp;
  editedAt?: Timestamp;
}

/**
 * Core Task entity
 */
export interface Task extends TimestampFields {
  id: TaskId;
  
  // Classification
  subsidiaryId: SubsidiaryId;
  departmentId?: DepartmentId;
  
  // Task content
  title: string;
  description: string;
  instructions?: string[];
  taskType: string; // Maps to EventTaskRule.taskType
  
  // Source & context
  source: TaskSource;
  context: TaskContext;
  
  // Status tracking
  status: TaskStatus;
  stage: TaskStage;
  priority: TaskPriority;
  
  // Assignment
  assignment?: TaskAssignment;
  
  // Timing
  dueDate?: Timestamp;
  startDate?: Timestamp;
  estimatedMinutes?: number;
  
  // Dependencies
  dependencies?: TaskDependency[];
  
  // Completion
  completionType: CompletionType;
  completion?: TaskCompletion;
  
  // Escalation history
  escalations?: TaskEscalation[];
  
  // Workflow
  requiresApproval?: boolean;
  approvalConfig?: {
    approverRoles: RoleProfileId[];
    minimumApprovers: number;
    autoApproveAfter?: number; // Hours
  };
  
  // AI assistance
  aiSuggestions?: {
    generatedAt: Timestamp;
    suggestions: string[];
    relevantDocs?: string[];
  };
  
  // Notifications
  remindersSent?: Timestamp[];
  lastReminderAt?: Timestamp;
  
  // Comments
  comments?: TaskComment[];
  
  // Tags & search
  tags?: string[];
  searchTerms?: string[];
}

// ============================================
// Task Generation Types
// ============================================

/**
 * Result of task generation attempt
 */
export interface TaskGenerationResult {
  success: boolean;
  taskId?: TaskId;
  task?: Task;
  skipped?: boolean;
  skipReason?: string;
  assignmentFailed?: boolean;
  assignmentError?: string;
  fallbackUsed?: boolean;
  fallbackAssignee?: string;
}

/**
 * Batch generation result
 */
export interface BatchGenerationResult {
  eventId: string;
  eventType: string;
  tasksGenerated: number;
  tasksSkipped: number;
  results: TaskGenerationResult[];
  errors: string[];
  processingTime: number;
}

/**
 * Assignment resolution result
 */
export interface AssignmentResolution {
  resolved: boolean;
  assigneeId?: string;
  assigneeRef?: TaskAssigneeRef;
  roleProfileId?: RoleProfileId;
  method: AssignmentRule['type'];
  fallbackUsed: boolean;
  candidates?: {
    employeeId: string;
    score: number;
    reasons: string[];
  }[];
  error?: string;
}

/**
 * Deadline calculation input
 */
export interface DeadlineInput {
  baseDate: Timestamp;
  slaHours: number;
  priority: TaskPriority;
  businessHoursOnly: boolean;
  excludeWeekends: boolean;
  holidays?: Timestamp[];
}

/**
 * Priority calculation factors
 */
export interface PriorityFactors {
  basePriority: TaskPriority;
  eventPriority?: TaskPriority;
  customerTier?: 'standard' | 'premium' | 'vip';
  financialImpact?: number; // UGX amount
  slaProximity?: number; // Hours until SLA breach
  escalationCount?: number;
}

// ============================================
// Engine Configuration
// ============================================

/**
 * Task generation engine configuration
 */
export interface TaskEngineConfig {
  // Feature flags
  enableAutoAssignment: boolean;
  enablePriorityEscalation: boolean;
  enableDeadlineAdjustment: boolean;
  enableAiSuggestions: boolean;
  
  // Timing
  defaultSlaHours: Record<TaskPriority, number>;
  businessHoursStart: number; // Hour of day (0-23)
  businessHoursEnd: number;
  workDays: number[]; // 0=Sunday, 1=Monday, etc.
  
  // Assignment
  maxAssignmentRetries: number;
  fallbackToManagerDelay: number; // Hours
  workloadBalancingEnabled: boolean;
  maxTasksPerPerson: number;
  
  // Escalation
  overdueEscalationHours: Record<TaskPriority, number>;
  maxEscalationLevel: number;
  
  // Notifications
  reminderBeforeDeadline: number[]; // Hours before deadline
  notifyOnAssignment: boolean;
  notifyOnEscalation: boolean;
}

/**
 * Default engine configuration for Uganda operations
 */
export const DEFAULT_ENGINE_CONFIG: TaskEngineConfig = {
  enableAutoAssignment: true,
  enablePriorityEscalation: true,
  enableDeadlineAdjustment: true,
  enableAiSuggestions: true,
  
  defaultSlaHours: {
    critical: 4,
    high: 8,
    medium: 24,
    low: 72,
  },
  
  businessHoursStart: 8,  // 8 AM EAT
  businessHoursEnd: 17,   // 5 PM EAT
  workDays: [1, 2, 3, 4, 5], // Monday-Friday
  
  maxAssignmentRetries: 3,
  fallbackToManagerDelay: 2,
  workloadBalancingEnabled: true,
  maxTasksPerPerson: 15,
  
  overdueEscalationHours: {
    critical: 1,
    high: 4,
    medium: 12,
    low: 48,
  },
  maxEscalationLevel: 3,
  
  reminderBeforeDeadline: [24, 4, 1], // 24h, 4h, 1h before
  notifyOnAssignment: true,
  notifyOnEscalation: true,
};

// ============================================
// Available Employee for Assignment
// ============================================

/**
 * Employee available for task assignment
 */
export interface AvailableEmployee {
  employeeId: string;
  employeeRef: TaskAssigneeRef;
  roleProfileId: RoleProfileId;
  currentTaskCount: number;
  matchScore: number;
  matchReasons: string[];
  isDepartmentHead?: boolean;
}

/**
 * Criteria for finding available employees
 */
export interface AvailableEmployeeCriteria {
  roleProfileIds?: RoleProfileId[];
  subsidiaryId: SubsidiaryId;
  departmentId?: DepartmentId;
  maxCurrentTasks?: number;
  mustBeAvailable?: boolean;
}
