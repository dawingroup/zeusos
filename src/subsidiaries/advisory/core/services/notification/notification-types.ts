/**
 * NOTIFICATION TYPES
 * 
 * Types and interfaces for the notification service.
 */

import { Timestamp } from 'firebase/firestore';

// ============================================================================
// Channel Types
// ============================================================================

/**
 * Available notification channels
 */
export type NotificationChannel = 'email' | 'sms' | 'push' | 'in_app';

/**
 * Channel-specific configuration
 */
export interface ChannelConfig {
  email?: {
    defaultFrom: string;
    replyTo?: string;
    provider: 'sendgrid' | 'ses' | 'smtp';
  };
  sms?: {
    defaultFrom: string;
    provider: 'twilio' | 'africas_talking';
  };
  push?: {
    provider: 'fcm';
    vapidKey?: string;
  };
  in_app?: {
    maxAge: number;
    maxCount: number;
  };
}

// ============================================================================
// Notification Types
// ============================================================================

/**
 * Categories of notifications
 */
export type NotificationCategory = 
  | 'approval'
  | 'payment'
  | 'covenant'
  | 'report'
  | 'milestone'
  | 'alert'
  | 'system'
  | 'reminder';

/**
 * Notification priority levels
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Specific notification types
 */
export type NotificationType =
  // Approval notifications
  | 'approval_requested'
  | 'approval_approved'
  | 'approval_rejected'
  | 'approval_returned'
  | 'approval_escalated'
  | 'approval_delegated'
  | 'approval_reminder'
  // Payment notifications
  | 'payment_submitted'
  | 'payment_approved'
  | 'payment_rejected'
  | 'payment_disbursed'
  // Covenant notifications
  | 'covenant_due'
  | 'covenant_at_risk'
  | 'covenant_breached'
  | 'covenant_cured'
  // Report notifications
  | 'report_due'
  | 'report_overdue'
  | 'report_submitted'
  | 'report_accepted'
  | 'report_rejected'
  // Milestone notifications
  | 'milestone_approaching'
  | 'milestone_achieved'
  | 'milestone_missed'
  // Alert notifications
  | 'budget_threshold'
  | 'schedule_delay'
  | 'risk_identified'
  | 'action_required'
  // System notifications
  | 'system_announcement'
  | 'maintenance_scheduled'
  | 'feature_update'
  // Reminders
  | 'daily_digest'
  | 'weekly_summary'
  | 'task_reminder';

// ============================================================================
// Notification Interfaces
// ============================================================================

/**
 * Base notification data
 */
export interface NotificationData {
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  
  /** Notification title */
  title: string;
  /** Notification body */
  body: string;
  
  /** Engagement context */
  engagementId?: string;
  engagementName?: string;
  
  /** Related entity */
  entityType?: string;
  entityId?: string;
  
  /** Action URL */
  actionUrl?: string;
  actionLabel?: string;
  
  /** Additional data */
  data?: Record<string, unknown>;
}

/**
 * Notification recipient
 */
export interface NotificationRecipient {
  userId: string;
  email?: string;
  phone?: string;
  fcmToken?: string;
  name?: string;
  /** Override default channels */
  channels?: NotificationChannel[];
}

/**
 * Stored notification record
 */
export interface Notification extends NotificationData {
  id: string;
  recipientId: string;
  
  /** Delivery tracking */
  channels: NotificationChannel[];
  deliveryStatus: Record<NotificationChannel, DeliveryStatus>;
  
  /** Timestamps */
  createdAt: Timestamp;
  scheduledFor?: Timestamp;
  sentAt?: Timestamp;
  readAt?: Timestamp;
  
  /** Grouping */
  groupId?: string;
  batchId?: string;
}

/**
 * Delivery status per channel
 */
export interface DeliveryStatus {
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  sentAt?: Timestamp;
  deliveredAt?: Timestamp;
  failedAt?: Timestamp;
  error?: string;
  externalId?: string;
}

// ============================================================================
// User Preferences
// ============================================================================

/**
 * User notification preferences
 */
export interface NotificationPreferences {
  userId: string;
  
  /** Global settings */
  enabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone: string;
  
  /** Channel preferences */
  channels: {
    email: boolean;
    sms: boolean;
    push: boolean;
    in_app: boolean;
  };
  
  /** Category preferences */
  categorySettings: Record<NotificationCategory, CategoryPreference>;
  
  /** Digest settings */
  digestEnabled: boolean;
  digestFrequency: 'daily' | 'weekly' | 'none';
  digestTime?: string;
  
  /** Updated timestamp */
  updatedAt: Timestamp;
}

/**
 * Category-specific preference
 */
export interface CategoryPreference {
  enabled: boolean;
  channels: NotificationChannel[];
  minimumPriority: NotificationPriority;
}

/**
 * Default notification preferences
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: Omit<NotificationPreferences, 'userId' | 'updatedAt'> = {
  enabled: true,
  quietHoursEnabled: false,
  timezone: 'Africa/Nairobi',
  channels: {
    email: true,
    sms: false,
    push: true,
    in_app: true,
  },
  categorySettings: {
    approval: { enabled: true, channels: ['email', 'push', 'in_app'], minimumPriority: 'low' },
    payment: { enabled: true, channels: ['email', 'in_app'], minimumPriority: 'normal' },
    covenant: { enabled: true, channels: ['email', 'push', 'in_app'], minimumPriority: 'normal' },
    report: { enabled: true, channels: ['email', 'in_app'], minimumPriority: 'normal' },
    milestone: { enabled: true, channels: ['push', 'in_app'], minimumPriority: 'normal' },
    alert: { enabled: true, channels: ['email', 'push', 'in_app'], minimumPriority: 'high' },
    system: { enabled: true, channels: ['email', 'in_app'], minimumPriority: 'normal' },
    reminder: { enabled: true, channels: ['push', 'in_app'], minimumPriority: 'low' },
  },
  digestEnabled: true,
  digestFrequency: 'daily',
  digestTime: '08:00',
};

// ============================================================================
// Templates
// ============================================================================

/**
 * Notification template
 */
export interface NotificationTemplate {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  
  /** Content */
  subject?: string;
  title: string;
  body: string;
  
  /** Email specific */
  htmlTemplate?: string;
  
  /** Variables available in template */
  variables: string[];
  
  /** Metadata */
  isDefault: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Template variables for rendering
 */
export interface TemplateVariables {
  /** User */
  recipientName?: string;
  recipientEmail?: string;
  
  /** Engagement */
  engagementName?: string;
  engagementId?: string;
  
  /** Entity */
  entityType?: string;
  entityId?: string;
  entityName?: string;
  
  /** Action */
  actionUrl?: string;
  actionLabel?: string;
  
  /** Approval specific */
  approvalTitle?: string;
  approverName?: string;
  requesterName?: string;
  stepNumber?: number;
  totalSteps?: number;
  comments?: string;
  
  /** Payment specific */
  paymentAmount?: string;
  paymentCurrency?: string;
  paymentReference?: string;
  
  /** Dates */
  dueDate?: string;
  submittedDate?: string;
  
  /** Custom */
  [key: string]: unknown;
}

// ============================================================================
// Delivery Request
// ============================================================================

/**
 * Request to send notifications
 */
export interface SendNotificationRequest {
  /** Notification content */
  notification: NotificationData;
  
  /** Recipients */
  recipients: NotificationRecipient[];
  
  /** Template override */
  templateId?: string;
  templateVariables?: TemplateVariables;
  
  /** Scheduling */
  sendAt?: Date;
  
  /** Options */
  options?: {
    respectPreferences?: boolean;
    respectQuietHours?: boolean;
    groupId?: string;
    batchId?: string;
  };
}

/**
 * Result of send operation
 */
export interface SendNotificationResult {
  success: boolean;
  notificationIds: string[];
  recipientResults: RecipientResult[];
  errors?: string[];
}

/**
 * Result per recipient
 */
export interface RecipientResult {
  userId: string;
  notificationId?: string;
  channelsAttempted: NotificationChannel[];
  channelsSucceeded: NotificationChannel[];
  channelsFailed: NotificationChannel[];
  skipped: boolean;
  skipReason?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get category display name
 */
export function getCategoryDisplayName(category: NotificationCategory): string {
  const names: Record<NotificationCategory, string> = {
    approval: 'Approvals',
    payment: 'Payments',
    covenant: 'Covenants',
    report: 'Reports',
    milestone: 'Milestones',
    alert: 'Alerts',
    system: 'System',
    reminder: 'Reminders',
  };
  return names[category];
}

/**
 * Get priority display name
 */
export function getPriorityDisplayName(priority: NotificationPriority): string {
  const names: Record<NotificationPriority, string> = {
    low: 'Low',
    normal: 'Normal',
    high: 'High',
    urgent: 'Urgent',
  };
  return names[priority];
}

/**
 * Get channel display name
 */
export function getChannelDisplayName(channel: NotificationChannel): string {
  const names: Record<NotificationChannel, string> = {
    email: 'Email',
    sms: 'SMS',
    push: 'Push Notification',
    in_app: 'In-App',
  };
  return names[channel];
}

/**
 * Get notification type category
 */
export function getNotificationCategory(type: NotificationType): NotificationCategory {
  if (type.startsWith('approval_')) return 'approval';
  if (type.startsWith('payment_')) return 'payment';
  if (type.startsWith('covenant_')) return 'covenant';
  if (type.startsWith('report_')) return 'report';
  if (type.startsWith('milestone_')) return 'milestone';
  if (type.startsWith('system_') || type.startsWith('maintenance_') || type.startsWith('feature_')) return 'system';
  if (type.includes('reminder') || type.includes('digest') || type.includes('summary')) return 'reminder';
  return 'alert';
}
