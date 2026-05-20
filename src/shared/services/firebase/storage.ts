/**
 * Firebase Storage Service
 * File storage operations
 */

import { 
  getStorage, 
  ref, 
  uploadBytes, 
  uploadString,
  getDownloadURL,
  deleteObject,
  listAll,
  type FirebaseStorage,
  type StorageReference,
  type UploadResult
} from 'firebase/storage';
import { app } from './config';

// Initialize Firebase Storage with correct bucket URL
export const storage: FirebaseStorage = getStorage(app, 'gs://dawinos.firebasestorage.app');

/**
 * Get a storage reference
 */
export function getStorageRef(path: string): StorageReference {
  return ref(storage, path);
}

/**
 * Upload a file (Blob/File)
 */
export async function uploadFile(
  path: string, 
  file: Blob | File
): Promise<{ url: string; ref: StorageReference }> {
  const storageRef = getStorageRef(path);
  const result: UploadResult = await uploadBytes(storageRef, file);
  const url = await getDownloadURL(result.ref);
  return { url, ref: result.ref };
}

/**
 * Upload a base64 string
 */
export async function uploadBase64(
  path: string, 
  base64String: string,
  contentType: string = 'application/octet-stream'
): Promise<{ url: string; ref: StorageReference }> {
  const storageRef = getStorageRef(path);
  const result = await uploadString(storageRef, base64String, 'base64', { 
    contentType 
  });
  const url = await getDownloadURL(result.ref);
  return { url, ref: result.ref };
}

/**
 * Get download URL for a file
 */
export async function getFileUrl(path: string): Promise<string> {
  const storageRef = getStorageRef(path);
  return getDownloadURL(storageRef);
}

/**
 * Delete a file
 */
export async function deleteFile(path: string): Promise<void> {
  const storageRef = getStorageRef(path);
  await deleteObject(storageRef);
}

/**
 * List all files in a directory
 */
export async function listFiles(path: string): Promise<StorageReference[]> {
  const storageRef = getStorageRef(path);
  const result = await listAll(storageRef);
  return result.items;
}
