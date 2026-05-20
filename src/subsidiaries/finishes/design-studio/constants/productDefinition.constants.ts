/**
 * Product Definition Constants
 */

export const PRODUCT_TYPES = [
  'cabinetry',
  'loose_furniture',
  'upholstered',
  'architectural',
  'fitout_element',
  'ai_concept',
] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const DESIGN_ORIGINS = [
  'polyboard',
  'cadquery',
  'tripo_draft',
  'shapr3d',
  'sketchup',
  'manual_spec',
] as const;
export type DesignOrigin = (typeof DESIGN_ORIGINS)[number];

export const CONSTRAINT_ACTIONS = ['reject', 'warn', 'info'] as const;
export type ConstraintAction = (typeof CONSTRAINT_ACTIONS)[number];

export const CLIENT_PARAM_DISPLAY_TYPES = [
  'slider',
  'dropdown',
  'toggle',
  'color_picker',
  'dimension_input',
] as const;
export type ClientParamDisplayType = (typeof CLIENT_PARAM_DISPLAY_TYPES)[number];

export const PDD_STATUSES = ['draft', 'active', 'archived'] as const;
export type PddStatus = (typeof PDD_STATUSES)[number];

/** Valid PDD status transitions */
export const PDD_STATUS_TRANSITIONS: Record<PddStatus, PddStatus[]> = {
  draft: ['active'],
  active: ['archived'],
  archived: ['draft'],
};
