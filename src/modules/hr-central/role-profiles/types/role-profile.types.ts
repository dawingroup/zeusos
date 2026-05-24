/**
 * Role Profile — Addendum v1.2 §2.1.
 *
 * People are modelled as role profiles + role assignments, not flat
 * permissions. A role profile is a typed contract describing what a
 * holder can do, approve, and absorb in workload.
 *
 * Distinct from the existing organization `Position` (an org-chart
 * slot with reporting + grade level). A Position can map to one or
 * more RoleProfiles via RoleAssignment.
 *
 * Phase 6.A.1: schema only. The EmployeeAssignmentService that
 * consumes this lives in functions/src/assignment/services/.
 */

import type { Timestamp } from 'firebase/firestore';
import type { SubsidiaryId, DepartmentId } from '../../../intelligence/config/constants';
import type { EmployeeId, EmploymentType } from '../../types/employee.types';
import type { TaskCapability, ApprovalAuthority } from './task-capability.types';

/**
 * Role profile identifier. Format: `ROLE-{brand}-{slug}` — e.g.
 * `ROLE-zeus-the-agency-executive-creative-director`.
 */
export type RoleProfileId = string;

/**
 * Job-level rung. Drives default `typicalTaskLoad` and approval
 * authority defaults. Matches the existing org chart conventions.
 */
export type JobLevel =
  | 'intern'
  | 'associate'
  | 'mid'
  | 'senior'
  | 'manager'
  | 'director'
  | 'executive';

/**
 * Skill requirement on a role — distinct from EmployeeSkill (a skill
 * a person holds). Refs the canonical skill registry once Phase 6.B
 * normalises it; until then `name + category` is the join key.
 */
export interface RoleSkill {
  category: string;
  name: string;
  requiredLevel: 'novice' | 'intermediate' | 'advanced' | 'expert';
  isCore: boolean;
}

/**
 * Workload envelope used by the assigner for ranking. An overloaded
 * expert loses to an available intermediate (v1.2 §2.3).
 */
export interface TypicalTaskLoad {
  daily: number;
  weekly: number;
  maxConcurrent: number;
}

/**
 * Per-role AI personalisation — what surfaces to whom. An ECD sees
 * creative-quality and approval-queue items first; an Account Director
 * sees client-health and margin first; a Traffic Manager sees capacity
 * and SLA risk first. Same system, different lens per role.
 */
export interface RoleAiContext {
  briefingPriorities: string[];
  taskSortingWeights: Record<string, number>;
  communicationStyle: 'concise' | 'detailed' | 'visual' | 'data-first';
}

/**
 * Canonical role profile. Per Addendum v1.2 §2.1 the v1.0
 * subsidiary scope is re-pointed to the five sibling brands; brandId
 * accepts the canonical SubsidiaryId or `'all'` for cross-brand roles
 * (e.g. Traffic, Group Finance Sentinel).
 */
export interface RoleProfile {
  id: RoleProfileId;

  // Scoping
  brandId: SubsidiaryId | 'all';
  departmentId: DepartmentId;
  jobLevel: JobLevel;
  employmentTypes: EmploymentType[];

  // Display
  title: string;
  description?: string;

  // Org graph — first-class, NOT derived from reporting lines on
  // employees. Lets escalation and delegation be modelled without
  // forcing a single tree.
  reportsTo: RoleProfileId[];
  supervises: RoleProfileId[];
  peers: RoleProfileId[];
  escalationPath: RoleProfileId[];
  delegationPool: RoleProfileId[];

  // Skills + authority — the v1.2 verb matrix
  skills: RoleSkill[];
  taskCapabilities: TaskCapability[];
  approvalAuthorities: ApprovalAuthority[];

  // Workload + AI lens
  typicalTaskLoad: TypicalTaskLoad;
  aiContext: RoleAiContext;

  // Lifecycle
  status: 'draft' | 'active' | 'archived';

  // System fields
  createdBy: string;
  createdAt: Timestamp;
  updatedBy: string;
  updatedAt: Timestamp;
}

/**
 * Lightweight summary for lists / picker UIs. The full profile is
 * fat (taskCapabilities can be dozens of entries); the summary is
 * what surfaces at index/list time.
 */
export interface RoleProfileSummary {
  id: RoleProfileId;
  brandId: SubsidiaryId | 'all';
  departmentId: DepartmentId;
  jobLevel: JobLevel;
  title: string;
  status: RoleProfile['status'];
  assignedHeadcount: number;
}

/**
 * Effective-dated assignment of an Employee to a RoleProfile. v1.2
 * §2.3: the assigner walks `role_assignment` to find candidates,
 * ranked by current utilisation. Overrides let an individual carry
 * custom authority without forking a new RoleProfile.
 */
export interface RoleAssignment {
  id: string;
  employeeId: EmployeeId;
  roleProfileId: RoleProfileId;

  // Effective dates — assigner filters on `effectiveFrom ≤ now <
  // effectiveTo` when resolving.
  effectiveFrom: Timestamp;
  effectiveTo?: Timestamp;

  // One assignment per employee is `primary`; others are
  // secondary (committee / acting / coverage). Primary biases the
  // `role` rule type's ranking.
  isPrimary: boolean;

  // Optional per-person overrides — narrow the role's authority for
  // this individual. Cannot widen — the dispatcher composes a min of
  // role + override flags.
  overrides?: {
    customAuthorities?: ApprovalAuthority[];
    maxDailyTasks?: number;
    pausedUntil?: Timestamp;
  };

  // System fields
  assignedBy: string;
  assignedAt: Timestamp;
  status: 'active' | 'ended' | 'paused';
}

// ============================================
// DTO inputs for the future create / update CFns (6.A.2)
// ============================================

export interface CreateRoleProfileInput {
  brandId: SubsidiaryId | 'all';
  departmentId: DepartmentId;
  jobLevel: JobLevel;
  employmentTypes: EmploymentType[];
  title: string;
  description?: string;
  reportsTo?: RoleProfileId[];
  supervises?: RoleProfileId[];
  peers?: RoleProfileId[];
  escalationPath?: RoleProfileId[];
  delegationPool?: RoleProfileId[];
  skills?: RoleSkill[];
  taskCapabilities?: TaskCapability[];
  approvalAuthorities?: ApprovalAuthority[];
  typicalTaskLoad: TypicalTaskLoad;
  aiContext?: Partial<RoleAiContext>;
}

export interface AssignEmployeeToRoleInput {
  employeeId: EmployeeId;
  roleProfileId: RoleProfileId;
  effectiveFrom: string;
  effectiveTo?: string;
  isPrimary?: boolean;
  overrides?: RoleAssignment['overrides'];
}
