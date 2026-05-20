# Prompt 2.2: Project Development Folder

## Objective
Automatically create a development folder in the internal Drive (~Onzimais) when a project is created, enabling file storage during the design phase.

## Prerequisites
- Completed Prompt 2.1 (Project Data Model Enhancement)
- Google Drive integration from Phase 1

## Context
During development, project files are stored in an internal "~Onzimais" Drive folder. When a project is confirmed, these files migrate to the customer's Drive folder. This prompt handles the development folder creation.

## Requirements

### 1. Create Project Folder Service

Create file: `functions/src/integrations/drive/projectFolders.ts`

```typescript
/**
 * Project Drive Folder Management
 * Handles development and confirmed folder lifecycle
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {
  createFolder,
  getOrCreateFolder,
  moveFolder,
  renameFolder,
  getFolderLink,
} from './client';

const db = admin.firestore();

function getDevelopmentParentId(): string {
  const folderId = functions.config().drive?.development_folder_id;
  if (!folderId) {
    throw new Error(
      'Development folder ID not configured. Set with: firebase functions:config:set drive.development_folder_id="FOLDER_ID"'
    );
  }
  return folderId;
}

/**
 * Create development folder structure for a project
 */
async function createProjectDevelopmentFolder(
  projectCode: string,
  projectName: string,
  customerCode: string
): Promise<{
  folderId: string;
  folderLink: string;
  subfolders: {
    drawings: string;
    models: string;
    specs: string;
    correspondence: string;
  };
}> {
  const parentId = getDevelopmentParentId();
  const folderName = `[DEV] ${customerCode} - ${projectCode} - ${projectName}`;

  // Create main project folder
  const mainFolder = await getOrCreateFolder(folderName, parentId);

  // Create standard subfolders
  const [drawings, models, specs, correspondence] = await Promise.all([
    getOrCreateFolder('01-Drawings', mainFolder.id),
    getOrCreateFolder('02-3D Models', mainFolder.id),
    getOrCreateFolder('03-Specifications', mainFolder.id),
    getOrCreateFolder('04-Correspondence', mainFolder.id),
  ]);

  const folderLink = await getFolderLink(mainFolder.id);

  return {
    folderId: mainFolder.id,
    folderLink,
    subfolders: {
      drawings: drawings.id,
      models: models.id,
      specs: specs.id,
      correspondence: correspondence.id,
    },
  };
}

/**
 * Create development folder when project is created
 */
export const onProjectCreatedDrive = functions.firestore
  .document('customers/{customerId}/projects/{projectId}')
  .onCreate(async (snapshot, context) => {
    const { customerId, projectId } = context.params;
    const project = snapshot.data();

    // Only create for development phase
    if (project.phase !== 'development') {
      functions.logger.info(`Project ${projectId} is not in development phase, skipping folder creation`);
      return;
    }

    functions.logger.info(`Creating development folder for project ${projectId}`);

    try {
      const folderStructure = await createProjectDevelopmentFolder(
        project.code,
        project.name,
        project.customerCode
      );

      await db
        .collection('customers')
        .doc(customerId)
        .collection('projects')
        .doc(projectId)
        .update({
          developmentFolderId: folderStructure.folderId,
          developmentFolderLink: folderStructure.folderLink,
          'driveSubfolders.drawings': folderStructure.subfolders.drawings,
          'driveSubfolders.models': folderStructure.subfolders.models,
          'driveSubfolders.specs': folderStructure.subfolders.specs,
          'driveSubfolders.correspondence': folderStructure.subfolders.correspondence,
          'syncStatus.drive': 'synced',
          'syncStatus.driveLastSync': admin.firestore.FieldValue.serverTimestamp(),
        });

      functions.logger.info(`Development folder created for project ${projectId}: ${folderStructure.folderId}`);
    } catch (error) {
      functions.logger.error(`Failed to create development folder for project ${projectId}:`, error);
      await db
        .collection('customers')
        .doc(customerId)
        .collection('projects')
        .doc(projectId)
        .update({
          'syncStatus.drive': 'failed',
          'syncStatus.driveError': error instanceof Error ? error.message : 'Unknown error',
        });
    }
  });

/**
 * Update folder name when project is renamed
 */
export const onProjectUpdatedDrive = functions.firestore
  .document('customers/{customerId}/projects/{projectId}')
  .onUpdate(async (change, context) => {
    const { customerId, projectId } = context.params;
    const before = change.before.data();
    const after = change.after.data();

    // Check if name or code changed
    if (before.name === after.name && before.code === after.code) {
      return;
    }

    const folderId = after.developmentFolderId;
    if (!folderId) {
      return;
    }

    const prefix = after.phase === 'development' ? '[DEV]' : '[CONF]';
    const newFolderName = `${prefix} ${after.customerCode} - ${after.code} - ${after.name}`;

    functions.logger.info(`Renaming project folder ${projectId} to: ${newFolderName}`);

    try {
      await renameFolder(folderId, newFolderName);
    } catch (error) {
      functions.logger.error(`Failed to rename project folder ${projectId}:`, error);
    }
  });

/**
 * Manual folder creation callable
 */
export const createProjectDriveFolder = functions.https.onCall(
  async (data: { customerId: string; projectId: string }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { customerId, projectId } = data;
    
    const projectDoc = await db
      .collection('customers')
      .doc(customerId)
      .collection('projects')
      .doc(projectId)
      .get();

    if (!projectDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Project not found');
    }

    const project = projectDoc.data()!;

    try {
      const folderStructure = await createProjectDevelopmentFolder(
        project.code,
        project.name,
        project.customerCode
      );

      await projectDoc.ref.update({
        developmentFolderId: folderStructure.folderId,
        developmentFolderLink: folderStructure.folderLink,
        'driveSubfolders.drawings': folderStructure.subfolders.drawings,
        'driveSubfolders.models': folderStructure.subfolders.models,
        'driveSubfolders.specs': folderStructure.subfolders.specs,
        'driveSubfolders.correspondence': folderStructure.subfolders.correspondence,
      });

      return {
        success: true,
        folderId: folderStructure.folderId,
        folderLink: folderStructure.folderLink,
      };
    } catch (error) {
      throw new functions.https.HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Failed to create folder'
      );
    }
  }
);
```

### 2. Add Drive Link to Project UI

Update the ProjectView component to show the Drive folder link:

Add to `src/modules/design-manager/components/project/ProjectView.tsx`:

```typescript
// Add to imports
import { ExternalLink, FolderOpen } from 'lucide-react';

// Add to the project details card:
{project.developmentFolderLink && (
  <div>
    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
      Project Files
    </h3>
    <a
      href={project.developmentFolderLink}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
    >
      <FolderOpen className="w-4 h-4" />
      Open in Google Drive
      <ExternalLink className="w-3 h-3" />
    </a>
  </div>
)}
```

### 3. Export Functions

Add to `functions/src/index.ts`:

```typescript
// Project Drive Integration
export {
  onProjectCreatedDrive,
  onProjectUpdatedDrive,
  createProjectDriveFolder,
} from './integrations/drive/projectFolders';
```

### 4. Configure Development Folder

```bash
# Get the folder ID from the Google Drive URL of your ~Onzimais/Development folder
# URL format: https://drive.google.com/drive/folders/FOLDER_ID

firebase functions:config:set drive.development_folder_id="YOUR_DEVELOPMENT_FOLDER_ID"
```

## Folder Structure

When a project is created:

```
~Onzimais/Development/
└── [DEV] SMITH-RES-001 - PRJ-001 - Kitchen Renovation/
    ├── 01-Drawings/
    ├── 02-3D Models/
    ├── 03-Specifications/
    └── 04-Correspondence/
```

## Validation Checklist

- [ ] Creating a project creates development folder automatically
- [ ] Folder has correct naming convention with [DEV] prefix
- [ ] Standard subfolders are created
- [ ] Folder link is stored and accessible in UI
- [ ] Renaming project renames the folder
- [ ] Manual folder creation works

## Next Steps

After completing this prompt, proceed to:
- **Prompt 2.3**: Project Confirmation Migration - Move folder to customer Drive on confirmation
