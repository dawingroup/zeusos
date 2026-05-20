/**
 * Estimation Constants for Design Studio
 */

export const COST_ELEMENTS = [
  'material_board',
  'material_edge_banding',
  'material_hardware',
  'material_adhesive',
  'material_finishing',
  'labor_cutting',
  'labor_edging',
  'labor_assembly',
  'labor_finishing',
  'labor_installation',
  'overhead',
  'margin',
] as const;
export type CostElement = (typeof COST_ELEMENTS)[number];

export const COMPLEXITY_FACTORS = [
  'panel_count',
  'hardware_fitting_count',
  'curved_element_count',
  'drawer_count',
  'door_count',
  'finish_type_multiplier',
  'glass_panel_count',
] as const;
export type ComplexityFactor = (typeof COMPLEXITY_FACTORS)[number];

export const DEFAULT_OVERHEAD_PERCENT = 15;
export const DEFAULT_MARGIN_PERCENT = 25;

export const LABOR_RATE_SOURCE = 'design_manager_estimation_engine';

export const TAX_RATES = {
  vat: 0.18,
  wht: 0.06,
} as const;

export const CURRENCY_DEFAULT = 'UGX' as const;
