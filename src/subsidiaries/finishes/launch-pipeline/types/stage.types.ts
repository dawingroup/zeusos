/**
 * Stage Types
 * Pipeline stage definitions and gate requirements
 */

export type PipelineStage = 
  | 'idea'
  | 'research'
  | 'design'
  | 'prototype'
  | 'photography'
  | 'documentation'
  | 'launched';

export interface StageConfig {
  id: PipelineStage;
  label: string;
  icon: string;           // Lucide icon name
  color: string;          // Tailwind color class
  description: string;
  requiredDeliverables: DeliverableType[];
  gateRequirements: GateRequirement[];
  aiAssistance: AIAssistanceType[];
}

export type DeliverableType =
  | 'concept_brief'
  | 'market_positioning'
  | 'reference_images'
  | 'competitor_analysis'
  | 'pricing_strategy'
  | 'material_research'
  | 'cad_files'
  | 'technical_drawings'
  | 'bom_draft'
  | 'cutlist'
  | 'physical_sample'
  | 'qc_notes'
  | 'iteration_log'
  | 'hero_images'
  | 'detail_shots'
  | 'lifestyle_photos'
  | '360_views'
  | 'product_description'
  | 'seo_metadata'
  | 'specifications'
  | 'care_instructions';

export interface GateRequirement {
  id: string;
  label: string;
  type: 'deliverable' | 'approval' | 'data_field' | 'quality_check';
  required: boolean;
  description: string;
}

export type AIAssistanceType = 
  | 'naming'
  | 'research'
  | 'alt_text'
  | 'descriptions'
  | 'discoverability'
  | 'audit';

export interface GateCheckResult {
  canAdvance: boolean;
  passed: GateRequirement[];
  failed: GateRequirement[];
  warnings: string[];
}
