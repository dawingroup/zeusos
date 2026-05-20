/**
 * NOTIFICATION TEMPLATES
 * 
 * Default templates for each notification type and channel.
 */

import { NotificationTemplate, NotificationType, NotificationChannel } from './notification-types';

// ============================================================================
// Template Type (without Firestore metadata)
// ============================================================================

type TemplateDefinition = Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt' | 'isDefault'>;

// ============================================================================
// Default Templates
// ============================================================================

export const DEFAULT_TEMPLATES: Record<NotificationType, Partial<Record<NotificationChannel, TemplateDefinition>>> = {
  // ─────────────────────────────────────────────────────────────────
  // Approval Templates
  // ─────────────────────────────────────────────────────────────────
  approval_requested: {
    email: {
      type: 'approval_requested',
      channel: 'email',
      subject: 'Approval Required: {{approvalTitle}}',
      title: 'Approval Required',
      body: 'You have a new approval request for {{approvalTitle}} in {{engagementName}}. Step {{stepNumber}} of {{totalSteps}}.',
      htmlTemplate: `
        <h2>Approval Required</h2>
        <p>Hello {{recipientName}},</p>
        <p>You have a new approval request that requires your attention:</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Request:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">{{approvalTitle}}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Engagement:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">{{engagementName}}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Requested by:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">{{requesterName}}</td></tr>
          <tr><td style="padding: 8px;"><strong>Step:</strong></td><td style="padding: 8px;">{{stepNumber}} of {{totalSteps}}</td></tr>
        </table>
        <p><a href="{{actionUrl}}" style="background:#0066cc;color:white;padding:10px 20px;text-decoration:none;border-radius:4px;display:inline-block;">Review Request</a></p>
      `,
      variables: ['recipientName', 'approvalTitle', 'engagementName', 'requesterName', 'stepNumber', 'totalSteps', 'actionUrl'],
    },
    push: {
      type: 'approval_requested',
      channel: 'push',
      title: 'Approval Required',
      body: '{{requesterName}} requests approval for {{approvalTitle}}',
      variables: ['requesterName', 'approvalTitle'],
    },
    in_app: {
      type: 'approval_requested',
      channel: 'in_app',
      title: 'Approval Required',
      body: 'New approval request: {{approvalTitle}} from {{requesterName}}',
      variables: ['approvalTitle', 'requesterName'],
    },
  },

  approval_approved: {
    email: {
      type: 'approval_approved',
      channel: 'email',
      subject: 'Approved: {{approvalTitle}}',
      title: 'Request Approved',
      body: 'Your request "{{approvalTitle}}" has been approved by {{approverName}}.',
      htmlTemplate: `
        <h2>Request Approved ✓</h2>
        <p>Hello {{recipientName}},</p>
        <p>Great news! Your approval request has been approved:</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Request:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">{{approvalTitle}}</td></tr>
          <tr><td style="padding: 8px;"><strong>Approved by:</strong></td><td style="padding: 8px;">{{approverName}}</td></tr>
        </table>
        <p><a href="{{actionUrl}}">View Details</a></p>
      `,
      variables: ['recipientName', 'approvalTitle', 'approverName', 'comments', 'actionUrl'],
    },
    push: {
      type: 'approval_approved',
      channel: 'push',
      title: 'Approved ✓',
      body: '{{approvalTitle}} approved by {{approverName}}',
      variables: ['approvalTitle', 'approverName'],
    },
    in_app: {
      type: 'approval_approved',
      channel: 'in_app',
      title: 'Request Approved',
      body: '{{approvalTitle}} has been approved by {{approverName}}',
      variables: ['approvalTitle', 'approverName'],
    },
  },

  approval_rejected: {
    email: {
      type: 'approval_rejected',
      channel: 'email',
      subject: 'Rejected: {{approvalTitle}}',
      title: 'Request Rejected',
      body: 'Your request "{{approvalTitle}}" has been rejected by {{approverName}}. Reason: {{comments}}',
      htmlTemplate: `
        <h2>Request Rejected</h2>
        <p>Hello {{recipientName}},</p>
        <p>Unfortunately, your approval request has been rejected:</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Request:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">{{approvalTitle}}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Rejected by:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">{{approverName}}</td></tr>
          <tr><td style="padding: 8px;"><strong>Reason:</strong></td><td style="padding: 8px;">{{comments}}</td></tr>
        </table>
        <p><a href="{{actionUrl}}">View Details</a></p>
      `,
      variables: ['recipientName', 'approvalTitle', 'approverName', 'comments', 'actionUrl'],
    },
    push: {
      type: 'approval_rejected',
      channel: 'push',
      title: 'Rejected ✗',
      body: '{{approvalTitle}} rejected by {{approverName}}',
      variables: ['approvalTitle', 'approverName'],
    },
    in_app: {
      type: 'approval_rejected',
      channel: 'in_app',
      title: 'Request Rejected',
      body: '{{approvalTitle}} has been rejected by {{approverName}}',
      variables: ['approvalTitle', 'approverName'],
    },
  },

  approval_returned: {
    email: {
      type: 'approval_returned',
      channel: 'email',
      subject: 'Returned for Revision: {{approvalTitle}}',
      title: 'Request Returned',
      body: 'Your request "{{approvalTitle}}" has been returned for revision by {{approverName}}.',
      variables: ['recipientName', 'approvalTitle', 'approverName', 'comments', 'actionUrl'],
    },
    in_app: {
      type: 'approval_returned',
      channel: 'in_app',
      title: 'Request Returned',
      body: '{{approvalTitle}} returned for revision by {{approverName}}',
      variables: ['approvalTitle', 'approverName'],
    },
  },

  approval_escalated: {
    email: {
      type: 'approval_escalated',
      channel: 'email',
      subject: 'ESCALATED: {{approvalTitle}}',
      title: 'Approval Escalated',
      body: 'Approval request "{{approvalTitle}}" has been escalated and requires your immediate attention.',
      variables: ['recipientName', 'approvalTitle', 'engagementName', 'actionUrl'],
    },
    push: {
      type: 'approval_escalated',
      channel: 'push',
      title: '⚠️ Escalated Approval',
      body: '{{approvalTitle}} requires immediate attention',
      variables: ['approvalTitle'],
    },
    in_app: {
      type: 'approval_escalated',
      channel: 'in_app',
      title: 'Escalated Approval',
      body: '{{approvalTitle}} has been escalated',
      variables: ['approvalTitle'],
    },
  },

  approval_delegated: {
    email: {
      type: 'approval_delegated',
      channel: 'email',
      subject: 'Delegated: {{approvalTitle}}',
      title: 'Approval Delegated to You',
      body: '{{approverName}} has delegated approval of "{{approvalTitle}}" to you.',
      variables: ['recipientName', 'approvalTitle', 'approverName', 'actionUrl'],
    },
    in_app: {
      type: 'approval_delegated',
      channel: 'in_app',
      title: 'Delegated Approval',
      body: '{{approverName}} delegated {{approvalTitle}} to you',
      variables: ['approverName', 'approvalTitle'],
    },
  },

  approval_reminder: {
    email: {
      type: 'approval_reminder',
      channel: 'email',
      subject: 'Reminder: Pending Approval - {{approvalTitle}}',
      title: 'Approval Reminder',
      body: 'You have a pending approval request for "{{approvalTitle}}" that requires your attention.',
      variables: ['recipientName', 'approvalTitle', 'engagementName', 'dueDate', 'actionUrl'],
    },
    push: {
      type: 'approval_reminder',
      channel: 'push',
      title: 'Pending Approval',
      body: "Don't forget: {{approvalTitle}} needs your approval",
      variables: ['approvalTitle'],
    },
    in_app: {
      type: 'approval_reminder',
      channel: 'in_app',
      title: 'Approval Reminder',
      body: '{{approvalTitle}} is awaiting your approval',
      variables: ['approvalTitle'],
    },
  },

  // ─────────────────────────────────────────────────────────────────
  // Payment Templates
  // ─────────────────────────────────────────────────────────────────
  payment_submitted: {
    email: {
      type: 'payment_submitted',
      channel: 'email',
      subject: 'Payment Submitted: {{paymentReference}}',
      title: 'Payment Submitted',
      body: 'A payment of {{paymentAmount}} {{paymentCurrency}} has been submitted for {{engagementName}}.',
      variables: ['recipientName', 'paymentAmount', 'paymentCurrency', 'paymentReference', 'engagementName', 'actionUrl'],
    },
    in_app: {
      type: 'payment_submitted',
      channel: 'in_app',
      title: 'Payment Submitted',
      body: '{{paymentAmount}} {{paymentCurrency}} submitted for approval',
      variables: ['paymentAmount', 'paymentCurrency'],
    },
  },

  payment_approved: {
    email: {
      type: 'payment_approved',
      channel: 'email',
      subject: 'Payment Approved: {{paymentReference}}',
      title: 'Payment Approved',
      body: 'Payment of {{paymentAmount}} {{paymentCurrency}} has been approved.',
      variables: ['recipientName', 'paymentAmount', 'paymentCurrency', 'paymentReference', 'approverName'],
    },
    in_app: {
      type: 'payment_approved',
      channel: 'in_app',
      title: 'Payment Approved',
      body: '{{paymentAmount}} {{paymentCurrency}} approved',
      variables: ['paymentAmount', 'paymentCurrency'],
    },
  },

  payment_rejected: {
    email: {
      type: 'payment_rejected',
      channel: 'email',
      subject: 'Payment Rejected: {{paymentReference}}',
      title: 'Payment Rejected',
      body: 'Payment of {{paymentAmount}} {{paymentCurrency}} has been rejected.',
      variables: ['recipientName', 'paymentAmount', 'paymentCurrency', 'paymentReference', 'comments'],
    },
    in_app: {
      type: 'payment_rejected',
      channel: 'in_app',
      title: 'Payment Rejected',
      body: '{{paymentAmount}} {{paymentCurrency}} rejected',
      variables: ['paymentAmount', 'paymentCurrency'],
    },
  },

  payment_disbursed: {
    email: {
      type: 'payment_disbursed',
      channel: 'email',
      subject: 'Payment Disbursed: {{paymentReference}}',
      title: 'Payment Disbursed',
      body: 'Payment of {{paymentAmount}} {{paymentCurrency}} has been disbursed.',
      variables: ['recipientName', 'paymentAmount', 'paymentCurrency', 'paymentReference'],
    },
    in_app: {
      type: 'payment_disbursed',
      channel: 'in_app',
      title: 'Payment Disbursed',
      body: '{{paymentAmount}} {{paymentCurrency}} disbursed',
      variables: ['paymentAmount', 'paymentCurrency'],
    },
  },

  // ─────────────────────────────────────────────────────────────────
  // Covenant Templates
  // ─────────────────────────────────────────────────────────────────
  covenant_due: {
    email: {
      type: 'covenant_due',
      channel: 'email',
      subject: 'Covenant Due: {{entityName}}',
      title: 'Covenant Due',
      body: 'Covenant "{{entityName}}" is due on {{dueDate}}.',
      variables: ['recipientName', 'entityName', 'engagementName', 'dueDate', 'actionUrl'],
    },
    in_app: {
      type: 'covenant_due',
      channel: 'in_app',
      title: 'Covenant Due',
      body: '{{entityName}} due on {{dueDate}}',
      variables: ['entityName', 'dueDate'],
    },
  },

  covenant_at_risk: {
    email: {
      type: 'covenant_at_risk',
      channel: 'email',
      subject: '⚠️ Covenant At Risk: {{entityName}}',
      title: 'Covenant At Risk',
      body: 'Covenant "{{entityName}}" is at risk of breach.',
      variables: ['recipientName', 'entityName', 'engagementName', 'actionUrl'],
    },
    push: {
      type: 'covenant_at_risk',
      channel: 'push',
      title: '⚠️ Covenant At Risk',
      body: '{{entityName}} may breach soon',
      variables: ['entityName'],
    },
    in_app: {
      type: 'covenant_at_risk',
      channel: 'in_app',
      title: 'Covenant At Risk',
      body: '{{entityName}} is at risk of breach',
      variables: ['entityName'],
    },
  },

  covenant_breached: {
    email: {
      type: 'covenant_breached',
      channel: 'email',
      subject: '🚨 Covenant Breach: {{entityName}}',
      title: 'Covenant Breached',
      body: 'Covenant "{{entityName}}" has been breached. Immediate action required.',
      variables: ['recipientName', 'entityName', 'engagementName', 'actionUrl'],
    },
    push: {
      type: 'covenant_breached',
      channel: 'push',
      title: '🚨 Covenant Breach',
      body: '{{entityName}} has been breached',
      variables: ['entityName'],
    },
    sms: {
      type: 'covenant_breached',
      channel: 'sms',
      title: 'Covenant Breach',
      body: 'URGENT: Covenant {{entityName}} breached in {{engagementName}}. Login to take action.',
      variables: ['entityName', 'engagementName'],
    },
    in_app: {
      type: 'covenant_breached',
      channel: 'in_app',
      title: 'Covenant Breached',
      body: '{{entityName}} has been breached - action required',
      variables: ['entityName'],
    },
  },

  covenant_cured: {
    email: {
      type: 'covenant_cured',
      channel: 'email',
      subject: '✓ Covenant Cured: {{entityName}}',
      title: 'Covenant Cured',
      body: 'Covenant "{{entityName}}" breach has been cured.',
      variables: ['recipientName', 'entityName', 'engagementName'],
    },
    in_app: {
      type: 'covenant_cured',
      channel: 'in_app',
      title: 'Covenant Cured',
      body: '{{entityName}} breach has been resolved',
      variables: ['entityName'],
    },
  },

  // ─────────────────────────────────────────────────────────────────
  // Report Templates
  // ─────────────────────────────────────────────────────────────────
  report_due: {
    email: {
      type: 'report_due',
      channel: 'email',
      subject: 'Report Due: {{entityName}}',
      title: 'Report Due',
      body: 'Report "{{entityName}}" is due on {{dueDate}}.',
      variables: ['recipientName', 'entityName', 'engagementName', 'dueDate', 'actionUrl'],
    },
    in_app: {
      type: 'report_due',
      channel: 'in_app',
      title: 'Report Due',
      body: '{{entityName}} due on {{dueDate}}',
      variables: ['entityName', 'dueDate'],
    },
  },

  report_overdue: {
    email: {
      type: 'report_overdue',
      channel: 'email',
      subject: '⚠️ Report Overdue: {{entityName}}',
      title: 'Report Overdue',
      body: 'Report "{{entityName}}" is overdue. Due date was {{dueDate}}.',
      variables: ['recipientName', 'entityName', 'engagementName', 'dueDate', 'actionUrl'],
    },
    push: {
      type: 'report_overdue',
      channel: 'push',
      title: '⚠️ Report Overdue',
      body: '{{entityName}} is overdue',
      variables: ['entityName'],
    },
    in_app: {
      type: 'report_overdue',
      channel: 'in_app',
      title: 'Report Overdue',
      body: '{{entityName}} is overdue',
      variables: ['entityName'],
    },
  },

  report_submitted: {
    email: {
      type: 'report_submitted',
      channel: 'email',
      subject: 'Report Submitted: {{entityName}}',
      title: 'Report Submitted',
      body: 'Report "{{entityName}}" has been submitted for review.',
      variables: ['recipientName', 'entityName', 'engagementName', 'actionUrl'],
    },
    in_app: {
      type: 'report_submitted',
      channel: 'in_app',
      title: 'Report Submitted',
      body: '{{entityName}} submitted for review',
      variables: ['entityName'],
    },
  },

  report_accepted: {
    email: {
      type: 'report_accepted',
      channel: 'email',
      subject: '✓ Report Accepted: {{entityName}}',
      title: 'Report Accepted',
      body: 'Report "{{entityName}}" has been accepted.',
      variables: ['recipientName', 'entityName', 'engagementName'],
    },
    in_app: {
      type: 'report_accepted',
      channel: 'in_app',
      title: 'Report Accepted',
      body: '{{entityName}} has been accepted',
      variables: ['entityName'],
    },
  },

  report_rejected: {
    email: {
      type: 'report_rejected',
      channel: 'email',
      subject: 'Report Rejected: {{entityName}}',
      title: 'Report Rejected',
      body: 'Report "{{entityName}}" has been rejected. Comments: {{comments}}',
      variables: ['recipientName', 'entityName', 'engagementName', 'comments', 'actionUrl'],
    },
    in_app: {
      type: 'report_rejected',
      channel: 'in_app',
      title: 'Report Rejected',
      body: '{{entityName}} has been rejected',
      variables: ['entityName'],
    },
  },

  // ─────────────────────────────────────────────────────────────────
  // Milestone Templates
  // ─────────────────────────────────────────────────────────────────
  milestone_approaching: {
    email: {
      type: 'milestone_approaching',
      channel: 'email',
      subject: 'Milestone Approaching: {{entityName}}',
      title: 'Milestone Approaching',
      body: 'Milestone "{{entityName}}" is approaching on {{dueDate}}.',
      variables: ['recipientName', 'entityName', 'engagementName', 'dueDate'],
    },
    in_app: {
      type: 'milestone_approaching',
      channel: 'in_app',
      title: 'Milestone Approaching',
      body: '{{entityName}} on {{dueDate}}',
      variables: ['entityName', 'dueDate'],
    },
  },

  milestone_achieved: {
    email: {
      type: 'milestone_achieved',
      channel: 'email',
      subject: '🎉 Milestone Achieved: {{entityName}}',
      title: 'Milestone Achieved',
      body: 'Congratulations! Milestone "{{entityName}}" has been achieved.',
      variables: ['recipientName', 'entityName', 'engagementName'],
    },
    push: {
      type: 'milestone_achieved',
      channel: 'push',
      title: '🎉 Milestone Achieved',
      body: '{{entityName}} completed!',
      variables: ['entityName'],
    },
    in_app: {
      type: 'milestone_achieved',
      channel: 'in_app',
      title: 'Milestone Achieved',
      body: '{{entityName}} has been achieved',
      variables: ['entityName'],
    },
  },

  milestone_missed: {
    email: {
      type: 'milestone_missed',
      channel: 'email',
      subject: '⚠️ Milestone Missed: {{entityName}}',
      title: 'Milestone Missed',
      body: 'Milestone "{{entityName}}" was missed. Due date was {{dueDate}}.',
      variables: ['recipientName', 'entityName', 'engagementName', 'dueDate'],
    },
    in_app: {
      type: 'milestone_missed',
      channel: 'in_app',
      title: 'Milestone Missed',
      body: '{{entityName}} was missed',
      variables: ['entityName'],
    },
  },

  // ─────────────────────────────────────────────────────────────────
  // Alert Templates
  // ─────────────────────────────────────────────────────────────────
  budget_threshold: {
    email: {
      type: 'budget_threshold',
      channel: 'email',
      subject: '⚠️ Budget Alert: {{engagementName}}',
      title: 'Budget Threshold Alert',
      body: 'Budget utilization has exceeded threshold in {{engagementName}}.',
      variables: ['recipientName', 'engagementName', 'actionUrl'],
    },
    push: {
      type: 'budget_threshold',
      channel: 'push',
      title: '⚠️ Budget Alert',
      body: 'Budget threshold exceeded in {{engagementName}}',
      variables: ['engagementName'],
    },
    in_app: {
      type: 'budget_threshold',
      channel: 'in_app',
      title: 'Budget Alert',
      body: 'Budget threshold exceeded in {{engagementName}}',
      variables: ['engagementName'],
    },
  },

  schedule_delay: {
    email: {
      type: 'schedule_delay',
      channel: 'email',
      subject: '⚠️ Schedule Delay: {{engagementName}}',
      title: 'Schedule Delay Alert',
      body: 'Project schedule has been delayed in {{engagementName}}.',
      variables: ['recipientName', 'engagementName', 'entityName', 'actionUrl'],
    },
    in_app: {
      type: 'schedule_delay',
      channel: 'in_app',
      title: 'Schedule Delay',
      body: '{{entityName}} is delayed',
      variables: ['entityName'],
    },
  },

  risk_identified: {
    email: {
      type: 'risk_identified',
      channel: 'email',
      subject: '⚠️ Risk Identified: {{entityName}}',
      title: 'Risk Identified',
      body: 'A new risk has been identified: {{entityName}}.',
      variables: ['recipientName', 'entityName', 'engagementName', 'actionUrl'],
    },
    in_app: {
      type: 'risk_identified',
      channel: 'in_app',
      title: 'Risk Identified',
      body: 'New risk: {{entityName}}',
      variables: ['entityName'],
    },
  },

  action_required: {
    email: {
      type: 'action_required',
      channel: 'email',
      subject: 'Action Required: {{entityName}}',
      title: 'Action Required',
      body: 'Action is required: {{entityName}}.',
      variables: ['recipientName', 'entityName', 'engagementName', 'actionUrl'],
    },
    push: {
      type: 'action_required',
      channel: 'push',
      title: 'Action Required',
      body: '{{entityName}}',
      variables: ['entityName'],
    },
    in_app: {
      type: 'action_required',
      channel: 'in_app',
      title: 'Action Required',
      body: '{{entityName}}',
      variables: ['entityName'],
    },
  },

  // ─────────────────────────────────────────────────────────────────
  // System Templates
  // ─────────────────────────────────────────────────────────────────
  system_announcement: {
    email: {
      type: 'system_announcement',
      channel: 'email',
      subject: 'System Announcement',
      title: 'System Announcement',
      body: '{{entityName}}',
      variables: ['recipientName', 'entityName'],
    },
    in_app: {
      type: 'system_announcement',
      channel: 'in_app',
      title: 'Announcement',
      body: '{{entityName}}',
      variables: ['entityName'],
    },
  },

  maintenance_scheduled: {
    email: {
      type: 'maintenance_scheduled',
      channel: 'email',
      subject: 'Scheduled Maintenance: {{dueDate}}',
      title: 'Scheduled Maintenance',
      body: 'System maintenance is scheduled for {{dueDate}}.',
      variables: ['recipientName', 'dueDate'],
    },
    in_app: {
      type: 'maintenance_scheduled',
      channel: 'in_app',
      title: 'Maintenance',
      body: 'Maintenance scheduled: {{dueDate}}',
      variables: ['dueDate'],
    },
  },

  feature_update: {
    email: {
      type: 'feature_update',
      channel: 'email',
      subject: 'New Feature: {{entityName}}',
      title: 'New Feature Available',
      body: 'A new feature is available: {{entityName}}.',
      variables: ['recipientName', 'entityName'],
    },
    in_app: {
      type: 'feature_update',
      channel: 'in_app',
      title: 'New Feature',
      body: '{{entityName}} is now available',
      variables: ['entityName'],
    },
  },

  // ─────────────────────────────────────────────────────────────────
  // Reminder Templates
  // ─────────────────────────────────────────────────────────────────
  daily_digest: {
    email: {
      type: 'daily_digest',
      channel: 'email',
      subject: 'Daily Digest - {{submittedDate}}',
      title: 'Your Daily Digest',
      body: 'Here is your daily summary of activities.',
      htmlTemplate: `
        <h2>Daily Digest</h2>
        <p>Hello {{recipientName}},</p>
        <p>Here is your summary for {{submittedDate}}.</p>
        <!-- Digest content injected dynamically -->
      `,
      variables: ['recipientName', 'submittedDate'],
    },
  },

  weekly_summary: {
    email: {
      type: 'weekly_summary',
      channel: 'email',
      subject: 'Weekly Summary',
      title: 'Your Weekly Summary',
      body: 'Here is your weekly summary of activities.',
      variables: ['recipientName'],
    },
  },

  task_reminder: {
    email: {
      type: 'task_reminder',
      channel: 'email',
      subject: 'Task Reminder: {{entityName}}',
      title: 'Task Reminder',
      body: 'Reminder: {{entityName}} is due on {{dueDate}}.',
      variables: ['recipientName', 'entityName', 'dueDate', 'actionUrl'],
    },
    push: {
      type: 'task_reminder',
      channel: 'push',
      title: 'Task Reminder',
      body: '{{entityName}} due {{dueDate}}',
      variables: ['entityName', 'dueDate'],
    },
    in_app: {
      type: 'task_reminder',
      channel: 'in_app',
      title: 'Task Reminder',
      body: '{{entityName}} due {{dueDate}}',
      variables: ['entityName', 'dueDate'],
    },
  },
};

// ============================================================================
// Template Helpers
// ============================================================================

/**
 * Get template for notification type and channel
 */
export function getTemplate(
  type: NotificationType,
  channel: NotificationChannel
): TemplateDefinition | undefined {
  return DEFAULT_TEMPLATES[type]?.[channel];
}

/**
 * Render template with variables
 */
export function renderTemplate(
  template: string,
  variables: Record<string, unknown>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const value = variables[key];
    return value !== undefined ? String(value) : '';
  });
}

/**
 * Get all available templates
 */
export function getAllTemplates(): { type: NotificationType; channel: NotificationChannel; template: TemplateDefinition }[] {
  const result: { type: NotificationType; channel: NotificationChannel; template: TemplateDefinition }[] = [];
  
  for (const [type, channels] of Object.entries(DEFAULT_TEMPLATES)) {
    for (const [channel, template] of Object.entries(channels)) {
      if (template) {
        result.push({
          type: type as NotificationType,
          channel: channel as NotificationChannel,
          template: template as TemplateDefinition,
        });
      }
    }
  }
  
  return result;
}

/**
 * Check if template exists for type and channel
 */
export function hasTemplate(type: NotificationType, channel: NotificationChannel): boolean {
  return !!DEFAULT_TEMPLATES[type]?.[channel];
}
