/**
 * SCHEDULE SERVICE
 *
 * Firestore CRUD for schedule activities within delivery projects.
 * Collection path: projects/{projectId}/schedule
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
  serverTimestamp,
  onSnapshot,
  Firestore,
} from 'firebase/firestore';
import type {
  ScheduleActivity,
  ScheduleActivityFormData,
  ScheduleActivityStatus,
  ScheduleSummary,
} from '../types/schedule';
import { calculateDurationDays } from '../types/schedule';

// ─────────────────────────────────────────────────────────────────
// COLLECTION PATHS
// ─────────────────────────────────────────────────────────────────

const PROJECTS_PATH = 'projects';
const SCHEDULE_SUBCOLLECTION = 'schedule';

// ─────────────────────────────────────────────────────────────────
// SCHEDULE SERVICE
// ─────────────────────────────────────────────────────────────────

export class ScheduleService {
  private static instance: ScheduleService;
  private db: Firestore;

  private constructor(db: Firestore) {
    this.db = db;
  }

  static getInstance(db: Firestore): ScheduleService {
    if (!ScheduleService.instance) {
      ScheduleService.instance = new ScheduleService(db);
    }
    return ScheduleService.instance;
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  private getScheduleCollection(projectId: string) {
    return collection(this.db, PROJECTS_PATH, projectId, SCHEDULE_SUBCOLLECTION);
  }

  private getScheduleDocRef(projectId: string, activityId: string) {
    return doc(this.db, PROJECTS_PATH, projectId, SCHEDULE_SUBCOLLECTION, activityId);
  }

  private toScheduleActivity(id: string, data: Record<string, unknown>): ScheduleActivity {
    return {
      id,
      projectId: data.projectId as string,
      name: data.name as string,
      description: data.description as string | undefined,
      wbsCode: data.wbsCode as string | undefined,
      activityType: data.activityType as ScheduleActivity['activityType'],
      parentId: data.parentId as string | undefined,
      sortOrder: (data.sortOrder as number) || 0,
      plannedStartDate: data.plannedStartDate instanceof Timestamp
        ? data.plannedStartDate.toDate()
        : new Date(data.plannedStartDate as string),
      plannedEndDate: data.plannedEndDate instanceof Timestamp
        ? data.plannedEndDate.toDate()
        : new Date(data.plannedEndDate as string),
      actualStartDate: data.actualStartDate
        ? (data.actualStartDate instanceof Timestamp
          ? data.actualStartDate.toDate()
          : new Date(data.actualStartDate as string))
        : undefined,
      actualEndDate: data.actualEndDate
        ? (data.actualEndDate instanceof Timestamp
          ? data.actualEndDate.toDate()
          : new Date(data.actualEndDate as string))
        : undefined,
      durationDays: (data.durationDays as number) || 0,
      percentComplete: (data.percentComplete as number) || 0,
      status: (data.status as ScheduleActivityStatus) || 'not_started',
      dependencies: (data.dependencies as ScheduleActivity['dependencies']) || [],
      responsibleParty: data.responsibleParty as string | undefined,
      responsibleRole: data.responsibleRole as string | undefined,
      isCriticalPath: (data.isCriticalPath as boolean) || false,
      totalFloat: (data.totalFloat as number) || 0,
      freeFloat: (data.freeFloat as number) || 0,
      notes: data.notes as string | undefined,
      tags: data.tags as string[] | undefined,
      createdBy: data.createdBy as string,
      createdAt: data.createdAt as Timestamp,
      updatedBy: data.updatedBy as string,
      updatedAt: data.updatedAt as Timestamp,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // READ OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  async getActivities(projectId: string): Promise<ScheduleActivity[]> {
    const q = query(
      this.getScheduleCollection(projectId),
      orderBy('sortOrder', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => this.toScheduleActivity(d.id, d.data()));
  }

  async getActivity(projectId: string, activityId: string): Promise<ScheduleActivity | null> {
    const docRef = this.getScheduleDocRef(projectId, activityId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return this.toScheduleActivity(snap.id, snap.data());
  }

  subscribeToActivities(
    projectId: string,
    callback: (activities: ScheduleActivity[]) => void
  ): () => void {
    const q = query(
      this.getScheduleCollection(projectId),
      orderBy('sortOrder', 'asc')
    );
    return onSnapshot(q, (snapshot) => {
      const activities = snapshot.docs.map(d => this.toScheduleActivity(d.id, d.data()));
      callback(activities);
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // WRITE OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  async createActivity(
    projectId: string,
    data: ScheduleActivityFormData,
    userId: string
  ): Promise<ScheduleActivity> {
    const duration = calculateDurationDays(data.plannedStartDate, data.plannedEndDate);

    // Get next sort order
    const existing = await this.getActivities(projectId);
    const maxSort = existing.reduce((max, a) => Math.max(max, a.sortOrder), 0);

    const docData = {
      projectId,
      name: data.name,
      description: data.description || null,
      wbsCode: data.wbsCode || null,
      activityType: data.activityType,
      parentId: data.parentId || null,
      sortOrder: maxSort + 10,
      plannedStartDate: Timestamp.fromDate(new Date(data.plannedStartDate)),
      plannedEndDate: Timestamp.fromDate(new Date(data.plannedEndDate)),
      actualStartDate: null,
      actualEndDate: null,
      durationDays: duration,
      percentComplete: 0,
      status: 'not_started' as ScheduleActivityStatus,
      dependencies: data.dependencies || [],
      responsibleParty: data.responsibleParty || null,
      responsibleRole: data.responsibleRole || null,
      isCriticalPath: false,
      totalFloat: 0,
      freeFloat: 0,
      notes: data.notes || null,
      tags: data.tags || [],
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(this.getScheduleCollection(projectId), docData);
    return this.toScheduleActivity(docRef.id, {
      ...docData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }

  async updateActivity(
    projectId: string,
    activityId: string,
    updates: Partial<ScheduleActivity>,
    userId: string
  ): Promise<void> {
    const docRef = this.getScheduleDocRef(projectId, activityId);

    // Convert dates to Timestamps if present
    const firestoreUpdates: Record<string, unknown> = { ...updates };
    if (updates.plannedStartDate) {
      firestoreUpdates.plannedStartDate = Timestamp.fromDate(new Date(updates.plannedStartDate));
    }
    if (updates.plannedEndDate) {
      firestoreUpdates.plannedEndDate = Timestamp.fromDate(new Date(updates.plannedEndDate));
    }
    if (updates.actualStartDate) {
      firestoreUpdates.actualStartDate = Timestamp.fromDate(new Date(updates.actualStartDate));
    }
    if (updates.actualEndDate) {
      firestoreUpdates.actualEndDate = Timestamp.fromDate(new Date(updates.actualEndDate));
    }

    // Recalculate duration if dates changed
    if (updates.plannedStartDate && updates.plannedEndDate) {
      firestoreUpdates.durationDays = calculateDurationDays(
        updates.plannedStartDate,
        updates.plannedEndDate
      );
    }

    // Remove id from updates
    delete firestoreUpdates.id;
    delete firestoreUpdates.projectId;

    firestoreUpdates.updatedBy = userId;
    firestoreUpdates.updatedAt = serverTimestamp();

    await updateDoc(docRef, firestoreUpdates);
  }

  async deleteActivity(projectId: string, activityId: string): Promise<void> {
    const docRef = this.getScheduleDocRef(projectId, activityId);
    await deleteDoc(docRef);
  }

  // ─────────────────────────────────────────────────────────────────
  // PROGRESS OPERATIONS
  // ─────────────────────────────────────────────────────────────────

  async updateProgress(
    projectId: string,
    activityId: string,
    percentComplete: number,
    userId: string
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      percentComplete: Math.min(100, Math.max(0, percentComplete)),
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    };

    if (percentComplete >= 100) {
      updates.status = 'completed';
      updates.actualEndDate = serverTimestamp();
    } else if (percentComplete > 0) {
      updates.status = 'in_progress';
      // Set actual start date if not already set
      const activity = await this.getActivity(projectId, activityId);
      if (activity && !activity.actualStartDate) {
        updates.actualStartDate = serverTimestamp();
      }
    }

    const docRef = this.getScheduleDocRef(projectId, activityId);
    await updateDoc(docRef, updates);
  }

  async updateStatus(
    projectId: string,
    activityId: string,
    status: ScheduleActivityStatus,
    userId: string
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      status,
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    };

    if (status === 'completed') {
      updates.percentComplete = 100;
      updates.actualEndDate = serverTimestamp();
    }
    if (status === 'in_progress') {
      const activity = await this.getActivity(projectId, activityId);
      if (activity && !activity.actualStartDate) {
        updates.actualStartDate = serverTimestamp();
      }
    }

    const docRef = this.getScheduleDocRef(projectId, activityId);
    await updateDoc(docRef, updates);
  }

  // ─────────────────────────────────────────────────────────────────
  // CRITICAL PATH CALCULATION
  // ─────────────────────────────────────────────────────────────────

  calculateCriticalPath(activities: ScheduleActivity[]): string[] {
    if (activities.length === 0) return [];

    const tasks = activities.filter(a => a.activityType !== 'phase');
    if (tasks.length === 0) return [];

    // Build adjacency list from dependencies
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const successors = new Map<string, string[]>();
    const predecessors = new Map<string, string[]>();

    tasks.forEach(task => {
      successors.set(task.id, []);
      predecessors.set(task.id, []);
    });

    tasks.forEach(task => {
      task.dependencies.forEach(dep => {
        if (taskMap.has(dep.activityId)) {
          successors.get(dep.activityId)?.push(task.id);
          predecessors.get(task.id)?.push(dep.activityId);
        }
      });
    });

    // Forward pass - earliest start/finish
    const es = new Map<string, number>();
    const ef = new Map<string, number>();

    const topoSort = this.topologicalSort(tasks, predecessors);
    for (const taskId of topoSort) {
      const task = taskMap.get(taskId)!;
      const preds = predecessors.get(taskId) || [];
      const earliestStart = preds.length > 0
        ? Math.max(...preds.map(p => ef.get(p) || 0))
        : 0;
      es.set(taskId, earliestStart);
      ef.set(taskId, earliestStart + task.durationDays);
    }

    // Backward pass - latest start/finish
    const ls = new Map<string, number>();
    const lf = new Map<string, number>();

    const projectEnd = Math.max(...Array.from(ef.values()));
    const reverseTopoSort = [...topoSort].reverse();

    for (const taskId of reverseTopoSort) {
      const task = taskMap.get(taskId)!;
      const succs = successors.get(taskId) || [];
      const latestFinish = succs.length > 0
        ? Math.min(...succs.map(s => ls.get(s) || projectEnd))
        : projectEnd;
      lf.set(taskId, latestFinish);
      ls.set(taskId, latestFinish - task.durationDays);
    }

    // Critical path = tasks where total float is 0
    const criticalIds: string[] = [];
    for (const taskId of topoSort) {
      const totalFloat = (ls.get(taskId) || 0) - (es.get(taskId) || 0);
      if (Math.abs(totalFloat) < 0.5) {
        criticalIds.push(taskId);
      }
    }

    return criticalIds;
  }

  private topologicalSort(
    tasks: ScheduleActivity[],
    predecessors: Map<string, string[]>
  ): string[] {
    const result: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (taskId: string) => {
      if (visited.has(taskId)) return;
      if (visiting.has(taskId)) return; // Cycle detected, skip
      visiting.add(taskId);
      const preds = predecessors.get(taskId) || [];
      preds.forEach(p => visit(p));
      visiting.delete(taskId);
      visited.add(taskId);
      result.push(taskId);
    };

    tasks.forEach(task => visit(task.id));
    return result;
  }

  // ─────────────────────────────────────────────────────────────────
  // SUMMARY COMPUTATION
  // ─────────────────────────────────────────────────────────────────

  calculateScheduleSummary(activities: ScheduleActivity[]): ScheduleSummary {
    const milestones = activities.filter(a => a.activityType === 'milestone');
    const tasks = activities.filter(a => a.activityType !== 'phase');
    const criticalPath = this.calculateCriticalPath(activities);

    // Find next upcoming milestone
    const upcomingMilestones = milestones
      .filter(m => m.status !== 'completed' && m.status !== 'cancelled')
      .sort((a, b) => new Date(a.plannedEndDate).getTime() - new Date(b.plannedEndDate).getTime());

    const nextMilestone = upcomingMilestones[0];

    // Calculate weighted progress (by duration)
    const totalDuration = tasks.reduce((sum, t) => sum + t.durationDays, 0);
    const weightedProgress = totalDuration > 0
      ? tasks.reduce((sum, t) => sum + (t.percentComplete * t.durationDays), 0) / totalDuration
      : 0;

    // Critical path length
    const criticalActivities = activities.filter(a => criticalPath.includes(a.id));
    const criticalPathLength = criticalActivities.reduce((sum, a) => sum + a.durationDays, 0);

    return {
      totalActivities: activities.length,
      completedActivities: activities.filter(a => a.status === 'completed').length,
      inProgressActivities: activities.filter(a => a.status === 'in_progress').length,
      delayedActivities: activities.filter(a => a.status === 'delayed').length,
      milestoneCount: milestones.length,
      completedMilestones: milestones.filter(m => m.status === 'completed').length,
      nextMilestone: nextMilestone ? {
        id: nextMilestone.id,
        name: nextMilestone.name,
        dueDate: new Date(nextMilestone.plannedEndDate),
        status: nextMilestone.status,
      } : undefined,
      criticalPathLength,
      overallProgress: Math.round(weightedProgress),
    };
  }
}
