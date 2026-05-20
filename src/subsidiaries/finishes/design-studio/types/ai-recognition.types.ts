/**
 * AI Part Recognition Types
 *
 * Types for the AI-powered cabinet part recognition pipeline.
 * Enables processing 3D models without a CSV cutlist by using
 * Claude to identify, name, and classify parts from geometry.
 */

import type { PartRole, AssemblyCategory, BoundingBox3D } from './workshop-viewer.types';

// ============================================================================
// GEOMETRY SUMMARY — sent to the Cloud Function
// ============================================================================

/** Compact geometry description of a single mesh object for AI analysis */
export interface GeometrySummary {
  partName: string;           // original PolyBoard name
  meshIndex: number;          // index in ParsedModel.objects
  bbox: BoundingBox3D;
  dims: { w: number; d: number; h: number };
  material?: string;          // material key from model
  materialColor?: string;     // hex from diffuse color
  neighbors: string[];        // names of parts within 100mm proximity
  relativePosition: RelativePosition;
}

export type RelativePosition =
  | 'left' | 'right' | 'top' | 'bottom'
  | 'front' | 'back' | 'center';

/** Full payload sent to the recognizeCabinetParts Cloud Function */
export interface RecognitionRequest {
  geometrySummaries: GeometrySummary[];
  overallDims: { width: number; depth: number; height: number };
  materialList: string[];
  materialPalette?: { name: string; code?: string; thickness?: number }[];
  ragExamples?: PastIdentification[];
  /** Furniture type context from knowledge base — dramatically improves naming accuracy */
  furnitureTypeId?: string;
  furnitureTypeContext?: import('./furniture-type.types').FurnitureTypeContext;
}

// ============================================================================
// RECOGNITION RESULT — returned from AI
// ============================================================================

/** AI-suggested identification for a single part */
export interface PartIdentification {
  originalName: string;       // matches GeometrySummary.partName
  suggestedName: string;      // human-readable (e.g., "Left Side Panel")
  role: PartRole;
  /** Spatial position within the assembly — left, right, top, bottom, etc.
   *  Persisted on ScenePart so canonical naming is stable across sessions. */
  relativePosition?: RelativePosition;
  assemblyGroup: string;      // e.g., "Carcase", "Drawer Box 1"
  confidence: number;         // 0–1
  dims: { length: number; width: number; thickness: number };
  inferredMaterial?: string;  // best guess from model material + palette
  notes?: string;             // AI notes about the part
}

/** Assembly grouping suggested by AI */
export interface SuggestedAssembly {
  name: string;
  category: AssemblyCategory;
  partNames: string[];        // references PartIdentification.originalName
}

/** Complete recognition result */
export interface RecognitionResult {
  parts: PartIdentification[];
  assemblies: SuggestedAssembly[];
  modelSummary: string;       // AI-generated description of the cabinet
  source: 'ai' | 'rule-based';
  confidence: number;         // overall confidence
}

// ============================================================================
// RECOGNITION STATE — client-side state machine
// ============================================================================

export type RecognitionStatus = 'idle' | 'analyzing' | 'reviewed' | 'syncing' | 'synced' | 'error';

export interface RecognitionState {
  status: RecognitionStatus;
  result: RecognitionResult | null;
  error?: string;
  /** User edits — maps originalName → user-confirmed name */
  renames: Record<string, string>;
}

// ============================================================================
// LEARNING & RAG
// ============================================================================

/** Stored in Firestore `part_identifications` collection for continuous learning */
export interface PastIdentification {
  id?: string;
  projectId: string;
  itemId: string;
  originalName: string;
  confirmedName: string;
  role: PartRole;
  dims: { w: number; d: number; h: number };
  material: string;
  assemblyCategory: string;
  confirmedAt: Date;
  confirmedBy: string;
}

// ============================================================================
// CUTLIST ENHANCEMENT
// ============================================================================

/** Extended cut list entry with model-derived data */
export interface EnhancedCutListEntry {
  originalRow: number;
  partName: string;
  material: string;
  /** Dimensions from model geometry (may differ from CSV) */
  modelDims?: { length: number; width: number; thickness: number };
  /** Fields that were enhanced from the model */
  enhancedFields: string[];
  /** Discrepancies between CSV and model */
  discrepancies: CutListDiscrepancy[];
  /** AI-suggested grain direction from geometry */
  suggestedGrainDirection?: 'length' | 'width' | 'none';
}

export interface CutListDiscrepancy {
  field: string;
  csvValue: string | number;
  modelValue: string | number;
  severity: 'info' | 'warning' | 'error';
}

// ============================================================================
// DFM VALIDATION
// ============================================================================

export interface DfmIssue {
  partName: string;
  severity: 'info' | 'warning' | 'error';
  category: 'thickness' | 'edge_banding' | 'grain' | 'dimension' | 'material';
  message: string;
}

export interface DfmValidationResult {
  issues: DfmIssue[];
  passCount: number;
  failCount: number;
  warnCount: number;
}
