/**
 * Workshop Viewer Constants
 * View presets, dimension colors, assembly patterns, title block layout
 */

import type { AssemblyType, PartRole, ViewPreset } from '../types/workshop-viewer.types';

// ============================================================================
// VIEW PRESETS
// ============================================================================

export const VIEW_PRESETS: Record<string, ViewPreset> = {
  front:    { name: 'Front',    theta: 0,                          phi: Math.PI / 2 },
  back:     { name: 'Back',     theta: Math.PI,                    phi: Math.PI / 2 },
  right:    { name: 'Right',    theta: Math.PI / 2,                phi: Math.PI / 2 },
  left:     { name: 'Left',     theta: -Math.PI / 2,               phi: Math.PI / 2 },
  top:      { name: 'Top',      theta: 0,                          phi: 0.01 },
  bottom:   { name: 'Bottom',   theta: 0,                          phi: Math.PI - 0.01 },
  iso:      { name: 'Iso SW',   theta: Math.PI / 4,                phi: Math.PI / 3 },
  isoBack:  { name: 'Iso NE',   theta: Math.PI + Math.PI / 4,      phi: Math.PI / 3 },
};

// ============================================================================
// DIMENSION COLORS (per tier)
// ============================================================================

export const DIMENSION_COLORS = {
  overall_width:  '#E63946',  // Red — Tier 1 overall W/D
  overall_height: '#2563EB',  // Blue — overall height
  overall_depth:  '#E63946',  // Red — overall depth
  horizontal:     '#C8962E',  // Gold — Tier 2 horizontal chains
  vertical:       '#16A34A',  // Green — Tier 2 vertical chains
  detail:         '#9333EA',  // Purple — Tier 3 openings/detail
} as const;

// ============================================================================
// DIMENSION TEXT — pill-background label styling
// ============================================================================

export const DIMENSION_TEXT = {
  pillPadX: 1.5,
  pillPadY: 0.8,
  pillRadius: 0.8,
  pillColor: '#FFFFFF',
  tier1FontSize: 5.5,
  tier2FontSize: 5,
  tier3FontSize: 4.5,
} as const;

// ============================================================================
// DF BRAND COLORS
// ============================================================================

export const DF_BRAND_COLORS = {
  boysenberry:  '#872E5C',
  cashmere:     '#E2CAA9',
  seaform:      '#7ABDCD',
  pesto:        '#8A7D4B',
  navy:         '#1B2A4A',
  white:        '#FFFFFF',
  offWhite:     '#F5F3EE',
  separator:    '#CCCCCC',
} as const;

// ============================================================================
// A3 PAGE DIMENSIONS (mm)
// ============================================================================

export const A3_DIMENSIONS = {
  width: 420,
  height: 297,
  margin: 10,
  titleBlockWidth: 68,
  contentWidth: 420 - 10 - 10 - 68, // 332mm
  contentHeight: 297 - 10 - 10,      // 277mm
  borderWeight: 0.5,
  borderColor: '#CCCCCC',
  titleBlockBorderWeight: 0.8,
  separatorWeight: 0.3,
  thickSeparatorWeight: 1.2,
} as const;

// ============================================================================
// A4 PAGE DIMENSIONS (mm)
// ============================================================================

export const A4_DIMENSIONS = {
  width: 297,
  height: 210,
  margin: 8,
  titleBlockWidth: 55,
  borderWeight: 0.25,
  contentWidth: 226,    // 297 - 8*2 - 55
  contentHeight: 194,   // 210 - 8*2
} as const;

// ============================================================================
// CONSTRUCTION SEQUENCE (for future assembly ordering)
// ============================================================================

export const CONSTRUCTION_SEQUENCE = [
  'carcase', 'fixed_shelves', 'drawer_box', 'drawer_front',
  'door', 'mobile_shelves', 'cover', 'hardware',
] as const;

// ============================================================================
// TITLE BLOCK FIELD SEQUENCE (per E1.2)
// ============================================================================

export const TITLE_BLOCK_FIELDS = [
  { key: 'logo',           label: '',                   labelSize: 0,    valueSize: 16,   valueBold: true,  isLogo: true },
  { key: 'contact',        label: '',                   labelSize: 0,    valueSize: 6,    valueBold: false, isContact: true },
  { key: 'generalNotes',   label: 'GENERAL NOTES',      labelSize: 6,    valueSize: 6,    valueBold: false },
  { key: 'projectName',    label: 'PROJECT NAME',       labelSize: 5.5,  valueSize: 7,    valueBold: true },
  { key: 'client',         label: 'CLIENT',             labelSize: 5.5,  valueSize: 7,    valueBold: true },
  { key: 'address',        label: 'PROJECT ADDRESS',    labelSize: 5.5,  valueSize: 7,    valueBold: true },
  { key: 'date',           label: 'DATE MODIFIED',      labelSize: 5.5,  valueSize: 7,    valueBold: true },
  { key: 'projectNo',      label: 'PROJECT NO.',        labelSize: 5.5,  valueSize: 7,    valueBold: true },
  { key: 'drawn',          label: 'DRAWN',              labelSize: 5.5,  valueSize: 7,    valueBold: true },
  { key: 'checked',        label: 'CHECKED',            labelSize: 5.5,  valueSize: 7,    valueBold: true },
  { key: 'drawingTitle',   label: 'DRAWING TITLE',      labelSize: 5.5,  valueSize: 7,    valueBold: true },
  { key: 'projectStage',   label: 'PROJECT STAGE',      labelSize: 5.5,  valueSize: 7,    valueBold: true },
  { key: 'paperSize',      label: 'PAPER SIZE',         labelSize: 5.5,  valueSize: 7,    valueBold: true },
  // Thick separator before drawing number
  { key: 'drawingNumber',  label: 'DRAWING NUMBER',     labelSize: 5.5,  valueSize: 36,   valueBold: true, isDrawingNumber: true },
  { key: 'revision',       label: 'REVISION',           labelSize: 5.5,  valueSize: 8,    valueBold: true },
] as const;

// ============================================================================
// ASSEMBLY COLOUR PALETTE
//
// Per-assembly-type colours used in drawing legends, contents sheets,
// and (future) per-assembly edge-colouring on isometric views. The
// palette is brand-compatible — every swatch either comes from
// DF_BRAND_COLORS or harmonises with it.
//
// Stable: downstream PDF surfaces key by AssemblyTypeEnum value, so
// adding new types is safe but reassigning colours for existing ones
// changes already-issued drawing packages.
// ============================================================================

export const ASSEMBLY_COLOURS: Record<string, string> = {
  // Core cabinet shapes
  carcass:           '#6B7A8F',    // slate grey-blue — neutral structural
  drawer_box:        '#7AA24B',    // sage — moving parts
  drawer_front:      '#B48C3A',    // warm tan — visible face
  door_assembly:     '#3B6FA0',    // navy-adjacent blue — hinged faces
  shelf_pack:        '#6FA8B9',    // brand seafoam cousin — horizontals
  hardware_kit:      '#2B2B2B',    // near-black — metalwork
  plinth_assembly:   '#5C4033',    // toe-kick brown
  cornice_run:       '#A37A4E',    // cornice timber
  panel_run:         '#9E8E74',    // warm neutral

  // Workspace / reception
  work_surface:      '#C8A96A',    // timber top
  counter_front:     '#872E5C',    // brand boysenberry — the "front-of-house" colour
  modesty_panel:     '#8E9BA8',    // muted slate
  cable_tray:        '#4A4A4A',    // dark grey — services

  // Retail / display / pharmacy
  gable_run:         '#5E4B6B',    // plum — structural uprights
  display_shelf_pack:'#8FA98C',    // sage green — horizontals
  display_back:      '#A9C4D1',    // pale blue — backing
  cover_panel_run:   '#D48C3A',    // amber — "look at me" cover family
  security_grille:   '#3A3A3A',    // charcoal — metalwork
  bookcase_frame:    '#7C6C58',    // walnut-ish

  // Misc
  custom:            '#9CA3AF',    // neutral fallback
};

/** Fallback colour returned when a lookup misses — matches `custom` above. */
export const ASSEMBLY_COLOUR_FALLBACK = '#9CA3AF';

// ============================================================================
// SHEET NUMBERING — I-series architectural convention
// ============================================================================

export const SHEET_NUMBERING = {
  cover:            'I001',
  contentsLegend:   'I002',
  /** Project-wide assembly inventory — drawing-to-assembly nav index. */
  assemblyInventory:'I003',
  isometricSW:      'I100',
  isometricNE:      'I110',
  frontElevation:   'I101',
  rearElevation:    'I102',
  planView:         'I103',
  threeView:        'I104',
  rightSide:        'I201',
  leftSide:         'I202',
  cutList:          'I301',
  edgeBandSchedule: 'I302',
  // Scene-level schedules (I3xx continuation of the schedule family).
  hardwareSchedule: 'I303',
  finishSchedule:   'I304',
  // Presentation supplements (I5xx).
  renderGallery:    'I500',

  // ── Sub-cover dividers — single-page section intros ─────────────
  // Numbered one slot below their section head so the table-of-
  // contents can show them as "X000 — Section Cover".
  projectCover:       'P000',     // before consolidated project drawings
  cabinetsCover:      'C000',     // before per-cabinet block
  schedulesCover:     'I300',     // before I301 cut list / I303 hardware / I304 finish
  rendersCover:       'I400',     // before I500 render gallery
  architecturalCover: 'A000',     // before A1xx plans / A2xx elevations / …

  /**
   * Architectural-series numbering follows the AIA / RIBA convention:
   *   A0xx  — general / index / notes
   *   A1xx  — floor plans
   *   A2xx  — elevations
   *   A3xx  — building sections
   *   A5xx  — details
   *   A9xx  — other / miscellaneous
   *
   * Pass the `kind` of the drawing + a per-kind sequence (first of
   * its kind = 1). The returned sheet id is `A{series}{kind-index}`
   * zero-padded to three digits total (A101, A102, A201, A301, …).
   *
   * Callers that don't care about the kind can pass `'other'` and
   * use a monotonic sequence — everything falls in the A9xx range.
   */
  architectural:    (
    kind: 'plan' | 'section' | 'elevation' | 'detail' | 'other',
    indexWithinKind: number,
  ) => {
    const series =
      kind === 'plan' ? 1 :
      kind === 'elevation' ? 2 :
      kind === 'section' ? 3 :
      kind === 'detail' ? 5 :
      9;
    const seq = String(indexWithinKind).padStart(2, '0');
    return `A${series}${seq}`;
  },
  partDetail:       (index: number) => `I2${String(index).padStart(2, '0')}`,
  shopTraveller:    (index: number) => `I4${String(index).padStart(2, '0')}`,
} as const;

// ============================================================================
// PART ROLE CLASSIFICATION PATTERNS
// ============================================================================

export interface PartRolePattern {
  pattern: RegExp;
  role: PartRole;
}

export const PART_ROLE_PATTERNS: PartRolePattern[] = [
  { pattern: /^Left Side(?!\s+Drawer)/i,       role: 'side' },
  { pattern: /^Right Side(?!\s+Drawer)/i,      role: 'side' },
  { pattern: /^Vertical Division/i,            role: 'vertical_division' },
  { pattern: /^Fixed Shelve/i,                 role: 'shelf' },
  { pattern: /^Shelf/i,                        role: 'shelf' },
  { pattern: /^Top(?!\s+Rail)(?!\s+Drawer)/i,  role: 'top_bottom' },
  { pattern: /^Bottom(?!\s+Rail)(?!\s+Drawer)/i, role: 'top_bottom' },
  { pattern: /^Double[- ]?Back/i,              role: 'back' },
  { pattern: /^Back(?!\s+Drawer)/i,            role: 'back' },
  { pattern: /^Door/i,                         role: 'door' },
  { pattern: /^Drawer(?!\s+(Side|Back|Bottom|Counter|Front))/i, role: 'drawer' },
  { pattern: /^(Left|Right)\s+Side\s+Drawer/i, role: 'drawer_component' },
  { pattern: /^Back\s+Drawer/i,               role: 'drawer_component' },
  { pattern: /^Bottom\s+Drawer/i,             role: 'drawer_component' },
  { pattern: /^Counter\s+Front/i,             role: 'counter_front' },
  { pattern: /^Top\s+Rail/i,                  role: 'rail' },
  { pattern: /^Bottom\s+Rail/i,               role: 'rail' },
  { pattern: /^(Left|Right)\s+Stile/i,        role: 'stile' },
  { pattern: /^(Center|Centre)\s+Panel/i,     role: 'panel' },
  { pattern: /^Panel/i,                       role: 'panel' },
  { pattern: /^Muntin/i,                      role: 'muntin' },
  { pattern: /^(Timber|Lipping)/i,            role: 'bar' },
  { pattern: /Adjustable\s*Shelf|Mobile\s*Shelf/i, role: 'mobile_shelf' },
  { pattern: /Cover|End\s*Panel|Filler/i,    role: 'cover' },
  { pattern: /Plinth|Kickboard|Toe\s*Kick/i, role: 'plinth' },
];

// ============================================================================
// ASSEMBLY DETECTION PATTERNS
// ============================================================================

export interface AssemblyPattern {
  type: AssemblyType;
  keywords: string[];
  childRoles: PartRole[];
  description: string;
}

export const ASSEMBLY_PATTERNS: AssemblyPattern[] = [
  {
    type: 'shaker_door',
    keywords: ['Door'],
    childRoles: ['rail', 'stile', 'panel', 'muntin'],
    description: 'Shaker-style door with rails, stiles, and center panel',
  },
  {
    type: 'slab_door',
    keywords: ['Door', 'Slab'],
    childRoles: [],
    description: 'Single-piece slab door (no sub-components)',
  },
  {
    type: 'raised_panel_door',
    keywords: ['Door', 'Raised'],
    childRoles: ['rail', 'stile', 'panel'],
    description: 'Raised panel door with profiled rails and stiles',
  },
  {
    type: 'drawer_box',
    keywords: ['Drawer'],
    childRoles: ['drawer_component', 'counter_front'],
    description: 'Drawer box with sides, back, bottom, and front',
  },
  {
    type: 'drawer_front',
    keywords: ['Drawer', 'Front'],
    childRoles: [],
    description: 'Decorative drawer front panel',
  },
  {
    type: 'shelf_unit',
    keywords: ['Shelf', 'Unit'],
    childRoles: ['shelf', 'side', 'back'],
    description: 'Open shelf unit sub-assembly',
  },
  {
    type: 'countertop',
    keywords: ['Countertop', 'Worktop', 'Benchtop'],
    childRoles: [],
    description: 'Countertop slab',
  },
];

// ============================================================================
// OUTFIT FONT CDN URLs
// ============================================================================

export const OUTFIT_FONT_URLS = {
  regular: 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-400-normal.ttf',
  medium:  'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-500-normal.ttf',
  semibold: 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-600-normal.ttf',
  bold:    'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-700-normal.ttf',
} as const;

// ============================================================================
// EDGE RENDERING CONSTANTS
// ============================================================================

export const EDGE_RENDERING = {
  visible: {
    color: '#1B2A4A',
    weight: 0.5,
    opacity: 1.0,
  },
  hidden_faint: {
    color: '#1B2A4A',
    weight: 0.15,
    opacity: 0.20,
  },
  crease_angle: 15, // degrees — EdgesGeometry threshold
} as const;

// ============================================================================
// EXPLODE VIEW CONSTANTS
// ============================================================================

export const EXPLODE_SETTINGS = {
  gapMultiplier: 1.5,   // Gap = part size × this
  animationDuration: 300, // ms
  minGap: 20,            // mm minimum gap between exploded parts
} as const;

// ============================================================================
// SCENE CONSTANTS
// ============================================================================

export const SCENE_DEFAULTS = {
  backgroundColor: 0xF5F3EE,
  ambientLightIntensity: 0.5,
  keyLightIntensity: 0.8,
  rimLightIntensity: 0.3,
  rimLightColor: 0xB0C4DE,
  defaultMaterialColor: 0xCEA264,
  selectedColor: 0xC8962E,
  dimmedOpacity: 0.12,
  cameraFov: 45,
  cameraNear: 1,
  cameraFar: 50000,
  gridSubdivisions: 20,
  gridColor1: 0xCCCCCC,
  gridColor2: 0xE8E8E8,
} as const;

// ============================================================================
// CUT LIST TABLE COLUMN WIDTHS (%)
// ============================================================================

export const CUT_LIST_COLUMNS = {
  part:     { label: 'Part',     width: 28 },
  material: { label: 'Material', width: 18 },
  thickness: { label: 'T',       width: 5 },
  qty:      { label: 'Qty',      width: 5 },
  length:   { label: 'Length',   width: 10 },
  width:    { label: 'Width',    width: 10 },
  L1:       { label: 'L1',      width: 6 },
  L2:       { label: 'L2',      width: 6 },
  W1:       { label: 'W1',      width: 6 },
  W2:       { label: 'W2',      width: 6 },
} as const;

// ============================================================================
// CONTACT INFO (for title block)
// ============================================================================

export const DF_CONTACT_INFO = {
  website: 'dawinfinishes.com',
  phone: '0393 100 493',
  email: 'info@dawinfinishes.com',
  address: 'Ground Floor, Jodan House, Kayondo Road, Kyambogo Upper Estate',
} as const;
