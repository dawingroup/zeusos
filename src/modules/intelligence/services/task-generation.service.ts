/**
 * Task Generation Engine Service - ZeusOS v2.0
 * Core engine for automated task generation from business events
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  increment,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase/firestore';
import { COLLECTIONS, TaskPriority, TaskStatus } from '../config/constants';
import { generateId } from '../utils';
import {
  Task,
  TaskStage,
  TaskGenerationResult,
  BatchGenerationResult,
  AssignmentResolution,
  DeadlineInput,
  PriorityFactors,
  TaskEngineConfig,
  DEFAULT_ENGINE_CONFIG,
  AvailableEmployee,
  AvailableEmployeeCriteria,
} from '../types/task-generation.types';
import {
  BusinessEvent,
  EventTaskRule,
  AssignmentRule,
  EventCondition,
} from '../types/business-event.types';
import { getEventDefinition } from '../config/event-catalog';

// ============================================
// Helper: Current Timestamp
// ============================================

function now(): Timestamp {
  return Timestamp.now();
}

// ============================================
// Task Generation Core
// ============================================

/**
 * Process a business event and generate tasks
 */
export async function processBusinessEvent(
  event: BusinessEvent,
  config: TaskEngineConfig = DEFAULT_ENGINE_CONFIG
): Promise<BatchGenerationResult> {
  const startTime = Date.now();
  const results: TaskGenerationResult[] = [];
  const errors: string[] = [];
  
  // Get event definition
  const eventDef = getEventDefinition(event.eventType);
  
  if (!eventDef) {
    return {
      eventId: event.id,
      eventType: event.eventType,
      tasksGenerated: 0,
      tasksSkipped: 0,
      results: [],
      errors: [`Unknown event type: ${event.eventType}`],
      processingTime: Date.now() - startTime,
    };
  }
  
  if (!eventDef.enabled) {
    return {
      eventId: event.id,
      eventType: event.eventType,
      tasksGenerated: 0,
      tasksSkipped: 0,
      results: [],
      errors: [],
      processingTime: Date.now() - startTime,
    };
  }
  
  // Process each task rule
  for (const taskRule of eventDef.tasks) {
    try {
      const result = await generateTaskFromRule(event, taskRule, config);
      results.push(result);
    } catch (error: any) {
      errors.push(`Error generating task ${taskRule.taskType}: ${error.message}`);
      results.push({
        success: false,
        skipped: false,
        assignmentFailed: true,
        assignmentError: error.message,
      });
    }
  }
  
  // Update event processing status
  await updateEventProcessingStatus(event.id, {
    processed: true,
    processedAt: now(),
    tasksGenerated: results.filter(r => r.success).length,
    errors: errors.length > 0 ? errors : undefined,
  });
  
  return {
    eventId: event.id,
    eventType: event.eventType,
    tasksGenerated: results.filter(r => r.success).length,
    tasksSkipped: results.filter(r => r.skipped).length,
    results,
    errors,
    processingTime: Date.now() - startTime,
  };
}

/**
 * Generate a single task from a task rule
 */
async function generateTaskFromRule(
  event: BusinessEvent,
  rule: EventTaskRule,
  config: TaskEngineConfig
): Promise<TaskGenerationResult> {
  // Check conditions
  if (rule.conditions && rule.conditions.length > 0) {
    const conditionsMet = evaluateConditions(rule.conditions, event.payload);
    if (!conditionsMet) {
      return {
        success: false,
        skipped: true,
        skipReason: 'Conditions not met',
      };
    }
  }
  
  // Resolve assignment
  const assignment = await resolveAssignment(
    rule.assignTo,
    event,
    config
  );
  
  // Map rule priority to TaskPriority
  const basePriority = mapRulePriority(rule.priority);
  
  // Calculate priority
  const priority = calculateTaskPriority({
    basePriority,
    eventPriority: event.metadata.priority as TaskPriority,
    financialImpact: extractFinancialImpact(event.payload),
  });
  
  // Calculate deadline
  const deadline = calculateDeadline({
    baseDate: now(),
    slaHours: rule.dueInDays ? rule.dueInDays * 24 : config.defaultSlaHours[priority],
    priority,
    businessHoursOnly: true,
    excludeWeekends: true,
  });
  
  // Build task
  const taskId = generateId('task');
  const task: Task = {
    id: taskId,
    
    // Classification
    subsidiaryId: event.metadata.subsidiaryId,
    departmentId: event.metadata.departmentId,
    
    // Content
    title: interpolateTemplate(rule.title, event),
    description: interpolateTemplate(rule.description || '', event),
    taskType: rule.taskType,
    
    // Source
    source: 'event_generated',
    context: {
      eventId: event.id,
      eventType: event.eventType,
      eventPayload: event.payload,
    },
    
    // Status
    status: assignment.resolved ? 'pending' as TaskStatus : 'pending' as TaskStatus,
    stage: assignment.resolved ? 'assigned' as TaskStage : 'pending_assignment' as TaskStage,
    priority,
    
    // Assignment
    assignment: assignment.resolved ? {
      assigneeId: assignment.assigneeId!,
      assigneeRef: assignment.assigneeRef!,
      assignedAt: now(),
      assignedBy: 'system',
      assignmentMethod: assignment.method,
      roleProfileId: assignment.roleProfileId,
    } : undefined,
    
    // Timing
    dueDate: deadline,
    
    // Completion
    completionType: 'manual',
    
    // Timestamps
    createdAt: now(),
    updatedAt: now(),
    
    // Search
    searchTerms: generateSearchTerms(rule.title, event),
  };
  
  // Save task
  await setDoc(doc(db, COLLECTIONS.SMART_TASKS, taskId), task);
  
  // Update assignee's task count
  if (assignment.resolved && assignment.assigneeId) {
    await updateEmployeeTaskCount(assignment.assigneeId, 1);
  }
  
  // Send notifications
  if (config.notifyOnAssignment && assignment.resolved) {
    await sendTaskAssignmentNotification(task);
  }
  
  return {
    success: true,
    taskId,
    task,
    fallbackUsed: assignment.fallbackUsed,
    fallbackAssignee: assignment.fallbackUsed ? assignment.assigneeId : undefined,
  };
}

/**
 * Map rule priority (P0, P1, P2, P3) to TaskPriority
 */
function mapRulePriority(rulePriority: string): TaskPriority {
  switch (rulePriority) {
    case 'P0': return 'critical';
    case 'P1': return 'high';
    case 'P2': return 'medium';
    case 'P3': return 'low';
    default: return 'medium';
  }
}

// ============================================
// Condition Evaluation
// ============================================

/**
 * Evaluate conditions against event payload
 */
function evaluateConditions(
  conditions: EventCondition[],
  payload: Record<string, any>
): boolean {
  return conditions.every(condition => evaluateCondition(condition, payload));
}

/**
 * Evaluate a single condition
 */
function evaluateCondition(
  condition: EventCondition,
  payload: Record<string, any>
): boolean {
  const value = getNestedValue(payload, condition.field);
  
  switch (condition.operator) {
    case 'eq':
      return value === condition.value;
    case 'ne':
      return value !== condition.value;
    case 'gt':
      return typeof value === 'number' && value > (condition.value as number);
    case 'gte':
      return typeof value === 'number' && value >= (condition.value as number);
    case 'lt':
      return typeof value === 'number' && value < (condition.value as number);
    case 'lte':
      return typeof value === 'number' && value <= (condition.value as number);
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(value);
    case 'nin':
      return Array.isArray(condition.value) && !condition.value.includes(value);
    case 'exists':
      return condition.value ? value !== undefined : value === undefined;
    case 'contains':
      return typeof value === 'string' && value.includes(String(condition.value));
    default:
      return true;
  }
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

// ============================================
// Assignment Resolution
// ============================================

/**
 * Resolve task assignment based on rule
 */
async function resolveAssignment(
  rule: AssignmentRule,
  event: BusinessEvent,
  config: TaskEngineConfig
): Promise<AssignmentResolution> {
  const resolution = await tryAssignmentRule(rule, event, config);
  
  if (resolution.resolved) {
    return resolution;
  }
  
  // Try fallback if available
  if (rule.fallback) {
    const fallbackResolution = await tryAssignmentRule(rule.fallback, event, config);
    if (fallbackResolution.resolved) {
      return {
        ...fallbackResolution,
        fallbackUsed: true,
      };
    }
  }
  
  // All rules failed
  return {
    resolved: false,
    method: rule.type,
    fallbackUsed: true,
    error: 'No suitable assignee found',
  };
}

/**
 * Try a single assignment rule
 */
async function tryAssignmentRule(
  rule: AssignmentRule,
  event: BusinessEvent,
  config: TaskEngineConfig
): Promise<AssignmentResolution> {
  switch (rule.type) {
    case 'role':
      return await assignByRole(rule, event, config);
    
    case 'department':
      return await assignByDepartment(rule, event, config);
    
    case 'user':
      return await assignToUser(rule, event);
    
    case 'manager':
      return await assignToManager(event);
    
    case 'creator':
      return await assignToCreator(event);
    
    case 'dynamic':
      return await assignDynamically(rule, event);
    
    default:
      return {
        resolved: false,
        method: rule.type,
        fallbackUsed: false,
        error: `Unknown assignment type: ${rule.type}`,
      };
  }
}

/**
 * Assign by role matching
 */
async function assignByRole(
  rule: AssignmentRule,
  event: BusinessEvent,
  config: TaskEngineConfig
): Promise<AssignmentResolution> {
  if (!rule.value) {
    return {
      resolved: false,
      method: 'role',
      fallbackUsed: false,
      error: 'No role specified',
    };
  }
  
  // Find available employees with matching role
  const employees = await findAvailableEmployees({
    roleProfileIds: [rule.value],
    subsidiaryId: event.metadata.subsidiaryId,
    departmentId: event.metadata.departmentId,
    maxCurrentTasks: config.maxTasksPerPerson,
  });
  
  if (employees.length === 0) {
    return {
      resolved: false,
      method: 'role',
      fallbackUsed: false,
      error: 'No available employees with matching role',
    };
  }
  
  // Select best match (workload balanced)
  const selected = config.workloadBalancingEnabled
    ? employees.sort((a, b) => a.currentTaskCount - b.currentTaskCount)[0]
    : employees[0];
  
  return {
    resolved: true,
    assigneeId: selected.employeeId,
    assigneeRef: selected.employeeRef,
    roleProfileId: selected.roleProfileId,
    method: 'role',
    fallbackUsed: false,
    candidates: employees.map(e => ({
      employeeId: e.employeeId,
      score: e.matchScore,
      reasons: e.matchReasons,
    })),
  };
}

/**
 * Assign by department
 */
async function assignByDepartment(
  rule: AssignmentRule,
  event: BusinessEvent,
  config: TaskEngineConfig
): Promise<AssignmentResolution> {
  const departmentId = rule.value || event.metadata.departmentId as string | undefined;
  
  if (!departmentId) {
    return {
      resolved: false,
      method: 'department',
      fallbackUsed: false,
      error: 'No department specified',
    };
  }
  
  // Get available employees in department
  const employees = await findAvailableEmployees({
    departmentId: departmentId as any,
    subsidiaryId: event.metadata.subsidiaryId,
    maxCurrentTasks: config.maxTasksPerPerson,
  });
  
  if (employees.length === 0) {
    return {
      resolved: false,
      method: 'department',
      fallbackUsed: false,
      error: 'No available employees in department',
    };
  }
  
  // Prefer department head, otherwise lowest workload
  const departmentHead = employees.find(e => e.isDepartmentHead);
  const selected = departmentHead || employees.sort((a, b) => 
    a.currentTaskCount - b.currentTaskCount
  )[0];
  
  return {
    resolved: true,
    assigneeId: selected.employeeId,
    assigneeRef: selected.employeeRef,
    roleProfileId: selected.roleProfileId,
    method: 'department',
    fallbackUsed: false,
  };
}

/**
 * Assign to specific user
 */
async function assignToUser(
  rule: AssignmentRule,
  _event: BusinessEvent
): Promise<AssignmentResolution> {
  const userId = rule.value;
  
  if (!userId) {
    return {
      resolved: false,
      method: 'user',
      fallbackUsed: false,
      error: 'No user ID specified',
    };
  }
  
  // Verify user exists and is active
  const employeeDoc = await getDoc(doc(db, COLLECTIONS.EMPLOYEES, userId));
  
  if (!employeeDoc.exists()) {
    return {
      resolved: false,
      method: 'user',
      fallbackUsed: false,
      error: 'User not found',
    };
  }
  
  const employee = employeeDoc.data();
  
  if (employee.status !== 'active') {
    return {
      resolved: false,
      method: 'user',
      fallbackUsed: false,
      error: 'User is not active',
    };
  }
  
  return {
    resolved: true,
    assigneeId: userId,
    assigneeRef: {
      id: userId,
      name: employee.displayName || `${employee.firstName} ${employee.lastName}`,
      email: employee.email,
    },
    roleProfileId: employee.roleProfileId,
    method: 'user',
    fallbackUsed: false,
  };
}

/**
 * Assign to manager
 */
async function assignToManager(
  event: BusinessEvent
): Promise<AssignmentResolution> {
  // Get manager of event trigger
  const employeeId = event.trigger?.id;
  
  if (!employeeId) {
    return {
      resolved: false,
      method: 'manager',
      fallbackUsed: false,
      error: 'No employee specified for manager lookup',
    };
  }
  
  const manager = await getEmployeeManager(employeeId);
  
  if (!manager) {
    return {
      resolved: false,
      method: 'manager',
      fallbackUsed: false,
      error: 'Manager not found',
    };
  }
  
  return {
    resolved: true,
    assigneeId: manager.id,
    assigneeRef: {
      id: manager.id,
      name: manager.name,
      email: manager.email,
    },
    roleProfileId: manager.roleProfileId,
    method: 'manager',
    fallbackUsed: false,
  };
}

/**
 * Assign to event creator
 */
async function assignToCreator(
  event: BusinessEvent
): Promise<AssignmentResolution> {
  if (!event.trigger || event.trigger.type !== 'user') {
    return {
      resolved: false,
      method: 'creator',
      fallbackUsed: false,
      error: 'Event has no user creator',
    };
  }
  
  // Get employee details
  const employeeDoc = await getDoc(doc(db, COLLECTIONS.EMPLOYEES, event.trigger.id));
  
  if (!employeeDoc.exists()) {
    return {
      resolved: false,
      method: 'creator',
      fallbackUsed: false,
      error: 'Creator employee not found',
    };
  }
  
  const employee = employeeDoc.data();
  
  return {
    resolved: true,
    assigneeId: event.trigger.id,
    assigneeRef: {
      id: event.trigger.id,
      name: employee.displayName || `${employee.firstName} ${employee.lastName}`,
      email: employee.email,
    },
    method: 'creator',
    fallbackUsed: false,
  };
}

/**
 * Dynamic assignment based on payload field
 */
async function assignDynamically(
  rule: AssignmentRule,
  event: BusinessEvent
): Promise<AssignmentResolution> {
  if (!rule.value) {
    return {
      resolved: false,
      method: 'dynamic',
      fallbackUsed: false,
      error: 'No dynamic field specified',
    };
  }
  
  const assigneeId = getNestedValue(event.payload, rule.value);
  
  if (!assigneeId) {
    return {
      resolved: false,
      method: 'dynamic',
      fallbackUsed: false,
      error: `Dynamic field ${rule.value} not found in payload`,
    };
  }
  
  // Verify the employee
  const employeeDoc = await getDoc(doc(db, COLLECTIONS.EMPLOYEES, assigneeId));
  
  if (!employeeDoc.exists()) {
    return {
      resolved: false,
      method: 'dynamic',
      fallbackUsed: false,
      error: 'Dynamic assignee not found',
    };
  }
  
  const employee = employeeDoc.data();
  
  return {
    resolved: true,
    assigneeId,
    assigneeRef: {
      id: assigneeId,
      name: employee.displayName || `${employee.firstName} ${employee.lastName}`,
      email: employee.email,
    },
    roleProfileId: employee.roleProfileId,
    method: 'dynamic',
    fallbackUsed: false,
  };
}

// ============================================
// Employee Lookup
// ============================================

/**
 * Find available employees based on criteria
 */
export async function findAvailableEmployees(
  criteria: AvailableEmployeeCriteria
): Promise<AvailableEmployee[]> {
  let q = query(
    collection(db, COLLECTIONS.EMPLOYEES),
    where('status', '==', 'active'),
    where('employment.subsidiaryId', '==', criteria.subsidiaryId)
  );
  
  if (criteria.departmentId) {
    q = query(q, where('employment.departmentId', '==', criteria.departmentId));
  }
  
  const snapshot = await getDocs(q);
  const employees: AvailableEmployee[] = [];
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    
    // Check role if specified
    if (criteria.roleProfileIds && criteria.roleProfileIds.length > 0) {
      if (!criteria.roleProfileIds.includes(data.roleProfileId)) {
        continue;
      }
    }
    
    // Check task capacity
    const currentTaskCount = data.workload?.activeTaskCount || 0;
    if (criteria.maxCurrentTasks && currentTaskCount >= criteria.maxCurrentTasks) {
      continue;
    }
    
    employees.push({
      employeeId: doc.id,
      employeeRef: {
        id: doc.id,
        name: data.displayName || `${data.firstName} ${data.lastName}`,
        email: data.email,
      },
      roleProfileId: data.roleProfileId,
      currentTaskCount,
      matchScore: 100 - (currentTaskCount * 5), // Higher score = less tasks
      matchReasons: ['Available capacity'],
      isDepartmentHead: data.isDepartmentHead || false,
    });
  }
  
  return employees;
}

/**
 * Get an employee's manager
 */
export async function getEmployeeManager(
  employeeId: string
): Promise<{ id: string; name: string; email: string; roleProfileId?: string } | null> {
  const employeeDoc = await getDoc(doc(db, COLLECTIONS.EMPLOYEES, employeeId));
  
  if (!employeeDoc.exists()) {
    return null;
  }
  
  const employee = employeeDoc.data();
  const managerId = employee.employment?.managerId;
  
  if (!managerId) {
    return null;
  }
  
  const managerDoc = await getDoc(doc(db, COLLECTIONS.EMPLOYEES, managerId));
  
  if (!managerDoc.exists()) {
    return null;
  }
  
  const manager = managerDoc.data();
  
  return {
    id: managerId,
    name: manager.displayName || `${manager.firstName} ${manager.lastName}`,
    email: manager.email,
    roleProfileId: manager.roleProfileId,
  };
}

// ============================================
// Priority & Deadline Calculation
// ============================================

/**
 * Calculate task priority based on multiple factors
 */
export function calculateTaskPriority(factors: PriorityFactors): TaskPriority {
  const priorityScores: Record<TaskPriority, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  
  let score = priorityScores[factors.basePriority];
  
  // Event priority influence
  if (factors.eventPriority) {
    score = Math.max(score, priorityScores[factors.eventPriority]);
  }
  
  // Customer tier boost
  if (factors.customerTier === 'vip') {
    score = Math.min(score + 1, 4);
  } else if (factors.customerTier === 'premium') {
    score = Math.min(score + 0.5, 4);
  }
  
  // Financial impact (UGX thresholds)
  if (factors.financialImpact) {
    if (factors.financialImpact > 50_000_000) { // 50M UGX
      score = Math.min(score + 1, 4);
    } else if (factors.financialImpact > 10_000_000) { // 10M UGX
      score = Math.min(score + 0.5, 4);
    }
  }
  
  // SLA proximity
  if (factors.slaProximity !== undefined && factors.slaProximity < 2) {
    score = Math.min(score + 1, 4);
  }
  
  // Escalation history
  if (factors.escalationCount && factors.escalationCount > 0) {
    score = Math.min(score + factors.escalationCount * 0.5, 4);
  }
  
  // Map score back to priority
  if (score >= 4) return 'critical';
  if (score >= 3) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

/**
 * Calculate deadline considering business hours
 */
export function calculateDeadline(input: DeadlineInput): Timestamp {
  const { baseDate, slaHours, priority, businessHoursOnly, excludeWeekends } = input;
  
  let deadline = baseDate.toDate();
  let hoursRemaining = slaHours;
  
  // Adjust SLA based on priority
  const priorityMultipliers: Record<TaskPriority, number> = {
    critical: 0.5,
    high: 0.75,
    medium: 1,
    low: 1.5,
  };
  
  hoursRemaining *= priorityMultipliers[priority];
  
  if (!businessHoursOnly) {
    // Simple addition
    deadline.setHours(deadline.getHours() + hoursRemaining);
    return Timestamp.fromDate(deadline);
  }
  
  // Business hours calculation (Uganda: 8 AM - 5 PM EAT)
  const BUSINESS_START = 8;
  const BUSINESS_END = 17;
  
  while (hoursRemaining > 0) {
    const currentHour = deadline.getHours();
    const dayOfWeek = deadline.getDay();
    
    // Skip weekends
    if (excludeWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
      deadline.setDate(deadline.getDate() + 1);
      deadline.setHours(BUSINESS_START, 0, 0, 0);
      continue;
    }
    
    // Before business hours
    if (currentHour < BUSINESS_START) {
      deadline.setHours(BUSINESS_START, 0, 0, 0);
      continue;
    }
    
    // After business hours
    if (currentHour >= BUSINESS_END) {
      deadline.setDate(deadline.getDate() + 1);
      deadline.setHours(BUSINESS_START, 0, 0, 0);
      continue;
    }
    
    // Within business hours
    const hoursLeftToday = BUSINESS_END - currentHour;
    
    if (hoursRemaining <= hoursLeftToday) {
      deadline.setHours(currentHour + hoursRemaining);
      hoursRemaining = 0;
    } else {
      hoursRemaining -= hoursLeftToday;
      deadline.setDate(deadline.getDate() + 1);
      deadline.setHours(BUSINESS_START, 0, 0, 0);
    }
  }
  
  return Timestamp.fromDate(deadline);
}

// ============================================
// Helper Functions
// ============================================

/**
 * Interpolate template string with event data
 */
function interpolateTemplate(template: string, event: BusinessEvent): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
    // Try payload first, then event root
    const value = getNestedValue(event.payload, path) ?? 
                  getNestedValue(event as any, path) ??
                  `[${path}]`;
    return String(value);
  });
}

/**
 * Extract financial impact from event payload
 */
function extractFinancialImpact(payload: Record<string, any>): number | undefined {
  // Common fields that might contain financial values
  const financialFields = [
    'amount',
    'value',
    'total',
    'orderValue',
    'invoiceAmount',
    'budgetAmount',
    'transactionAmount',
  ];
  
  for (const field of financialFields) {
    const value = payload[field];
    if (typeof value === 'number') {
      return value;
    }
    if (value?.amount && typeof value.amount === 'number') {
      return value.amount;
    }
  }
  
  return undefined;
}

/**
 * Generate search terms for task
 */
function generateSearchTerms(title: string, event: BusinessEvent): string[] {
  const terms: string[] = [];
  
  // Add words from title
  terms.push(...title.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  
  // Add event type
  terms.push(event.eventType);
  
  // Add subsidiary
  terms.push(event.metadata.subsidiaryId);
  
  // Add department if present
  if (event.metadata.departmentId) {
    terms.push(event.metadata.departmentId);
  }
  
  return [...new Set(terms)];
}

/**
 * Update event processing status
 */
async function updateEventProcessingStatus(
  eventId: string,
  status: {
    processed: boolean;
    processedAt: Timestamp;
    tasksGenerated: number;
    errors?: string[];
  }
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.BUSINESS_EVENTS, eventId), {
    'processing.status': status.processed ? 'completed' : 'failed',
    'processing.processedAt': status.processedAt,
    'processing.tasksGenerated': status.tasksGenerated,
    'processing.errorMessage': status.errors?.join('; '),
    updatedAt: now(),
  });
}

/**
 * Update employee's active task count
 */
async function updateEmployeeTaskCount(
  employeeId: string,
  change: number
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.EMPLOYEES, employeeId), {
    'workload.activeTaskCount': increment(change),
    'workload.lastAssignedAt': now(),
    updatedAt: now(),
  });
}

/**
 * Send task assignment notification
 */
async function sendTaskAssignmentNotification(task: Task): Promise<void> {
  if (!task.assignment) return;
  
  const notification = {
    id: generateId('notif'),
    type: 'task_assigned',
    recipientId: task.assignment.assigneeId,
    title: 'New Task Assigned',
    body: task.title,
    data: {
      taskId: task.id,
      taskType: task.taskType,
      priority: task.priority,
      dueDate: task.dueDate?.toDate().toISOString(),
    },
    channels: ['push', 'email'],
    createdAt: now(),
    read: false,
  };
  
  await setDoc(doc(db, COLLECTIONS.USER_NOTIFICATIONS, notification.id), notification);
}

// ============================================
// Task Queries
// ============================================

/**
 * Get tasks for an employee
 */
export async function getEmployeeTasks(
  employeeId: string,
  filters?: {
    status?: TaskStatus[];
    priority?: TaskPriority[];
    dueBefore?: Timestamp;
  }
): Promise<Task[]> {
  let q = query(
    collection(db, COLLECTIONS.SMART_TASKS),
    where('assignment.assigneeId', '==', employeeId)
  );
  
  if (filters?.status && filters.status.length > 0) {
    q = query(q, where('status', 'in', filters.status));
  }
  
  if (filters?.dueBefore) {
    q = query(q, where('dueDate', '<=', filters.dueBefore));
  }
  
  q = query(q, orderBy('priority', 'desc'), orderBy('dueDate', 'asc'));
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
}

/**
 * Get overdue tasks for escalation processing
 */
export async function getOverdueTasks(): Promise<Task[]> {
  const q = query(
    collection(db, COLLECTIONS.SMART_TASKS),
    where('status', 'in', ['pending', 'in-progress']),
    where('dueDate', '<', now()),
    orderBy('dueDate', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
}

/**
 * Get unassigned tasks
 */
export async function getUnassignedTasks(
  subsidiaryId?: string
): Promise<Task[]> {
  let q = query(
    collection(db, COLLECTIONS.SMART_TASKS),
    where('stage', '==', 'pending_assignment')
  );
  
  if (subsidiaryId) {
    q = query(q, where('subsidiaryId', '==', subsidiaryId));
  }
  
  q = query(q, orderBy('createdAt', 'asc'));
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
}
