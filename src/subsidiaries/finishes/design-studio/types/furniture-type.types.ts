/**
 * Furniture Type Knowledge Base Types
 *
 * Defines the schema for the `furniture_types` Firestore collection.
 * Each type describes expected parts, assembly groups, and naming patterns
 * that the AI uses to accurately identify and name parts in 3D models.
 */

import type { PartRole, AssemblyCategory } from './workshop-viewer.types';

export type FurnitureCategory =
  | 'cabinet'
  | 'bed'
  | 'chair'
  | 'table'
  | 'storage'
  | 'desk'
  | 'other';

export type ConstructionMethod =
  | 'frameless_euro'
  | 'face_frame'
  | 'post_and_rail'
  | 'upholstered'
  | 'slab'
  | 'panel'
  | 'other';

export type PurchaseCategory =
  | 'board_material'
  | 'hardware'
  | 'edging'
  | 'glass'
  | 'fabric'
  | 'upholstery'
  | 'timber'
  | 'metal'
  | 'other';

export type NamingConvention = 'descriptive' | 'coded' | 'positional';

/** A part the AI should expect to find in this furniture type */
export interface ExpectedPart {
  role: PartRole;
  nameTemplate: string;        // e.g., "Left Side Panel"
  quantity: number | 'varies';
  typicalThickness?: number;   // mm
  notes?: string;
}

/** How parts group for assembly and purchasing */
export interface AssemblyGroupTemplate {
  name: string;                // "Carcase Assembly"
  category: AssemblyCategory;
  description: string;
  roles: PartRole[];           // which part roles belong here
  purchaseCategory: PurchaseCategory;
}

/** Naming convention configuration */
export interface NamingPatterns {
  convention: NamingConvention;
  prefixes: Partial<Record<PartRole, string>>;
  includePosition: boolean;
  includeNumber: boolean;
}

/** Full furniture type document from Firestore */
export interface FurnitureType {
  id: string;
  name: string;
  category: FurnitureCategory;
  icon: string;                // lucide icon name
  description: string;
  expectedParts: ExpectedPart[];
  assemblyGroups: AssemblyGroupTemplate[];
  namingPatterns: NamingPatterns;
  constructionMethod: ConstructionMethod;
  isActive: boolean;
  sortOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
}

/** Subset sent to the Cloud Function for AI context */
export interface FurnitureTypeContext {
  name: string;
  category: FurnitureCategory;
  expectedParts: ExpectedPart[];
  assemblyGroups: AssemblyGroupTemplate[];
  namingPatterns: NamingPatterns;
  constructionMethod: ConstructionMethod;
}
