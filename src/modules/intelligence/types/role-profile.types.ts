/**
 * Role Profile Types - DawinOS v2.0
 * Defines organizational roles and their capabilities for intelligent task routing
 */

import { Timestamp } from 'firebase/firestore';
import {
  SubsidiaryId,
  DepartmentId,
  JobLevel,
  EmploymentType,
} from '../config/constants';
import { TimestampFields, AuditFields, UserRef, Money } from './base.types';

// ============================================
// Role Core Types
// ============================================

/**
 * Unique identifier for a role profile
 */
export type RoleProfileId = string;

/**
 * Skill category for role matching
 */
export type SkillCategory =
  | 'technical'      // Technical/domain expertise
  | 'management'     // People management
  | 'financial'      // Financial handling
  | 'customer'       // Customer facing
  | 'operational'    // Operations/logistics
  | 'strategic'      // Strategy/planning
  | 'compliance'     // Legal/regulatory
  | 'administrative' // Administrative tasks
  | 'creative'       // Creative/design
  | 'sales'          // Sales & business development
  | 'analytical';    // Data analysis & research

/**
 * Proficiency level for skills
 */
export type ProficiencyLevel = 'novice' | 'intermediate' | 'advanced' | 'expert';

/**
 * Authority type for approvals
 */
export type AuthorityType =
  | 'financial'      // Can approve financial transactions
  | 'procurement'    // Can approve procurement requests
  | 'hr'             // Can approve HR actions
  | 'leave'          // Can approve leave requests
  | 'expense'        // Can approve expenses
  | 'contract'       // Can approve contracts
  | 'policy'         // Can approve policies
  | 'operational'    // Can approve operational decisions
  | 'strategic';     // Can approve strategic initiatives

/**
 * Role status in the system
 */
export type RoleStatus = 'active' | 'inactive' | 'deprecated';

// ============================================
// Skill & Capability Definitions
// ============================================

/**
 * A specific skill with proficiency level
 */
export interface RoleSkill {
  category: SkillCategory;
  name: string;
  description?: string;
  requiredLevel: ProficiencyLevel;
  isCore: boolean; // Required for the role vs nice-to-have
}

/**
 * Task capability - what types of tasks this role can handle
 */
export interface TaskCapability {
  eventType: string;           // Event type this role can handle
  taskTypes: string[];         // Specific task types within the event
  canInitiate: boolean;        // Can create these tasks
  canExecute: boolean;         // Can perform these tasks
  canApprove: boolean;         // Can approve these tasks
  canDelegate: boolean;        // Can delegate to others
  conditions?: TaskCondition[]; // Conditional capabilities
}

/**
 * Condition for capability application
 */
export interface TaskCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: any;
}

/**
 * Approval authority with limits
 */
export interface ApprovalAuthority {
  type: AuthorityType;
  maxAmount?: Money;           // Maximum amount can approve
  requiresCoApproval?: boolean; // Needs another approver
  coApproverRole?: RoleProfileId;
  canApproveFor: 'self' | 'team' | 'department' | 'subsidiary' | 'all' | 'specific';
  restrictions?: AuthorityRestriction[];
}

/**
 * Restriction on authority
 */
export interface AuthorityRestriction {
  type: 'time_based' | 'amount_based' | 'category_based' | 'subsidiary_based';
  description: string;
  condition: TaskCondition;
}

// ============================================
// Role Profile Definition
// ============================================

/**
 * Complete role profile definition
 */
export interface RoleProfile extends TimestampFields, AuditFields {
  id: RoleProfileId;
  
  // Basic Information
  title: string;
  slug: string;                // URL-friendly identifier
  description: string;
  shortDescription: string;    // For UI cards
  
  // Organizational Context
  subsidiaryId: SubsidiaryId | 'all';  // 'all' for cross-subsidiary roles
  departmentId?: DepartmentId;
  jobLevel: JobLevel;
  employmentTypes: EmploymentType[];   // What employment types can hold this role
  
  // Reporting Structure
  reportsTo: RoleProfileId[];          // Can report to any of these roles
  supervises: RoleProfileId[];         // Typically supervises these roles
  peers: RoleProfileId[];              // Peer roles for collaboration
  
  // Skills & Capabilities
  skills: RoleSkill[];
  taskCapabilities: TaskCapability[];
  approvalAuthorities: ApprovalAuthority[];
  
  // Escalation & Delegation
  escalationPath: RoleProfileId[];     // Who to escalate to (in order)
  delegationPool: RoleProfileId[];     // Who can receive delegated tasks
  canEscalateTo: RoleProfileId[];      // Who this role can escalate to
  
  // Workload Management
  typicalTaskLoad: {
    daily: number;                     // Expected tasks per day
    weekly: number;                    // Expected tasks per week
    maxConcurrent: number;             // Max tasks at once
  };
  
  // System Metadata
  status: RoleStatus;
  version: number;
  effectiveFrom: Timestamp;
  effectiveTo?: Timestamp;
  
  // AI Context
  aiContext: {
    briefingPriorities: string[];      // What to prioritize in morning briefing
    taskSortingWeights: Record<string, number>; // Custom priority weights
    communicationStyle?: 'formal' | 'casual' | 'technical' | 'professional';
  };
}

// ============================================
// Role Assignment
// ============================================

/**
 * Assignment of an employee to a role
 */
export interface RoleAssignment extends TimestampFields {
  id: string;
  employeeId: string;
  roleProfileId: RoleProfileId;
  subsidiaryId: SubsidiaryId;
  departmentId: DepartmentId;
  
  // Assignment Details
  isPrimary: boolean;          // Primary role for the employee
  effectiveFrom: Timestamp;
  effectiveTo?: Timestamp;
  assignedBy: UserRef;
  
  // Customizations (override role defaults)
  customAuthorities?: ApprovalAuthority[];
  customCapabilities?: TaskCapability[];
  maxDailyTasks?: number;
  
  // Status
  status: 'active' | 'pending' | 'suspended' | 'ended';
  statusReason?: string;
}

// ============================================
// Role Matching & Routing
// ============================================

/**
 * Criteria for finding suitable roles/employees for a task
 */
export interface RoleMatchCriteria {
  eventType: string;
  taskType: string;
  subsidiaryId: SubsidiaryId;
  departmentId?: DepartmentId;
  requiredSkills?: SkillCategory[];
  requiredAuthority?: AuthorityType;
  amountToApprove?: Money;
  urgency?: 'low' | 'normal' | 'high' | 'critical';
}

/**
 * Result of role matching
 */
export interface RoleMatchResult {
  roleProfileId: RoleProfileId;
  matchScore: number;          // 0-100 matching score
  matchReasons: string[];      // Why this role matches
  missingCapabilities: string[]; // What's missing (if partial match)
  availableEmployees: EmployeeMatch[];
}

/**
 * Employee availability for task assignment
 */
export interface EmployeeMatch {
  employeeId: string;
  name: string;
  currentLoad: number;         // Current task count
  availability: 'available' | 'busy' | 'overloaded' | 'unavailable';
  matchScore: number;          // 0-100 based on workload and fit
  lastAssignedAt?: Timestamp;
  preferenceScore?: number;    // Based on past performance
}

// ============================================
// Role Profile Templates
// ============================================

/**
 * Pre-defined role template for quick setup
 */
export interface RoleTemplate {
  id: string;
  name: string;
  category: 'executive' | 'management' | 'professional' | 'operational' | 'support';
  description: string;
  baseProfile: Partial<RoleProfile>;
  customizations: RoleTemplateCustomization[];
}

/**
 * Customization option for role templates
 */
export interface RoleTemplateCustomization {
  field: keyof RoleProfile;
  label: string;
  description: string;
  type: 'text' | 'number' | 'select' | 'multi-select';
  options?: { value: string; label: string }[];
  defaultValue?: any;
}
