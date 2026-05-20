/**
 * SCHEDULE TYPES
 *
 * Types for schedule management within infrastructure delivery projects.
 */

import { Timestamp } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────
// ENUMS & STATUS TYPES
// ─────────────────────────────────────────────────────────────────

export type ScheduleActivityStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'delayed'
  | 'blocked'
  | 'cancelled';

export type ScheduleActivityType = 'task' | 'milestone' | 'phase';

export type DependencyType =
  | 'finish_to_start'
  | 'start_to_start'
  | 'finish_to_finish'
  | 'start_to_finish';

// ─────────────────────────────────────────────────────────────────
// SUB-TYPES
// ─────────────────────────────────────────────────────────────────

export interface ScheduleDependency {
  activityId: string;
  type: DependencyType;
  lagDays: number;
}

// ─────────────────────────────────────────────────────────────────
// CORE ENTITY
// ─────────────────────────────────────────────────────────────────

export interface ScheduleActivity {
  id: string;
  projectId: string;

  // Identity
  name: string;
  description?: string;
  wbsCode?: string;
  activityType: ScheduleActivityType;

  // Hierarchy
  parentId?: string;
  sortOrder: number;

  // Schedule
  plannedStartDate: Date;
  plannedEndDate: Date;
  actualStartDate?: Date;
  actualEndDate?: Date;
  durationDays: number;

  // Progress
  percentComplete: number;
  status: ScheduleActivityStatus;

  // Dependencies
  dependencies: ScheduleDependency[];

  // Resources
  responsibleParty?: string;
  responsibleRole?: string;

  // Critical path
  isCriticalPath: boolean;
  totalFloat: number;
  freeFloat: number;

  // Metadata
  notes?: string;
  tags?: string[];
  createdBy: string;
  createdAt: Timestamp;
  updatedBy: string;
  updatedAt: Timestamp;
}

// ─────────────────────────────────────────────────────────────────
// SUMMARY (denormalized on project or computed)
// ─────────────────────────────────────────────────────────────────

export interface ScheduleSummary {
  totalActivities: number;
  completedActivities: number;
  inProgressActivities: number;
  delayedActivities: number;
  milestoneCount: number;
  completedMilestones: number;
  nextMilestone?: {
    id: string;
    name: string;
    dueDate: Date;
    status: ScheduleActivityStatus;
  };
  criticalPathLength: number;
  overallProgress: number;
}

// ─────────────────────────────────────────────────────────────────
// FORM DATA
// ─────────────────────────────────────────────────────────────────

export interface ScheduleActivityFormData {
  name: string;
  description?: string;
  wbsCode?: string;
  activityType: ScheduleActivityType;
  parentId?: string;
  plannedStartDate: Date;
  plannedEndDate: Date;
  responsibleParty?: string;
  responsibleRole?: string;
  dependencies: ScheduleDependency[];
  notes?: string;
  tags?: string[];
}

// ─────────────────────────────────────────────────────────────────
// STATUS CONFIGURATION
// ─────────────────────────────────────────────────────────────────

export interface ScheduleStatusConfig {
  label: string;
  color: string;
  bgColor: string;
}

export const SCHEDULE_STATUS_CONFIG: Record<ScheduleActivityStatus, ScheduleStatusConfig> = {
  not_started: { label: 'Not Started', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  in_progress: { label: 'In Progress', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  completed: { label: 'Completed', color: 'text-green-700', bgColor: 'bg-green-100' },
  delayed: { label: 'Delayed', color: 'text-red-700', bgColor: 'bg-red-100' },
  blocked: { label: 'Blocked', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  cancelled: { label: 'Cancelled', color: 'text-gray-500', bgColor: 'bg-gray-50' },
};

export const ACTIVITY_TYPE_CONFIG: Record<ScheduleActivityType, { label: string; color: string }> = {
  task: { label: 'Task', color: 'text-blue-600' },
  milestone: { label: 'Milestone', color: 'text-purple-600' },
  phase: { label: 'Phase', color: 'text-indigo-600' },
};

export const DEPENDENCY_TYPE_LABELS: Record<DependencyType, string> = {
  finish_to_start: 'Finish to Start (FS)',
  start_to_start: 'Start to Start (SS)',
  finish_to_finish: 'Finish to Finish (FF)',
  start_to_finish: 'Start to Finish (SF)',
};

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

export function getActivityStatusColor(status: ScheduleActivityStatus): string {
  const config = SCHEDULE_STATUS_CONFIG[status];
  return config ? `${config.color} ${config.bgColor}` : 'text-gray-700 bg-gray-100';
}

export function getActivityStatusLabel(status: ScheduleActivityStatus): string {
  return SCHEDULE_STATUS_CONFIG[status]?.label || status;
}

export function calculateDurationDays(start: Date, end: Date): number {
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function isActivityOverdue(activity: ScheduleActivity): boolean {
  if (activity.status === 'completed' || activity.status === 'cancelled') return false;
  const now = new Date();
  const endDate = new Date(activity.plannedEndDate);
  return now > endDate && activity.percentComplete < 100;
}

export function getActivityBarColor(activity: ScheduleActivity): string {
  if (activity.status === 'completed') return '#059669';
  if (activity.status === 'delayed' || isActivityOverdue(activity)) return '#DC2626';
  if (activity.status === 'blocked') return '#EA580C';
  if (activity.status === 'in_progress') return '#2563EB';
  if (activity.status === 'cancelled') return '#9CA3AF';
  return '#D1D5DB';
}
