/**
 * Marketing Task Types
 * Task tracker for aggregating and managing marketing-related work items
 * sourced from key dates, campaigns, content calendar, and manual entries
 */

import { Timestamp } from 'firebase/firestore';
import type { SocialPlatform } from './campaign.types';
import type { MarketingDateCategory } from './marketing-agent.types';

// ============================================
// Task Types
// ============================================

export type MarketingTaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled';
export type MarketingTaskPriority = 'urgent' | 'high' | 'medium' | 'low';
export type MarketingTaskSource =
  | 'key_date'
  | 'campaign'
  | 'calendar'
  | 'ai_suggestion'
  | 'manual';
export type MarketingTaskType =
  | 'content_creation'
  | 'campaign_setup'
  | 'design_asset'
  | 'social_post'
  | 'review_approval'
  | 'analytics_report'
  | 'outreach'
  | 'event_prep'
  | 'general';

export interface MarketingTask {
  id: string;
  companyId: string;

  // Task Info
  title: string;
  description: string;
  taskType: MarketingTaskType;
  status: MarketingTaskStatus;
  priority: MarketingTaskPriority;

  // Scheduling
  dueDate?: Timestamp;
  startDate?: Timestamp;
  completedAt?: Timestamp;

  // Assignment
  assignedTo?: string;
  assignedToName?: string;
  createdBy: string;
  createdByName: string;

  // Source & Linkage
  source: MarketingTaskSource;
  sourceId?: string; // ID of the key date, campaign, or calendar event
  sourceName?: string; // Name/label of the source for display

  // Cross-feature links
  linkedKeyDateId?: string;
  linkedKeyDateName?: string;
  linkedCampaignId?: string;
  linkedCampaignName?: string;
  linkedCalendarEventId?: string;
  linkedTemplateId?: string;
  linkedMediaIds?: string[];

  // Content specifics
  platforms?: SocialPlatform[];
  contentTheme?: string;
  dateCategory?: MarketingDateCategory;

  // Progress
  checklist?: TaskChecklistItem[];
  notes?: string;
  tags: string[];

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TaskChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

// ============================================
// Task Filters & Forms
// ============================================

export interface MarketingTaskFilters {
  status?: MarketingTaskStatus;
  priority?: MarketingTaskPriority;
  source?: MarketingTaskSource;
  taskType?: MarketingTaskType;
  assignedTo?: string;
  search?: string;
  dueBefore?: Date;
  dueAfter?: Date;
  linkedKeyDateId?: string;
  linkedCampaignId?: string;
}

export interface MarketingTaskFormData {
  title: string;
  description: string;
  taskType: MarketingTaskType;
  priority: MarketingTaskPriority;
  dueDate?: Date;
  assignedTo?: string;
  assignedToName?: string;
  source: MarketingTaskSource;
  sourceId?: string;
  sourceName?: string;
  linkedKeyDateId?: string;
  linkedKeyDateName?: string;
  linkedCampaignId?: string;
  linkedCampaignName?: string;
  platforms?: SocialPlatform[];
  contentTheme?: string;
  tags: string[];
  checklist?: { text: string }[];
}

// ============================================
// Constants
// ============================================

export const MARKETING_TASKS_COLLECTION = 'marketingTasks';

export const TASK_STATUS_CONFIG: Record<MarketingTaskStatus, { label: string; color: string; icon: string }> = {
  todo: { label: 'To Do', color: 'bg-slate-100 text-slate-700', icon: 'Circle' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700', icon: 'Clock' },
  review: { label: 'In Review', color: 'bg-amber-100 text-amber-700', icon: 'Eye' },
  done: { label: 'Done', color: 'bg-green-100 text-green-700', icon: 'CheckCircle2' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700', icon: 'XCircle' },
};

export const TASK_PRIORITY_CONFIG: Record<MarketingTaskPriority, { label: string; color: string }> = {
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700 border-red-200' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  low: { label: 'Low', color: 'bg-green-100 text-green-700 border-green-200' },
};

export const TASK_TYPE_CONFIG: Record<MarketingTaskType, { label: string; icon: string }> = {
  content_creation: { label: 'Content Creation', icon: 'PenTool' },
  campaign_setup: { label: 'Campaign Setup', icon: 'Megaphone' },
  design_asset: { label: 'Design Asset', icon: 'Image' },
  social_post: { label: 'Social Post', icon: 'Share2' },
  review_approval: { label: 'Review & Approval', icon: 'CheckSquare' },
  analytics_report: { label: 'Analytics Report', icon: 'BarChart3' },
  outreach: { label: 'Outreach', icon: 'Mail' },
  event_prep: { label: 'Event Preparation', icon: 'Calendar' },
  general: { label: 'General', icon: 'ClipboardList' },
};

export const TASK_SOURCE_CONFIG: Record<MarketingTaskSource, { label: string; icon: string }> = {
  key_date: { label: 'Key Date', icon: 'CalendarDays' },
  campaign: { label: 'Campaign', icon: 'Megaphone' },
  calendar: { label: 'Content Calendar', icon: 'Calendar' },
  ai_suggestion: { label: 'AI Suggestion', icon: 'Bot' },
  manual: { label: 'Manual', icon: 'PlusCircle' },
};
