/**
 * Shop Traveler PDF Service
 * Generates and downloads shop traveler PDFs from production optimization results
 */

import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { ShopTraveler, type ShopTravelerOptions } from '@/shared/services/pdf/ShopTraveler';
import { getProjectWithOptimization as getProject } from '@/shared/services/projectService';
import { aggregateStandardPartsFromProject, aggregateSpecialPartsFromProject } from '@/shared/services/optimization';
import { getDesignItems, getProjectDeliverablesPerItem } from '@/modules/design-manager/services/firestore';
import { getOrganizationSettings } from '@/core/settings';
import type { Project, ProductionResult, NestingSheet } from '@/shared/types';
import {
  remapEdgeBandingForPlacementState,
  remapEdgeOperationsForPlacementState,
} from '@/shared/services/optimization/edgeBandingOrientation';

// Suppress unused React warning - needed for JSX
void React;

// Re-export the options type
export type { ShopTravelerOptions };

export interface LabelsCSVData {
  partId: string;
  partName: string;
  designItemName: string;
  length: number;
  width: number;
  thickness: number;
  material: string;
  edgeBanding: string;
  edgeOperations: string;
  sheetNumber: number;
}

// ============================================
// PDF Generation
// ============================================

/**
 * Options for scoping the Shop Traveler PDF to a single design item.
 * When provided, the PDF is rendered using the supplied in-memory
 * `production` result and restricted to parts/deliverables from `itemId`
 * — independent of the project-wide `optimizationState.production`.
 */
export interface ShopTravelerScope {
  itemId: string;
  production: ProductionResult;
}

/**
 * Generate Shop Traveler PDF blob.
 * Pass `scope` to render a single-item traveler from in-memory production
 * results instead of reading the project-wide production state.
 */
export async function generateShopTravelerPDF(
  projectId: string,
  options?: ShopTravelerOptions,
  scope?: ShopTravelerScope
): Promise<Blob> {
  const project = await getProject(projectId);

  if (!project) {
    throw new Error('Project not found');
  }

  const rawProduction = scope?.production ?? project.optimizationState?.production;

  if (!rawProduction) {
    throw new Error('No production optimization results available');
  }

  // Scope is expected to carry a production result that was already computed
  // from only the item's parts (see `runItemProduction`). No further
  // filtering of nesting sheets / cutting results is needed here.

  const hasSheets = rawProduction.nestingSheets && rawProduction.nestingSheets.length > 0;
  const hasTimber = rawProduction.timberCuttingResults && rawProduction.timberCuttingResults.length > 0;
  const hasLinearStock = rawProduction.linearStockCuttingResults && rawProduction.linearStockCuttingResults.length > 0;

  if (!hasSheets && !hasTimber && !hasLinearStock) {
    throw new Error('No production results available (no sheets, timber, or linear stock)');
  }

  // Resolve material names from inventory via material palette
  const { buildInventoryNameResolver } = await import(
    '@/modules/design-manager/services/materialHarvester'
  );
  const resolveName = buildInventoryNameResolver(project.materialPalette);

  // Augment production data with inventory product names (shallow copy to avoid mutating cache)
  const production: ProductionResult = { ...rawProduction };
  if (production.nestingSheets) {
    production.nestingSheets = production.nestingSheets.map(sheet => ({
      ...sheet,
      materialName: resolveName(sheet.materialName),
    }));
  }
  if (production.timberCuttingResults) {
    production.timberCuttingResults = production.timberCuttingResults.map(r => ({
      ...r, materialName: resolveName(r.materialName),
    }));
  }
  if (production.linearStockCuttingResults) {
    production.linearStockCuttingResults = production.linearStockCuttingResults.map(r => ({
      ...r, materialName: resolveName(r.materialName),
    }));
  }

  // Fetch standard parts, special parts, design items, and organization settings for the project
  const scopeIds = scope ? [scope.itemId] : undefined;
  const [standardParts, specialParts, allDesignItems, orgSettings] = await Promise.all([
    aggregateStandardPartsFromProject(projectId, scopeIds),
    aggregateSpecialPartsFromProject(projectId, scopeIds),
    getDesignItems(projectId),
    getOrganizationSettings().catch(() => null),
  ]);

  const designItems = scope
    ? allDesignItems.filter(i => i.id === scope.itemId)
    : allDesignItems;

  // Fetch deliverables for all (scoped) design items (for drawings section)
  const itemIds = designItems.map(i => i.id);
  const deliverablesMap = itemIds.length > 0
    ? await getProjectDeliverablesPerItem(projectId, itemIds)
    : new Map();

  // Build the deliverables-by-item map for ShopTraveler
  const deliverablesByItem = new Map<string, { deliverables: import('@/modules/design-manager/types').Deliverable[]; itemName: string }>();
  for (const item of designItems) {
    deliverablesByItem.set(item.id, {
      deliverables: deliverablesMap.get(item.id) || [],
      itemName: item.name,
    });
  }

  // Get Dawin Finishes logo URL from subsidiary branding
  const dawinFinishesLogo = orgSettings?.branding?.subsidiaries?.['zeus-the-agency']?.logoUrl;

  // Create the PDF document element using JSX with options
  const doc = <ShopTraveler
    project={project as Project}
    production={production as ProductionResult}
    options={options}
    standardParts={standardParts}
    specialParts={specialParts}
    deliverablesByItem={deliverablesByItem}
    logoUrl={dawinFinishesLogo}
  />;
  
  // Generate PDF blob
  const blob = await pdf(doc).toBlob();
  
  return blob;
}

/**
 * Download Shop Traveler PDF
 */
export async function downloadShopTraveler(
  projectId: string,
  options?: ShopTravelerOptions
): Promise<void> {
  const project = await getProject(projectId);
  const projectCode = project?.code || projectId.substring(0, 8);
  const timestamp = new Date().toISOString().split('T')[0];
  
  const blob = await generateShopTravelerPDF(projectId, options);
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `ShopTraveler-${projectCode}-${timestamp}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

// ============================================
// Labels CSV Export
// ============================================

/**
 * Generate labels data from production results
 */
function getEdgeBandingCodeFromPlacement(placement: NestingSheet['placements'][number]): string {
  const placed = remapEdgeBandingForPlacementState(placement.edgeBanding, {
    rotated: !!placement.rotated,
    rotationQuarterTurns: placement.rotationQuarterTurns,
  });
  if (!placed) return '-';
  const codes: string[] = [];
  if (placed.top) codes.push('T');
  if (placed.bottom) codes.push('B');
  if (placed.left) codes.push('L');
  if (placed.right) codes.push('R');
  return codes.length > 0 ? codes.join('') : '-';
}

function getEdgeOperationsCodeFromPlacement(placement: NestingSheet['placements'][number]): string {
  const ops = remapEdgeOperationsForPlacementState(placement.edgeOperationsBySide, {
    rotated: !!placement.rotated,
    rotationQuarterTurns: placement.rotationQuarterTurns,
  });
  if (!ops) return '-';
  const sideCodes: Record<'top' | 'right' | 'bottom' | 'left' | 'front', string> = {
    top: 'T',
    right: 'R',
    bottom: 'B',
    left: 'L',
    front: 'F',
  };
  const order: Array<'top' | 'right' | 'bottom' | 'left' | 'front'> = ['top', 'right', 'bottom', 'left', 'front'];
  const segments: string[] = [];
  for (const side of order) {
    const sideOps = ops[side];
    if (!sideOps || sideOps.length === 0) continue;
    const opCodes = sideOps.map(op => op.type.toUpperCase().slice(0, 3)).join('+');
    segments.push(`${sideCodes[side]}:${opCodes}`);
  }
  return segments.length > 0 ? segments.join(' | ') : '-';
}

function generateLabelsData(
  nestingSheets: NestingSheet[]
): LabelsCSVData[] {
  const labels: LabelsCSVData[] = [];
  
  for (let sheetIndex = 0; sheetIndex < nestingSheets.length; sheetIndex++) {
    const sheet = nestingSheets[sheetIndex];
    
    for (const placement of sheet.placements) {
      labels.push({
        partId: placement.partId,
        partName: placement.partName,
        designItemName: placement.designItemName,
        length: placement.length,
        width: placement.width,
        thickness: 18, // Default, would come from material
        material: sheet.materialName,
        edgeBanding: getEdgeBandingCodeFromPlacement(placement),
        edgeOperations: getEdgeOperationsCodeFromPlacement(placement),
        sheetNumber: sheetIndex + 1,
      });
    }
  }
  
  return labels;
}

/**
 * Convert labels data to CSV string
 */
function labelsToCSV(labels: LabelsCSVData[]): string {
  const headers = [
    'Part ID',
    'Part Name',
    'Design Item',
    'Length (mm)',
    'Width (mm)',
    'Thickness (mm)',
    'Material',
    'Edge Banding',
    'Edge Operations',
    'Sheet #',
  ];
  
  const rows = labels.map(label => [
    label.partId,
    label.partName,
    label.designItemName,
    label.length.toString(),
    label.width.toString(),
    label.thickness.toString(),
    label.material,
    label.edgeBanding,
    label.edgeOperations,
    label.sheetNumber.toString(),
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');
  
  return csvContent;
}

/**
 * Download labels as CSV file
 */
export async function downloadLabelsCSV(projectId: string): Promise<void> {
  const project = await getProject(projectId);

  if (!project) {
    throw new Error('Project not found');
  }

  const production = project.optimizationState?.production;

  if (!production || !production.nestingSheets) {
    throw new Error('No production optimization results available');
  }

  // Resolve material names from inventory
  const { buildInventoryNameResolver } = await import(
    '@/modules/design-manager/services/materialHarvester'
  );
  const resolveName = buildInventoryNameResolver(project.materialPalette);
  const resolvedSheets = production.nestingSheets.map(sheet => ({
    ...sheet,
    materialName: resolveName(sheet.materialName),
  })) as NestingSheet[];

  const projectCode = project.code || projectId.substring(0, 8);
  const labels = generateLabelsData(resolvedSheets);
  const csvContent = labelsToCSV(labels);
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `Labels-${projectCode}-${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

// ============================================
// Cut List CSV Export
// ============================================

/**
 * Download cut list as CSV file (for CNC import)
 */
export async function downloadCutListCSV(projectId: string): Promise<void> {
  const project = await getProject(projectId);

  if (!project) {
    throw new Error('Project not found');
  }

  const production = project.optimizationState?.production;

  if (!production || !production.nestingSheets) {
    throw new Error('No production optimization results available');
  }

  // Resolve material names from inventory
  const { buildInventoryNameResolver } = await import(
    '@/modules/design-manager/services/materialHarvester'
  );
  const resolveName = buildInventoryNameResolver(project.materialPalette);

  const projectCode = project.code || projectId.substring(0, 8);

  // Generate cut list with all parts and their positions
  const headers = [
    'Sheet #',
    'Material',
    'Part ID',
    'Part Name',
    'X Position',
    'Y Position',
    'Length',
    'Width',
    'Edge Banding',
    'Edge Operations',
    'Rotated',
    'Grain Aligned',
  ];
  
  const rows: string[][] = [];
  
  for (let i = 0; i < production.nestingSheets.length; i++) {
    const sheet = production.nestingSheets[i] as NestingSheet;
    
    for (const placement of sheet.placements) {
      rows.push([
        (i + 1).toString(),
        resolveName(sheet.materialName),
        placement.partId,
        placement.partName,
        placement.x.toString(),
        placement.y.toString(),
        placement.length.toString(),
        placement.width.toString(),
        getEdgeBandingCodeFromPlacement(placement),
        getEdgeOperationsCodeFromPlacement(placement),
        placement.rotated ? 'Yes' : 'No',
        placement.grainAligned ? 'Yes' : 'No',
      ]);
    }
  }
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `CutList-${projectCode}-${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
