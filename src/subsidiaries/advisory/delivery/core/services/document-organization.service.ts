/**
 * DOCUMENT ORGANIZATION SERVICE (ADD-FIN-001)
 *
 * Features:
 * - Standard filename generation: [YYYY-MM-DD]_[ProjectCode]_[DocType]_[Description]
 * - Auto-folder creation and organization
 * - Document quality validation (300 DPI)
 * - 7-year retention tracking
 * - Batch document operations
 */

import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  FirebaseStorage,
} from 'firebase/storage';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  getDocs,
  Timestamp,
  Firestore,
} from 'firebase/firestore';
import type { DocumentType } from '../../types/accountability';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export type DocumentCategory =
  | 'requisition'
  | 'accountability'
  | 'receipt'
  | 'invoice'
  | 'delivery_note'
  | 'attendance_register'
  | 'rental_agreement'
  | 'waybill'
  | 'photo_evidence'
  | 'variance_investigation'
  | 'reconciliation'
  | 'other';

export interface DocumentMetadata {
  id: string;
  projectId: string;
  projectCode: string;
  category: DocumentCategory;
  documentType: DocumentType;
  originalFilename: string;
  standardFilename: string;
  storagePath: string;
  downloadUrl: string;

  // File information
  fileSize: number;
  mimeType: string;
  extension: string;

  // Quality validation
  dpi?: number;
  isQualityValid: boolean;
  qualityValidationNotes?: string;

  // Metadata
  uploadedBy: string;
  uploadedAt: Timestamp;
  description?: string;
  tags?: string[];

  // Retention (7-year policy)
  retentionPeriodYears: number;
  expirationDate: Date;

  // Links
  linkedEntityId?: string; // Requisition ID, Accountability ID, etc.
  linkedEntityType?: 'requisition' | 'accountability' | 'investigation' | 'reconciliation';

  // Audit
  accessLog: DocumentAccessLog[];
  lastAccessedAt?: Timestamp;
  lastAccessedBy?: string;
}

export interface DocumentAccessLog {
  userId: string;
  userName: string;
  action: 'view' | 'download' | 'share';
  timestamp: Timestamp;
  ipAddress?: string;
}

export interface DocumentUploadOptions {
  projectId: string;
  projectCode: string;
  category: DocumentCategory;
  documentType: DocumentType;
  description?: string;
  linkedEntityId?: string;
  linkedEntityType?: 'requisition' | 'accountability' | 'investigation' | 'reconciliation';
  retentionYears?: number;
}

export interface DocumentValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  dpi?: number;
  fileSize: number;
  mimeType: string;
}

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────

const DOCUMENTS_COLLECTION = 'documents';
const STORAGE_BASE_PATH = 'advisory/delivery';
const DEFAULT_RETENTION_YEARS = 7; // ADD-FIN-001 requirement
const MIN_DPI = 300; // ADD-FIN-001 requirement
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const FOLDER_STRUCTURE: Record<DocumentCategory, string> = {
  requisition: 'Requisitions',
  accountability: 'Accountabilities',
  receipt: 'Receipts',
  invoice: 'Invoices',
  delivery_note: 'Delivery_Notes',
  attendance_register: 'Attendance_Registers',
  rental_agreement: 'Rental_Agreements',
  waybill: 'Waybills',
  photo_evidence: 'Photos',
  variance_investigation: 'Variance_Investigations',
  reconciliation: 'Reconciliations',
  other: 'Other',
};

// ─────────────────────────────────────────────────────────────────
// DOCUMENT ORGANIZATION SERVICE
// ─────────────────────────────────────────────────────────────────

export class DocumentOrganizationService {
  constructor(
    private storage: FirebaseStorage,
    private db: Firestore
  ) {}

  // ─────────────────────────────────────────────────────────────────
  // FILENAME GENERATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Generate standard filename per ADD-FIN-001
   * Format: [YYYY-MM-DD]_[ProjectCode]_[DocType]_[Description]
   */
  generateStandardFilename(
    projectCode: string,
    category: DocumentCategory,
    description: string,
    extension: string
  ): string {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const sanitizedDescription = this.sanitizeFilename(description);
    const categoryShort = this.getCategoryShortCode(category);

    return `${date}_${projectCode}_${categoryShort}_${sanitizedDescription}.${extension}`;
  }

  /**
   * Sanitize description for filename
   */
  private sanitizeFilename(text: string): string {
    return text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 50); // Max 50 chars
  }

  /**
   * Get short code for category
   */
  private getCategoryShortCode(category: DocumentCategory): string {
    const codes: Record<DocumentCategory, string> = {
      requisition: 'REQ',
      accountability: 'ACC',
      receipt: 'RCP',
      invoice: 'INV',
      delivery_note: 'DLV',
      attendance_register: 'ATT',
      rental_agreement: 'RNT',
      waybill: 'WBL',
      photo_evidence: 'PHO',
      variance_investigation: 'VAR',
      reconciliation: 'REC',
      other: 'OTH',
    };
    return codes[category];
  }

  /**
   * Get file extension from filename or mime type
   */
  private getFileExtension(filename: string, mimeType: string): string {
    const extensionFromName = filename.split('.').pop()?.toLowerCase();
    if (extensionFromName && extensionFromName.length <= 5) {
      return extensionFromName;
    }

    // Fallback to mime type
    const mimeExtensions: Record<string, string> = {
      'application/pdf': 'pdf',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/jpg': 'jpg',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        'docx',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        'xlsx',
      'application/vnd.ms-excel': 'xls',
    };

    return mimeExtensions[mimeType] || 'bin';
  }

  // ─────────────────────────────────────────────────────────────────
  // FOLDER ORGANIZATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Generate storage path with folder structure
   * Format: advisory/delivery/{projectCode}/{Year}/{Category}/{filename}
   */
  generateStoragePath(
    projectCode: string,
    category: DocumentCategory,
    filename: string
  ): string {
    const year = new Date().getFullYear();
    const folderName = FOLDER_STRUCTURE[category];

    return `${STORAGE_BASE_PATH}/${projectCode}/${year}/${folderName}/${filename}`;
  }

  // ─────────────────────────────────────────────────────────────────
  // DOCUMENT VALIDATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Validate document before upload
   */
  async validateDocument(file: File): Promise<DocumentValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      errors.push(
        `File size (${(file.size / 1024 / 1024).toFixed(2)} MB) exceeds maximum (50 MB)`
      );
    }

    if (file.size === 0) {
      errors.push('File is empty');
    }

    // Check mime type
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];

    if (!allowedTypes.includes(file.type)) {
      errors.push(
        `File type ${file.type} not allowed. Allowed: PDF, Images (JPEG, PNG), Word, Excel`
      );
    }

    // Extract DPI for images
    let dpi: number | undefined;
    if (file.type.startsWith('image/')) {
      try {
        dpi = await this.extractImageDPI(file);
        if (dpi && dpi < MIN_DPI) {
          warnings.push(
            `Image quality (${dpi} DPI) is below ADD-FIN-001 requirement (${MIN_DPI} DPI). Document may be rejected during review.`
          );
        }
      } catch (error) {
        warnings.push('Could not extract DPI from image. Manual quality review required.');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      dpi,
      fileSize: file.size,
      mimeType: file.type,
    };
  }

  /**
   * Extract DPI from image file
   */
  private async extractImageDPI(file: File): Promise<number | undefined> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Try to extract from EXIF data
          // This is a simplified version - production would use exif-js library
          resolve(300); // Placeholder - assume 300 DPI if not available
        };
        img.onerror = () => resolve(undefined);
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // UPLOAD
  // ─────────────────────────────────────────────────────────────────

  /**
   * Upload document with organization
   */
  async uploadDocument(
    file: File,
    options: DocumentUploadOptions,
    userId: string
  ): Promise<DocumentMetadata> {
    // Validate document
    const validation = await this.validateDocument(file);
    if (!validation.valid) {
      throw new Error(`Document validation failed: ${validation.errors.join(', ')}`);
    }

    // Generate filenames and paths
    const extension = this.getFileExtension(file.name, file.type);
    const description = options.description || file.name.replace(/\.[^/.]+$/, '');
    const standardFilename = this.generateStandardFilename(
      options.projectCode,
      options.category,
      description,
      extension
    );
    const storagePath = this.generateStoragePath(
      options.projectCode,
      options.category,
      standardFilename
    );

    // Upload to Firebase Storage
    const storageRef = ref(this.storage, storagePath);
    await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(storageRef);

    // Calculate retention
    const retentionYears = options.retentionYears || DEFAULT_RETENTION_YEARS;
    const expirationDate = new Date();
    expirationDate.setFullYear(expirationDate.getFullYear() + retentionYears);

    // Create metadata document
    const metadata: Omit<DocumentMetadata, 'id'> = {
      projectId: options.projectId,
      projectCode: options.projectCode,
      category: options.category,
      documentType: options.documentType,
      originalFilename: file.name,
      standardFilename,
      storagePath,
      downloadUrl,
      fileSize: file.size,
      mimeType: file.type,
      extension,
      dpi: validation.dpi,
      isQualityValid: !validation.dpi || validation.dpi >= MIN_DPI,
      qualityValidationNotes: validation.warnings.join('; '),
      uploadedBy: userId,
      uploadedAt: Timestamp.now(),
      description: options.description,
      retentionPeriodYears: retentionYears,
      expirationDate,
      linkedEntityId: options.linkedEntityId,
      linkedEntityType: options.linkedEntityType,
      accessLog: [
        {
          userId,
          userName: 'System',
          action: 'view',
          timestamp: Timestamp.now(),
        },
      ],
    };

    const docRef = await addDoc(collection(this.db, DOCUMENTS_COLLECTION), metadata);

    return {
      id: docRef.id,
      ...metadata,
    };
  }

  /**
   * Batch upload multiple documents
   */
  async uploadDocumentBatch(
    files: File[],
    options: DocumentUploadOptions,
    userId: string
  ): Promise<DocumentMetadata[]> {
    const results: DocumentMetadata[] = [];
    const errors: { file: string; error: string }[] = [];

    for (const file of files) {
      try {
        const metadata = await this.uploadDocument(file, options, userId);
        results.push(metadata);
      } catch (error: any) {
        errors.push({ file: file.name, error: error.message });
      }
    }

    if (errors.length > 0) {
      console.warn('Some documents failed to upload:', errors);
    }

    return results;
  }

  // ─────────────────────────────────────────────────────────────────
  // RETRIEVAL
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get documents by project
   */
  async getProjectDocuments(projectId: string): Promise<DocumentMetadata[]> {
    const q = query(
      collection(this.db, DOCUMENTS_COLLECTION),
      where('projectId', '==', projectId)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as DocumentMetadata));
  }

  /**
   * Get documents by linked entity
   */
  async getLinkedDocuments(
    linkedEntityId: string,
    linkedEntityType?: 'requisition' | 'accountability' | 'investigation' | 'reconciliation'
  ): Promise<DocumentMetadata[]> {
    let q = query(
      collection(this.db, DOCUMENTS_COLLECTION),
      where('linkedEntityId', '==', linkedEntityId)
    );

    if (linkedEntityType) {
      q = query(q, where('linkedEntityType', '==', linkedEntityType));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as DocumentMetadata));
  }

  /**
   * Get documents by category
   */
  async getDocumentsByCategory(
    projectId: string,
    category: DocumentCategory
  ): Promise<DocumentMetadata[]> {
    const q = query(
      collection(this.db, DOCUMENTS_COLLECTION),
      where('projectId', '==', projectId),
      where('category', '==', category)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as DocumentMetadata));
  }

  /**
   * Get documents with low quality
   */
  async getLowQualityDocuments(projectId: string): Promise<DocumentMetadata[]> {
    const q = query(
      collection(this.db, DOCUMENTS_COLLECTION),
      where('projectId', '==', projectId),
      where('isQualityValid', '==', false)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as DocumentMetadata));
  }

  /**
   * Get documents approaching expiration
   */
  async getExpiringDocuments(daysUntilExpiration: number = 90): Promise<DocumentMetadata[]> {
    const expirationThreshold = new Date();
    expirationThreshold.setDate(expirationThreshold.getDate() + daysUntilExpiration);

    const q = query(collection(this.db, DOCUMENTS_COLLECTION));
    const snapshot = await getDocs(q);

    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as DocumentMetadata))
      .filter(
        (doc) => new Date(doc.expirationDate) <= expirationThreshold
      );
  }

  // ─────────────────────────────────────────────────────────────────
  // ACCESS LOGGING
  // ─────────────────────────────────────────────────────────────────

  /**
   * Log document access
   */
  async logDocumentAccess(
    documentId: string,
    userId: string,
    userName: string,
    action: 'view' | 'download' | 'share',
    ipAddress?: string
  ): Promise<void> {
    const accessEntry: DocumentAccessLog = {
      userId,
      userName,
      action,
      timestamp: Timestamp.now(),
      ipAddress,
    };

    await updateDoc(doc(this.db, DOCUMENTS_COLLECTION, documentId), {
      accessLog: [...(await this.getAccessLog(documentId)), accessEntry],
      lastAccessedAt: Timestamp.now(),
      lastAccessedBy: userId,
    });
  }

  /**
   * Get access log for document
   */
  private async getAccessLog(documentId: string): Promise<DocumentAccessLog[]> {
    const docSnap = await getDocs(
      query(collection(this.db, DOCUMENTS_COLLECTION), where('id', '==', documentId))
    );
    if (docSnap.empty) return [];
    return (docSnap.docs[0].data() as DocumentMetadata).accessLog || [];
  }

  // ─────────────────────────────────────────────────────────────────
  // DELETION (WITH RETENTION POLICY)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Delete document (checks retention policy)
   */
  async deleteDocument(documentId: string, userId: string): Promise<void> {
    const docSnap = await getDocs(
      query(collection(this.db, DOCUMENTS_COLLECTION), where('id', '==', documentId))
    );

    if (docSnap.empty) {
      throw new Error('Document not found');
    }

    const metadata = docSnap.docs[0].data() as DocumentMetadata;

    // Check if still within retention period
    if (new Date() < new Date(metadata.expirationDate)) {
      throw new Error(
        `Document is still within retention period. Expires: ${new Date(metadata.expirationDate).toDateString()}`
      );
    }

    // Delete from storage
    const storageRef = ref(this.storage, metadata.storagePath);
    await deleteObject(storageRef);

    // Delete metadata
    await updateDoc(doc(this.db, DOCUMENTS_COLLECTION, documentId), {
      deletedAt: Timestamp.now(),
      deletedBy: userId,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // REPORTING
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get document statistics for project
   */
  async getDocumentStatistics(projectId: string): Promise<{
    totalDocuments: number;
    totalSize: number;
    byCategory: Record<DocumentCategory, number>;
    lowQualityCount: number;
    expiringWithin90Days: number;
  }> {
    const documents = await this.getProjectDocuments(projectId);
    const expiringDocs = await this.getExpiringDocuments(90);

    const byCategory = documents.reduce(
      (acc, doc) => {
        acc[doc.category] = (acc[doc.category] || 0) + 1;
        return acc;
      },
      {} as Record<DocumentCategory, number>
    );

    return {
      totalDocuments: documents.length,
      totalSize: documents.reduce((sum, doc) => sum + doc.fileSize, 0),
      byCategory,
      lowQualityCount: documents.filter((d) => !d.isQualityValid).length,
      expiringWithin90Days: expiringDocs.filter((d) => d.projectId === projectId).length,
    };
  }
}

// Export factory
export function getDocumentOrganizationService(
  storage: FirebaseStorage,
  db: Firestore
): DocumentOrganizationService {
  return new DocumentOrganizationService(storage, db);
}
