/**
 * DOCUMENT SERVICE
 * 
 * Handles document upload, versioning, access control, and management.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  Timestamp,
  increment,
  QueryConstraint,
  Unsubscribe,
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  getStorage,
} from 'firebase/storage';
import app, { db, auth } from '../../../../../firebase/config';
import { COLLECTION_PATHS } from '../../firebase/collections';
import {
  Document,
  DocumentVersion,
  DocumentActivity,
  DocumentFolder,
  DocumentShareLink,
  DocumentUploadRequest,
  DocumentFilters,
  DocumentSort,
  DocumentList,
  UploadProgress,
  UploadResult,
  BatchUploadRequest,
  BatchUploadResult,
  CreateShareLinkRequest,
  DocumentAction,
  DocumentStatus,
  DocumentAccessLevel,
  isAllowedMimeType,
  getFileSizeLimit,
  generateStoragePath,
  getFileExtension,
} from './document-types';

// Initialize Firebase Storage
const storage = getStorage(app);

// ============================================================================
// Document Service Class
// ============================================================================

export class DocumentService {
  private static instance: DocumentService;
  private subscriptions: Map<string, Unsubscribe> = new Map();
  
  private constructor() {}
  
  static getInstance(): DocumentService {
    if (!DocumentService.instance) {
      DocumentService.instance = new DocumentService();
    }
    return DocumentService.instance;
  }
  
  // ==========================================================================
  // Upload Operations
  // ==========================================================================
  
  /**
   * Upload a single document
   */
  async uploadDocument(
    request: DocumentUploadRequest,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    const startTime = Date.now();
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }
    
    try {
      // Validate file
      const validationError = this.validateFile(request.file);
      if (validationError) {
        return { success: false, error: validationError };
      }
      
      // Generate document ID and storage path
      const documentId = doc(collection(db, 'documents')).id;
      const storagePath = generateStoragePath(
        request.engagementId,
        request.category,
        request.file.name,
        documentId
      );
      
      // Upload to storage
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, request.file, {
        contentType: request.file.type,
        customMetadata: {
          engagementId: request.engagementId,
          uploadedBy: currentUser.uid,
          documentId,
        },
      });
      
      // Track progress
      if (onProgress) {
        uploadTask.on('state_changed', (snapshot) => {
          onProgress({
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes,
            percentage: (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
            state: snapshot.state as UploadProgress['state'],
          });
        });
      }
      
      // Wait for upload to complete
      await uploadTask;
      
      // Get download URL
      const downloadUrl = await getDownloadURL(storageRef);
      
      // Determine version
      let version = 1;
      let previousVersionId: string | undefined;
      
      if (request.previousDocumentId) {
        const prevDoc = await this.getDocument(request.previousDocumentId);
        if (prevDoc) {
          version = prevDoc.version + 1;
          previousVersionId = request.previousDocumentId;
          
          // Mark previous version as not latest
          await updateDoc(
            doc(db, COLLECTION_PATHS.ENGAGEMENTS, request.engagementId, 'documents', request.previousDocumentId),
            {
              isLatest: false,
              status: 'superseded' as DocumentStatus,
              updatedAt: Timestamp.now(),
              updatedBy: currentUser.uid,
            }
          );
          
          // Create version record for previous
          await this.createVersionRecord(prevDoc, request.engagementId);
        }
      }
      
      // Create document record
      const document: Document = {
        id: documentId,
        name: request.name || request.file.name.replace(/\.[^/.]+$/, ''),
        description: request.description,
        category: request.category,
        type: request.type,
        fileName: request.file.name,
        fileExtension: getFileExtension(request.file.name),
        mimeType: request.file.type,
        fileSize: request.file.size,
        storagePath,
        downloadUrl,
        version,
        versionLabel: request.versionLabel,
        previousVersionId,
        isLatest: true,
        engagementId: request.engagementId,
        module: request.module,
        entityType: request.entityType,
        entityId: request.entityId,
        folderId: request.folderId,
        accessLevel: request.accessLevel || 'team',
        allowedUsers: request.allowedUsers,
        allowedRoles: request.allowedRoles,
        status: request.requiresApproval ? 'pending_review' : 'approved',
        requiresApproval: request.requiresApproval || false,
        tags: request.tags || [],
        referenceNumber: request.referenceNumber,
        uploadedBy: currentUser.uid,
        uploadedAt: Timestamp.now(),
        availableOffline: request.availableOffline || false,
      };
      
      // Save to Firestore (within engagement subcollection)
      await setDoc(
        doc(db, COLLECTION_PATHS.ENGAGEMENTS, request.engagementId, 'documents', documentId),
        document
      );
      
      // Log activity
      await this.logActivity(request.engagementId, documentId, 'uploaded', {
        fileName: document.fileName,
        fileSize: document.fileSize,
        version: document.version,
      });
      
      // Update folder document count if in folder
      if (request.folderId) {
        await updateDoc(
          doc(db, COLLECTION_PATHS.ENGAGEMENTS, request.engagementId, 'documentFolders', request.folderId),
          { documentCount: increment(1) }
        );
      }
      
      return {
        success: true,
        document,
        uploadDuration: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }
  
  /**
   * Upload multiple documents
   */
  async uploadDocuments(
    request: BatchUploadRequest,
    onProgress?: (fileName: string, progress: UploadProgress) => void
  ): Promise<BatchUploadResult> {
    const results: BatchUploadResult['results'] = [];
    
    for (const file of request.files) {
      const result = await this.uploadDocument(
        {
          file,
          category: request.category,
          type: request.type,
          engagementId: request.engagementId,
          module: request.module,
          entityType: request.entityType,
          entityId: request.entityId,
          folderId: request.folderId,
          accessLevel: request.accessLevel,
          tags: request.tags,
        },
        onProgress ? (progress) => onProgress(file.name, progress) : undefined
      );
      
      results.push({
        fileName: file.name,
        success: result.success,
        document: result.document,
        error: result.error,
      });
    }
    
    return {
      total: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }
  
  /**
   * Validate file before upload
   */
  private validateFile(file: File): string | null {
    // Check MIME type
    if (!isAllowedMimeType(file.type)) {
      return `File type '${file.type}' is not allowed`;
    }
    
    // Check file size
    const sizeLimit = getFileSizeLimit(file.type);
    if (file.size > sizeLimit) {
      return `File size exceeds limit of ${Math.round(sizeLimit / 1024 / 1024)}MB`;
    }
    
    // Check file name
    if (!file.name || file.name.length > 255) {
      return 'Invalid file name';
    }
    
    return null;
  }
  
  // ==========================================================================
  // Read Operations
  // ==========================================================================
  
  /**
   * Get a single document by ID
   */
  async getDocument(documentId: string, engagementId?: string): Promise<Document | null> {
    try {
      // If engagementId provided, use subcollection path
      if (engagementId) {
        const docSnap = await getDoc(
          doc(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, 'documents', documentId)
        );
        if (!docSnap.exists()) return null;
        return { id: docSnap.id, ...docSnap.data() } as Document;
      }
      
      // Otherwise search across engagements (less efficient)
      // In production, you'd want to require engagementId
      return null;
    } catch (error) {
      console.error('Error getting document:', error);
      throw error;
    }
  }
  
  /**
   * List documents with filters and pagination
   */
  async listDocuments(
    filters: DocumentFilters,
    sort: DocumentSort = { field: 'uploadedAt', direction: 'desc' },
    pageSize: number = 20,
    cursor?: string
  ): Promise<DocumentList> {
    if (!filters.engagementId) {
      throw new Error('engagementId is required for listing documents');
    }

    try {
      const constraints: QueryConstraint[] = [];
      
      // Apply filters
      if (filters.module) {
        constraints.push(where('module', '==', filters.module));
      }
      if (filters.category) {
        constraints.push(where('category', '==', filters.category));
      }
      if (filters.type) {
        constraints.push(where('type', '==', filters.type));
      }
      if (filters.status) {
        constraints.push(where('status', '==', filters.status));
      }
      if (filters.accessLevel) {
        constraints.push(where('accessLevel', '==', filters.accessLevel));
      }
      if (filters.folderId) {
        constraints.push(where('folderId', '==', filters.folderId));
      }
      if (filters.entityType) {
        constraints.push(where('entityType', '==', filters.entityType));
      }
      if (filters.entityId) {
        constraints.push(where('entityId', '==', filters.entityId));
      }
      if (filters.uploadedBy) {
        constraints.push(where('uploadedBy', '==', filters.uploadedBy));
      }
      if (filters.isLatest !== undefined) {
        constraints.push(where('isLatest', '==', filters.isLatest));
      }
      if (filters.requiresApproval !== undefined) {
        constraints.push(where('requiresApproval', '==', filters.requiresApproval));
      }
      if (filters.availableOffline !== undefined) {
        constraints.push(where('availableOffline', '==', filters.availableOffline));
      }
      if (filters.tags && filters.tags.length > 0) {
        constraints.push(where('tags', 'array-contains-any', filters.tags));
      }
      
      // Add sorting
      constraints.push(orderBy(sort.field, sort.direction));
      
      // Add pagination
      constraints.push(limit(pageSize + 1));
      
      if (cursor) {
        const cursorDoc = await getDoc(
          doc(db, COLLECTION_PATHS.ENGAGEMENTS, filters.engagementId, 'documents', cursor)
        );
        if (cursorDoc.exists()) {
          constraints.push(startAfter(cursorDoc));
        }
      }
      
      const q = query(
        collection(db, COLLECTION_PATHS.ENGAGEMENTS, filters.engagementId, 'documents'),
        ...constraints
      );
      const snapshot = await getDocs(q);
      
      const documents = snapshot.docs.slice(0, pageSize).map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Document[];
      
      const hasMore = snapshot.docs.length > pageSize;
      const nextCursor = hasMore ? documents[documents.length - 1]?.id : undefined;
      
      return {
        documents,
        totalCount: documents.length,
        hasMore,
        nextCursor,
      };
    } catch (error) {
      console.error('Error listing documents:', error);
      throw error;
    }
  }
  
  /**
   * Get documents for an entity
   */
  async getEntityDocuments(
    engagementId: string,
    entityType: string,
    entityId: string
  ): Promise<Document[]> {
    const result = await this.listDocuments({
      engagementId,
      entityType,
      entityId,
      isLatest: true,
    });
    return result.documents;
  }
  
  /**
   * Get version history for a document
   */
  async getVersionHistory(engagementId: string, documentId: string): Promise<DocumentVersion[]> {
    try {
      const q = query(
        collection(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, 'documentVersions'),
        where('documentId', '==', documentId),
        orderBy('version', 'desc')
      );
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as DocumentVersion[];
    } catch (error) {
      console.error('Error getting version history:', error);
      throw error;
    }
  }
  
  /**
   * Get document activity log
   */
  async getDocumentActivity(
    engagementId: string,
    documentId: string,
    limitCount: number = 50
  ): Promise<DocumentActivity[]> {
    try {
      const q = query(
        collection(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, 'documentActivity'),
        where('documentId', '==', documentId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as DocumentActivity[];
    } catch (error) {
      console.error('Error getting document activity:', error);
      throw error;
    }
  }
  
  /**
   * Search documents by name
   */
  async searchDocuments(
    engagementId: string,
    searchTerm: string,
    limitCount: number = 20
  ): Promise<Document[]> {
    const q = query(
      collection(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, 'documents'),
      where('isLatest', '==', true),
      where('name', '>=', searchTerm),
      where('name', '<=', searchTerm + '\uf8ff'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Document[];
  }
  
  // ==========================================================================
  // Update Operations
  // ==========================================================================
  
  /**
   * Update document metadata
   */
  async updateDocument(
    engagementId: string,
    documentId: string,
    updates: Partial<Pick<Document, 
      'name' | 'description' | 'category' | 'type' | 
      'accessLevel' | 'allowedUsers' | 'allowedRoles' |
      'tags' | 'referenceNumber' | 'availableOffline'
    >>
  ): Promise<Document> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');
    
    const document = await this.getDocument(documentId, engagementId);
    if (!document) throw new Error('Document not found');
    
    // Check access
    if (!this.canEditDocument(document, currentUser.uid)) {
      throw new Error('Permission denied');
    }
    
    const updateData = {
      ...updates,
      updatedBy: currentUser.uid,
      updatedAt: Timestamp.now(),
    };
    
    await updateDoc(
      doc(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, 'documents', documentId),
      updateData
    );
    
    await this.logActivity(engagementId, documentId, 'updated', { updates });
    
    return { ...document, ...updateData } as Document;
  }
  
  /**
   * Update document status
   */
  async updateDocumentStatus(
    engagementId: string,
    documentId: string,
    status: DocumentStatus,
    comments?: string
  ): Promise<Document> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');
    
    const document = await this.getDocument(documentId, engagementId);
    if (!document) throw new Error('Document not found');
    
    const previousStatus = document.status;
    
    const updateData: Partial<Document> = {
      status,
      updatedBy: currentUser.uid,
      updatedAt: Timestamp.now(),
    };
    
    if (status === 'approved' || status === 'rejected') {
      updateData.reviewedBy = currentUser.uid;
      updateData.reviewedAt = Timestamp.now();
      updateData.reviewComments = comments;
    }
    
    await updateDoc(
      doc(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, 'documents', documentId),
      updateData
    );
    
    await this.logActivity(engagementId, documentId, 'status_changed', {
      previousStatus,
      newStatus: status,
      comments,
    });
    
    return { ...document, ...updateData } as Document;
  }
  
  /**
   * Move document to different folder
   */
  async moveDocument(
    engagementId: string,
    documentId: string,
    targetFolderId: string | null,
    sourceFolderId?: string
  ): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');
    
    const document = await this.getDocument(documentId, engagementId);
    if (!document) throw new Error('Document not found');
    
    // Update document
    await updateDoc(
      doc(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, 'documents', documentId),
      {
        folderId: targetFolderId,
        updatedBy: currentUser.uid,
        updatedAt: Timestamp.now(),
      }
    );
    
    // Update folder counts
    if (sourceFolderId) {
      await updateDoc(
        doc(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, 'documentFolders', sourceFolderId),
        { documentCount: increment(-1) }
      );
    }
    
    if (targetFolderId) {
      await updateDoc(
        doc(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, 'documentFolders', targetFolderId),
        { documentCount: increment(1) }
      );
    }
    
    await this.logActivity(engagementId, documentId, 'updated', { 
      action: 'moved',
      targetFolderId 
    });
  }
  
  // ==========================================================================
  // Delete Operations
  // ==========================================================================
  
  /**
   * Archive a document (soft delete)
   */
  async archiveDocument(engagementId: string, documentId: string): Promise<void> {
    await this.updateDocumentStatus(engagementId, documentId, 'archived');
    await this.logActivity(engagementId, documentId, 'archived', {});
  }
  
  /**
   * Restore an archived document
   */
  async restoreDocument(engagementId: string, documentId: string): Promise<void> {
    await this.updateDocumentStatus(engagementId, documentId, 'approved');
    await this.logActivity(engagementId, documentId, 'restored', {});
  }
  
  /**
   * Permanently delete a document
   */
  async deleteDocument(engagementId: string, documentId: string): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');
    
    const document = await this.getDocument(documentId, engagementId);
    if (!document) throw new Error('Document not found');
    
    // Check access (only owner or engagement owner can delete)
    if (document.uploadedBy !== currentUser.uid) {
      throw new Error('Permission denied');
    }
    
    // Delete from storage
    try {
      const storageRef = ref(storage, document.storagePath);
      await deleteObject(storageRef);
    } catch (error) {
      console.error('Error deleting file from storage:', error);
    }
    
    // Update folder count
    if (document.folderId) {
      await updateDoc(
        doc(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, 'documentFolders', document.folderId),
        { documentCount: increment(-1) }
      );
    }
    
    // Delete from Firestore
    await deleteDoc(
      doc(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, 'documents', documentId)
    );
  }
  
  // ==========================================================================
  // Version Operations
  // ==========================================================================
  
  /**
   * Create a new version of an existing document
   */
  async createNewVersion(
    engagementId: string,
    previousDocumentId: string,
    file: File,
    options?: {
      versionLabel?: string;
      changeDescription?: string;
    }
  ): Promise<UploadResult> {
    const previousDoc = await this.getDocument(previousDocumentId, engagementId);
    if (!previousDoc) {
      return { success: false, error: 'Previous document not found' };
    }
    
    return this.uploadDocument({
      file,
      name: previousDoc.name,
      description: previousDoc.description,
      category: previousDoc.category,
      type: previousDoc.type,
      engagementId: previousDoc.engagementId,
      module: previousDoc.module,
      entityType: previousDoc.entityType,
      entityId: previousDoc.entityId,
      folderId: previousDoc.folderId,
      accessLevel: previousDoc.accessLevel,
      allowedUsers: previousDoc.allowedUsers,
      allowedRoles: previousDoc.allowedRoles,
      tags: previousDoc.tags,
      referenceNumber: previousDoc.referenceNumber,
      versionLabel: options?.versionLabel,
      previousDocumentId,
      changeDescription: options?.changeDescription,
    });
  }
  
  /**
   * Create version record for history
   */
  private async createVersionRecord(document: Document, engagementId: string): Promise<void> {
    const versionRecord: DocumentVersion = {
      id: doc(collection(db, 'temp')).id,
      documentId: document.id,
      version: document.version,
      versionLabel: document.versionLabel,
      fileName: document.fileName,
      fileSize: document.fileSize,
      storagePath: document.storagePath,
      downloadUrl: document.downloadUrl,
      createdBy: document.uploadedBy,
      createdAt: document.uploadedAt,
      md5Hash: document.md5Hash,
    };
    
    await setDoc(
      doc(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, 'documentVersions', versionRecord.id),
      versionRecord
    );
  }
  
  /**
   * Get specific version of a document
   */
  async getDocumentVersion(
    engagementId: string,
    documentId: string,
    version: number
  ): Promise<DocumentVersion | null> {
    const q = query(
      collection(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, 'documentVersions'),
      where('documentId', '==', documentId),
      where('version', '==', version),
      limit(1)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    return {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data(),
    } as DocumentVersion;
  }
  
  // ==========================================================================
  // Share Operations
  // ==========================================================================
  
  /**
   * Create a shareable link for a document
   */
  async createShareLink(
    engagementId: string,
    request: CreateShareLinkRequest
  ): Promise<DocumentShareLink> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');
    
    const document = await this.getDocument(request.documentId, engagementId);
    if (!document) throw new Error('Document not found');
    
    // Generate secure token
    const token = this.generateShareToken();
    
    const shareLink: DocumentShareLink = {
      id: doc(collection(db, 'temp')).id,
      documentId: request.documentId,
      token,
      expiresAt: request.expiresIn 
        ? Timestamp.fromDate(new Date(Date.now() + request.expiresIn * 60 * 60 * 1000))
        : undefined,
      maxDownloads: request.maxDownloads,
      downloadCount: 0,
      requiresPassword: !!request.password,
      passwordHash: request.password ? await this.hashPassword(request.password) : undefined,
      allowDownload: request.allowDownload ?? true,
      allowView: request.allowView ?? true,
      createdBy: currentUser.uid,
      createdAt: Timestamp.now(),
    };
    
    await setDoc(
      doc(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, 'documentShareLinks', shareLink.id),
      shareLink
    );
    
    await this.logActivity(engagementId, request.documentId, 'shared', {
      shareLinkId: shareLink.id,
      expiresAt: shareLink.expiresAt,
    });
    
    return shareLink;
  }
  
  /**
   * Revoke a share link
   */
  async revokeShareLink(engagementId: string, shareLinkId: string): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');
    
    const shareLinkDoc = await getDoc(
      doc(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, 'documentShareLinks', shareLinkId)
    );
    if (!shareLinkDoc.exists()) throw new Error('Share link not found');
    
    const shareLink = shareLinkDoc.data() as DocumentShareLink;
    
    await deleteDoc(
      doc(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, 'documentShareLinks', shareLinkId)
    );
    
    await this.logActivity(engagementId, shareLink.documentId, 'unshared', {
      shareLinkId,
    });
  }
  
  /**
   * Record share link access
   */
  async recordShareLinkAccess(engagementId: string, shareLinkId: string): Promise<void> {
    await updateDoc(
      doc(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, 'documentShareLinks', shareLinkId),
      { downloadCount: increment(1) }
    );
  }
  
  // ==========================================================================
  // Folder Operations
  // ==========================================================================
  
  /**
   * Create a folder
   */
  async createFolder(
    engagementId: string,
    name: string,
    options?: {
      parentId?: string;
      description?: string;
      module?: string;
      color?: string;
      icon?: string;
    }
  ): Promise<DocumentFolder> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');
    
    let path = `/${name}`;
    let depth = 0;
    
    if (options?.parentId) {
      const parent = await this.getFolder(engagementId, options.parentId);
      if (parent) {
        path = `${parent.path}/${name}`;
        depth = parent.depth + 1;
      }
    }
    
    const folder: DocumentFolder = {
      id: doc(collection(db, 'temp')).id,
      name,
      description: options?.description,
      parentId: options?.parentId,
      path,
      depth,
      engagementId,
      module: options?.module as DocumentFolder['module'],
      accessLevel: 'team',
      color: options?.color,
      icon: options?.icon,
      documentCount: 0,
      subfolderCount: 0,
      createdBy: currentUser.uid,
      createdAt: Timestamp.now(),
    };
    
    await setDoc(
      doc(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, 'documentFolders', folder.id),
      folder
    );
    
    // Update parent subfolder count
    if (options?.parentId) {
      await updateDoc(
        doc(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, 'documentFolders', options.parentId),
        { subfolderCount: increment(1) }
      );
    }
    
    return folder;
  }
  
  /**
   * Get a folder by ID
   */
  async getFolder(engagementId: string, folderId: string): Promise<DocumentFolder | null> {
    const docSnap = await getDoc(
      doc(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, 'documentFolders', folderId)
    );
    if (!docSnap.exists()) return null;
    
    return { id: docSnap.id, ...docSnap.data() } as DocumentFolder;
  }
  
  /**
   * List folders in an engagement
   */
  async listFolders(
    engagementId: string,
    parentId?: string
  ): Promise<DocumentFolder[]> {
    const constraints: QueryConstraint[] = [];
    
    if (parentId) {
      constraints.push(where('parentId', '==', parentId));
    } else {
      constraints.push(where('depth', '==', 0));
    }
    
    constraints.push(orderBy('name', 'asc'));
    
    const q = query(
      collection(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, 'documentFolders'),
      ...constraints
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as DocumentFolder[];
  }
  
  /**
   * Delete a folder (must be empty)
   */
  async deleteFolder(engagementId: string, folderId: string): Promise<void> {
    const folder = await this.getFolder(engagementId, folderId);
    if (!folder) throw new Error('Folder not found');
    
    if (folder.documentCount > 0 || folder.subfolderCount > 0) {
      throw new Error('Folder must be empty before deleting');
    }
    
    await deleteDoc(
      doc(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, 'documentFolders', folderId)
    );
    
    // Update parent subfolder count
    if (folder.parentId) {
      await updateDoc(
        doc(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, 'documentFolders', folder.parentId),
        { subfolderCount: increment(-1) }
      );
    }
  }
  
  // ==========================================================================
  // Real-time Subscriptions
  // ==========================================================================
  
  /**
   * Subscribe to document changes
   */
  subscribeToDocument(
    engagementId: string,
    documentId: string,
    callback: (document: Document | null) => void
  ): Unsubscribe {
    return onSnapshot(
      doc(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, 'documents', documentId),
      (snapshot) => {
        if (!snapshot.exists()) {
          callback(null);
        } else {
          callback({ id: snapshot.id, ...snapshot.data() } as Document);
        }
      }
    );
  }
  
  /**
   * Subscribe to document list
   */
  subscribeToDocuments(
    engagementId: string,
    filters: DocumentFilters,
    callback: (documents: Document[]) => void
  ): Unsubscribe {
    const constraints: QueryConstraint[] = [];
    
    if (filters.entityType) {
      constraints.push(where('entityType', '==', filters.entityType));
    }
    if (filters.entityId) {
      constraints.push(where('entityId', '==', filters.entityId));
    }
    if (filters.isLatest !== undefined) {
      constraints.push(where('isLatest', '==', filters.isLatest));
    }
    if (filters.category) {
      constraints.push(where('category', '==', filters.category));
    }
    
    constraints.push(orderBy('uploadedAt', 'desc'));
    constraints.push(limit(100));
    
    const q = query(
      collection(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, 'documents'),
      ...constraints
    );
    
    return onSnapshot(q, (snapshot) => {
      const documents = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Document[];
      callback(documents);
    });
  }
  
  // ==========================================================================
  // Access Control
  // ==========================================================================
  
  /**
   * Check if user can view a document
   */
  canViewDocument(document: Document, userId: string): boolean {
    if (document.accessLevel === 'public') return true;
    if (document.uploadedBy === userId) return true;
    if (document.allowedUsers?.includes(userId)) return true;
    return true; // Simplified - in production, check team membership
  }
  
  /**
   * Check if user can edit a document
   */
  canEditDocument(document: Document, userId: string): boolean {
    return document.uploadedBy === userId;
  }
  
  /**
   * Update document access
   */
  async updateDocumentAccess(
    engagementId: string,
    documentId: string,
    accessLevel: DocumentAccessLevel,
    allowedUsers?: string[],
    allowedRoles?: string[]
  ): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');
    
    await updateDoc(
      doc(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, 'documents', documentId),
      {
        accessLevel,
        allowedUsers,
        allowedRoles,
        updatedBy: currentUser.uid,
        updatedAt: Timestamp.now(),
      }
    );
    
    await this.logActivity(engagementId, documentId, 'access_changed', {
      accessLevel,
      allowedUsers,
      allowedRoles,
    });
  }
  
  // ==========================================================================
  // Activity Logging
  // ==========================================================================
  
  /**
   * Log document activity
   */
  private async logActivity(
    engagementId: string,
    documentId: string,
    action: DocumentAction,
    details: Record<string, unknown>
  ): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    
    const activity: DocumentActivity = {
      id: doc(collection(db, 'temp')).id,
      documentId,
      action,
      userId: currentUser.uid,
      userName: currentUser.displayName || currentUser.email || 'Unknown',
      details,
      timestamp: Timestamp.now(),
    };
    
    await setDoc(
      doc(db, COLLECTION_PATHS.ENGAGEMENTS, engagementId, 'documentActivity', activity.id),
      activity
    );
  }
  
  /**
   * Record document view
   */
  async recordView(engagementId: string, documentId: string): Promise<void> {
    await this.logActivity(engagementId, documentId, 'viewed', {});
  }
  
  /**
   * Record document download
   */
  async recordDownload(engagementId: string, documentId: string): Promise<void> {
    await this.logActivity(engagementId, documentId, 'downloaded', {});
  }
  
  // ==========================================================================
  // Helper Methods
  // ==========================================================================
  
  /**
   * Generate secure share token
   */
  private generateShareToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  
  /**
   * Hash password for share links
   */
  private async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  
  /**
   * Verify password for share links
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    const passwordHash = await this.hashPassword(password);
    return passwordHash === hash;
  }
  
  /**
   * Cleanup subscriptions
   */
  unsubscribeAll(): void {
    this.subscriptions.forEach(unsubscribe => unsubscribe());
    this.subscriptions.clear();
  }
}

// Export singleton instance
export const documentService = DocumentService.getInstance();
