/**
 * Parametric Matrix Types
 *
 * Defines the rule engine for automatic item/kit selection based on
 * project-level defaults and cabinet/design-item overrides.
 *
 * Resolution flow:
 *   Project Defaults (e.g., hardwareTier = 'premium')
 *   + Cabinet Overrides (e.g., doorType = 'inset', hingeDegrees = '110')
 *   → Merged Variables
 *   → Match against ParametricRule conditions (by priority)
 *   → Result: selected item/kit (e.g., KIT-HNG-INS-110-PRM)
 *   → Kit expands into component BOM lines
 */

import { Timestamp } from 'firebase/firestore';

// ============================================
// Condition Operators
// ============================================

/**
 * Operators for matching parametric conditions
 */
export type ParametricOperator = 'equals' | 'in' | 'not_equals';

// ============================================
// Parametric Condition
// ============================================

/**
 * A single condition in a parametric rule.
 * All conditions in a rule must match for the rule to fire.
 */
export interface ParametricCondition {
  variable: string;                  // e.g., 'hardwareTier', 'doorType', 'hingeDegrees'
  operator: ParametricOperator;
  value: string | string[];          // e.g., 'inset' or ['inset', 'partial-overlay']
}

// ============================================
// Parametric Rule
// ============================================

/**
 * A single rule in the parametric selection matrix.
 * When all conditions match, the result item/kit is selected.
 */
export interface ParametricRule {
  id: string;
  name: string;                      // Human-readable, e.g., "Inset Hinge Selection"
  description?: string;

  // CONDITIONS — all must match to trigger this rule
  conditions: ParametricCondition[];

  // RESULT — what gets selected when conditions match
  resultItemId: string;              // → inventoryItems (usually a kit or purchasing-tier item)
  resultSku: string;                 // Cached for display
  resultName: string;                // Cached
  resultQuantityPerUnit?: number;    // Default: 1

  priority: number;                  // Lower = higher priority (for conflict resolution)
  isActive: boolean;

  // Scoping
  subsidiaryId?: string;             // Optional subsidiary scope

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

// ============================================
// Project & Design Item Parametric Settings
// ============================================

// ============================================
// Typed parametric-variable value unions (P18/F21)
// ============================================
//
// P18 narrows what used to be `Record<string, unknown>` /
// `Record<string, string | undefined>` on the override surface so the
// named variables are type-checked against the catalogue in
// `PARAMETRIC_VARIABLE_OPTIONS`. The catch-all index signature is
// retained because the matrix is explicitly extensible — new variables
// can be added at runtime without a TS change. The invariant the unions
// enforce is just: when the variable IS a known one, its value must be
// one of the documented options.

export type HardwareTier = 'economy' | 'standard' | 'premium' | 'luxury';
export type DoorType = 'inset' | 'full-overlay' | 'half-overlay';
export type HingeDegrees = '110' | '155' | '170';
export type DrawerSlideType = 'undermount' | 'side-mount' | 'center-mount';
export type ConstructionMethod = 'frameless' | 'face-frame';

/**
 * Project-level parametric defaults.
 * These are "global" settings for a project that apply to all design items
 * unless overridden at the cabinet/design-item level.
 */
export interface ProjectParametricDefaults {
  hardwareTier?: HardwareTier;
  preferredHingeBrand?: string;
  preferredSlideBrand?: string;
  constructionMethod?: ConstructionMethod;
  /** Extensible catch-all — new variables can be added without a schema
   * change. Known variables should use their named typed fields above
   * so TS catches typos against `PARAMETRIC_VARIABLE_OPTIONS`. */
  [key: string]: string | undefined;
}

/**
 * Cabinet/design-item level parametric overrides.
 * These override project defaults for a specific design item.
 */
export interface DesignItemParametricOverrides {
  doorType?: DoorType;
  hingeDegrees?: HingeDegrees;
  drawerSlideType?: DrawerSlideType;
  /** Overrides may also restate any ProjectParametricDefaults field.
   * See header note on extensibility + union enforcement. */
  hardwareTier?: HardwareTier;
  constructionMethod?: ConstructionMethod;
  [key: string]: string | undefined;
}

// ============================================
// Common Parametric Variables
// ============================================

/**
 * Well-known parametric variable names used across the system.
 * New variables can be added freely — these are just the standard ones.
 */
export const PARAMETRIC_VARIABLES = [
  'hardwareTier',
  'doorType',
  'hingeDegrees',
  'drawerSlideType',
  'constructionMethod',
  'preferredHingeBrand',
  'preferredSlideBrand',
] as const;

export type ParametricVariable = (typeof PARAMETRIC_VARIABLES)[number];

/**
 * Human-readable labels for parametric variables
 */
export const PARAMETRIC_VARIABLE_LABELS: Record<string, string> = {
  hardwareTier: 'Hardware Tier',
  doorType: 'Door Type',
  hingeDegrees: 'Hinge Degrees',
  drawerSlideType: 'Drawer Slide Type',
  constructionMethod: 'Construction Method',
  preferredHingeBrand: 'Preferred Hinge Brand',
  preferredSlideBrand: 'Preferred Slide Brand',
};

/**
 * Known values for common parametric variables
 */
export const PARAMETRIC_VARIABLE_OPTIONS: Record<string, string[]> = {
  hardwareTier: ['economy', 'standard', 'premium', 'luxury'],
  doorType: ['inset', 'full-overlay', 'half-overlay'],
  hingeDegrees: ['110', '155', '170'],
  drawerSlideType: ['undermount', 'side-mount', 'center-mount'],
  constructionMethod: ['frameless', 'face-frame'],
};
