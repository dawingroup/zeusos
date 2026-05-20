/**
 * Audit Types
 * Catalog quality audit and compliance types
 */

import { Timestamp } from 'firebase/firestore';

export type AuditSeverity = 'critical' | 'high' | 'medium' | 'low';

export type AuditCategory = 
  | 'content_completeness'
  | 'seo_quality'
  | 'image_optimization'
  | 'schema_data'
  | 'ai_readiness'
  | 'inventory_health'
  | 'brand_consistency';

export interface AuditResult {
  id: string;
  productId: string;
  shopifyProductId?: string;
  auditedAt: Timestamp;
  auditType: 'webhook' | 'scheduled' | 'manual';
  productStatus: 'draft' | 'active' | 'archived';
  
  overallScore: number;        // 0-100
  categoryScores: Record<AuditCategory, number>;
  issues: AuditIssue[];
  recommendations: string[];
  
  // Gate checks (used by stageGate validation)
  checks?: { id: string; name: string; passed: boolean; message?: string }[];

  // Comparison to previous audit
  scoreChange?: number;
  newIssues?: string[];
  resolvedIssues?: string[];
}

export interface AuditIssue {
  id: string;
  category: AuditCategory;
  severity: AuditSeverity;
  field: string;               // Which field has the issue
  message: string;
  currentValue?: string;
  expectedValue?: string;
  autoFixAvailable: boolean;
  fixAction?: string;          // Action ID for auto-fix
}

export interface AuditConfig {
  enabledCategories: AuditCategory[];
  severityThresholds: Record<AuditSeverity, number>;
  brandTerms: {
    required: string[];
    prohibited: string[];
  };
  minImageCount: number;
  minDescriptionLength: number;
  maxDescriptionLength: number;
}

export interface AuditSchedule {
  continuous: boolean;         // On product create/update
  daily: boolean;              // Full active catalog
  weekly: boolean;             // Include drafts
  lastRun?: Timestamp;
  nextRun?: Timestamp;
}
