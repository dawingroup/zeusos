/**
 * PROJECT SCOPE TYPES
 *
 * Types for defining project scope, work categories, and scope items.
 */

import { Timestamp } from 'firebase/firestore';

// ============================================================================
// WORK CATEGORY
// ============================================================================

export type WorkCategory =
  | 'civil_works'
  | 'structural'
  | 'mechanical'
  | 'electrical'
  | 'plumbing'
  | 'finishing'
  | 'landscaping'
  | 'roads_drainage'
  | 'water_sanitation'
  | 'roofing'
  | 'painting'
  | 'general';

// ============================================================================
// SCOPE ITEM
// ============================================================================

export interface ScopeItem {
  id: string;
  name: string;
  description?: string;
  category: WorkCategory;
  estimatedCost?: number;
  currency?: string;
  priority?: 'high' | 'medium' | 'low';
  status?: 'planned' | 'in_progress' | 'completed' | 'deferred';
}

// ============================================================================
// PROJECT SCOPE
// ============================================================================

export interface ProjectScope {
  projectId: string;
  scopeDescription?: string;
  objectives?: string[];
  deliverables?: string[];
  exclusions?: string[];
  assumptions?: string[];
  constraints?: string[];
  items: ScopeItem[];
  approvedBy?: string;
  approvedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// HELPERS
// ============================================================================

export const WORK_CATEGORY_LABELS: Record<WorkCategory, string> = {
  civil_works: 'Civil Works',
  structural: 'Structural',
  mechanical: 'Mechanical',
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  finishing: 'Finishing',
  landscaping: 'Landscaping',
  roads_drainage: 'Roads & Drainage',
  water_sanitation: 'Water & Sanitation',
  roofing: 'Roofing',
  painting: 'Painting',
  general: 'General',
};
