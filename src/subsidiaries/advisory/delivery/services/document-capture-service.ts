/**
 * DOCUMENT CAPTURE SERVICE
 *
 * Handles uploading photos/documents to Firebase Storage for quick captures.
 * Uses the existing shared storage utility.
 */

import { uploadFile } from '@/shared/services/firebase/storage';

export interface DocumentUploadResult {
  storageUrl: string;
  thumbnailUrl: string | null;
}

export class DocumentCaptureService {
  private static instance: DocumentCaptureService;

  private constructor() {}

  static getInstance(): DocumentCaptureService {
    if (!DocumentCaptureService.instance) {
      DocumentCaptureService.instance = new DocumentCaptureService();
    }
    return DocumentCaptureService.instance;
  }

  /**
   * Upload a document (photo/receipt) to Firebase Storage.
   *
   * Storage path: organizations/{orgId}/advisory-documents/{projectId}/quick-capture/{timestamp}_{random}.{ext}
   *
   * Phase 1: No thumbnail generation (deferred to Phase 3 Cloud Function).
   */
  async uploadDocument(
    file: File,
    orgId: string,
    projectId: string
  ): Promise<DocumentUploadResult> {
    const ext = file.name.split('.').pop() || 'jpg';
    const random = Math.random().toString(36).substring(2, 8);
    const timestamp = Date.now();
    const path = `organizations/${orgId}/advisory-documents/${projectId}/quick-capture/${timestamp}_${random}.${ext}`;

    const { url } = await uploadFile(path, file);

    return {
      storageUrl: url,
      thumbnailUrl: null, // Phase 3: Cloud Function thumbnail generation
    };
  }
}
