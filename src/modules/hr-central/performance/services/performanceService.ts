// ============================================================================
// PERFORMANCE SERVICE
// DawinOS v2.0 - HR Module
// Service functions for Performance Management
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
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import {
  PerformanceReview,
  PerformanceGoal,
  Feedback,
  PerformanceImprovementPlan,
  PerformanceReviewFilters,
  GoalFilters,
  GoalUpdate,
} from '../types/performance.types';
import {
  PERFORMANCE_REVIEWS_COLLECTION,
  PERFORMANCE_GOALS_COLLECTION,
  FEEDBACK_COLLECTION,
  PIP_COLLECTION,
  REVIEW_STATUS,
  GOAL_STATUS,
  REVIEW_TEMPLATE_CONFIG,
} from '../constants/performance.constants';
import {
  PerformanceReviewInput,
  PerformanceGoalInput,
  FeedbackInput,
  PIPInput,
  SelfAssessmentInput,
  ManagerAssessmentInput,
  GoalUpdateInput,
} from '../schemas/performance.schemas';

// ----------------------------------------------------------------------------
// PERFORMANCE REVIEWS
// ----------------------------------------------------------------------------

export const createPerformanceReview = async (
  companyId: string,
  input: PerformanceReviewInput,
  employeeData: { name: string; position: string; departmentId: string; departmentName: string },
  managerData: { name: string },
  userId: string
): Promise<PerformanceReview> => {
  const collectionRef = collection(db, PERFORMANCE_REVIEWS_COLLECTION);
  
  const templateConfig = REVIEW_TEMPLATE_CONFIG[input.reviewTemplate];
  
  const review: Omit<PerformanceReview, 'id'> = {
    companyId,
    employeeId: input.employeeId,
    employeeName: employeeData.name,
    employeePosition: employeeData.position,
    departmentId: employeeData.departmentId,
    departmentName: employeeData.departmentName,
    managerId: input.managerId,
    managerName: managerData.name,
    reviewCycle: input.reviewCycle,
    reviewTemplate: input.reviewTemplate,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    dueDate: input.dueDate,
    status: REVIEW_STATUS.DRAFT,
    currentStep: 0,
    totalSteps: templateConfig.sections.length + 2,
    ratingScale: input.ratingScale,
    employeeAcknowledged: false,
    createdBy: userId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(collectionRef, review);
  
  return { id: docRef.id, ...review };
};

export const getPerformanceReview = async (reviewId: string): Promise<PerformanceReview | null> => {
  const docRef = doc(db, PERFORMANCE_REVIEWS_COLLECTION, reviewId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    periodStart: data.periodStart?.toDate?.() || data.periodStart,
    periodEnd: data.periodEnd?.toDate?.() || data.periodEnd,
    dueDate: data.dueDate?.toDate?.() || data.dueDate,
  } as PerformanceReview;
};

export const getPerformanceReviews = async (
  companyId: string,
  filters: PerformanceReviewFilters = {}
): Promise<PerformanceReview[]> => {
  let q = query(
    collection(db, PERFORMANCE_REVIEWS_COLLECTION),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc')
  );
  
  if (filters.employeeId) {
    q = query(q, where('employeeId', '==', filters.employeeId));
  }
  
  if (filters.managerId) {
    q = query(q, where('managerId', '==', filters.managerId));
  }
  
  if (filters.departmentId) {
    q = query(q, where('departmentId', '==', filters.departmentId));
  }
  
  if (filters.status) {
    q = query(q, where('status', '==', filters.status));
  }
  
  if (filters.reviewCycle) {
    q = query(q, where('reviewCycle', '==', filters.reviewCycle));
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      periodStart: data.periodStart?.toDate?.() || data.periodStart,
      periodEnd: data.periodEnd?.toDate?.() || data.periodEnd,
      dueDate: data.dueDate?.toDate?.() || data.dueDate,
    } as PerformanceReview;
  });
};

export const startSelfAssessment = async (reviewId: string): Promise<void> => {
  const docRef = doc(db, PERFORMANCE_REVIEWS_COLLECTION, reviewId);
  
  await updateDoc(docRef, {
    status: REVIEW_STATUS.SELF_ASSESSMENT,
    currentStep: 1,
    updatedAt: Timestamp.now(),
  });
};

export const submitSelfAssessment = async (
  reviewId: string,
  input: SelfAssessmentInput
): Promise<void> => {
  const review = await getPerformanceReview(reviewId);
  if (!review) throw new Error('Review not found');
  
  const goalsWithRatings = input.goalsAssessment;
  const totalWeight = goalsWithRatings.reduce((sum, g) => {
    const goal = review.goalsAssessment?.goals.find(pg => pg.goalId === g.goalId);
    return sum + (goal?.weight || 100);
  }, 0);
  
  const weightedSelfRating = goalsWithRatings.reduce((sum, g) => {
    const goal = review.goalsAssessment?.goals.find(pg => pg.goalId === g.goalId);
    const weight = goal?.weight || 100;
    return sum + (g.selfRating * weight);
  }, 0) / (totalWeight || 1);
  
  const docRef = doc(db, PERFORMANCE_REVIEWS_COLLECTION, reviewId);
  
  await updateDoc(docRef, {
    status: REVIEW_STATUS.MANAGER_REVIEW,
    selfRating: weightedSelfRating,
    'goalsAssessment.goals': input.goalsAssessment.map(g => ({
      ...review.goalsAssessment?.goals.find(pg => pg.goalId === g.goalId),
      selfRating: g.selfRating,
      achievementPercent: g.achievementPercent,
      employeeComments: g.comments,
    })),
    'competencyAssessment.competencies': input.competencyAssessment.map(c => ({
      ...review.competencyAssessment?.competencies.find(pc => pc.competencyId === c.competencyId),
      selfRating: c.selfRating,
      evidence: c.evidence,
    })),
    'achievementsSection.keyAchievements': input.achievements,
    employeeComments: input.employeeComments,
    currentStep: 2,
    updatedAt: Timestamp.now(),
  });
};

export const submitManagerAssessment = async (
  reviewId: string,
  input: ManagerAssessmentInput
): Promise<void> => {
  const review = await getPerformanceReview(reviewId);
  if (!review) throw new Error('Review not found');
  
  const totalWeight = input.goalsAssessment.reduce((sum, g) => {
    const goal = review.goalsAssessment?.goals.find(pg => pg.goalId === g.goalId);
    return sum + (goal?.weight || 100);
  }, 0);
  
  const weightedManagerRating = input.goalsAssessment.reduce((sum, g) => {
    const goal = review.goalsAssessment?.goals.find(pg => pg.goalId === g.goalId);
    const weight = goal?.weight || 100;
    return sum + (g.managerRating * weight);
  }, 0) / (totalWeight || 1);
  
  const docRef = doc(db, PERFORMANCE_REVIEWS_COLLECTION, reviewId);
  
  await updateDoc(docRef, {
    status: REVIEW_STATUS.ACKNOWLEDGEMENT,
    managerRating: weightedManagerRating,
    finalRating: input.overallRating,
    'goalsAssessment.goals': input.goalsAssessment.map(g => ({
      ...review.goalsAssessment?.goals.find(pg => pg.goalId === g.goalId),
      managerRating: g.managerRating,
      achievementPercent: g.achievementPercent,
      managerComments: g.comments,
      finalRating: g.managerRating,
    })),
    'competencyAssessment.competencies': input.competencyAssessment.map(c => ({
      ...review.competencyAssessment?.competencies.find(pc => pc.competencyId === c.competencyId),
      managerRating: c.managerRating,
      finalRating: c.managerRating,
      developmentSuggestions: c.developmentSuggestions,
    })),
    'developmentSection.strengthsIdentified': input.strengths,
    'developmentSection.areasForImprovement': input.developmentAreas,
    'overallSection.performanceSummary': input.performanceSummary,
    'overallSection.potentialAssessment': input.potentialAssessment,
    'overallSection.readinessForPromotion': input.readinessForPromotion,
    'overallSection.retentionRisk': input.retentionRisk,
    'overallSection.compensationRecommendation': input.compensationRecommendation,
    managerComments: input.managerComments,
    currentStep: 3,
    updatedAt: Timestamp.now(),
  });
};

export const acknowledgeReview = async (
  reviewId: string,
  disagreement?: string
): Promise<void> => {
  const docRef = doc(db, PERFORMANCE_REVIEWS_COLLECTION, reviewId);
  
  await updateDoc(docRef, {
    status: REVIEW_STATUS.COMPLETED,
    employeeAcknowledged: true,
    employeeAcknowledgedAt: Timestamp.now(),
    employeeDisagreement: disagreement,
    completedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
};

// ----------------------------------------------------------------------------
// PERFORMANCE GOALS
// ----------------------------------------------------------------------------

export const createPerformanceGoal = async (
  companyId: string,
  employeeId: string,
  input: PerformanceGoalInput,
  userId: string
): Promise<PerformanceGoal> => {
  const collectionRef = collection(db, PERFORMANCE_GOALS_COLLECTION);
  
  const goal: Omit<PerformanceGoal, 'id'> = {
    companyId,
    employeeId,
    ...input,
    milestones: input.milestones?.map((m, i) => ({
      id: `milestone_${i}`,
      ...m,
      completedDate: undefined,
      isCompleted: false,
    })),
    currentValue: 0,
    status: GOAL_STATUS.NOT_STARTED,
    progress: 0,
    updates: [],
    createdBy: userId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(collectionRef, goal);
  
  return { id: docRef.id, ...goal };
};

export const getPerformanceGoal = async (goalId: string): Promise<PerformanceGoal | null> => {
  const docRef = doc(db, PERFORMANCE_GOALS_COLLECTION, goalId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    startDate: data.startDate?.toDate?.() || data.startDate,
    dueDate: data.dueDate?.toDate?.() || data.dueDate,
    completedDate: data.completedDate?.toDate?.() || data.completedDate,
  } as PerformanceGoal;
};

export const getPerformanceGoals = async (
  companyId: string,
  filters: GoalFilters = {}
): Promise<PerformanceGoal[]> => {
  let q = query(
    collection(db, PERFORMANCE_GOALS_COLLECTION),
    where('companyId', '==', companyId),
    orderBy('dueDate', 'asc')
  );
  
  if (filters.employeeId) {
    q = query(q, where('employeeId', '==', filters.employeeId));
  }
  
  if (filters.status) {
    q = query(q, where('status', '==', filters.status));
  }
  
  if (filters.type) {
    q = query(q, where('type', '==', filters.type));
  }
  
  const snapshot = await getDocs(q);
  let goals = snapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      startDate: data.startDate?.toDate?.() || data.startDate,
      dueDate: data.dueDate?.toDate?.() || data.dueDate,
      completedDate: data.completedDate?.toDate?.() || data.completedDate,
    } as PerformanceGoal;
  });
  
  if (filters.dueAfter) {
    goals = goals.filter(g => g.dueDate >= filters.dueAfter!);
  }
  
  if (filters.dueBefore) {
    goals = goals.filter(g => g.dueDate <= filters.dueBefore!);
  }
  
  return goals;
};

export const updateGoalProgress = async (
  goalId: string,
  input: GoalUpdateInput,
  userId: string
): Promise<void> => {
  const goal = await getPerformanceGoal(goalId);
  if (!goal) throw new Error('Goal not found');
  
  const update: GoalUpdate = {
    id: `update_${Date.now()}`,
    date: new Date(),
    progress: input.progress,
    status: input.status,
    notes: input.notes,
    updatedBy: userId,
  };
  
  const docRef = doc(db, PERFORMANCE_GOALS_COLLECTION, goalId);
  
  await updateDoc(docRef, {
    status: input.status,
    progress: input.progress,
    currentValue: input.currentValue || goal.currentValue,
    updates: [...goal.updates, update],
    completedDate: input.status === GOAL_STATUS.COMPLETED || input.status === GOAL_STATUS.EXCEEDED
      ? new Date() : goal.completedDate,
    updatedAt: Timestamp.now(),
  });
};

export const deletePerformanceGoal = async (goalId: string): Promise<void> => {
  const docRef = doc(db, PERFORMANCE_GOALS_COLLECTION, goalId);
  await deleteDoc(docRef);
};

// ----------------------------------------------------------------------------
// FEEDBACK
// ----------------------------------------------------------------------------

export const createFeedback = async (
  companyId: string,
  input: FeedbackInput,
  sourceData: { id: string; name: string } | null,
  targetData: { name: string },
  _userId: string
): Promise<Feedback> => {
  const collectionRef = collection(db, FEEDBACK_COLLECTION);
  
  const feedback: Omit<Feedback, 'id'> = {
    companyId,
    targetEmployeeId: input.targetEmployeeId,
    targetEmployeeName: targetData.name,
    feedbackType: input.feedbackType,
    sourceEmployeeId: input.isAnonymous ? undefined : sourceData?.id,
    sourceEmployeeName: input.isAnonymous ? undefined : sourceData?.name,
    isAnonymous: input.isAnonymous,
    reviewId: input.reviewId,
    context: input.context,
    ratings: input.ratings,
    strengths: input.strengths,
    areasForImprovement: input.areasForImprovement,
    comments: input.comments,
    status: 'submitted',
    submittedAt: Timestamp.now(),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(collectionRef, feedback);
  
  return { id: docRef.id, ...feedback };
};

export const getFeedbackForEmployee = async (
  companyId: string,
  employeeId: string
): Promise<Feedback[]> => {
  const q = query(
    collection(db, FEEDBACK_COLLECTION),
    where('companyId', '==', companyId),
    where('targetEmployeeId', '==', employeeId),
    where('status', '==', 'submitted'),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })) as Feedback[];
};

// ----------------------------------------------------------------------------
// PERFORMANCE IMPROVEMENT PLAN
// ----------------------------------------------------------------------------

export const createPIP = async (
  companyId: string,
  input: PIPInput,
  employeeData: { name: string; departmentId: string },
  managerData: { name: string },
  hrData: { name: string },
  userId: string
): Promise<PerformanceImprovementPlan> => {
  const collectionRef = collection(db, PIP_COLLECTION);
  
  const endDate = new Date(input.startDate);
  endDate.setDate(endDate.getDate() + input.durationDays);
  
  const pip: Omit<PerformanceImprovementPlan, 'id'> = {
    companyId,
    employeeId: input.employeeId,
    employeeName: employeeData.name,
    departmentId: employeeData.departmentId,
    managerId: input.managerId,
    managerName: managerData.name,
    hrRepId: input.hrRepId,
    hrRepName: hrData.name,
    reason: input.reason,
    performanceGaps: input.performanceGaps.map((g, i) => ({
      id: `gap_${i}`,
      ...g,
    })),
    objectives: input.objectives.map((o, i) => ({
      id: `obj_${i}`,
      ...o,
      status: 'pending',
      progress: 0,
    })),
    supportProvided: input.supportProvided,
    startDate: input.startDate,
    endDate,
    durationDays: input.durationDays,
    checkIns: [],
    status: 'draft',
    createdBy: userId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(collectionRef, pip);
  
  return { id: docRef.id, ...pip };
};

export const getPIP = async (pipId: string): Promise<PerformanceImprovementPlan | null> => {
  const docRef = doc(db, PIP_COLLECTION, pipId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    startDate: data.startDate?.toDate?.() || data.startDate,
    endDate: data.endDate?.toDate?.() || data.endDate,
  } as PerformanceImprovementPlan;
};

export const getEmployeePIPs = async (
  companyId: string,
  employeeId: string
): Promise<PerformanceImprovementPlan[]> => {
  const q = query(
    collection(db, PIP_COLLECTION),
    where('companyId', '==', companyId),
    where('employeeId', '==', employeeId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      startDate: data.startDate?.toDate?.() || data.startDate,
      endDate: data.endDate?.toDate?.() || data.endDate,
    } as PerformanceImprovementPlan;
  });
};

export const activatePIP = async (pipId: string): Promise<void> => {
  const docRef = doc(db, PIP_COLLECTION, pipId);
  
  await updateDoc(docRef, {
    status: 'active',
    updatedAt: Timestamp.now(),
  });
};

export const completePIP = async (
  pipId: string,
  outcome: PerformanceImprovementPlan['outcome']
): Promise<void> => {
  const docRef = doc(db, PIP_COLLECTION, pipId);
  
  const status = outcome === 'improvement_shown' ? 'completed_success' : 
                 outcome === 'extended' ? 'extended' : 'completed_fail';
  
  await updateDoc(docRef, {
    status,
    outcome,
    completedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
};

// ----------------------------------------------------------------------------
// ANALYTICS
// ----------------------------------------------------------------------------

export const getPerformanceAnalytics = async (
  companyId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<{
  totalReviews: number;
  completedReviews: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
  departmentAverages: Record<string, number>;
  topPerformers: Array<{ employeeId: string; name: string; rating: number }>;
  needsImprovement: Array<{ employeeId: string; name: string; rating: number }>;
}> => {
  const reviews = await getPerformanceReviews(companyId, {
    status: REVIEW_STATUS.COMPLETED,
    periodStart,
    periodEnd,
  });
  
  const completedReviews = reviews.filter(r => r.status === REVIEW_STATUS.COMPLETED);
  const ratings = completedReviews
    .map(r => r.finalRating)
    .filter((r): r is number => r !== undefined);
  
  const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  ratings.forEach(r => {
    const rounded = Math.round(r);
    ratingDistribution[rounded] = (ratingDistribution[rounded] || 0) + 1;
  });
  
  const deptTotals = new Map<string, { sum: number; count: number; name: string }>();
  completedReviews.forEach(r => {
    if (r.finalRating) {
      const existing = deptTotals.get(r.departmentId) || { sum: 0, count: 0, name: r.departmentName };
      existing.sum += r.finalRating;
      existing.count++;
      deptTotals.set(r.departmentId, existing);
    }
  });
  
  const departmentAverages: Record<string, number> = {};
  deptTotals.forEach((v) => {
    departmentAverages[v.name] = v.sum / v.count;
  });
  
  const sortedByRating = [...completedReviews]
    .filter(r => r.finalRating)
    .sort((a, b) => (b.finalRating || 0) - (a.finalRating || 0));
  
  return {
    totalReviews: reviews.length,
    completedReviews: completedReviews.length,
    averageRating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
    ratingDistribution,
    departmentAverages,
    topPerformers: sortedByRating.slice(0, 10).map(r => ({
      employeeId: r.employeeId,
      name: r.employeeName,
      rating: r.finalRating!,
    })),
    needsImprovement: sortedByRating.slice(-5).reverse().map(r => ({
      employeeId: r.employeeId,
      name: r.employeeName,
      rating: r.finalRating!,
    })),
  };
};
