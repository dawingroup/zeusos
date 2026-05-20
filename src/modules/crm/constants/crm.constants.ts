/**
 * CRM Module Constants
 * Deal stages, labels, colors, probabilities, and Firestore collections
 */

import type { CRMDealStage, CRMActivityType, DealSource, DealPriority, SalesTaskType } from '../types';

// ============================================================
// Firestore Collections
// ============================================================

export const CRM_DEALS_COLLECTION = 'crmDeals';
export const CRM_ACTIVITIES_COLLECTION = 'crmActivities';
export const CRM_TASKS_COLLECTION = 'crmTasks';

// ============================================================
// Deal Stage Configuration
// ============================================================

export const CRM_DEAL_STAGE_ORDER: CRMDealStage[] = [
  'lead',
  'qualification',
  'site_visit',
  'design_proposal',
  'quotation',
  'negotiation',
  'won',
  'lost',
  'on_hold',
];

export const CRM_ACTIVE_DEAL_STAGES: CRMDealStage[] = [
  'lead',
  'qualification',
  'site_visit',
  'design_proposal',
  'quotation',
  'negotiation',
];

export const CRM_CLOSED_DEAL_STAGES: CRMDealStage[] = ['won', 'lost'];

export const CRM_DEAL_STAGE_LABELS: Record<CRMDealStage, string> = {
  lead: 'Lead',
  qualification: 'Qualification',
  site_visit: 'Site Visit',
  design_proposal: 'Design Proposal',
  quotation: 'Quotation Sent',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
  on_hold: 'On Hold',
};

export const CRM_DEAL_STAGE_PROBABILITY: Record<CRMDealStage, number> = {
  lead: 10,
  qualification: 20,
  site_visit: 35,
  design_proposal: 50,
  quotation: 65,
  negotiation: 80,
  won: 100,
  lost: 0,
  on_hold: 0,
};

export const CRM_DEAL_STAGE_COLORS: Record<CRMDealStage, string> = {
  lead: 'bg-gray-100 text-gray-700 border-gray-300',
  qualification: 'bg-blue-50 text-blue-700 border-blue-300',
  site_visit: 'bg-indigo-50 text-indigo-700 border-indigo-300',
  design_proposal: 'bg-purple-50 text-purple-700 border-purple-300',
  quotation: 'bg-amber-50 text-amber-700 border-amber-300',
  negotiation: 'bg-orange-50 text-orange-700 border-orange-300',
  won: 'bg-green-50 text-green-700 border-green-300',
  lost: 'bg-red-50 text-red-700 border-red-300',
  on_hold: 'bg-yellow-50 text-yellow-700 border-yellow-300',
};

export const CRM_DEAL_STAGE_DOT_COLORS: Record<CRMDealStage, string> = {
  lead: 'bg-gray-400',
  qualification: 'bg-blue-500',
  site_visit: 'bg-indigo-500',
  design_proposal: 'bg-purple-500',
  quotation: 'bg-amber-500',
  negotiation: 'bg-orange-500',
  won: 'bg-green-500',
  lost: 'bg-red-500',
  on_hold: 'bg-yellow-500',
};

// ============================================================
// Deal Source & Priority Labels
// ============================================================

export const DEAL_SOURCE_LABELS: Record<DealSource, string> = {
  referral: 'Referral',
  website: 'Website',
  walk_in: 'Walk-in',
  repeat_client: 'Repeat Client',
  social_media: 'Social Media',
  trade_show: 'Trade Show',
  cold_outreach: 'Cold Outreach',
  other: 'Other',
};

export const DEAL_PRIORITY_LABELS: Record<DealPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const DEAL_PRIORITY_COLORS: Record<DealPriority, string> = {
  low: 'text-gray-500',
  medium: 'text-blue-500',
  high: 'text-orange-500',
  critical: 'text-red-600',
};

// ============================================================
// Activity Type Labels
// ============================================================

export const ACTIVITY_TYPE_LABELS: Record<CRMActivityType, string> = {
  call: 'Phone Call',
  email: 'Email',
  meeting: 'Meeting',
  site_visit: 'Site Visit',
  presentation: 'Presentation',
  note: 'Note',
  quote_sent: 'Quote Sent',
  quote_approved: 'Quote Approved',
  quote_rejected: 'Quote Rejected',
  stage_change: 'Stage Change',
  project_created: 'Project Created',
  manufacturing_update: 'Manufacturing Update',
  payment_received: 'Payment Received',
  task_completed: 'Task Completed',
  change_order_requested: 'Change Order Requested',
  change_order_submitted_to_client: 'Change Order Sent to Client',
  change_order_approved: 'Change Order Approved',
  change_order_rejected: 'Change Order Rejected',
  change_order_withdrawn: 'Change Order Withdrawn',
};

export const ACTIVITY_TYPE_ICONS: Record<CRMActivityType, string> = {
  call: 'Phone',
  email: 'Mail',
  meeting: 'Users',
  site_visit: 'MapPin',
  presentation: 'Presentation',
  note: 'StickyNote',
  quote_sent: 'Send',
  quote_approved: 'CheckCircle',
  quote_rejected: 'XCircle',
  stage_change: 'ArrowRight',
  project_created: 'FolderPlus',
  manufacturing_update: 'Wrench',
  payment_received: 'DollarSign',
  task_completed: 'CheckSquare',
  change_order_requested: 'FileEdit',
  change_order_submitted_to_client: 'Send',
  change_order_approved: 'BadgeCheck',
  change_order_rejected: 'FileX',
  change_order_withdrawn: 'Undo2',
};

// ============================================================
// Sales Task Type Labels
// ============================================================

export const SALES_TASK_TYPE_LABELS: Record<SalesTaskType, string> = {
  follow_up_call: 'Follow-up Call',
  follow_up_email: 'Follow-up Email',
  site_visit: 'Site Visit',
  send_quote: 'Send Quote',
  send_proposal: 'Send Proposal',
  schedule_meeting: 'Schedule Meeting',
  design_review: 'Design Review',
  payment_follow_up: 'Payment Follow-up',
  general: 'General',
};

// ============================================================
// Currency
// ============================================================

export const CRM_DEFAULT_CURRENCY = 'UGX';
export const CRM_SUPPORTED_CURRENCIES = ['UGX', 'USD', 'KES', 'EUR', 'GBP'] as const;

// ============================================================
// Deal Number Prefix
// ============================================================

export const CRM_DEAL_NUMBER_PREFIX = 'CRM-DEAL';
