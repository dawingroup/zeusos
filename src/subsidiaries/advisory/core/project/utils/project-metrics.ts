/**
 * Project Metrics Computation Utilities
 * Computes derived fields for project budget, progress, and timeline
 */

import { differenceInDays } from 'date-fns';
import type { ProjectBudget, ProjectProgress, ProjectTimeline } from '../types/project.types';

/**
 * Compute budget metrics
 */
export function computeBudgetMetrics(budget: Partial<ProjectBudget>): ProjectBudget {
  const totalBudget = budget.totalBudget || 0;
  const spent = budget.spent || 0;
  const committed = budget.committed || 0;

  // Remaining = total - spent - committed
  const remaining = Math.max(0, totalBudget - spent - committed);

  // Variance = planned (totalBudget) - actual (spent + committed)
  const variance = totalBudget - (spent + committed);

  // Variance status
  const variancePercent = totalBudget > 0 ? (variance / totalBudget) * 100 : 0;
  let varianceStatus: 'on_track' | 'over' | 'under';
  if (variancePercent < -5) {
    varianceStatus = 'over'; // Over budget by more than 5%
  } else if (variancePercent > 5) {
    varianceStatus = 'under'; // Under budget by more than 5%
  } else {
    varianceStatus = 'on_track'; // Within 5% variance
  }

  return {
    currency: budget.currency || 'UGX',
    totalBudget,
    spent,
    committed,
    remaining,
    variance,
    varianceStatus,
    contingencyPercent: budget.contingencyPercent || 0,
  };
}

/**
 * Compute progress status based on physical vs financial progress
 */
export function computeProgressStatus(
  physicalProgress: number,
  financialProgress: number
): 'ahead' | 'on_track' | 'behind' | 'critical' {
  const variance = physicalProgress - financialProgress;

  if (variance > 10) {
    return 'ahead'; // Physical ahead of financial by >10%
  } else if (variance < -10) {
    return 'behind'; // Physical behind financial by >10%
  } else if (variance < -20) {
    return 'critical'; // Physical behind financial by >20%
  } else {
    return 'on_track'; // Within 10% variance
  }
}

/**
 * Compute timeline metrics
 */
export function computeTimelineMetrics(timeline: Partial<ProjectTimeline>): ProjectTimeline {
  const currentStartDate = timeline.currentStartDate || new Date();
  const currentEndDate = timeline.currentEndDate || new Date();
  const today = new Date();

  // Current duration in days
  const currentDuration = Math.max(0, differenceInDays(currentEndDate, currentStartDate));

  // Days remaining
  const daysRemaining = Math.max(0, differenceInDays(currentEndDate, today));

  // Percent time elapsed
  const totalDays = currentDuration > 0 ? currentDuration : 1;
  const elapsedDays = Math.max(0, differenceInDays(today, currentStartDate));
  const percentTimeElapsed = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));

  // Delay calculation
  const plannedEndDate = timeline.plannedEndDate || currentEndDate;
  const delayDays = Math.max(0, differenceInDays(currentEndDate, plannedEndDate));
  const isDelayed = delayDays > 0;

  return {
    plannedStartDate: timeline.plannedStartDate || currentStartDate,
    plannedEndDate: timeline.plannedEndDate || currentEndDate,
    currentStartDate,
    currentEndDate,
    actualStartDate: timeline.actualStartDate,
    actualEndDate: timeline.actualEndDate,
    isDelayed,
    daysRemaining,
    currentDuration,
    percentTimeElapsed: Math.round(percentTimeElapsed),
    delayDays,
  };
}

/**
 * Compute full progress metrics including status
 */
export function computeProgressMetrics(progress: Partial<ProjectProgress>): ProjectProgress {
  const physicalProgress = progress.physicalProgress || 0;
  const financialProgress = progress.financialProgress || 0;
  const completionPercent = progress.completionPercent || 0;

  const progressStatus = computeProgressStatus(physicalProgress, financialProgress);

  return {
    physicalProgress,
    financialProgress,
    completionPercent,
    progressStatus,
  };
}

/**
 * Aggregate committed amounts from requisitions and accountability
 * This would typically be called from a service that queries subcollections
 */
export async function aggregateCommittedBudget(
  projectId: string,
  db: any // Firestore instance
): Promise<number> {
  let total = 0;

  try {
    const { collection, query, where, getDocs } = await import('firebase/firestore');

    // Sum approved requisitions
    const reqQuery = query(
      collection(db, `campaigns/${projectId}/requisitions`),
      where('status', '==', 'approved')
    );
    const reqSnapshot = await getDocs(reqQuery);
    reqSnapshot.forEach((d) => {
      const data = d.data();
      total += data.grossAmount || data.amountRequested || 0;
    });

    // Subtract returned amounts from accountability records
    const accQuery = query(
      collection(db, `campaigns/${projectId}/accountability`),
      where('status', '==', 'approved')
    );
    const accSnapshot = await getDocs(accQuery);
    accSnapshot.forEach((d) => {
      const data = d.data();
      total -= data.unspentReturned || 0;
    });
  } catch (error) {
    console.error('Failed to aggregate committed budget:', projectId, error);
  }

  return Math.max(0, total);
}
