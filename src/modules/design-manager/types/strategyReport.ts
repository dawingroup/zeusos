/**
 * Strategy Report Document Types
 * Type definitions for persisted, editable strategy reports
 */

import type { Timestamp } from '@/shared/types';
import type {
  Trend,
  Recommendation,
  MaterialPalette,
  ColorScheme,
  ProductionFeasibility,
  ProductionDetail,
  ProductRecommendation,
  InspirationGalleryItem,
  GenerateStrategyInput,
} from '@/modules/strategy/types';

/**
 * Report status workflow
 * draft -> in_review -> finalized -> shared
 */
export type ReportStatus = 'draft' | 'in_review' | 'finalized' | 'shared';

/**
 * Sync status with underlying strategy
 */
export type ReportSyncStatus = 'in_sync' | 'stale' | 'conflicted';

/**
 * Version history entry tracking changes over time
 */
export interface VersionEntry {
  version: number;
  changedBy: string;
  changedAt: Timestamp;
  changeType: 'generated' | 'edited' | 'regenerated' | 'finalized';
  changedFields: string[];              // Field paths that changed
  changeNotes?: string;
}

/**
 * Generation context preserved for regeneration reference
 */
export interface GenerationContext {
  strategySnapshot?: any;              // ProjectStrategy snapshot at generation time
  inputParameters?: GenerateStrategyInput;
  generatedAt: Timestamp;
  generatedBy: string;
  aiModel?: string;
}

/**
 * Persisted strategy report document in Firestore
 * Extends StrategyReport with persistence metadata, versioning, and edit tracking
 */
export interface StrategyReportDocument {
  // ============================================
  // Identity
  // ============================================
  id: string;
  projectId: string;
  projectCode?: string;
  projectName: string;

  // ============================================
  // Content (from StrategyReport)
  // ============================================
  reportTitle: string;
  executiveSummary: string;
  trends: Trend[];
  recommendations: Recommendation[];
  materialPalette: MaterialPalette[];
  colorScheme: ColorScheme;
  productionFeasibility: ProductionFeasibility;
  productionDetails: ProductionDetail[];
  nextSteps: string[];
  productRecommendations?: ProductRecommendation[];
  inspirationGallery?: InspirationGalleryItem[];

  // ============================================
  // Versioning & Status
  // ============================================
  version: number;                     // Increments with each save
  status: ReportStatus;
  versionHistory: VersionEntry[];

  // ============================================
  // Edit Tracking
  // ============================================
  manualEdits: string[];               // Array of field paths edited by user
  lastEditedAt?: Timestamp;
  lastEditedBy?: string;
  lastEditedSection?: string;          // Which section was last changed

  // ============================================
  // Generation Context (readonly reference)
  // ============================================
  generationContext: GenerationContext;

  // ============================================
  // Synchronization Tracking
  // ============================================
  isSynced: boolean;
  syncStatus: ReportSyncStatus;
  lastSyncedAt?: Timestamp;
  staleReason?: string;

  // ============================================
  // Client Portal Sharing
  // ============================================
  sharedToPortal?: boolean;
  sharedToPortalAt?: Timestamp;
  sharedToPortalBy?: string;
  accessToken?: string;                // 32-char nanoid for client access
  expiresAt?: Timestamp;               // Optional expiration

  // ============================================
  // Lifecycle Timestamps
  // ============================================
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
  finalizedAt?: Timestamp;
  finalizedBy?: string;
}

/**
 * Client portal share document for strategy reports
 */
export type ShareType = 'quote' | 'strategy_report' | 'deliverable' | 'approval';

export interface ClientPortalShare {
  id: string;
  type: ShareType;
  projectId: string;
  projectName: string;
  customerId?: string;
  customerName: string;
  customerEmail?: string;

  // What's being shared
  contentId: string;                   // reportId for strategy reports
  contentTitle: string;

  // Access control
  accessToken: string;                 // 32-char nanoid
  accessUrl?: string;
  expiresAt?: Timestamp;

  // Permissions
  permissions: {
    canView: boolean;
    canComment: boolean;
    canApprove?: boolean;              // For quotes/approvals
  };

  // Status
  status: 'active' | 'expired' | 'revoked';
  viewedAt?: Timestamp;
  viewCount: number;

  // Lifecycle
  createdAt: Timestamp;
  createdBy: string;
  sharedAt?: Timestamp;
  sharedBy?: string;
}

// SaveStatus re-exported from strategy.ts to avoid duplicate declarations
export type { SaveStatus } from './strategy';
