/**
 * Adobe PDF Services Client
 *
 * Wrapper around Adobe PDF Services SDK for common PDF operations.
 * All operations that require API secrets are delegated to Firebase Functions.
 *
 * @see https://developer.adobe.com/document-services/docs/overview/pdf-services-api/
 */

import {
  CreatePdfOptions,
  CreatePdfFromHtmlOptions,
  ExportPdfOptions,
  CombinePdfOptions,
  SplitPdfOptions,
  SplitPdfResult,
  OcrPdfOptions,
  CompressPdfOptions,
  CompressPdfResult,
  ProtectPdfOptions,
  LinearizePdfOptions,
  WatermarkOptions,
} from '../types/pdf-services.types';
import { AdobeOperationResult, AdobeFileRef, ProgressCallback } from '../types/common';
import { parseAdobeError, isRetryableError, getRetryDelay, ADOBE_ERROR_CODES } from '../utils/error-handler';
import { getAdobeConfig, logAdobeDebug } from '../config';
import { httpsCallable, getFunctions } from 'firebase/functions';

const MAX_RETRIES = 3;

export class AdobePdfServicesClient {
  private functions = getFunctions();

  /**
   * Check if PDF Services is enabled
   */
  isEnabled(): boolean {
    return getAdobeConfig().pdfServices.enabled;
  }

  /**
   * Create PDF from various source formats (DOCX, XLSX, HTML, images, etc.)
   */
  async createPdf(
    options: CreatePdfOptions,
    onProgress?: ProgressCallback
  ): Promise<AdobeOperationResult<Blob>> {
    if (!this.isEnabled()) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: ADOBE_ERROR_CODES.SERVICE_UNAVAILABLE,
          message: 'PDF Services is not enabled',
          retryable: false,
        },
      };
    }

    return this.executeWithRetry(async () => {
      onProgress?.({ percent: 10, status: 'Preparing document...' });

      const fileData = await this.prepareFileData(options.input);

      onProgress?.({ percent: 30, status: 'Uploading to Adobe...' });

      const createPdfFn = httpsCallable<
        { fileData: string; fileName: string; mimeType: string; inputFormat?: string },
        { pdfBase64: string }
      >(this.functions, 'adobeCreatePdf');

      onProgress?.({ percent: 50, status: 'Converting to PDF...' });

      const result = await createPdfFn({
        fileData: fileData.base64,
        fileName: fileData.fileName,
        mimeType: fileData.mimeType,
        inputFormat: options.inputFormat,
      });

      onProgress?.({ percent: 90, status: 'Processing result...' });

      const pdfBlob = this.base64ToBlob(result.data.pdfBase64, 'application/pdf');

      onProgress?.({ percent: 100, status: 'Complete' });

      return {
        success: true,
        status: 'completed',
        data: pdfBlob,
      };
    });
  }

  /**
   * Create PDF from HTML content
   */
  async createPdfFromHtml(
    options: CreatePdfFromHtmlOptions,
    onProgress?: ProgressCallback
  ): Promise<AdobeOperationResult<Blob>> {
    if (!this.isEnabled()) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: ADOBE_ERROR_CODES.SERVICE_UNAVAILABLE,
          message: 'PDF Services is not enabled',
          retryable: false,
        },
      };
    }

    return this.executeWithRetry(async () => {
      onProgress?.({ percent: 20, status: 'Processing HTML...' });

      const createPdfFromHtmlFn = httpsCallable<
        CreatePdfFromHtmlOptions,
        { pdfBase64: string }
      >(this.functions, 'adobeCreatePdfFromHtml');

      onProgress?.({ percent: 50, status: 'Generating PDF...' });

      const result = await createPdfFromHtmlFn(options);

      onProgress?.({ percent: 90, status: 'Processing result...' });

      const pdfBlob = this.base64ToBlob(result.data.pdfBase64, 'application/pdf');

      onProgress?.({ percent: 100, status: 'Complete' });

      return {
        success: true,
        status: 'completed',
        data: pdfBlob,
      };
    });
  }

  /**
   * Export PDF to other formats (DOCX, XLSX, PPTX, etc.)
   */
  async exportPdf(
    options: ExportPdfOptions,
    onProgress?: ProgressCallback
  ): Promise<AdobeOperationResult<Blob>> {
    if (!this.isEnabled()) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: ADOBE_ERROR_CODES.SERVICE_UNAVAILABLE,
          message: 'PDF Services is not enabled',
          retryable: false,
        },
      };
    }

    return this.executeWithRetry(async () => {
      onProgress?.({ percent: 10, status: 'Preparing PDF...' });

      const fileData = await this.prepareFileData(options.input);

      onProgress?.({ percent: 30, status: 'Processing...' });

      const exportPdfFn = httpsCallable<
        { fileData: string; outputFormat: string; ocrEnabled?: boolean; ocrLanguage?: string },
        { fileBase64: string; mimeType: string }
      >(this.functions, 'adobeExportPdf');

      onProgress?.({ percent: 60, status: 'Converting...' });

      const result = await exportPdfFn({
        fileData: fileData.base64,
        outputFormat: options.outputFormat,
        ocrEnabled: options.ocrEnabled,
        ocrLanguage: options.ocrLanguage,
      });

      onProgress?.({ percent: 90, status: 'Processing result...' });

      const outputBlob = this.base64ToBlob(result.data.fileBase64, result.data.mimeType);

      onProgress?.({ percent: 100, status: 'Complete' });

      return {
        success: true,
        status: 'completed',
        data: outputBlob,
      };
    });
  }

  /**
   * Combine multiple PDFs into one
   */
  async combinePdfs(
    options: CombinePdfOptions,
    onProgress?: ProgressCallback
  ): Promise<AdobeOperationResult<Blob>> {
    if (!this.isEnabled()) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: ADOBE_ERROR_CODES.SERVICE_UNAVAILABLE,
          message: 'PDF Services is not enabled',
          retryable: false,
        },
      };
    }

    return this.executeWithRetry(async () => {
      onProgress?.({ percent: 10, status: 'Preparing documents...' });

      // Prepare all files
      const filesData: Array<{ base64: string; fileName: string }> = [];
      for (let i = 0; i < options.inputs.length; i++) {
        const fileData = await this.prepareFileData(options.inputs[i]);
        filesData.push({ base64: fileData.base64, fileName: fileData.fileName });

        const progress = 10 + ((i + 1) / options.inputs.length) * 40;
        onProgress?.({ percent: progress, status: `Prepared ${i + 1}/${options.inputs.length}` });
      }

      onProgress?.({ percent: 60, status: 'Combining PDFs...' });

      const combinePdfsFn = httpsCallable<
        { files: Array<{ base64: string; fileName: string }>; pageRanges?: CombinePdfOptions['pageRanges'] },
        { pdfBase64: string }
      >(this.functions, 'adobeCombinePdfs');

      const result = await combinePdfsFn({
        files: filesData,
        pageRanges: options.pageRanges,
      });

      onProgress?.({ percent: 90, status: 'Processing result...' });

      const pdfBlob = this.base64ToBlob(result.data.pdfBase64, 'application/pdf');

      onProgress?.({ percent: 100, status: 'Complete' });

      return {
        success: true,
        status: 'completed',
        data: pdfBlob,
      };
    });
  }

  /**
   * Split PDF into multiple files
   */
  async splitPdf(
    options: SplitPdfOptions,
    onProgress?: ProgressCallback
  ): Promise<AdobeOperationResult<SplitPdfResult>> {
    if (!this.isEnabled()) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: ADOBE_ERROR_CODES.SERVICE_UNAVAILABLE,
          message: 'PDF Services is not enabled',
          retryable: false,
        },
      };
    }

    return this.executeWithRetry(async () => {
      onProgress?.({ percent: 10, status: 'Preparing PDF...' });

      const fileData = await this.prepareFileData(options.input);

      onProgress?.({ percent: 30, status: 'Splitting PDF...' });

      const splitPdfFn = httpsCallable<
        { fileData: string; splitType: string; pageCount?: number; pageRanges?: Array<{ start: number; end: number }>; fileSizeLimit?: number },
        { files: Array<{ base64: string; pageCount: number }> }
      >(this.functions, 'adobeSplitPdf');

      const result = await splitPdfFn({
        fileData: fileData.base64,
        splitType: options.splitType,
        pageCount: options.pageCount,
        pageRanges: options.pageRanges,
        fileSizeLimit: options.fileSizeLimit,
      });

      onProgress?.({ percent: 80, status: 'Processing results...' });

      const files = result.data.files.map(f => this.base64ToBlob(f.base64, 'application/pdf'));
      const pageCounts = result.data.files.map(f => f.pageCount);

      onProgress?.({ percent: 100, status: 'Complete' });

      return {
        success: true,
        status: 'completed',
        data: { files, pageCounts },
      };
    });
  }

  /**
   * Apply OCR to scanned PDF
   */
  async ocrPdf(
    options: OcrPdfOptions,
    onProgress?: ProgressCallback
  ): Promise<AdobeOperationResult<Blob>> {
    if (!this.isEnabled()) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: ADOBE_ERROR_CODES.SERVICE_UNAVAILABLE,
          message: 'PDF Services is not enabled',
          retryable: false,
        },
      };
    }

    return this.executeWithRetry(async () => {
      onProgress?.({ percent: 10, status: 'Preparing document...' });

      const fileData = await this.prepareFileData(options.input);

      onProgress?.({ percent: 30, status: 'Uploading...' });

      const ocrPdfFn = httpsCallable<
        { fileData: string; ocrLanguage?: string; ocrType?: string },
        { pdfBase64: string }
      >(this.functions, 'adobeOcrPdf');

      onProgress?.({ percent: 50, status: 'Applying OCR...' });

      const result = await ocrPdfFn({
        fileData: fileData.base64,
        ocrLanguage: options.ocrLanguage,
        ocrType: options.ocrType,
      });

      onProgress?.({ percent: 90, status: 'Processing result...' });

      const pdfBlob = this.base64ToBlob(result.data.pdfBase64, 'application/pdf');

      onProgress?.({ percent: 100, status: 'Complete' });

      return {
        success: true,
        status: 'completed',
        data: pdfBlob,
      };
    });
  }

  /**
   * Compress PDF to reduce file size
   */
  async compressPdf(
    options: CompressPdfOptions,
    onProgress?: ProgressCallback
  ): Promise<AdobeOperationResult<CompressPdfResult>> {
    if (!this.isEnabled()) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: ADOBE_ERROR_CODES.SERVICE_UNAVAILABLE,
          message: 'PDF Services is not enabled',
          retryable: false,
        },
      };
    }

    return this.executeWithRetry(async () => {
      onProgress?.({ percent: 10, status: 'Preparing PDF...' });

      const fileData = await this.prepareFileData(options.input);
      const originalSize = fileData.size;

      onProgress?.({ percent: 30, status: 'Compressing...' });

      const compressPdfFn = httpsCallable<
        { fileData: string; compressionLevel?: string },
        { pdfBase64: string; compressedSize: number }
      >(this.functions, 'adobeCompressPdf');

      const result = await compressPdfFn({
        fileData: fileData.base64,
        compressionLevel: options.compressionLevel,
      });

      onProgress?.({ percent: 90, status: 'Processing result...' });

      const pdfBlob = this.base64ToBlob(result.data.pdfBase64, 'application/pdf');
      const compressedSize = result.data.compressedSize;
      const compressionRatio = 1 - (compressedSize / originalSize);

      onProgress?.({ percent: 100, status: 'Complete' });

      return {
        success: true,
        status: 'completed',
        data: {
          file: pdfBlob,
          originalSize,
          compressedSize,
          compressionRatio,
        },
      };
    });
  }

  /**
   * Protect PDF with password and permissions
   */
  async protectPdf(
    options: ProtectPdfOptions,
    onProgress?: ProgressCallback
  ): Promise<AdobeOperationResult<Blob>> {
    if (!this.isEnabled()) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: ADOBE_ERROR_CODES.SERVICE_UNAVAILABLE,
          message: 'PDF Services is not enabled',
          retryable: false,
        },
      };
    }

    return this.executeWithRetry(async () => {
      onProgress?.({ percent: 10, status: 'Preparing PDF...' });

      const fileData = await this.prepareFileData(options.input);

      onProgress?.({ percent: 30, status: 'Applying protection...' });

      const protectPdfFn = httpsCallable<
        { fileData: string; userPassword?: string; ownerPassword?: string; permissions?: ProtectPdfOptions['permissions']; encryptionAlgorithm?: string },
        { pdfBase64: string }
      >(this.functions, 'adobeProtectPdf');

      const result = await protectPdfFn({
        fileData: fileData.base64,
        userPassword: options.userPassword,
        ownerPassword: options.ownerPassword,
        permissions: options.permissions,
        encryptionAlgorithm: options.encryptionAlgorithm,
      });

      onProgress?.({ percent: 90, status: 'Processing result...' });

      const pdfBlob = this.base64ToBlob(result.data.pdfBase64, 'application/pdf');

      onProgress?.({ percent: 100, status: 'Complete' });

      return {
        success: true,
        status: 'completed',
        data: pdfBlob,
      };
    });
  }

  /**
   * Linearize PDF for fast web viewing
   */
  async linearizePdf(
    options: LinearizePdfOptions,
    onProgress?: ProgressCallback
  ): Promise<AdobeOperationResult<Blob>> {
    if (!this.isEnabled()) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: ADOBE_ERROR_CODES.SERVICE_UNAVAILABLE,
          message: 'PDF Services is not enabled',
          retryable: false,
        },
      };
    }

    return this.executeWithRetry(async () => {
      onProgress?.({ percent: 10, status: 'Preparing PDF...' });

      const fileData = await this.prepareFileData(options.input);

      onProgress?.({ percent: 40, status: 'Optimizing for web...' });

      const linearizePdfFn = httpsCallable<
        { fileData: string },
        { pdfBase64: string }
      >(this.functions, 'adobeLinearizePdf');

      const result = await linearizePdfFn({ fileData: fileData.base64 });

      onProgress?.({ percent: 90, status: 'Processing result...' });

      const pdfBlob = this.base64ToBlob(result.data.pdfBase64, 'application/pdf');

      onProgress?.({ percent: 100, status: 'Complete' });

      return {
        success: true,
        status: 'completed',
        data: pdfBlob,
      };
    });
  }

  /**
   * Add watermark to PDF
   */
  async addWatermark(
    options: WatermarkOptions,
    onProgress?: ProgressCallback
  ): Promise<AdobeOperationResult<Blob>> {
    if (!this.isEnabled()) {
      return {
        success: false,
        status: 'failed',
        error: {
          code: ADOBE_ERROR_CODES.SERVICE_UNAVAILABLE,
          message: 'PDF Services is not enabled',
          retryable: false,
        },
      };
    }

    return this.executeWithRetry(async () => {
      onProgress?.({ percent: 10, status: 'Preparing PDF...' });

      const fileData = await this.prepareFileData(options.input);
      let imageData: string | undefined;

      if (options.type === 'image' && options.image) {
        const imgData = await this.prepareFileData(options.image);
        imageData = imgData.base64;
      }

      onProgress?.({ percent: 40, status: 'Adding watermark...' });

      const addWatermarkFn = httpsCallable<
        { fileData: string; type: string; text?: string; imageData?: string; opacity?: number; rotation?: number; position?: string; pageRanges?: WatermarkOptions['pageRanges'] },
        { pdfBase64: string }
      >(this.functions, 'adobeAddWatermark');

      const result = await addWatermarkFn({
        fileData: fileData.base64,
        type: options.type,
        text: options.text,
        imageData,
        opacity: options.opacity,
        rotation: options.rotation,
        position: options.position,
        pageRanges: options.pageRanges,
      });

      onProgress?.({ percent: 90, status: 'Processing result...' });

      const pdfBlob = this.base64ToBlob(result.data.pdfBase64, 'application/pdf');

      onProgress?.({ percent: 100, status: 'Complete' });

      return {
        success: true,
        status: 'completed',
        data: pdfBlob,
      };
    });
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private async prepareFileData(fileRef: AdobeFileRef): Promise<{
    base64: string;
    fileName: string;
    mimeType: string;
    size: number;
  }> {
    let blob: Blob;
    let fileName = fileRef.fileName || 'document';
    const mimeType = fileRef.mimeType || 'application/octet-stream';

    switch (fileRef.type) {
      case 'url':
        const response = await fetch(fileRef.value as string);
        blob = await response.blob();
        break;

      case 'base64':
        const binaryString = atob(fileRef.value as string);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        blob = new Blob([bytes], { type: mimeType });
        break;

      case 'buffer':
        blob = new Blob([fileRef.value as any], { type: mimeType });
        break;

      case 'storage':
        // Firebase Storage URL
        const storageResponse = await fetch(fileRef.value as string);
        blob = await storageResponse.blob();
        break;

      default:
        throw new Error(`Unsupported file reference type: ${fileRef.type}`);
    }

    const base64 = await this.blobToBase64(blob);

    return {
      base64,
      fileName,
      mimeType,
      size: blob.size,
    };
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        // Remove the data URL prefix to get just the base64 content
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private base64ToBlob(base64: string, mimeType: string): Blob {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  }

  private async executeWithRetry<T>(
    operation: () => Promise<AdobeOperationResult<T>>
  ): Promise<AdobeOperationResult<T>> {
    let lastError: ReturnType<typeof parseAdobeError> | undefined;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await operation();
        return result;
      } catch (error) {
        lastError = parseAdobeError(error);
        logAdobeDebug('PDF Services error', { attempt, error: lastError });

        if (!isRetryableError(lastError)) {
          return {
            success: false,
            status: 'failed',
            error: lastError,
          };
        }

        if (attempt < MAX_RETRIES - 1) {
          const delay = getRetryDelay(attempt);
          logAdobeDebug(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return {
      success: false,
      status: 'failed',
      error: lastError || {
        code: ADOBE_ERROR_CODES.OPERATION_FAILED,
        message: 'Max retries exceeded',
        retryable: false,
      },
    };
  }
}

// Singleton export
export const adobePdfServices = new AdobePdfServicesClient();
