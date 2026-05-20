/**
 * Pricing Assumptions Types
 *
 * Centralized organization-wide defaults for all optimization parameters.
 * Stored in OrganizationSettings.pricingAssumptions (Firestore).
 *
 * Resolution order:
 *   Per-project OptimizationConfig → Org pricingAssumptions → DEFAULT_PRICING_ASSUMPTIONS
 */

import type { MaterialType } from './project';

// ============================================
// Material Pricing Rules
// ============================================

/** How a material type is measured for consumption */
export type MaterialMeasurementUnit = 'area_sqm' | 'volume_cbm' | 'linear_m' | 'piece';

/** Pricing method preference order */
export type PricingMethod = 'volumetric' | 'linear' | 'area' | 'per-piece' | 'per-sheet';

/**
 * Centralized pricing rule for a material type.
 *
 * Defines how each material type is measured, converted, and priced.
 * Resolution: palette yieldFactor/conversionFactor → org materialPricingRules → DEFAULT_MATERIAL_PRICING_RULES
 */
export interface MaterialPricingRule {
  materialType: MaterialType;
  measurement: MaterialMeasurementUnit;
  defaultYieldFactor: number;            // 0-1, fraction of usable material (e.g. 0.85 = 85%)
  defaultBufferMultiplier: number;       // Cost buffer (e.g. 1.10 = +10%)
  pricingMethodPriority: PricingMethod[]; // Pricing method fallback order

  // Type-specific configuration
  timberConfig?: {
    planingAllowanceMm: number;          // mm removed per side when planing rough-sawn (default: 3)
    kerfMm: number;                      // Saw kerf for timber (default: 4)
    defaultStockLengths: number[];       // Standard stock lengths in mm
    isRoughSawn?: boolean;               // Whether stock is rough-sawn by default
  };
  panelConfig?: {
    kerfMm: number;                      // Panel saw kerf (default: 3.2)
    defaultSheetSize: { length: number; width: number }; // mm
  };
  glassConfig?: {
    kerfMm: number;                      // Glass scoring kerf (default: 4)
    safetyMarginMm: number;              // Edge safety margin (default: 25)
  };
  fabricConfig?: {
    defaultRollWidthMm: number;          // Default roll width (default: 1400)
  };
  slabConfig?: {
    defaultSlabSize: { length: number; width: number }; // mm
  };
  linearConfig?: {
    defaultStockLengthMm: number;        // Standard bar length (default: 6000)
  };
}

/**
 * Default pricing rules for each material type.
 * Derived from existing hardcoded values, harmonized with PricingAssumptions.
 */
export const DEFAULT_MATERIAL_PRICING_RULES: Record<MaterialType, MaterialPricingRule> = {
  PANEL: {
    materialType: 'PANEL',
    measurement: 'area_sqm',
    defaultYieldFactor: 0.85,
    defaultBufferMultiplier: 1.10,
    pricingMethodPriority: ['per-sheet', 'area', 'per-piece'],
    panelConfig: {
      kerfMm: 3.2,
      defaultSheetSize: { length: 2440, width: 1220 },
    },
  },
  TIMBER: {
    materialType: 'TIMBER',
    measurement: 'volume_cbm',
    defaultYieldFactor: 0.85,
    defaultBufferMultiplier: 1.10,
    pricingMethodPriority: ['volumetric', 'linear', 'per-piece'],
    timberConfig: {
      planingAllowanceMm: 3,
      kerfMm: 4,
      defaultStockLengths: [2400, 3000, 3600, 4800, 5400, 6000],
      isRoughSawn: true,
    },
  },
  GLASS: {
    materialType: 'GLASS',
    measurement: 'area_sqm',
    defaultYieldFactor: 0.75,
    defaultBufferMultiplier: 1.15,
    pricingMethodPriority: ['per-sheet', 'area', 'per-piece'],
    glassConfig: {
      kerfMm: 4,
      safetyMarginMm: 25,
    },
  },
  METAL_BAR: {
    materialType: 'METAL_BAR',
    measurement: 'linear_m',
    defaultYieldFactor: 0.90,
    defaultBufferMultiplier: 1.15,
    pricingMethodPriority: ['linear', 'per-piece'],
    linearConfig: {
      defaultStockLengthMm: 6000,
    },
  },
  ALUMINIUM: {
    materialType: 'ALUMINIUM',
    measurement: 'linear_m',
    defaultYieldFactor: 0.90,
    defaultBufferMultiplier: 1.15,
    pricingMethodPriority: ['linear', 'per-piece'],
    linearConfig: {
      defaultStockLengthMm: 6000,
    },
  },
  STONE: {
    materialType: 'STONE',
    measurement: 'area_sqm',
    defaultYieldFactor: 0.82,
    defaultBufferMultiplier: 1.10,
    pricingMethodPriority: ['area', 'per-sheet', 'per-piece'],
    slabConfig: {
      defaultSlabSize: { length: 3000, width: 1500 },
    },
  },
  FABRIC: {
    materialType: 'FABRIC',
    measurement: 'linear_m',
    defaultYieldFactor: 0.85,
    defaultBufferMultiplier: 1.10,
    pricingMethodPriority: ['linear', 'area', 'per-piece'],
    fabricConfig: {
      defaultRollWidthMm: 1400,
    },
  },
  EDGE: {
    materialType: 'EDGE',
    measurement: 'linear_m',
    defaultYieldFactor: 1.0,
    defaultBufferMultiplier: 1.05,
    pricingMethodPriority: ['linear', 'per-piece'],
  },
  COMPONENT: {
    materialType: 'COMPONENT',
    measurement: 'piece',
    defaultYieldFactor: 1.0,
    defaultBufferMultiplier: 1.0,
    pricingMethodPriority: ['per-piece'],
  },
  SOLID: {
    materialType: 'SOLID',
    measurement: 'area_sqm',
    defaultYieldFactor: 0.85,
    defaultBufferMultiplier: 1.10,
    pricingMethodPriority: ['per-sheet', 'area', 'per-piece'],
    panelConfig: {
      kerfMm: 3.2,
      defaultSheetSize: { length: 2440, width: 1220 },
    },
  },
  VENEER: {
    materialType: 'VENEER',
    measurement: 'area_sqm',
    defaultYieldFactor: 0.85,
    defaultBufferMultiplier: 1.10,
    pricingMethodPriority: ['area', 'per-sheet', 'per-piece'],
    panelConfig: {
      kerfMm: 3.2,
      defaultSheetSize: { length: 2440, width: 1220 },
    },
  },
};

// ============================================
// Main Interface
// ============================================

export interface PricingAssumptions {
  // ── Cutting Parameters ──
  cutting: {
    panelKerfMm: number;          // Panel saw kerf (default: 3.2)
    timberKerfMm: number;         // Timber/linear saw kerf (default: 4)
    glassKerfMm: number;          // Glass scoring kerf (default: 4)
  };

  // ── Cost Buffers (multipliers, e.g. 1.10 = 10% buffer) ──
  buffers: {
    panelBuffer: number;          // Panel estimation buffer (default: 1.10)
    timberBuffer: number;         // Timber estimation buffer (default: 1.10)
    linearBuffer: number;         // Linear stock buffer (default: 1.15)
    glassBuffer: number;          // Glass estimation buffer (default: 1.15)
  };

  // ── Target Yields (percentage, e.g. 85 = 85%) ──
  yields: {
    panelTargetYield: number;     // Panel optimization target (default: 85)
    timberTargetYield: number;    // Timber optimization target (default: 85)
    linearTargetYield: number;    // Linear stock target (default: 85)
    glassTargetYield: number;     // Glass target, lower due to fragility (default: 75)
    estimationUtilization: number; // Quick-estimate utilization assumption (default: 70)
  };

  // ── Minimum Reusable Sizes ──
  minimums: {
    timberMinOffcutMm: number;         // Timber min reusable offcut length (default: 300)
    linearMinOffcutMm: number;         // Linear stock min offcut length (default: 300)
    panelMinUsableWidth: number;       // Panel waste min width (default: 200)
    panelMinUsableHeight: number;      // Panel waste min height (default: 200)
    glassMinCutLength: number;         // Glass min cut dimension (default: 100)
    glassMinCutWidth: number;          // Glass min cut dimension (default: 100)
  };

  // ── Glass-Specific ──
  glass: {
    safetyMarginMm: number;                // Edge safety margin (default: 25)
    wasteReusabilityThresholdMm2: number;   // Min area for reusable waste (default: 100000)
  };

  // ── Default Material Costs (UGX, fallback when no inventory mapping) ──
  defaultSheetCosts: Record<string, number>;
  defaultCostByThickness: Record<string, number>; // string keys for Firestore compat
  fallbackSheetCost: number;

  // ── Labor Rate (auto-calculated from payroll data) ──
  labor: {
    productionDepartmentId: string;          // Department ID for full-time production staff
    partialContributors: Array<{
      departmentId: string;
      departmentName: string;
      allocationPercent: number;             // 0-100, e.g. 20 = 20% of time on production
      costBucket?: 'direct' | 'overhead';    // Defaults to overhead for support functions
    }>;
    hoursPerDay: number;                     // Default: 8
    workingDaysPerMonth: number;             // Default: 22
    productiveHoursPercent?: number;         // % of paid hours that are productive (default: 85). Net of leave, public holidays, sick, idle.
    calculatedRate?: number;                 // Last calculated UGX/hr (cached)
    calculatedAt?: string;                   // ISO timestamp of last calculation
    manualOverride?: number;                 // If user wants to override the calculated rate
  };

  // ── Per-Material-Type Pricing Rules (optional org-level overrides) ──
  materialPricingRules?: Partial<Record<MaterialType, Partial<MaterialPricingRule>>>;

  // ── Metadata ──
  updatedAt?: string;
  updatedBy?: string;
}

// ============================================
// Defaults
// ============================================

export const DEFAULT_PRICING_ASSUMPTIONS: PricingAssumptions = {
  cutting: {
    panelKerfMm: 3.2,
    timberKerfMm: 4,
    glassKerfMm: 4,
  },

  buffers: {
    panelBuffer: 1.10,
    timberBuffer: 1.10,
    linearBuffer: 1.15,
    glassBuffer: 1.15,
  },

  yields: {
    panelTargetYield: 85,
    timberTargetYield: 85,
    linearTargetYield: 85,
    glassTargetYield: 75,
    estimationUtilization: 70,
  },

  minimums: {
    timberMinOffcutMm: 300,
    linearMinOffcutMm: 300,
    panelMinUsableWidth: 200,
    panelMinUsableHeight: 200,
    glassMinCutLength: 100,
    glassMinCutWidth: 100,
  },

  glass: {
    safetyMarginMm: 25,
    wasteReusabilityThresholdMm2: 100000,
  },

  defaultSheetCosts: {
    MDF: 85000,
    Plywood: 180000,
    Chipboard: 65000,
    Melamine: 95000,
  },

  defaultCostByThickness: {
    '3': 45000,
    '6': 65000,
    '9': 85000,
    '12': 105000,
    '15': 125000,
    '16': 135000,
    '18': 155000,
    '22': 185000,
    '25': 210000,
  },

  fallbackSheetCost: 150000,

  labor: {
    productionDepartmentId: '',
    partialContributors: [],
    hoursPerDay: 8,
    workingDaysPerMonth: 22,
    productiveHoursPercent: 85,
  },
};

// ============================================
// Helpers
// ============================================

/**
 * Merge stored assumptions with defaults, filling any missing fields.
 */
export function resolvePricingAssumptions(
  stored?: Partial<PricingAssumptions> | null
): PricingAssumptions {
  if (!stored) return DEFAULT_PRICING_ASSUMPTIONS;

  return {
    cutting: { ...DEFAULT_PRICING_ASSUMPTIONS.cutting, ...stored.cutting },
    buffers: { ...DEFAULT_PRICING_ASSUMPTIONS.buffers, ...stored.buffers },
    yields: { ...DEFAULT_PRICING_ASSUMPTIONS.yields, ...stored.yields },
    minimums: { ...DEFAULT_PRICING_ASSUMPTIONS.minimums, ...stored.minimums },
    glass: { ...DEFAULT_PRICING_ASSUMPTIONS.glass, ...stored.glass },
    defaultSheetCosts: stored.defaultSheetCosts ?? DEFAULT_PRICING_ASSUMPTIONS.defaultSheetCosts,
    defaultCostByThickness: stored.defaultCostByThickness ?? DEFAULT_PRICING_ASSUMPTIONS.defaultCostByThickness,
    fallbackSheetCost: stored.fallbackSheetCost ?? DEFAULT_PRICING_ASSUMPTIONS.fallbackSheetCost,
    labor: {
      ...DEFAULT_PRICING_ASSUMPTIONS.labor,
      ...stored.labor,
      partialContributors: stored.labor?.partialContributors ?? DEFAULT_PRICING_ASSUMPTIONS.labor.partialContributors,
    },
    materialPricingRules: stored.materialPricingRules,
    updatedAt: stored.updatedAt,
    updatedBy: stored.updatedBy,
  };
}

/**
 * Get default cost for a sheet thickness (UGX).
 * Looks up by thickness in mm, falls back to fallbackSheetCost.
 */
export function getDefaultCostByThickness(
  thickness: number,
  assumptions: PricingAssumptions = DEFAULT_PRICING_ASSUMPTIONS
): number {
  return assumptions.defaultCostByThickness[String(thickness)] ?? assumptions.fallbackSheetCost;
}

/**
 * Get default cost for a named material (UGX).
 * Falls back to fallbackSheetCost if material not in map.
 */
export function getDefaultSheetCost(
  materialName: string,
  assumptions: PricingAssumptions = DEFAULT_PRICING_ASSUMPTIONS
): number {
  // Try exact match first, then case-insensitive
  if (assumptions.defaultSheetCosts[materialName] !== undefined) {
    return assumptions.defaultSheetCosts[materialName];
  }
  const lower = materialName.toLowerCase();
  for (const [key, value] of Object.entries(assumptions.defaultSheetCosts)) {
    if (key.toLowerCase() === lower) return value;
  }
  return assumptions.fallbackSheetCost;
}

/**
 * Resolve the pricing rule for a given material type.
 * Merges org-level overrides onto the DEFAULT_MATERIAL_PRICING_RULES for that type.
 *
 * Resolution: palette yieldFactor/conversionFactor → assumptions.materialPricingRules[type] → DEFAULT_MATERIAL_PRICING_RULES[type]
 */
export function resolveMaterialPricingRule(
  materialType: MaterialType,
  assumptions?: PricingAssumptions | null
): MaterialPricingRule {
  const base = DEFAULT_MATERIAL_PRICING_RULES[materialType];
  if (!base) {
    // Unknown material type — return PANEL defaults as safe fallback
    return DEFAULT_MATERIAL_PRICING_RULES.PANEL;
  }

  const orgOverride = assumptions?.materialPricingRules?.[materialType];
  if (!orgOverride) return base;

  return {
    ...base,
    ...orgOverride,
    // Deep-merge type-specific configs
    timberConfig: orgOverride.timberConfig
      ? { ...base.timberConfig, ...orgOverride.timberConfig }
      : base.timberConfig,
    panelConfig: orgOverride.panelConfig
      ? { ...base.panelConfig, ...orgOverride.panelConfig }
      : base.panelConfig,
    glassConfig: orgOverride.glassConfig
      ? { ...base.glassConfig, ...orgOverride.glassConfig }
      : base.glassConfig,
    fabricConfig: orgOverride.fabricConfig
      ? { ...base.fabricConfig, ...orgOverride.fabricConfig }
      : base.fabricConfig,
    slabConfig: orgOverride.slabConfig
      ? { ...base.slabConfig, ...orgOverride.slabConfig }
      : base.slabConfig,
    linearConfig: orgOverride.linearConfig
      ? { ...base.linearConfig, ...orgOverride.linearConfig }
      : base.linearConfig,
    // Keep the non-overridable field
    materialType: base.materialType,
  };
}

/**
 * Get effective yield factor for a material type.
 * Resolution: palette yieldFactor → rule defaultYieldFactor
 */
export function getEffectiveYield(
  materialType: MaterialType,
  paletteYieldFactor?: number,
  assumptions?: PricingAssumptions | null
): number {
  if (paletteYieldFactor != null && paletteYieldFactor > 0 && paletteYieldFactor <= 1) {
    return paletteYieldFactor;
  }
  return resolveMaterialPricingRule(materialType, assumptions).defaultYieldFactor;
}

/**
 * Get effective buffer multiplier for a material type.
 */
export function getEffectiveBuffer(
  materialType: MaterialType,
  assumptions?: PricingAssumptions | null
): number {
  return resolveMaterialPricingRule(materialType, assumptions).defaultBufferMultiplier;
}
