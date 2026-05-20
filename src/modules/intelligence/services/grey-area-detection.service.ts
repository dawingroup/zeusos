/**
 * Grey Area Detection Service - DawinOS v2.0
 * Service for detecting and managing ambiguous situations
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
  writeBatch,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase/firestore';
import { COLLECTIONS, GreyAreaType } from '../config/constants';
import { generateId } from '../utils';
import {
  GreyArea,
  GreyAreaId,
  GreyAreaSeverity,
  GreyAreaStatus,
  GreyAreaResolution,
  GreyAreaEscalation,
  GreyAreaInput,
  DetectionRule,
  DetectionCondition,
  DetectionEngineConfig,
  DEFAULT_DETECTION_CONFIG,
} from '../types/grey-area.types';
import { SubsidiaryId, DepartmentId } from '../config/constants';
import { getRulesForEntityType } from '../config/detection-rules';
import { findAvailableEmployees } from './task-generation.service';

// ============================================
// Helper: Current Timestamp
// ============================================

function now(): Timestamp {
  return Timestamp.now();
}

// ============================================
// Detection Engine
// ============================================

/**
 * Scan an entity for grey areas
 */
export async function scanForGreyAreas<T extends Record<string, any>>(
  entity: T,
  entityType: 'task' | 'event' | 'employee' | 'transaction' | 'request' | 'document',
  entityId: string,
  config: DetectionEngineConfig = DEFAULT_DETECTION_CONFIG
): Promise<GreyArea[]> {
  const detectedGreyAreas: GreyArea[] = [];
  
  if (!config.enableRuleEngine) {
    return detectedGreyAreas;
  }
  
  // Get applicable rules
  const rules = getRulesForEntityType(entityType);
  
  // Sort by priority (higher first)
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);
  
  for (const rule of sortedRules) {
    // Check event type filter if applicable
    if (rule.eventTypes && rule.eventTypes.length > 0) {
      const eventType = (entity as any).eventType;
      if (!eventType || !rule.eventTypes.includes(eventType)) {
        continue;
      }
    }
    
    // Check subsidiary filter if applicable
    if (rule.subsidiaryIds && rule.subsidiaryIds.length > 0) {
      const subsidiaryId = (entity as any).subsidiaryId || (entity as any).metadata?.subsidiaryId;
      if (!subsidiaryId || !rule.subsidiaryIds.includes(subsidiaryId)) {
        continue;
      }
    }
    
    // Evaluate conditions
    const conditionsMet = evaluateConditions(
      rule.conditions,
      rule.conditionLogic,
      entity
    );
    
    if (conditionsMet) {
      // Create grey area
      const greyArea = await createGreyAreaFromRule(
        rule,
        entity,
        entityType,
        entityId,
        config
      );
      
      detectedGreyAreas.push(greyArea);
    }
  }
  
  return detectedGreyAreas;
}

/**
 * Evaluate rule conditions against entity
 */
function evaluateConditions(
  conditions: DetectionCondition[],
  logic: 'and' | 'or',
  entity: Record<string, any>
): boolean {
  if (conditions.length === 0) return false;
  
  const results = conditions.map(cond => evaluateCondition(cond, entity));
  
  return logic === 'and'
    ? results.every(r => r)
    : results.some(r => r);
}

/**
 * Evaluate a single condition
 */
function evaluateCondition(
  condition: DetectionCondition,
  entity: Record<string, any>
): boolean {
  const value = getNestedValue(entity, condition.field);
  
  // Handle undefined values
  if (value === undefined) {
    return condition.operator === 'eq' && condition.value === undefined;
  }
  
  switch (condition.operator) {
    case 'eq':
      return value === condition.value;
    case 'ne':
      return value !== condition.value;
    case 'gt':
      return typeof value === 'number' && value > condition.value;
    case 'gte':
      return typeof value === 'number' && value >= condition.value;
    case 'lt':
      return typeof value === 'number' && value < condition.value;
    case 'lte':
      return typeof value === 'number' && value <= condition.value;
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(value);
    case 'nin':
      return Array.isArray(condition.value) && !condition.value.includes(value);
    case 'contains':
      return typeof value === 'string' && value.includes(String(condition.value));
    case 'regex':
      return typeof value === 'string' && new RegExp(String(condition.value)).test(value);
    case 'between':
      return typeof value === 'number' && 
             value >= condition.value && 
             value <= (condition.valueEnd ?? condition.value);
    default:
      return false;
  }
}

/**
 * Get nested value from object
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

/**
 * Create grey area from matched rule
 */
async function createGreyAreaFromRule(
  rule: DetectionRule,
  entity: Record<string, any>,
  entityType: string,
  entityId: string,
  config: DetectionEngineConfig
): Promise<GreyArea> {
  const greyAreaId = generateId('grey');
  
  // Interpolate templates
  const title = interpolateTemplate(rule.titleTemplate, entity);
  const description = interpolateTemplate(rule.descriptionTemplate, entity);
  
  // Calculate deadline
  const slaHours = rule.slaHours || config.defaultSlaHours[rule.severity];
  const deadline = calculateDeadline(slaHours);
  
  // Get subsidiary ID from entity
  const subsidiaryId = entity.subsidiaryId || entity.metadata?.subsidiaryId || 'finishes';
  const departmentId = entity.departmentId || entity.metadata?.departmentId;
  
  // Find assignee
  let assignedTo = undefined;
  if (rule.assignToRoles && rule.assignToRoles.length > 0) {
    try {
      const employees = await findAvailableEmployees({
        roleProfileIds: rule.assignToRoles,
        subsidiaryId,
        departmentId: rule.assignToDepartment || departmentId,
        maxCurrentTasks: 20,
      });
      
      if (employees.length > 0) {
        const selected = employees[0];
        assignedTo = {
          id: selected.employeeId,
          name: selected.employeeRef.name,
          email: selected.employeeRef.email,
        };
      }
    } catch (error) {
      console.warn('Could not find assignee for grey area:', error);
    }
  }
  
  const greyArea: GreyArea = {
    id: greyAreaId,
    
    // Classification
    type: rule.greyAreaType as GreyAreaType,
    subsidiaryId,
    departmentId,
    
    // Description
    title,
    description,
    
    // Status
    status: 'detected',
    severity: rule.severity,
    
    // Detection
    detectionContext: {
      entityType: entityType as any,
      entityId,
      entityName: entity.name || entity.title || entityId,
      detectedAt: now(),
      detectionMethod: 'rule_engine',
      customData: {
        ruleId: rule.id,
        ruleName: rule.name,
      },
    },
    
    // Assignment
    assignedTo,
    assignedAt: assignedTo ? now() : undefined,
    reviewerRoles: rule.assignToRoles,
    
    // Escalation
    currentEscalationLevel: 0,
    
    // Deadline
    resolutionDeadline: deadline,
    slaHours,
    
    // Timestamps
    createdAt: now(),
    updatedAt: now(),
    
    // Search
    searchTerms: generateSearchTerms(title, description, rule.greyAreaType),
    
    // Activity log
    activityLog: [{
      action: 'Grey area detected',
      performedBy: 'system',
      performedAt: now(),
      details: `Detected by rule: ${rule.name}`,
    }],
  };
  
  // Save to Firestore
  await setDoc(doc(db, COLLECTIONS.GREY_AREAS, greyAreaId), greyArea);
  
  // Send notification if configured
  if (config.notifyOnDetection && assignedTo) {
    await sendGreyAreaNotification(greyArea, 'detected');
  }
  
  return greyArea;
}

/**
 * Interpolate template with entity data
 */
function interpolateTemplate(template: string, entity: Record<string, any>): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
    const value = getNestedValue(entity, path);
    if (value === undefined) return `[${path}]`;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });
}

/**
 * Calculate deadline from SLA hours
 */
function calculateDeadline(slaHours: number): Timestamp {
  const deadline = new Date();
  deadline.setHours(deadline.getHours() + slaHours);
  return Timestamp.fromDate(deadline);
}

/**
 * Generate search terms for grey area
 */
function generateSearchTerms(
  title: string,
  description: string,
  type: string
): string[] {
  const terms: string[] = [];
  
  // Add type
  terms.push(type);
  
  // Add words from title
  terms.push(...title.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  
  // Add key words from description (limited)
  const descWords = description.toLowerCase().split(/\s+/).filter(w => w.length > 4);
  terms.push(...descWords.slice(0, 10));
  
  return [...new Set(terms)];
}

// ============================================
// Grey Area Management
// ============================================

/**
 * Get grey area by ID
 */
export async function getGreyArea(greyAreaId: GreyAreaId): Promise<GreyArea | null> {
  const docRef = doc(db, COLLECTIONS.GREY_AREAS, greyAreaId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  return { id: docSnap.id, ...docSnap.data() } as GreyArea;
}

/**
 * Update grey area status
 */
export async function updateGreyAreaStatus(
  greyAreaId: GreyAreaId,
  status: GreyAreaStatus,
  userId: string,
  userName: string,
  notes?: string
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.GREY_AREAS, greyAreaId);
  
  await updateDoc(docRef, {
    status,
    updatedAt: now(),
    activityLog: arrayUnion({
      action: `Status changed to ${status}`,
      performedBy: { userId, displayName: userName, email: '' },
      performedAt: now(),
      details: notes,
    }),
  });
}

/**
 * Assign grey area to employee
 */
export async function assignGreyArea(
  greyAreaId: GreyAreaId,
  assignee: { id: string; name: string; email: string },
  assignedBy: { id: string; name: string }
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.GREY_AREAS, greyAreaId);
  
  await updateDoc(docRef, {
    assignedTo: assignee,
    assignedAt: now(),
    status: 'under_review',
    updatedAt: now(),
    activityLog: arrayUnion({
      action: `Assigned to ${assignee.name}`,
      performedBy: assignedBy,
      performedAt: now(),
    }),
  });
  
  // Send notification to assignee
  const greyArea = await getGreyArea(greyAreaId);
  if (greyArea) {
    await sendGreyAreaNotification({ ...greyArea, assignedTo: assignee }, 'assigned');
  }
}

/**
 * Escalate grey area
 */
export async function escalateGreyArea(
  greyAreaId: GreyAreaId,
  escalateTo: { id: string; name: string; email: string },
  reason: string,
  escalatedBy: { id: string; name: string }
): Promise<void> {
  const greyArea = await getGreyArea(greyAreaId);
  if (!greyArea) throw new Error('Grey area not found');
  
  const newEscalationLevel = greyArea.currentEscalationLevel + 1;
  
  const escalation: GreyAreaEscalation = {
    escalatedAt: now(),
    escalatedBy: { userId: escalatedBy.id, displayName: escalatedBy.name, email: '' },
    escalatedTo: escalateTo,
    reason,
    previousAssignee: greyArea.assignedTo,
    escalationLevel: newEscalationLevel,
    acknowledged: false,
  };
  
  await updateDoc(doc(db, COLLECTIONS.GREY_AREAS, greyAreaId), {
    assignedTo: escalateTo,
    assignedAt: now(),
    status: 'escalated',
    currentEscalationLevel: newEscalationLevel,
    escalations: arrayUnion(escalation),
    updatedAt: now(),
    activityLog: arrayUnion({
      action: `Escalated to ${escalateTo.name} (Level ${newEscalationLevel})`,
      performedBy: { userId: escalatedBy.id, displayName: escalatedBy.name, email: '' },
      performedAt: now(),
      details: reason,
    }),
  });
  
  // Send escalation notification
  await sendGreyAreaNotification({ ...greyArea, assignedTo: escalateTo }, 'escalated');
}

/**
 * Request input for grey area
 */
export async function requestGreyAreaInput(
  greyAreaId: GreyAreaId,
  input: Omit<GreyAreaInput, 'response'>,
  requestedBy: { id: string; name: string }
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.GREY_AREAS, greyAreaId), {
    status: 'pending_input',
    inputsRequired: arrayUnion(input),
    updatedAt: now(),
    activityLog: arrayUnion({
      action: `Input requested: ${input.question}`,
      performedBy: { userId: requestedBy.id, displayName: requestedBy.name, email: '' },
      performedAt: now(),
    }),
  });
}

/**
 * Provide input for grey area
 */
export async function provideGreyAreaInput(
  greyAreaId: GreyAreaId,
  inputIndex: number,
  value: any,
  providedBy: { id: string; name: string },
  notes?: string
): Promise<void> {
  const greyArea = await getGreyArea(greyAreaId);
  if (!greyArea || !greyArea.inputsRequired) {
    throw new Error('Grey area or inputs not found');
  }
  
  const updatedInputs = [...greyArea.inputsRequired];
  updatedInputs[inputIndex] = {
    ...updatedInputs[inputIndex],
    response: {
      providedAt: now(),
      providedBy: { userId: providedBy.id, displayName: providedBy.name, email: '' },
      value,
      notes,
    },
  };
  
  // Check if all required inputs are provided
  const allInputsProvided = updatedInputs
    .filter(i => i.required)
    .every(i => i.response);
  
  await updateDoc(doc(db, COLLECTIONS.GREY_AREAS, greyAreaId), {
    inputsRequired: updatedInputs,
    status: allInputsProvided ? 'under_review' : 'pending_input',
    updatedAt: now(),
    activityLog: arrayUnion({
      action: `Input provided for: ${updatedInputs[inputIndex].question}`,
      performedBy: { userId: providedBy.id, displayName: providedBy.name, email: '' },
      performedAt: now(),
      details: notes,
    }),
  });
}

/**
 * Resolve grey area
 */
export async function resolveGreyArea(
  greyAreaId: GreyAreaId,
  resolution: Omit<GreyAreaResolution, 'resolvedAt' | 'resolvedBy'>,
  resolvedBy: { id: string; name: string }
): Promise<void> {
  const fullResolution: GreyAreaResolution = {
    ...resolution,
    resolvedAt: now(),
    resolvedBy: { userId: resolvedBy.id, displayName: resolvedBy.name, email: '' },
  };
  
  await updateDoc(doc(db, COLLECTIONS.GREY_AREAS, greyAreaId), {
    status: 'resolved',
    resolution: fullResolution,
    updatedAt: now(),
    activityLog: arrayUnion({
      action: `Resolved: ${resolution.approach}`,
      performedBy: { userId: resolvedBy.id, displayName: resolvedBy.name, email: '' },
      performedAt: now(),
      details: resolution.decision,
    }),
  });
  
  // Create follow-up tasks if specified
  if (resolution.followUpActions && resolution.followUpActions.length > 0) {
    await createFollowUpTasks(greyAreaId, resolution.followUpActions);
  }
  
  // Capture learning if specified
  if (resolution.learningCapture?.shouldCreateRule) {
    console.log('New rule suggestion:', resolution.learningCapture.ruleSuggestion);
  }
}

/**
 * Dismiss grey area
 */
export async function dismissGreyArea(
  greyAreaId: GreyAreaId,
  reason: string,
  dismissedBy: { id: string; name: string }
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.GREY_AREAS, greyAreaId), {
    status: 'dismissed',
    resolution: {
      resolvedAt: now(),
      resolvedBy: { userId: dismissedBy.id, displayName: dismissedBy.name, email: '' },
      approach: 'no_action',
      decision: reason,
      reasoning: 'Dismissed as non-issue',
      outcome: 'not_applicable',
    },
    updatedAt: now(),
    activityLog: arrayUnion({
      action: 'Dismissed',
      performedBy: dismissedBy,
      performedAt: now(),
      details: reason,
    }),
  });
}

// ============================================
// Query Functions
// ============================================

/**
 * Get pending grey areas for employee
 */
export async function getEmployeeGreyAreas(
  employeeId: string,
  statuses: GreyAreaStatus[] = ['detected', 'under_review', 'pending_input', 'escalated']
): Promise<GreyArea[]> {
  const q = query(
    collection(db, COLLECTIONS.GREY_AREAS),
    where('assignedTo.id', '==', employeeId),
    where('status', 'in', statuses),
    orderBy('severity', 'desc'),
    orderBy('resolutionDeadline', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as GreyArea);
}

/**
 * Get grey areas by subsidiary
 */
export async function getSubsidiaryGreyAreas(
  subsidiaryId: string,
  filters?: {
    statuses?: GreyAreaStatus[];
    severities?: GreyAreaSeverity[];
    types?: GreyAreaType[];
  }
): Promise<GreyArea[]> {
  let q = query(
    collection(db, COLLECTIONS.GREY_AREAS),
    where('subsidiaryId', '==', subsidiaryId)
  );
  
  if (filters?.statuses && filters.statuses.length > 0) {
    q = query(q, where('status', 'in', filters.statuses));
  }
  
  if (filters?.severities && filters.severities.length > 0) {
    q = query(q, where('severity', 'in', filters.severities));
  }
  
  if (filters?.types && filters.types.length > 0) {
    q = query(q, where('type', 'in', filters.types));
  }
  
  q = query(q, orderBy('createdAt', 'desc'));
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as GreyArea);
}

/**
 * Get overdue grey areas
 */
export async function getOverdueGreyAreas(): Promise<GreyArea[]> {
  const q = query(
    collection(db, COLLECTIONS.GREY_AREAS),
    where('status', 'in', ['detected', 'under_review', 'pending_input']),
    where('resolutionDeadline', '<', now()),
    orderBy('resolutionDeadline', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as GreyArea);
}

/**
 * Get grey areas by related entity
 */
export async function getGreyAreasByEntity(
  entityType: string,
  entityId: string
): Promise<GreyArea[]> {
  const q = query(
    collection(db, COLLECTIONS.GREY_AREAS),
    where('detectionContext.entityType', '==', entityType),
    where('detectionContext.entityId', '==', entityId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as GreyArea);
}

// ============================================
// Helper Functions
// ============================================

/**
 * Send grey area notification
 */
async function sendGreyAreaNotification(
  greyArea: GreyArea,
  event: 'detected' | 'assigned' | 'escalated'
): Promise<void> {
  if (!greyArea.assignedTo) return;
  
  const titles = {
    detected: 'New Grey Area Detected',
    assigned: 'Grey Area Assigned to You',
    escalated: 'Grey Area Escalated',
  };
  
  const notification = {
    id: generateId('notif'),
    type: 'grey_area',
    recipientId: greyArea.assignedTo.id,
    title: titles[event],
    body: greyArea.title,
    data: {
      greyAreaId: greyArea.id,
      severity: greyArea.severity,
      type: greyArea.type,
      deadline: greyArea.resolutionDeadline?.toDate().toISOString(),
    },
    channels: greyArea.severity === 'critical' ? ['push', 'email', 'sms'] : ['push', 'email'],
    createdAt: now(),
    read: false,
  };
  
  await setDoc(doc(db, COLLECTIONS.USER_NOTIFICATIONS, notification.id), notification);
}

/**
 * Create follow-up tasks from resolution
 */
async function createFollowUpTasks(
  greyAreaId: GreyAreaId,
  followUpActions: NonNullable<GreyAreaResolution['followUpActions']>
): Promise<void> {
  const batch = writeBatch(db);
  
  for (const action of followUpActions) {
    const taskId = generateId('task');
    const task = {
      id: taskId,
      title: action.description,
      description: `Follow-up task from grey area resolution`,
      taskType: 'follow_up',
      source: 'event_generated',
      context: {
        relatedEntityType: 'grey_area',
        relatedEntityId: greyAreaId,
      },
      status: 'pending',
      stage: action.assignedTo ? 'assigned' : 'pending_assignment',
      priority: 'medium',
      assignment: action.assignedTo ? {
        assigneeId: action.assignedTo.id,
        assigneeRef: action.assignedTo,
        assignedAt: now(),
        assignedBy: 'system',
        assignmentMethod: 'user',
      } : undefined,
      dueDate: action.dueDate,
      completionType: 'manual',
      createdAt: now(),
      updatedAt: now(),
    };
    
    batch.set(doc(db, COLLECTIONS.SMART_TASKS, taskId), task);
  }
  
  await batch.commit();
}

/**
 * Manually flag a grey area
 */
export async function flagGreyArea(
  title: string,
  description: string,
  type: GreyAreaType,
  severity: GreyAreaSeverity,
  context: {
    entityType: 'task' | 'event' | 'employee' | 'transaction' | 'request' | 'document' | 'workflow';
    entityId: string;
    entityName?: string;
    subsidiaryId: string;
    departmentId?: string;
  },
  flaggedBy: { id: string; name: string },
  config: DetectionEngineConfig = DEFAULT_DETECTION_CONFIG
): Promise<GreyArea> {
  const greyAreaId = generateId('grey');
  const slaHours = config.defaultSlaHours[severity];
  const deadline = calculateDeadline(slaHours);
  
  const greyArea: GreyArea = {
    id: greyAreaId,
    type,
    subsidiaryId: context.subsidiaryId as SubsidiaryId,
    departmentId: context.departmentId as DepartmentId | undefined,
    title,
    description,
    status: 'detected',
    severity,
    detectionContext: {
      entityType: context.entityType,
      entityId: context.entityId,
      entityName: context.entityName,
      triggeredBy: { userId: flaggedBy.id, displayName: flaggedBy.name, email: '' },
      detectedAt: now(),
      detectionMethod: 'manual_flag',
    },
    currentEscalationLevel: 0,
    resolutionDeadline: deadline,
    slaHours,
    createdAt: now(),
    updatedAt: now(),
    searchTerms: generateSearchTerms(title, description, type),
    activityLog: [{
      action: 'Grey area manually flagged',
      performedBy: { userId: flaggedBy.id, displayName: flaggedBy.name, email: '' },
      performedAt: now(),
    }],
  };
  
  await setDoc(doc(db, COLLECTIONS.GREY_AREAS, greyAreaId), greyArea);
  
  return greyArea;
}
