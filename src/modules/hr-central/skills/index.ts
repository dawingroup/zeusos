// ============================================================================
// SKILLS MODULE INDEX
// DawinOS v2.0 - HR Module
// Export all skills & training management functionality
// ============================================================================

// Constants
export {
  SKILL_LEVELS,
  SKILL_LEVEL_VALUES,
  SKILL_LEVEL_LABELS,
  SKILL_CATEGORIES,
  SKILL_CATEGORY_LABELS,
  TRAINING_TYPES,
  TRAINING_TYPE_LABELS,
  TRAINING_STATUS,
  TRAINING_STATUS_LABELS,
  TRAINING_STATUS_COLORS,
  CERTIFICATION_STATUS,
  CERTIFICATION_STATUS_LABELS,
  CERTIFICATION_STATUS_COLORS,
  UGANDA_PROFESSIONAL_BODIES,
  GAP_PRIORITY,
  GAP_PRIORITY_LABELS,
  GAP_PRIORITY_COLORS,
  SKILLS_COLLECTION,
  EMPLOYEE_SKILLS_COLLECTION,
  TRAINING_PROGRAMS_COLLECTION,
  TRAINING_ENROLLMENTS_COLLECTION,
  CERTIFICATIONS_COLLECTION,
  SKILL_REQUIREMENTS_COLLECTION,
  TRAINING_BUDGETS_COLLECTION,
} from './constants/skills.constants';

export type {
  SkillLevel,
  SkillCategory,
  TrainingType,
  TrainingStatus,
  CertificationStatus,
  GapPriority,
} from './constants/skills.constants';

// Types
export type {
  Skill,
  EmployeeSkillRecord,
  SkillRequirementItem,
  SkillRequirement,
  SkillGap,
  SkillGapAnalysis,
  TrainingSkillCoverage,
  TrainingProgram,
  TrainingFeedback,
  TrainingEnrollment,
  SkillCertification,
  TrainingBudget,
  SkillFilters,
  TrainingProgramFilters,
  EnrollmentFilters,
  CertificationFilters,
} from './types/skills.types';

// Schemas
export {
  skillDefinitionSchema,
  employeeSkillSchema,
  skillRequirementItemSchema,
  skillRequirementSchema,
  trainingSkillCoverageSchema,
  trainingProgramSchema,
  trainingEnrollmentSchema,
  trainingCompletionSchema,
  trainingFeedbackSchema,
  skillCertificationSchema,
  managerSkillAssessmentSchema,
} from './schemas/skills.schemas';

export type {
  SkillInput,
  EmployeeSkillInput,
  SkillRequirementInput,
  TrainingProgramInput,
  TrainingEnrollmentInput,
  TrainingCompletionInput,
  TrainingFeedbackInput,
  CertificationInput,
  ManagerSkillAssessmentInput,
} from './schemas/skills.schemas';

// Services
export {
  createSkill,
  getSkill,
  getSkills,
  updateSkill,
  deleteSkill,
  addEmployeeSkill,
  getEmployeeSkills,
  updateEmployeeSkill,
  verifyEmployeeSkill,
  setManagerAssessment,
  deleteEmployeeSkill,
  setSkillRequirements,
  getPositionRequirements,
  analyzeSkillGaps,
  createTrainingProgram,
  getTrainingProgram,
  getTrainingPrograms,
  updateTrainingProgram,
  publishTrainingProgram,
  cancelTrainingProgram,
  enrollInTraining,
  getEnrollment,
  getEmployeeEnrollments,
  getProgramEnrollments,
  approveEnrollment,
  rejectEnrollment,
  completeTraining,
  submitTrainingFeedback,
  addCertification,
  getCertification,
  getEmployeeCertifications,
  getExpiringCertifications,
  verifyCertification,
  updateCertificationStatus,
  getTrainingBudget,
  updateTrainingBudgetSpend,
} from './services/skillsService';

// Hooks
export { useSkills } from './hooks/useSkills';
