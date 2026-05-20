/**
 * DOCUMENT TYPES
 *
 * Types for document metadata used in document export and storage services.
 */

import { Timestamp } from 'firebase/firestore';

// ============================================================================
// DOCUMENT METADATA
// ============================================================================

export type DocumentCategory =
  | 'requisition'
  | 'accountability'
  | 'receipt'
  | 'invoice'
  | 'delivery_note'
  | 'contract'
  | 'ipc'
  | 'report'
  | 'photo'
  | 'other';

export interface DocumentMetadata {
  id: string;
  projectId?: string;
  engagementId?: string;

  // File info
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  downloadUrl?: string;

  // Classification
  category: DocumentCategory;
  description?: string;
  tags?: string[];

  // Relationships
  relatedEntityId?: string;
  relatedEntityType?: string;

  // Export tracking
  exportStatus?: Record<string, {
    provider: string;
    status: 'pending' | 'exported' | 'failed';
    externalUrl?: string;
    externalId?: string;
    lastExportedAt?: Timestamp;
    errorMessage?: string;
  }>;

  // Audit
  uploadedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
