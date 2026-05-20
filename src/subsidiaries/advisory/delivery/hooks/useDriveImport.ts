/**
 * DRIVE IMPORT HOOK
 *
 * React hook for listing and importing scanned files from Google Drive.
 */

import { useState, useCallback } from 'react';
import {
  DriveImportService,
  type DriveFile,
} from '../services/drive-import-service';
import type { QuickCaptureDocument, QuickCaptureDocumentType } from '../types/quick-capture';

function getService() {
  return DriveImportService.getInstance();
}

export function useDriveImport() {
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [listing, setListing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetch available scanned files from Drive.
   * Optionally scope to a specific folder.
   */
  const listFiles = useCallback(async (folderId?: string) => {
    setListing(true);
    setError(null);
    try {
      const files = await getService().listScannedFiles(folderId);
      setDriveFiles(files);
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Failed to list Drive files');
      setError(e);
      throw e;
    } finally {
      setListing(false);
    }
  }, []);

  /**
   * Import a single file from Drive into Firebase Storage.
   */
  const importFile = useCallback(
    async (params: {
      fileId: string;
      fileName: string;
      mimeType: string;
      projectCode: string;
      requisitionNumber: string | null;
      vendorName: string;
      docType: QuickCaptureDocumentType;
      orgId: string;
      projectId: string;
    }): Promise<QuickCaptureDocument> => {
      setImporting(true);
      setError(null);
      try {
        const doc = await getService().importFile(params);
        return doc;
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to import file');
        setError(e);
        throw e;
      } finally {
        setImporting(false);
      }
    },
    []
  );

  return { driveFiles, listing, importing, error, listFiles, importFile };
}
