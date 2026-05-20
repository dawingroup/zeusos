/**
 * Due Diligence Service
 * 
 * Manages DD lifecycle, workstreams, tasks, and findings.
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
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import {
  DueDiligence,
  DDStatus,
  DDRating,
  DDMetrics,
  DDScope,
  WorkstreamType,
  DDSummary,
} from '../types/due-diligence';
import {
  DDWorkstream,
  WorkstreamStatus,
  WORKSTREAM_TEMPLATES,
} from '../types/dd-workstream';
import { DDFinding, FindingFilters, RedFlagSummary } from '../types/dd-finding';
import { DDTask, TaskStatus, TaskSummary } from '../types/dd-task';

// Collection paths
const DD_COLLECTION = 'advisoryPlatform/investment/dueDiligence';
const WORKSTREAMS_SUBCOLLECTION = 'workstreams';
const FINDINGS_SUBCOLLECTION = 'findings';
const TASKS_SUBCOLLECTION = 'tasks';

export class DueDiligenceService {
  // ==================== DD Lifecycle ====================

  /**
   * Initialize due diligence for a deal
   */
  async initializeDueDiligence(
    dealId: string,
    engagementId: string,
    scope: DDScope,
    createdBy: string
  ): Promise<DueDiligence> {
    const ddRef = doc(collection(db, DD_COLLECTION));

    const dd: DueDiligence = {
      id: ddRef.id,
      dealId,
      engagementId,
      status: 'not_started',
      metrics: {
        totalTasks: 0,
        completedTasks: 0,
        completionPercentage: 0,
        totalFindings: 0,
        redFlagsCount: 0,
        yellowFlagsCount: 0,
        openIssuesCount: 0,
        documentsUploaded: 0,
      },
      startDate: new Date(),
      scope,
      createdAt: Timestamp.now(),
      createdBy,
      updatedAt: Timestamp.now(),
      updatedBy: createdBy,
    };

    await setDoc(ddRef, dd);

    // Initialize workstreams based on scope
    for (const workstreamType of scope.workstreamsIncluded) {
      await this.createWorkstream(dd.id, workstreamType, createdBy);
    }

    return dd;
  }

  /**
   * Get due diligence by ID
   */
  async getDueDiligence(ddId: string): Promise<DueDiligence | null> {
    const ddRef = doc(db, DD_COLLECTION, ddId);
    const ddSnap = await getDoc(ddRef);

    if (!ddSnap.exists()) {
      return null;
    }

    return ddSnap.data() as DueDiligence;
  }

  /**
   * Get due diligence by deal ID
   */
  async getDueDiligenceByDeal(dealId: string): Promise<DueDiligence | null> {
    const q = query(
      collection(db, DD_COLLECTION),
      where('dealId', '==', dealId)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs[0].data() as DueDiligence;
  }

  /**
   * Update DD status
   */
  async updateStatus(
    ddId: string,
    status: DDStatus,
    updatedBy: string
  ): Promise<void> {
    const ddRef = doc(db, DD_COLLECTION, ddId);

    const updates: Record<string, unknown> = {
      status,
      updatedAt: Timestamp.now(),
      updatedBy,
    };

    if (status === 'completed') {
      updates.actualCompletionDate = new Date();
    }

    await updateDoc(ddRef, updates);
    await this.updateMetrics(ddId);
  }

  /**
   * Sign off DD
   */
  async signOff(
    ddId: string,
    rating: DDRating,
    notes: string,
    signedOffBy: string
  ): Promise<void> {
    const ddRef = doc(db, DD_COLLECTION, ddId);

    await updateDoc(ddRef, {
      status: 'completed',
      overallRating: rating,
      signedOffBy,
      signedOffAt: Timestamp.now(),
      signOffNotes: notes,
      actualCompletionDate: new Date(),
      updatedAt: Timestamp.now(),
      updatedBy: signedOffBy,
    });
  }

  // ==================== Workstream Management ====================

  /**
   * Create workstream from template
   */
  async createWorkstream(
    ddId: string,
    type: WorkstreamType,
    createdBy: string
  ): Promise<DDWorkstream> {
    const template = WORKSTREAM_TEMPLATES[type];
    const wsRef = doc(collection(db, DD_COLLECTION, ddId, WORKSTREAMS_SUBCOLLECTION));

    const workstream: DDWorkstream = {
      id: wsRef.id,
      dueDiligenceId: ddId,
      type,
      name: template.name,
      description: template.description,
      status: 'not_started',
      completion: 0,
      team: [],
      documents: [],
      keyQuestions: template.keyQuestions.map((q, i) => ({
        id: `q-${i}`,
        question: q,
        category: type,
        priority: i < 3 ? 'high' as const : 'medium' as const,
        status: 'open' as const,
      })),
      signedOff: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await setDoc(wsRef, workstream);

    // Create default tasks
    for (const taskTitle of template.defaultTasks) {
      await this.createTask(ddId, wsRef.id, {
        title: taskTitle,
        category: 'document_review',
        priority: 'medium',
      }, createdBy);
    }

    return workstream;
  }

  /**
   * Get workstream
   */
  async getWorkstream(ddId: string, workstreamId: string): Promise<DDWorkstream | null> {
    const wsRef = doc(db, DD_COLLECTION, ddId, WORKSTREAMS_SUBCOLLECTION, workstreamId);
    const wsSnap = await getDoc(wsRef);

    if (!wsSnap.exists()) {
      return null;
    }

    return wsSnap.data() as DDWorkstream;
  }

  /**
   * Get all workstreams for a DD
   */
  async getWorkstreams(ddId: string): Promise<DDWorkstream[]> {
    const q = query(
      collection(db, DD_COLLECTION, ddId, WORKSTREAMS_SUBCOLLECTION),
      orderBy('type')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as DDWorkstream);
  }

  /**
   * Update workstream status
   */
  async updateWorkstreamStatus(
    ddId: string,
    workstreamId: string,
    status: WorkstreamStatus
  ): Promise<void> {
    const wsRef = doc(db, DD_COLLECTION, ddId, WORKSTREAMS_SUBCOLLECTION, workstreamId);

    await updateDoc(wsRef, {
      status,
      updatedAt: Timestamp.now(),
    });

    await this.updateMetrics(ddId);
  }

  /**
   * Assign workstream lead
   */
  async assignWorkstreamLead(
    ddId: string,
    workstreamId: string,
    lead: { userId: string; name: string; email: string }
  ): Promise<void> {
    const wsRef = doc(db, DD_COLLECTION, ddId, WORKSTREAMS_SUBCOLLECTION, workstreamId);

    await updateDoc(wsRef, {
      lead,
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Sign off workstream
   */
  async signOffWorkstream(
    ddId: string,
    workstreamId: string,
    signedOffBy: string
  ): Promise<void> {
    const wsRef = doc(db, DD_COLLECTION, ddId, WORKSTREAMS_SUBCOLLECTION, workstreamId);

    await updateDoc(wsRef, {
      signedOff: true,
      signedOffBy,
      signedOffAt: Timestamp.now(),
      status: 'completed',
      completion: 100,
      completedDate: new Date(),
      updatedAt: Timestamp.now(),
    });

    await this.updateMetrics(ddId);
  }

  // ==================== Task Management ====================

  /**
   * Create task
   */
  async createTask(
    ddId: string,
    workstreamId: string,
    taskData: Partial<DDTask>,
    createdBy: string
  ): Promise<DDTask> {
    const taskRef = doc(
      collection(db, DD_COLLECTION, ddId, WORKSTREAMS_SUBCOLLECTION, workstreamId, TASKS_SUBCOLLECTION)
    );

    const task: DDTask = {
      id: taskRef.id,
      dueDiligenceId: ddId,
      workstreamId,
      title: taskData.title || 'New Task',
      description: taskData.description,
      category: taskData.category || 'other',
      status: 'not_started',
      priority: taskData.priority || 'medium',
      assignee: taskData.assignee,
      dueDate: taskData.dueDate,
      subtasks: taskData.subtasks,
      attachments: [],
      createdAt: Timestamp.now(),
      createdBy,
      updatedAt: Timestamp.now(),
    };

    await setDoc(taskRef, task);
    await this.updateMetrics(ddId);

    return task;
  }

  /**
   * Get tasks for workstream
   */
  async getWorkstreamTasks(ddId: string, workstreamId: string): Promise<DDTask[]> {
    const q = query(
      collection(db, DD_COLLECTION, ddId, WORKSTREAMS_SUBCOLLECTION, workstreamId, TASKS_SUBCOLLECTION),
      orderBy('priority'),
      orderBy('createdAt')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as DDTask);
  }

  /**
   * Update task status
   */
  async updateTaskStatus(
    ddId: string,
    workstreamId: string,
    taskId: string,
    status: TaskStatus
  ): Promise<void> {
    const taskRef = doc(
      db, DD_COLLECTION, ddId, WORKSTREAMS_SUBCOLLECTION, workstreamId, TASKS_SUBCOLLECTION, taskId
    );

    const updates: Record<string, unknown> = {
      status,
      updatedAt: Timestamp.now(),
    };

    if (status === 'completed') {
      updates.completedAt = Timestamp.now();
    }

    await updateDoc(taskRef, updates);
    await this.updateWorkstreamCompletion(ddId, workstreamId);
    await this.updateMetrics(ddId);
  }

  /**
   * Assign task
   */
  async assignTask(
    ddId: string,
    workstreamId: string,
    taskId: string,
    assignee: { userId: string; name: string; email: string }
  ): Promise<void> {
    const taskRef = doc(
      db, DD_COLLECTION, ddId, WORKSTREAMS_SUBCOLLECTION, workstreamId, TASKS_SUBCOLLECTION, taskId
    );

    await updateDoc(taskRef, {
      assignee,
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Get task summary for workstream
   */
  async getTaskSummary(ddId: string, workstreamId: string): Promise<TaskSummary> {
    const tasks = await this.getWorkstreamTasks(ddId, workstreamId);
    const now = new Date();

    return {
      total: tasks.length,
      notStarted: tasks.filter(t => t.status === 'not_started').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      blocked: tasks.filter(t => t.status === 'blocked').length,
      overdue: tasks.filter(t => 
        t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed'
      ).length,
    };
  }

  // ==================== Finding Management ====================

  /**
   * Create finding
   */
  async createFinding(
    ddId: string,
    workstreamId: string,
    findingData: Partial<DDFinding>,
    createdBy: string
  ): Promise<DDFinding> {
    const findingRef = doc(
      collection(db, DD_COLLECTION, ddId, WORKSTREAMS_SUBCOLLECTION, workstreamId, FINDINGS_SUBCOLLECTION)
    );

    const workstream = await this.getWorkstream(ddId, workstreamId);

    const finding: DDFinding = {
      id: findingRef.id,
      dueDiligenceId: ddId,
      workstreamId,
      workstreamType: workstream?.type || 'commercial',
      title: findingData.title || 'New Finding',
      description: findingData.description || '',
      category: findingData.category || 'observation',
      severity: findingData.severity || 'medium',
      financialImpact: findingData.financialImpact,
      operationalImpact: findingData.operationalImpact,
      legalImpact: findingData.legalImpact,
      mitigationStrategy: findingData.mitigationStrategy,
      mitigationStatus: findingData.mitigationStatus || 'not_required',
      mitigationOwner: findingData.mitigationOwner,
      supportingDocuments: findingData.supportingDocuments || [],
      isRedFlag: findingData.severity === 'critical',
      isYellowFlag: findingData.severity === 'high',
      dealImpact: findingData.dealImpact || 'none',
      valuationImpact: findingData.valuationImpact,
      createdAt: Timestamp.now(),
      createdBy,
      updatedAt: Timestamp.now(),
      updatedBy: createdBy,
    };

    await setDoc(findingRef, finding);
    await this.updateMetrics(ddId);

    return finding;
  }

  /**
   * Get findings for workstream
   */
  async getWorkstreamFindings(ddId: string, workstreamId: string): Promise<DDFinding[]> {
    const q = query(
      collection(db, DD_COLLECTION, ddId, WORKSTREAMS_SUBCOLLECTION, workstreamId, FINDINGS_SUBCOLLECTION),
      orderBy('severity'),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as DDFinding);
  }

  /**
   * Get all findings for DD
   */
  async getAllFindings(ddId: string, filters?: FindingFilters): Promise<DDFinding[]> {
    const workstreams = await this.getWorkstreams(ddId);
    let findings: DDFinding[] = [];

    for (const ws of workstreams) {
      const wsFindings = await this.getWorkstreamFindings(ddId, ws.id);
      findings = [...findings, ...wsFindings];
    }

    // Apply filters
    if (filters) {
      if (filters.workstream) {
        findings = findings.filter(f => f.workstreamType === filters.workstream);
      }
      if (filters.severity?.length) {
        findings = findings.filter(f => filters.severity!.includes(f.severity));
      }
      if (filters.category?.length) {
        findings = findings.filter(f => filters.category!.includes(f.category));
      }
      if (filters.isRedFlag !== undefined) {
        findings = findings.filter(f => f.isRedFlag === filters.isRedFlag);
      }
      if (filters.isResolved !== undefined) {
        const resolved = filters.isResolved;
        findings = findings.filter(f => (f.resolution !== undefined) === resolved);
      }
    }

    return findings;
  }

  /**
   * Get red flags summary
   */
  async getRedFlagsSummary(ddId: string): Promise<RedFlagSummary[]> {
    const findings = await this.getAllFindings(ddId, { isRedFlag: true });
    const now = new Date();

    return findings.map(f => ({
      id: f.id,
      title: f.title,
      workstream: f.workstreamType,
      severity: f.severity,
      financialImpact: f.financialImpact,
      mitigationStatus: f.mitigationStatus,
      daysOpen: Math.floor(
        (now.getTime() - f.createdAt.toDate().getTime()) / (1000 * 60 * 60 * 24)
      ),
      assignee: f.mitigationOwner,
    }));
  }

  /**
   * Update finding
   */
  async updateFinding(
    ddId: string,
    workstreamId: string,
    findingId: string,
    updates: Partial<DDFinding>,
    updatedBy: string
  ): Promise<void> {
    const findingRef = doc(
      db, DD_COLLECTION, ddId, WORKSTREAMS_SUBCOLLECTION, workstreamId, FINDINGS_SUBCOLLECTION, findingId
    );

    await updateDoc(findingRef, {
      ...updates,
      updatedAt: Timestamp.now(),
      updatedBy,
    });

    await this.updateMetrics(ddId);
  }

  /**
   * Resolve finding
   */
  async resolveFinding(
    ddId: string,
    workstreamId: string,
    findingId: string,
    resolution: string,
    resolvedBy: string
  ): Promise<void> {
    await this.updateFinding(ddId, workstreamId, findingId, {
      resolution,
      resolvedAt: Timestamp.now(),
      resolvedBy,
      mitigationStatus: 'verified',
    }, resolvedBy);
  }

  /**
   * Escalate finding (mark as red flag)
   */
  async escalateFinding(
    ddId: string,
    workstreamId: string,
    findingId: string,
    reason: string,
    escalatedTo: string,
    escalatedBy: string
  ): Promise<void> {
    await this.updateFinding(ddId, workstreamId, findingId, {
      isRedFlag: true,
      flagReason: reason,
      escalatedTo,
      escalatedAt: Timestamp.now(),
    }, escalatedBy);
  }

  // ==================== Metrics & Analytics ====================

  /**
   * Update DD metrics
   */
  private async updateMetrics(ddId: string): Promise<void> {
    const workstreams = await this.getWorkstreams(ddId);
    const dd = await this.getDueDiligence(ddId);
    
    if (!dd) return;

    let totalTasks = 0;
    let completedTasks = 0;
    let totalFindings = 0;
    let redFlagsCount = 0;
    let yellowFlagsCount = 0;
    let openIssuesCount = 0;

    for (const ws of workstreams) {
      const taskSummary = await this.getTaskSummary(ddId, ws.id);
      const findings = await this.getWorkstreamFindings(ddId, ws.id);

      totalTasks += taskSummary.total;
      completedTasks += taskSummary.completed;
      totalFindings += findings.length;
      redFlagsCount += findings.filter(f => f.isRedFlag).length;
      yellowFlagsCount += findings.filter(f => f.isYellowFlag && !f.isRedFlag).length;
      openIssuesCount += findings.filter(f => !f.resolution && f.category === 'issue').length;
    }

    const completionPercentage = totalTasks > 0 
      ? Math.round((completedTasks / totalTasks) * 100) 
      : 0;

    // Calculate days remaining/overdue
    let daysRemaining: number | undefined;
    let daysOverdue: number | undefined;
    
    if (dd.targetCompletionDate) {
      const now = new Date();
      const target = new Date(dd.targetCompletionDate);
      const diff = Math.floor((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diff >= 0) {
        daysRemaining = diff;
      } else {
        daysOverdue = Math.abs(diff);
      }
    }

    const metrics: DDMetrics = {
      totalTasks,
      completedTasks,
      completionPercentage,
      totalFindings,
      redFlagsCount,
      yellowFlagsCount,
      openIssuesCount,
      documentsUploaded: 0,  // TODO: Calculate from workstreams
      daysRemaining,
      daysOverdue,
    };

    const ddRef = doc(db, DD_COLLECTION, ddId);
    await updateDoc(ddRef, {
      metrics,
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Update workstream completion percentage
   */
  private async updateWorkstreamCompletion(ddId: string, workstreamId: string): Promise<void> {
    const taskSummary = await this.getTaskSummary(ddId, workstreamId);
    const completion = taskSummary.total > 0
      ? Math.round((taskSummary.completed / taskSummary.total) * 100)
      : 0;

    const wsRef = doc(db, DD_COLLECTION, ddId, WORKSTREAMS_SUBCOLLECTION, workstreamId);
    await updateDoc(wsRef, {
      completion,
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Get DD summary for deal view
   */
  async getDDSummary(ddId: string): Promise<DDSummary | null> {
    const dd = await this.getDueDiligence(ddId);
    if (!dd) return null;

    const workstreams = await this.getWorkstreams(ddId);

    const workstreamsSummary = await Promise.all(
      workstreams.map(async ws => {
        const findings = await this.getWorkstreamFindings(ddId, ws.id);
        return {
          type: ws.type,
          status: ws.status as DDStatus,
          completion: ws.completion,
          findingsCount: findings.length,
          redFlagsCount: findings.filter(f => f.isRedFlag).length,
          lead: ws.lead?.name,
        };
      })
    );

    return {
      id: dd.id,
      status: dd.status,
      overallRating: dd.overallRating,
      completionPercentage: dd.metrics.completionPercentage,
      redFlagsCount: dd.metrics.redFlagsCount,
      workstreamsSummary,
      lastUpdated: dd.updatedAt.toDate(),
    };
  }

  // ==================== Real-time Subscriptions ====================

  /**
   * Subscribe to DD changes
   */
  subscribeToDueDiligence(
    ddId: string,
    callback: (dd: DueDiligence | null) => void
  ): () => void {
    const ddRef = doc(db, DD_COLLECTION, ddId);
    return onSnapshot(ddRef, (snapshot) => {
      callback(snapshot.exists() ? (snapshot.data() as DueDiligence) : null);
    });
  }

  /**
   * Subscribe to workstream changes
   */
  subscribeToWorkstreams(
    ddId: string,
    callback: (workstreams: DDWorkstream[]) => void
  ): () => void {
    const q = query(
      collection(db, DD_COLLECTION, ddId, WORKSTREAMS_SUBCOLLECTION),
      orderBy('type')
    );

    return onSnapshot(q, (snapshot) => {
      const workstreams = snapshot.docs.map(d => d.data() as DDWorkstream);
      callback(workstreams);
    });
  }
}

// Export singleton instance
let dueDiligenceServiceInstance: DueDiligenceService | null = null;

export function getDueDiligenceService(): DueDiligenceService {
  if (!dueDiligenceServiceInstance) {
    dueDiligenceServiceInstance = new DueDiligenceService();
  }
  return dueDiligenceServiceInstance;
}

export const dueDiligenceService = getDueDiligenceService();
