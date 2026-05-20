/**
 * NOTIFICATION SERVICE - Public API
 */

// Types
export * from './notification-types';

// Templates
export {
  DEFAULT_TEMPLATES,
  getTemplate,
  renderTemplate,
  getAllTemplates,
  hasTemplate,
} from './notification-templates';

// Service
export {
  NotificationService,
  notificationService,
} from './notification-service';

// Hooks
export {
  useNotifications,
  useUnreadCount,
  useNotificationActions,
  useNotificationPreferences,
  useSendNotification,
  useNotificationSummary,
  useGroupedNotifications,
} from './notification-hooks';
