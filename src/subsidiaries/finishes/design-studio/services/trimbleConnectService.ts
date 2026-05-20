/**
 * Trimble Connect Service — Integration with Trimble Connect REST API
 *
 * Supports uploading STEP files to Trimble Connect projects,
 * polling for version changes, and downloading updated models.
 *
 * Trimble Connect regions: north_america, europe, asia
 * API base: https://app.connect.trimble.com/tc/api/2.0
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/firebase/config';

// ============================================================================
// Types
// ============================================================================

export interface TrimbleProject {
  id: string;
  name: string;
  description?: string;
  region: 'north_america' | 'europe' | 'asia';
  createdAt: string;
}

export interface TrimbleFile {
  id: string;
  name: string;
  versionId: string;
  versionNumber: number;
  size: number;
  modifiedAt: string;
  modifiedBy?: string;
  parentFolderId: string;
}

export interface TrimbleUploadResult {
  fileId: string;
  versionId: string;
  projectId: string;
  projectUrl: string;
}

export interface TrimbleSyncResult {
  updatedFiles: TrimbleFile[];
  hasChanges: boolean;
}

// ============================================================================
// Cloud Function Callables
// ============================================================================

/**
 * Upload a STEP file to Trimble Connect via Cloud Function.
 * The Cloud Function handles OAuth token management and API calls.
 */
export async function uploadToTrimbleConnect(
  revisionId: string,
  projectName: string,
  moId?: string,
): Promise<TrimbleUploadResult> {
  const callable = httpsCallable<
    { revisionId: string; projectName: string; moId?: string },
    { success: boolean; data: TrimbleUploadResult }
  >(functions, 'uploadToTrimbleConnect');

  const result = await callable({ revisionId, projectName, moId });
  if (!result.data.success) {
    throw new Error('Failed to upload to Trimble Connect');
  }
  return result.data.data;
}

/**
 * Check for updated files in a Trimble Connect project.
 */
export async function checkTrimbleUpdates(
  trimbleProjectId: string,
): Promise<TrimbleSyncResult> {
  const callable = httpsCallable<
    { trimbleProjectId: string },
    { success: boolean; data: TrimbleSyncResult }
  >(functions, 'checkTrimbleUpdates');

  const result = await callable({ trimbleProjectId });
  if (!result.data.success) {
    throw new Error('Failed to check Trimble Connect updates');
  }
  return result.data.data;
}

/**
 * Import an updated file from Trimble Connect back into DawinOS.
 * Creates a new design revision with the updated model.
 */
export async function importFromTrimbleConnect(
  trimbleFileId: string,
  trimbleProjectId: string,
  sourceRevisionId: string,
): Promise<string> {
  const callable = httpsCallable<
    { trimbleFileId: string; trimbleProjectId: string; sourceRevisionId: string },
    { success: boolean; data: { revisionId: string } }
  >(functions, 'importFromTrimbleConnect');

  const result = await callable({ trimbleFileId, trimbleProjectId, sourceRevisionId });
  if (!result.data.success) {
    throw new Error('Failed to import from Trimble Connect');
  }
  return result.data.data.revisionId;
}
