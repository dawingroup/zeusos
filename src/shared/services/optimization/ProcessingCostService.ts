/**
 * Processing Cost Service
 *
 * Calculates material processing step costs for timber and board sheet materials.
 *
 * Timber pipeline:  Raw Stock → Planing → Cross-cut → Rip → Routing
 * Board pipeline:   Stock Sheet → Panel Saw Cut → Edge Banding
 *
 * Rates come from workshop defaults (org settings) with optional per-project overrides.
 */

import type {
  ProcessingStepRate,
  ProcessingCostBreakdown,
  MaterialProcessingSummary,
  WorkshopProcessingRates,
  ProjectProcessingOverrides,
} from '../../types/processingSteps';
import {
  DEFAULT_WORKSHOP_PROCESSING_RATES,
  getProcessingRate,
} from '../../types/processingSteps';
import type { TimberStockDefinition } from '../../types/project';

// ============================================
// Part Interfaces (what we receive from optimization)
// ============================================

export interface TimberPartForProcessing {
  partId: string;
  partName: string;
  length: number;          // mm (finished dimension)
  width: number;           // mm (finished dimension)
  thickness: number;       // mm (finished dimension)
  quantity: number;
  materialName: string;
  hasCNCOperations?: boolean;
}

export interface PanelPartForProcessing {
  partId: string;
  partName: string;
  length: number;          // mm
  width: number;           // mm
  quantity: number;
  materialName: string;
  edgeBanding?: {
    top: boolean | string;
    bottom: boolean | string;
    left: boolean | string;
    right: boolean | string;
  };
}

// ============================================
// Rate Resolution
// ============================================

/**
 * Merge workshop default rates with per-project overrides.
 * Project overrides take precedence for any field they define.
 */
export function getEffectiveRates(
  workshopRates: WorkshopProcessingRates | undefined,
  projectOverrides?: ProjectProcessingOverrides
): { rates: ProcessingStepRate[]; planingAllowance: number } {
  const base = workshopRates || DEFAULT_WORKSHOP_PROCESSING_RATES;
  const planingAllowance = projectOverrides?.planingAllowanceOverride ?? base.planingAllowancePerSide;

  if (!projectOverrides?.rateOverrides) {
    return { rates: base.rates, planingAllowance };
  }

  // Apply per-step overrides
  const mergedRates = base.rates.map(rate => {
    const override = projectOverrides.rateOverrides?.[rate.stepId];
    if (!override) return rate;
    return { ...rate, ...override, stepId: rate.stepId } as ProcessingStepRate;
  });

  return { rates: mergedRates, planingAllowance };
}

// ============================================
// Planing Dimension Calculator
// ============================================

/**
 * Calculate raw (pre-planing) dimensions from finished dimensions.
 * Each side loses `allowancePerSide` mm during planing.
 *
 * @example
 * calculatePlaningDimensions(38, 100, 3)
 * // → { rawThickness: 44, rawWidth: 106 }
 */
export function calculatePlaningDimensions(
  finishedThickness: number,
  finishedWidth: number,
  allowancePerSide: number
): { rawThickness: number; rawWidth: number } {
  return {
    rawThickness: finishedThickness + (2 * allowancePerSide),
    rawWidth: finishedWidth + (2 * allowancePerSide),
  };
}

// ============================================
// Timber Processing Cost Calculator
// ============================================

/**
 * Calculate processing costs for a group of timber parts.
 *
 * Steps considered:
 * 1. Planing (if stock is rough-sawn) — per linear meter of stock
 * 2. Cross-cutting — per cut (1 cut per piece, quantity cuts total)
 * 3. Ripping (if stock is wider than part) — per linear meter ripped
 * 4. Routing (if part has CNC operations) — per linear meter of routing
 */
export function calculateTimberProcessingCosts(
  parts: TimberPartForProcessing[],
  matchedStock: TimberStockDefinition | null,
  rates: ProcessingStepRate[],
  planingAllowance: number
): ProcessingCostBreakdown[] {
  const steps: ProcessingCostBreakdown[] = [];

  // Total pieces across all parts
  const totalPieces = parts.reduce((sum, p) => sum + p.quantity, 0);

  // Total linear meters of parts (for planing: entire stock length is planed)
  const totalPartLinearMeters = parts.reduce(
    (sum, p) => sum + (p.length / 1000) * p.quantity,
    0
  );

  // ── Step 1: Planing ──
  // Only if stock is rough-sawn (not already dressed/PAR)
  if (matchedStock && !matchedStock.isDressed) {
    const planingRate = getProcessingRate('planing', rates);
    if (planingRate) {
      // Planing is done on the full stock length before cutting
      // Approximate: total linear meters of parts ÷ ~0.85 utilization to account for stock length
      const estimatedStockLinearMeters = totalPartLinearMeters / 0.85;

      steps.push({
        stepId: 'planing',
        label: planingRate.label,
        quantity: Math.round(estimatedStockLinearMeters * 100) / 100,
        unit: 'linear meters',
        ratePerUnit: planingRate.ratePerUnit,
        totalCost: Math.round(estimatedStockLinearMeters * planingRate.ratePerUnit),
        totalTimeMinutes: Math.round(estimatedStockLinearMeters * planingRate.timePerUnit * 10) / 10,
        setupTimeMinutes: planingRate.setupTimeMinutes,
      });
    }
  }

  // ── Step 2: Cross-cutting ──
  // Each piece requires at least 1 cross-cut (to separate from stock)
  const crosscutRate = getProcessingRate('crosscut', rates);
  if (crosscutRate && totalPieces > 0) {
    steps.push({
      stepId: 'crosscut',
      label: crosscutRate.label,
      quantity: totalPieces,
      unit: 'cuts',
      ratePerUnit: crosscutRate.ratePerUnit,
      totalCost: Math.round(totalPieces * crosscutRate.ratePerUnit),
      totalTimeMinutes: Math.round(totalPieces * crosscutRate.timePerUnit * 10) / 10,
      setupTimeMinutes: crosscutRate.setupTimeMinutes,
    });
  }

  // ── Step 3: Ripping ──
  // Needed when stock width > part width (ripping to narrower width)
  if (matchedStock) {
    const partsNeedingRip = parts.filter(p => {
      // Rip is needed if the matched stock is wider than the part
      // Account for planing allowance if rough-sawn
      const stockWidth = matchedStock.isDressed
        ? matchedStock.width
        : matchedStock.width - (2 * planingAllowance);
      return stockWidth > p.width + 5; // 5mm tolerance
    });

    if (partsNeedingRip.length > 0) {
      const ripRate = getProcessingRate('rip', rates);
      if (ripRate) {
        const totalRipMeters = partsNeedingRip.reduce(
          (sum, p) => sum + (p.length / 1000) * p.quantity,
          0
        );

        steps.push({
          stepId: 'rip',
          label: ripRate.label,
          quantity: Math.round(totalRipMeters * 100) / 100,
          unit: 'linear meters',
          ratePerUnit: ripRate.ratePerUnit,
          totalCost: Math.round(totalRipMeters * ripRate.ratePerUnit),
          totalTimeMinutes: Math.round(totalRipMeters * ripRate.timePerUnit * 10) / 10,
          setupTimeMinutes: ripRate.setupTimeMinutes,
        });
      }
    }
  }

  // ── Step 4: Routing ──
  // Only for parts with CNC/routing operations
  const partsWithRouting = parts.filter(p => p.hasCNCOperations);
  if (partsWithRouting.length > 0) {
    const routingRate = getProcessingRate('routing', rates);
    if (routingRate) {
      // Estimate routing length: perimeter of part (conservative estimate)
      const totalRoutingMeters = partsWithRouting.reduce((sum, p) => {
        const perimeterMeters = (2 * (p.length + p.width)) / 1000;
        return sum + perimeterMeters * p.quantity;
      }, 0);

      steps.push({
        stepId: 'routing',
        label: routingRate.label,
        quantity: Math.round(totalRoutingMeters * 100) / 100,
        unit: 'linear meters',
        ratePerUnit: routingRate.ratePerUnit,
        totalCost: Math.round(totalRoutingMeters * routingRate.ratePerUnit),
        totalTimeMinutes: Math.round(totalRoutingMeters * routingRate.timePerUnit * 10) / 10,
        setupTimeMinutes: routingRate.setupTimeMinutes,
      });
    }
  }

  return steps;
}

// ============================================
// Panel Processing Cost Calculator
// ============================================

/**
 * Calculate processing costs for a group of panel/board parts.
 *
 * Steps considered:
 * 1. Panel saw cutting — per cut (2 cuts per part: rip + crosscut)
 * 2. Edge banding — per linear meter of edge that has banding specified
 */
export function calculatePanelProcessingCosts(
  parts: PanelPartForProcessing[],
  rates: ProcessingStepRate[]
): ProcessingCostBreakdown[] {
  const steps: ProcessingCostBreakdown[] = [];

  const totalPieces = parts.reduce((sum, p) => sum + p.quantity, 0);

  // ── Step 1: Panel Saw Cutting ──
  // Each part needs approximately 2 cuts (1 rip + 1 crosscut)
  const panelSawRate = getProcessingRate('panel_saw_cut', rates);
  if (panelSawRate && totalPieces > 0) {
    const totalCuts = totalPieces * 2;

    steps.push({
      stepId: 'panel_saw_cut',
      label: panelSawRate.label,
      quantity: totalCuts,
      unit: 'cuts',
      ratePerUnit: panelSawRate.ratePerUnit,
      totalCost: Math.round(totalCuts * panelSawRate.ratePerUnit),
      totalTimeMinutes: Math.round(totalCuts * panelSawRate.timePerUnit * 10) / 10,
      setupTimeMinutes: panelSawRate.setupTimeMinutes,
    });
  }

  // ── Step 2: Edge Banding ──
  const edgeBandingRate = getProcessingRate('edge_banding', rates);
  if (edgeBandingRate) {
    let totalEdgeMeters = 0;

    for (const part of parts) {
      if (!part.edgeBanding) continue;

      const edges = part.edgeBanding;
      const lengthMeters = part.length / 1000;
      const widthMeters = part.width / 1000;

      // Top and bottom edges run along the length
      if (edges.top && edges.top !== 'none') {
        totalEdgeMeters += lengthMeters * part.quantity;
      }
      if (edges.bottom && edges.bottom !== 'none') {
        totalEdgeMeters += lengthMeters * part.quantity;
      }
      // Left and right edges run along the width
      if (edges.left && edges.left !== 'none') {
        totalEdgeMeters += widthMeters * part.quantity;
      }
      if (edges.right && edges.right !== 'none') {
        totalEdgeMeters += widthMeters * part.quantity;
      }
    }

    if (totalEdgeMeters > 0) {
      // Edge banding labour
      steps.push({
        stepId: 'edge_banding',
        label: edgeBandingRate.label,
        quantity: Math.round(totalEdgeMeters * 100) / 100,
        unit: 'edge meters',
        ratePerUnit: edgeBandingRate.ratePerUnit,
        totalCost: Math.round(totalEdgeMeters * edgeBandingRate.ratePerUnit),
        totalTimeMinutes: Math.round(totalEdgeMeters * edgeBandingRate.timePerUnit * 10) / 10,
        setupTimeMinutes: edgeBandingRate.setupTimeMinutes,
      });

      // Edge banding material cost (tape/strip)
      const edgeMaterialRate = getProcessingRate('edge_banding_material', rates);
      if (edgeMaterialRate) {
        steps.push({
          stepId: 'edge_banding_material',
          label: edgeMaterialRate.label,
          quantity: Math.round(totalEdgeMeters * 100) / 100,
          unit: 'edge meters',
          ratePerUnit: edgeMaterialRate.ratePerUnit,
          totalCost: Math.round(totalEdgeMeters * edgeMaterialRate.ratePerUnit),
          totalTimeMinutes: 0,
          setupTimeMinutes: 0,
        });
      }
    }
  }

  return steps;
}

// ============================================
// Glass Processing Cost Calculator
// ============================================

export interface GlassPartForProcessing {
  partId: string;
  partName: string;
  length: number;
  width: number;
  quantity: number;
  materialName: string;
}

/**
 * Calculate processing costs for glass parts.
 * Each part requires 2 scores (length + width cuts).
 */
export function calculateGlassProcessingCosts(
  parts: GlassPartForProcessing[],
  rates: ProcessingStepRate[]
): ProcessingCostBreakdown[] {
  const steps: ProcessingCostBreakdown[] = [];
  const totalPieces = parts.reduce((sum, p) => sum + p.quantity, 0);

  const glassScoringRate = getProcessingRate('glass_scoring', rates);
  if (glassScoringRate && totalPieces > 0) {
    const totalCuts = totalPieces * 2; // 1 length score + 1 width score per piece

    steps.push({
      stepId: 'glass_scoring',
      label: glassScoringRate.label,
      quantity: totalCuts,
      unit: 'cuts',
      ratePerUnit: glassScoringRate.ratePerUnit,
      totalCost: Math.round(totalCuts * glassScoringRate.ratePerUnit),
      totalTimeMinutes: Math.round(totalCuts * glassScoringRate.timePerUnit * 10) / 10,
      setupTimeMinutes: glassScoringRate.setupTimeMinutes,
    });
  }

  return steps;
}

// ============================================
// Linear Stock (Metal) Processing Cost Calculator
// ============================================

export interface LinearPartForProcessing {
  partId: string;
  partName: string;
  length: number;
  quantity: number;
  materialName: string;
}

/**
 * Calculate processing costs for linear stock (metal bars, aluminium).
 * Each piece requires 1 saw cut to separate from stock.
 */
export function calculateLinearProcessingCosts(
  parts: LinearPartForProcessing[],
  rates: ProcessingStepRate[]
): ProcessingCostBreakdown[] {
  const steps: ProcessingCostBreakdown[] = [];
  const totalPieces = parts.reduce((sum, p) => sum + p.quantity, 0);

  const metalSawRate = getProcessingRate('metal_saw_cut', rates);
  if (metalSawRate && totalPieces > 0) {
    steps.push({
      stepId: 'metal_saw_cut',
      label: metalSawRate.label,
      quantity: totalPieces,
      unit: 'cuts',
      ratePerUnit: metalSawRate.ratePerUnit,
      totalCost: Math.round(totalPieces * metalSawRate.ratePerUnit),
      totalTimeMinutes: Math.round(totalPieces * metalSawRate.timePerUnit * 10) / 10,
      setupTimeMinutes: metalSawRate.setupTimeMinutes,
    });
  }

  return steps;
}

// ============================================
// Summary Builder
// ============================================

/**
 * Build a MaterialProcessingSummary from calculated step breakdowns.
 */
export function buildProcessingSummary(
  materialName: string,
  materialType: 'TIMBER' | 'PANEL' | 'GLASS' | 'LINEAR',
  steps: ProcessingCostBreakdown[]
): MaterialProcessingSummary {
  return {
    materialName,
    materialType,
    steps,
    totalProcessingCost: steps.reduce((sum, s) => sum + s.totalCost, 0),
    totalProcessingTimeMinutes: steps.reduce(
      (sum, s) => sum + s.totalTimeMinutes + s.setupTimeMinutes,
      0
    ),
  };
}
