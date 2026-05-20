/**
 * Grey Area Detection Types - DawinOS v2.0
 * Types for ambiguous situation detection and escalation
 */

import { Timestamp } from 'firebase/firestore';
import {
  SubsidiaryId,
  DepartmentId,
  GreyAreaType,
} from '../config/constants';
import { TimestampFields, UserRef, Money } from './base.types';
import { TaskId, TaskAssigneeRef } from './task-generation.types';
import { RoleProfileId } from './role-profile.types';

// ============================================
// Grey Area Core Types
// ============================================

/**
 * Unique identifier for a grey area
 */
export type GreyAreaId = string;

/**
 * Severity level of the grey area
 */
export type GreyAreaSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Status of grey area resolution
 */
export type GreyAreaStatus = 
  | 'detected'        // Newly identified
  | 'under_review'    // Being evaluated
  | 'pending_input'   // Waiting for information
  | 'escalated'       // Escalated to higher level
  | 'resolved'        // Decision made
  | 'dismissed'       // Determined to be non-issue
  | 'automated';      // System resolved automatically

/**
 * Source that detected the grey area
 */
export type DetectionSource = 
  | 'rule_engine'      // Detected by rule evaluation
  | 'ai_analysis'      // Detected by AI analysis
  | 'threshold_breach' // Threshold violation
  | 'conflict_detection' // Conflicting rules/data
  | 'manual_flag'      // Flagged by user
  | 'pattern_anomaly'  // Unusual pattern detected
  | 'compliance_check' // Compliance rule violation
  | 'external_signal'; // External system alert

/**
 * Resolution approach taken
 */
export type ResolutionApproach = 
  | 'human_decision'    // Human made final call
  | 'rule_override'     // Existing rule overridden
  | 'new_rule_created'  // New rule added for future
  | 'exception_granted' // One-time exception
  | 'escalated_higher'  // Sent to higher authority
  | 'policy_update'     // Policy was updated
  | 'data_correction'   // Data was corrected
  | 'no_action';        // No action needed

// ============================================
// Detection Context
// ============================================

/**
 * Context in which grey area was detected
 */
export interface DetectionContext {
  // Source entity
  entityType: 'task' | 'event' | 'employee' | 'transaction' | 'request' | 'document' | 'workflow';
  entityId: string;
  entityName?: string;
  
  // Related items
  relatedTaskId?: TaskId;
  relatedEventId?: string;
  relatedEmployeeId?: string;
  
  // Detection details
  triggeredBy?: UserRef;
  detectedAt: Timestamp;
  detectionMethod: DetectionSource;
  
  // Additional context
  customData?: Record<string, any>;
}

/**
 * Analysis performed on the grey area
 */
export interface GreyAreaAnalysis {
  // AI analysis (if available)
  aiAssessment?: {
    summary: string;
    confidence: number; // 0-1
    suggestedAction: string;
    reasoning: string[];
    similarCases?: {
      caseId: string;
      similarity: number;
      outcome: string;
    }[];
  };
  
  // Rule conflicts
  conflictingRules?: {
    ruleId: string;
    ruleName: string;
    outcome: string;
    priority: number;
  }[];
  
  // Threshold analysis
  thresholdData?: {
    metric: string;
    currentValue: number;
    threshold: number;
    deviation: number; // Percentage over/under
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  
  // Risk assessment
  riskAssessment?: {
    financialRisk: GreyAreaSeverity;
    reputationalRisk: GreyAreaSeverity;
    operationalRisk: GreyAreaSeverity;
    complianceRisk: GreyAreaSeverity;
    overallRisk: GreyAreaSeverity;
  };
  
  // Impact analysis
  impactAnalysis?: {
    affectedEntities: number;
    financialImpact?: Money;
    timeImpact?: number; // Hours of delay
    stakeholders: string[];
  };
}

/**
 * Escalation record
 */
export interface GreyAreaEscalation {
  escalatedAt: Timestamp;
  escalatedBy: UserRef | 'system';
  escalatedTo: TaskAssigneeRef;
  reason: string;
  previousAssignee?: TaskAssigneeRef;
  escalationLevel: number;
  deadline?: Timestamp;
  acknowledged?: boolean;
  acknowledgedAt?: Timestamp;
}

/**
 * Resolution details
 */
export interface GreyAreaResolution {
  resolvedAt: Timestamp;
  resolvedBy: UserRef;
  approach: ResolutionApproach;
  decision: string;
  reasoning: string;
  outcome: 'approved' | 'rejected' | 'modified' | 'deferred' | 'not_applicable';
  
  // Follow-up actions
  followUpActions?: {
    type: string;
    description: string;
    assignedTo?: TaskAssigneeRef;
    dueDate?: Timestamp;
    completed?: boolean;
  }[];
  
  // Learning capture
  learningCapture?: {
    shouldCreateRule: boolean;
    ruleSuggestion?: string;
    policyRecommendation?: string;
    trainingNeeded?: boolean;
    documentationUpdate?: boolean;
  };
}

/**
 * Input request for grey area
 */
export interface GreyAreaInput {
  requestedAt: Timestamp;
  requestedBy: UserRef | 'system';
  question: string;
  inputType: 'text' | 'choice' | 'number' | 'date' | 'approval';
  options?: string[]; // For choice type
  required: boolean;
  deadline?: Timestamp;
  
  // Response
  response?: {
    providedAt: Timestamp;
    providedBy: UserRef;
    value: any;
    notes?: string;
  };
}

// ============================================
// Grey Area Entity
// ============================================

/**
 * Core Grey Area entity
 */
export interface GreyArea extends TimestampFields {
  id: GreyAreaId;
  
  // Classification
  type: GreyAreaType;
  subsidiaryId: SubsidiaryId;
  departmentId?: DepartmentId;
  
  // Description
  title: string;
  description: string;
  details?: string;
  
  // Status
  status: GreyAreaStatus;
  severity: GreyAreaSeverity;
  
  // Detection
  detectionContext: DetectionContext;
  
  // Analysis
  analysis?: GreyAreaAnalysis;
  
  // Assignment
  assignedTo?: TaskAssigneeRef;
  assignedAt?: Timestamp;
  reviewerRoles?: RoleProfileId[];
  
  // Escalation history
  escalations?: GreyAreaEscalation[];
  currentEscalationLevel: number;
  
  // Inputs needed
  inputsRequired?: GreyAreaInput[];
  
  // Resolution
  resolution?: GreyAreaResolution;
  
  // Deadline
  resolutionDeadline?: Timestamp;
  slaHours?: number;
  
  // Related grey areas
  relatedGreyAreas?: GreyAreaId[];
  
  // Tags
  tags?: string[];
  
  // Search
  searchTerms?: string[];
  
  // Activity log
  activityLog?: {
    action: string;
    performedBy: UserRef | 'system';
    performedAt: Timestamp;
    details?: string;
  }[];
}

// ============================================
// Detection Rule Types
// ============================================

/**
 * Detection rule condition
 */
export interface DetectionCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'regex' | 'between';
  value: any;
  valueEnd?: any; // For between operator
}

/**
 * Detection rule definition
 */
export interface DetectionRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  
  // Targeting
  entityTypes: ('task' | 'event' | 'employee' | 'transaction' | 'request' | 'document')[];
  eventTypes?: string[];
  subsidiaryIds?: SubsidiaryId[];
  
  // Conditions
  conditions: DetectionCondition[];
  conditionLogic: 'and' | 'or';
  
  // Grey area creation
  greyAreaType: GreyAreaType;
  severity: GreyAreaSeverity;
  titleTemplate: string;
  descriptionTemplate: string;
  
  // Assignment
  assignToRoles?: RoleProfileId[];
  assignToDepartment?: DepartmentId;
  
  // SLA
  slaHours: number;
  
  // Priority
  priority: number; // Higher = checked first
  
  // Metadata
  createdBy?: UserRef;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Detection engine configuration
 */
export interface DetectionEngineConfig {
  // Feature flags
  enableRuleEngine: boolean;
  enableAiAnalysis: boolean;
  enableThresholdMonitoring: boolean;
  enablePatternDetection: boolean;
  enableConflictDetection: boolean;
  
  // Thresholds
  aiConfidenceThreshold: number; // Below this triggers grey area
  anomalyDeviationThreshold: number; // Percentage deviation to flag
  
  // SLA defaults by severity
  defaultSlaHours: Record<GreyAreaSeverity, number>;
  
  // Escalation
  autoEscalateAfterHours: number;
  maxEscalationLevel: number;
  
  // AI settings
  aiModelId: string;
  aiMaxTokens: number;
  
  // Notification
  notifyOnDetection: boolean;
  notifyOnEscalation: boolean;
  notifyBeforeDeadline: number[]; // Hours before deadline
}

/**
 * Default detection configuration for Uganda operations
 */
export const DEFAULT_DETECTION_CONFIG: DetectionEngineConfig = {
  enableRuleEngine: true,
  enableAiAnalysis: true,
  enableThresholdMonitoring: true,
  enablePatternDetection: true,
  enableConflictDetection: true,
  
  aiConfidenceThreshold: 0.7,
  anomalyDeviationThreshold: 25, // 25% deviation
  
  defaultSlaHours: {
    critical: 4,
    high: 8,
    medium: 24,
    low: 72,
  },
  
  autoEscalateAfterHours: 4,
  maxEscalationLevel: 3,
  
  aiModelId: 'gemini-pro',
  aiMaxTokens: 1000,
  
  notifyOnDetection: true,
  notifyOnEscalation: true,
  notifyBeforeDeadline: [4, 1],
};
