/**
 * ImageCaptureService - Cross-origin image fetching and thumbnail generation
 * CRITICAL: All image fetches must route through the service worker for CORS handling
 */

import type { CaptureResult } from '../types/clip';

export interface CaptureOptions {
  thumbnailMaxSize?: number;
  thumbnailQuality?: number;
  maxImageSize?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

const DEFAULT_OPTIONS: Required<CaptureOptions> = {
  thumbnailMaxSize: 200,
  thumbnailQuality: 0.8,
  maxImageSize: 2000,
  format: 'jpeg',
};

export class ImageCaptureService {
  private options: Required<CaptureOptions>;

  constructor(options: CaptureOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Capture an image from URL through the service worker
   */
  async capture(imageUrl: string): Promise<CaptureResult> {
    // Request image fetch through service worker (handles CORS)
    const response = await chrome.runtime.sendMessage({
      type: 'FETCH_IMAGE',
      url: imageUrl,
    });

    if (!response.success) {
      throw new Error(`Failed to fetch image: ${response.error}`);
    }

    // Convert data URL to blob
    const imageBlob = await this.dataUrlToBlob(response.dataUrl);
    
    // Generate thumbnail
    const thumbnailBlob = await this.generateThumbnail(
      response.dataUrl,
      response.width,
      response.height
    );

    return {
      imageBlob,
      thumbnailBlob,
      originalWidth: response.width,
      originalHeight: response.height,
      format: this.detectFormat(imageBlob.type),
      size: imageBlob.size,
    };
  }

  /**
   * Capture from a local blob or file
   */
  async captureFromBlob(blob: Blob): Promise<CaptureResult> {
    const dataUrl = await this.blobToDataUrl(blob);
    const dimensions = await this.getImageDimensions(dataUrl);

    const thumbnailBlob = await this.generateThumbnail(
      dataUrl,
      dimensions.width,
      dimensions.height
    );

    return {
      imageBlob: blob,
      thumbnailBlob,
      originalWidth: dimensions.width,
      originalHeight: dimensions.height,
      format: this.detectFormat(blob.type),
      size: blob.size,
    };
  }

  /**
   * Generate thumbnail from image data URL
   */
  private async generateThumbnail(
    dataUrl: string,
    originalWidth: number,
    originalHeight: number
  ): Promise<Blob> {
    // Calculate thumbnail dimensions maintaining aspect ratio
    const { width, height } = this.calculateThumbnailSize(
      originalWidth,
      originalHeight,
      this.options.thumbnailMaxSize
    );

    // Use OffscreenCanvas if available (service worker compatible)
    if (typeof OffscreenCanvas !== 'undefined') {
      return this.generateThumbnailOffscreen(dataUrl, width, height);
    }

    // Fallback to regular canvas (content script)
    return this.generateThumbnailCanvas(dataUrl, width, height);
  }

  /**
   * Generate thumbnail using OffscreenCanvas
   */
  private async generateThumbnailOffscreen(
    dataUrl: string,
    width: number,
    height: number
  ): Promise<Blob> {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    return canvas.convertToBlob({
      type: `image/${this.options.format}`,
      quality: this.options.thumbnailQuality,
    });
  }

  /**
   * Generate thumbnail using regular Canvas (DOM)
   */
  private async generateThumbnailCanvas(
    dataUrl: string,
    width: number,
    height: number
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create blob from canvas'));
            }
          },
          `image/${this.options.format}`,
          this.options.thumbnailQuality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  }

  /**
   * Calculate thumbnail dimensions maintaining aspect ratio
   */
  private calculateThumbnailSize(
    originalWidth: number,
    originalHeight: number,
    maxSize: number
  ): { width: number; height: number } {
    if (originalWidth <= maxSize && originalHeight <= maxSize) {
      return { width: originalWidth, height: originalHeight };
    }

    const ratio = originalWidth / originalHeight;
    
    if (originalWidth > originalHeight) {
      return {
        width: maxSize,
        height: Math.round(maxSize / ratio),
      };
    } else {
      return {
        width: Math.round(maxSize * ratio),
        height: maxSize,
      };
    }
  }

  /**
   * Resize image if it exceeds max size
   */
  async resizeIfNeeded(blob: Blob): Promise<Blob> {
    const dataUrl = await this.blobToDataUrl(blob);
    const { width, height } = await this.getImageDimensions(dataUrl);

    if (width <= this.options.maxImageSize && height <= this.options.maxImageSize) {
      return blob;
    }

    const newSize = this.calculateThumbnailSize(
      width,
      height,
      this.options.maxImageSize
    );

    if (typeof OffscreenCanvas !== 'undefined') {
      return this.generateThumbnailOffscreen(dataUrl, newSize.width, newSize.height);
    }
    return this.generateThumbnailCanvas(dataUrl, newSize.width, newSize.height);
  }

  /**
   * Convert data URL to Blob
   */
  private async dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const response = await fetch(dataUrl);
    return response.blob();
  }

  /**
   * Convert Blob to data URL
   */
  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Get image dimensions from data URL
   */
  private getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  }

  /**
   * Detect image format from MIME type
   */
  private detectFormat(mimeType: string): string {
    const match = mimeType.match(/image\/(\w+)/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Prepare image for AI analysis (resize to max 1200px)
   */
  async prepareForAnalysis(blob: Blob): Promise<Blob> {
    const service = new ImageCaptureService({ maxImageSize: 1200 });
    return service.resizeIfNeeded(blob);
  }
}

export const imageCaptureService = new ImageCaptureService();
