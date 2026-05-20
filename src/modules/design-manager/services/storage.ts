/**
 * Firebase Storage Service for Design Manager
 * Handles file uploads for deliverables
 */

import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL,
  deleteObject,
  type UploadTask,
} from 'firebase/storage';
import { storage } from '@/shared/services/firebase';
import type { DeliverableType, DesignStage } from '../types';

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  state: 'running' | 'paused' | 'success' | 'canceled' | 'error';
}

export interface UploadResult {
  storageUrl: string;
  storagePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  mimeType: string;
}

/**
 * Generate a unique storage path for a deliverable
 */
function generateStoragePath(
  projectId: string,
  itemId: string,
  type: DeliverableType,
  stage: DesignStage,
  fileName: string
): string {
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `design-projects/${projectId}/items/${itemId}/deliverables/${stage}/${type}/${timestamp}_${sanitizedFileName}`;
}

/**
 * Upload a file to Firebase Storage with progress tracking
 */
export function uploadDeliverableFile(
  file: File,
  projectId: string,
  itemId: string,
  type: DeliverableType,
  stage: DesignStage,
  onProgress?: (progress: UploadProgress) => void
): { uploadTask: UploadTask; promise: Promise<UploadResult> } {
  const storagePath = generateStoragePath(projectId, itemId, type, stage, file.name);
  const storageRef = ref(storage, storagePath);
  
  const uploadTask = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      projectId,
      itemId,
      deliverableType: type,
      stage,
      originalName: file.name,
    },
  });

  const promise = new Promise<UploadResult>((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress: UploadProgress = {
          bytesTransferred: snapshot.bytesTransferred,
          totalBytes: snapshot.totalBytes,
          percentage: (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
          state: snapshot.state as UploadProgress['state'],
        };
        onProgress?.(progress);
      },
      (error) => {
        console.error('Upload error:', error);
        reject(error);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            storageUrl: downloadUrl,
            storagePath,
            fileName: file.name,
            fileType: file.type || getFileExtension(file.name),
            fileSize: file.size,
            mimeType: file.type || '',
          });
        } catch (error) {
          reject(error);
        }
      }
    );
  });

  return { uploadTask, promise };
}

/**
 * Upload a file to a shared project-level path (not per-item).
 * Used for bulk uploads where one file is assigned to multiple design items.
 */
export function uploadSharedDeliverableFile(
  file: File,
  projectId: string,
  type: DeliverableType,
  onProgress?: (progress: UploadProgress) => void
): { uploadTask: UploadTask; promise: Promise<UploadResult> } {
  const timestamp = Date.now();
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `design-projects/${projectId}/shared-deliverables/${type}/${timestamp}_${sanitizedFileName}`;
  const storageRef = ref(storage, storagePath);

  const uploadTask = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      projectId,
      deliverableType: type,
      originalName: file.name,
      shared: 'true',
    },
  });

  const promise = new Promise<UploadResult>((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress: UploadProgress = {
          bytesTransferred: snapshot.bytesTransferred,
          totalBytes: snapshot.totalBytes,
          percentage: (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
          state: snapshot.state as UploadProgress['state'],
        };
        onProgress?.(progress);
      },
      (error) => {
        console.error('Shared upload error:', error);
        reject(error);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            storageUrl: downloadUrl,
            storagePath,
            fileName: file.name,
            fileType: file.type || getFileExtension(file.name),
            fileSize: file.size,
            mimeType: file.type || '',
          });
        } catch (error) {
          reject(error);
        }
      }
    );
  });

  return { uploadTask, promise };
}

/**
 * Generate a deterministic (stable) storage path for auto-generated deliverables.
 * Unlike `generateStoragePath`, this produces the SAME path every time for a given
 * project + item + type, so re-uploads overwrite the previous blob in place.
 */
export function generateAutoGenStoragePath(
  projectId: string,
  itemId: string,
  type: DeliverableType,
  fileName: string
): string {
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `design-projects/${projectId}/items/${itemId}/auto-gen/${type}/${sanitizedFileName}`;
}

/**
 * Upload a file to a deterministic (stable) storage path, overwriting any previous blob.
 * Used for auto-generated deliverables so they don't accumulate duplicates.
 */
export function uploadAutoGenDeliverableFile(
  file: File,
  projectId: string,
  itemId: string,
  type: DeliverableType,
  onProgress?: (progress: UploadProgress) => void
): { uploadTask: UploadTask; promise: Promise<UploadResult> } {
  const storagePath = generateAutoGenStoragePath(projectId, itemId, type, file.name);
  const storageRef = ref(storage, storagePath);

  const uploadTask = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      projectId,
      itemId,
      deliverableType: type,
      originalName: file.name,
      autoGenerated: 'true',
    },
  });

  const promise = new Promise<UploadResult>((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        onProgress?.({
          bytesTransferred: snapshot.bytesTransferred,
          totalBytes: snapshot.totalBytes,
          percentage: (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
          state: snapshot.state as UploadProgress['state'],
        });
      },
      (error) => {
        console.error('Auto-gen upload error:', error);
        reject(error);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            storageUrl: downloadUrl,
            storagePath,
            fileName: file.name,
            fileType: file.type || getFileExtension(file.name),
            fileSize: file.size,
            mimeType: file.type || '',
          });
        } catch (error) {
          reject(error);
        }
      }
    );
  });

  return { uploadTask, promise };
}

/**
 * Delete a file from Firebase Storage
 */
export async function deleteDeliverableFile(storagePath: string): Promise<void> {
  const storageRef = ref(storage, storagePath);
  await deleteObject(storageRef);
}

/**
 * Get file extension from filename
 */
function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'unknown';
}

/**
 * Validate file type for deliverable uploads
 */
export function validateDeliverableFile(
  file: File,
  type: DeliverableType
): { valid: boolean; error?: string } {
  const maxSize = 100 * 1024 * 1024; // 100MB max
  
  if (file.size > maxSize) {
    return { valid: false, error: 'File size exceeds 100MB limit' };
  }

  const allowedTypes: Record<DeliverableType, string[]> = {
    'concept-sketch': ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    'mood-board': ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    '3d-model': ['application/octet-stream', '.skp', '.3dm', '.step', '.stp', '.iges', '.obj', '.fbx', '.3ds', '.dxf'],
    'rendering': ['image/jpeg', 'image/png', 'image/webp', 'image/tiff'],
    'shop-drawing': ['application/pdf', 'image/png', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    'cut-list': ['application/pdf', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    'bom': ['application/pdf', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    'assembly-instructions': ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    'specification-sheet': ['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    'client-presentation': ['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    // Phase 3 handoff bundles are always `application/zip` — produced
    // server-side by `handoffBundleService`, never accepted from
    // user uploads; the allowlist here is a defence-in-depth check.
    'handoff-bundle': ['application/zip'],
    'other': [], // Allow any type for 'other'
  };

  const allowed = allowedTypes[type];
  
  // For 'other' type, allow anything
  if (type === 'other' || allowed.length === 0) {
    return { valid: true };
  }

  // Check file extension for 3D models (MIME types are unreliable)
  if (type === '3d-model') {
    const ext = '.' + getFileExtension(file.name);
    if (allowed.includes(ext) || file.type === 'application/octet-stream') {
      return { valid: true };
    }
  }

  if (!allowed.includes(file.type)) {
    return { 
      valid: false, 
      error: `Invalid file type. Allowed: ${allowed.filter(t => !t.startsWith('.')).join(', ')}` 
    };
  }

  return { valid: true };
}
