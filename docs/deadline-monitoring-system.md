# Deadline Monitoring System

## Overview

The Deadline Monitoring System is an automated service that enforces ADD-FIN-001 policy deadlines for:

1. **Accountability Submissions** - 14-day deadline for materials, 7-day for petty cash
2. **Variance Investigations** - 48-hour resolution deadline
3. **Monthly Reconciliations** - By 5th working day of following month

The system runs hourly via Cloud Functions, automatically detecting overdue items, sending notifications, and escalating critical issues.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Cloud Scheduler (Cron)                     │
│  ┌──────────────────────┐    ┌──────────────────────┐       │
│  │  Hourly Check        │    │  Daily Summary       │       │
│  │  (0 * * * *)         │    │  (0 8 * * *)         │       │
│  └──────────┬───────────┘    └──────────┬───────────┘       │
└─────────────┼──────────────────────────┼──────────────────┬──┘
              │                          │                  │
              ▼                          ▼                  │
┌─────────────────────────────────────────────────────┐     │
│         Cloud Functions (Pub/Sub Triggered)          │     │
│  ┌──────────────────────────────────────────────┐   │     │
│  │  hourlyDeadlineCheck()                       │   │     │
│  │  - Check overdue accountabilities            │   │     │
│  │  - Check overdue investigations              │   │     │
│  │  - Check reconciliation deadlines            │   │     │
│  └──────────────────┬───────────────────────────┘   │     │
│                     │                                │     │
│                     ▼                                │     │
│  ┌──────────────────────────────────────────────┐   │     │
│  │  DeadlineMonitoringService                   │   │     │
│  │  - runDeadlineChecks()                       │   │     │
│  │  - checkOverdueAccountabilities()            │   │     │
│  │  - checkOverdueInvestigations()              │   │     │
│  │  - checkReconciliationDeadlines()            │   │     │
│  │  - escalateOverdueAccountability()           │   │     │
│  │  - escalateOverdueInvestigation()            │   │     │
│  └──────────────────┬───────────────────────────┘   │     │
└────────────────────┼──────────────────────────────────┘     │
                     │                                        │
                     ▼                                        │
┌─────────────────────────────────────────────────────┐      │
│                    Firestore                         │      │
│  ┌──────────────────────────────────────────────┐   │      │
│  │  Collections Updated:                        │   │      │
│  │  - requisitions (accountabilityStatus)       │   │      │
│  │  - variance_investigations (status)          │   │      │
│  │  - notifications (new)                       │   │      │
│  │  - deadline_monitoring_logs (new)            │   │      │
│  └──────────────────────────────────────────────┘   │      │
└──────────────────────────────────────────────────────┘      │
                                                               │
                   Manual Triggers                            │
                   (Admin Only) ◄──────────────────────────────┘
                   - triggerDeadlineCheck()
                   - getProjectDeadlineSummary()
```

## Components

### 1. DeadlineMonitoringService

**Location:** `src/subsidiaries/advisory/delivery/core/services/deadline-monitoring.service.ts`

**Key Methods:**

#### `runDeadlineChecks(): Promise<DeadlineCheckResult>`
Main entry point - runs all deadline checks in parallel.

**Returns:**
```typescript
{
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
```

#### `checkOverdueAccountabilities(): Promise<DeadlineAction[]>`
- Queries requisitions with `accountabilityStatus: 'pending'` and `status: 'paid'`
- Checks if `accountabilityDueDate` < now
- Marks as `accountabilityStatus: 'overdue'`
- Sends notification to responsible person
- Escalates to project manager if >14 days overdue

#### `checkOverdueInvestigations(): Promise<DeadlineAction[]>`
- Queries variance_investigations with `status: ['pending', 'in_progress']`
- Checks if `deadline` < now (48 hours from creation)
- Marks as `status: 'overdue'`
- Sends notification to assigned person
- Escalates to finance manager immediately

#### `checkReconciliationDeadlines(): Promise<DeadlineAction[]>`
- For each active project, checks if monthly reconciliation exists for current month
- Calculates 5th working day deadline using `calculate5thWorkingDay()`
- If past deadline and no reconciliation, sends notification to finance team
- If approaching deadline (within 2 days), sends reminder

#### `getDeadlineSummary(projectId?: string): Promise<Summary>`
Returns current deadline status for dashboard display.

### 2. Cloud Functions

**Location:** `functions/src/scheduled/deadline-monitoring.ts`

#### `hourlyDeadlineCheck`
- **Schedule:** Every hour at minute 0 (`0 * * * *`)
- **Timeout:** 9 minutes
- **Memory:** 512MB
- **Action:** Runs full deadline check, logs results, alerts if high number of issues

#### `dailyDeadlineSummary`
- **Schedule:** 8:00 AM EAT daily (`0 8 * * *`)
- **Timeout:** 5 minutes
- **Memory:** 256MB
- **Action:** Generates daily summary, sends notification to finance team

#### `triggerDeadlineCheck` (Callable)
- **Auth:** Admin only
- **Action:** Manually trigger deadline check
- **Use Case:** Testing, immediate check after configuration change

#### `getProjectDeadlineSummary` (Callable)
- **Auth:** Authenticated users
- **Action:** Get deadline summary for specific project or organization-wide
- **Use Case:** Dashboard widget, project overview page

### 3. Cloud Scheduler Configuration

**Location:** `functions/scheduler-config.yaml`

**Jobs:**
1. `hourly-deadline-check` - Triggers hourly deadline check
2. `daily-deadline-summary` - Triggers daily summary at 8 AM

**Deployment:**
```bash
# Enable Cloud Scheduler API
gcloud services enable cloudscheduler.googleapis.com

# Create hourly job
gcloud scheduler jobs create pubsub hourly-deadline-check \
  --schedule="0 * * * *" \
  --time-zone="Africa/Nairobi" \
  --topic="deadline-monitoring-hourly" \
  --message-body="{}" \
  --description="Hourly check for overdue accountabilities, investigations, and reconciliations"

# Create daily summary job
gcloud scheduler jobs create pubsub daily-deadline-summary \
  --schedule="0 8 * * *" \
  --time-zone="Africa/Nairobi" \
  --topic="deadline-monitoring-daily" \
  --message-body="{}" \
  --description="Daily summary of deadline status"

# Verify
gcloud scheduler jobs list

# Test manually
gcloud scheduler jobs run hourly-deadline-check
```

## Deadline Policies

### Accountability Deadlines

**Policy:** ADD-FIN-001 Section 5

| Advance Type    | Deadline | Action if Overdue                                      |
|-----------------|----------|--------------------------------------------------------|
| Materials       | 14 days  | Mark overdue, notify user, block new requisitions      |
| Labor           | 7 days   | Mark overdue, notify user, block new requisitions      |
| Equipment       | 14 days  | Mark overdue, notify user, block new requisitions      |
| Transport       | 7 days   | Mark overdue, notify user, block new requisitions      |
| Miscellaneous   | 7 days   | Mark overdue, notify user, block new requisitions      |

**Escalation:**
- **Day 1-14:** Notification to responsible person
- **Day 15+:** Escalation to project manager, potential disciplinary action

### Variance Investigation Deadlines

**Policy:** ADD-FIN-001 Section 6

| Variance Level | Deadline  | Action if Overdue                                     |
|----------------|-----------|-------------------------------------------------------|
| Moderate (2-5%)| 48 hours  | Escalate to finance manager                           |
| Severe (>5%)   | 48 hours  | Escalate to finance manager, assign personal liability|

### Reconciliation Deadlines

**Policy:** ADD-FIN-001 Section 7

| Report Type | Deadline                    | Action if Overdue                        |
|-------------|-----------------------------|------------------------------------------|
| Monthly     | 5th working day of next month| Notify finance team, escalate if >5 days|
| Quarterly   | 10th working day            | Notify finance manager                   |
| Annual      | 15th working day            | Notify CFO                               |

**Working Day Calculation:**
- Excludes weekends (Saturday, Sunday)
- TODO: Exclude Kenya public holidays

## Notification System

### Notification Types

#### 1. Accountability Overdue
- **Recipient:** Requisition creator (responsible person)
- **Severity:** Warning (1-7 days), Critical (8+ days)
- **Message:** "Your accountability for requisition X is Y days overdue. Please submit immediately."
- **Action URL:** `/delivery/accountabilities/create?requisitionId={id}`

#### 2. Investigation Overdue
- **Recipient:** Assigned investigator
- **Severity:** Critical
- **Message:** "Your variance investigation is X hours overdue. Please provide resolution immediately."
- **Action URL:** `/delivery/investigations/{id}`

#### 3. Reconciliation Due
- **Recipient:** Finance team
- **Severity:** Info (reminder), Warning (1-5 days overdue), Critical (>5 days overdue)
- **Message:** "Monthly reconciliation for Project X is due/overdue."
- **Action URL:** `/delivery/reconciliation/create?projectId={id}&month={month}`

#### 4. Escalation
- **Recipient:** Project manager (accountability) or Finance manager (investigation)
- **Severity:** Critical
- **Message:** "ESCALATION: [Item] is severely overdue. Action required."
- **Action URL:** Relevant entity page

### Notification Storage

**Collection:** `notifications`

```typescript
{
  type: 'accountability_overdue' | 'investigation_overdue' | 'reconciliation_due' | 'escalation';
  severity: 'info' | 'warning' | 'critical';
  recipientId: string;
  recipientRole?: string;
  subject: string;
  message: string;
  entityId: string;
  actionUrl?: string;
  metadata?: any;
  createdAt: Timestamp;
  read: boolean;
  status: 'sent';
}
```

## Monitoring & Logging

### Deadline Monitoring Logs

**Collection:** `deadline_monitoring_logs`

```typescript
{
  timestamp: Timestamp;
  type: 'hourly_check' | 'daily_summary' | 'manual_trigger';
  totalChecked?: number;
  summary?: {
    overdueAccountabilities: number;
    overdueInvestigations: number;
    overdueReconciliations: number;
    escalations: number;
    notifications: number;
  };
  duration?: number; // milliseconds
  status: 'success' | 'error';
  error?: string;
  stack?: string;
  triggeredBy?: string; // For manual triggers
}
```

### Cloud Function Logs

View logs:
```bash
# All deadline monitoring logs
gcloud logging read "resource.type=cloud_function AND resource.labels.function_name:deadline" --limit=100

# Errors only
gcloud logging read "resource.type=cloud_function AND resource.labels.function_name:deadline AND severity>=ERROR" --limit=50

# Specific function
gcloud logging read "resource.type=cloud_function AND resource.labels.function_name=hourlyDeadlineCheck" --limit=50
```

### Alert Metrics

**High Alert Threshold:**
- Overdue accountabilities > 10
- Overdue investigations > 5

When threshold exceeded:
- Warning logged to console
- Notification sent to admin role

## Dashboard Integration

### Deadline Summary Widget

**Component:** `DeadlineSummaryWidget.tsx` (to be created)

**Data Source:** `getProjectDeadlineSummary()` callable function

**Display:**
```
┌─────────────────────────────────────┐
│    Deadline Status                  │
├─────────────────────────────────────┤
│ 🔴 Overdue Accountabilities:    5   │
│ 🔴 Overdue Investigations:      2   │
│ 🟡 Pending Reconciliations:     1   │
│ 🟢 Upcoming Deadlines (3 days): 8   │
└─────────────────────────────────────┘
```

**Usage:**
```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const getSummary = httpsCallable(functions, 'getProjectDeadlineSummary');

const { data } = await getSummary({ projectId: 'project-123' });
// data.summary: { overdueAccountabilities, overdueInvestigations, ... }
```

### Real-Time Updates

Use Firestore listeners for live updates:

```typescript
// Listen to notifications
const unsubscribe = onSnapshot(
  query(
    collection(db, 'notifications'),
    where('recipientId', '==', currentUserId),
    where('read', '==', false),
    orderBy('createdAt', 'desc')
  ),
  (snapshot) => {
    const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    updateNotificationBadge(notifications.length);
  }
);
```

## Testing

### Manual Testing

1. **Test Overdue Accountability:**
   ```typescript
   // Create requisition with past accountability due date
   await createRequisition({
     ...requisitionData,
     status: 'paid',
     accountabilityStatus: 'pending',
     accountabilityDueDate: new Date('2026-01-01'), // Past date
   });

   // Trigger manual check
   const triggerCheck = httpsCallable(functions, 'triggerDeadlineCheck');
   await triggerCheck();

   // Verify: requisition.accountabilityStatus === 'overdue'
   // Verify: notification created
   ```

2. **Test Overdue Investigation:**
   ```typescript
   // Create investigation with past deadline
   await createVarianceInvestigation({
     ...investigationData,
     status: 'pending',
     deadline: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
   });

   // Trigger check
   await triggerCheck();

   // Verify: investigation.status === 'overdue'
   // Verify: escalation notification created
   ```

3. **Test Reconciliation Reminder:**
   ```typescript
   // Wait until after 5th working day of current month
   // Ensure no reconciliation report exists for current month

   // Trigger check
   await triggerCheck();

   // Verify: notification sent to finance team
   ```

### Automated Testing

**Unit Tests:** (to be created)
- Test `calculate5thWorkingDay()` with various month starts
- Test overdue detection logic
- Test escalation thresholds

**Integration Tests:** (to be created)
- Test full deadline check flow
- Test notification creation
- Test batch updates

## Deployment

### Prerequisites

1. Firebase project with Firestore and Cloud Functions enabled
2. Cloud Scheduler API enabled
3. Firebase Admin SDK initialized
4. Node.js 18+ for Cloud Functions

### Deployment Steps

```bash
# 1. Install dependencies
cd functions
npm install

# 2. Deploy Cloud Functions
firebase deploy --only functions:hourlyDeadlineCheck,functions:dailyDeadlineSummary,functions:triggerDeadlineCheck,functions:getProjectDeadlineSummary

# 3. Create Cloud Scheduler jobs
gcloud scheduler jobs create pubsub hourly-deadline-check \
  --schedule="0 * * * *" \
  --time-zone="Africa/Nairobi" \
  --topic="deadline-monitoring-hourly" \
  --message-body="{}"

gcloud scheduler jobs create pubsub daily-deadline-summary \
  --schedule="0 8 * * *" \
  --time-zone="Africa/Nairobi" \
  --topic="deadline-monitoring-daily" \
  --message-body="{}"

# 4. Verify deployment
gcloud scheduler jobs list
firebase functions:log --only hourlyDeadlineCheck

# 5. Test manually
gcloud scheduler jobs run hourly-deadline-check
```

### Environment Variables

No environment variables required - service uses Firebase Admin SDK with default credentials.

### Rollback

```bash
# Pause Cloud Scheduler jobs
gcloud scheduler jobs pause hourly-deadline-check
gcloud scheduler jobs pause daily-deadline-summary

# Rollback Cloud Functions to previous version
firebase functions:delete hourlyDeadlineCheck
firebase functions:delete dailyDeadlineSummary
# Then redeploy previous version

# Delete Cloud Scheduler jobs
gcloud scheduler jobs delete hourly-deadline-check
gcloud scheduler jobs delete daily-deadline-summary
```

## Troubleshooting

### Common Issues

#### 1. Cloud Function Timeout

**Error:** `Function execution took 540001 ms, finished with status: timeout`

**Solution:**
- Increase `timeoutSeconds` in function configuration
- Optimize queries with composite indexes
- Process in smaller batches

#### 2. Too Many Notifications

**Error:** Large number of notifications flooding users

**Solution:**
- Implement notification batching (daily digest)
- Add user preferences for notification frequency
- Deduplicate notifications (don't resend if already notified in last 24h)

#### 3. Cloud Scheduler Not Triggering

**Error:** No logs in Cloud Functions

**Solution:**
```bash
# Check job status
gcloud scheduler jobs describe hourly-deadline-check

# Check job execution history
gcloud logging read "resource.type=cloud_scheduler_job AND resource.labels.job_id=hourly-deadline-check" --limit=10

# Manually trigger
gcloud scheduler jobs run hourly-deadline-check
```

#### 4. Firestore Permission Denied

**Error:** `Missing or insufficient permissions`

**Solution:**
- Verify Cloud Functions service account has Firestore access
- Check Firestore security rules allow service account writes

## Future Enhancements

1. **Holiday Calendar Integration**
   - Integrate Kenya public holiday calendar
   - Exclude holidays from working day calculation

2. **Notification Preferences**
   - User preferences for notification channels (email, SMS, in-app)
   - Notification frequency settings (immediate, daily digest, weekly)

3. **Smart Escalation**
   - AI-based prediction of likely overdue items
   - Proactive reminders before deadline

4. **Performance Optimization**
   - Implement cursor-based pagination for large datasets
   - Cache frequently accessed data (project managers, finance team)

5. **Analytics Dashboard**
   - Historical trends of overdue items
   - Compliance scoring per project/user
   - Predictive analytics

## Support

For issues or questions, contact:
- **Technical Support:** [GitHub Issues](https://github.com/your-org/dawinos/issues)
- **Documentation:** [Notion Workspace](https://notion.so/your-workspace)
