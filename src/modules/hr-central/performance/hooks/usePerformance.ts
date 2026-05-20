// ============================================================================
// PERFORMANCE HOOK
// DawinOS v2.0 - HR Module
// React hook for Performance Management
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  PerformanceReview,
  PerformanceGoal,
  Feedback,
  PerformanceReviewFilters,
  GoalFilters,
} from '../types/performance.types';
import {
  PerformanceReviewInput,
  PerformanceGoalInput,
  FeedbackInput,
  SelfAssessmentInput,
  ManagerAssessmentInput,
  GoalUpdateInput,
} from '../schemas/performance.schemas';
import {
  createPerformanceReview,
  getPerformanceReview,
  getPerformanceReviews,
  startSelfAssessment,
  submitSelfAssessment,
  submitManagerAssessment,
  acknowledgeReview,
  createPerformanceGoal,
  getPerformanceGoals,
  updateGoalProgress,
  deletePerformanceGoal,
  createFeedback,
  getFeedbackForEmployee,
  getPerformanceAnalytics,
} from '../services/performanceService';
import { useAuth } from '@/core/hooks/useAuth';

interface UsePerformanceOptions {
  companyId: string;
  employeeId?: string;
  autoLoad?: boolean;
}

interface PerformanceAnalytics {
  totalReviews: number;
  completedReviews: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
  departmentAverages: Record<string, number>;
  topPerformers: Array<{ employeeId: string; name: string; rating: number }>;
  needsImprovement: Array<{ employeeId: string; name: string; rating: number }>;
}

interface UsePerformanceReturn {
  // Reviews
  reviews: PerformanceReview[];
  currentReview: PerformanceReview | null;
  
  // Goals
  goals: PerformanceGoal[];
  
  // Feedback
  feedback: Feedback[];
  
  // Analytics
  analytics: PerformanceAnalytics | null;
  
  // State
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  
  // Review actions
  loadReviews: (filters?: PerformanceReviewFilters) => Promise<void>;
  loadReview: (id: string) => Promise<void>;
  createReview: (
    input: PerformanceReviewInput,
    employeeData: { name: string; position: string; departmentId: string; departmentName: string },
    managerData: { name: string }
  ) => Promise<PerformanceReview | null>;
  startSelfAssessment: (reviewId: string) => Promise<boolean>;
  submitSelfAssessment: (reviewId: string, input: SelfAssessmentInput) => Promise<boolean>;
  submitManagerAssessment: (reviewId: string, input: ManagerAssessmentInput) => Promise<boolean>;
  acknowledgeReview: (reviewId: string, disagreement?: string) => Promise<boolean>;
  
  // Goal actions
  loadGoals: (filters?: GoalFilters) => Promise<void>;
  createGoal: (input: PerformanceGoalInput) => Promise<PerformanceGoal | null>;
  updateGoal: (goalId: string, input: GoalUpdateInput) => Promise<boolean>;
  deleteGoal: (goalId: string) => Promise<boolean>;
  
  // Feedback actions
  loadFeedback: (employeeId: string) => Promise<void>;
  submitFeedback: (
    input: FeedbackInput,
    sourceData: { id: string; name: string } | null,
    targetData: { name: string }
  ) => Promise<Feedback | null>;
  
  // Analytics
  loadAnalytics: (periodStart: Date, periodEnd: Date) => Promise<void>;
}

export const usePerformance = ({
  companyId,
  employeeId,
  autoLoad = true,
}: UsePerformanceOptions): UsePerformanceReturn => {
  const { user } = useAuth();
  
  // State
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [currentReview, setCurrentReview] = useState<PerformanceReview | null>(null);
  const [goals, setGoals] = useState<PerformanceGoal[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [analytics, setAnalytics] = useState<PerformanceAnalytics | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Load reviews
  const loadReviews = useCallback(async (filters: PerformanceReviewFilters = {}) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const finalFilters = employeeId ? { ...filters, employeeId } : filters;
      const data = await getPerformanceReviews(companyId, finalFilters);
      setReviews(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reviews');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, employeeId]);
  
  // Load single review
  const loadReview = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await getPerformanceReview(id);
      setCurrentReview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load review');
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Create review
  const createReviewFn = useCallback(async (
    input: PerformanceReviewInput,
    employeeData: { name: string; position: string; departmentId: string; departmentName: string },
    managerData: { name: string }
  ): Promise<PerformanceReview | null> => {
    if (!user) return null;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const review = await createPerformanceReview(
        companyId,
        input,
        employeeData,
        managerData,
        user.uid
      );
      setReviews(prev => [review, ...prev]);
      return review;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create review');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [companyId, user]);
  
  // Start self assessment
  const startSelfAssessmentFn = useCallback(async (reviewId: string): Promise<boolean> => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      await startSelfAssessment(reviewId);
      await loadReview(reviewId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start self assessment');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [loadReview]);
  
  // Submit self assessment
  const submitSelfAssessmentFn = useCallback(async (
    reviewId: string,
    input: SelfAssessmentInput
  ): Promise<boolean> => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      await submitSelfAssessment(reviewId, input);
      await loadReview(reviewId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit self assessment');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [loadReview]);
  
  // Submit manager assessment
  const submitManagerAssessmentFn = useCallback(async (
    reviewId: string,
    input: ManagerAssessmentInput
  ): Promise<boolean> => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      await submitManagerAssessment(reviewId, input);
      await loadReview(reviewId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit manager assessment');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [loadReview]);
  
  // Acknowledge review
  const acknowledgeReviewFn = useCallback(async (
    reviewId: string,
    disagreement?: string
  ): Promise<boolean> => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      await acknowledgeReview(reviewId, disagreement);
      await loadReview(reviewId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to acknowledge review');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [loadReview]);
  
  // Load goals
  const loadGoals = useCallback(async (filters: GoalFilters = {}) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const finalFilters = employeeId ? { ...filters, employeeId } : filters;
      const data = await getPerformanceGoals(companyId, finalFilters);
      setGoals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load goals');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, employeeId]);
  
  // Create goal
  const createGoalFn = useCallback(async (
    input: PerformanceGoalInput
  ): Promise<PerformanceGoal | null> => {
    if (!user || !employeeId) return null;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const goal = await createPerformanceGoal(companyId, employeeId, input, user.uid);
      setGoals(prev => [...prev, goal]);
      return goal;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create goal');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [companyId, employeeId, user]);
  
  // Update goal
  const updateGoalFn = useCallback(async (
    goalId: string,
    input: GoalUpdateInput
  ): Promise<boolean> => {
    if (!user) return false;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      await updateGoalProgress(goalId, input, user.uid);
      await loadGoals();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update goal');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [user, loadGoals]);
  
  // Delete goal
  const deleteGoalFn = useCallback(async (goalId: string): Promise<boolean> => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      await deletePerformanceGoal(goalId);
      setGoals(prev => prev.filter(g => g.id !== goalId));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete goal');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, []);
  
  // Load feedback
  const loadFeedbackFn = useCallback(async (empId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await getFeedbackForEmployee(companyId, empId);
      setFeedback(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feedback');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);
  
  // Submit feedback
  const submitFeedbackFn = useCallback(async (
    input: FeedbackInput,
    sourceData: { id: string; name: string } | null,
    targetData: { name: string }
  ): Promise<Feedback | null> => {
    if (!user) return null;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const fb = await createFeedback(companyId, input, sourceData, targetData, user.uid);
      return fb;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [companyId, user]);
  
  // Load analytics
  const loadAnalyticsFn = useCallback(async (periodStart: Date, periodEnd: Date) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await getPerformanceAnalytics(companyId, periodStart, periodEnd);
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);
  
  // Auto-load
  useEffect(() => {
    if (autoLoad && companyId) {
      loadReviews();
      loadGoals();
      if (employeeId) {
        loadFeedbackFn(employeeId);
      }
    }
  }, [autoLoad, companyId, employeeId, loadReviews, loadGoals, loadFeedbackFn]);
  
  return {
    reviews,
    currentReview,
    goals,
    feedback,
    analytics,
    isLoading,
    isSubmitting,
    error,
    loadReviews,
    loadReview,
    createReview: createReviewFn,
    startSelfAssessment: startSelfAssessmentFn,
    submitSelfAssessment: submitSelfAssessmentFn,
    submitManagerAssessment: submitManagerAssessmentFn,
    acknowledgeReview: acknowledgeReviewFn,
    loadGoals,
    createGoal: createGoalFn,
    updateGoal: updateGoalFn,
    deleteGoal: deleteGoalFn,
    loadFeedback: loadFeedbackFn,
    submitFeedback: submitFeedbackFn,
    loadAnalytics: loadAnalyticsFn,
  };
};
