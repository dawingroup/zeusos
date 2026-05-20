// ============================================================================
// SKILLS & TRAINING SCHEMAS
// DawinOS v2.0 - HR Module
// ============================================================================

import { z } from 'zod';
import {
  SKILL_LEVELS,
  SKILL_CATEGORIES,
  TRAINING_TYPES,
} from '../constants/skills.constants';

// ----------------------------------------------------------------------------
// SKILL SCHEMA
// ----------------------------------------------------------------------------

export const skillDefinitionSchema = z.object({
  name: z.string().min(1, 'Skill name is required').max(100),
  description: z.string().max(500).optional(),
  category: z.enum([
    SKILL_CATEGORIES.TECHNICAL,
    SKILL_CATEGORIES.SOFT_SKILLS,
    SKILL_CATEGORIES.DOMAIN,
    SKILL_CATEGORIES.LANGUAGE,
    SKILL_CATEGORIES.TOOLS,
    SKILL_CATEGORIES.CERTIFICATION,
  ]),
  isCore: z.boolean().default(false),
  relatedSkills: z.array(z.string()).optional(),
});

export type SkillInput = z.infer<typeof skillDefinitionSchema>;

// ----------------------------------------------------------------------------
// EMPLOYEE SKILL SCHEMA
// ----------------------------------------------------------------------------

export const employeeSkillSchema = z.object({
  skillId: z.string().min(1, 'Skill is required'),
  selfAssessedLevel: z.enum([
    SKILL_LEVELS.NOVICE,
    SKILL_LEVELS.BEGINNER,
    SKILL_LEVELS.INTERMEDIATE,
    SKILL_LEVELS.ADVANCED,
    SKILL_LEVELS.EXPERT,
  ]),
  yearsExperience: z.number().min(0).max(50).optional(),
  lastUsedDate: z.date().optional(),
  projectEvidence: z.array(z.string().max(200)).optional(),
});

export type EmployeeSkillInput = z.infer<typeof employeeSkillSchema>;

// ----------------------------------------------------------------------------
// SKILL REQUIREMENT SCHEMA
// ----------------------------------------------------------------------------

export const skillRequirementItemSchema = z.object({
  skillId: z.string().min(1),
  minimumLevel: z.enum([
    SKILL_LEVELS.NOVICE,
    SKILL_LEVELS.BEGINNER,
    SKILL_LEVELS.INTERMEDIATE,
    SKILL_LEVELS.ADVANCED,
    SKILL_LEVELS.EXPERT,
  ]),
  isRequired: z.boolean().default(true),
  weight: z.number().min(0).max(100).default(100),
});

export const skillRequirementSchema = z.object({
  positionId: z.string().min(1, 'Position is required'),
  requiredSkills: z.array(skillRequirementItemSchema).min(1, 'At least one skill required'),
});

export type SkillRequirementInput = z.infer<typeof skillRequirementSchema>;

// ----------------------------------------------------------------------------
// TRAINING PROGRAM SCHEMA
// ----------------------------------------------------------------------------

export const trainingSkillCoverageSchema = z.object({
  skillId: z.string().min(1),
  levelAchievable: z.enum([
    SKILL_LEVELS.NOVICE,
    SKILL_LEVELS.BEGINNER,
    SKILL_LEVELS.INTERMEDIATE,
    SKILL_LEVELS.ADVANCED,
    SKILL_LEVELS.EXPERT,
  ]),
});

export const trainingProgramSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000),
  type: z.enum([
    TRAINING_TYPES.INTERNAL,
    TRAINING_TYPES.EXTERNAL,
    TRAINING_TYPES.ONLINE,
    TRAINING_TYPES.WORKSHOP,
    TRAINING_TYPES.CONFERENCE,
    TRAINING_TYPES.CERTIFICATION,
    TRAINING_TYPES.ON_THE_JOB,
    TRAINING_TYPES.MENTORING,
  ]),
  
  provider: z.string().min(1, 'Provider is required').max(200),
  providerContact: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
  isOnline: z.boolean().default(false),
  
  startDate: z.date(),
  endDate: z.date(),
  durationHours: z.number().min(0.5).max(1000),
  schedule: z.string().max(500).optional(),
  
  maxParticipants: z.number().min(1).optional(),
  
  costPerPerson: z.number().min(0),
  currency: z.string().default('UGX'),
  budgetCode: z.string().optional(),
  
  skillsCovered: z.array(trainingSkillCoverageSchema),
  
  prerequisites: z.array(z.string()).optional(),
  targetAudience: z.string().max(500).optional(),
  certificateProvided: z.boolean().default(false),
}).refine(
  (data) => data.endDate >= data.startDate,
  { message: 'End date must be after start date', path: ['endDate'] }
);

export type TrainingProgramInput = z.infer<typeof trainingProgramSchema>;

// ----------------------------------------------------------------------------
// TRAINING ENROLLMENT SCHEMA
// ----------------------------------------------------------------------------

export const trainingEnrollmentSchema = z.object({
  programId: z.string().min(1, 'Program is required'),
  employeeId: z.string().min(1, 'Employee is required'),
  approvalRequired: z.boolean().default(true),
});

export type TrainingEnrollmentInput = z.infer<typeof trainingEnrollmentSchema>;

// ----------------------------------------------------------------------------
// TRAINING COMPLETION SCHEMA
// ----------------------------------------------------------------------------

export const trainingCompletionSchema = z.object({
  attendancePercent: z.number().min(0).max(100),
  score: z.number().min(0).max(100).optional(),
  passed: z.boolean(),
  certificateId: z.string().optional(),
});

export type TrainingCompletionInput = z.infer<typeof trainingCompletionSchema>;

// ----------------------------------------------------------------------------
// TRAINING FEEDBACK SCHEMA
// ----------------------------------------------------------------------------

export const trainingFeedbackSchema = z.object({
  rating: z.number().min(1).max(5),
  comments: z.string().max(2000),
});

export type TrainingFeedbackInput = z.infer<typeof trainingFeedbackSchema>;

// ----------------------------------------------------------------------------
// CERTIFICATION SCHEMA
// ----------------------------------------------------------------------------

export const skillCertificationSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  name: z.string().min(1, 'Certification name is required').max(200),
  issuingBody: z.string().min(1, 'Issuing body is required').max(200),
  credentialId: z.string().max(100).optional(),
  issueDate: z.date(),
  expiryDate: z.date().optional(),
  verificationUrl: z.string().url().optional().or(z.literal('')),
  renewalRequired: z.boolean().default(false),
  renewalCost: z.number().min(0).optional(),
  skillIds: z.array(z.string()).optional(),
});

export type CertificationInput = z.infer<typeof skillCertificationSchema>;

// ----------------------------------------------------------------------------
// MANAGER SKILL ASSESSMENT SCHEMA
// ----------------------------------------------------------------------------

export const managerSkillAssessmentSchema = z.object({
  employeeSkillId: z.string().min(1),
  managerAssessedLevel: z.enum([
    SKILL_LEVELS.NOVICE,
    SKILL_LEVELS.BEGINNER,
    SKILL_LEVELS.INTERMEDIATE,
    SKILL_LEVELS.ADVANCED,
    SKILL_LEVELS.EXPERT,
  ]),
  notes: z.string().max(500).optional(),
});

export type ManagerSkillAssessmentInput = z.infer<typeof managerSkillAssessmentSchema>;
