/**
 * Employee Assignment Service - DawinOS v2.0
 * Service for resolving task assignments to employees based on role profiles and skills
 */

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import type { Employee, EmployeeSummary, EmployeeSkill } from '@/modules/hr-central/types/employee.types';
import type {
  RoleProfile,
  ProficiencyLevel,
} from '../types/role-profile.types';
import type { AssignmentRule } from '../types/business-event.types';
import { STANDARD_ROLE_PROFILES } from '../config/role-profile.constants';
import { normalizeHRProficiency } from '../config/skills-catalog';

// Employee match for internal assignment calculations
interface EmployeeMatch {
  employeeId: string;
  name: string;
  email: string;
  currentLoad: number;
  matchScore: number;
  availability: 'available' | 'busy' | 'overloaded' | 'unavailable';
}

// Extended employee match with max load for ranking
interface RankedEmployeeMatch extends EmployeeMatch {
  maxLoad: number;
}

// Extended employee summary with management flag
interface DepartmentEmployeeSummary extends EmployeeSummary {
  isManagement: boolean;
}

// ============================================
// Types
// ============================================

export interface AssignmentResult {
  employeeId: string;
  employeeName: string;
  email: string;
  roleProfileId: string;
  matchScore: number;
  workload: {
    current: number;
    max: number;
    utilizationPercent: number;
  };
  reason: string;
}

export interface AssignmentOptions {
  subsidiaryId?: string;
  departmentId?: string;
  excludeEmployees?: string[];
  preferLowerWorkload?: boolean;
  requiredSkills?: string[];
  minProficiency?: ProficiencyLevel;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Normalize role slug to kebab-case format
 * Handles both underscore_case and kebab-case inputs
 */
function normalizeRoleSlug(roleSlug: string): string {
  return roleSlug.toLowerCase().replace(/_/g, '-');
}

// ============================================
// Employee Assignment Service
// ============================================

class EmployeeAssignmentService {
  private employeeCache: Map<string, Employee> = new Map();

  // ----------------------------------------
  // Main Assignment Resolution
  // ----------------------------------------

  /**
   * Resolve an assignment rule to a specific employee
   */
  async resolveAssignment(
    rule: AssignmentRule,
    context: {
      subsidiaryId: string;
      departmentId?: string;
      eventTriggerUserId?: string;
      projectId?: string;
      entityData?: Record<string, any>;
    },
    options?: AssignmentOptions
  ): Promise<AssignmentResult | null> {
    try {
      switch (rule.type) {
        case 'role':
          return await this.assignByRole(rule.value || '', context, options);

        case 'department':
          return await this.assignByDepartment(rule.value || context.departmentId || '', context, options);

        case 'user':
          return await this.assignToUser(rule.value || '', context);

        case 'manager':
          return await this.assignToManager(context.eventTriggerUserId || '', context);

        case 'creator':
          return await this.assignToCreator(context.eventTriggerUserId || '', context);

        case 'dynamic':
          return await this.assignDynamically(rule, context, options);

        default:
          console.warn(`Unknown assignment type: ${rule.type}`);
          return null;
      }
    } catch (error) {
      console.error('Error resolving assignment:', error);

      // Try fallback if available
      if (rule.fallback) {
        console.log('Attempting fallback assignment...');
        return this.resolveAssignment(rule.fallback, context, options);
      }

      return null;
    }
  }

  // ----------------------------------------
  // Assignment Strategies
  // ----------------------------------------

  /**
   * Assign by role profile - finds employees with matching role assignments
   */
  async assignByRole(
    roleSlug: string,
    context: { subsidiaryId: string; departmentId?: string },
    options?: AssignmentOptions
  ): Promise<AssignmentResult | null> {
    // Normalize role slug to kebab-case
    const normalizedRoleSlug = normalizeRoleSlug(roleSlug);

    // Get role profile to determine max load
    const roleProfile = STANDARD_ROLE_PROFILES[normalizedRoleSlug];
    const roleMaxLoad = roleProfile?.typicalTaskLoad?.maxConcurrent || 40;

    // Get employees with this role
    const employees = await this.getEmployeesWithRole(normalizedRoleSlug, context.subsidiaryId);

    if (employees.length === 0) {
      console.log(`No employees found with role: ${normalizedRoleSlug}`);
      return null;
    }

    // Convert to RankedEmployeeMatch with role-specific max load
    const employeesWithMaxLoad = employees.map((e): RankedEmployeeMatch => ({
      ...e,
      maxLoad: roleMaxLoad,
    }));

    // Filter and rank by workload
    const ranked = this.rankEmployeesByAvailability(
      employeesWithMaxLoad,
      options
    );

    if (ranked.length === 0) return null;

    const best = ranked[0];
    return {
      employeeId: best.employeeId,
      employeeName: best.name,
      email: best.email || '',
      roleProfileId: normalizedRoleSlug,
      matchScore: best.matchScore,
      workload: {
        current: best.currentLoad,
        max: best.maxLoad,
        utilizationPercent: Math.round((best.currentLoad / best.maxLoad) * 100),
      },
      reason: `Assigned by role: ${normalizedRoleSlug}`,
    };
  }

  /**
   * Assign by department - finds department head or lowest workload member
   */
  async assignByDepartment(
    departmentId: string,
    context: { subsidiaryId: string },
    options?: AssignmentOptions
  ): Promise<AssignmentResult | null> {
    // Get employees in department
    const employees = await this.getEmployeesInDepartment(departmentId, context.subsidiaryId);

    if (employees.length === 0) {
      console.log(`No employees found in department: ${departmentId}`);
      return null;
    }

    // First try to find department head
    const departmentHead = employees.find(e => e.isManagement);
    if (departmentHead) {
      const workload = await this.getEmployeeWorkload(departmentHead.id);
      return {
        employeeId: departmentHead.id,
        employeeName: departmentHead.fullName,
        email: departmentHead.email,
        roleProfileId: 'department-head',
        matchScore: 100,
        workload: {
          current: workload.current,
          max: workload.max,
          utilizationPercent: workload.utilization,
        },
        reason: `Assigned to department head: ${departmentId}`,
      };
    }

    // Otherwise rank by availability
    const ranked = this.rankEmployeesByAvailability(
      employees.map(e => ({
        employeeId: e.id,
        name: e.fullName,
        email: e.email,
        currentLoad: e.activeTaskCount || 0,
        maxLoad: 40,
        matchScore: 80,
        availability: (e.activeTaskCount || 0) < 32 ? 'available' : 'busy' as const,
      })),
      options
    );

    if (ranked.length === 0) return null;

    const best = ranked[0];
    return {
      employeeId: best.employeeId,
      employeeName: best.name,
      email: best.email || '',
      roleProfileId: 'department-member',
      matchScore: best.matchScore,
      workload: {
        current: best.currentLoad,
        max: best.maxLoad,
        utilizationPercent: Math.round((best.currentLoad / best.maxLoad) * 100),
      },
      reason: `Assigned by department: ${departmentId}`,
    };
  }

  /**
   * Assign to specific user
   */
  async assignToUser(
    userId: string,
    _context: { subsidiaryId: string }
  ): Promise<AssignmentResult | null> {
    // Resolve user ID - could be employee ID, email, or Firebase UID
    const employee = await this.resolveEmployee(userId);
    if (!employee) {
      console.log(`Could not resolve user: ${userId}`);
      return null;
    }

    // Verify employee is active
    if (employee.employmentStatus !== 'active' && employee.employmentStatus !== 'probation') {
      console.log(`Employee ${userId} is not active`);
      return null;
    }

    const workload = await this.getEmployeeWorkload(employee.id);

    return {
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      email: employee.email,
      roleProfileId: 'direct-assignment',
      matchScore: 100,
      workload: {
        current: workload.current,
        max: workload.max,
        utilizationPercent: workload.utilization,
      },
      reason: `Direct assignment to user: ${userId}`,
    };
  }

  /**
   * Assign to manager of the triggering user
   */
  async assignToManager(
    triggeredByUserId: string,
    context: { subsidiaryId: string }
  ): Promise<AssignmentResult | null> {
    // Get the triggering employee
    const employee = await this.resolveEmployee(triggeredByUserId);
    if (!employee) return null;

    // Get their manager
    const managerId = employee.position?.reportingTo;
    if (!managerId) {
      console.log(`No manager found for employee: ${triggeredByUserId}`);
      return null;
    }

    return this.assignToUser(managerId, context);
  }

  /**
   * Assign to the event creator/trigger
   */
  async assignToCreator(
    triggeredByUserId: string,
    context: { subsidiaryId: string }
  ): Promise<AssignmentResult | null> {
    if (!triggeredByUserId) return null;
    return this.assignToUser(triggeredByUserId, context);
  }

  /**
   * Dynamic assignment based on custom logic
   */
  async assignDynamically(
    _rule: AssignmentRule,
    context: {
      subsidiaryId: string;
      departmentId?: string;
      entityData?: Record<string, any>;
    },
    options?: AssignmentOptions
  ): Promise<AssignmentResult | null> {
    // Dynamic assignment can look at entity data to determine assignment
    // For example, if entity has an "assignedTo" field already set, use that
    if (context.entityData?.assignedTo) {
      return this.assignToUser(context.entityData.assignedTo, context);
    }

    // Default to department assignment if available
    if (context.departmentId) {
      return this.assignByDepartment(context.departmentId, context, options);
    }

    return null;
  }

  // ----------------------------------------
  // Helper Methods
  // ----------------------------------------

  /**
   * Get employees with a specific role
   */
  async getEmployeesWithRole(
    roleSlug: string,
    subsidiaryId: string
  ): Promise<EmployeeMatch[]> {
    // In a real implementation, query role_assignments collection
    // For now, query employees and match by position/role
    const employeesRef = collection(db, 'employees');
    const q = query(
      employeesRef,
      where('subsidiaryId', '==', subsidiaryId),
      where('employmentStatus', 'in', ['active', 'probation']),
      limit(50)
    );

    try {
      const snapshot = await getDocs(q);
      const matches: EmployeeMatch[] = [];

      const roleProfile = STANDARD_ROLE_PROFILES[roleSlug];
      const roleTitle = roleProfile?.title?.toLowerCase() || roleSlug;

      // Get max load from role profile's typicalTaskLoad
      const roleMaxLoad = roleProfile?.typicalTaskLoad?.maxConcurrent || 40;

      for (const docSnapshot of snapshot.docs) {
        const employee = docSnapshot.data() as Employee;
        const positionTitle = employee.position?.title?.toLowerCase() || '';

        // Match by title similarity or assigned roles
        const hasAssignedRole = employee.systemAccess?.accessRoles?.includes(roleSlug);

        if (
          hasAssignedRole ||
          positionTitle.includes(roleTitle) ||
          roleTitle.includes(positionTitle) ||
          this.matchesBySkills(employee.skills, roleProfile?.skills)
        ) {
          const currentLoad = employee.systemAccess?.accessRoles?.length || 0;

          matches.push({
            employeeId: docSnapshot.id,
            name: `${employee.firstName} ${employee.lastName}`,
            email: employee.email,
            currentLoad,
            availability: currentLoad < roleMaxLoad * 0.8 ? 'available' : 'busy',
            matchScore: hasAssignedRole
              ? 100 // Perfect match if role explicitly assigned
              : this.calculateMatchScore(employee, roleProfile),
          });
        }
      }

      return matches;
    } catch (error) {
      console.error('Error getting employees with role:', error);
      return [];
    }
  }

  /**
   * Get employees in a department
   */
  async getEmployeesInDepartment(
    departmentId: string,
    subsidiaryId: string
  ): Promise<DepartmentEmployeeSummary[]> {
    const employeesRef = collection(db, 'employees');
    const q = query(
      employeesRef,
      where('subsidiaryId', '==', subsidiaryId),
      where('position.departmentId', '==', departmentId),
      where('employmentStatus', 'in', ['active', 'probation']),
      orderBy('position.isManagement', 'desc'),
      limit(50)
    );

    try {
      const snapshot = await getDocs(q);
      return snapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data() as Employee;
        return {
          id: docSnapshot.id,
          employeeNumber: data.employeeNumber,
          subsidiaryId: data.subsidiaryId,
          fullName: `${data.firstName} ${data.lastName}`,
          email: data.email,
          title: data.position?.title || '',
          departmentId: data.position?.departmentId || departmentId,
          employmentStatus: data.employmentStatus,
          employmentType: data.employmentType,
          joiningDate: data.employmentDates?.joiningDate,
          yearsOfService: 0,
          directReports: data.position?.directReports || 0,
          activeTaskCount: 0, // Would need to query tasks
          hasSystemAccess: !!data.systemAccess,
          isManagement: data.position?.isManagement || false,
        };
      });
    } catch (error) {
      console.error('Error getting employees in department:', error);
      return [];
    }
  }

  /**
   * Resolve employee by ID, email, or Firebase UID
   */
  async resolveEmployee(identifier: string): Promise<Employee | null> {
    // Check cache
    if (this.employeeCache.has(identifier)) {
      return this.employeeCache.get(identifier)!;
    }

    try {
      // Try direct ID lookup first
      const directDoc = await getDoc(doc(db, 'employees', identifier));
      if (directDoc.exists()) {
        const employee = { id: directDoc.id, ...directDoc.data() } as Employee;
        this.employeeCache.set(identifier, employee);
        return employee;
      }

      // Try email lookup
      const emailQuery = query(
        collection(db, 'employees'),
        where('email', '==', identifier),
        limit(1)
      );
      const emailSnapshot = await getDocs(emailQuery);
      if (!emailSnapshot.empty) {
        const employee = {
          id: emailSnapshot.docs[0].id,
          ...emailSnapshot.docs[0].data(),
        } as Employee;
        this.employeeCache.set(identifier, employee);
        return employee;
      }

      // Try Firebase UID lookup
      const uidQuery = query(
        collection(db, 'employees'),
        where('systemAccess.userId', '==', identifier),
        limit(1)
      );
      const uidSnapshot = await getDocs(uidQuery);
      if (!uidSnapshot.empty) {
        const employee = {
          id: uidSnapshot.docs[0].id,
          ...uidSnapshot.docs[0].data(),
        } as Employee;
        this.employeeCache.set(identifier, employee);
        return employee;
      }

      return null;
    } catch (error) {
      console.error('Error resolving employee:', error);
      return null;
    }
  }

  /**
   * Get employee workload
   */
  async getEmployeeWorkload(
    employeeId: string
  ): Promise<{ current: number; max: number; utilization: number }> {
    // Query generatedTasks for active tasks assigned to this employee
    const tasksRef = collection(db, 'generatedTasks');
    const activeQuery = query(
      tasksRef,
      where('assignedTo', '==', employeeId),
      where('status', 'in', ['pending', 'in_progress', 'blocked'])
    );
    const snapshot = await getDocs(activeQuery);
    const current = snapshot.size;

    // Get max from role profile if available, default to 10
    const maxConcurrent = this.getEmployeeMaxTasks(employeeId);

    return {
      current,
      max: maxConcurrent,
      utilization: maxConcurrent > 0 ? Math.round((current / maxConcurrent) * 100) : 0,
    };
  }

  /**
   * Get max concurrent tasks for an employee based on their role profile
   */
  private getEmployeeMaxTasks(employeeId: string): number {
    const cached = this.employeeCache.get(employeeId);
    if (cached) {
      const positionTitle = (cached as any).position?.title || '';
      for (const profile of Object.values(STANDARD_ROLE_PROFILES)) {
        if (profile.title && positionTitle.toLowerCase().includes(profile.title.toLowerCase())) {
          return profile.typicalTaskLoad?.maxConcurrent || 10;
        }
      }
    }
    return 10;
  }

  /**
   * Rank employees by availability (lower workload = higher rank)
   */
  rankEmployeesByAvailability(
    employees: (EmployeeMatch | RankedEmployeeMatch)[],
    options?: AssignmentOptions
  ): RankedEmployeeMatch[] {
    const ranked = employees
      .filter((e) => !options?.excludeEmployees?.includes(e.employeeId))
      .map((e): RankedEmployeeMatch => ({
        ...e,
        maxLoad: 'maxLoad' in e ? e.maxLoad : 40, // Default from role profiles
        availability: e.currentLoad < 40 * 0.8 ? 'available' : 'busy',
      }))
      .sort((a, b) => {
        // Primary sort: availability
        if (a.availability !== b.availability) {
          return a.availability === 'available' ? -1 : 1;
        }
        // Secondary sort: current load (lower is better)
        if (options?.preferLowerWorkload !== false) {
          const loadDiff = a.currentLoad - b.currentLoad;
          if (loadDiff !== 0) return loadDiff;
        }
        // Tertiary sort: match score (higher is better)
        return b.matchScore - a.matchScore;
      });

    return ranked;
  }

  /**
   * Check if employee skills match role requirements
   */
  matchesBySkills(
    employeeSkills: EmployeeSkill[] | undefined,
    roleSkills: RoleProfile['skills'] | undefined
  ): boolean {
    if (!roleSkills || roleSkills.length === 0) return false;
    if (!employeeSkills || employeeSkills.length === 0) return false;

    const coreSkills = roleSkills.filter((s) => s.isCore);
    if (coreSkills.length === 0) return true;

    // Check if employee has at least half of the core skills with adequate proficiency
    let matchCount = 0;
    let exactMatchCount = 0;

    for (const roleSkill of coreSkills) {
      const employeeSkill = employeeSkills.find(
        (es) =>
          es.name.toLowerCase().includes(roleSkill.name.toLowerCase()) ||
          roleSkill.name.toLowerCase().includes(es.name.toLowerCase())
      );

      if (employeeSkill) {
        matchCount++;

        // Check proficiency level
        const employeeProficiency = normalizeHRProficiency(employeeSkill.proficiencyLevel);
        const comparison = this.compareProficiency(employeeProficiency, roleSkill.requiredLevel);

        // Employee meets or exceeds required level
        if (comparison >= 0) {
          exactMatchCount++;
        }
      }
    }

    // Require at least 50% of core skills present, and at least 50% of those with adequate proficiency
    const hasEnoughSkills = matchCount >= Math.ceil(coreSkills.length / 2);
    const hasAdequateProficiency = exactMatchCount >= Math.ceil(matchCount / 2);

    return hasEnoughSkills && hasAdequateProficiency;
  }

  /**
   * Calculate match score for employee vs role profile
   */
  calculateMatchScore(
    employee: Employee,
    roleProfile?: Partial<RoleProfile>
  ): number {
    if (!roleProfile) return 50;

    let score = 50; // Base score

    // Title match
    if (
      roleProfile.title &&
      employee.position?.title?.toLowerCase().includes(roleProfile.title.toLowerCase())
    ) {
      score += 25;
    }

    // Skills match
    if (roleProfile.skills && employee.skills) {
      const skillMatches = roleProfile.skills.filter((rs) =>
        employee.skills.some(
          (es) =>
            es.name.toLowerCase().includes(rs.name.toLowerCase()) &&
            this.compareProficiency(
              normalizeHRProficiency(es.proficiencyLevel),
              rs.requiredLevel
            ) >= 0
        )
      );
      score += Math.min(25, (skillMatches.length / roleProfile.skills.length) * 25);
    }

    return Math.min(100, score);
  }

  /**
   * Compare proficiency levels
   * Returns: -1 if a < b, 0 if a == b, 1 if a > b
   */
  compareProficiency(a: ProficiencyLevel, b: ProficiencyLevel): number {
    const levels: ProficiencyLevel[] = ['novice', 'intermediate', 'advanced', 'expert'];
    return levels.indexOf(a) - levels.indexOf(b);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.employeeCache.clear();
  }
}

export const employeeAssignmentService = new EmployeeAssignmentService();
export default employeeAssignmentService;
