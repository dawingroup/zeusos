// ============================================================================
// DEVELOPMENT PLAN SERVICE
// DawinOS v2.0 - HR Performance Module
// Firebase service for employee development plan management
// ============================================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import type {
  DevelopmentPlan,
  DevelopmentGoal,
  ProficiencyLevel,
} from '../types/development.types';

// ============================================================================
// DEVELOPMENT PLAN CRUD
// ============================================================================

/**
 * Create a development plan for an employee
 */
export async function createDevelopmentPlan(
  companyId: string,
  employeeId: string,
  input: Omit<DevelopmentPlan, 'id' | 'companyId' | 'employeeId' | 'createdAt' | 'updatedAt' | 'overallProgress'>,
  createdBy: string
): Promise<DevelopmentPlan> {
  const planData = {
    ...input,
    companyId,
    employeeId,
    overallProgress: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy,
  };

  const docRef = await addDoc(collection(db, 'development_plans'), planData);
  const docSnap = await getDoc(docRef);

  return {
    id: docRef.id,
    ...docSnap.data(),
  } as DevelopmentPlan;
}

/**
 * Get development plans for an employee
 */
export async function getDevelopmentPlans(
  companyId: string,
  employeeId: string,
  planYear?: number
): Promise<DevelopmentPlan[]> {
  let q = query(
    collection(db, 'development_plans'),
    where('companyId', '==', companyId),
    where('employeeId', '==', employeeId),
    orderBy('planYear', 'desc')
  );

  if (planYear) {
    q = query(q, where('planYear', '==', planYear));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as DevelopmentPlan[];
}

/**
 * Get a single development plan
 */
export async function getDevelopmentPlan(planId: string): Promise<DevelopmentPlan> {
  const docRef = doc(db, 'development_plans', planId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error('Development plan not found');
  }

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as DevelopmentPlan;
}

/**
 * Update a development plan
 */
export async function updateDevelopmentPlan(
  planId: string,
  updates: Partial<Omit<DevelopmentPlan, 'id' | 'companyId' | 'employeeId' | 'createdAt'>>,
  updatedBy: string
): Promise<void> {
  const docRef = doc(db, 'development_plans', planId);

  // Calculate overall progress if goals are updated
  let overallProgress: number | undefined;
  if (updates.goals) {
    const completedGoals = updates.goals.filter(g => g.status === 'completed').length;
    overallProgress = updates.goals.length > 0
      ? (completedGoals / updates.goals.length) * 100
      : 0;
  }

  await updateDoc(docRef, {
    ...updates,
    ...(overallProgress !== undefined && { overallProgress }),
    updatedAt: serverTimestamp(),
    updatedBy,
  });
}

/**
 * Delete a development plan
 */
export async function deleteDevelopmentPlan(planId: string): Promise<void> {
  const docRef = doc(db, 'development_plans', planId);
  await deleteDoc(docRef);
}

// ============================================================================
// DEVELOPMENT GOALS MANAGEMENT
// ============================================================================

/**
 * Add a goal to a development plan
 */
export async function addDevelopmentGoal(
  planId: string,
  goal: Omit<DevelopmentGoal, 'id' | 'createdAt' | 'updatedAt'>,
  updatedBy: string
): Promise<void> {
  const plan = await getDevelopmentPlan(planId);

  const newGoal: DevelopmentGoal = {
    ...goal,
    id: `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const updatedGoals = [...plan.goals, newGoal];
  const completedGoals = updatedGoals.filter(g => g.status === 'completed').length;
  const overallProgress = updatedGoals.length > 0
    ? (completedGoals / updatedGoals.length) * 100
    : 0;

  await updateDevelopmentPlan(
    planId,
    {
      goals: updatedGoals,
      overallProgress,
    },
    updatedBy
  );
}

/**
 * Update a goal in a development plan
 */
export async function updateDevelopmentGoal(
  planId: string,
  goalId: string,
  updates: Partial<Omit<DevelopmentGoal, 'id' | 'createdAt'>>,
  updatedBy: string
): Promise<void> {
  const plan = await getDevelopmentPlan(planId);

  const updatedGoals = plan.goals.map(g =>
    g.id === goalId
      ? { ...g, ...updates, updatedAt: new Date() }
      : g
  );

  const completedGoals = updatedGoals.filter(g => g.status === 'completed').length;
  const overallProgress = updatedGoals.length > 0
    ? (completedGoals / updatedGoals.length) * 100
    : 0;

  await updateDevelopmentPlan(
    planId,
    {
      goals: updatedGoals,
      overallProgress,
    },
    updatedBy
  );
}

/**
 * Delete a goal from a development plan
 */
export async function deleteDevelopmentGoal(
  planId: string,
  goalId: string,
  updatedBy: string
): Promise<void> {
  const plan = await getDevelopmentPlan(planId);

  const updatedGoals = plan.goals.filter(g => g.id !== goalId);
  const completedGoals = updatedGoals.filter(g => g.status === 'completed').length;
  const overallProgress = updatedGoals.length > 0
    ? (completedGoals / updatedGoals.length) * 100
    : 0;

  await updateDevelopmentPlan(
    planId,
    {
      goals: updatedGoals,
      overallProgress,
    },
    updatedBy
  );
}

// ============================================================================
// SKILL GAP MANAGEMENT
// ============================================================================

/**
 * Add a skill gap to a development plan
 */
export async function addSkillGap(
  planId: string,
  skillGap: {
    competencyId: string;
    competencyName: string;
    currentLevel: ProficiencyLevel;
    targetLevel: ProficiencyLevel;
    priority: 'high' | 'medium' | 'low';
  },
  updatedBy: string
): Promise<void> {
  const plan = await getDevelopmentPlan(planId);

  const updatedSkillGaps = [...plan.skillGaps, skillGap];

  await updateDevelopmentPlan(
    planId,
    { skillGaps: updatedSkillGaps },
    updatedBy
  );
}

/**
 * Update a skill gap in a development plan
 */
export async function updateSkillGap(
  planId: string,
  competencyId: string,
  updates: {
    currentLevel?: ProficiencyLevel;
    targetLevel?: ProficiencyLevel;
    priority?: 'high' | 'medium' | 'low';
  },
  updatedBy: string
): Promise<void> {
  const plan = await getDevelopmentPlan(planId);

  const updatedSkillGaps = plan.skillGaps.map(gap =>
    gap.competencyId === competencyId
      ? { ...gap, ...updates }
      : gap
  );

  await updateDevelopmentPlan(
    planId,
    { skillGaps: updatedSkillGaps },
    updatedBy
  );
}

/**
 * Remove a skill gap from a development plan
 */
export async function removeSkillGap(
  planId: string,
  competencyId: string,
  updatedBy: string
): Promise<void> {
  const plan = await getDevelopmentPlan(planId);

  const updatedSkillGaps = plan.skillGaps.filter(gap => gap.competencyId !== competencyId);

  await updateDevelopmentPlan(
    planId,
    { skillGaps: updatedSkillGaps },
    updatedBy
  );
}

// ============================================================================
// ANALYTICS & REPORTING
// ============================================================================

/**
 * Get development plan statistics for an employee
 */
export async function getDevelopmentPlanStats(
  companyId: string,
  employeeId: string,
  planYear?: number
): Promise<{
  totalPlans: number;
  currentPlan: DevelopmentPlan | null;
  totalGoals: number;
  completedGoals: number;
  inProgressGoals: number;
  notStartedGoals: number;
  overallProgress: number;
  highPriorityGaps: number;
  mediumPriorityGaps: number;
  lowPriorityGaps: number;
}> {
  const plans = await getDevelopmentPlans(companyId, employeeId, planYear);

  const currentYear = planYear || new Date().getFullYear();
  const currentPlan = plans.find(p => p.planYear === currentYear) || null;

  let totalGoals = 0;
  let completedGoals = 0;
  let inProgressGoals = 0;
  let notStartedGoals = 0;
  let totalProgress = 0;

  plans.forEach(plan => {
    totalGoals += plan.goals.length;
    completedGoals += plan.goals.filter(g => g.status === 'completed').length;
    inProgressGoals += plan.goals.filter(g => g.status === 'in_progress').length;
    notStartedGoals += plan.goals.filter(g => g.status === 'not_started').length;
    totalProgress += plan.overallProgress;
  });

  const overallProgress = plans.length > 0 ? totalProgress / plans.length : 0;

  const highPriorityGaps = currentPlan?.skillGaps.filter(g => g.priority === 'high').length || 0;
  const mediumPriorityGaps = currentPlan?.skillGaps.filter(g => g.priority === 'medium').length || 0;
  const lowPriorityGaps = currentPlan?.skillGaps.filter(g => g.priority === 'low').length || 0;

  return {
    totalPlans: plans.length,
    currentPlan,
    totalGoals,
    completedGoals,
    inProgressGoals,
    notStartedGoals,
    overallProgress,
    highPriorityGaps,
    mediumPriorityGaps,
    lowPriorityGaps,
  };
}

/**
 * Get all employees with active development plans
 */
export async function getEmployeesWithDevelopmentPlans(
  companyId: string,
  planYear?: number
): Promise<Array<{ employeeId: string; planId: string; progress: number }>> {
  const currentYear = planYear || new Date().getFullYear();

  const q = query(
    collection(db, 'development_plans'),
    where('companyId', '==', companyId),
    where('planYear', '==', currentYear)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data() as DevelopmentPlan;
    return {
      employeeId: data.employeeId,
      planId: doc.id,
      progress: data.overallProgress,
    };
  });
}
