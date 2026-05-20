/**
 * Assembly Constants — Formal hierarchy for scene composition.
 *
 * The AI grouper + heuristic fallback classify every mesh into one of
 * these assembly types and each part into one of these categories.
 * The enum values are stable FK-like strings (no reordering — external
 * data references them by value).
 *
 * Expanding beyond kitchen cabinets:
 *   - Workspace: desks, reception counters, workstations.
 *   - Retail: gondolas, slatwall display walls, display cases.
 *   - Pharmacy: dispensary shelving, back-bar storage.
 *   - General storage: bookcases, lockers, storage walls.
 *
 * Each new domain adds its own archetype hierarchies below. New
 * AssemblyType entries capture shapes the kitchen-only taxonomy
 * couldn't express — e.g. `display_shelf`, `gable_run` (the tall
 * vertical uprights on a gondola), `cover_panel_run` (cable-cover
 * or structural-join concealers on desks + reception counters).
 */

export const ASSEMBLY_TYPES = [
  // ── Core cabinet shapes (kitchen / wardrobe) ──────────────────────
  'carcass', 'drawer_box', 'door_assembly', 'drawer_front', 'shelf_pack',
  'hardware_kit', 'plinth_assembly', 'cornice_run', 'panel_run', 'custom',

  // ── Workspace / reception ─────────────────────────────────────────
  /** Horizontal work surface — desk top, reception transaction counter. */
  'work_surface',
  /** Front-facing "kicker" panel on reception counters; separates
   *  staff-side from client-side. */
  'counter_front',
  /** Modesty / privacy panel between the user and the front edge of a
   *  desk. Structural + visual role. */
  'modesty_panel',
  /** Cable-routing shield that runs the length of a desk or counter. */
  'cable_tray',

  // ── Retail / display ──────────────────────────────────────────────
  /** Vertical upright / gable in a gondola or wall system — the
   *  structural spine that shelves + pegboards clip into. */
  'gable_run',
  /** A horizontal pack of adjustable display shelves (retail /
   *  pharmacy). Distinct from `shelf_pack` because adjustability +
   *  standard notches matter for the BOM. */
  'display_shelf_pack',
  /** Slatwall / pegboard backing panel for retail fixtures. */
  'display_back',
  /** Dedicated cover panel run — structural-join concealers on
   *  gondolas, desks, reception counters. A distinct AssemblyType so
   *  cover panels don't get aggregated into `carcass`. */
  'cover_panel_run',
  /** Security shutter / grille assembly. Pharmacies + after-hours
   *  retail fixtures carry these. */
  'security_grille',

  // ── Storage / library ─────────────────────────────────────────────
  /** Open-fronted bookcase / library shelving frame. */
  'bookcase_frame',
] as const;
export type AssemblyTypeEnum = (typeof ASSEMBLY_TYPES)[number];

export const PART_CATEGORIES = [
  // Core
  'panel', 'edge_band', 'hardware', 'fastener', 'fitting',
  'finish_consumable', 'packaging',

  // Cover / facing family — the "ask" from the broader-domain work.
  // These are panels that serve a concealing / facing role rather
  // than structural carcass role. Procurement treats them differently
  // (often different finish requirements, often visible-grade).
  /** Any panel whose primary role is concealing structure / cable
   *  routing / service voids. Includes cable covers, modesty
   *  overlays, end-cap panels on gondolas. */
  'cover_panel',
  /** Floor-level kicker. Distinct from structural plinth carcass
   *  parts because toe-kicks are almost always veneer / matching
   *  finish. */
  'toe_kick',
  /** Upper decorative fascia / valance. Reception counters and
   *  retail displays often carry a branded fascia. */
  'fascia',

  // Linear structural
  /** Vertical upright — gondola / shelving / gable. Linear part,
   *  different waste + handling to a sheet panel. */
  'upright',
  /** Horizontal rail / stretcher linking uprights. */
  'stretcher',
] as const;
export type PartCategory = (typeof PART_CATEGORIES)[number];

export const ASSEMBLY_NAMING_PATTERN = '{cabinetName}-{assemblyType}-{sequence}';
export const PART_NAMING_PATTERN = '{cabinetCode}-{assemblyCode}-{partType}-{sequence}';

export const DEFAULT_ASSEMBLY_HIERARCHIES: Record<string, readonly string[]> = {
  // ── Kitchen + wardrobe (existing) ─────────────────────────────────
  kitchen_base:  ['carcass', 'drawer_box', 'door_assembly', 'plinth_assembly', 'hardware_kit'],
  kitchen_wall:  ['carcass', 'door_assembly', 'shelf_pack', 'hardware_kit'],
  wardrobe:      ['carcass', 'door_assembly', 'shelf_pack', 'drawer_box', 'hardware_kit'],
  drawer_unit:   ['carcass', 'drawer_box', 'drawer_front', 'hardware_kit'],

  // ── Workspace / reception ─────────────────────────────────────────
  desk: [
    'carcass', 'work_surface', 'modesty_panel', 'drawer_box',
    'cable_tray', 'cover_panel_run', 'hardware_kit',
  ],
  workstation: [
    'carcass', 'work_surface', 'modesty_panel',
    'cable_tray', 'cover_panel_run', 'shelf_pack', 'hardware_kit',
  ],
  reception_counter: [
    'carcass', 'work_surface', 'counter_front',
    'cover_panel_run', 'cable_tray', 'drawer_box', 'hardware_kit',
  ],

  // ── Retail / display ──────────────────────────────────────────────
  retail_gondola: [
    'gable_run', 'display_back', 'display_shelf_pack',
    'plinth_assembly', 'cover_panel_run', 'hardware_kit',
  ],
  wall_display: [
    'gable_run', 'display_back', 'display_shelf_pack',
    'cornice_run', 'cover_panel_run', 'hardware_kit',
  ],
  display_case: [
    'carcass', 'door_assembly', 'display_shelf_pack',
    'cornice_run', 'hardware_kit',
  ],

  // ── Pharmacy ──────────────────────────────────────────────────────
  pharmacy_shelving: [
    'gable_run', 'display_shelf_pack', 'security_grille',
    'cover_panel_run', 'plinth_assembly', 'hardware_kit',
  ],
  dispensary_back_bar: [
    'carcass', 'display_shelf_pack', 'drawer_box',
    'door_assembly', 'security_grille', 'hardware_kit',
  ],

  // ── Storage / library ─────────────────────────────────────────────
  bookshelf: [
    'bookcase_frame', 'shelf_pack', 'plinth_assembly', 'hardware_kit',
  ],
  storage_wall: [
    'carcass', 'door_assembly', 'shelf_pack', 'drawer_box',
    'cover_panel_run', 'hardware_kit',
  ],
} as const;

export const PART_ROLLUP_FIELDS = ['quantity', 'totalArea', 'totalLength', 'totalCost'] as const;

export const ASSEMBLY_BOM_GROUP_ORDER = [
  'panel', 'cover_panel', 'toe_kick', 'fascia',
  'upright', 'stretcher',
  'edge_band', 'hardware', 'fastener', 'fitting', 'finish_consumable',
] as const;
