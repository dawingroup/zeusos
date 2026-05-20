/**
 * DRIVE IMPORT SERVICE
 *
 * Fetches scanned receipts/invoices from Google Drive and imports them
 * into Firebase Storage with policy-compliant naming.
 *
 * Uses the Google Drive REST API v3 with the user's OAuth access token
 * (stored by Firebase Auth at sign-in).
 */

import { getGoogleAccessToken, DriveTokenExpiredError } from '@/shared/services/firebase/auth';
import { uploadFile } from '@/shared/services/firebase/storage';
import {
  buildPolicyName,
  toKebab,
  getExtension,
} from '@/shared/services/fileManager/namingPolicy';
import type { QuickCaptureDocument, QuickCaptureDocumentType } from '../types/quick-capture';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink: string | null;
  modifiedTime: string;
  size: string | null;
}

/** Maps quick capture doc types to naming policy type codes */
const DOC_TYPE_TO_CODE: Record<QuickCaptureDocumentType, string> = {
  Receipt: 'RCT',
  Invoice: 'INV',
  DeliveryNote: 'DLN',
  Photo: 'RCT',
  Other: 'RCT',
};

// Supported MIME types for scan imports
const SCAN_MIME_QUERY =
  "(mimeType='application/pdf' or mimeType='image/jpeg' or mimeType='image/png' or mimeType='image/webp')";

// ─────────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────────

export class DriveImportService {
  private static instance: DriveImportService;

  private constructor() {}

  static getInstance(): DriveImportService {
    if (!DriveImportService.instance) {
      DriveImportService.instance = new DriveImportService();
    }
    return DriveImportService.instance;
  }

  /**
   * Make an authenticated Drive API request.
   * Throws DriveTokenExpiredError on 401 so the UI can show a
   * "Reconnect" button (popup must be triggered by user gesture).
   */
  private async driveRequest(url: string, init?: RequestInit): Promise<Response> {
    const token = getGoogleAccessToken();
    if (!token) {
      throw new DriveTokenExpiredError();
    }

    const res = await fetch(url, {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      throw new DriveTokenExpiredError();
    }

    if (!res.ok) {
      throw new Error(`Drive API error: ${res.status} ${res.statusText}`);
    }

    return res;
  }

  // ─────────────────────────────────────────────────────────────────
  // LIST SCANNED FILES
  // ─────────────────────────────────────────────────────────────────

  /**
   * List scanned images/PDFs from a Google Drive folder (or recent Drive files).
   * Results are sorted by most recently modified first.
   */
  async listScannedFiles(folderId?: string): Promise<DriveFile[]> {
    const folderClause = folderId
      ? `'${folderId}' in parents and `
      : '';

    const q = `${folderClause}${SCAN_MIME_QUERY} and trashed=false`;

    const params = new URLSearchParams({
      q,
      fields: 'files(id,name,mimeType,thumbnailLink,modifiedTime,size)',
      orderBy: 'modifiedTime desc',
      pageSize: '30',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });

    const res = await this.driveRequest(
      `https://www.googleapis.com/drive/v3/files?${params}`
    );

    const data = await res.json();
    return (data.files || []) as DriveFile[];
  }

  // ─────────────────────────────────────────────────────────────────
  // IMPORT FILE
  // ─────────────────────────────────────────────────────────────────

  /**
   * Download a file from Google Drive, rename it per the naming policy,
   * and upload it to Firebase Storage.
   *
   * Returns a QuickCaptureDocument ready for the form's document list.
   */
  async importFile(params: {
    fileId: string;
    fileName: string;
    mimeType: string;
    projectCode: string;
    requisitionNumber: string | null;
    vendorName: string;
    docType: QuickCaptureDocumentType;
    orgId: string;
    projectId: string;
  }): Promise<QuickCaptureDocument> {
    // 1. Download the file content from Drive (auto-refreshes token on 401)
    const res = await this.driveRequest(
      `https://www.googleapis.com/drive/v3/files/${params.fileId}?alt=media&supportsAllDrives=true`
    );

    const blob = await res.blob();

    // 2. Build policy-compliant filename
    const ext = getExtension(params.fileName) || (params.mimeType === 'application/pdf' ? 'pdf' : 'jpg');
    const typeCode = DOC_TYPE_TO_CODE[params.docType];

    const descParts = [
      params.requisitionNumber || 'unlinked',
      params.vendorName || 'unknown-vendor',
    ];

    const policyFileName = buildPolicyName({
      projectCode: params.projectCode,
      typeCode,
      description: descParts.map(toKebab).join('-'),
      version: 1,
      extension: ext,
    });

    // 3. Upload to Firebase Storage with policy name
    const storagePath = `organizations/${params.orgId}/advisory-documents/${params.projectId}/quick-capture/${policyFileName}`;
    const file = new File([blob], policyFileName, { type: params.mimeType });
    const { url } = await uploadFile(storagePath, file);

    return {
      type: params.docType,
      storageUrl: url,
      fileName: policyFileName,
    };
  }
}
