/**
 * Design Knowledge Base Constants
 */

export const DKB_ENTRY_TYPES = [
  'component',
  'assembly_pattern',
  'hardware_spec',
  'material_rule',
  'product_archetype',
  'dimensional_standard',
] as const;
export type DKBEntryType = (typeof DKB_ENTRY_TYPES)[number];

export const COMPONENT_CATEGORIES = [
  'panel',
  'drawer_box',
  'door',
  'shelf',
  'rail',
  'leg',
  'arm',
  'cushion_frame',
  'back_panel',
  'plinth',
  'cornice',
  'pelmet',
  'worktop',
  'end_panel',
  'filler',
] as const;
export type ComponentCategory = (typeof COMPONENT_CATEGORIES)[number];

export const JOINERY_TYPES = [
  'cam_lock',
  'confirmat_screw',
  'dowel',
  'biscuit',
  'pocket_screw',
  'mortise_tenon',
  'butt_joint',
  'mitre',
  'tongue_groove',
  'dado',
  'rabbet',
] as const;
export type JoineryType = (typeof JOINERY_TYPES)[number];

export const HARDWARE_FAMILIES = [
  'hinge',
  'drawer_slide',
  'shelf_support',
  'handle_pull',
  'leg_leveller',
  'connector',
  'lock',
  'push_open',
  'soft_close_damper',
  'hanging_bracket',
] as const;
export type HardwareFamily = (typeof HARDWARE_FAMILIES)[number];

export const STANDARD_PANEL_THICKNESSES_MM = [8, 12, 16, 18, 22, 25, 30, 36] as const;

export const STANDARD_UNIT_WIDTHS_MM = [
  150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000, 1200,
] as const;

export const KITCHEN_WORKTOP_HEIGHT_MM = 870;
export const STANDARD_CARCASS_DEPTH_MM = {
  kitchenBase: 560,
  wallUnit: 340,
  wardrobe: 580,
} as const;

export const DKB_MEMORY_TAGS = [
  'dkb', 'component', 'hardware', 'assembly', 'standard', 'material-rule',
] as const;

export const WIKI_COMPILE_SOURCE = 'dawin-design-kb/wiki/';
export const WIKI_RAW_SOURCE = 'dawin-design-kb/raw/';
