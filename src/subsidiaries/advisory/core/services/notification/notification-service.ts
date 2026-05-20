/**
 * NOTIFICATION SERVICE
 * 
 * Handles sending notifications across multiple channels.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../../../../../firebase/config';
import { COLLECTION_PATHS } from '../../firebase/collections';
import {
  Notification,
  NotificationData,
  NotificationRecipient,
  NotificationPreferences,
  NotificationChannel,
  SendNotificationRequest,
  SendNotificationResult,
  RecipientResult,
  DeliveryStatus,
  DEFAULT_NOTIFICATION_PREFERENCES,
  TemplateVariables,
} from './notification-types';
import { getTemplate, renderTemplate } from './notification-templates';

// ============================================================================
// Notification Service Class
// ============================================================================

export class NotificationService {
  private static instance: NotificationService;
  private subscriptions: Map<string, Unsubscribe> = new Map();

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // --------------------------------------------------------------------------
  // Send Notifications
  // --------------------------------------------------------------------------

  /**
   * Send notifications to recipients
   */
  async send(request: SendNotificationRequest): Promise<SendNotificationResult> {
    const { notification, recipients, templateVariables, options } = request;
    const results: RecipientResult[] = [];
    const notificationIds: string[] = [];
    const errors: string[] = [];

    for (const recipient of recipients) {
      try {
        const result = await this.sendToRecipient(
          notification,
          recipient,
          templateVariables,
          options
        );
        results.push(result);
        if (result.notificationId) {
          notificationIds.push(result.notificationId);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to send to ${recipient.userId}: ${message}`);
        results.push({
          userId: recipient.userId,
          channelsAttempted: [],
          channelsSucceeded: [],
          channelsFailed: [],
          skipped: true,
          skipReason: message,
        });
      }
    }

    return {
      success: errors.length === 0,
      notificationIds,
      recipientResults: results,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Send notification to single recipient
   */
  private async sendToRecipient(
    notification: NotificationData,
    recipient: NotificationRecipient,
    templateVariables?: TemplateVariables,
    options?: SendNotificationRequest['options']
  ): Promise<RecipientResult> {
    const { respectPreferences = true, respectQuietHours = true } = options || {};

    // Load user preferences if needed
    let preferences: NotificationPreferences | null = null;
    if (respectPreferences || respectQuietHours) {
      preferences = await this.getPreferences(recipient.userId);
    }

    // Check if notification should be skipped
    if (preferences && !preferences.enabled) {
      return {
        userId: recipient.userId,
        channelsAttempted: [],
        channelsSucceeded: [],
        channelsFailed: [],
        skipped: true,
        skipReason: 'Notifications disabled',
      };
    }

    // Check quiet hours
    if (preferences && respectQuietHours && this.isQuietHours(preferences)) {
      // During quiet hours, only send in-app notifications
      const notificationId = await this.createNotificationRecord(
        notification,
        recipient,
        ['in_app'],
        templateVariables,
        options
      );

      return {
        userId: recipient.userId,
        notificationId,
        channelsAttempted: ['in_app'],
        channelsSucceeded: ['in_app'],
        channelsFailed: [],
        skipped: false,
        skipReason: 'Quiet hours - in-app only',
      };
    }

    // Determine channels to use
    const channels = this.determineChannels(notification, recipient, preferences);

    if (channels.length === 0) {
      return {
        userId: recipient.userId,
        channelsAttempted: [],
        channelsSucceeded: [],
        channelsFailed: [],
        skipped: true,
        skipReason: 'No channels available',
      };
    }

    // Create notification record
    const notificationId = await this.createNotificationRecord(
      notification,
      recipient,
      channels,
      templateVariables,
      options
    );

    // Send via each channel
    const channelsSucceeded: NotificationChannel[] = [];
    const channelsFailed: NotificationChannel[] = [];

    for (const channel of channels) {
      try {
        await this.sendViaChannel(
          channel,
          notification,
          recipient,
          templateVariables
        );
        channelsSucceeded.push(channel);
        
        // Update delivery status
        await this.updateDeliveryStatus(recipient.userId, notificationId, channel, {
          status: 'sent',
          sentAt: Timestamp.now(),
        });
      } catch (error) {
        channelsFailed.push(channel);
        const message = error instanceof Error ? error.message : 'Unknown error';
        
        await this.updateDeliveryStatus(recipient.userId, notificationId, channel, {
          status: 'failed',
          failedAt: Timestamp.now(),
          error: message,
        });
      }
    }

    return {
      userId: recipient.userId,
      notificationId,
      channelsAttempted: channels,
      channelsSucceeded,
      channelsFailed,
      skipped: false,
    };
  }

  /**
   * Send via specific channel
   */
  private async sendViaChannel(
    channel: NotificationChannel,
    notification: NotificationData,
    recipient: NotificationRecipient,
    templateVariables?: TemplateVariables
  ): Promise<void> {
    const template = getTemplate(notification.type, channel);
    
    const variables: TemplateVariables = {
      recipientName: recipient.name,
      recipientEmail: recipient.email,
      ...templateVariables,
    };

    const title = template 
      ? renderTemplate(template.title, variables)
      : notification.title;
    
    const body = template
      ? renderTemplate(template.body, variables)
      : notification.body;

    switch (channel) {
      case 'email':
        await this.sendEmail(recipient, title, body, template, variables);
        break;
      case 'sms':
        await this.sendSMS(recipient, body);
        break;
      case 'push':
        await this.sendPush(recipient, title, body, notification);
        break;
      case 'in_app':
        // Already created record, nothing more to do
        break;
    }
  }

  /**
   * Send email notification
   */
  private async sendEmail(
    recipient: NotificationRecipient,
    subject: string,
    body: string,
    template?: { htmlTemplate?: string },
    variables?: TemplateVariables
  ): Promise<void> {
    if (!recipient.email) {
      throw new Error('No email address');
    }

    // Queue for Cloud Functions to send via SendGrid/SES
    const emailRef = doc(collection(db, 'mail'));
    await setDoc(emailRef, {
      to: recipient.email,
      message: {
        subject,
        text: body,
        html: template?.htmlTemplate 
          ? renderTemplate(template.htmlTemplate, variables || {})
          : `<p>${body}</p>`,
      },
      createdAt: Timestamp.now(),
    });
  }

  /**
   * Send SMS notification
   */
  private async sendSMS(
    recipient: NotificationRecipient,
    body: string
  ): Promise<void> {
    if (!recipient.phone) {
      throw new Error('No phone number');
    }

    // Queue for Cloud Functions to send via Twilio/Africa's Talking
    const smsRef = doc(collection(db, 'sms'));
    await setDoc(smsRef, {
      to: recipient.phone,
      body,
      createdAt: Timestamp.now(),
    });
  }

  /**
   * Send push notification
   */
  private async sendPush(
    recipient: NotificationRecipient,
    title: string,
    body: string,
    notification: NotificationData
  ): Promise<void> {
    if (!recipient.fcmToken) {
      throw new Error('No FCM token');
    }

    // Queue for Cloud Functions to send via FCM
    const pushRef = doc(collection(db, 'push'));
    await setDoc(pushRef, {
      token: recipient.fcmToken,
      notification: { title, body },
      data: {
        type: notification.type,
        engagementId: notification.engagementId,
        entityType: notification.entityType,
        entityId: notification.entityId,
        actionUrl: notification.actionUrl,
      },
      createdAt: Timestamp.now(),
    });
  }

  // --------------------------------------------------------------------------
  // Notification Records
  // --------------------------------------------------------------------------

  /**
   * Create notification record in Firestore
   */
  private async createNotificationRecord(
    notification: NotificationData,
    recipient: NotificationRecipient,
    channels: NotificationChannel[],
    _templateVariables?: TemplateVariables,
    options?: SendNotificationRequest['options']
  ): Promise<string> {
    const now = Timestamp.now();
    const notificationRef = doc(
      collection(db, COLLECTION_PATHS.USERS, recipient.userId, 'notifications')
    );

    const deliveryStatus: Record<NotificationChannel, DeliveryStatus> = {} as Record<NotificationChannel, DeliveryStatus>;
    for (const channel of channels) {
      deliveryStatus[channel] = { status: 'pending' };
    }

    const record: Notification = {
      id: notificationRef.id,
      recipientId: recipient.userId,
      ...notification,
      channels,
      deliveryStatus,
      createdAt: now,
      groupId: options?.groupId,
      batchId: options?.batchId,
    };

    await setDoc(notificationRef, record);
    return notificationRef.id;
  }

  /**
   * Update delivery status for a channel
   */
  private async updateDeliveryStatus(
    userId: string,
    notificationId: string,
    channel: NotificationChannel,
    status: DeliveryStatus
  ): Promise<void> {
    const notificationRef = doc(
      db,
      COLLECTION_PATHS.USERS,
      userId,
      'notifications',
      notificationId
    );
    
    await updateDoc(notificationRef, {
      [`deliveryStatus.${channel}`]: status,
    });
  }

  // --------------------------------------------------------------------------
  // Read Operations
  // --------------------------------------------------------------------------

  /**
   * Get user's notifications
   */
  async getNotifications(
    userId: string,
    options?: {
      unreadOnly?: boolean;
      category?: string;
      limit?: number;
    }
  ): Promise<Notification[]> {
    let q = query(
      collection(db, COLLECTION_PATHS.USERS, userId, 'notifications'),
      orderBy('createdAt', 'desc')
    );

    if (options?.unreadOnly) {
      q = query(q, where('readAt', '==', null));
    }

    if (options?.category) {
      q = query(q, where('category', '==', options.category));
    }

    if (options?.limit) {
      q = query(q, limit(options.limit));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Notification[];
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    const q = query(
      collection(db, COLLECTION_PATHS.USERS, userId, 'notifications'),
      where('readAt', '==', null)
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const notificationRef = doc(
      db,
      COLLECTION_PATHS.USERS,
      userId,
      'notifications',
      notificationId
    );
    await updateDoc(notificationRef, {
      readAt: Timestamp.now(),
    });
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    const notifications = await this.getNotifications(userId, { unreadOnly: true });
    
    for (const notification of notifications) {
      await this.markAsRead(userId, notification.id);
    }
  }

  // --------------------------------------------------------------------------
  // Preferences
  // --------------------------------------------------------------------------

  /**
   * Get user notification preferences
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const prefsRef = doc(db, COLLECTION_PATHS.USERS, userId, 'settings', 'notifications');
    const snapshot = await getDoc(prefsRef);
    
    if (snapshot.exists()) {
      return snapshot.data() as NotificationPreferences;
    }

    // Return defaults
    return {
      userId,
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      updatedAt: Timestamp.now(),
    };
  }

  /**
   * Update user notification preferences
   */
  async updatePreferences(
    userId: string,
    updates: Partial<NotificationPreferences>
  ): Promise<void> {
    const prefsRef = doc(db, COLLECTION_PATHS.USERS, userId, 'settings', 'notifications');
    
    await setDoc(prefsRef, {
      userId,
      ...updates,
      updatedAt: Timestamp.now(),
    }, { merge: true });
  }

  // --------------------------------------------------------------------------
  // Subscriptions
  // --------------------------------------------------------------------------

  /**
   * Subscribe to user's notifications
   */
  subscribeToNotifications(
    userId: string,
    callback: (notifications: Notification[]) => void,
    options?: { limit?: number }
  ): Unsubscribe {
    const q = query(
      collection(db, COLLECTION_PATHS.USERS, userId, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(options?.limit || 50)
    );

    const unsubscribe = onSnapshot(q, snapshot => {
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Notification[];
      callback(notifications);
    });

    this.subscriptions.set(`notifications:${userId}`, unsubscribe);
    return unsubscribe;
  }

  /**
   * Subscribe to unread count
   */
  subscribeToUnreadCount(
    userId: string,
    callback: (count: number) => void
  ): Unsubscribe {
    const q = query(
      collection(db, COLLECTION_PATHS.USERS, userId, 'notifications'),
      where('readAt', '==', null)
    );

    const unsubscribe = onSnapshot(q, snapshot => {
      callback(snapshot.size);
    });

    this.subscriptions.set(`unread:${userId}`, unsubscribe);
    return unsubscribe;
  }

  /**
   * Unsubscribe all
   */
  unsubscribeAll(): void {
    this.subscriptions.forEach(unsubscribe => unsubscribe());
    this.subscriptions.clear();
  }

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  /**
   * Determine which channels to use
   */
  private determineChannels(
    notification: NotificationData,
    recipient: NotificationRecipient,
    preferences: NotificationPreferences | null
  ): NotificationChannel[] {
    // If recipient specifies channels, use those
    if (recipient.channels && recipient.channels.length > 0) {
      return recipient.channels.filter(c => this.canUseChannel(c, recipient));
    }

    // Use preferences or defaults
    const categoryPrefs = preferences?.categorySettings?.[notification.category];
    
    let channels: NotificationChannel[];
    if (categoryPrefs) {
      // Check if category is enabled
      if (!categoryPrefs.enabled) {
        return [];
      }

      // Check minimum priority
      const priorityOrder: NotificationData['priority'][] = ['low', 'normal', 'high', 'urgent'];
      const notificationPriorityIndex = priorityOrder.indexOf(notification.priority);
      const minPriorityIndex = priorityOrder.indexOf(categoryPrefs.minimumPriority);
      
      if (notificationPriorityIndex < minPriorityIndex) {
        return []; // Below minimum priority
      }
      
      channels = categoryPrefs.channels;
    } else {
      // Default channels based on priority
      switch (notification.priority) {
        case 'urgent':
          channels = ['email', 'sms', 'push', 'in_app'];
          break;
        case 'high':
          channels = ['email', 'push', 'in_app'];
          break;
        case 'normal':
          channels = ['email', 'in_app'];
          break;
        case 'low':
          channels = ['in_app'];
          break;
      }
    }

    // Filter by what's available and enabled
    return channels.filter(c => 
      this.canUseChannel(c, recipient) &&
      (preferences?.channels?.[c] !== false)
    );
  }

  /**
   * Check if channel can be used for recipient
   */
  private canUseChannel(
    channel: NotificationChannel,
    recipient: NotificationRecipient
  ): boolean {
    switch (channel) {
      case 'email':
        return !!recipient.email;
      case 'sms':
        return !!recipient.phone;
      case 'push':
        return !!recipient.fcmToken;
      case 'in_app':
        return true;
    }
  }

  /**
   * Check if currently in quiet hours
   */
  private isQuietHours(preferences: NotificationPreferences): boolean {
    if (!preferences.quietHoursEnabled || !preferences.quietHoursStart || !preferences.quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const timezone = preferences.timezone || 'Africa/Nairobi';
    
    // Convert current time to user's timezone
    const userTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const currentMinutes = userTime.getHours() * 60 + userTime.getMinutes();
    
    // Parse quiet hours
    const [startHour, startMin] = preferences.quietHoursStart.split(':').map(Number);
    const [endHour, endMin] = preferences.quietHoursEnd.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    // Handle overnight quiet hours (e.g., 22:00 to 07:00)
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
    
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
}

// Export singleton
export const notificationService = NotificationService.getInstance();
