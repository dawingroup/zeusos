/**
 * Stage Constants
 * Pipeline stage definitions with gate requirements
 */

import { StageConfig } from '../types/stage.types';

export const PIPELINE_STAGES: StageConfig[] = [
  {
    id: 'idea',
    label: 'Idea',
    icon: 'Lightbulb',
    color: 'purple',
    description: 'Strategic alignment and concept validation',
    requiredDeliverables: ['concept_brief', 'market_positioning'],
    gateRequirements: [
      { id: 'has_name', label: 'Product name assigned', type: 'data_field', required: true, description: 'Product must have a name' },
      { id: 'has_category', label: 'Category assigned', type: 'data_field', required: true, description: 'Product category must be set' },
      { id: 'brief_uploaded', label: 'Concept brief uploaded', type: 'deliverable', required: true, description: 'Upload concept brief document' },
    ],
    aiAssistance: ['naming'],
  },
  {
    id: 'research',
    label: 'Research',
    icon: 'Search',
    color: 'blue',
    description: 'Market validation and feasibility assessment',
    requiredDeliverables: ['competitor_analysis', 'pricing_strategy', 'material_research'],
    gateRequirements: [
      { id: 'competitor_done', label: 'Competitor analysis complete', type: 'deliverable', required: true, description: 'Upload competitor analysis' },
      { id: 'pricing_done', label: 'Pricing strategy defined', type: 'deliverable', required: true, description: 'Upload pricing strategy' },
      { id: 'viability_approved', label: 'Viability approved', type: 'approval', required: true, description: 'Confirm market viability' },
    ],
    aiAssistance: ['research'],
  },
  {
    id: 'design',
    label: 'Design',
    icon: 'PenTool',
    color: 'cyan',
    description: 'Engineering foundation and technical specifications',
    requiredDeliverables: ['cad_files', 'technical_drawings', 'bom_draft', 'cutlist'],
    gateRequirements: [
      { id: 'cad_uploaded', label: 'CAD files uploaded', type: 'deliverable', required: true, description: 'Upload SketchUp/Polyboard files' },
      { id: 'drawings_done', label: 'Technical drawings complete', type: 'deliverable', required: true, description: 'Upload production drawings' },
      { id: 'dimensions_set', label: 'Dimensions specified', type: 'data_field', required: true, description: 'Enter product dimensions' },
      { id: 'design_signoff', label: 'Design signed off', type: 'approval', required: true, description: 'Design approved by production' },
    ],
    aiAssistance: [],
  },
  {
    id: 'prototype',
    label: 'Prototype',
    icon: 'Wrench',
    color: 'orange',
    description: 'Production validation and iteration',
    requiredDeliverables: ['physical_sample', 'qc_notes', 'iteration_log'],
    gateRequirements: [
      { id: 'sample_complete', label: 'Physical sample completed', type: 'deliverable', required: true, description: 'Confirm sample is built' },
      { id: 'qc_passed', label: 'QC inspection passed', type: 'quality_check', required: true, description: 'QC notes uploaded with pass status' },
      { id: 'materials_finalized', label: 'Materials finalized', type: 'data_field', required: true, description: 'Confirm final material selections' },
    ],
    aiAssistance: [],
  },
  {
    id: 'photography',
    label: 'Photography',
    icon: 'Camera',
    color: 'red',
    description: 'Visual asset creation for marketing',
    requiredDeliverables: ['hero_images', 'detail_shots', 'lifestyle_photos'],
    gateRequirements: [
      { id: 'hero_images', label: 'Hero images uploaded (min 3)', type: 'deliverable', required: true, description: 'Upload at least 3 hero product images' },
      { id: 'detail_shots', label: 'Detail shots uploaded (min 2)', type: 'deliverable', required: true, description: 'Upload at least 2 detail/closeup shots' },
      { id: 'alt_text_done', label: 'Alt text for all images', type: 'data_field', required: true, description: 'All images must have alt text' },
    ],
    aiAssistance: ['alt_text'],
  },
  {
    id: 'documentation',
    label: 'Documentation',
    icon: 'FileText',
    color: 'green',
    description: 'Content creation for discoverability and conversion',
    requiredDeliverables: ['product_description', 'seo_metadata', 'specifications', 'care_instructions'],
    gateRequirements: [
      { id: 'description_done', label: 'Product description complete', type: 'deliverable', required: true, description: 'Full product description written' },
      { id: 'seo_done', label: 'SEO metadata complete', type: 'data_field', required: true, description: 'Meta title, description, keywords set' },
      { id: 'specs_done', label: 'Specifications documented', type: 'deliverable', required: true, description: 'Technical specifications complete' },
      { id: 'content_reviewed', label: 'Content reviewed', type: 'approval', required: true, description: 'Content approved by marketing' },
    ],
    aiAssistance: ['descriptions', 'discoverability'],
  },
  {
    id: 'launched',
    label: 'Launched',
    icon: 'Rocket',
    color: 'emerald',
    description: 'Live product in market',
    requiredDeliverables: [],
    gateRequirements: [
      { id: 'shopify_synced', label: 'Published to Shopify', type: 'data_field', required: true, description: 'Product synced to Shopify store' },
      { id: 'pricing_set', label: 'Final pricing set', type: 'data_field', required: true, description: 'Price and variants configured' },
      { id: 'inventory_set', label: 'Inventory configured', type: 'data_field', required: true, description: 'Stock levels entered' },
    ],
    aiAssistance: ['audit'],
  },
];

export const STAGE_ORDER: Record<string, number> = {
  idea: 0,
  research: 1,
  design: 2,
  prototype: 3,
  photography: 4,
  documentation: 5,
  launched: 6,
};

export const getStageConfig = (stage: string): StageConfig | undefined => 
  PIPELINE_STAGES.find(s => s.id === stage);

export const getNextStage = (current: string): string | undefined => {
  const currentIndex = STAGE_ORDER[current];
  const stages = Object.keys(STAGE_ORDER);
  return stages.find(s => STAGE_ORDER[s] === currentIndex + 1);
};

export const getPreviousStage = (current: string): string | undefined => {
  const currentIndex = STAGE_ORDER[current];
  const stages = Object.keys(STAGE_ORDER);
  return stages.find(s => STAGE_ORDER[s] === currentIndex - 1);
};
