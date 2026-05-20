/**
 * ModelPackage Types — Canonical persisted processing result for a 3D model
 *
 * A ModelPackage captures everything learned about a model after processing:
 * AI-grouped assemblies, resolved materials, generated renders, BOM, pricing.
 *
 * Stored at: designScenes/{sceneId}/cabinets/{cabinetId}/modelPackage/current
 * History:   designScenes/{sceneId}/cabinets/{cabinetId}/modelPackage/versions/{vId}
 */
import type { Timestamp } from 'firebase/firestore';
import type { SceneAssembly, ScenePart } from './assembly.types';
import type { ComputedBOMLine, PricingBreakdown } from './constraintEngine.types';

/** Canonical processing result for a 3D model */
export interface ModelPackage {
  id: string;
  version: number;
  sourceType: 'cabinet' | 'design-item' | 'session';
  sourceId: string;

  modelRef: {
    fileName?: string;
    fileType: '3ds' | 'dxf' | 'glb' | 'csv' | 'unknown';
    fileSize?: number;
    glbUrl?: string;
    cutlistUrl?: string;
  };

  grouping: ModelGrouping;
  materials: ModelMaterials;
  renders: ModelRenders;
  bom: ComputedBOMLine[];
  pricing: PricingBreakdown | null;

  context: {
    archetypeId?: string;
    furnitureTypeId?: string;
    projectId?: string;
    customerId?: string;
  };

  metadata: ModelPackageMetadata;
}

/** Grouping section: assemblies + parts with source attribution */
export interface ModelGrouping {
  source: 'ai' | 'heuristic' | 'manual';
  model: string;
  confidence: number;
  reasoning: string;
  assemblies: SceneAssembly[];
  parts: ScenePart[];
  unmapped: { meshName: string; reason: string }[];
}

/** Materials section: resolved Finish Library mappings */
export interface ModelMaterials {
  source: 'ai' | 'exact' | 'fuzzy' | 'manual';
  mappings: MaterialMappingLite[];
  unresolved: { materialName: string; reason: string }[];
}

/** Lightweight material mapping stored in the package (no React refs) */
export interface MaterialMappingLite {
  threeDSName: string;
  threeDSColor?: string;
  finishLibraryId: string;
  finishLibraryName: string;
  finishCategory?: string;
  confidence: number;
  matchedOn: 'code' | 'name' | 'fuzzy_name' | 'fuzzy_code' | 'color' | 'manual';
}

/** Render URLs generated for the model */
export interface ModelRenders {
  thumbnail?: string;
  productCatalog?: string;
  isometric?: string;
  walkthrough?: {
    front?: string;
    side?: string;
    top?: string;
  };
  generatedAt?: Timestamp;
}

/** Processing metadata */
export interface ModelPackageMetadata {
  processedAt: Timestamp;
  processedBy: string;
  processingDurationMs: number;
  aiTokensUsed?: number;
  errors: string[];
  steps: ModelProcessingStep[];
}

/** Individual step trace */
export interface ModelProcessingStep {
  name: 'grouping' | 'recognition' | 'materials' | 'bom' | 'renders' | 'save';
  startedAt: number;
  durationMs: number;
  status: 'success' | 'skipped' | 'error';
  detail?: string;
}

/** Input for creating a new package */
export interface CreateModelPackageInput {
  sourceType: ModelPackage['sourceType'];
  sourceId: string;
  sceneId: string;
  cabinetId: string;
  modelRef: ModelPackage['modelRef'];
  grouping: ModelGrouping;
  materials: ModelMaterials;
  renders: ModelRenders;
  bom: ComputedBOMLine[];
  pricing: PricingBreakdown | null;
  context: ModelPackage['context'];
  metadata: Omit<ModelPackageMetadata, 'processedAt'>;
}

/** Progress callback for the pipeline */
export type ProcessModelProgress = (update: {
  step: ModelProcessingStep['name'];
  progress: number;
  message?: string;
}) => void;
