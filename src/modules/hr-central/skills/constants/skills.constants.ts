// ============================================================================
// SKILLS & TRAINING CONSTANTS
// ZeusOS v2.0 - HR Module
// ============================================================================

// Skill Proficiency Levels
export const SKILL_LEVELS = {
  NOVICE: 'novice',
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
  EXPERT: 'expert',
} as const;

export type SkillLevel = typeof SKILL_LEVELS[keyof typeof SKILL_LEVELS];

export const SKILL_LEVEL_VALUES: Record<SkillLevel, number> = {
  novice: 1,
  beginner: 2,
  intermediate: 3,
  advanced: 4,
  expert: 5,
};

export const SKILL_LEVEL_LABELS: Record<SkillLevel, string> = {
  novice: 'Novice (1)',
  beginner: 'Beginner (2)',
  intermediate: 'Intermediate (3)',
  advanced: 'Advanced (4)',
  expert: 'Expert (5)',
};

// Skill Categories
export const SKILL_CATEGORIES = {
  TECHNICAL: 'technical',
  SOFT_SKILLS: 'soft_skills',
  DOMAIN: 'domain',
  LANGUAGE: 'language',
  TOOLS: 'tools',
  CERTIFICATION: 'certification',
} as const;

export type SkillCategory = typeof SKILL_CATEGORIES[keyof typeof SKILL_CATEGORIES];

export const SKILL_CATEGORY_LABELS: Record<SkillCategory, string> = {
  technical: 'Technical Skills',
  soft_skills: 'Soft Skills',
  domain: 'Domain Knowledge',
  language: 'Languages',
  tools: 'Tools & Software',
  certification: 'Certifications',
};

// Training Types
export const TRAINING_TYPES = {
  INTERNAL: 'internal',
  EXTERNAL: 'external',
  ONLINE: 'online',
  WORKSHOP: 'workshop',
  CONFERENCE: 'conference',
  CERTIFICATION: 'certification',
  ON_THE_JOB: 'on_the_job',
  MENTORING: 'mentoring',
} as const;

export type TrainingType = typeof TRAINING_TYPES[keyof typeof TRAINING_TYPES];

export const TRAINING_TYPE_LABELS: Record<TrainingType, string> = {
  internal: 'Internal Training',
  external: 'External Training',
  online: 'Online Course',
  workshop: 'Workshop',
  conference: 'Conference',
  certification: 'Certification Program',
  on_the_job: 'On-the-Job Training',
  mentoring: 'Mentoring Program',
};

// Training Status
export const TRAINING_STATUS = {
  PLANNED: 'planned',
  ENROLLED: 'enrolled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
} as const;

export type TrainingStatus = typeof TRAINING_STATUS[keyof typeof TRAINING_STATUS];

export const TRAINING_STATUS_LABELS: Record<TrainingStatus, string> = {
  planned: 'Planned',
  enrolled: 'Enrolled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  failed: 'Did Not Complete',
};

export const TRAINING_STATUS_COLORS: Record<TrainingStatus, string> = {
  planned: 'bg-[var(--bg-sunken)] text-foreground',
  enrolled: 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
  in_progress: 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
  completed: 'bg-[var(--rag-green-soft)] text-[var(--rag-green)]',
  cancelled: 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]',
  failed: 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]',
};

// Certification Status
export const CERTIFICATION_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  EXPIRING_SOON: 'expiring_soon',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
} as const;

export type CertificationStatus = typeof CERTIFICATION_STATUS[keyof typeof CERTIFICATION_STATUS];

export const CERTIFICATION_STATUS_LABELS: Record<CertificationStatus, string> = {
  pending: 'Pending Verification',
  active: 'Active',
  expiring_soon: 'Expiring Soon',
  expired: 'Expired',
  revoked: 'Revoked',
};

export const CERTIFICATION_STATUS_COLORS: Record<CertificationStatus, string> = {
  pending: 'bg-[var(--bg-sunken)] text-foreground',
  active: 'bg-[var(--rag-green-soft)] text-[var(--rag-green)]',
  expiring_soon: 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]',
  expired: 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]',
  revoked: 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]',
};

// Uganda-specific Professional Bodies
export const UGANDA_PROFESSIONAL_BODIES = [
  { id: 'icpau', name: 'ICPAU', fullName: 'Institute of Certified Public Accountants of Uganda' },
  { id: 'uls', name: 'ULS', fullName: 'Uganda Law Society' },
  { id: 'ieu', name: 'IEU', fullName: 'Institution of Engineers Uganda' },
  { id: 'ispu', name: 'ISPU', fullName: 'Institution of Surveyors of Uganda' },
  { id: 'uia', name: 'UIA', fullName: 'Uganda Institute of Architects' },
  { id: 'ihrmu', name: 'IHRMU', fullName: 'Institute of Human Resource Management Uganda' },
  { id: 'cisi', name: 'CISI', fullName: 'Chartered Institute of Secretaries and Administrators' },
  { id: 'uipe', name: 'UIPE', fullName: 'Uganda Institution of Professional Engineers' },
  { id: 'nbfr', name: 'NBFR', fullName: 'National Board for Technical Education' },
] as const;

// Skill Gap Priority
export const GAP_PRIORITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export type GapPriority = typeof GAP_PRIORITY[keyof typeof GAP_PRIORITY];

export const GAP_PRIORITY_LABELS: Record<GapPriority, string> = {
  critical: 'Critical',
  high: 'High Priority',
  medium: 'Medium Priority',
  low: 'Low Priority',
};

export const GAP_PRIORITY_COLORS: Record<GapPriority, string> = {
  critical: 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]',
  high: 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]',
  medium: 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
  low: 'bg-[var(--bg-sunken)] text-foreground',
};

// Collections
export const SKILLS_COLLECTION = 'skills';
export const EMPLOYEE_SKILLS_COLLECTION = 'employee_skills';
export const TRAINING_PROGRAMS_COLLECTION = 'training_programs';
export const TRAINING_ENROLLMENTS_COLLECTION = 'training_enrollments';
export const CERTIFICATIONS_COLLECTION = 'certifications';
export const SKILL_REQUIREMENTS_COLLECTION = 'skill_requirements';
export const TRAINING_BUDGETS_COLLECTION = 'training_budgets';
