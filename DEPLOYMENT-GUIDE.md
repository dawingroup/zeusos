# Intelligence Layer Deployment & Setup Guide

## What Was Built

### 1. Tab Navigation System
- **IntelligenceLayout**: Unified tab navigation for all AI Intelligence modules
- Role-based tab visibility (Employee, Manager, Admin views)
- Consistent UI across Dashboard, My Tasks, Team Dashboard, and Admin Console

### 2. Manager Task Assignment System
- **TaskAssignmentDialog**: Modal for assigning/reassigning tasks
- **taskAssignmentService**: Backend functions for task management
- **Manager Dashboard enhancements**: Assignment buttons on all tasks

### 3. Business Event Generation Script
- Script to create business events for existing Design Manager projects
- Triggers Intelligence Layer task generation system
- Dry-run mode for safe testing

## Deployment Steps

### Step 1: Re-authenticate with Firebase

```bash
firebase login --reauth
```

Follow the browser authentication flow.

### Step 2: Deploy to Firebase

```bash
npm run build
firebase deploy
```

Or deploy specific targets:

```bash
# Deploy only hosting
firebase deploy --only hosting

# Deploy only functions
firebase deploy --only functions

# Deploy only Firestore indexes
firebase deploy --only firestore:indexes
```

### Step 3: Verify Deployment

1. Check Firebase Console: https://console.firebase.google.com/project/dawinos
2. Verify hosting is live
3. Check function deployment status
4. Confirm Firestore indexes are building

## Intelligence Layer Setup

### 1. Access the System

Navigate to your deployed app:
- **Employee view**: `/my-tasks` - View personal tasks
- **Manager view**: `/ai/team` - Manage team workload
- **Admin view**: `/ai/admin` - System configuration

### 2. Generate Business Events

For existing Design Manager projects:

```bash
# First, do a dry run to see what will happen
npm run generate:design-events -- --dry-run

# Then generate the events
npm run generate:design-events
```

This will:
1. Scan all existing Design Manager projects
2. Create business events based on project stage
3. Skip projects that already have events
4. Display statistics and results

### 3. Monitor Task Generation

After generating events:

1. Go to `/ai/admin` (Admin Console)
2. Check the Event Monitoring tab
3. Watch as events are processed
4. Verify tasks are being created
5. Check Task Management tab for generated tasks

### 4. Assign Tasks (Managers)

As a manager:

1. Go to `/ai/team` (Team Dashboard)
2. Click "Recent Tasks" tab
3. For each task:
   - Click **Assign** if unassigned
   - Click **Reassign** to change assignee
   - Click **Take Up** to claim for yourself

### 5. Complete Tasks (Employees)

As an employee:

1. Go to `/my-tasks` (My Tasks)
2. View your assigned tasks
3. Click a task to see details
4. Use action buttons:
   - **Start** - Begin working on task
   - **Complete** - Mark task as done
   - **Block** - Flag if blocked

## Files Modified/Created

### New Components
- `src/modules/intelligence-layer/components/IntelligenceLayout.tsx`
- `src/modules/intelligence-layer/components/manager/TaskAssignmentDialog.tsx`
- `src/modules/intelligence-layer/components/manager/index.ts`

### New Services
- `src/modules/intelligence-layer/services/taskAssignmentService.ts`

### Updated Files
- `src/modules/intelligence-layer/pages/ManagerDashboardPage.tsx` - Added assignment buttons
- `src/router/index.tsx` - Added IntelligenceLayout wrapper
- `src/modules/intelligence-layer/components/index.ts` - Added exports

### Cloud Functions (Updated to v2 API)
- `functions/src/ai/generateStrategyReport.js`
- `functions/src/scheduled/deadline-monitoring.js`
- `functions/src/scheduled/document-export.js`
- `functions/src/integrations/katana/syncCustomer.js`

### Firestore Indexes
- `firestore.indexes.json` - Added index for task queries

### Scripts
- `scripts/generate-design-manager-events.js` - Event generation script
- `scripts/README-events.md` - Script documentation

## Troubleshooting

### Authentication Issues

If you see "credentials are no longer valid":

```bash
firebase login --reauth
```

### Build Errors

Clear cache and rebuild:

```bash
rm -rf dist node_modules/.vite
npm install
npm run build
```

### Function Deployment Errors

Check function logs:

```bash
firebase functions:log
```

### Index Building

Firestore indexes can take time to build. Check status at:
https://console.firebase.google.com/project/dawinos/firestore/indexes

## Testing Locally

### 1. Start Dev Server

```bash
npm run dev
```

Navigate to `http://localhost:5173` (or the port shown)

### 2. Test with Firebase Emulators

```bash
npm run emulators
```

This starts local Firebase services for testing without affecting production.

### 3. Run Tests

```bash
npm test
```

## Next Steps

1. **Re-authenticate and deploy** (see Step 1 above)
2. **Generate business events** for existing projects
3. **Monitor task generation** in Admin Console
4. **Assign tasks** to team members
5. **Train users** on the new system

## Support

For issues or questions:
1. Check Firebase Console for deployment status
2. Review browser console for client-side errors
3. Check Firebase Functions logs for backend errors
4. Verify Firestore indexes are built

## Features Summary

### Employee Features
- Personal task inbox with filters
- Task detail view with checklists
- Status updates (Start, Complete, Block)
- Due date tracking
- Priority indicators

### Manager Features
- Team workload overview
- Task assignment/reassignment
- Team member utilization tracking
- Recent tasks view
- Take up tasks from others

### Admin Features
- Event monitoring
- Task management
- System configuration
- Role profile management
- Employee workload analytics

All systems are ready for deployment! 🚀
