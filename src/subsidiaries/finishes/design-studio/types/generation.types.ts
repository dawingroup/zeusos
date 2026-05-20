/**
 * Generation Types — AI mesh and parametric generation interfaces
 */

/** Request for AI mesh generation (Tripo API) */
export interface MeshGenerationRequest {
  mode: 'image' | 'text';
  imageStoragePath?: string;
  textPrompt?: string;
  overallDimensions?: { width: number; depth: number; height: number };
  faceLimit?: number;
  subsidiaryId?: string;
}

/** Request for parametric generation (CadQuery) */
export interface ParametricGenerationRequest {
  templateId: string;
  parameters: Record<string, unknown>;
  finishSelections?: Record<string, string>;
}

/** Generation result from Cloud Function */
export interface GenerationResult {
  taskId: string;
  glbUrl: string;
  glbStoragePath: string;
  thumbnailUrl?: string;
  stepUrl?: string;
  xtUrl?: string;
  overallDimensions?: { width: number; depth: number; height: number };
}

/** Parametric generation result (extends GenerationResult with BOM) */
export interface ParametricGenerationResult extends GenerationResult {
  bom?: BomEvaluatedLine[];
  templateName?: string;
  prompt?: string;
}

/** Evaluated BOM line from parametric generation */
export interface BomEvaluatedLine {
  materialCategory: string;
  quantity: number;
  unit: string;
  isVariantDriven: boolean;
  finishAttributeKey?: string | null;
}

/** Generation progress state */
export type GenerationStatus = 'idle' | 'uploading' | 'generating' | 'processing' | 'complete' | 'error';

export interface GenerationProgress {
  status: GenerationStatus;
  progress: number; // 0-100
  message: string;
  error?: string;
}

/** Furniture template for parametric generation */
export interface FurnitureTemplate {
  id: string;
  name: string;
  category: 'seating' | 'casegoods' | 'tables' | 'beds' | 'fitout' | 'custom';
  thumbnailUrl?: string;
  description?: string;
  parameters: ParameterDefinition[];
  scriptStoragePath: string;
  defaultFinishMappings: Record<string, string>;
  bomTemplate: BomTemplateLine[];
  classification: string;
}

/** Parameter definition for a furniture template */
export interface ParameterDefinition {
  key: string;
  label: string;
  type: 'number' | 'select' | 'boolean';
  default: unknown;
  options?: { label: string; value: unknown }[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  affectsBom?: boolean;
}

/** BOM template line for auto-generation from geometry */
export interface BomTemplateLine {
  materialCategory: string;
  quantityExpression: string;
  unit: string;
  isVariantDriven: boolean;
  finishAttributeKey?: string;
}
