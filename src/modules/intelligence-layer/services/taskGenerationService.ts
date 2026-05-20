// ============================================================================
// TASK GENERATION SERVICE
// DawinOS v2.0 - Intelligence Layer
// Service for generating tasks from business events using templates
// ============================================================================

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  writeBatch,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import type {
  BusinessEvent,
  TaskTemplate,
  GeneratedTask,
  TaskChecklistItem,
  TaskStatus,
  TaskTriggerCondition,
} from '../types/businessEvents';
import { ALL_TASK_TEMPLATES } from '../constants/businessEvents';
import { employeeAssignmentService } from '@/modules/intelligence/services/employeeAssignmentService';
import { STANDARD_ROLE_PROFILES } from '@/modules/intelligence/config/role-profile.constants';
import type { RoleProfile } from '@/modules/intelligence/types/role-profile.types';

// ============================================================================
// COLLECTION REFERENCES
// ============================================================================

const TASK_TEMPLATES_COLLECTION = 'taskTemplates';
const GENERATED_TASKS_COLLECTION = 'generatedTasks';

// ============================================================================
// TASK GENERATION SERVICE
// ============================================================================

class TaskGenerationService {
  private templateCache: Map<string, TaskTemplate> = new Map();

  // ----------------------------------------
  // Template Management
  // ----------------------------------------

  async getTemplateById(templateId: string): Promise<TaskTemplate | null> {
    // Check cache first
    if (this.templateCache.has(templateId)) {
      return this.templateCache.get(templateId)!;
    }

    // Check built-in templates
    const builtIn = ALL_TASK_TEMPLATES.find((t) => t.id === templateId);
    if (builtIn) {
      this.templateCache.set(templateId, builtIn);
      return builtIn;
    }

    // Check Firestore for custom templates
    const docRef = doc(db, TASK_TEMPLATES_COLLECTION, templateId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const template = {
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate(),
        updatedAt: docSnap.data().updatedAt?.toDate(),
      } as TaskTemplate;

      this.templateCache.set(templateId, template);
      return template;
    }

    return null;
  }

  async getTemplatesForEvent(eventType: string): Promise<TaskTemplate[]> {
    // Get built-in templates
    const builtInTemplates = ALL_TASK_TEMPLATES.filter((t) =>
      t.triggerEvents.includes(eventType)
    );

    // Get custom templates from Firestore
    const q = query(
      collection(db, TASK_TEMPLATES_COLLECTION),
      where('triggerEvents', 'array-contains', eventType),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);
    const customTemplates = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as TaskTemplate[];

    return [...builtInTemplates, ...customTemplates];
  }

  async saveCustomTemplate(
    template: Omit<TaskTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const docRef = await addDoc(collection(db, TASK_TEMPLATES_COLLECTION), {
      ...template,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    return docRef.id;
  }

  // ----------------------------------------
  // Task Generation
  // ----------------------------------------

  async generateTasksFromEvent(event: BusinessEvent): Promise<GeneratedTask[]> {
    const templates = await this.getTemplatesForEvent(event.eventType);
    const tasksToCreate: Array<{ data: Omit<GeneratedTask, 'id'>; ref: ReturnType<typeof doc> }> = [];

    for (const template of templates) {
      // Check if trigger conditions are met
      if (!this.checkTriggerConditions(template, event)) {
        continue;
      }

      // Deduplication: check if task already exists for this event + template
      const existingQuery = query(
        collection(db, GENERATED_TASKS_COLLECTION),
        where('businessEventId', '==', event.id),
        where('templateId', '==', template.id),
        limit(1)
      );
      const existing = await getDocs(existingQuery);
      if (!existing.empty) {
        // Return existing task instead of creating a duplicate
        const existingTask = this.mapTaskDocs(existing.docs)[0];
        tasksToCreate.push({
          data: existingTask,
          ref: doc(db, GENERATED_TASKS_COLLECTION, existingTask.id),
        });
        continue;
      }

      // Prepare task data (without writing yet)
      const taskData = await this.prepareTaskData(template, event);
      const newRef = doc(collection(db, GENERATED_TASKS_COLLECTION));
      tasksToCreate.push({ data: taskData, ref: newRef });
    }

    // Batch write all new tasks atomically
    const newTasks = tasksToCreate.filter(
      (t) => !(t.data as GeneratedTask).id
    );
    if (newTasks.length > 0) {
      const batch = writeBatch(db);
      for (const { data, ref } of newTasks) {
        batch.set(ref, {
          ...data,
          dueDate: Timestamp.fromDate(data.dueDate),
          assignedAt: data.assignedAt ? Timestamp.fromDate(data.assignedAt) : null,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }
      await batch.commit();
    }

    // Return all tasks (existing + newly created)
    return tasksToCreate.map(({ data, ref }) => ({
      ...data,
      id: ref.id,
    })) as GeneratedTask[];
  }

  private checkTriggerConditions(
    template: TaskTemplate,
    event: BusinessEvent
  ): boolean {
    if (!template.triggerConditions || template.triggerConditions.length === 0) {
      return true;
    }

    for (const condition of template.triggerConditions) {
      const value = this.getValueFromEvent(event, condition.field);

      if (!this.evaluateCondition(value, condition)) {
        return false;
      }
    }

    return true;
  }

  private getValueFromEvent(event: BusinessEvent, field: string): any {
    // Handle nested paths like "currentState.currentStage"
    const parts = field.split('.');
    let value: any = event;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = value[part];
    }

    return value;
  }

  private evaluateCondition(
    value: any,
    condition: TaskTriggerCondition
  ): boolean {
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'not_equals':
        return value !== condition.value;
      case 'contains':
        return String(value).includes(String(condition.value));
      case 'greater_than':
        return Number(value) > Number(condition.value);
      case 'less_than':
        return Number(value) < Number(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(value);
      default:
        return true;
    }
  }

  private async prepareTaskData(
    template: TaskTemplate,
    event: BusinessEvent
  ): Promise<Omit<GeneratedTask, 'id'>> {
    // Calculate due date
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + template.defaultDueDays);

    // Generate title with variable substitution
    const title = this.substituteVariables(template.defaultTitle, event);
    const description = this.substituteVariables(template.defaultDescription, event);

    // Clone checklist items
    const checklistItems: TaskChecklistItem[] = template.checklistItems.map((item) => ({
      ...item,
      completed: false,
      completedAt: undefined,
      completedBy: undefined,
    }));

    // Determine assignee
    const { assignedTo, assignedToName } = await this.determineAssignee(template, event);

    return {
      businessEventId: event.id,
      templateId: template.id,
      title,
      description,
      priority: template.defaultPriority,
      status: 'pending',
      assignedTo,
      assignedToName,
      assignedAt: assignedTo ? new Date() : undefined,
      dueDate,
      checklistItems,
      checklistProgress: 0,
      sourceModule: event.sourceModule,
      subsidiary: event.subsidiary,
      entityType: event.entityType,
      entityId: event.entityId,
      entityName: event.entityName,
      projectId: event.projectId,
      projectName: event.projectName,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system',
    };
  }

  private substituteVariables(text: string, event: BusinessEvent): string {
    return text
      .replace(/\{entityName\}/g, event.entityName)
      .replace(/\{projectName\}/g, event.projectName || '')
      .replace(/\{sourceModule\}/g, event.sourceModule)
      .replace(/\{eventType\}/g, event.eventType);
  }

  /**
   * Validate that a role profile can handle a specific task type for an event
   */
  private validateTaskCapability(
    roleSlug: string,
    eventType: string,
    taskType: string
  ): { isValid: boolean; reason?: string } {
    const roleProfile = STANDARD_ROLE_PROFILES[roleSlug] as Partial<RoleProfile> | undefined;

    if (!roleProfile) {
      return {
        isValid: false,
        reason: `Role profile '${roleSlug}' not found`,
      };
    }

    // Check if role has task capabilities defined
    if (!roleProfile.taskCapabilities || roleProfile.taskCapabilities.length === 0) {
      // No capabilities defined - allow by default for backward compatibility
      return { isValid: true };
    }

    // Find matching task capability for this event type
    const capability = roleProfile.taskCapabilities.find(
      (cap) => cap.eventType === eventType
    );

    if (!capability) {
      return {
        isValid: false,
        reason: `Role '${roleProfile.title}' has no capability defined for event '${eventType}'`,
      };
    }

    // Check if this task type is in the capability's taskTypes
    if (!capability.taskTypes.includes(taskType)) {
      return {
        isValid: false,
        reason: `Role '${roleProfile.title}' cannot handle task type '${taskType}' for event '${eventType}'`,
      };
    }

    // Check if role can execute this task type
    if (!capability.canExecute) {
      return {
        isValid: false,
        reason: `Role '${roleProfile.title}' cannot execute tasks for event '${eventType}'`,
      };
    }

    return { isValid: true };
  }

  private async determineAssignee(
    template: TaskTemplate,
    event: BusinessEvent
  ): Promise<{ assignedTo?: string; assignedToName?: string }> {
    try {
      switch (template.assignmentStrategy) {
        case 'creator':
          return {
            assignedTo: event.triggeredBy,
            assignedToName: event.triggeredByName,
          };

        case 'specific_user':
          if (template.assignToUserId) {
            const result = await employeeAssignmentService.resolveAssignment(
              { type: 'user', value: template.assignToUserId },
              {
                subsidiaryId: event.subsidiary,
                departmentId: undefined,
                eventTriggerUserId: event.triggeredBy,
                projectId: event.projectId,
                entityData: event.currentState,
              }
            );
            if (result) {
              return {
                assignedTo: result.employeeId,
                assignedToName: result.employeeName,
              };
            }
          }
          return {
            assignedTo: template.assignToUserId,
            assignedToName: undefined,
          };

        case 'specific_role':
          if (template.assignToRole) {
            // Validate task capability before assignment
            const validation = this.validateTaskCapability(
              template.assignToRole,
              event.eventType,
              (template as any).taskType || 'general'
            );

            if (!validation.isValid) {
              console.warn(
                `Task capability validation failed: ${validation.reason}. ` +
                `Proceeding with assignment anyway for backward compatibility.`
              );
              // Continue with assignment despite validation failure for now
              // In future, you may want to skip assignment or use fallback
            }

            const result = await employeeAssignmentService.resolveAssignment(
              { type: 'role', value: template.assignToRole },
              {
                subsidiaryId: event.subsidiary,
                departmentId: undefined,
                eventTriggerUserId: event.triggeredBy,
                projectId: event.projectId,
                entityData: event.currentState,
              },
              { preferLowerWorkload: true }
            );
            if (result) {
              return {
                assignedTo: result.employeeId,
                assignedToName: result.employeeName,
              };
            }
          }
          return {
            assignedTo: undefined,
            assignedToName: undefined,
          };

        case 'project_lead':
          // Try to find project lead or manager
          const projectLeadResult = await employeeAssignmentService.resolveAssignment(
            { type: 'role', value: 'project-manager' },
            {
              subsidiaryId: event.subsidiary,
              departmentId: undefined,
              eventTriggerUserId: event.triggeredBy,
              projectId: event.projectId,
              entityData: event.currentState,
            }
          );
          if (projectLeadResult) {
            return {
              assignedTo: projectLeadResult.employeeId,
              assignedToName: projectLeadResult.employeeName,
            };
          }
          return {
            assignedTo: undefined,
            assignedToName: undefined,
          };

        case 'manager':
          if (event.triggeredBy) {
            const managerResult = await employeeAssignmentService.resolveAssignment(
              { type: 'manager' },
              {
                subsidiaryId: event.subsidiary,
                departmentId: undefined,
                eventTriggerUserId: event.triggeredBy,
                projectId: event.projectId,
                entityData: event.currentState,
              }
            );
            if (managerResult) {
              return {
                assignedTo: managerResult.employeeId,
                assignedToName: managerResult.employeeName,
              };
            }
          }
          return {
            assignedTo: undefined,
            assignedToName: undefined,
          };

        default:
          return {};
      }
    } catch (error) {
      console.error('Error determining assignee:', error);
      // Fall back to original behavior on error
      if (template.assignmentStrategy === 'creator') {
        return {
          assignedTo: event.triggeredBy,
          assignedToName: event.triggeredByName,
        };
      }
      return {};
    }
  }

  // ----------------------------------------
  // Task Queries
  // ----------------------------------------

  async getTasksByEntity(
    entityType: string,
    entityId: string
  ): Promise<GeneratedTask[]> {
    const q = query(
      collection(db, GENERATED_TASKS_COLLECTION),
      where('entityType', '==', entityType),
      where('entityId', '==', entityId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return this.mapTaskDocs(snapshot.docs);
  }

  async getTasksByProject(projectId: string): Promise<GeneratedTask[]> {
    const q = query(
      collection(db, GENERATED_TASKS_COLLECTION),
      where('projectId', '==', projectId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return this.mapTaskDocs(snapshot.docs);
  }

  async getTasksByAssignee(
    userId: string,
    statusFilter?: TaskStatus[]
  ): Promise<GeneratedTask[]> {
    let q = query(
      collection(db, GENERATED_TASKS_COLLECTION),
      where('assignedTo', '==', userId),
      orderBy('dueDate', 'asc')
    );

    const snapshot = await getDocs(q);
    let tasks = this.mapTaskDocs(snapshot.docs);

    if (statusFilter && statusFilter.length > 0) {
      tasks = tasks.filter((t) => statusFilter.includes(t.status));
    }

    return tasks;
  }

  async getPendingTasks(limitCount: number = 50): Promise<GeneratedTask[]> {
    const q = query(
      collection(db, GENERATED_TASKS_COLLECTION),
      where('status', 'in', ['pending', 'in_progress']),
      orderBy('dueDate', 'asc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return this.mapTaskDocs(snapshot.docs);
  }

  private mapTaskDocs(docs: any[]): GeneratedTask[] {
    return docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      dueDate: doc.data().dueDate?.toDate(),
      startedAt: doc.data().startedAt?.toDate(),
      completedAt: doc.data().completedAt?.toDate(),
      assignedAt: doc.data().assignedAt?.toDate(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    })) as GeneratedTask[];
  }

  // ----------------------------------------
  // Task Updates
  // ----------------------------------------

  async updateTaskStatus(
    taskId: string,
    status: TaskStatus
  ): Promise<void> {
    const updates: Record<string, any> = {
      status,
      updatedAt: Timestamp.now(),
    };

    if (status === 'in_progress') {
      updates.startedAt = Timestamp.now();
    } else if (status === 'completed') {
      updates.completedAt = Timestamp.now();
    }

    await updateDoc(doc(db, GENERATED_TASKS_COLLECTION, taskId), updates);
  }

  async updateChecklistItem(
    taskId: string,
    checklistItemId: string,
    completed: boolean,
    userId: string
  ): Promise<void> {
    const taskRef = doc(db, GENERATED_TASKS_COLLECTION, taskId);
    const taskSnap = await getDoc(taskRef);

    if (!taskSnap.exists()) {
      throw new Error('Task not found');
    }

    const task = taskSnap.data() as GeneratedTask;
    const checklistItems = task.checklistItems.map((item) => {
      if (item.id === checklistItemId) {
        return {
          ...item,
          completed,
          completedAt: completed ? new Date() : undefined,
          completedBy: completed ? userId : undefined,
        };
      }
      return item;
    });

    // Calculate progress
    const completedCount = checklistItems.filter((i) => i.completed).length;
    const checklistProgress = Math.round(
      (completedCount / checklistItems.length) * 100
    );

    await updateDoc(taskRef, {
      checklistItems,
      checklistProgress,
      updatedAt: Timestamp.now(),
    });
  }

  async assignTask(
    taskId: string,
    userId: string,
    userName: string
  ): Promise<void> {
    await updateDoc(doc(db, GENERATED_TASKS_COLLECTION, taskId), {
      assignedTo: userId,
      assignedToName: userName,
      assignedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }

  // ----------------------------------------
  // Real-time Listeners
  // ----------------------------------------

  subscribeToUserTasks(
    userId: string,
    callback: (tasks: GeneratedTask[]) => void
  ): Unsubscribe {
    const q = query(
      collection(db, GENERATED_TASKS_COLLECTION),
      where('assignedTo', '==', userId),
      where('status', 'in', ['pending', 'in_progress']),
      orderBy('dueDate', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
      const tasks = this.mapTaskDocs(snapshot.docs);
      callback(tasks);
    });
  }

  subscribeToEntityTasks(
    entityType: string,
    entityId: string,
    callback: (tasks: GeneratedTask[]) => void
  ): Unsubscribe {
    const q = query(
      collection(db, GENERATED_TASKS_COLLECTION),
      where('entityType', '==', entityType),
      where('entityId', '==', entityId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const tasks = this.mapTaskDocs(snapshot.docs);
      callback(tasks);
    });
  }
}

export const taskGenerationService = new TaskGenerationService();
export default taskGenerationService;
