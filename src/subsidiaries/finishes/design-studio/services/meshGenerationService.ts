/**
 * Mesh Generation Service — Client-side interface to the generateMesh Cloud Function
 *
 * Handles image upload to Firebase Storage, function invocation, and progress tracking.
 */

import { ref, uploadBytes } from 'firebase/storage';
import { getStorage } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/firebase/config';
import { app } from '@/shared/services/firebase/config';
import type { MeshGenerationRequest, GenerationResult, ParametricGenerationRequest, ParametricGenerationResult } from '../types/generation.types';

const storage = getStorage(app);

/**
 * Upload a reference image to Firebase Storage for Tripo processing.
 * Returns the storage path (not the download URL).
 */
export async function uploadReferenceImage(
  file: File,
  userId: string,
): Promise<string> {
  const timestamp = Date.now();
  const ext = file.name.split('.').pop() || 'jpg';
  const storagePath = `workshop-viewer/references/${userId}/${timestamp}.${ext}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file);
  return storagePath;
}

/**
 * Call the generateMesh Cloud Function to create a 3D model from an image or text.
 */
export async function generateMeshFromImage(
  request: MeshGenerationRequest,
): Promise<GenerationResult> {
  const callable = httpsCallable<MeshGenerationRequest, { success: boolean; data: GenerationResult }>(
    functions,
    'generateMesh',
  );
  const result = await callable(request);
  if (!result.data.success) {
    throw new Error('Mesh generation failed');
  }
  return result.data.data;
}

/**
 * Generate a mesh from a text prompt.
 */
export async function generateMeshFromText(
  prompt: string,
  options?: { faceLimit?: number; subsidiaryId?: string },
): Promise<GenerationResult> {
  return generateMeshFromImage({
    mode: 'text',
    textPrompt: prompt,
    faceLimit: options?.faceLimit,
    subsidiaryId: options?.subsidiaryId,
  });
}

/**
 * Call the generateParametric Cloud Function to create a model from a template.
 */
export async function generateParametricModel(
  request: ParametricGenerationRequest,
): Promise<ParametricGenerationResult> {
  const callable = httpsCallable<ParametricGenerationRequest, { success: boolean; data: ParametricGenerationResult }>(
    functions,
    'generateParametric',
  );
  const result = await callable(request);
  if (!result.data.success) {
    throw new Error('Parametric generation failed');
  }
  return result.data.data;
}

/**
 * Download a GLB file from a URL and return it as a File object
 * for loading into the Workshop Viewer.
 */
export async function downloadGlbAsFile(glbUrl: string, fileName?: string): Promise<File> {
  const response = await fetch(glbUrl);
  const blob = await response.blob();
  return new File([blob], fileName || 'generated-model.glb', { type: 'model/gltf-binary' });
}
