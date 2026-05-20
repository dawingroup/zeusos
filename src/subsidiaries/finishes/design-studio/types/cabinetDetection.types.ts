/**
 * Cabinet Detection Types — Splitting one model into multiple cabinets
 *
 * When a user uploads a single multi-cabinet model (e.g. a kitchen
 * PolyBoard export), we detect distinct cabinets within it.
 */

export interface DetectedCabinet {
  /** Auto-generated provisional code (e.g. "CAB-A") */
  provisionalCode: string;
  /** AI-suggested display name */
  suggestedName: string;
  /** AI-suggested PDD archetype to bind */
  suggestedArchetypeKey?: string;
  /** Mesh names that compose this cabinet */
  meshNames: string[];
  /** Approximate bounding box (mm) */
  boundingBox: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
    size: { x: number; y: number; z: number };
  };
  /** Centroid in scene coordinates (mm) */
  centroid: { x: number; y: number; z: number };
  /** AI confidence in this grouping */
  confidence: number;
  /** Why the AI grouped these meshes together */
  reasoning: string;
  /** User can toggle this cabinet on/off before import */
  selected: boolean;
  /** Sequence position for layout */
  sequence: number;
}

export interface BulkCabinetDetectionResult {
  /** Detection method */
  source: 'ai' | 'spatial' | 'manual';
  /** Model identifier used (claude model name or 'spatial-clustering-v1') */
  model: string;
  /** Overall confidence */
  confidence: number;
  /** Reasoning summary */
  reasoning: string;
  /** Detected cabinets */
  cabinets: DetectedCabinet[];
  /** Meshes that didn't fit any cabinet */
  unassigned: { meshName: string; reason: string }[];
  /** Detection duration in ms */
  durationMs: number;
}

export interface DetectCabinetsInput {
  /** Mesh names + bboxes from the parsed model */
  meshes: Array<{
    name: string;
    bbox: { min: [number, number, number]; max: [number, number, number] };
    material?: string;
  }>;
  /** Hint about expected number of cabinets */
  expectedCount?: number;
  /** Hint about cabinet types (e.g. "kitchen base run") */
  contextHint?: string;
}
