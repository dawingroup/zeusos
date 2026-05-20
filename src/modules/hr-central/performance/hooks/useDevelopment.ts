// ============================================================================
// DEVELOPMENT HOOK
// DawinOS v2.0 - HR Module
// React hook for Development Plans, Competencies, and Training
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  Competency,
  EmployeeCompetency,
  TrainingCourse,
  EmployeeTraining,
  DevelopmentPlan,
  DevelopmentGoal,
  PerformanceMetrics,
  CompetencyCategory,
  ProficiencyLevel,
  TrainingType,
} from '../types/development.types';
import {
  createCompetency,
  getCompetencies,
  getCompetency as _getCompetency,
  updateCompetency,
  deleteCompetency,
  assessEmployeeCompetency,
  getEmployeeCompetencies,
  updateEmployeeCompetency as _updateEmployeeCompetency,
  getCompetencyGaps,
  seedDawinCompetencies,
  hasCompetenciesSeeded as _hasCompetenciesSeeded,
} from '../services/competencyService';
import {
  createTrainingCourse,
  getTrainingCourses,
  getTrainingCourse as _getTrainingCourse,
  updateTrainingCourse,
  deleteTrainingCourse,
  enrollEmployeeInTraining,
  getEmployeeTraining,
  updateTrainingProgress,
  completeTraining,
  cancelTraining,
  getEmployeeTrainingStats,
  getRecommendedTraining,
} from '../services/trainingService';
import {
  createDevelopmentPlan,
  getDevelopmentPlans,
  updateDevelopmentPlan,
  deleteDevelopmentPlan,
  addDevelopmentGoal,
  updateDevelopmentGoal,
  deleteDevelopmentGoal,
  getDevelopmentPlanStats,
} from '../services/developmentPlanService';
import {
  recordPerformanceMetrics,
  getPerformanceMetrics,
  getPerformanceTrends,
} from '../services/performanceMetricsService';
import { useAuth } from '@/core/hooks/useAuth';

interface UseDevelopmentOptions {
  companyId: string;
  employeeId?: string;
  autoLoad?: boolean;
}

interface UseDevelopmentReturn {
  // Competencies
  competencies: Competency[];
  employeeCompetencies: EmployeeCompetency[];
  competencyGaps: Array<{
    competency: Competency;
    assessment: EmployeeCompetency;
    gap: number;
  }>;

  // Training
  trainingCourses: TrainingCourse[];
  employeeTraining: EmployeeTraining[];
  trainingStats: {
    total: number;
    completed: number;
    inProgress: number;
    planned: number;
    completionRate: number;
    totalHoursTrained: number;
    certificationsEarned: number;
  } | null;
  recommendedTraining: TrainingCourse[];

  // Development Plans
  developmentPlans: DevelopmentPlan[];
  currentDevelopmentPlan: DevelopmentPlan | null;
  developmentPlanStats: {
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
  } | null;

  // Performance Metrics
  performanceMetrics: PerformanceMetrics[];
  performanceTrends: {
    periods: Date[];
    overallScores: number[];
    attendanceRates: number[];
    qualityScores: number[];
    productivityScores: number[];
    behavioralScores: number[];
  } | null;

  // State
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;

  // Competency Actions
  loadCompetencies: (filters?: { category?: CompetencyCategory; isActive?: boolean; role?: string }) => Promise<void>;
  createCompetency: (input: Omit<Competency, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>) => Promise<Competency | null>;
  updateCompetency: (competencyId: string, updates: Partial<Omit<Competency, 'id' | 'companyId' | 'createdAt'>>) => Promise<boolean>;
  deleteCompetency: (competencyId: string) => Promise<boolean>;
  seedCompetencies: () => Promise<boolean>;
  assessCompetency: (
    competencyId: string,
    currentLevel: ProficiencyLevel,
    targetLevel: ProficiencyLevel,
    evidence?: string,
    developmentActions?: string[]
  ) => Promise<boolean>;
  loadEmployeeCompetencies: () => Promise<void>;
  loadCompetencyGaps: () => Promise<void>;

  // Training Actions
  loadTrainingCourses: (filters?: { type?: TrainingType; provider?: string; deliveryMethod?: string }) => Promise<void>;
  createTrainingCourse: (input: Omit<TrainingCourse, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>) => Promise<TrainingCourse | null>;
  updateTrainingCourse: (courseId: string, updates: Partial<Omit<TrainingCourse, 'id' | 'companyId' | 'createdAt'>>) => Promise<boolean>;
  deleteTrainingCourse: (courseId: string) => Promise<boolean>;
  enrollInTraining: (courseId: string, plannedStartDate?: Date, plannedEndDate?: Date) => Promise<boolean>;
  updateTrainingProgress: (trainingId: string, progress: number, status?: EmployeeTraining['status']) => Promise<boolean>;
  completeTraining: (trainingId: string, assessmentScore?: number, certified?: boolean) => Promise<boolean>;
  cancelTraining: (trainingId: string, reason?: string) => Promise<boolean>;
  loadEmployeeTraining: () => Promise<void>;
  loadTrainingStats: () => Promise<void>;
  loadRecommendedTraining: () => Promise<void>;

  // Development Plan Actions
  loadDevelopmentPlans: (planYear?: number) => Promise<void>;
  createDevelopmentPlan: (input: Omit<DevelopmentPlan, 'id' | 'companyId' | 'employeeId' | 'createdAt' | 'updatedAt' | 'overallProgress'>) => Promise<DevelopmentPlan | null>;
  updateDevelopmentPlan: (planId: string, updates: Partial<Omit<DevelopmentPlan, 'id' | 'companyId' | 'employeeId' | 'createdAt'>>) => Promise<boolean>;
  deleteDevelopmentPlan: (planId: string) => Promise<boolean>;
  addGoal: (planId: string, goal: Omit<DevelopmentGoal, 'id' | 'createdAt' | 'updatedAt'>) => Promise<boolean>;
  updateGoal: (planId: string, goalId: string, updates: Partial<Omit<DevelopmentGoal, 'id' | 'createdAt'>>) => Promise<boolean>;
  deleteGoal: (planId: string, goalId: string) => Promise<boolean>;
  loadDevelopmentPlanStats: () => Promise<void>;

  // Performance Metrics Actions
  loadPerformanceMetrics: (startDate?: Date, endDate?: Date) => Promise<void>;
  recordMetrics: (
    periodStart: Date,
    periodEnd: Date,
    metrics: Omit<PerformanceMetrics, 'id' | 'companyId' | 'employeeId' | 'periodStart' | 'periodEnd' | 'createdAt' | 'updatedAt'>
  ) => Promise<boolean>;
  loadPerformanceTrends: (numberOfPeriods?: number) => Promise<void>;
}

export const useDevelopment = ({
  companyId,
  employeeId,
  autoLoad = true,
}: UseDevelopmentOptions): UseDevelopmentReturn => {
  const { user } = useAuth();

  // State
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [employeeCompetencies, setEmployeeCompetencies] = useState<EmployeeCompetency[]>([]);
  const [competencyGaps, setCompetencyGaps] = useState<Array<{ competency: Competency; assessment: EmployeeCompetency; gap: number }>>([]);

  const [trainingCourses, setTrainingCourses] = useState<TrainingCourse[]>([]);
  const [employeeTraining, setEmployeeTraining] = useState<EmployeeTraining[]>([]);
  const [trainingStats, setTrainingStats] = useState<any>(null);
  const [recommendedTraining, setRecommendedTraining] = useState<TrainingCourse[]>([]);

  const [developmentPlans, setDevelopmentPlans] = useState<DevelopmentPlan[]>([]);
  const [currentDevelopmentPlan, setCurrentDevelopmentPlan] = useState<DevelopmentPlan | null>(null);
  const [developmentPlanStats, setDevelopmentPlanStats] = useState<any>(null);

  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics[]>([]);
  const [performanceTrends, setPerformanceTrends] = useState<any>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Competency Actions
  const loadCompetenciesFn = useCallback(async (filters = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getCompetencies(companyId, filters);
      setCompetencies(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load competencies');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  const createCompetencyFn = useCallback(async (input: any) => {
    if (!user) return null;
    setIsSubmitting(true);
    setError(null);
    try {
      const competency = await createCompetency(companyId, input, user.uid);
      setCompetencies(prev => [...prev, competency]);
      return competency;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create competency');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [companyId, user]);

  const updateCompetencyFn = useCallback(async (competencyId: string, updates: any) => {
    if (!user) return false;
    setIsSubmitting(true);
    setError(null);
    try {
      await updateCompetency(competencyId, updates, user.uid);
      await loadCompetenciesFn();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update competency');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [user, loadCompetenciesFn]);

  const deleteCompetencyFn = useCallback(async (competencyId: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await deleteCompetency(competencyId);
      setCompetencies(prev => prev.filter(c => c.id !== competencyId));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete competency');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const seedCompetenciesFn = useCallback(async () => {
    if (!user) return false;
    setIsSubmitting(true);
    setError(null);
    try {
      await seedDawinCompetencies(companyId, user.uid);
      // Reload competencies from database to ensure fresh data with proper timestamps
      await loadCompetenciesFn();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to seed competencies');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [companyId, user, loadCompetenciesFn]);

  const assessCompetencyFn = useCallback(async (
    competencyId: string,
    currentLevel: ProficiencyLevel,
    targetLevel: ProficiencyLevel,
    evidence?: string,
    developmentActions?: string[]
  ) => {
    if (!user || !employeeId) return false;
    setIsSubmitting(true);
    setError(null);
    try {
      await assessEmployeeCompetency(companyId, employeeId, competencyId, currentLevel, targetLevel, user.uid, evidence, developmentActions);
      await loadEmployeeCompetenciesFn();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assess competency');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [companyId, employeeId, user]);

  const loadEmployeeCompetenciesFn = useCallback(async () => {
    if (!employeeId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getEmployeeCompetencies(companyId, employeeId);
      setEmployeeCompetencies(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employee competencies');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, employeeId]);

  const loadCompetencyGapsFn = useCallback(async () => {
    if (!employeeId) return;
    setIsLoading(true);
    setError(null);
    try {
      const gaps = await getCompetencyGaps(companyId, employeeId);
      setCompetencyGaps(gaps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load competency gaps');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, employeeId]);

  // Training Actions
  const loadTrainingCoursesFn = useCallback(async (filters = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getTrainingCourses(companyId, filters);
      setTrainingCourses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load training courses');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  const createTrainingCourseFn = useCallback(async (input: any) => {
    if (!user) return null;
    setIsSubmitting(true);
    setError(null);
    try {
      const course = await createTrainingCourse(companyId, input, user.uid);
      setTrainingCourses(prev => [...prev, course]);
      return course;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create training course');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [companyId, user]);

  const updateTrainingCourseFn = useCallback(async (courseId: string, updates: any) => {
    if (!user) return false;
    setIsSubmitting(true);
    setError(null);
    try {
      await updateTrainingCourse(courseId, updates, user.uid);
      await loadTrainingCoursesFn();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update training course');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [user, loadTrainingCoursesFn]);

  const deleteTrainingCourseFn = useCallback(async (courseId: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await deleteTrainingCourse(courseId);
      setTrainingCourses(prev => prev.filter(c => c.id !== courseId));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete training course');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const enrollInTrainingFn = useCallback(async (courseId: string, plannedStartDate?: Date, plannedEndDate?: Date) => {
    if (!user || !employeeId) return false;
    setIsSubmitting(true);
    setError(null);
    try {
      await enrollEmployeeInTraining(companyId, employeeId, courseId, user.uid, plannedStartDate, plannedEndDate);
      await loadEmployeeTrainingFn();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enroll in training');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [companyId, employeeId, user]);

  const updateTrainingProgressFn = useCallback(async (trainingId: string, progress: number, status?: any) => {
    if (!user) return false;
    setIsSubmitting(true);
    setError(null);
    try {
      await updateTrainingProgress(trainingId, progress, status, user.uid);
      await loadEmployeeTrainingFn();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update training progress');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [user]);

  const completeTrainingFn = useCallback(async (trainingId: string, assessmentScore?: number, certified?: boolean) => {
    if (!user) return false;
    setIsSubmitting(true);
    setError(null);
    try {
      await completeTraining(trainingId, assessmentScore, certified, user.uid);
      await loadEmployeeTrainingFn();
      await loadTrainingStatsFn();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete training');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [user]);

  const cancelTrainingFn = useCallback(async (trainingId: string, reason?: string) => {
    if (!user) return false;
    setIsSubmitting(true);
    setError(null);
    try {
      await cancelTraining(trainingId, reason, user.uid);
      await loadEmployeeTrainingFn();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel training');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [user]);

  const loadEmployeeTrainingFn = useCallback(async () => {
    if (!employeeId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getEmployeeTraining(companyId, employeeId);
      setEmployeeTraining(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employee training');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, employeeId]);

  const loadTrainingStatsFn = useCallback(async () => {
    if (!employeeId) return;
    setIsLoading(true);
    setError(null);
    try {
      const stats = await getEmployeeTrainingStats(companyId, employeeId);
      setTrainingStats(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load training stats');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, employeeId]);

  const loadRecommendedTrainingFn = useCallback(async () => {
    if (!employeeId) return;
    setIsLoading(true);
    setError(null);
    try {
      const gaps = await getCompetencyGaps(companyId, employeeId);
      const gapIds = gaps.map(g => g.competency.id);
      const recommended = await getRecommendedTraining(companyId, gapIds);
      setRecommendedTraining(recommended);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recommended training');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, employeeId]);

  // Development Plan Actions
  const loadDevelopmentPlansFn = useCallback(async (planYear?: number) => {
    if (!employeeId) return;
    setIsLoading(true);
    setError(null);
    try {
      const plans = await getDevelopmentPlans(companyId, employeeId, planYear);
      setDevelopmentPlans(plans);
      const currentYear = planYear || new Date().getFullYear();
      const current = plans.find(p => p.planYear === currentYear) || null;
      setCurrentDevelopmentPlan(current);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load development plans');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, employeeId]);

  const createDevelopmentPlanFn = useCallback(async (input: any) => {
    if (!user || !employeeId) return null;
    setIsSubmitting(true);
    setError(null);
    try {
      const plan = await createDevelopmentPlan(companyId, employeeId, input, user.uid);
      setDevelopmentPlans(prev => [...prev, plan]);
      if (plan.planYear === new Date().getFullYear()) {
        setCurrentDevelopmentPlan(plan);
      }
      return plan;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create development plan');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [companyId, employeeId, user]);

  const updateDevelopmentPlanFn = useCallback(async (planId: string, updates: any) => {
    if (!user) return false;
    setIsSubmitting(true);
    setError(null);
    try {
      await updateDevelopmentPlan(planId, updates, user.uid);
      await loadDevelopmentPlansFn();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update development plan');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [user, loadDevelopmentPlansFn]);

  const deleteDevelopmentPlanFn = useCallback(async (planId: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await deleteDevelopmentPlan(planId);
      setDevelopmentPlans(prev => prev.filter(p => p.id !== planId));
      if (currentDevelopmentPlan?.id === planId) {
        setCurrentDevelopmentPlan(null);
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete development plan');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [currentDevelopmentPlan]);

  const addGoalFn = useCallback(async (planId: string, goal: any) => {
    if (!user) return false;
    setIsSubmitting(true);
    setError(null);
    try {
      await addDevelopmentGoal(planId, goal, user.uid);
      await loadDevelopmentPlansFn();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add goal');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [user, loadDevelopmentPlansFn]);

  const updateGoalFn = useCallback(async (planId: string, goalId: string, updates: any) => {
    if (!user) return false;
    setIsSubmitting(true);
    setError(null);
    try {
      await updateDevelopmentGoal(planId, goalId, updates, user.uid);
      await loadDevelopmentPlansFn();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update goal');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [user, loadDevelopmentPlansFn]);

  const deleteGoalFn = useCallback(async (planId: string, goalId: string) => {
    if (!user) return false;
    setIsSubmitting(true);
    setError(null);
    try {
      await deleteDevelopmentGoal(planId, goalId, user.uid);
      await loadDevelopmentPlansFn();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete goal');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [user, loadDevelopmentPlansFn]);

  const loadDevelopmentPlanStatsFn = useCallback(async () => {
    if (!employeeId) return;
    setIsLoading(true);
    setError(null);
    try {
      const stats = await getDevelopmentPlanStats(companyId, employeeId);
      setDevelopmentPlanStats(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load development plan stats');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, employeeId]);

  // Performance Metrics Actions
  const loadPerformanceMetricsFn = useCallback(async (startDate?: Date, endDate?: Date) => {
    if (!employeeId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getPerformanceMetrics(companyId, employeeId, startDate, endDate);
      setPerformanceMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load performance metrics');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, employeeId]);

  const recordMetricsFn = useCallback(async (periodStart: Date, periodEnd: Date, metrics: any) => {
    if (!user || !employeeId) return false;
    setIsSubmitting(true);
    setError(null);
    try {
      await recordPerformanceMetrics(companyId, employeeId, periodStart, periodEnd, metrics, user.uid);
      await loadPerformanceMetricsFn();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record performance metrics');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [companyId, employeeId, user, loadPerformanceMetricsFn]);

  const loadPerformanceTrendsFn = useCallback(async (numberOfPeriods = 6) => {
    if (!employeeId) return;
    setIsLoading(true);
    setError(null);
    try {
      const trends = await getPerformanceTrends(companyId, employeeId, numberOfPeriods);
      setPerformanceTrends(trends);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load performance trends');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, employeeId]);

  // Auto-load
  useEffect(() => {
    if (autoLoad && companyId) {
      loadCompetenciesFn();
      loadTrainingCoursesFn();
      if (employeeId) {
        loadEmployeeCompetenciesFn();
        loadCompetencyGapsFn();
        loadEmployeeTrainingFn();
        loadTrainingStatsFn();
        loadDevelopmentPlansFn();
        loadDevelopmentPlanStatsFn();
        loadPerformanceMetricsFn();
        loadRecommendedTrainingFn();
      }
    }
  }, [autoLoad, companyId, employeeId]);

  return {
    competencies,
    employeeCompetencies,
    competencyGaps,
    trainingCourses,
    employeeTraining,
    trainingStats,
    recommendedTraining,
    developmentPlans,
    currentDevelopmentPlan,
    developmentPlanStats,
    performanceMetrics,
    performanceTrends,
    isLoading,
    isSubmitting,
    error,
    loadCompetencies: loadCompetenciesFn,
    createCompetency: createCompetencyFn,
    updateCompetency: updateCompetencyFn,
    deleteCompetency: deleteCompetencyFn,
    seedCompetencies: seedCompetenciesFn,
    assessCompetency: assessCompetencyFn,
    loadEmployeeCompetencies: loadEmployeeCompetenciesFn,
    loadCompetencyGaps: loadCompetencyGapsFn,
    loadTrainingCourses: loadTrainingCoursesFn,
    createTrainingCourse: createTrainingCourseFn,
    updateTrainingCourse: updateTrainingCourseFn,
    deleteTrainingCourse: deleteTrainingCourseFn,
    enrollInTraining: enrollInTrainingFn,
    updateTrainingProgress: updateTrainingProgressFn,
    completeTraining: completeTrainingFn,
    cancelTraining: cancelTrainingFn,
    loadEmployeeTraining: loadEmployeeTrainingFn,
    loadTrainingStats: loadTrainingStatsFn,
    loadRecommendedTraining: loadRecommendedTrainingFn,
    loadDevelopmentPlans: loadDevelopmentPlansFn,
    createDevelopmentPlan: createDevelopmentPlanFn,
    updateDevelopmentPlan: updateDevelopmentPlanFn,
    deleteDevelopmentPlan: deleteDevelopmentPlanFn,
    addGoal: addGoalFn,
    updateGoal: updateGoalFn,
    deleteGoal: deleteGoalFn,
    loadDevelopmentPlanStats: loadDevelopmentPlanStatsFn,
    loadPerformanceMetrics: loadPerformanceMetricsFn,
    recordMetrics: recordMetricsFn,
    loadPerformanceTrends: loadPerformanceTrendsFn,
  };
};
