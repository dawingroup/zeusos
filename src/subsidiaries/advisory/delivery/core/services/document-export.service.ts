/**
 * Document Export Service
 *
 * Exports documents from Firebase Storage to external storage providers:
 * - Microsoft SharePoint (via Microsoft Graph API)
 * - Google Drive (via Google Drive API)
 *
 * Features:
 * - Mirrored folder structure
 * - Scheduled batch export (Cloud Scheduler)
 * - Document URL tracking in Firestore
 * - Sync status monitoring
 * - Retry failed exports
 */

import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  Timestamp,
  orderBy,
  limit,
  setDoc,
} from 'firebase/firestore';

import { db } from '../../../../../firebase/config';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { DocumentMetadata } from '../../types/document';

export type ExportProvider = 'sharepoint' | 'google_drive';

export interface ExportConfiguration {
  id: string;
  provider: ExportProvider;
  enabled: boolean;

  // Provider-specific settings
  settings: SharePointSettings | GoogleDriveSettings;

  // Folder mapping
  folderMapping: {
    firebasePath: string; // e.g., "advisory/delivery/{projectCode}/{year}/requisitions"
    externalPath: string; // e.g., "Shared Documents/Advisory/Delivery/{projectCode}/{year}/Requisitions"
  }[];

  // Sync settings
  syncFrequency: 'real_time' | 'hourly' | 'daily' | 'manual';
  lastSyncAt?: Timestamp;

  // Filters
  includeFileTypes?: string[]; // e.g., ['.pdf', '.xlsx', '.jpg']
  excludeFileTypes?: string[];
  minFileSizeBytes?: number;
  maxFileSizeBytes?: number;

  // Audit
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SharePointSettings {
  tenantId: string;
  clientId: string;
  clientSecret: string; // Encrypted
  siteUrl: string; // e.g., "https://contoso.sharepoint.com/sites/DawinAdvisory"
  driveId?: string; // Auto-discovered if not provided
  rootFolderId?: string;
}

export interface GoogleDriveSettings {
  serviceAccountEmail: string;
  privateKey: string; // Encrypted
  rootFolderId: string; // Google Drive folder ID
  sharedDriveId?: string; // For shared/team drives
}

export interface ExportJob {
  id: string;
  configurationId: string;
  provider: ExportProvider;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';

  // Job details
  totalDocuments: number;
  exportedDocuments: number;
  failedDocuments: number;
  skippedDocuments: number;

  // Timing
  startedAt: Timestamp;
  completedAt?: Timestamp;
  duration?: number; // milliseconds

  // Errors
  errors?: ExportError[];

  // Results
  exportedFiles?: ExportedFileInfo[];
}

export interface ExportError {
  documentId: string;
  documentPath: string;
  error: string;
  timestamp: Timestamp;
  retryCount: number;
}

export interface ExportedFileInfo {
  documentId: string;
  firebasePath: string;
  externalUrl: string;
  externalId: string; // SharePoint item ID or Google Drive file ID
  exportedAt: Timestamp;
  fileSize: number;
}

export interface DocumentExportStatus {
  documentId: string;
  exports: {
    provider: ExportProvider;
    status: 'pending' | 'exported' | 'failed';
    externalUrl?: string;
    externalId?: string;
    lastExportedAt?: Timestamp;
    errorMessage?: string;
  }[];
}

export class DocumentExportService {
  private storage = getStorage();

  /**
   * Export all pending documents
   */
  async exportPendingDocuments(configurationId: string): Promise<ExportJob> {
    const config = await this.getConfiguration(configurationId);

    if (!config.enabled) {
      throw new Error(`Export configuration ${configurationId} is disabled`);
    }

    // Create export job
    const jobId = doc(collection(db, 'temp')).id;
    const job: ExportJob = {
      id: jobId,
      configurationId,
      provider: config.provider,
      status: 'pending',
      totalDocuments: 0,
      exportedDocuments: 0,
      failedDocuments: 0,
      skippedDocuments: 0,
      startedAt: Timestamp.now(),
      errors: [],
      exportedFiles: [],
    };

    await setDoc(doc(db, 'export_jobs', jobId), job);

    try {
      // Update job status
      await updateDoc(doc(db, 'export_jobs', jobId), { status: 'in_progress' });

      // Get documents to export
      const documents = await this.getDocumentsToExport(config);
      job.totalDocuments = documents.length;

      console.log(`[DocumentExport] Starting export job ${jobId}: ${documents.length} documents`);

      // Export documents in batches
      const batchSize = 10;
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (docData) => {
            try {
              const result = await this.exportDocument(docData, config);

              if (result.success) {
                job.exportedDocuments++;
                job.exportedFiles!.push({
                  documentId: docData.id,
                  firebasePath: docData.storagePath,
                  externalUrl: result.externalUrl!,
                  externalId: result.externalId!,
                  exportedAt: Timestamp.now(),
                  fileSize: docData.sizeBytes,
                });

                // Update document metadata
                await this.updateDocumentExportStatus(docData.id, config.provider, {
                  status: 'exported',
                  externalUrl: result.externalUrl,
                  externalId: result.externalId,
                  lastExportedAt: Timestamp.now(),
                });
              } else {
                job.failedDocuments++;
                job.errors!.push({
                  documentId: docData.id,
                  documentPath: docData.storagePath,
                  error: result.error || 'Unknown error',
                  timestamp: Timestamp.now(),
                  retryCount: 0,
                });
              }
            } catch (error) {
              job.failedDocuments++;
              job.errors!.push({
                documentId: docData.id,
                documentPath: docData.storagePath,
                error: error instanceof Error ? error.message : String(error),
                timestamp: Timestamp.now(),
                retryCount: 0,
              });
            }
          })
        );

        // Update job progress
        await updateDoc(doc(db, 'export_jobs', jobId), {
          exportedDocuments: job.exportedDocuments,
          failedDocuments: job.failedDocuments,
          exportedFiles: job.exportedFiles,
          errors: job.errors,
        });
      }

      // Complete job
      job.status = 'completed';
      job.completedAt = Timestamp.now();
      job.duration = job.completedAt.toMillis() - job.startedAt.toMillis();

      await updateDoc(doc(db, 'export_jobs', jobId), {
        status: job.status,
        completedAt: job.completedAt,
        duration: job.duration,
      });

      // Update configuration last sync time
      await updateDoc(doc(db, 'export_configurations', configurationId), {
        lastSyncAt: Timestamp.now(),
      });

      console.log(`[DocumentExport] Job ${jobId} completed:`, {
        total: job.totalDocuments,
        exported: job.exportedDocuments,
        failed: job.failedDocuments,
        skipped: job.skippedDocuments,
      });

      return job;
    } catch (error) {
      // Mark job as failed
      await updateDoc(doc(db, 'export_jobs', jobId), {
        status: 'failed',
        completedAt: Timestamp.now(),
        errors: [{
          documentId: 'N/A',
          documentPath: 'N/A',
          error: error instanceof Error ? error.message : String(error),
          timestamp: Timestamp.now(),
          retryCount: 0,
        }],
      });

      throw error;
    }
  }

  /**
   * Export single document
   */
  private async exportDocument(
    docData: DocumentMetadata,
    config: ExportConfiguration
  ): Promise<{ success: boolean; externalUrl?: string; externalId?: string; error?: string }> {
    try {
      // Download document from Firebase Storage
      const downloadUrl = await getDownloadURL(ref(this.storage, docData.storagePath));
      const response = await fetch(downloadUrl);
      const blob = await response.blob();

      // Determine external folder path
      const externalPath = this.mapToExternalPath(docData.storagePath, config.folderMapping);

      // Export to provider
      if (config.provider === 'sharepoint') {
        return await this.exportToSharePoint(docData, blob, externalPath, config.settings as SharePointSettings);
      } else if (config.provider === 'google_drive') {
        return await this.exportToGoogleDrive(docData, blob, externalPath, config.settings as GoogleDriveSettings);
      }

      return { success: false, error: 'Unknown provider' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Export to SharePoint
   */
  private async exportToSharePoint(
    docData: DocumentMetadata,
    blob: Blob,
    externalPath: string,
    settings: SharePointSettings
  ): Promise<{ success: boolean; externalUrl?: string; externalId?: string; error?: string }> {
    try {
      // Get access token
      const accessToken = await this.getSharePointAccessToken(settings);

      // Ensure folder structure exists
      const folderUrl = await this.ensureSharePointFolder(externalPath, settings, accessToken);

      // Upload file
      const uploadUrl = `${settings.siteUrl}/_api/web/GetFolderByServerRelativeUrl('${folderUrl}')/Files/add(url='${docData.filename}',overwrite=true)`;

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json;odata=verbose',
          'Content-Type': 'application/octet-stream',
        },
        body: blob,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`SharePoint upload failed: ${uploadResponse.status} - ${errorText}`);
      }

      const result = await uploadResponse.json();
      const fileServerRelativeUrl = result.d.ServerRelativeUrl;
      const fileUrl = `${settings.siteUrl}${fileServerRelativeUrl}`;

      return {
        success: true,
        externalUrl: fileUrl,
        externalId: result.d.UniqueId, // SharePoint GUID
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Export to Google Drive
   */
  private async exportToGoogleDrive(
    docData: DocumentMetadata,
    blob: Blob,
    externalPath: string,
    settings: GoogleDriveSettings
  ): Promise<{ success: boolean; externalUrl?: string; externalId?: string; error?: string }> {
    try {
      // Get access token using service account
      const accessToken = await this.getGoogleDriveAccessToken(settings);

      // Ensure folder structure exists
      const folderId = await this.ensureGoogleDriveFolder(externalPath, settings, accessToken);

      // Upload file using multipart upload
      const metadata = {
        name: docData.filename,
        parents: [folderId],
        mimeType: docData.mimeType,
      };

      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        `Content-Type: ${docData.mimeType}\r\n\r\n` +
        await blob.text() +
        closeDelimiter;

      const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Google Drive upload failed: ${uploadResponse.status} - ${errorText}`);
      }

      const result = await uploadResponse.json();
      const fileUrl = `https://drive.google.com/file/d/${result.id}/view`;

      return {
        success: true,
        externalUrl: fileUrl,
        externalId: result.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get SharePoint access token
   */
  private async getSharePointAccessToken(settings: SharePointSettings): Promise<string> {
    const tokenUrl = `https://login.microsoftonline.com/${settings.tenantId}/oauth2/v2.0/token`;

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get SharePoint access token: ${error}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  /**
   * Get Google Drive access token using service account JWT authentication
   */
  private async getGoogleDriveAccessToken(settings: GoogleDriveSettings): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 3600; // 1 hour

    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    const claimSet = {
      iss: settings.serviceAccountEmail,
      scope: 'https://www.googleapis.com/auth/drive',
      aud: 'https://oauth2.googleapis.com/token',
      exp: expiry,
      iat: now,
    };

    // Base64url encode header and claim set
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedClaimSet = this.base64UrlEncode(JSON.stringify(claimSet));

    const signatureInput = `${encodedHeader}.${encodedClaimSet}`;

    // Sign with private key using Web Crypto API
    const signature = await this.signJWT(signatureInput, settings.privateKey);

    const jwt = `${signatureInput}.${signature}`;

    // Exchange JWT for access token
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get Google Drive access token: ${error}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  /**
   * Base64url encode a string
   */
  private base64UrlEncode(str: string): string {
    const base64 = btoa(unescape(encodeURIComponent(str)));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /**
   * Sign JWT using RSA-SHA256 with Web Crypto API
   */
  private async signJWT(input: string, privateKeyPem: string): Promise<string> {
    // Convert PEM to ArrayBuffer
    const pemContents = privateKeyPem
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/-----BEGIN RSA PRIVATE KEY-----/, '')
      .replace(/-----END RSA PRIVATE KEY-----/, '')
      .replace(/\\n/g, '')
      .replace(/\n/g, '')
      .replace(/\s/g, '')
      .trim();

    const binaryDer = atob(pemContents);
    const keyData = new Uint8Array(binaryDer.length);
    for (let i = 0; i < binaryDer.length; i++) {
      keyData[i] = binaryDer.charCodeAt(i);
    }

    // Import the key using Web Crypto API
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      keyData.buffer,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['sign']
    );

    // Sign the input
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, data);

    // Convert signature to base64url
    const signatureArray = new Uint8Array(signature);
    let signatureBase64 = '';
    for (let i = 0; i < signatureArray.length; i++) {
      signatureBase64 += String.fromCharCode(signatureArray[i]);
    }
    return btoa(signatureBase64).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /**
   * Ensure SharePoint folder exists, creating if necessary
   */
  private async ensureSharePointFolder(
    path: string,
    settings: SharePointSettings,
    accessToken: string
  ): Promise<string> {
    const folderNames = path.split('/').filter(name => name.trim());

    // Start from Shared Documents or configured root
    let currentPath = settings.rootFolderId || '/Shared Documents';

    for (const folderName of folderNames) {
      const targetPath = `${currentPath}/${folderName}`;

      // Try to get the folder
      const checkUrl = `${settings.siteUrl}/_api/web/GetFolderByServerRelativeUrl('${encodeURIComponent(targetPath)}')?$select=Exists,ServerRelativeUrl`;

      try {
        const checkResponse = await fetch(checkUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json;odata=verbose',
          },
        });

        if (checkResponse.ok) {
          // Folder exists
          currentPath = targetPath;
          continue;
        }
      } catch {
        // Folder doesn't exist, will create it
      }

      // Create folder using Graph API
      const createUrl = `${settings.siteUrl}/_api/web/folders`;
      const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json;odata=verbose',
          'Content-Type': 'application/json;odata=verbose',
        },
        body: JSON.stringify({
          '__metadata': { 'type': 'SP.Folder' },
          'ServerRelativeUrl': targetPath,
        }),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        // Check if it's a "folder already exists" error (can happen with concurrent requests)
        if (!errorText.toLowerCase().includes('already exists')) {
          throw new Error(`Failed to create SharePoint folder: ${errorText}`);
        }
      }

      currentPath = targetPath;
    }

    return currentPath;
  }

  /**
   * Ensure Google Drive folder exists, creating if necessary
   */
  private async ensureGoogleDriveFolder(
    path: string,
    settings: GoogleDriveSettings,
    accessToken: string
  ): Promise<string> {
    const folderNames = path.split('/').filter(name => name.trim());

    let parentId = settings.rootFolderId;

    for (const folderName of folderNames) {
      // Search for existing folder
      const searchQuery = `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(searchQuery)}&fields=files(id,name)`;

      const searchResponse = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!searchResponse.ok) {
        throw new Error(`Failed to search for folder: ${await searchResponse.text()}`);
      }

      const searchResult = await searchResponse.json();

      if (searchResult.files && searchResult.files.length > 0) {
        // Folder exists
        parentId = searchResult.files[0].id;
      } else {
        // Create folder
        const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
          }),
        });

        if (!createResponse.ok) {
          throw new Error(`Failed to create folder: ${await createResponse.text()}`);
        }

        const createResult = await createResponse.json();
        parentId = createResult.id;
      }
    }

    return parentId;
  }

  /**
   * Map Firebase Storage path to external path
   */
  private mapToExternalPath(firebasePath: string, mappings: ExportConfiguration['folderMapping']): string {
    for (const mapping of mappings) {
      // Replace variables in pattern
      const pattern = mapping.firebasePath.replace(/\{([^}]+)\}/g, '([^/]+)');
      const regex = new RegExp(`^${pattern}$`);
      const match = firebasePath.match(regex);

      if (match) {
        // Extract variables
        let externalPath = mapping.externalPath;
        const variableRegex = /\{([^}]+)\}/g;
        let i = 1;
        externalPath = externalPath.replace(variableRegex, () => match[i++] || '');

        return externalPath;
      }
    }

    // No mapping found, use Firebase path as-is
    return firebasePath;
  }

  /**
   * Get documents to export
   */
  private async getDocumentsToExport(config: ExportConfiguration): Promise<DocumentMetadata[]> {
    // Query documents that haven't been exported or failed last export
    const q = query(
      collection(db, 'documents'),
      where('category', 'in', ['requisition', 'accountability', 'receipt', 'invoice', 'delivery_note']),
      orderBy('createdAt', 'desc'),
      limit(1000) // Process in batches
    );

    const snapshot = await getDocs(q);
    const documents: DocumentMetadata[] = [];

    for (const docSnap of snapshot.docs) {
      const docData = docSnap.data() as DocumentMetadata;

      // Apply filters
      if (config.includeFileTypes && !config.includeFileTypes.some(ext => docData.filename.endsWith(ext))) {
        continue;
      }

      if (config.excludeFileTypes && config.excludeFileTypes.some(ext => docData.filename.endsWith(ext))) {
        continue;
      }

      if (config.minFileSizeBytes && docData.sizeBytes < config.minFileSizeBytes) {
        continue;
      }

      if (config.maxFileSizeBytes && docData.sizeBytes > config.maxFileSizeBytes) {
        continue;
      }

      // Check if already exported
      const exportStatus = await this.getDocumentExportStatus(docSnap.id);
      const providerExport = exportStatus?.exports.find(e => e.provider === config.provider);

      if (!providerExport || providerExport.status === 'failed') {
        documents.push({ ...docData, id: docSnap.id });
      }
    }

    return documents;
  }

  /**
   * Get document export status
   */
  private async getDocumentExportStatus(documentId: string): Promise<DocumentExportStatus | null> {
    const docSnap = await getDocs(query(collection(db, 'document_export_status'), where('__name__', '==', documentId), limit(1)));

    if (docSnap.empty) return null;

    return docSnap.docs[0].data() as DocumentExportStatus;
  }

  /**
   * Update document export status
   */
  private async updateDocumentExportStatus(
    documentId: string,
    provider: ExportProvider,
    status: Partial<DocumentExportStatus['exports'][0]>
  ): Promise<void> {
    const docRef = doc(db, 'document_export_status', documentId);
    const existing = await this.getDocumentExportStatus(documentId);

    if (existing) {
      // Update existing provider status
      const updatedExports = existing.exports.map(e =>
        e.provider === provider ? { ...e, ...status } : e
      );

      // Add new provider if not exists
      if (!updatedExports.find(e => e.provider === provider)) {
        updatedExports.push({ provider, ...status } as any);
      }

      await updateDoc(docRef, { exports: updatedExports });
    } else {
      // Create new status
      await setDoc(docRef, {
        documentId,
        exports: [{ provider, ...status }],
      });
    }
  }

  /**
   * Get export configuration
   */
  private async getConfiguration(configurationId: string): Promise<ExportConfiguration> {
    const docSnap = await getDocs(
      query(collection(db, 'export_configurations'), where('__name__', '==', configurationId), limit(1))
    );

    if (docSnap.empty) {
      throw new Error(`Export configuration ${configurationId} not found`);
    }

    return docSnap.docs[0].data() as ExportConfiguration;
  }

  /**
   * Create export configuration
   */
  async createConfiguration(
    config: Omit<ExportConfiguration, 'id' | 'createdAt' | 'updatedAt' | 'lastSyncAt'>,
    userId: string
  ): Promise<string> {
    const configId = doc(collection(db, 'temp')).id;

    const newConfig: ExportConfiguration = {
      ...config,
      id: configId,
      createdBy: userId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await setDoc(doc(db, 'export_configurations', configId), newConfig);

    return configId;
  }

  /**
   * Retry failed exports
   */
  async retryFailedExports(jobId: string): Promise<ExportJob> {
    const jobSnap = await getDocs(
      query(collection(db, 'export_jobs'), where('__name__', '==', jobId), limit(1))
    );

    if (jobSnap.empty) {
      throw new Error(`Export job ${jobId} not found`);
    }

    const job = jobSnap.docs[0].data() as ExportJob;

    if (!job.errors || job.errors.length === 0) {
      throw new Error('No failed exports to retry');
    }

    // Get configuration
    const config = await this.getConfiguration(job.configurationId);

    // Retry failed documents
    const retriedDocuments: ExportedFileInfo[] = [];
    const stillFailed: ExportError[] = [];

    for (const error of job.errors) {
      // Get document metadata
      const docSnap = await getDocs(
        query(collection(db, 'documents'), where('__name__', '==', error.documentId), limit(1))
      );

      if (docSnap.empty) {
        stillFailed.push({ ...error, retryCount: error.retryCount + 1 });
        continue;
      }

      const docData = docSnap.docs[0].data() as DocumentMetadata;

      try {
        const result = await this.exportDocument(docData, config);

        if (result.success) {
          retriedDocuments.push({
            documentId: error.documentId,
            firebasePath: error.documentPath,
            externalUrl: result.externalUrl!,
            externalId: result.externalId!,
            exportedAt: Timestamp.now(),
            fileSize: docData.sizeBytes,
          });

          await this.updateDocumentExportStatus(error.documentId, config.provider, {
            status: 'exported',
            externalUrl: result.externalUrl,
            externalId: result.externalId,
            lastExportedAt: Timestamp.now(),
          });
        } else {
          stillFailed.push({
            ...error,
            error: result.error || 'Unknown error',
            retryCount: error.retryCount + 1,
            timestamp: Timestamp.now(),
          });
        }
      } catch (err) {
        stillFailed.push({
          ...error,
          error: err instanceof Error ? err.message : String(err),
          retryCount: error.retryCount + 1,
          timestamp: Timestamp.now(),
        });
      }
    }

    // Update job
    const updatedJob: ExportJob = {
      ...job,
      exportedDocuments: job.exportedDocuments + retriedDocuments.length,
      failedDocuments: stillFailed.length,
      exportedFiles: [...(job.exportedFiles || []), ...retriedDocuments],
      errors: stillFailed,
    };

    // Cast through Partial<ExportJob>: updateDoc's UpdateData<T> can't infer
    // through nested arrays of objects carrying Firestore Timestamps.
    await updateDoc(doc(db, 'export_jobs', jobId), updatedJob as Partial<ExportJob>);

    return updatedJob;
  }
}

export const documentExportService = new DocumentExportService();
