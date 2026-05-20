/**
 * PROGRESS SERVICE
 * 
 * Progress tracking operations including S-curve and variance analysis.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  orderBy,
  Timestamp,
  serverTimestamp,
  onSnapshot,
  Firestore,
} from 'firebase/firestore';
import {
  PlannedProgress,
  WeeklyProgress,
  ProgressVariance,
  WorkPackageTracker,
  SCurveType,
  calculateWeeksBetween,
  addWeeksToDate,
  getVarianceStatus,
} from '../types/progress-tracking';
import { toJsDate } from '../utils/dates';
import {
  SiteVisit,
  SiteVisitFormData,
} from '../types/site-visit';
import { Project } from '@/subsidiaries/advisory/core/project/types/project.types';

// ─────────────────────────────────────────────────────────────────
// COLLECTION PATHS
// ─────────────────────────────────────────────────────────────────

const PROJECTS_PATH = 'projects';

// ─────────────────────────────────────────────────────────────────
// PROGRESS SERVICE
// ─────────────────────────────────────────────────────────────────

export class ProgressService {
  private static instance: ProgressService;
  private db: Firestore;

  private constructor(db: Firestore) {
    this.db = db;
  }

  static getInstance(db: Firestore): ProgressService {
    if (!ProgressService.instance) {
      ProgressService.instance = new ProgressService(db);
    }
    return ProgressService.instance;
  }

  // ─────────────────────────────────────────────────────────────────
  // S-CURVE GENERATION
  // ─────────────────────────────────────────────────────────────────

  generatePlannedProgress(
    project: Project,
    scurveType: SCurveType = 'linear'
  ): PlannedProgress {
    const startDate = toJsDate(project.timeline.currentStartDate as never) ?? new Date();
    const endDate = toJsDate(project.timeline.currentEndDate as never) ?? new Date();
    const duration = calculateWeeksBetween(startDate, endDate);

    const weeklyProgress: WeeklyProgress[] = [];

    for (let week = 1; week <= duration; week++) {
      const weekStart = addWeeksToDate(startDate, week - 1);
      const percentile = week / duration;

      let plannedCumulative: number;
      switch (scurveType) {
        case 'front_loaded':
          plannedCumulative = 100 * (1 - Math.pow(1 - percentile, 1.5));
          break;
        case 'back_loaded':
          plannedCumulative = 100 * Math.pow(percentile, 1.5);
          break;
        default:
          plannedCumulative = 100 * percentile;
      }

      const previousCumulative = weeklyProgress[week - 2]?.plannedCumulative || 0;

      weeklyProgress.push({
        weekNumber: week,
        weekStartDate: weekStart,
        plannedCumulative: Math.round(plannedCumulative * 100) / 100,
        plannedIncremental: Math.round((plannedCumulative - previousCumulative) * 100) / 100,
      });
    }

    return {
      projectId: project.id,
      baselineDate: startDate,
      milestoneProgress: (project.timeline.milestones?.map(m => ({
        milestoneId: m.id,
        milestoneName: m.name,
        plannedDate: toJsDate(m.plannedDate as never) ?? new Date(),
        plannedProgress: m.paymentPercentage || 0,
        weightPercentage: m.paymentPercentage || 0,
      })) || []) as any,
      weeklyProgress,
      scurveType,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // VARIANCE ANALYSIS
  // ─────────────────────────────────────────────────────────────────

  async calculateVariance(projectId: string): Promise<ProgressVariance> {
    const projectDoc = await getDoc(doc(this.db, PROJECTS_PATH, projectId));
    if (!projectDoc.exists()) {
      throw new Error('Project not found');
    }

    const projectData = { id: projectDoc.id, ...projectDoc.data() } as Project;
    const plannedProgress = this.generatePlannedProgress(projectData);

    const today = new Date();
    const startDate = toJsDate(projectData.timeline.currentStartDate as never) ?? new Date();
    const currentWeek = calculateWeeksBetween(startDate, today);

    // Get planned progress for current week
    const plannedForNow = plannedProgress.weeklyProgress.find(
      w => w.weekNumber === currentWeek
    );
    const plannedPercent = plannedForNow?.plannedCumulative || 0;
    const actualPercent = projectData.progress.physicalProgress;

    // Schedule variance
    const variancePercent = actualPercent - plannedPercent;
    const scheduleVariance = {
      plannedProgress: plannedPercent,
      actualProgress: actualPercent,
      variancePercent,
      varianceDays: Math.round(
        (variancePercent / 100) * projectData.timeline.currentDuration
      ),
      status: getVarianceStatus(variancePercent),
    };

    // Cost variance (Earned Value Analysis)
    const budget = projectData.budget.totalBudget;
    const bcws = budget * (plannedPercent / 100);
    const bcwp = budget * (actualPercent / 100);
    const acwp = projectData.budget.spent;

    const costVariance = {
      plannedCost: bcws,
      earnedValue: bcwp,
      actualCost: acwp,
      costVariance: bcwp - acwp,
      scheduleVariance: bcwp - bcws,
      cpi: acwp > 0 ? bcwp / acwp : 1,
      spi: bcws > 0 ? bcwp / bcws : 1,
    };

    // Forecast
    const eac = costVariance.cpi > 0 ? budget / costVariance.cpi : budget;
    const etc = eac - acwp;

    const remainingDuration = projectData.timeline.daysRemaining;
    const adjustedRemaining =
      costVariance.spi > 0 ? remainingDuration / costVariance.spi : remainingDuration;
    const forecastEnd = this.addDays(today, Math.ceil(adjustedRemaining));

    return {
      projectId,
      analysisDate: today,
      scheduleVariance,
      costVariance,
      forecast: {
        estimateAtCompletion: eac,
        estimateToComplete: etc,
        forecastEndDate: forecastEnd,
        daysSlippage: Math.ceil(adjustedRemaining - remainingDuration),
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // WORK PACKAGE PROGRESS
  // ─────────────────────────────────────────────────────────────────

  async getWorkPackages(projectId: string): Promise<WorkPackageTracker[]> {
    const q = query(
      collection(this.db, `${PROJECTS_PATH}/${projectId}/workPackages`),
      orderBy('category')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    })) as WorkPackageTracker[];
  }

  subscribeToWorkPackages(
    projectId: string,
    callback: (workPackages: WorkPackageTracker[]) => void
  ): () => void {
    const q = query(
      collection(this.db, `${PROJECTS_PATH}/${projectId}/workPackages`),
      orderBy('category')
    );

    return onSnapshot(q, snapshot => {
      const workPackages = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as WorkPackageTracker[];
      callback(workPackages);
    });
  }

  async updateWorkPackageProgress(
    projectId: string,
    workPackageId: string,
    progress: number,
    notes: string,
    userId: string
  ): Promise<void> {
    const wpRef = doc(
      this.db,
      `${PROJECTS_PATH}/${projectId}/workPackages`,
      workPackageId
    );
    const wp = await getDoc(wpRef);

    if (!wp.exists()) {
      throw new Error('Work package not found');
    }

    const wpData = wp.data() as WorkPackageTracker;
    const history = [...(wpData.progressHistory || [])];

    history.push({
      date: new Date(),
      percent: progress,
      notes,
      recordedBy: userId,
    });

    // Determine status
    let status = wpData.status;
    if (progress === 0) status = 'not_started';
    else if (progress === 100) status = 'completed';
    else if (progress > 0) status = 'in_progress';

    await updateDoc(wpRef, {
      percentComplete: progress,
      status,
      progressHistory: history,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    // Recalculate project overall progress
    await this.recalculateProjectProgress(projectId, userId);
  }

  async recalculateProjectProgress(
    projectId: string,
    userId: string
  ): Promise<number> {
    const workPackages = await this.getWorkPackages(projectId);

    if (workPackages.length === 0) return 0;

    const totalProgress = workPackages.reduce(
      (sum, wp) => sum + wp.percentComplete,
      0
    );
    const overallProgress = totalProgress / workPackages.length;

    await updateDoc(doc(this.db, PROJECTS_PATH, projectId), {
      'progress.physicalProgress': Math.round(overallProgress * 100) / 100,
      'progress.lastPhysicalUpdate': serverTimestamp(),
      'progress.physicalUpdateMethod': 'calculated',
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    return overallProgress;
  }

  // ─────────────────────────────────────────────────────────────────
  // SITE VISITS
  // ─────────────────────────────────────────────────────────────────

  async getSiteVisits(projectId: string): Promise<SiteVisit[]> {
    const q = query(
      collection(this.db, `${PROJECTS_PATH}/${projectId}/siteVisits`),
      orderBy('visitDate', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    })) as SiteVisit[];
  }

  subscribeToSiteVisits(
    projectId: string,
    callback: (visits: SiteVisit[]) => void
  ): () => void {
    const q = query(
      collection(this.db, `${PROJECTS_PATH}/${projectId}/siteVisits`),
      orderBy('visitDate', 'desc')
    );

    return onSnapshot(q, snapshot => {
      const visits = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as SiteVisit[];
      callback(visits);
    });
  }

  async createSiteVisit(
    data: SiteVisitFormData,
    userId: string
  ): Promise<string> {
    const visitsRef = collection(
      this.db,
      `${PROJECTS_PATH}/${data.projectId}/siteVisits`
    );

    const docRef = await addDoc(visitsRef, {
      ...data,
      status: 'draft',
      createdAt: Timestamp.now(),
      createdBy: userId,
    });

    return docRef.id;
  }

  async updateSiteVisit(
    projectId: string,
    visitId: string,
    updates: Partial<SiteVisitFormData>,
    userId: string
  ): Promise<void> {
    const visitRef = doc(
      this.db,
      `${PROJECTS_PATH}/${projectId}/siteVisits`,
      visitId
    );

    await updateDoc(visitRef, {
      ...updates,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  }

  async submitSiteVisit(
    projectId: string,
    visitId: string,
    userId: string
  ): Promise<void> {
    const visitRef = doc(
      this.db,
      `${PROJECTS_PATH}/${projectId}/siteVisits`,
      visitId
    );
    const visit = await getDoc(visitRef);

    if (!visit.exists()) {
      throw new Error('Visit not found');
    }

    const visitData = visit.data() as SiteVisit;

    // Update project progress if observation differs
    if (!visitData.progressObservation.agreesWithReported) {
      await updateDoc(doc(this.db, PROJECTS_PATH, projectId), {
        'progress.physicalProgress': visitData.progressObservation.observedProgress,
        'progress.lastPhysicalUpdate': serverTimestamp(),
        'progress.physicalUpdateMethod': 'manual',
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      });
    }

    await updateDoc(visitRef, {
      status: 'submitted',
      submittedAt: Timestamp.now(),
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // ISSUES
  // ─────────────────────────────────────────────────────────────────

  async resolveIssue(
    projectId: string,
    visitId: string,
    issueId: string,
    resolution: string,
    userId: string
  ): Promise<void> {
    const visitRef = doc(
      this.db,
      `${PROJECTS_PATH}/${projectId}/siteVisits`,
      visitId
    );
    const visit = await getDoc(visitRef);

    if (!visit.exists()) {
      throw new Error('Visit not found');
    }

    const visitData = visit.data() as SiteVisit;
    const issueIndex = visitData.issues.findIndex(i => i.id === issueId);

    if (issueIndex === -1) {
      throw new Error('Issue not found');
    }

    const updatedIssues = [...visitData.issues];
    updatedIssues[issueIndex] = {
      ...updatedIssues[issueIndex],
      status: 'resolved',
      resolution,
      resolvedBy: userId,
      resolvedAt: Timestamp.now(),
    };

    await updateDoc(visitRef, {
      issues: updatedIssues,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // ACTION ITEMS
  // ─────────────────────────────────────────────────────────────────

  async completeActionItem(
    projectId: string,
    visitId: string,
    actionItemId: string,
    notes: string,
    _userId: string
  ): Promise<void> {
    const visitRef = doc(
      this.db,
      `${PROJECTS_PATH}/${projectId}/siteVisits`,
      visitId
    );
    const visit = await getDoc(visitRef);

    if (!visit.exists()) {
      throw new Error('Visit not found');
    }

    const visitData = visit.data() as SiteVisit;
    const actionIndex = visitData.actionItems.findIndex(
      a => a.id === actionItemId
    );

    if (actionIndex === -1) {
      throw new Error('Action item not found');
    }

    const updatedActions = [...visitData.actionItems];
    updatedActions[actionIndex] = {
      ...updatedActions[actionIndex],
      status: 'completed',
      completedAt: Timestamp.now(),
      notes,
    };

    await updateDoc(visitRef, {
      actionItems: updatedActions,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}

// Export singleton factory
export function getProgressService(db: Firestore): ProgressService {
  return ProgressService.getInstance(db);
}
