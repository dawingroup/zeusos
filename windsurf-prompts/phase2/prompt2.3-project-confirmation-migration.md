# Prompt 2.3: Project Confirmation Migration

## Objective
Implement the project confirmation workflow that migrates files from the development folder to the customer's Google Drive folder.

## Prerequisites
- Completed Prompts 2.1-2.2
- Customer Drive folders from Phase 1
- Project development folders from Prompt 2.2

## Context
When a project is confirmed (contract signed, deposit received), the project files need to move from the internal development folder to the customer's Drive folder. This enables client access to their project files.

## Requirements

### 1. Update Project Folder Migration Service

Update file: `functions/src/integrations/drive/projectFolders.ts`

Add the following functions:

```typescript
/**
 * Move project folder from development to customer Drive
 */
async function migrateProjectToCustomerDrive(
  developmentFolderId: string,
  customerProjectsFolderId: string,
  projectCode: string,
  projectName: string
): Promise<{
  confirmedFolderId: string;
  confirmedFolderLink: string;
}> {
  // Rename folder (remove [DEV] prefix, add [CONF])
  const newFolderName = `${projectCode} - ${projectName}`;
  await renameFolder(developmentFolderId, newFolderName);

  // Move folder to customer's Projects folder
  const movedFolder = await moveFolder(
    developmentFolderId,
    customerProjectsFolderId
  );

  const folderLink = await getFolderLink(movedFolder.id);

  return {
    confirmedFolderId: movedFolder.id,
    confirmedFolderLink: folderLink,
  };
}

/**
 * Handle project confirmation - migrate Drive folder
 */
export const onProjectConfirmed = functions.firestore
  .document('customers/{customerId}/projects/{projectId}')
  .onUpdate(async (change, context) => {
    const { customerId, projectId } = context.params;
    const before = change.before.data();
    const after = change.after.data();

    // Check if phase changed to 'confirmed'
    if (before.phase === 'confirmed' || after.phase !== 'confirmed') {
      return;
    }

    functions.logger.info(`Project ${projectId} confirmed, migrating Drive folder`);

    const developmentFolderId = after.developmentFolderId;
    if (!developmentFolderId) {
      functions.logger.warn(`Project ${projectId} has no development folder to migrate`);
      return;
    }

    // Get customer's Projects folder
    const customerDoc = await db.collection('customers').doc(customerId).get();
    if (!customerDoc.exists) {
      functions.logger.error(`Customer ${customerId} not found`);
      return;
    }

    const customer = customerDoc.data()!;
    const customerProjectsFolderId = customer.externalIds?.driveProjectsFolderId;

    if (!customerProjectsFolderId) {
      functions.logger.error(`Customer ${customerId} has no Projects folder in Drive`);
      // Fall back: keep folder in development but rename
      try {
        const newName = `[CONF] ${after.customerCode} - ${after.code} - ${after.name}`;
        await renameFolder(developmentFolderId, newName);
      } catch (error) {
        functions.logger.error('Failed to rename folder:', error);
      }
      return;
    }

    try {
      const result = await migrateProjectToCustomerDrive(
        developmentFolderId,
        customerProjectsFolderId,
        after.code,
        after.name
      );

      await db
        .collection('customers')
        .doc(customerId)
        .collection('projects')
        .doc(projectId)
        .update({
          confirmedFolderId: result.confirmedFolderId,
          confirmedFolderLink: result.confirmedFolderLink,
          // Keep development folder ID for reference but clear link
          developmentFolderLink: null,
          'syncStatus.driveMigration': 'completed',
          'syncStatus.driveMigrationAt': admin.firestore.FieldValue.serverTimestamp(),
        });

      functions.logger.info(`Project ${projectId} folder migrated to customer Drive`);
    } catch (error) {
      functions.logger.error(`Failed to migrate project ${projectId} folder:`, error);
      await db
        .collection('customers')
        .doc(customerId)
        .collection('projects')
        .doc(projectId)
        .update({
          'syncStatus.driveMigration': 'failed',
          'syncStatus.driveMigrationError': error instanceof Error ? error.message : 'Unknown error',
        });
    }
  });

/**
 * Manual confirmation and migration callable
 */
export const confirmProjectAndMigrate = functions.https.onCall(
  async (data: { customerId: string; projectId: string }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { customerId, projectId } = data;
    const userId = context.auth.token.email || context.auth.uid;

    // Get project
    const projectRef = db
      .collection('customers')
      .doc(customerId)
      .collection('projects')
      .doc(projectId);
    
    const projectDoc = await projectRef.get();
    if (!projectDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Project not found');
    }

    const project = projectDoc.data()!;

    if (project.phase === 'confirmed') {
      throw new functions.https.HttpsError('failed-precondition', 'Project is already confirmed');
    }

    // Get customer
    const customerDoc = await db.collection('customers').doc(customerId).get();
    if (!customerDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Customer not found');
    }

    const customer = customerDoc.data()!;
    const customerProjectsFolderId = customer.externalIds?.driveProjectsFolderId;

    // Update project phase
    await projectRef.update({
      phase: 'confirmed',
      confirmedDate: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: userId,
    });

    // Migrate folder if possible
    if (project.developmentFolderId && customerProjectsFolderId) {
      try {
        const result = await migrateProjectToCustomerDrive(
          project.developmentFolderId,
          customerProjectsFolderId,
          project.code,
          project.name
        );

        await projectRef.update({
          confirmedFolderId: result.confirmedFolderId,
          confirmedFolderLink: result.confirmedFolderLink,
          developmentFolderLink: null,
          'syncStatus.driveMigration': 'completed',
        });

        return {
          success: true,
          phase: 'confirmed',
          folderMigrated: true,
          confirmedFolderLink: result.confirmedFolderLink,
        };
      } catch (error) {
        // Confirmation succeeded but migration failed
        return {
          success: true,
          phase: 'confirmed',
          folderMigrated: false,
          migrationError: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    return {
      success: true,
      phase: 'confirmed',
      folderMigrated: false,
      reason: 'No folder to migrate or no customer folder available',
    };
  }
);
```

### 2. Create Confirmation UI Component

Create file: `src/modules/design-manager/components/project/ConfirmProjectDialog.tsx`

```typescript
/**
 * ConfirmProjectDialog Component
 * Dialog for confirming a project and triggering folder migration
 */

import { useState } from 'react';
import { X, AlertTriangle, CheckCircle, FolderOpen, Loader2 } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { DesignProject } from '../../types';

interface ConfirmProjectDialogProps {
  project: DesignProject;
  onClose: () => void;
  onConfirmed: () => void;
}

export function ConfirmProjectDialog({ project, onClose, onConfirmed }: ConfirmProjectDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    folderMigrated: boolean;
    confirmedFolderLink?: string;
    migrationError?: string;
  } | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);

    try {
      const functions = getFunctions();
      const confirmProject = httpsCallable(functions, 'confirmProjectAndMigrate');
      
      const response = await confirmProject({
        customerId: project.customerId,
        projectId: project.id,
      });

      setResult(response.data as any);
      
      if ((response.data as any).success) {
        onConfirmed();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Confirm Project</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {!result ? (
            <>
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">
                    Confirm "{project.name}"?
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    This will:
                  </p>
                  <ul className="text-sm text-gray-600 mt-2 space-y-1 list-disc list-inside">
                    <li>Change project phase to "Confirmed"</li>
                    <li>Move project files to customer's Drive folder</li>
                    <li>Enable client access to project files</li>
                  </ul>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 mb-4">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                  disabled={loading}
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? 'Confirming...' : 'Confirm Project'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-center py-4">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Project Confirmed!
                </h3>
                
                {result.folderMigrated ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">
                      Project files have been moved to the customer's Drive folder.
                    </p>
                    {result.confirmedFolderLink && (
                      <a
                        href={result.confirmedFolderLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-primary hover:underline"
                      >
                        <FolderOpen className="h-4 w-4" />
                        Open Customer Folder
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      Project confirmed, but folder migration skipped.
                    </p>
                    {result.migrationError && (
                      <p className="text-sm text-amber-600">
                        {result.migrationError}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-center mt-4">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ConfirmProjectDialog;
```

### 3. Add Confirm Button to ProjectView

Update `ProjectView.tsx` to include the confirmation button:

```typescript
// Add to imports
import { ConfirmProjectDialog } from './ConfirmProjectDialog';

// Add state
const [showConfirmDialog, setShowConfirmDialog] = useState(false);

// Add to header buttons (show only for development phase)
{project.phase === 'development' && (
  <button
    onClick={() => setShowConfirmDialog(true)}
    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
  >
    <CheckCircle className="h-4 w-4" />
    Confirm Project
  </button>
)}

// Add dialog at bottom of component
{showConfirmDialog && (
  <ConfirmProjectDialog
    project={project}
    onClose={() => setShowConfirmDialog(false)}
    onConfirmed={() => {
      setShowConfirmDialog(false);
      // Project will update via subscription
    }}
  />
)}
```

### 4. Export Functions

Add to `functions/src/index.ts`:

```typescript
export {
  onProjectCreatedDrive,
  onProjectUpdatedDrive,
  createProjectDriveFolder,
  onProjectConfirmed,
  confirmProjectAndMigrate,
} from './integrations/drive/projectFolders';
```

## Workflow Summary

```
1. Project Created (Development Phase)
   └── Auto-create folder in ~Onzimais/Development/
       └── [DEV] SMITH-001 - PRJ-001 - Kitchen/

2. Design Work Happens
   └── Files uploaded to development folder

3. Project Confirmed
   └── Folder moved to Customer Drive
       └── Customers/SMITH-001 - John Smith/Projects/
           └── PRJ-001 - Kitchen/

4. Client Access Enabled
   └── Customer can view their project files
```

## Validation Checklist

- [ ] Confirm button appears only for development phase projects
- [ ] Confirmation dialog shows migration warning
- [ ] Folder is renamed and moved on confirmation
- [ ] Confirmed folder link is updated in Firestore
- [ ] Phase changes to 'confirmed' with timestamp
- [ ] Error handling works for missing folders

## Phase 2 Complete! 🎉

You have completed Phase 2: Project + Drive Lifecycle. The system now has:
- ✅ Enhanced project data model with phases
- ✅ Automatic development folder creation
- ✅ Project confirmation workflow
- ✅ Folder migration to customer Drive
- ✅ Consolidated cutlist/estimate fields ready

## Next Steps

Proceed to **Phase 3: Design Item Parts Management** to implement parts tracking within design items.
