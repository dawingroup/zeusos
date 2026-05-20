/**
 * SITE VISIT TYPES
 * 
 * Field inspection and progress verification.
 */

import { Timestamp } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────
// VISIT TYPES
// ─────────────────────────────────────────────────────────────────

export type SiteVisitType =
  | 'routine'
  | 'milestone'
  | 'quality'
  | 'safety'
  | 'handover'
  | 'final';

export const SITE_VISIT_TYPE_LABELS: Record<SiteVisitType, string> = {
  routine: 'Routine Monitoring',
  milestone: 'Milestone Verification',
  quality: 'Quality Inspection',
  safety: 'Safety Audit',
  handover: 'Handover Inspection',
  final: 'Final Inspection',
};

export type SiteVisitStatus = 'draft' | 'submitted' | 'reviewed';

// ─────────────────────────────────────────────────────────────────
// VISITOR INFO
// ─────────────────────────────────────────────────────────────────

export interface VisitorInfo {
  userId?: string;
  name: string;
  organization: string;
  role: string;
  email?: string;
  phone?: string;
}

// ─────────────────────────────────────────────────────────────────
// CONDITIONS
// ─────────────────────────────────────────────────────────────────

export type WeatherConditionType = 'sunny' | 'cloudy' | 'rainy' | 'stormy';

export interface WeatherConditions {
  condition: WeatherConditionType;
  temperature?: number;
  affectsWork: boolean;
  notes?: string;
}

export type ConditionRating = 'good' | 'fair' | 'poor';
export type SafetyComplianceRating = 'compliant' | 'minor_issues' | 'major_issues';
export type MaterialsStorageRating = 'proper' | 'needs_improvement' | 'poor';

export interface SiteConditions {
  overallCondition: ConditionRating;
  safetyCompliance: SafetyComplianceRating;
  housekeeping: ConditionRating;
  materialsStorage: MaterialsStorageRating;
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────
// PROGRESS OBSERVATION
// ─────────────────────────────────────────────────────────────────

export interface WorkPackageObservation {
  workPackageId: string;
  name: string;
  reported: number;
  observed: number;
  status: string;
  notes?: string;
}

export interface ProgressObservation {
  reportedProgress: number;
  observedProgress: number;
  variance: number;
  agreesWithReported: boolean;
  notes?: string;
  workPackageObservations: WorkPackageObservation[];
}

// ─────────────────────────────────────────────────────────────────
// FINDINGS
// ─────────────────────────────────────────────────────────────────

export type FindingCategory = 'positive' | 'neutral' | 'concern' | 'critical';

export interface VisitFinding {
  id: string;
  category: FindingCategory;
  area: string;
  description: string;
  recommendation?: string;
  photoIds?: string[];
}

// ─────────────────────────────────────────────────────────────────
// ISSUES
// ─────────────────────────────────────────────────────────────────

export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export type IssueCategory =
  | 'quality'
  | 'safety'
  | 'design'
  | 'materials'
  | 'workmanship'
  | 'schedule'
  | 'environmental'
  | 'community'
  | 'documentation';

export const ISSUE_CATEGORY_LABELS: Record<IssueCategory, string> = {
  quality: 'Quality',
  safety: 'Safety',
  design: 'Design',
  materials: 'Materials',
  workmanship: 'Workmanship',
  schedule: 'Schedule',
  environmental: 'Environmental',
  community: 'Community Relations',
  documentation: 'Documentation',
};

export interface SiteIssue {
  id: string;
  title: string;
  description: string;
  severity: IssueSeverity;
  category: IssueCategory;
  location?: string;
  status: IssueStatus;
  
  // Assignment
  assignedTo?: string;
  dueDate?: Date;
  
  // Resolution
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: Timestamp;
  
  // Photos
  issuePhotos?: string[];
  resolutionPhotos?: string[];
}

// ─────────────────────────────────────────────────────────────────
// ACTION ITEMS
// ─────────────────────────────────────────────────────────────────

export type ActionItemPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ActionItemStatus = 'pending' | 'in_progress' | 'completed' | 'overdue';

export interface ActionItem {
  id: string;
  description: string;
  priority: ActionItemPriority;
  assignedTo: string;
  dueDate: Date;
  status: ActionItemStatus;
  completedAt?: Timestamp;
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────
// SITE VISIT ENTITY
// ─────────────────────────────────────────────────────────────────

export interface SiteVisit {
  id: string;
  projectId: string;
  programId: string;
  
  // Visit info
  visitDate: Date;
  visitType: SiteVisitType;
  duration: number;
  
  // Participants
  leadInspector: VisitorInfo;
  visitors: VisitorInfo[];
  sitePOC?: string;
  
  // Observations
  weatherConditions: WeatherConditions;
  siteConditions: SiteConditions;
  progressObservation: ProgressObservation;
  
  // Findings
  findings: VisitFinding[];
  issues: SiteIssue[];
  actionItems: ActionItem[];
  
  // Documentation
  photos: string[];
  reportDocId?: string;
  
  // Follow-up
  nextVisitDate?: Date;
  followUpRequired: boolean;
  
  // Audit
  createdAt: Timestamp;
  createdBy: string;
  submittedAt?: Timestamp;
  status: SiteVisitStatus;
}

// ─────────────────────────────────────────────────────────────────
// FORM DATA
// ─────────────────────────────────────────────────────────────────

export interface SiteVisitFormData {
  projectId: string;
  programId: string;
  visitDate: Date;
  visitType: SiteVisitType;
  duration: number;
  leadInspector: VisitorInfo;
  visitors?: VisitorInfo[];
  sitePOC?: string;
  weatherConditions: WeatherConditions;
  siteConditions: SiteConditions;
  progressObservation: ProgressObservation;
  findings?: VisitFinding[];
  issues?: SiteIssue[];
  actionItems?: ActionItem[];
  photos?: string[];
  nextVisitDate?: Date;
  followUpRequired?: boolean;
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Get issue severity color
 */
export function getIssueSeverityColor(severity: IssueSeverity): string {
  const colorMap: Record<IssueSeverity, string> = {
    low: 'text-gray-600 bg-gray-100',
    medium: 'text-yellow-600 bg-yellow-100',
    high: 'text-orange-600 bg-orange-100',
    critical: 'text-red-600 bg-red-100',
  };
  return colorMap[severity];
}

/**
 * Get issue status color
 */
export function getIssueStatusColor(status: IssueStatus): string {
  const colorMap: Record<IssueStatus, string> = {
    open: 'text-red-600 bg-red-100',
    in_progress: 'text-yellow-600 bg-yellow-100',
    resolved: 'text-blue-600 bg-blue-100',
    closed: 'text-green-600 bg-green-100',
  };
  return colorMap[status];
}

/**
 * Get action item priority color
 */
export function getActionItemPriorityColor(priority: ActionItemPriority): string {
  const colorMap: Record<ActionItemPriority, string> = {
    low: 'text-gray-600 bg-gray-100',
    medium: 'text-blue-600 bg-blue-100',
    high: 'text-orange-600 bg-orange-100',
    urgent: 'text-red-600 bg-red-100',
  };
  return colorMap[priority];
}

/**
 * Get finding category color
 */
export function getFindingCategoryColor(category: FindingCategory): string {
  const colorMap: Record<FindingCategory, string> = {
    positive: 'text-green-600 bg-green-100',
    neutral: 'text-gray-600 bg-gray-100',
    concern: 'text-yellow-600 bg-yellow-100',
    critical: 'text-red-600 bg-red-100',
  };
  return colorMap[category];
}

/**
 * Initialize empty site visit form data
 */
export function initializeSiteVisitForm(
  projectId: string,
  programId: string,
  leadInspector: VisitorInfo
): SiteVisitFormData {
  return {
    projectId,
    programId,
    visitDate: new Date(),
    visitType: 'routine',
    duration: 2,
    leadInspector,
    visitors: [],
    weatherConditions: {
      condition: 'sunny',
      affectsWork: false,
    },
    siteConditions: {
      overallCondition: 'good',
      safetyCompliance: 'compliant',
      housekeeping: 'good',
      materialsStorage: 'proper',
    },
    progressObservation: {
      reportedProgress: 0,
      observedProgress: 0,
      variance: 0,
      agreesWithReported: true,
      workPackageObservations: [],
    },
    findings: [],
    issues: [],
    actionItems: [],
    photos: [],
    followUpRequired: false,
  };
}

/**
 * Count open issues
 */
export function countOpenIssues(issues: SiteIssue[]): number {
  return issues.filter(i => i.status === 'open' || i.status === 'in_progress').length;
}

/**
 * Count critical issues
 */
export function countCriticalIssues(issues: SiteIssue[]): number {
  return issues.filter(i => i.severity === 'critical' && i.status !== 'closed').length;
}

/**
 * Count pending action items
 */
export function countPendingActionItems(actionItems: ActionItem[]): number {
  return actionItems.filter(a => a.status === 'pending' || a.status === 'overdue').length;
}

/**
 * Get overdue action items
 */
export function getOverdueActionItems(actionItems: ActionItem[]): ActionItem[] {
  const now = new Date();
  return actionItems.filter(
    a => (a.status === 'pending' || a.status === 'in_progress') && 
         new Date(a.dueDate) < now
  );
}
