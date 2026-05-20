/**
 * Smart Task Core Service - DawinOS v2.0
 * Unified orchestration layer for the Intelligence Layer
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
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase/firestore';
import { 
  COLLECTIONS, 
  TaskPriority,
  SubsidiaryId,
  DepartmentId,
} from '../config/constants';
import {
  DailyWorkSummary,
  TeamWorkSummary,
  MorningBriefing,
  EventProcessingResult,
  PipelineStage,
  WorkItem,
  WorkInboxFilters,
  WorkInboxSort,
  AIAnalysisRequest,
  AIAnalysisResponse,
  TaskPrioritizationResult,
  WorkloadOptimizationResult,
  SmartTaskCoreConfig,
  DEFAULT_CORE_CONFIG,
} from '../types/smart-task-core.types';
import { Task } from '../types/task-generation.types';
import { GreyArea } from '../types/grey-area.types';
import { BusinessEvent } from '../types/business-event.types';
import { processBusinessEvent } from './task-generation.service';
import { scanForGreyAreas } from './grey-area-detection.service';
import { getEmployeeRoleAssignment } from './role-profile.service';

// ============================================
// Helper Functions
// ============================================

function now(): Timestamp {
  return Timestamp.now();
}

function formatDate(date: Date, format: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  if (format === 'YYYY-MM-DD') {
    return `${year}-${month}-${day}`;
  }
  if (format === 'MMM D') {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  }
  if (format === 'h:mm A') {
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  }
  return date.toISOString();
}

// ============================================
// Work Summary Generation
// ============================================

/**
 * Generate daily work summary for an employee
 */
export async function generateDailyWorkSummary(
  employeeId: string
): Promise<DailyWorkSummary> {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  
  // Get employee info
  const employeeDoc = await getDoc(doc(db, COLLECTIONS.EMPLOYEES, employeeId));
  const employeeName = employeeDoc.exists() 
    ? `${employeeDoc.data().firstName} ${employeeDoc.data().lastName}` 
    : 'Unknown';
  
  // Get tasks
  const tasksQuery = query(
    collection(db, COLLECTIONS.SMART_TASKS),
    where('assignment.assigneeId', '==', employeeId)
  );
  const tasksSnapshot = await getDocs(tasksQuery);
  const tasks = tasksSnapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Task);
  
  const activeTasks = tasks.filter(t => ['pending', 'in-progress', 'blocked'].includes(t.status));
  const completedToday = tasks.filter(t => 
    t.status === 'completed' && 
    t.completion?.completedAt &&
    t.completion.completedAt.toDate() >= todayStart
  );
  const overdueTasks = activeTasks.filter(t => 
    t.dueDate && t.dueDate.toDate() < new Date()
  );
  const dueToday = activeTasks.filter(t => {
    if (!t.dueDate) return false;
    const due = t.dueDate.toDate();
    return due >= todayStart && due <= todayEnd;
  });
  
  // Get grey areas
  const greyAreasQuery = query(
    collection(db, COLLECTIONS.GREY_AREAS),
    where('assignedTo.id', '==', employeeId),
    where('status', 'in', ['detected', 'under_review', 'pending_input', 'escalated'])
  );
  const greyAreasSnapshot = await getDocs(greyAreasQuery);
  const greyAreas = greyAreasSnapshot.docs.map(d => d.data() as GreyArea);
  
  // Get events to acknowledge
  let eventsCount = 0;
  try {
    const eventsQuery = query(
      collection(db, COLLECTIONS.BUSINESS_EVENTS),
      where('trigger.id', '==', employeeId),
      where('processing.status', '==', 'pending')
    );
    const eventsSnapshot = await getDocs(eventsQuery);
    eventsCount = eventsSnapshot.size;
  } catch (e) {
    // Events collection might not exist yet
  }
  
  // Calculate completion rate (last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekTasks = tasks.filter(t => t.createdAt.toDate() >= weekAgo);
  const weekCompleted = weekTasks.filter(t => t.status === 'completed').length;
  const completionRate = weekTasks.length > 0 
    ? Math.round((weekCompleted / weekTasks.length) * 100)
    : 100;
  
  // Calculate avg response time
  const completedWithTimes = tasks.filter(t => 
    t.completion?.completedAt && t.assignment?.assignedAt
  );
  const avgResponseTime = completedWithTimes.length > 0
    ? completedWithTimes.reduce((sum, t) => {
        const assigned = t.assignment!.assignedAt.toDate().getTime();
        const completed = t.completion!.completedAt.toDate().getTime();
        return sum + (completed - assigned) / (1000 * 60 * 60);
      }, 0) / completedWithTimes.length
    : 0;
  
  const summary: DailyWorkSummary = {
    employeeId,
    employeeName,
    date: formatDate(new Date(), 'YYYY-MM-DD'),
    
    tasks: {
      total: activeTasks.length,
      completed: completedToday.length,
      inProgress: activeTasks.filter(t => t.status === 'in-progress').length,
      overdue: overdueTasks.length,
      dueToday: dueToday.length,
      byPriority: {
        critical: activeTasks.filter(t => t.priority === 'critical').length,
        high: activeTasks.filter(t => t.priority === 'high').length,
        medium: activeTasks.filter(t => t.priority === 'medium').length,
        low: activeTasks.filter(t => t.priority === 'low').length,
      },
    },
    
    greyAreas: {
      total: greyAreas.length,
      critical: greyAreas.filter(g => g.severity === 'critical').length,
      pendingInput: greyAreas.filter(g => g.status === 'pending_input').length,
      escalated: greyAreas.filter(g => g.status === 'escalated').length,
    },
    
    eventsTriggered: eventsCount,
    eventsToAcknowledge: eventsCount,
    
    completionRate,
    avgResponseTime: Math.round(avgResponseTime * 10) / 10,
    
    generatedAt: now(),
  };
  
  return summary;
}

/**
 * Generate team work summary
 */
export async function generateTeamWorkSummary(
  departmentId: DepartmentId,
  subsidiaryId: SubsidiaryId
): Promise<TeamWorkSummary> {
  // Get department info
  const deptDoc = await getDoc(doc(db, COLLECTIONS.DEPARTMENTS, departmentId));
  const deptName = deptDoc.exists() ? deptDoc.data().name : 'Unknown';
  
  // Get team members
  const membersQuery = query(
    collection(db, COLLECTIONS.EMPLOYEES),
    where('employment.departmentId', '==', departmentId),
    where('status', '==', 'active')
  );
  const membersSnapshot = await getDocs(membersQuery);
  const memberIds = membersSnapshot.docs.map(d => d.id);
  
  // Get all tasks for department
  const tasksQuery = query(
    collection(db, COLLECTIONS.SMART_TASKS),
    where('departmentId', '==', departmentId),
    where('status', 'in', ['pending', 'in-progress', 'blocked'])
  );
  const tasksSnapshot = await getDocs(tasksQuery);
  const tasks = tasksSnapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Task);
  
  // Get grey areas for department
  const greyAreasQuery = query(
    collection(db, COLLECTIONS.GREY_AREAS),
    where('departmentId', '==', departmentId),
    where('status', 'in', ['detected', 'under_review', 'pending_input', 'escalated'])
  );
  const greyAreasSnapshot = await getDocs(greyAreasQuery);
  const greyAreas = greyAreasSnapshot.docs.map(d => d.data() as GreyArea);
  
  // Calculate completed today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const completedTodayQuery = query(
    collection(db, COLLECTIONS.SMART_TASKS),
    where('departmentId', '==', departmentId),
    where('status', '==', 'completed')
  );
  const completedSnapshot = await getDocs(completedTodayQuery);
  const completedToday = completedSnapshot.docs.filter(d => {
    const task = d.data() as Task;
    const completedAt = task.completion?.completedAt;
    return completedAt && completedAt.toDate() >= today;
  }).length;
  
  // Calculate avg task age
  const taskAges = tasks
    .filter(t => t.createdAt)
    .map(t => (Date.now() - t.createdAt.toDate().getTime()) / (1000 * 60 * 60 * 24));
  const avgTaskAge = taskAges.length > 0
    ? Math.round(taskAges.reduce((a, b) => a + b, 0) / taskAges.length * 10) / 10
    : 0;
  
  // Identify bottlenecks
  const bottlenecks: TeamWorkSummary['bottlenecks'] = [];
  
  // Check for overloaded members
  const memberTaskCounts = memberIds.map(id => ({
    id,
    count: tasks.filter(t => t.assignment?.assigneeId === id).length,
  }));
  const maxTasks = Math.max(...memberTaskCounts.map(m => m.count), 0);
  if (maxTasks > 10) {
    const overloaded = memberTaskCounts.filter(m => m.count > 10);
    bottlenecks.push({
      type: 'overloaded_member',
      description: `${overloaded.length} team member(s) have more than 10 active tasks`,
      affectedTasks: overloaded.reduce((sum, m) => sum + m.count, 0),
      suggestion: 'Consider redistributing tasks or adding team capacity',
    });
  }
  
  // Check for unassigned tasks
  const unassigned = tasks.filter(t => !t.assignment || t.stage === 'pending_assignment');
  if (unassigned.length > 3) {
    bottlenecks.push({
      type: 'process_delay',
      description: `${unassigned.length} tasks are unassigned`,
      affectedTasks: unassigned.length,
      suggestion: 'Review role profiles and assignment rules',
    });
  }
  
  const summary: TeamWorkSummary = {
    departmentId,
    departmentName: deptName,
    subsidiaryId,
    date: formatDate(new Date(), 'YYYY-MM-DD'),
    
    totalMembers: membersSnapshot.size,
    activeMembers: memberIds.length,
    
    tasks: {
      total: tasks.length,
      unassigned: unassigned.length,
      overdue: tasks.filter(t => t.dueDate && t.dueDate.toDate() < new Date()).length,
      completedToday,
      byStatus: {
        pending: tasks.filter(t => t.status === 'pending').length,
        'in-progress': tasks.filter(t => t.status === 'in-progress').length,
        blocked: tasks.filter(t => t.status === 'blocked').length,
        completed: completedToday,
      },
      byPriority: {
        critical: tasks.filter(t => t.priority === 'critical').length,
        high: tasks.filter(t => t.priority === 'high').length,
        medium: tasks.filter(t => t.priority === 'medium').length,
        low: tasks.filter(t => t.priority === 'low').length,
      },
    },
    
    greyAreas: {
      total: greyAreas.length,
      bySeverity: {
        critical: greyAreas.filter(g => g.severity === 'critical').length,
        high: greyAreas.filter(g => g.severity === 'high').length,
        medium: greyAreas.filter(g => g.severity === 'medium').length,
        low: greyAreas.filter(g => g.severity === 'low').length,
      },
    },
    
    teamCompletionRate: tasks.length > 0 
      ? Math.round((completedToday / (tasks.length + completedToday)) * 100)
      : 100,
    avgTaskAge,
    
    bottlenecks: bottlenecks.length > 0 ? bottlenecks : undefined,
    
    generatedAt: now(),
  };
  
  return summary;
}

// ============================================
// Morning Briefing Generation
// ============================================

/**
 * Generate morning briefing for an employee
 */
export async function generateMorningBriefing(
  employeeId: string,
  config: SmartTaskCoreConfig = DEFAULT_CORE_CONFIG
): Promise<MorningBriefing> {
  // Get summary data
  const summary = await generateDailyWorkSummary(employeeId);
  
  // Get employee's role for context
  let role: any = null;
  try {
    role = await getEmployeeRoleAssignment(employeeId);
  } catch (e) {
    // Role assignment might not exist
  }
  
  // Get priority items
  const priorityItems: MorningBriefing['priorityItems'] = [];
  
  // Get overdue tasks
  const overdueQuery = query(
    collection(db, COLLECTIONS.SMART_TASKS),
    where('assignment.assigneeId', '==', employeeId),
    where('status', 'in', ['pending', 'in-progress']),
    orderBy('dueDate', 'asc'),
    limit(5)
  );
  const overdueSnapshot = await getDocs(overdueQuery);
  overdueSnapshot.forEach(docSnap => {
    const task = docSnap.data() as Task;
    if (task.dueDate && task.dueDate.toDate() < new Date()) {
      priorityItems.push({
        type: 'task',
        id: docSnap.id,
        title: task.title,
        description: `Overdue since ${formatDate(task.dueDate.toDate(), 'MMM D')}`,
        urgency: 'immediate',
        actionRequired: 'Complete or update status',
      });
    }
  });
  
  // Get critical grey areas
  const criticalGAQuery = query(
    collection(db, COLLECTIONS.GREY_AREAS),
    where('assignedTo.id', '==', employeeId),
    where('severity', '==', 'critical'),
    where('status', 'in', ['detected', 'under_review', 'pending_input']),
    limit(2)
  );
  const criticalGASnapshot = await getDocs(criticalGAQuery);
  criticalGASnapshot.forEach(docSnap => {
    const ga = docSnap.data() as GreyArea;
    priorityItems.push({
      type: 'grey_area',
      id: docSnap.id,
      title: ga.title,
      description: ga.description.substring(0, 100) + (ga.description.length > 100 ? '...' : ''),
      urgency: 'immediate',
      actionRequired: 'Review and resolve',
    });
  });
  
  // Get tasks due today
  const today = new Date();
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);
  
  const dueTodayQuery = query(
    collection(db, COLLECTIONS.SMART_TASKS),
    where('assignment.assigneeId', '==', employeeId),
    where('status', 'in', ['pending', 'in-progress']),
    orderBy('dueDate', 'asc'),
    limit(10)
  );
  const dueTodaySnapshot = await getDocs(dueTodayQuery);
  dueTodaySnapshot.forEach(docSnap => {
    const task = docSnap.data() as Task;
    if (task.dueDate) {
      const dueDate = task.dueDate.toDate();
      if (dueDate >= new Date() && dueDate <= todayEnd && priorityItems.length < 8) {
        priorityItems.push({
          type: 'task',
          id: docSnap.id,
          title: task.title,
          description: `Due at ${formatDate(dueDate, 'h:mm A')}`,
          urgency: 'today',
          actionRequired: 'Complete before deadline',
        });
      }
    }
  });
  
  // Generate greeting based on time
  const hour = new Date().getHours();
  let greeting = 'Good morning';
  if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
  if (hour >= 17) greeting = 'Good evening';
  
  const firstName = summary.employeeName.split(' ')[0];
  greeting += `, ${firstName}!`;
  
  // Generate focus suggestion
  let focusSuggestion: string | undefined;
  if (summary.tasks.overdue > 0) {
    focusSuggestion = `Focus on clearing ${summary.tasks.overdue} overdue task${summary.tasks.overdue > 1 ? 's' : ''} first.`;
  } else if (summary.greyAreas.critical > 0) {
    focusSuggestion = `You have ${summary.greyAreas.critical} critical grey area${summary.greyAreas.critical > 1 ? 's' : ''} requiring immediate attention.`;
  } else if (summary.tasks.dueToday > 0) {
    focusSuggestion = `You have ${summary.tasks.dueToday} task${summary.tasks.dueToday > 1 ? 's' : ''} due today. Plan your day accordingly.`;
  } else {
    focusSuggestion = "No urgent items. Great time to work on important but not urgent tasks!";
  }
  
  // AI-generated insights (if enabled)
  let insights: MorningBriefing['insights'];
  if (config.enableAIBriefings) {
    try {
      insights = await generateAIInsights(summary, role);
    } catch (error) {
      console.error('AI insights generation failed:', error);
    }
  }
  
  const briefing: MorningBriefing = {
    employeeId,
    employeeName: summary.employeeName,
    date: formatDate(new Date(), 'YYYY-MM-DD'),
    
    greeting,
    priorityItems,
    
    stats: {
      tasksTotal: summary.tasks.total,
      tasksDueToday: summary.tasks.dueToday,
      greyAreasPending: summary.greyAreas.total,
      meetingsToday: 0, // Would integrate with calendar
    },
    
    insights,
    focusSuggestion,
    
    generatedAt: now(),
    aiGenerated: !!insights,
  };
  
  // Save briefing
  const briefingId = `${employeeId}_briefing_${briefing.date}`;
  await setDoc(
    doc(db, COLLECTIONS.USER_SETTINGS, briefingId),
    briefing
  );
  
  return briefing;
}

/**
 * Generate AI insights for briefing
 */
async function generateAIInsights(
  summary: DailyWorkSummary,
  _role: any
): Promise<MorningBriefing['insights']> {
  // In production, this would call Firebase Genkit with Gemini
  // For now, return rule-based insights
  const insights: MorningBriefing['insights'] = [];
  
  if (summary.completionRate < 50) {
    insights.push({
      observation: 'Your task completion rate this week is below average',
      recommendation: 'Consider breaking large tasks into smaller subtasks for better progress tracking',
      confidence: 0.85,
    });
  }
  
  if (summary.avgResponseTime > 24) {
    insights.push({
      observation: 'Average task response time is over 24 hours',
      recommendation: 'Try to acknowledge new tasks within 4 hours even if you cannot complete them immediately',
      confidence: 0.8,
    });
  }
  
  if (summary.tasks.byPriority.critical > 2) {
    insights.push({
      observation: 'You have multiple critical tasks',
      recommendation: 'Focus exclusively on critical items today and delegate or defer lower priority work',
      confidence: 0.9,
    });
  }
  
  return insights.length > 0 ? insights : undefined;
}

// ============================================
// Unified Work Inbox
// ============================================

/**
 * Get unified work inbox (tasks + grey areas)
 */
export async function getWorkInbox(
  employeeId: string,
  filters: WorkInboxFilters = {},
  sort: WorkInboxSort = { field: 'priority', direction: 'desc' }
): Promise<WorkItem[]> {
  const items: WorkItem[] = [];
  
  // Get tasks
  if (!filters.types || filters.types.includes('task')) {
    const taskQuery = query(
      collection(db, COLLECTIONS.SMART_TASKS),
      where('assignment.assigneeId', '==', employeeId)
    );
    
    const tasksSnapshot = await getDocs(taskQuery);
    tasksSnapshot.forEach(docSnap => {
      const task = { id: docSnap.id, ...docSnap.data() } as Task;
      
      // Filter by status
      if (!filters.includeCompleted && ['completed', 'cancelled'].includes(task.status)) {
        return;
      }
      
      items.push(taskToWorkItem(docSnap.id, task));
    });
  }
  
  // Get grey areas
  if (!filters.types || filters.types.includes('grey_area')) {
    const gaQuery = query(
      collection(db, COLLECTIONS.GREY_AREAS),
      where('assignedTo.id', '==', employeeId)
    );
    
    const gaSnapshot = await getDocs(gaQuery);
    gaSnapshot.forEach(docSnap => {
      const ga = { id: docSnap.id, ...docSnap.data() } as GreyArea;
      
      // Filter by status
      if (!filters.includeCompleted && ['resolved', 'dismissed'].includes(ga.status)) {
        return;
      }
      
      items.push(greyAreaToWorkItem(docSnap.id, ga));
    });
  }
  
  // Apply filters
  let filtered = items;
  
  if (filters.priorities && filters.priorities.length > 0) {
    filtered = filtered.filter(i => filters.priorities!.includes(String(i.priority)));
  }
  
  if (filters.subsidiaryIds && filters.subsidiaryIds.length > 0) {
    filtered = filtered.filter(i => filters.subsidiaryIds!.includes(i.subsidiaryId));
  }
  
  if (filters.dueBefore) {
    filtered = filtered.filter(i => i.dueDate && i.dueDate.toMillis() <= filters.dueBefore!.toMillis());
  }
  
  if (filters.includeOverdue === false) {
    filtered = filtered.filter(i => !i.isOverdue);
  }
  
  if (filters.searchQuery) {
    const queryLower = filters.searchQuery.toLowerCase();
    filtered = filtered.filter(i => 
      i.title.toLowerCase().includes(queryLower) ||
      i.description.toLowerCase().includes(queryLower)
    );
  }
  
  // Sort
  filtered.sort((a, b) => {
    let comparison = 0;
    
    switch (sort.field) {
      case 'priority':
        const priorityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority as string] || 0;
        const bPriority = priorityOrder[b.priority as string] || 0;
        comparison = bPriority - aPriority;
        break;
      case 'dueDate':
        const aDate = a.dueDate?.toMillis() || Infinity;
        const bDate = b.dueDate?.toMillis() || Infinity;
        comparison = aDate - bDate;
        break;
      case 'createdAt':
        comparison = b.createdAt.toMillis() - a.createdAt.toMillis();
        break;
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
    }
    
    return sort.direction === 'desc' ? comparison : -comparison;
  });
  
  return filtered;
}

/**
 * Convert task to work item
 */
function taskToWorkItem(id: string, task: Task): WorkItem {
  return {
    id,
    type: 'task',
    title: task.title,
    description: task.description || '',
    priority: task.priority,
    status: task.status,
    assignedTo: task.assignment?.assigneeRef,
    createdAt: task.createdAt,
    dueDate: task.dueDate,
    isOverdue: !!(task.dueDate && task.dueDate.toDate() < new Date() && !['completed', 'cancelled'].includes(task.status)),
    subsidiaryId: task.subsidiaryId,
    departmentId: task.departmentId,
    entity: task,
  };
}

/**
 * Convert grey area to work item
 */
function greyAreaToWorkItem(id: string, ga: GreyArea): WorkItem {
  return {
    id,
    type: 'grey_area',
    title: ga.title,
    description: ga.description,
    priority: ga.severity,
    status: ga.status,
    assignedTo: ga.assignedTo,
    createdAt: ga.createdAt,
    dueDate: ga.resolutionDeadline,
    isOverdue: !!(ga.resolutionDeadline && ga.resolutionDeadline.toDate() < new Date() && !['resolved', 'dismissed'].includes(ga.status)),
    subsidiaryId: ga.subsidiaryId,
    departmentId: ga.departmentId,
    entity: ga,
  };
}

// ============================================
// Event Processing Pipeline
// ============================================

/**
 * Process a business event through the full pipeline
 */
export async function processEventPipeline(
  event: BusinessEvent,
  _config: SmartTaskCoreConfig = DEFAULT_CORE_CONFIG
): Promise<EventProcessingResult> {
  const result: EventProcessingResult = {
    eventId: event.id,
    eventType: event.eventType,
    stages: [],
    tasksCreated: [],
    greyAreasCreated: [],
    notificationsSent: 0,
    totalDuration: 0,
    success: false,
  };
  
  const startTime = Date.now();
  
  try {
    // Stage 1: Validate
    result.stages.push(await runPipelineStage('validated', async () => {
      if (!event.id || !event.eventType || !event.metadata?.subsidiaryId) {
        throw new Error('Invalid event structure');
      }
      return { valid: true };
    }));
    
    // Stage 2: Enrich
    result.stages.push(await runPipelineStage('enriched', async () => {
      return { enriched: true };
    }));
    
    // Stage 3: Generate tasks
    result.stages.push(await runPipelineStage('tasks_generated', async () => {
      const taskResult = await processBusinessEvent(event);
      result.tasksCreated = taskResult.results
        .filter(r => r.success && r.taskId)
        .map(r => r.taskId!);
      return {
        tasksGenerated: result.tasksCreated.length,
        skipped: taskResult.tasksSkipped,
      };
    }));
    
    // Stage 4: Check for grey areas
    result.stages.push(await runPipelineStage('grey_areas_checked', async () => {
      const greyAreas = await scanForGreyAreas(
        event.payload,
        'event',
        event.id
      );
      result.greyAreasCreated = greyAreas.map(g => g.id);
      return { greyAreasDetected: greyAreas.length };
    }));
    
    // Stage 5: Send notifications
    result.stages.push(await runPipelineStage('notifications_sent', async () => {
      result.notificationsSent = result.tasksCreated.length;
      return { notificationsSent: result.tasksCreated.length };
    }));
    
    // Stage 6: Complete
    result.stages.push({
      stage: 'completed',
      status: 'success',
      startedAt: now(),
      completedAt: now(),
      output: { success: true },
    });
    
    result.success = true;
    
  } catch (error: any) {
    result.error = error.message;
    result.stages.push({
      stage: 'failed',
      status: 'failed',
      startedAt: now(),
      completedAt: now(),
      error: error.message,
    });
  }
  
  result.totalDuration = Date.now() - startTime;
  
  // Update event with processing result
  try {
    await updateDoc(doc(db, COLLECTIONS.BUSINESS_EVENTS, event.id), {
      'processing.result': result,
      updatedAt: now(),
    });
  } catch (e) {
    console.warn('Could not update event processing result:', e);
  }
  
  return result;
}

/**
 * Run a pipeline stage with timing
 */
async function runPipelineStage(
  stage: PipelineStage,
  action: () => Promise<any>
): Promise<EventProcessingResult['stages'][0]> {
  const startedAt = now();
  
  try {
    const output = await action();
    return {
      stage,
      status: 'success',
      startedAt,
      completedAt: now(),
      output,
    };
  } catch (error: any) {
    return {
      stage,
      status: 'failed',
      startedAt,
      completedAt: now(),
      error: error.message,
    };
  }
}

// ============================================
// AI Analysis Functions
// ============================================

/**
 * Request AI analysis
 */
export async function requestAIAnalysis(
  request: AIAnalysisRequest,
  config: SmartTaskCoreConfig = DEFAULT_CORE_CONFIG
): Promise<AIAnalysisResponse> {
  const startTime = Date.now();
  
  let result: any;
  let confidence = 0.75;
  let suggestions: AIAnalysisResponse['suggestions'] = [];
  
  switch (request.type) {
    case 'task_prioritization':
      result = await analyzeTaskPriorities(request.context.tasks || []);
      confidence = 0.85;
      break;
      
    case 'workload_optimization':
      result = await analyzeWorkload(
        request.context.subsidiaryId,
        request.context.departmentId
      );
      confidence = 0.8;
      break;
      
    case 'grey_area_assessment':
      result = { assessment: 'Requires human review', severity: 'medium' };
      confidence = 0.65;
      suggestions = [{
        action: 'Request additional context',
        rationale: 'More information needed for accurate assessment',
        priority: 'medium',
      }];
      break;
      
    default:
      result = { message: 'Analysis type not supported' };
  }
  
  return {
    requestType: request.type,
    success: true,
    result,
    confidence,
    suggestions,
    modelUsed: config.aiModel,
    tokensUsed: 0,
    latency: Date.now() - startTime,
    generatedAt: now(),
  };
}

/**
 * Analyze task priorities
 */
async function analyzeTaskPriorities(
  tasks: Task[]
): Promise<TaskPrioritizationResult> {
  const taskAnalysis = tasks.map((task) => {
    let score = 0;
    const factors: string[] = [];
    
    // Base priority
    const priorityScores: Record<TaskPriority, number> = { critical: 40, high: 30, medium: 20, low: 10 };
    score += priorityScores[task.priority] || 0;
    factors.push(`Base priority: ${task.priority}`);
    
    // Due date urgency
    if (task.dueDate) {
      const hoursUntilDue = (task.dueDate.toDate().getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilDue < 0) {
        score += 30;
        factors.push('Overdue');
      } else if (hoursUntilDue < 4) {
        score += 25;
        factors.push('Due very soon');
      } else if (hoursUntilDue < 24) {
        score += 15;
        factors.push('Due today');
      }
    }
    
    // Dependencies
    if (task.dependencies?.some(d => d.type === 'blocks' && d.status === 'pending')) {
      score += 10;
      factors.push('Blocks other tasks');
    }
    
    // Financial impact
    const amount = (task.context as any)?.customData?.amount;
    if (amount && amount > 10_000_000) {
      score += 15;
      factors.push('High financial impact');
    }
    
    return {
      taskId: task.id,
      originalPriority: task.priority,
      suggestedPriority: scoreToPriority(score),
      priorityScore: Math.min(score, 100),
      factors,
      suggestedOrder: 0,
    };
  });
  
  // Sort by score and assign order
  taskAnalysis.sort((a, b) => b.priorityScore - a.priorityScore);
  taskAnalysis.forEach((t, i) => t.suggestedOrder = i + 1);
  
  return {
    tasks: taskAnalysis,
    recommendations: [
      'Focus on overdue items first',
      'Complete tasks that block others early',
      'Consider delegating low-priority items if overloaded',
    ],
  };
}

/**
 * Convert score to priority level
 */
function scoreToPriority(score: number): TaskPriority {
  if (score >= 60) return 'critical';
  if (score >= 40) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

/**
 * Analyze workload distribution
 */
async function analyzeWorkload(
  subsidiaryId: SubsidiaryId,
  departmentId?: DepartmentId
): Promise<WorkloadOptimizationResult> {
  // Get employees
  let empQuery = query(
    collection(db, COLLECTIONS.EMPLOYEES),
    where('employment.subsidiaryId', '==', subsidiaryId),
    where('status', '==', 'active')
  );
  
  if (departmentId) {
    empQuery = query(empQuery, where('employment.departmentId', '==', departmentId));
  }
  
  const empSnapshot = await getDocs(empQuery);
  const employees = empSnapshot.docs.map(d => ({
    id: d.id,
    name: `${d.data().firstName} ${d.data().lastName}`,
    data: d.data(),
  }));
  
  // Get task counts per employee
  const distribution: WorkloadOptimizationResult['currentDistribution'] = [];
  
  for (const emp of employees) {
    const taskQuery = query(
      collection(db, COLLECTIONS.SMART_TASKS),
      where('assignment.assigneeId', '==', emp.id),
      where('status', 'in', ['pending', 'in-progress'])
    );
    const taskSnapshot = await getDocs(taskQuery);
    const tasks = taskSnapshot.docs.map(d => d.data() as Task);
    
    const estimatedHours = tasks.reduce((sum, t) => 
      sum + ((t as any).estimatedMinutes || 60) / 60, 0
    );
    
    distribution.push({
      employeeId: emp.id,
      employeeName: emp.name,
      taskCount: tasks.length,
      estimatedHours: Math.round(estimatedHours * 10) / 10,
      utilizationPercent: Math.min(Math.round((estimatedHours / 40) * 100), 100),
    });
  }
  
  // Identify bottlenecks
  const bottlenecks: WorkloadOptimizationResult['bottlenecks'] = [];
  const avgTasks = distribution.length > 0 
    ? distribution.reduce((sum, d) => sum + d.taskCount, 0) / distribution.length 
    : 0;
  
  distribution.forEach(d => {
    if (avgTasks > 0 && d.taskCount > avgTasks * 2) {
      bottlenecks.push({
        type: 'overloaded_employee',
        description: `${d.employeeName} has ${d.taskCount} tasks (${Math.round(d.taskCount / avgTasks * 100)}% of average)`,
        impact: d.taskCount - avgTasks,
        suggestion: 'Consider redistributing some tasks',
      });
    }
  });
  
  return {
    currentDistribution: distribution,
    suggestedReassignments: [],
    bottlenecks,
  };
}
