/**
 * Manual Upload Service
 * Handles client photo upload, reverse image search, and proxy fetching
 * for the manual inspiration upload flow.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/shared/services/firebase/functions';
import { uploadFile, uploadBase64 } from '@/shared/services/firebase/storage';
import type { ReverseSearchMatch } from '../types';

// ============================================
// Storage Path Helpers
// ============================================

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.-]/g, '_');
}

function getClipStoragePath(projectId: string, clipId: string, fileName: string): string {
  const timestamp = Date.now();
  return `design-projects/${projectId}/clips/${clipId}/${timestamp}_${sanitizeFileName(fileName)}`;
}

// ============================================
// Image Resizing (for API calls)
// ============================================

const MAX_DIMENSION = 2048;

/**
 * Resize an image file to max dimension for API usage.
 * Returns both the resized blob and base64 string.
 */
export async function resizeImageForApi(file: File): Promise<{
  blob: Blob;
  base64: string;
  mimeType: string;
}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      const mimeType = 'image/jpeg';
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob'));
            return;
          }
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(',')[1];
            resolve({ blob, base64, mimeType });
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        },
        mimeType,
        0.85
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Generate a thumbnail from a file.
 */
export async function generateThumbnail(file: File | Blob, maxSize = 200): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      const ratio = Math.min(maxSize / width, maxSize / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create thumbnail'));
            return;
          }
          resolve(blob);
        },
        'image/jpeg',
        0.8
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for thumbnail'));
    };

    img.src = url;
  });
}

// ============================================
// Upload Operations
// ============================================

/**
 * Upload the original client photo to Firebase Storage.
 * Returns the storage URL for the original image and its thumbnail.
 */
export async function uploadClientPhoto(
  file: File,
  projectId: string,
  tempClipId: string
): Promise<{
  imageUrl: string;
  thumbnailUrl: string;
  base64: string;
  mimeType: string;
}> {
  // 1. Resize for API usage and get base64
  const { base64, mimeType } = await resizeImageForApi(file);

  // 2. Upload original file
  const originalPath = getClipStoragePath(projectId, tempClipId, `original_${file.name}`);
  const { url: imageUrl } = await uploadFile(originalPath, file);

  // 3. Generate and upload thumbnail
  const thumbnailBlob = await generateThumbnail(file);
  const thumbPath = getClipStoragePath(projectId, tempClipId, `thumb_${file.name}`);
  const { url: thumbnailUrl } = await uploadFile(thumbPath, thumbnailBlob);

  return { imageUrl, thumbnailUrl, base64, mimeType };
}

// ============================================
// Reverse Image Search
// ============================================

interface ReverseSearchResponse {
  success: boolean;
  matches: ReverseSearchMatch[];
  webEntities: Array<{ description: string; score: number }>;
  bestGuessLabels: string[];
  totalResultsFound: number;
}

/**
 * Call the reverseImageSearch cloud function.
 */
export async function searchSimilarImages(
  imageBase64: string,
  imageMimeType: string
): Promise<ReverseSearchResponse> {
  const reverseSearch = httpsCallable<
    { imageBase64: string; imageMimeType: string },
    ReverseSearchResponse
  >(functions, 'reverseImageSearch');

  const result = await reverseSearch({ imageBase64, imageMimeType });
  return result.data;
}

// ============================================
// Proxy Fetch & Upload Selected Image
// ============================================

interface ProxyFetchResponse {
  success: boolean;
  base64: string;
  mimeType: string;
  size: number;
}

/**
 * Fetch an external image via the proxy cloud function,
 * then upload it to Firebase Storage as the clip's primary image.
 */
export async function fetchAndUploadSelectedImage(
  imageUrl: string,
  projectId: string,
  clipId: string
): Promise<{
  storedImageUrl: string;
  storedThumbnailUrl: string;
  base64: string;
  mimeType: string;
}> {
  // 1. Proxy-fetch the external image
  const proxyFetch = httpsCallable<
    { imageUrl: string },
    ProxyFetchResponse
  >(functions, 'proxyFetchImage');

  const result = await proxyFetch({ imageUrl });
  const { base64, mimeType } = result.data;

  // 2. Upload the fetched image to Storage
  const imagePath = getClipStoragePath(projectId, clipId, 'selected.jpg');
  const { url: storedImageUrl } = await uploadBase64(imagePath, base64, mimeType);

  // 3. Generate thumbnail from the base64 data
  const byteCharacters = atob(base64);
  const byteArray = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteArray[i] = byteCharacters.charCodeAt(i);
  }
  const blob = new Blob([byteArray], { type: mimeType });
  const thumbnailBlob = await generateThumbnail(blob);

  const thumbPath = getClipStoragePath(projectId, clipId, 'selected_thumb.jpg');
  const { url: storedThumbnailUrl } = await uploadFile(thumbPath, thumbnailBlob);

  return { storedImageUrl, storedThumbnailUrl, base64, mimeType };
}
