// ============================================================================
// PERFORMANCE MODULE INDEX
// DawinOS v2.0 - HR Module
// Export all performance management functionality
// ============================================================================

// Constants
export {
  REVIEW_CYCLES,
  REVIEW_CYCLE_LABELS,
  REVIEW_CYCLE_MONTHS,
  REVIEW_STATUS,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_COLORS,
  RATING_SCALES,
  FIVE_POINT_RATINGS,
  FOUR_POINT_RATINGS,
  COMPETENCY_CATEGORIES,
  COMPETENCY_CATEGORY_LABELS,
  CORE_COMPETENCIES,
  LEADERSHIP_COMPETENCIES,
  GOAL_TYPES,
  GOAL_TYPE_LABELS,
  GOAL_STATUS,
  GOAL_STATUS_LABELS,
  GOAL_STATUS_COLORS,
  FEEDBACK_TYPES,
  FEEDBACK_TYPE_LABELS,
  REVIEW_TEMPLATES,
  REVIEW_TEMPLATE_CONFIG,
  PIP_STATUS,
  PIP_STATUS_LABELS,
  PIP_DURATION_OPTIONS,
  PERFORMANCE_REVIEWS_COLLECTION,
  PERFORMANCE_GOALS_COLLECTION,
  COMPETENCY_ASSESSMENTS_COLLECTION,
  FEEDBACK_COLLECTION,
  PIP_COLLECTION,
  REVIEW_TEMPLATES_COLLECTION,
} from './constants/performance.constants';

export type {
  ReviewCycle,
  ReviewStatus,
  RatingScale,
  CompetencyCategory,
  GoalType,
  GoalStatus,
  FeedbackType,
  ReviewTemplate,
  PIPStatus,
} from './constants/performance.constants';

// Types
export type {
  PerformanceReview,
  GoalsAssessment,
  GoalAssessmentItem,
  CompetencyAssessment,
  CompetencyAssessmentItem,
  AchievementsSection,
  Achievement,
  DevelopmentSection,
  DevelopmentGoal,
  TrainingRecommendation,
  OverallSection,
  PerformanceGoal,
  GoalMilestone,
  GoalUpdate,
  Feedback,
  ThreeSixtyFeedback,
  FeedbackRequest,
  AggregatedRating,
  PerformanceImprovementPlan,
  PerformanceGap,
  PIPObjective,
  PIPCheckIn,
  PerformanceReviewFilters,
  GoalFilters,
} from './types/performance.types';

// Schemas
export {
  performanceReviewSchema,
  performanceGoalSchema,
  goalUpdateSchema,
  competencyAssessmentItemSchema,
  competencyAssessmentSchema,
  feedbackSchema,
  threeSixtyRequestSchema,
  performanceGapSchema,
  pipObjectiveSchema,
  pipSchema,
  pipCheckInSchema,
  selfAssessmentSchema,
  managerAssessmentSchema,
} from './schemas/performance.schemas';

export type {
  PerformanceReviewInput,
  PerformanceGoalInput,
  GoalUpdateInput,
  CompetencyAssessmentInput,
  FeedbackInput,
  ThreeSixtyRequestInput,
  PIPInput,
  PIPCheckInInput,
  SelfAssessmentInput,
  ManagerAssessmentInput,
} from './schemas/performance.schemas';

// Services
export {
  createPerformanceReview,
  getPerformanceReview,
  getPerformanceReviews,
  startSelfAssessment,
  submitSelfAssessment,
  submitManagerAssessment,
  acknowledgeReview,
  createPerformanceGoal,
  getPerformanceGoal,
  getPerformanceGoals,
  updateGoalProgress,
  deletePerformanceGoal,
  createFeedback,
  getFeedbackForEmployee,
  createPIP,
  getPIP,
  getEmployeePIPs,
  activatePIP,
  completePIP,
  getPerformanceAnalytics,
} from './services/performanceService';

// Hooks
export { usePerformance } from './hooks/usePerformance';

// Components
export {
  ReviewCard,
  GoalCard,
  RatingInput,
  PerformanceDashboard,
} from './components';
