// ============================================================================
// DEVELOPMENT & TRAINING TYPES
// ZeusOS v2.0 - HR Performance Module
// Types for employee development plans, training, and competencies
// ============================================================================

import { Timestamp } from 'firebase/firestore';

export type DeliveryMethod = 'classroom' | 'online' | 'hybrid' | 'self_paced';

export interface LevelDefinition {
  level: ProficiencyLevel;
  description: string;
  indicators: string[];
}

// ----------------------------------------------------------------------------
// COMPETENCY FRAMEWORK
// ----------------------------------------------------------------------------

export type CompetencyCategory =
  | 'technical'      // Role-specific technical skills
  | 'leadership'     // Management and leadership abilities
  | 'core'          // Company-wide core competencies
  | 'behavioral'    // Soft skills and behaviors
  | 'client';       // Client management and delivery

export type ProficiencyLevel =
  | 'novice'        // 1 - Learning/developing
  | 'beginner'      // 2 - Basic understanding
  | 'intermediate'  // 3 - Can work independently
  | 'advanced'      // 4 - Can guide others
  | 'expert';       // 5 - Subject matter expert

export interface Competency {
  id: string;
  companyId: string;
  name: string;
  description: string;
  category: CompetencyCategory;
  levelDefinitions: {
    level: ProficiencyLevel;
    description: string;
    indicators: string[];  // Behavioral indicators for this level
  }[];
  isActive: boolean;
  applicableRoles?: string[];  // Which roles need this competency
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

export interface EmployeeCompetency {
  id: string;
  companyId: string;
  employeeId: string;
  competencyId: string;
  competencyName: string;
  category: CompetencyCategory;
  currentLevel: ProficiencyLevel;
  targetLevel: ProficiencyLevel;
  assessedBy: string;  // userId of assessor
  assessedByName: string;
  assessmentDate: Date | Timestamp;
  evidence?: string;  // Supporting evidence/examples
  developmentActions?: string[];  // Actions to reach target level
  lastReviewDate?: Date | Timestamp;
  nextReviewDate?: Date | Timestamp;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

// ----------------------------------------------------------------------------
// TRAINING CATALOG
// ----------------------------------------------------------------------------

export type TrainingType =
  | 'internal_course'     // Company-provided training
  | 'external_course'     // Third-party courses
  | 'certification'       // Professional certifications
  | 'workshop'           // Workshops and seminars
  | 'mentorship'         // Mentorship programs
  | 'on_the_job'         // OJT and job shadowing
  | 'e_learning';        // Online learning platforms

export type TrainingProvider =
  | 'internal'
  | 'external'
  | 'vendor';

export interface TrainingCourse {
  id: string;
  companyId: string;
  title: string;
  description: string;
  type: TrainingType;
  provider: TrainingProvider;
  providerName?: string;
  duration: number;  // in hours
  durationUnit: 'hours' | 'days' | 'weeks';
  cost?: number;
  currency?: string;
  targetCompetencies: string[];  // Competency IDs this training addresses
  prerequisites?: string[];
  learningObjectives: string[];
  deliveryMethod: 'classroom' | 'online' | 'hybrid' | 'self_paced';
  maxParticipants?: number;
  materials?: string[];  // URLs or file paths to materials
  isActive: boolean;
  trainingType?: string;
  workshopDetails?: {
    location?: string;
    startDate?: Date | Timestamp;
    endDate?: Date | Timestamp;
    instructor?: string;
    capacity?: number;
    [key: string]: any;
  };
  mentorId?: string;
  externalUrl?: string;
  videoUrl?: string;
  certificateOffered?: boolean;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

export type TrainingStatus =
  | 'planned'
  | 'enrolled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface EmployeeTraining {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  courseId: string;
  courseTitle: string;
  courseType: TrainingType;
  status: TrainingStatus;
  enrolledDate: Date | Timestamp;
  startDate?: Date | Timestamp;
  completionDate?: Date | Timestamp;
  dueDate?: Date | Timestamp;
  progress: number;  // 0-100
  assessmentScore?: number;  // If applicable
  certified?: boolean;
  certificateUrl?: string;
  cost?: number;
  approvedBy?: string;
  approvedByName?: string;
  notes?: string;
  linkedToDevelopmentPlan?: string;  // Development plan ID
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

// ----------------------------------------------------------------------------
// DEVELOPMENT PLANS
// ----------------------------------------------------------------------------

export type DevelopmentGoalType =
  | 'skill_development'
  | 'career_advancement'
  | 'performance_improvement'
  | 'leadership_development'
  | 'technical_certification';

export type DevelopmentGoalStatus =
  | 'draft'
  | 'active'
  | 'on_track'
  | 'at_risk'
  | 'in_progress'
  | 'not_started'
  | 'completed'
  | 'cancelled';

export interface DevelopmentGoal {
  id: string;
  title: string;
  description: string;
  type: DevelopmentGoalType;
  targetCompetencyId?: string;
  targetCompetencyName?: string;
  currentLevel?: ProficiencyLevel;
  targetLevel?: ProficiencyLevel;
  status: DevelopmentGoalStatus;
  progress: number;  // 0-100
  actions: {
    id: string;
    description: string;
    type: 'training' | 'project' | 'mentoring' | 'reading' | 'other';
    trainingCourseId?: string;
    dueDate?: Date | Timestamp;
    completed: boolean;
    completedDate?: Date | Timestamp;
  }[];
  successMetrics: string[];
  dueDate: Date | Timestamp;
  targetDate?: Date | Timestamp;
  createdAt?: Date | Timestamp;
  updatedAt?: Date | Timestamp;
  completedDate?: Date | Timestamp;
}

export interface DevelopmentPlan {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  employeePosition: string;
  departmentId: string;
  departmentName: string;
  managerId: string;
  managerName: string;
  planYear: number;  // Fiscal year
  status: 'draft' | 'active' | 'completed' | 'archived';

  // Career aspirations
  careerGoals?: string;
  desiredRole?: string;
  timeframe?: string;  // e.g., "1-2 years", "3-5 years"

  // Assessment
  strengths: string[];
  areasForImprovement: string[];
  skillGaps: {
    competencyId: string;
    competencyName: string;
    currentLevel: ProficiencyLevel;
    targetLevel: ProficiencyLevel;
    priority: 'high' | 'medium' | 'low';
  }[];

  // Development goals
  goals: DevelopmentGoal[];

  // Support needed
  managerSupport?: string;
  resourcesNeeded?: string[];
  budgetAllocated?: number;
  budgetUsed?: number;

  // Review schedule
  reviewFrequency: 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
  lastReviewDate?: Date | Timestamp;
  nextReviewDate: Date | Timestamp;

  // Progress tracking
  overallProgress: number;  // 0-100

  createdBy: string;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  completedAt?: Date | Timestamp;
}

// ----------------------------------------------------------------------------
// PERFORMANCE METRICS
// ----------------------------------------------------------------------------

export interface PerformanceMetrics {
  id: string;
  companyId: string;
  employeeId: string;
  periodStart: Date | Timestamp;
  periodEnd: Date | Timestamp;

  // Attendance
  attendance: {
    workingDays: number;
    daysPresent: number;
    daysAbsent: number;
    daysLate: number;
    attendanceRate: number;  // percentage
  };

  // Quality metrics
  quality: {
    tasksCompleted: number;
    tasksWithErrors: number;
    qualityScore: number;  // 0-100
    clientSatisfaction?: number;  // 0-5
    peerFeedbackScore?: number;  // 0-5
  };

  // Productivity
  productivity: {
    outputVolume: number;
    targetVolume: number;
    efficiencyRate: number;  // percentage
    onTimeDelivery: number;  // percentage
  };

  // Behavioral
  behavioral: {
    teamCollaboration: number;  // 1-5
    communication: number;  // 1-5
    initiative: number;  // 1-5
    adaptability: number;  // 1-5
    professionalism: number;  // 1-5
  };

  // Overall score
  overallPerformanceScore: number;  // Weighted average

  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

// ----------------------------------------------------------------------------
// FILTERS & QUERIES
// ----------------------------------------------------------------------------

export interface CompetencyFilters {
  category?: CompetencyCategory;
  isActive?: boolean;
  applicableRole?: string;
}

export interface TrainingFilters {
  type?: TrainingType;
  provider?: TrainingProvider;
  isActive?: boolean;
  competencyId?: string;
}

export interface DevelopmentPlanFilters {
  employeeId?: string;
  departmentId?: string;
  status?: DevelopmentPlan['status'];
  planYear?: number;
  managerId?: string;
}

export interface EmployeeTrainingFilters {
  employeeId?: string;
  status?: TrainingStatus;
  courseType?: TrainingType;
  enrolledAfter?: Date;
  completedAfter?: Date;
}
