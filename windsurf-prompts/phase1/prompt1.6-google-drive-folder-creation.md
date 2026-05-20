# Prompt 1.6: Google Drive Folder Creation

## Objective
Create a Cloud Function to automatically create and manage Google Drive folders for customers, enabling organized project file storage.

## Prerequisites
- Completed Prompts 1.1-1.5
- Google Cloud service account with Drive API access
- Domain-wide delegation configured (for G Suite/Workspace)

## Context
Each customer needs a dedicated folder in Google Drive where project files will be stored. The folder structure follows:
```
Customers/
├── SMITH-RES-001 - John Smith/
│   ├── Projects/
│   └── Documents/
├── JONES-COM-002 - Jones Corp/
│   ├── Projects/
│   └── Documents/
```

## Requirements

### 1. Create Drive Service Types

Create file: `functions/src/integrations/drive/types.ts`

```typescript
/**
 * Google Drive API Types
 */

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  webViewLink?: string;
  createdTime?: string;
  modifiedTime?: string;
}

export interface DrivePermission {
  id?: string;
  type: 'user' | 'group' | 'domain' | 'anyone';
  role: 'owner' | 'organizer' | 'fileOrganizer' | 'writer' | 'commenter' | 'reader';
  emailAddress?: string;
  domain?: string;
}

export interface CustomerFolderStructure {
  rootFolderId: string;
  projectsFolderId: string;
  documentsFolderId: string;
}
```

### 2. Create Drive Client

Create file: `functions/src/integrations/drive/client.ts`

```typescript
/**
 * Google Drive API Client
 * Uses service account with domain-wide delegation
 */

import * as functions from 'firebase-functions';
import { google } from 'googleapis';
import type { DriveFile, DrivePermission } from './types';

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
];

// Folder MIME type
const FOLDER_MIME = 'application/vnd.google-apps.folder';

function getServiceAccountKey(): any {
  const keyBase64 = functions.config().google?.service_account_key;
  if (!keyBase64) {
    throw new Error(
      'Google service account key not configured. Set with: firebase functions:config:set google.service_account_key="BASE64_ENCODED_KEY"'
    );
  }
  return JSON.parse(Buffer.from(keyBase64, 'base64').toString());
}

function getParentFolderId(): string {
  const folderId = functions.config().drive?.customers_folder_id;
  if (!folderId) {
    throw new Error(
      'Customers parent folder ID not configured. Set with: firebase functions:config:set drive.customers_folder_id="FOLDER_ID"'
    );
  }
  return folderId;
}

async function getDriveClient(userEmail?: string) {
  const key = getServiceAccountKey();
  
  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: SCOPES,
    clientOptions: userEmail ? { subject: userEmail } : undefined,
  });

  return google.drive({ version: 'v3', auth });
}

/**
 * Create a folder in Drive
 */
export async function createFolder(
  name: string,
  parentId?: string
): Promise<DriveFile> {
  const drive = await getDriveClient();
  
  const response = await drive.files.create({
    requestBody: {
      name,
      mimeType: FOLDER_MIME,
      parents: parentId ? [parentId] : undefined,
    },
    fields: 'id, name, mimeType, webViewLink',
  });

  return response.data as DriveFile;
}

/**
 * Find folder by name in parent
 */
export async function findFolder(
  name: string,
  parentId: string
): Promise<DriveFile | null> {
  const drive = await getDriveClient();
  
  const response = await drive.files.list({
    q: `name='${name}' and '${parentId}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`,
    fields: 'files(id, name, mimeType, webViewLink)',
    pageSize: 1,
  });

  return response.data.files?.[0] as DriveFile || null;
}

/**
 * Get or create folder
 */
export async function getOrCreateFolder(
  name: string,
  parentId: string
): Promise<DriveFile> {
  const existing = await findFolder(name, parentId);
  if (existing) {
    return existing;
  }
  return createFolder(name, parentId);
}

/**
 * Set folder permissions
 */
export async function setFolderPermission(
  folderId: string,
  permission: Omit<DrivePermission, 'id'>
): Promise<DrivePermission> {
  const drive = await getDriveClient();
  
  const response = await drive.permissions.create({
    fileId: folderId,
    requestBody: permission,
    sendNotificationEmail: false,
  });

  return response.data as DrivePermission;
}

/**
 * Rename a folder
 */
export async function renameFolder(
  folderId: string,
  newName: string
): Promise<DriveFile> {
  const drive = await getDriveClient();
  
  const response = await drive.files.update({
    fileId: folderId,
    requestBody: { name: newName },
    fields: 'id, name, mimeType, webViewLink',
  });

  return response.data as DriveFile;
}

/**
 * Move folder to new parent
 */
export async function moveFolder(
  folderId: string,
  newParentId: string,
  oldParentId?: string
): Promise<DriveFile> {
  const drive = await getDriveClient();
  
  const response = await drive.files.update({
    fileId: folderId,
    addParents: newParentId,
    removeParents: oldParentId,
    fields: 'id, name, mimeType, webViewLink, parents',
  });

  return response.data as DriveFile;
}

/**
 * Get folder web link
 */
export async function getFolderLink(folderId: string): Promise<string> {
  const drive = await getDriveClient();
  
  const response = await drive.files.get({
    fileId: folderId,
    fields: 'webViewLink',
  });

  return response.data.webViewLink || `https://drive.google.com/drive/folders/${folderId}`;
}

/**
 * Create customer folder structure
 */
export async function createCustomerFolderStructure(
  customerCode: string,
  customerName: string
): Promise<{
  rootFolderId: string;
  projectsFolderId: string;
  documentsFolderId: string;
  rootFolderLink: string;
}> {
  const parentFolderId = getParentFolderId();
  const folderName = `${customerCode} - ${customerName}`;

  // Create or get root customer folder
  const rootFolder = await getOrCreateFolder(folderName, parentFolderId);
  
  // Create subfolders
  const [projectsFolder, documentsFolder] = await Promise.all([
    getOrCreateFolder('Projects', rootFolder.id),
    getOrCreateFolder('Documents', rootFolder.id),
  ]);

  const rootFolderLink = await getFolderLink(rootFolder.id);

  return {
    rootFolderId: rootFolder.id,
    projectsFolderId: projectsFolder.id,
    documentsFolderId: documentsFolder.id,
    rootFolderLink,
  };
}
```

### 3. Create Drive Sync Function

Create file: `functions/src/integrations/drive/customerFolders.ts`

```typescript
/**
 * Customer Drive Folder Management
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {
  createCustomerFolderStructure,
  renameFolder,
  getFolderLink,
} from './client';

const db = admin.firestore();

/**
 * Create Drive folder when customer is created
 */
export const onCustomerCreatedDrive = functions.firestore
  .document('customers/{customerId}')
  .onCreate(async (snapshot, context) => {
    const customerId = context.params.customerId;
    const customer = snapshot.data();

    functions.logger.info(`Creating Drive folder for customer ${customerId}`);

    try {
      const folderStructure = await createCustomerFolderStructure(
        customer.code,
        customer.name
      );

      await db.collection('customers').doc(customerId).update({
        'externalIds.driveFolderId': folderStructure.rootFolderId,
        'externalIds.driveProjectsFolderId': folderStructure.projectsFolderId,
        'externalIds.driveDocumentsFolderId': folderStructure.documentsFolderId,
        'driveFolderLink': folderStructure.rootFolderLink,
        'syncStatus.drive': 'synced',
        'syncStatus.driveLastSync': admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info(`Drive folder created for customer ${customerId}: ${folderStructure.rootFolderId}`);
    } catch (error) {
      functions.logger.error(`Failed to create Drive folder for customer ${customerId}:`, error);
      await db.collection('customers').doc(customerId).update({
        'syncStatus.drive': 'failed',
        'syncStatus.driveError': error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

/**
 * Update Drive folder when customer name/code changes
 */
export const onCustomerUpdatedDrive = functions.firestore
  .document('customers/{customerId}')
  .onUpdate(async (change, context) => {
    const customerId = context.params.customerId;
    const before = change.before.data();
    const after = change.after.data();

    // Check if name or code changed
    if (before.name === after.name && before.code === after.code) {
      return;
    }

    const folderId = after.externalIds?.driveFolderId;
    if (!folderId) {
      functions.logger.warn(`Customer ${customerId} has no Drive folder, skipping rename`);
      return;
    }

    const newFolderName = `${after.code} - ${after.name}`;
    functions.logger.info(`Renaming Drive folder for customer ${customerId} to: ${newFolderName}`);

    try {
      await renameFolder(folderId, newFolderName);
      
      await db.collection('customers').doc(customerId).update({
        'syncStatus.drive': 'synced',
        'syncStatus.driveLastSync': admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info(`Drive folder renamed for customer ${customerId}`);
    } catch (error) {
      functions.logger.error(`Failed to rename Drive folder for customer ${customerId}:`, error);
    }
  });

/**
 * Manual folder creation callable function
 */
export const createCustomerDriveFolder = functions.https.onCall(
  async (data: { customerId: string }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { customerId } = data;
    const customerDoc = await db.collection('customers').doc(customerId).get();
    if (!customerDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Customer not found');
    }

    const customer = customerDoc.data()!;

    try {
      const folderStructure = await createCustomerFolderStructure(
        customer.code,
        customer.name
      );

      await db.collection('customers').doc(customerId).update({
        'externalIds.driveFolderId': folderStructure.rootFolderId,
        'externalIds.driveProjectsFolderId': folderStructure.projectsFolderId,
        'externalIds.driveDocumentsFolderId': folderStructure.documentsFolderId,
        'driveFolderLink': folderStructure.rootFolderLink,
        'syncStatus.drive': 'synced',
        'syncStatus.driveLastSync': admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        folderId: folderStructure.rootFolderId,
        folderLink: folderStructure.rootFolderLink,
      };
    } catch (error) {
      throw new functions.https.HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Failed to create Drive folder'
      );
    }
  }
);

/**
 * Get folder link callable function
 */
export const getCustomerDriveFolderLink = functions.https.onCall(
  async (data: { customerId: string }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { customerId } = data;
    const customerDoc = await db.collection('customers').doc(customerId).get();
    if (!customerDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Customer not found');
    }

    const customer = customerDoc.data()!;
    const folderId = customer.externalIds?.driveFolderId;

    if (!folderId) {
      throw new functions.https.HttpsError('not-found', 'Customer has no Drive folder');
    }

    try {
      const link = await getFolderLink(folderId);
      return { link };
    } catch (error) {
      throw new functions.https.HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Failed to get folder link'
      );
    }
  }
);
```

### 4. Export Functions

Update file: `functions/src/index.ts`

```typescript
/**
 * Cloud Functions Index
 */

import * as admin from 'firebase-admin';

admin.initializeApp();

// Katana Integration
export {
  onCustomerCreated,
  onCustomerUpdated,
  syncCustomerToKatana,
} from './integrations/katana/syncCustomer';

// QuickBooks Integration
export {
  getAuthUrl as qbGetAuthUrl,
  handleCallback as qbCallback,
  checkConnection as qbCheckConnection,
} from './integrations/quickbooks/auth';

export {
  onCustomerCreatedQBO,
  syncCustomerToQuickBooks,
} from './integrations/quickbooks/customerSync';

// Google Drive Integration
export {
  onCustomerCreatedDrive,
  onCustomerUpdatedDrive,
  createCustomerDriveFolder,
  getCustomerDriveFolderLink,
} from './integrations/drive/customerFolders';
```

### 5. Configure Drive Settings

```bash
# Create service account key in Google Cloud Console
# Download JSON key and base64 encode it:
# cat service-account-key.json | base64

firebase functions:config:set google.service_account_key="BASE64_ENCODED_KEY"
firebase functions:config:set drive.customers_folder_id="PARENT_FOLDER_ID"
```

## Validation Checklist

- [ ] Service account has Drive API access
- [ ] Creating customer creates Drive folder automatically
- [ ] Folder structure includes Projects and Documents subfolders
- [ ] Renaming customer renames Drive folder
- [ ] Folder link is stored and accessible
- [ ] Manual folder creation works via callable function

## Phase 1 Complete! 🎉

You have now completed Phase 1: Customer Hub Foundation. The system now has:
- ✅ Customer data model with TypeScript interfaces
- ✅ Firestore CRUD operations with real-time subscriptions
- ✅ React hooks for customer management
- ✅ Customer list, detail, and form UI components
- ✅ Katana MRP customer sync
- ✅ QuickBooks Online OAuth and customer sync
- ✅ Google Drive folder auto-creation

## Next Steps

Proceed to **Phase 2: Project + Drive Lifecycle** to enhance the project model and implement development → confirmation workflow with Drive folder management.
