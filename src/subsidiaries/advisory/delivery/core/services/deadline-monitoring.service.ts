/**
 * Deadline Monitoring Service
 *
 * Monitors and enforces deadlines for:
 * - Accountability submissions (14-day deadline for materials, 7-day for petty cash)
 * - Variance investigations (48-hour resolution deadline)
 * - Monthly reconciliations (5th working day deadline)
 *
 * Runs as Cloud Function on hourly schedule
 */

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  Timestamp,
  writeBatch,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../../../../../firebase/config';
import {
  Requisition,
  VarianceInvestigation,
} from '../../types';
import { notificationService } from '../../../core/services/notification/notification-service';
import type {
  NotificationData,
  NotificationRecipient,
  NotificationPriority,
  NotificationCategory,
  NotificationType,
} from '../../../core/services/notification/notification-types';

export interface DeadlineCheckResult {
  timestamp: Date;
  totalChecked: number;
  actions: DeadlineAction[];
  summary: {
    overdueAccountabilities: number;
    overdueInvestigations: number;
    overdueReconciliations: number;
    escalations: number;
    notifications: number;
  };
}

export interface DeadlineAction {
  type: 'accountability_overdue' | 'investigation_overdue' | 'reconciliation_overdue' | 'escalation' | 'notification';
  entityType: 'requisition' | 'accountability' | 'investigation' | 'reconciliation';
  entityId: string;
  projectId: string;
  action: string;
  timestamp: Date;
  details?: any;
}

export interface OverdueAccountability {
  requisitionId: string;
  projectId: string;
  assignedTo: string;
  accountabilityDueDate: Date;
  daysOverdue: number;
  amount: number;
}

export interface OverdueInvestigation {
  investigationId: string;
  accountabilityId: string;
  projectId: string;
  assignedTo: string;
  deadline: Date;
  daysOverdue: number;
  varianceAmount: number;
}

export interface OverdueReconciliation {
  projectId: string;
  month: Date;
  deadline: Date;
  daysOverdue: number;
  assignedTo: string; // Finance team
}

export interface NotificationPayload {
  type: 'accountability_overdue' | 'investigation_overdue' | 'reconciliation_due' | 'escalation';
  severity: 'info' | 'warning' | 'critical';
  recipientId: string;
  recipientRole?: string;
  subject: string;
  message: string;
  entityId: string;
  actionUrl?: string;
  metadata?: any;
}

export class DeadlineMonitoringService {
  /**
   * Main entry point - run all deadline checks
   */
  async runDeadlineChecks(): Promise<DeadlineCheckResult> {
    const timestamp = new Date();
    const actions: DeadlineAction[] = [];

    // Run all checks in parallel
    const [
      accountabilityActions,
      investigationActions,
      reconciliationActions,
    ] = await Promise.all([
      this.checkOverdueAccountabilities(),
      this.checkOverdueInvestigations(),
      this.checkReconciliationDeadlines(),
    ]);

    actions.push(...accountabilityActions, ...investigationActions, ...reconciliationActions);

    // Calculate summary
    const summary = {
      overdueAccountabilities: accountabilityActions.filter(a => a.type === 'accountability_overdue').length,
      overdueInvestigations: investigationActions.filter(a => a.type === 'investigation_overdue').length,
      overdueReconciliations: reconciliationActions.filter(a => a.type === 'reconciliation_overdue').length,
      escalations: actions.filter(a => a.type === 'escalation').length,
      notifications: actions.filter(a => a.type === 'notification').length,
    };

    return {
      timestamp,
      totalChecked: actions.length,
      actions,
      summary,
    };
  }

  /**
   * Check for overdue accountabilities
   * - Accountability deadline passed but status still 'pending'
   * - Block new requisitions for users with overdue accountabilities
   */
  async checkOverdueAccountabilities(): Promise<DeadlineAction[]> {
    const actions: DeadlineAction[] = [];
    const now = new Date();

    // Query requisitions with pending accountability that are past due date
    const q = query(
      collection(db, 'requisitions'),
      where('accountabilityStatus', '==', 'pending'),
      where('status', '==', 'paid'), // Only check paid requisitions
      orderBy('accountabilityDueDate', 'asc'),
      limit(500) // Process in batches
    );

    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    const notifications: NotificationPayload[] = [];

    for (const docSnap of snapshot.docs) {
      const requisition = docSnap.data() as Requisition;

      if (!requisition.accountabilityDueDate) continue;

      const dueDate = requisition.accountabilityDueDate instanceof Timestamp
        ? requisition.accountabilityDueDate.toDate()
        : new Date(requisition.accountabilityDueDate);

      if (dueDate < now) {
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        // Mark as overdue
        batch.update(doc(db, 'requisitions', docSnap.id), {
          accountabilityStatus: 'overdue',
          updatedAt: Timestamp.now(),
        });

        actions.push({
          type: 'accountability_overdue',
          entityType: 'requisition',
          entityId: docSnap.id,
          projectId: requisition.projectId,
          action: `Marked accountability as overdue (${daysOverdue} days past deadline)`,
          timestamp: now,
          details: { daysOverdue, dueDate, assignedTo: requisition.createdBy },
        });

        // Create notification
        notifications.push({
          type: 'accountability_overdue',
          severity: daysOverdue > 7 ? 'critical' : 'warning',
          recipientId: requisition.createdBy,
          subject: `Accountability Overdue: ${requisition.purpose}`,
          message: `Your accountability for requisition "${requisition.purpose}" is ${daysOverdue} days overdue. ` +
                   `Due date was ${dueDate.toLocaleDateString()}. ` +
                   `Please submit accountability immediately to avoid further escalation.`,
          entityId: docSnap.id,
          actionUrl: `/delivery/accountabilities/create?requisitionId=${docSnap.id}`,
          metadata: {
            requisitionNumber: requisition.requisitionNumber,
            amount: requisition.amountRequested,
            daysOverdue,
          },
        });

        // Escalate if severely overdue (>14 days)
        if (daysOverdue > 14) {
          const escalationNotification = await this.escalateOverdueAccountability(
            requisition,
            docSnap.id,
            daysOverdue
          );

          if (escalationNotification) {
            notifications.push(escalationNotification);
            actions.push({
              type: 'escalation',
              entityType: 'requisition',
              entityId: docSnap.id,
              projectId: requisition.projectId,
              action: `Escalated to project manager (${daysOverdue} days overdue)`,
              timestamp: now,
            });
          }
        }
      }
    }

    // Commit batch updates
    if (snapshot.docs.length > 0) {
      await batch.commit();
    }

    // Send notifications (delegate to notification service)
    await this.sendNotifications(notifications);

    return actions;
  }

  /**
   * Check for overdue variance investigations
   * - Investigation deadline (48 hours) passed but status still 'pending' or 'in_progress'
   * - Escalate to finance manager if not resolved
   */
  async checkOverdueInvestigations(): Promise<DeadlineAction[]> {
    const actions: DeadlineAction[] = [];
    const now = new Date();

    const q = query(
      collection(db, 'variance_investigations'),
      where('status', 'in', ['pending', 'in_progress']),
      orderBy('deadline', 'asc'),
      limit(500)
    );

    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    const notifications: NotificationPayload[] = [];

    for (const docSnap of snapshot.docs) {
      const investigation = docSnap.data() as VarianceInvestigation;

      const deadline = investigation.deadline instanceof Timestamp
        ? investigation.deadline.toDate()
        : new Date(investigation.deadline);

      if (deadline < now) {
        const hoursOverdue = Math.floor((now.getTime() - deadline.getTime()) / (1000 * 60 * 60));

        // Mark as overdue
        batch.update(doc(db, 'variance_investigations', docSnap.id), {
          status: 'overdue',
          updatedAt: Timestamp.now(),
        });

        actions.push({
          type: 'investigation_overdue',
          entityType: 'investigation',
          entityId: docSnap.id,
          projectId: investigation.projectId ?? "",
          action: `Marked investigation as overdue (${hoursOverdue} hours past deadline)`,
          timestamp: now,
          details: { hoursOverdue, deadline, assignedTo: investigation.assignedTo },
        });

        // Notify assigned person
        notifications.push({
          type: 'investigation_overdue',
          severity: 'critical',
          recipientId: investigation.assignedTo,
          subject: `Variance Investigation Overdue`,
          message: `Your variance investigation is ${hoursOverdue} hours overdue. ` +
                   `Deadline was ${deadline.toLocaleString()}. ` +
                   `Variance amount: ${investigation.varianceAmount}. ` +
                   `Please provide resolution immediately.`,
          entityId: docSnap.id,
          actionUrl: `/delivery/investigations/${docSnap.id}`,
          metadata: {
            accountabilityId: investigation.accountabilityId,
            varianceAmount: investigation.varianceAmount,
            hoursOverdue,
          },
        });

        // Escalate to finance manager
        const escalationNotification = await this.escalateOverdueInvestigation(
          investigation,
          docSnap.id,
          hoursOverdue
        );

        if (escalationNotification) {
          notifications.push(escalationNotification);
          actions.push({
            type: 'escalation',
            entityType: 'investigation',
            entityId: docSnap.id,
            projectId: investigation.projectId ?? "",
            action: `Escalated to finance manager (${hoursOverdue} hours overdue)`,
            timestamp: now,
          });
        }
      }
    }

    // Commit batch updates
    if (snapshot.docs.length > 0) {
      await batch.commit();
    }

    // Send notifications
    await this.sendNotifications(notifications);

    return actions;
  }

  /**
   * Check reconciliation deadlines
   * - Monthly reconciliation should be completed by 5th working day
   * - Alert finance team if approaching or past deadline
   */
  async checkReconciliationDeadlines(): Promise<DeadlineAction[]> {
    const actions: DeadlineAction[] = [];
    const now = new Date();
    const notifications: NotificationPayload[] = [];

    // Get all active projects
    const projectsSnapshot = await getDocs(
      query(collection(db, 'projects'), where('status', 'in', ['active', 'planning']))
    );

    for (const projectDoc of projectsSnapshot.docs) {
      const projectId = projectDoc.id;
      const projectData = projectDoc.data();

      // Check if current month reconciliation is done
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const deadline = this.calculate5thWorkingDay(currentMonthStart);

      // Only check if we're past the deadline
      if (now > deadline) {
        // Check if reconciliation exists for current month
        const reconQuery = query(
          collection(db, 'reconciliation_reports'),
          where('projectId', '==', projectId),
          where('month', '==', Timestamp.fromDate(currentMonthStart)),
          where('type', '==', 'monthly'),
          limit(1)
        );

        const reconSnapshot = await getDocs(reconQuery);

        if (reconSnapshot.empty) {
          const daysOverdue = Math.floor((now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24));

          actions.push({
            type: 'reconciliation_overdue',
            entityType: 'reconciliation',
            entityId: `${projectId}-${currentMonthStart.toISOString()}`,
            projectId,
            action: `Monthly reconciliation missing (${daysOverdue} days past 5th working day deadline)`,
            timestamp: now,
            details: { month: currentMonthStart, deadline, daysOverdue },
          });

          // Notify finance team
          notifications.push({
            type: 'reconciliation_due',
            severity: daysOverdue > 5 ? 'critical' : 'warning',
            recipientId: 'finance_team', // Placeholder - should resolve to actual finance team
            recipientRole: 'FINANCE',
            subject: `Monthly Reconciliation Overdue - ${projectData.name}`,
            message: `Monthly reconciliation for ${projectData.name} is ${daysOverdue} days overdue. ` +
                     `Deadline was ${deadline.toLocaleDateString()} (5th working day). ` +
                     `Please complete reconciliation immediately.`,
            entityId: projectId,
            actionUrl: `/delivery/reconciliation/create?projectId=${projectId}&month=${currentMonthStart.toISOString()}`,
            metadata: {
              projectCode: projectData.projectCode,
              month: currentMonthStart.toISOString(),
              daysOverdue,
            },
          });
        }
      } else {
        // Deadline approaching (within 2 days) - send reminder
        const daysUntilDeadline = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntilDeadline <= 2 && daysUntilDeadline > 0) {
          const reconQuery = query(
            collection(db, 'reconciliation_reports'),
            where('projectId', '==', projectId),
            where('month', '==', Timestamp.fromDate(currentMonthStart)),
            where('type', '==', 'monthly'),
            limit(1)
          );

          const reconSnapshot = await getDocs(reconQuery);

          if (reconSnapshot.empty) {
            notifications.push({
              type: 'reconciliation_due',
              severity: 'info',
              recipientId: 'finance_team',
              recipientRole: 'FINANCE',
              subject: `Reconciliation Reminder - ${projectData.name}`,
              message: `Monthly reconciliation for ${projectData.name} is due in ${daysUntilDeadline} day(s). ` +
                       `Deadline: ${deadline.toLocaleDateString()} (5th working day).`,
              entityId: projectId,
              actionUrl: `/delivery/reconciliation/create?projectId=${projectId}&month=${currentMonthStart.toISOString()}`,
              metadata: {
                projectCode: projectData.projectCode,
                month: currentMonthStart.toISOString(),
                daysUntilDeadline,
              },
            });

            actions.push({
              type: 'notification',
              entityType: 'reconciliation',
              entityId: `${projectId}-${currentMonthStart.toISOString()}`,
              projectId,
              action: `Sent reconciliation deadline reminder (${daysUntilDeadline} days remaining)`,
              timestamp: now,
            });
          }
        }
      }
    }

    // Send notifications
    await this.sendNotifications(notifications);

    return actions;
  }

  /**
   * Escalate overdue accountability to project manager
   */
  private async escalateOverdueAccountability(
    requisition: Requisition,
    requisitionId: string,
    daysOverdue: number
  ): Promise<NotificationPayload | null> {
    // Get project to find project manager
    const projectDoc = await getDocs(
      query(collection(db, 'projects'), where('__name__', '==', requisition.projectId), limit(1))
    );

    if (projectDoc.empty) return null;

    const project = projectDoc.docs[0].data();
    const projectManagerId = project.projectManagerId;

    if (!projectManagerId) return null;

    return {
      type: 'escalation',
      severity: 'critical',
      recipientId: projectManagerId,
      recipientRole: 'PROJECT_MANAGER',
      subject: `ESCALATION: Overdue Accountability - ${requisition.purpose}`,
      message: `A requisition accountability is severely overdue (${daysOverdue} days). ` +
               `Requisition: ${requisition.requisitionNumber}\n` +
               `Assigned to: ${requisition.createdBy}\n` +
               `Amount: ${requisition.amountRequested} ${requisition.currency}\n` +
               `Due date: ${requisition.accountabilityDueDate}\n\n` +
               `Action required: Please follow up with the responsible person to ensure immediate accountability submission. ` +
               `Consider disciplinary action if non-compliance continues.`,
      entityId: requisitionId,
      actionUrl: `/delivery/requisitions/${requisitionId}`,
      metadata: {
        requisitionNumber: requisition.requisitionNumber,
        amount: requisition.amountRequested,
        daysOverdue,
        assignedTo: requisition.createdBy,
      },
    };
  }

  /**
   * Escalate overdue investigation to finance manager
   */
  private async escalateOverdueInvestigation(
    investigation: VarianceInvestigation,
    investigationId: string,
    hoursOverdue: number
  ): Promise<NotificationPayload | null> {
    // Resolve finance manager from project team or organization
    let recipientId = 'finance_manager';
    try {
      const { collection: col, query: q, where: w, getDocs: gd, limit: lim } = await import('firebase/firestore');
      const { db } = await import('../../../../../firebase/config');
      const teamQuery = q(
        col(db, 'organization_members'),
        w('role', '==', 'FINANCE_MANAGER'),
        lim(1)
      );
      const snap = await gd(teamQuery);
      if (!snap.empty) {
        recipientId = snap.docs[0].id;
      }
    } catch {
      // Fall back to generic role
    }

    return {
      type: 'escalation',
      severity: 'critical',
      recipientId,
      recipientRole: 'FINANCE_MANAGER',
      subject: `ESCALATION: Overdue Variance Investigation`,
      message: `A variance investigation is overdue (${hoursOverdue} hours past 48-hour deadline). ` +
               `Investigation ID: ${investigationId}\n` +
               `Assigned to: ${investigation.assignedTo}\n` +
               `Variance amount: ${investigation.varianceAmount}\n` +
               `Accountability: ${investigation.accountabilityId}\n\n` +
               `Action required: Please review and resolve this investigation immediately. ` +
               `Determine if personal liability should be assigned.`,
      entityId: investigationId,
      actionUrl: `/delivery/investigations/${investigationId}`,
      metadata: {
        investigationId,
        varianceAmount: investigation.varianceAmount,
        hoursOverdue,
        assignedTo: investigation.assignedTo,
      },
    };
  }

  /**
   * Send notifications
   * Delegate to notification service (to be implemented)
   */
  private async sendNotifications(notifications: NotificationPayload[]): Promise<void> {
    if (notifications.length === 0) return;

    // Save notifications to Firestore for user dashboard (backup/audit trail)
    const batch = writeBatch(db);

    for (const notification of notifications) {
      const notificationRef = doc(collection(db, 'notifications'));
      batch.set(notificationRef, {
        ...notification,
        createdAt: Timestamp.now(),
        read: false,
        status: 'sent',
      });
    }

    await batch.commit();

    // Dispatch via notification service for multi-channel delivery
    for (const payload of notifications) {
      const notificationData: NotificationData = {
        type: this.mapPayloadType(payload.type),
        category: this.mapPayloadCategory(payload.type),
        priority: this.mapSeverityToPriority(payload.severity),
        title: payload.subject,
        body: payload.message,
        entityType: this.inferEntityType(payload.type),
        entityId: payload.entityId,
        actionUrl: payload.actionUrl,
        actionLabel: 'View Details',
        data: payload.metadata,
      };

      const recipient: NotificationRecipient = {
        userId: payload.recipientId,
        channels: ['in_app'],
      };

      try {
        await notificationService.send({
          notification: notificationData,
          recipients: [recipient],
          options: {
            respectPreferences: true,
            respectQuietHours: payload.severity !== 'critical',
          },
        });
      } catch (error) {
        console.error('[DeadlineMonitoringService] Notification send failed:', error);
      }
    }
  }

  private mapPayloadType(type: NotificationPayload['type']): NotificationType {
    switch (type) {
      case 'accountability_overdue': return 'action_required';
      case 'investigation_overdue': return 'action_required';
      case 'reconciliation_due': return 'report_due';
      case 'escalation': return 'approval_escalated';
      default: return 'action_required';
    }
  }

  private mapPayloadCategory(type: NotificationPayload['type']): NotificationCategory {
    if (type === 'reconciliation_due') return 'report';
    return 'alert';
  }

  private mapSeverityToPriority(severity: NotificationPayload['severity']): NotificationPriority {
    switch (severity) {
      case 'critical': return 'urgent';
      case 'warning': return 'high';
      case 'info': return 'normal';
      default: return 'normal';
    }
  }

  private inferEntityType(type: NotificationPayload['type']): string {
    if (type.includes('accountability')) return 'accountability';
    if (type.includes('investigation')) return 'investigation';
    if (type.includes('reconciliation')) return 'reconciliation';
    return 'deadline';
  }

  /**
   * Calculate 5th working day of the month
   * (Excludes weekends, TODO: Exclude holidays)
   */
  private calculate5thWorkingDay(monthStart: Date): Date {
    let workingDays = 0;
    let currentDate = new Date(monthStart);

    while (workingDays < 5) {
      // Check if it's a weekday (Monday = 1, Sunday = 0)
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }

      if (workingDays < 5) {
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    // Set to end of day for deadline
    currentDate.setHours(23, 59, 59, 999);

    return currentDate;
  }

  /**
   * Get summary statistics for dashboard
   */
  async getDeadlineSummary(projectId?: string): Promise<{
    overdueAccountabilities: number;
    overdueInvestigations: number;
    pendingReconciliations: number;
    upcomingDeadlines: number;
  }> {
    const now = new Date();

    // Count overdue accountabilities
    let accountabilityQuery = query(
      collection(db, 'requisitions'),
      where('accountabilityStatus', '==', 'overdue')
    );

    if (projectId) {
      accountabilityQuery = query(accountabilityQuery, where('projectId', '==', projectId));
    }

    const accountabilitySnapshot = await getDocs(accountabilityQuery);

    // Count overdue investigations
    let investigationQuery = query(
      collection(db, 'variance_investigations'),
      where('status', '==', 'overdue')
    );

    if (projectId) {
      investigationQuery = query(investigationQuery, where('projectId', '==', projectId));
    }

    const investigationSnapshot = await getDocs(investigationQuery);

    // Count pending reconciliations (current month)
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const deadline = this.calculate5thWorkingDay(currentMonthStart);

    let pendingReconciliations = 0;

    if (now > deadline) {
      let reconQuery = query(
        collection(db, 'reconciliation_reports'),
        where('month', '==', Timestamp.fromDate(currentMonthStart)),
        where('type', '==', 'monthly')
      );

      if (projectId) {
        reconQuery = query(reconQuery, where('projectId', '==', projectId));
      }

      const reconSnapshot = await getDocs(reconQuery);

      // Count projects without reconciliation
      const projectsQuery = projectId
        ? query(collection(db, 'projects'), where('__name__', '==', projectId))
        : query(collection(db, 'projects'), where('status', 'in', ['active', 'planning']));

      const projectsSnapshot = await getDocs(projectsQuery);
      pendingReconciliations = projectsSnapshot.size - reconSnapshot.size;
    }

    // Count upcoming deadlines (accountabilities due in next 3 days)
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    let upcomingQuery = query(
      collection(db, 'requisitions'),
      where('accountabilityStatus', '==', 'pending'),
      where('accountabilityDueDate', '<=', Timestamp.fromDate(threeDaysFromNow))
    );

    if (projectId) {
      upcomingQuery = query(upcomingQuery, where('projectId', '==', projectId));
    }

    const upcomingSnapshot = await getDocs(upcomingQuery);

    return {
      overdueAccountabilities: accountabilitySnapshot.size,
      overdueInvestigations: investigationSnapshot.size,
      pendingReconciliations,
      upcomingDeadlines: upcomingSnapshot.size,
    };
  }
}

export const deadlineMonitoringService = new DeadlineMonitoringService();
