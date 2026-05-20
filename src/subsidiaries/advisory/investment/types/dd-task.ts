/**
 * Due Diligence Task
 * 
 * Individual work items within a workstream.
 */

import { Timestamp } from 'firebase/firestore';

export interface DDTask {
  id: string;
  dueDiligenceId: string;
  workstreamId: string;
  
  // Task details
  title: string;
  description?: string;
  category: TaskCategory;
  
  // Status
  status: TaskStatus;
  priority: TaskPriority;
  
  // Assignment
  assignee?: TaskAssignee;
  reviewer?: TaskAssignee;
  
  // Timeline
  dueDate?: Date;
  completedAt?: Timestamp;
  
  // Subtasks
  subtasks?: TaskSubtask[];
  
  // Dependencies
  dependencies?: string[];   // Other task IDs
  blockers?: string[];
  
  // Output
  deliverable?: string;
  attachments?: TaskAttachment[];
  notes?: string;
  
  // Review
  reviewStatus?: ReviewStatus;
  reviewNotes?: string;
  reviewedAt?: Timestamp;
  
  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}

export type TaskCategory = 
  | 'document_review'
  | 'data_analysis'
  | 'interview'
  | 'site_visit'
  | 'external_report'
  | 'internal_analysis'
  | 'verification'
  | 'other';

export type TaskStatus = 
  | 'not_started'
  | 'in_progress'
  | 'pending_review'
  | 'completed'
  | 'blocked'
  | 'cancelled';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface TaskAssignee {
  userId: string;
  name: string;
  email: string;
}

export interface TaskSubtask {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: Timestamp;
}

export interface TaskAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  uploadedAt: Timestamp;
}

export type ReviewStatus = 'pending' | 'approved' | 'changes_requested';

// Task summary for workstream view
export interface TaskSummary {
  total: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  blocked: number;
  overdue: number;
}

// Helper functions
export function getTaskCategoryDisplayName(category: TaskCategory): string {
  const names: Record<TaskCategory, string> = {
    document_review: 'Document Review',
    data_analysis: 'Data Analysis',
    interview: 'Interview',
    site_visit: 'Site Visit',
    external_report: 'External Report',
    internal_analysis: 'Internal Analysis',
    verification: 'Verification',
    other: 'Other',
  };
  return names[category] || category;
}

export function getTaskStatusDisplayName(status: TaskStatus): string {
  const names: Record<TaskStatus, string> = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    pending_review: 'Pending Review',
    completed: 'Completed',
    blocked: 'Blocked',
    cancelled: 'Cancelled',
  };
  return names[status] || status;
}

export function getTaskPriorityDisplayName(priority: TaskPriority): string {
  const names: Record<TaskPriority, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };
  return names[priority] || priority;
}

export function getTaskStatusColor(status: TaskStatus): string {
  const colors: Record<TaskStatus, string> = {
    not_started: '#6b7280',
    in_progress: '#3b82f6',
    pending_review: '#f59e0b',
    completed: '#22c55e',
    blocked: '#ef4444',
    cancelled: '#9ca3af',
  };
  return colors[status] || '#6b7280';
}

export function getTaskPriorityColor(priority: TaskPriority): string {
  const colors: Record<TaskPriority, string> = {
    critical: '#dc2626',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e',
  };
  return colors[priority] || '#6b7280';
}
