/**
 * Role Profile Service - DawinOS v2.0
 * Manages role profiles and employee-role matching
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase/firestore';
import { COLLECTIONS } from '../config/constants';
import {
  RoleProfile,
  RoleProfileId,
  RoleAssignment,
  RoleMatchCriteria,
  RoleMatchResult,
  EmployeeMatch,
} from '../types/role-profile.types';
import { SubsidiaryId } from '../config/constants';

// ============================================
// Role Profile CRUD
// ============================================

/**
 * Get role profile by ID
 */
export async function getRoleProfile(id: RoleProfileId): Promise<RoleProfile | null> {
  const docRef = doc(db, COLLECTIONS.ROLE_PROFILES, id);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) {
    return null;
  }
  
  return { id: snapshot.id, ...snapshot.data() } as RoleProfile;
}

/**
 * Get all active role profiles for a subsidiary
 */
export async function getRoleProfilesBySubsidiary(
  subsidiaryId: SubsidiaryId
): Promise<RoleProfile[]> {
  const q = query(
    collection(db, COLLECTIONS.ROLE_PROFILES),
    where('status', '==', 'active'),
    where('subsidiaryId', 'in', [subsidiaryId, 'all']),
    orderBy('jobLevel'),
    orderBy('title')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoleProfile));
}

/**
 * Get role profiles that can handle a specific event/task type
 */
export async function getRolesForEventType(
  eventType: string,
  subsidiaryId: SubsidiaryId
): Promise<RoleProfile[]> {
  const allRoles = await getRoleProfilesBySubsidiary(subsidiaryId);
  
  return allRoles.filter(role =>
    role.taskCapabilities.some(cap => cap.eventType === eventType)
  );
}

/**
 * Get role profile by slug
 */
export async function getRoleProfileBySlug(slug: string): Promise<RoleProfile | null> {
  const q = query(
    collection(db, COLLECTIONS.ROLE_PROFILES),
    where('slug', '==', slug),
    where('status', '==', 'active')
  );
  
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    return null;
  }
  
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as RoleProfile;
}

// ============================================
// Role Assignment
// ============================================

/**
 * Get active role assignment for an employee
 */
export async function getEmployeeRoleAssignment(
  employeeId: string,
  primary: boolean = true
): Promise<RoleAssignment | null> {
  const q = query(
    collection(db, COLLECTIONS.ROLE_ASSIGNMENTS),
    where('employeeId', '==', employeeId),
    where('status', '==', 'active'),
    where('isPrimary', '==', primary)
  );
  
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    return null;
  }
  
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as RoleAssignment;
}

/**
 * Get all role assignments for an employee (primary and secondary)
 */
export async function getAllEmployeeRoleAssignments(
  employeeId: string
): Promise<RoleAssignment[]> {
  const q = query(
    collection(db, COLLECTIONS.ROLE_ASSIGNMENTS),
    where('employeeId', '==', employeeId),
    where('status', '==', 'active')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoleAssignment));
}

/**
 * Get all employees assigned to a role
 */
export async function getEmployeesWithRole(
  roleProfileId: RoleProfileId
): Promise<RoleAssignment[]> {
  const q = query(
    collection(db, COLLECTIONS.ROLE_ASSIGNMENTS),
    where('roleProfileId', '==', roleProfileId),
    where('status', '==', 'active')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoleAssignment));
}

// ============================================
// Role Matching Engine
// ============================================

/**
 * Find suitable roles for a task based on criteria
 */
export async function findMatchingRoles(
  criteria: RoleMatchCriteria
): Promise<RoleMatchResult[]> {
  const roles = await getRoleProfilesBySubsidiary(criteria.subsidiaryId);
  const results: RoleMatchResult[] = [];
  
  for (const role of roles) {
    const matchResult = evaluateRoleMatch(role, criteria);
    
    if (matchResult.matchScore > 0) {
      // Get employees assigned to this role
      const assignments = await getEmployeesWithRole(role.id);
      
      // Evaluate employee availability
      const employeeMatches = await Promise.all(
        assignments.map(assignment => evaluateEmployeeMatch(assignment, criteria))
      );
      
      results.push({
        roleProfileId: role.id,
        matchScore: matchResult.matchScore,
        matchReasons: matchResult.reasons,
        missingCapabilities: matchResult.missing,
        availableEmployees: employeeMatches.filter(e => e.availability !== 'unavailable'),
      });
    }
  }
  
  // Sort by match score descending
  return results.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Evaluate how well a role matches the criteria
 */
function evaluateRoleMatch(
  role: RoleProfile,
  criteria: RoleMatchCriteria
): { matchScore: number; reasons: string[]; missing: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const missing: string[] = [];
  
  // Check task capability
  const capability = role.taskCapabilities.find(
    cap => cap.eventType === criteria.eventType
  );
  
  if (!capability) {
    return { matchScore: 0, reasons: [], missing: ['Cannot handle this event type'] };
  }
  
  // Event type match
  if (capability.taskTypes.includes(criteria.taskType)) {
    score += 40;
    reasons.push(`Can execute ${criteria.taskType} tasks`);
  } else if (capability.taskTypes.length > 0) {
    score += 20;
    reasons.push(`Can handle ${criteria.eventType} events`);
  }
  
  // Department match
  if (criteria.departmentId && role.departmentId === criteria.departmentId) {
    score += 20;
    reasons.push('Same department');
  }
  
  // Skill match
  if (criteria.requiredSkills) {
    const matchedSkills = role.skills.filter(
      skill => criteria.requiredSkills!.includes(skill.category)
    );
    if (matchedSkills.length === criteria.requiredSkills.length) {
      score += 25;
      reasons.push('All required skills present');
    } else if (matchedSkills.length > 0) {
      score += 10;
      missing.push(`Missing skills: ${criteria.requiredSkills.filter(
        s => !matchedSkills.some(ms => ms.category === s)
      ).join(', ')}`);
    }
  }
  
  // Authority match
  if (criteria.requiredAuthority) {
    const authority = role.approvalAuthorities.find(
      auth => auth.type === criteria.requiredAuthority
    );
    
    if (authority) {
      // Check amount limit
      if (criteria.amountToApprove && authority.maxAmount) {
        if (criteria.amountToApprove.amount <= authority.maxAmount.amount) {
          score += 15;
          reasons.push(`Can approve up to ${authority.maxAmount.amount} ${authority.maxAmount.currency}`);
        } else {
          missing.push(`Amount exceeds approval limit (${authority.maxAmount.amount} ${authority.maxAmount.currency})`);
        }
      } else {
        score += 15;
        reasons.push(`Has ${criteria.requiredAuthority} authority`);
      }
    } else {
      missing.push(`Missing ${criteria.requiredAuthority} authority`);
    }
  }
  
  return { matchScore: Math.min(score, 100), reasons, missing };
}

/**
 * Evaluate employee availability and match
 */
async function evaluateEmployeeMatch(
  assignment: RoleAssignment,
  criteria: RoleMatchCriteria
): Promise<EmployeeMatch> {
  // Get current task load for employee
  const taskLoad = await getEmployeeTaskLoad(assignment.employeeId);
  const maxTasks = assignment.maxDailyTasks || 30; // Default max
  
  let availability: EmployeeMatch['availability'];
  let matchScore = 50; // Base score
  
  if (taskLoad >= maxTasks) {
    availability = 'overloaded';
    matchScore = 10;
  } else if (taskLoad >= maxTasks * 0.8) {
    availability = 'busy';
    matchScore = 30;
  } else if (taskLoad >= maxTasks * 0.5) {
    availability = 'available';
    matchScore = 70;
  } else {
    availability = 'available';
    matchScore = 90;
  }
  
  // Adjust for urgency
  if (criteria.urgency === 'critical') {
    matchScore = Math.min(matchScore + 20, 100);
  }
  
  return {
    employeeId: assignment.employeeId,
    name: '', // Will be populated from employee lookup
    currentLoad: taskLoad,
    availability,
    matchScore,
  };
}

/**
 * Get current task count for an employee
 */
async function getEmployeeTaskLoad(employeeId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const q = query(
    collection(db, COLLECTIONS.SMART_TASKS),
    where('assigneeId', '==', employeeId),
    where('status', 'in', ['pending', 'in_progress', 'blocked']),
    where('dueDate', '>=', Timestamp.fromDate(today))
  );
  
  const snapshot = await getDocs(q);
  return snapshot.size;
}

// ============================================
// Escalation Path
// ============================================

/**
 * Get escalation path for a role
 */
export async function getEscalationPath(
  roleProfileId: RoleProfileId
): Promise<RoleProfile[]> {
  const role = await getRoleProfile(roleProfileId);
  
  if (!role || !role.escalationPath.length) {
    return [];
  }
  
  const escalationRoles = await Promise.all(
    role.escalationPath.map(id => getRoleProfile(id))
  );
  
  return escalationRoles.filter((r): r is RoleProfile => r !== null);
}

/**
 * Find next available escalation target
 */
export async function findEscalationTarget(
  roleProfileId: RoleProfileId,
  criteria: RoleMatchCriteria
): Promise<EmployeeMatch | null> {
  const escalationPath = await getEscalationPath(roleProfileId);
  
  for (const role of escalationPath) {
    const assignments = await getEmployeesWithRole(role.id);
    
    for (const assignment of assignments) {
      const match = await evaluateEmployeeMatch(assignment, criteria);
      
      if (match.availability !== 'unavailable' && match.availability !== 'overloaded') {
        return match;
      }
    }
  }
  
  return null;
}

// ============================================
// Role Capability Checks
// ============================================

/**
 * Check if a role can perform a specific task type
 */
export function canRolePerformTask(
  role: RoleProfile,
  eventType: string,
  taskType: string
): boolean {
  const capability = role.taskCapabilities.find(cap => cap.eventType === eventType);
  
  if (!capability) {
    return false;
  }
  
  return capability.taskTypes.includes(taskType) && capability.canExecute;
}

/**
 * Check if a role can approve a specific task type
 */
export function canRoleApproveTask(
  role: RoleProfile,
  eventType: string,
  taskType: string
): boolean {
  const capability = role.taskCapabilities.find(cap => cap.eventType === eventType);
  
  if (!capability) {
    return false;
  }
  
  return capability.taskTypes.includes(taskType) && capability.canApprove;
}

/**
 * Check if a role has sufficient authority for an amount
 */
export function hasAuthorityForAmount(
  role: RoleProfile,
  authorityType: string,
  amount: number,
  currency: string
): boolean {
  const authority = role.approvalAuthorities.find(auth => auth.type === authorityType);
  
  if (!authority) {
    return false;
  }
  
  // No limit means unlimited
  if (!authority.maxAmount) {
    return true;
  }
  
  // Check currency match and amount
  return authority.maxAmount.currency === currency && authority.maxAmount.amount >= amount;
}

/**
 * Get all task types a role can handle
 */
export function getRoleTaskTypes(role: RoleProfile): string[] {
  const taskTypes: Set<string> = new Set();
  
  for (const capability of role.taskCapabilities) {
    for (const taskType of capability.taskTypes) {
      if (capability.canExecute) {
        taskTypes.add(taskType);
      }
    }
  }
  
  return Array.from(taskTypes);
}

/**
 * Get all event types a role can handle
 */
export function getRoleEventTypes(role: RoleProfile): string[] {
  return role.taskCapabilities
    .filter(cap => cap.canExecute || cap.canApprove)
    .map(cap => cap.eventType);
}
