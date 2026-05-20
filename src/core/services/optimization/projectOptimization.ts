/**
 * Project-Level Optimization Actions
 * Runs optimization on project data and saves results to optimizationState
 */

import { 
  doc, 
  getDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  serverTimestamp,
  deleteField,
  Timestamp as FirestoreTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { 
  Project, 
  EstimationResult, 
  ProductionResult,
  SheetSummary,
  NestingSheet,
  CutOperation,
  OptimizationConfig,
  PartPlacement,
  WasteRegion,
  EdgeOperationSpec,
} from '@/shared/types';
import type { PartEntry } from '@/modules/design-manager/types';
import { optimizationService, type Panel, type OptimizationResult } from '@/shared/services/optimization/OptimizationService';
import { isCuttablePart } from '@/shared/services/optimization/cuttableParts';
import { getMaterialValuationPriceByName } from '@/modules/inventory/services/inventoryPriceService';
import { updateOptimizationRAG } from '../ragService';

// Collection names
const PROJECTS_COLLECTION = 'designProjects';
const DESIGN_ITEMS_SUBCOLLECTION = 'designItems';

// ============================================
// Types
// ============================================

export interface CutlistPart {
  id: string;
  partNumber: string;
  name: string;
  designItemId: string;
  designItemName: string;
  length: number;
  width: number;
  thickness: number;
  quantity: number;
  materialId: string;
  materialName: string;
  grainDirection: 'length' | 'width' | 'none';
  edgeBanding: {
    top: boolean;
    bottom: boolean;
    left: boolean;
    right: boolean;
    front?: boolean;
    material?: string;
    thickness?: number;
    edges?: {
      top?: { material?: string; thickness?: number; length?: number; operations?: EdgeOperationSpec[] };
      bottom?: { material?: string; thickness?: number; length?: number; operations?: EdgeOperationSpec[] };
      left?: { material?: string; thickness?: number; length?: number; operations?: EdgeOperationSpec[] };
      right?: { material?: string; thickness?: number; length?: number; operations?: EdgeOperationSpec[] };
      front?: { material?: string; thickness?: number; length?: number; operations?: EdgeOperationSpec[] };
    };
  };
}

export interface MaterialBreakdown {
  materialId: string;
  materialName: string;
  thickness: number;
  totalParts: number;
  totalArea: number;
  sheetsRequired: number;
  estimatedCost: number;
}

export interface Remnant {
  id: string;
  sheetId: string;
  x: number;
  y: number;
  length: number;
  width: number;
  area: number;
  reusable: boolean;
}

export interface EdgeBandItem {
  partId: string;
  partName: string;
  edge: 'top' | 'bottom' | 'left' | 'right';
  length: number;
  material: string;
}

// ============================================
// Part Aggregation
// ============================================

/**
 * Aggregate all parts from design items in a project
 * Multiplies part quantities by the design item's requiredQuantity
 */
export async function aggregatePartsFromProject(projectId: string): Promise<CutlistPart[]> {
  const parts: CutlistPart[] = [];
  
  // Get all design items for this project (subcollection under project)
  const itemsRef = collection(db, PROJECTS_COLLECTION, projectId, DESIGN_ITEMS_SUBCOLLECTION);
  const itemsSnapshot = await getDocs(itemsRef);
  
  for (const itemDoc of itemsSnapshot.docs) {
    const itemData = itemDoc.data();
    const designItemId = itemDoc.id;
    const designItemName = itemData.name || itemData.itemCode || 'Unknown';
    
    // Get the design item's required quantity (how many of this item are needed)
    const requiredQuantity = itemData.requiredQuantity || 1;
    
    // Get parts from the design item
    const itemParts: PartEntry[] = itemData.parts || [];
    
    for (const part of itemParts) {
      // Skip scene-origin component parts (hardware mesh nodes). Their
      // `materialName` is the mesh-node name, which would otherwise feed
      // phantom panels into the nesting/estimation engine. Hardware is
      // procured by SKU via the hardware schedule, not cut from panel stock.
      if (!isCuttablePart(part as { partType?: string; source?: string })) {
        continue;
      }

      // Multiply part quantity by design item's required quantity
      const totalQuantity = part.quantity * requiredQuantity;
      
      parts.push({
        id: part.id,
        partNumber: part.partNumber,
        name: part.name,
        designItemId,
        designItemName,
        length: part.length,
        width: part.width,
        thickness: part.thickness,
        quantity: totalQuantity,  // Total = part qty × design item qty
        materialId: part.materialId || '',
        materialName: part.materialName,
        grainDirection: part.grainDirection,
        edgeBanding: part.edgeBanding,
      });
    }
  }
  
  return parts;
}

/**
 * Aggregate standard parts (hinges, screws, edging) from all design items
 * Multiplies quantities by design item's requiredQuantity
 */
export async function aggregateStandardPartsFromProject(projectId: string): Promise<Array<{
  id: string;
  name: string;
  category: string;
  quantity: number;
  unitCost: number;
  designItemId: string;
  designItemName: string;
}>> {
  const parts: Array<{
    id: string;
    name: string;
    category: string;
    quantity: number;
    unitCost: number;
    designItemId: string;
    designItemName: string;
  }> = [];
  
  const itemsRef = collection(db, PROJECTS_COLLECTION, projectId, DESIGN_ITEMS_SUBCOLLECTION);
  const itemsSnapshot = await getDocs(itemsRef);
  
  for (const itemDoc of itemsSnapshot.docs) {
    const itemData = itemDoc.data();
    const designItemId = itemDoc.id;
    const designItemName = itemData.name || itemData.itemCode || 'Unknown';
    const requiredQuantity = itemData.requiredQuantity || 1;
    
    const manufacturing = itemData.manufacturing || {};
    const standardParts = manufacturing.standardParts || [];
    
    for (const part of standardParts) {
      parts.push({
        id: part.id,
        name: part.name,
        category: part.category || 'other',
        quantity: (part.quantity || 1) * requiredQuantity,
        unitCost: part.unitCost || 0,
        designItemId,
        designItemName,
      });
    }
  }
  
  return parts;
}

/**
 * Aggregate special parts (luxury/approved items) from all design items
 * Multiplies quantities by design item's requiredQuantity
 */
export async function aggregateSpecialPartsFromProject(projectId: string): Promise<Array<{
  id: string;
  name: string;
  category: string;
  quantity: number;
  supplier: string;
  costing?: {
    currency: string;
    unitCost: number;
    totalLandedCost: number;
  };
  designItemId: string;
  designItemName: string;
}>> {
  const parts: Array<{
    id: string;
    name: string;
    category: string;
    quantity: number;
    supplier: string;
    costing?: {
      currency: string;
      unitCost: number;
      totalLandedCost: number;
    };
    designItemId: string;
    designItemName: string;
  }> = [];
  
  const itemsRef = collection(db, PROJECTS_COLLECTION, projectId, DESIGN_ITEMS_SUBCOLLECTION);
  const itemsSnapshot = await getDocs(itemsRef);
  
  for (const itemDoc of itemsSnapshot.docs) {
    const itemData = itemDoc.data();
    const designItemId = itemDoc.id;
    const designItemName = itemData.name || itemData.itemCode || 'Unknown';
    const requiredQuantity = itemData.requiredQuantity || 1;
    
    const manufacturing = itemData.manufacturing || {};
    const specialParts = manufacturing.specialParts || [];
    
    for (const part of specialParts) {
      parts.push({
        id: part.id,
        name: part.name,
        category: part.category || 'other',
        quantity: (part.quantity || 1) * requiredQuantity,
        supplier: part.supplier || '',
        costing: part.costing,
        designItemId,
        designItemName,
      });
    }
  }
  
  return parts;
}

/**
 * Build a mapping from design material names to inventory material names
 * Multiple design materials may map to the same inventory material
 * This consolidation prevents over-buying sheets
 */
function buildDesignToInventoryMaterialMap(
  project: Project
): Map<string, { inventoryName: string; inventoryId?: string }> {
  const mapping = new Map<string, { inventoryName: string; inventoryId?: string }>();
  const materialPalette = project.materialPalette?.entries || [];
  
  for (const entry of materialPalette) {
    if (entry.inventoryName) {
      mapping.set(entry.designName, {
        inventoryName: entry.inventoryName,
        inventoryId: entry.inventoryId,
      });
      // Also map by normalized name for fuzzy matching
      if (entry.normalizedName && entry.normalizedName !== entry.designName) {
        mapping.set(entry.normalizedName, {
          inventoryName: entry.inventoryName,
          inventoryId: entry.inventoryId,
        });
      }
    }
  }
  
  return mapping;
}

/**
 * Convert CutlistParts to optimization Panel format
 * Uses inventory material name for grouping when available (via materialMap)
 * This ensures parts with different design materials but same inventory material
 * are nested together on the same sheets
 */
function partsToOptimizationPanels(
  parts: CutlistPart[],
  materialMap?: Map<string, { inventoryName: string; inventoryId?: string }>
): Panel[] {
  return parts.map(part => {
    // Use inventory material if mapped, otherwise use design material
    const mappedMaterial = materialMap?.get(part.materialName);
    const nestingMaterial = mappedMaterial?.inventoryName || part.materialName;
    
    return {
      id: part.id,
      label: `${part.designItemName} - ${part.name}`,
      cabinet: part.designItemName,
      material: nestingMaterial, // Use inventory material for nesting grouping
      thickness: part.thickness,
      length: part.length,
      width: part.width,
      quantity: part.quantity,
      grain: part.grainDirection === 'none' ? 0 : 1,
    };
  });
}

/**
 * Fetch dynamic material costs from material palette mappings
 * Uses the MAPPED inventory material's cost, not the design material name
 * Returns a map of design material name -> cost per sheet
 */
async function fetchMaterialCosts(
  parts: CutlistPart[],
  project: Project
): Promise<Record<string, number>> {
  const costs: Record<string, number> = {};
  const uniqueMaterials = new Map<string, number>(); // material -> thickness
  
  // Get unique materials from parts
  for (const part of parts) {
    if (part.materialName && !uniqueMaterials.has(part.materialName)) {
      uniqueMaterials.set(part.materialName, part.thickness);
    }
  }
  
  // Get material palette from project
  const materialPalette = project.materialPalette?.entries || [];
  
  for (const [designMaterialName, thickness] of uniqueMaterials) {
    const normalizedName = designMaterialName.toLowerCase().trim();
    
    // 1. First priority: Look up in material palette (mapped materials)
    // Use flexible matching: case-insensitive and check both designName and normalizedName
    const paletteEntry = materialPalette.find(entry => {
      const entryDesignName = entry.designName?.toLowerCase().trim() || '';
      const entryNormalizedName = entry.normalizedName?.toLowerCase().trim() || '';
      const searchName = normalizedName;

      // Direct match
      if (entryDesignName === searchName || entryNormalizedName === searchName) {
        return true;
      }

      // Fuzzy match: Check if search name starts with entry name (handles suffixes like " 1", " 2")
      if (searchName.startsWith(entryDesignName + ' ') || searchName.startsWith(entryNormalizedName + ' ')) {
        return true;
      }

      return false;
    });

    if (paletteEntry?.unitCost && paletteEntry.unitCost > 0) {
      // Use the mapped material's cost from palette
      costs[designMaterialName] = paletteEntry.unitCost;
      console.log(`[Estimation] Using palette price for "${designMaterialName}": ${paletteEntry.unitCost} UGX`);
      continue;
    }
    
    // 2. Second priority: Try inventory lookup by mapped inventory name
    if (paletteEntry?.inventoryName) {
      try {
        const priceResult = await getMaterialValuationPriceByName(
          paletteEntry.inventoryName, 
          thickness, 
          project.id
        );
        if (priceResult.found && priceResult.price?.costPerUnit) {
          costs[designMaterialName] = priceResult.price.costPerUnit;
          continue;
        }
      } catch {
        // Continue to fallback
      }
    }
    
    // 3. Third priority: Try inventory lookup by design name (legacy)
    try {
      const priceResult = await getMaterialValuationPriceByName(designMaterialName, thickness, project.id);
      if (priceResult.found && priceResult.price?.costPerUnit) {
        costs[designMaterialName] = priceResult.price.costPerUnit;
        continue;
      }
    } catch {
      // Continue to fallback
    }
    
    // 4. Fallback pricing
    if (!costs[designMaterialName]) {
      const fallbackPrices: Record<number, number> = {
        3: 45000, 6: 65000, 9: 85000, 12: 105000, 15: 125000,
        16: 135000, 18: 155000, 22: 185000, 25: 210000,
      };
      costs[designMaterialName] = fallbackPrices[thickness] || 150000;
      console.warn(`[Estimation] No mapped cost for "${designMaterialName}", using fallback`);
    }
  }
  
  return costs;
}

// ============================================
// Estimation Mode
// ============================================

/**
 * Run estimation and save to project.optimizationState.estimation
 * Fast mode with ~70% utilization assumption, adds 15% buffer
 */
export async function runProjectEstimation(
  projectId: string,
  userId: string
): Promise<EstimationResult> {
  // Get project
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  const projectSnap = await getDoc(projectRef);
  
  if (!projectSnap.exists()) {
    throw new Error('Project not found');
  }
  
  const project = { id: projectSnap.id, ...projectSnap.data() } as Project;
  
  // Aggregate parts from all design items
  const parts = await aggregatePartsFromProject(projectId);
  
  if (parts.length === 0) {
    throw new Error('No parts found in project design items');
  }
  
  // Build material map to consolidate design materials to inventory materials
  // This prevents over-buying when multiple design materials map to the same inventory material
  const materialMap = buildDesignToInventoryMaterialMap(project);
  
  // Convert to optimization format using inventory materials for grouping
  const panels = partsToOptimizationPanels(parts, materialMap);
  
  // Get config or use defaults
  const config = project.optimizationState?.config;
  
  // Fetch dynamic material costs from material palette mappings
  const dynamicCosts = await fetchMaterialCosts(parts, project);
  
  // Build stock sheets with dynamic costs
  const stockSheets: Record<string, { material: string; length: number; width: number; thickness: number; cost: number }> = {};
  
  // First, use config stock sheets as base (for dimensions)
  if (config?.stockSheets) {
    for (const sheet of config.stockSheets) {
      stockSheets[sheet.materialName] = {
        material: sheet.materialName,
        length: sheet.length,
        width: sheet.width,
        thickness: sheet.thickness,
        // Override with dynamic cost from inventory
        cost: dynamicCosts[sheet.materialName] || sheet.costPerSheet,
      };
    }
  }
  
  // Add any materials from parts that aren't in config
  // Use inventory material name for grouping (matches what partsToOptimizationPanels uses)
  for (const part of parts) {
    const mappedMaterial = materialMap.get(part.materialName);
    const inventoryMaterial = mappedMaterial?.inventoryName || part.materialName;
    
    if (inventoryMaterial && !stockSheets[inventoryMaterial]) {
      stockSheets[inventoryMaterial] = {
        material: inventoryMaterial,
        length: 2440,  // Default sheet size
        width: 1220,
        thickness: part.thickness,
        cost: dynamicCosts[part.materialName] || 150000,
      };
    }
  }
  
  // Run estimation optimization
  const result = optimizationService.optimize(panels, {
    mode: 'ESTIMATION',
    bladeKerf: config?.kerf || 4,
    stockSheets: Object.keys(stockSheets).length > 0 ? stockSheets : undefined,
  });
  
  // Aggregate standard and special parts for cost calculation
  const [standardParts, specialParts] = await Promise.all([
    aggregateStandardPartsFromProject(projectId),
    aggregateSpecialPartsFromProject(projectId),
  ]);
  
  // Calculate standard parts cost (quantity × unitCost)
  const standardPartsCost = standardParts.reduce(
    (sum, p) => sum + (p.quantity * p.unitCost), 0
  );
  
  // Calculate special parts cost (unitCost × quantity for proper multiplication)
  // Note: totalLandedCost is per-entry before requiredQuantity multiplication
  const specialPartsCost = specialParts.reduce(
    (sum, p) => sum + (p.quantity * (p.costing?.unitCost || 0)), 0
  );
  
  // Convert to EstimationResult format
  const sheetSummary = buildSheetSummary(result, parts);
  const wasteEstimate = result.totalWastedArea / (result.totalUsedArea + result.totalWastedArea) * 100;
  
  // Add 15% buffer to sheet material estimation
  const bufferedCost = (result.estimatedMaterialCost || 0) * 1.15;
  
  // Total cost includes all components
  const totalCost = bufferedCost + standardPartsCost + specialPartsCost;
  
  const timestamp = FirestoreTimestamp.now();

  const estimation: EstimationResult = {
    sheetSummary,
    roughCost: bufferedCost,
    standardPartsCost,
    specialPartsCost,
    totalCost,
    wasteEstimate,
    totalPartsCount: result.totalPanels,
    totalSheetsCount: result.totalSheets,
    totalStandardParts: standardParts.reduce((sum, p) => sum + p.quantity, 0),
    totalSpecialParts: specialParts.reduce((sum, p) => sum + p.quantity, 0),
    validAt: timestamp,
  };
  
  // Save to project - explicitly set fields and clear invalidation
  await updateDoc(projectRef, {
    'optimizationState.estimation.sheetSummary': estimation.sheetSummary,
    'optimizationState.estimation.roughCost': estimation.roughCost,
    'optimizationState.estimation.standardPartsCost': estimation.standardPartsCost,
    'optimizationState.estimation.specialPartsCost': estimation.specialPartsCost,
    'optimizationState.estimation.totalCost': estimation.totalCost,
    'optimizationState.estimation.wasteEstimate': estimation.wasteEstimate,
    'optimizationState.estimation.totalPartsCount': estimation.totalPartsCount,
    'optimizationState.estimation.totalSheetsCount': estimation.totalSheetsCount,
    'optimizationState.estimation.totalStandardParts': estimation.totalStandardParts,
    'optimizationState.estimation.totalSpecialParts': estimation.totalSpecialParts,
    'optimizationState.estimation.validAt': estimation.validAt,
    'optimizationState.estimation.invalidatedAt': deleteField(),
    'optimizationState.estimation.invalidationReasons': deleteField(),
    'optimizationState.lastEstimationRun': timestamp,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
  
  // Update RAG status
  const updatedProject = { ...project, optimizationState: { ...project.optimizationState, estimation } } as Project;
  const ragStatus = updateOptimizationRAG(updatedProject);
  
  await updateDoc(projectRef, {
    optimizationRAG: ragStatus,
  });
  
  return estimation;
}

/**
 * Build sheet summary from optimization result
 */
function buildSheetSummary(result: OptimizationResult, parts: CutlistPart[]): SheetSummary[] {
  const summaries: SheetSummary[] = [];
  
  for (const [material, sheetCount] of Object.entries(result.sheetsByMaterial)) {
    const materialParts = parts.filter(p => p.materialName === material);
    const thickness = materialParts[0]?.thickness || 18;
    
    // Estimate based on area
    const totalArea = materialParts.reduce((sum, p) => sum + (p.length * p.width * p.quantity), 0);
    const stockArea = 2440 * 1220; // Default sheet size
    const utilizationPercent = (totalArea / (sheetCount * stockArea)) * 100;
    
    summaries.push({
      materialId: material,
      materialName: material,
      thickness,
      sheetSize: { length: 2440, width: 1220 },
      sheetsRequired: sheetCount,
      partsOnSheet: Math.ceil(materialParts.reduce((sum, p) => sum + p.quantity, 0) / sheetCount),
      utilizationPercent: Math.min(utilizationPercent, 100),
      wasteArea: (sheetCount * stockArea) - totalArea,
      estimatedCost: (result.estimatedMaterialCost || 0) * (sheetCount / result.totalSheets),
    });
  }
  
  return summaries;
}

// ============================================
// Production Mode
// ============================================

/**
 * Run production optimization and save to project.optimizationState.production
 * Full nesting with guillotine algorithm, targets 85%+ yield
 */
export async function runProjectProduction(
  projectId: string,
  userId: string
): Promise<ProductionResult> {
  // Get project
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  const projectSnap = await getDoc(projectRef);
  
  if (!projectSnap.exists()) {
    throw new Error('Project not found');
  }
  
  const project = { id: projectSnap.id, ...projectSnap.data() } as Project;
  
  // Check if estimation exists
  if (!project.optimizationState?.estimation) {
    throw new Error('Run estimation first before production optimization');
  }
  
  // Aggregate parts from all design items
  const parts = await aggregatePartsFromProject(projectId);
  
  if (parts.length === 0) {
    throw new Error('No parts found in project design items');
  }
  
  // Build material map to consolidate design materials to inventory materials
  // This prevents over-buying when multiple design materials map to the same inventory material
  const materialMap = buildDesignToInventoryMaterialMap(project);
  
  // Convert to optimization format using inventory materials for grouping
  const panels = partsToOptimizationPanels(parts, materialMap);
  
  // Get config
  const config = project.optimizationState?.config;
  
  // Fetch dynamic material costs from material palette mappings
  const dynamicCosts = await fetchMaterialCosts(parts, project);
  
  // Build stock sheets with dynamic costs
  const stockSheets: Record<string, { material: string; length: number; width: number; thickness: number; cost: number }> = {};
  
  if (config?.stockSheets) {
    for (const sheet of config.stockSheets) {
      stockSheets[sheet.materialName] = {
        material: sheet.materialName,
        length: sheet.length,
        width: sheet.width,
        thickness: sheet.thickness,
        cost: dynamicCosts[sheet.materialName] || sheet.costPerSheet,
      };
    }
  }
  
  // Add any materials from parts that aren't in config
  // Use inventory material name for grouping (matches what partsToOptimizationPanels uses)
  for (const part of parts) {
    const mappedMaterial = materialMap.get(part.materialName);
    const inventoryMaterial = mappedMaterial?.inventoryName || part.materialName;
    
    if (inventoryMaterial && !stockSheets[inventoryMaterial]) {
      stockSheets[inventoryMaterial] = {
        material: inventoryMaterial,
        length: 2440,
        width: 1220,
        thickness: part.thickness,
        cost: dynamicCosts[part.materialName] || 150000,
      };
    }
  }
  
  // Run production optimization
  const result = optimizationService.optimize(panels, {
    mode: 'PRODUCTION',
    bladeKerf: config?.kerf || 4,
    stockSheets,
  });
  
  // Convert to ProductionResult format
  const nestingSheets = buildNestingSheets(result, parts);
  const cutSequence = buildCutSequence(nestingSheets);
  const optimizedYield = result.averageUtilization;
  
  const timestamp = FirestoreTimestamp.now();

  const production: ProductionResult = {
    nestingSheets,
    cutSequence,
    optimizedYield,
    totalCuttingLength: calculateTotalCuttingLength(cutSequence),
    estimatedCutTime: estimateCutTime(cutSequence),
    validAt: timestamp,
  };
  
  // Save to project - explicitly set fields and clear invalidation
  await updateDoc(projectRef, {
    'optimizationState.production.nestingSheets': production.nestingSheets,
    'optimizationState.production.cutSequence': production.cutSequence,
    'optimizationState.production.optimizedYield': production.optimizedYield,
    'optimizationState.production.totalCuttingLength': production.totalCuttingLength,
    'optimizationState.production.estimatedCutTime': production.estimatedCutTime,
    'optimizationState.production.validAt': production.validAt,
    'optimizationState.production.invalidatedAt': deleteField(),
    'optimizationState.production.invalidationReasons': deleteField(),
    'optimizationState.lastProductionRun': timestamp,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
  
  // Update RAG status
  const updatedProject = { ...project, optimizationState: { ...project.optimizationState, production } } as Project;
  const ragStatus = updateOptimizationRAG(updatedProject);
  
  await updateDoc(projectRef, {
    optimizationRAG: ragStatus,
  });
  
  return production;
}

/**
 * Build nesting sheets from optimization result
 */
function buildNestingSheets(result: OptimizationResult, parts: CutlistPart[]): NestingSheet[] {
  const cloneOperations = (operations: EdgeOperationSpec[] | undefined): EdgeOperationSpec[] | undefined => {
    if (!operations || operations.length === 0) return undefined;
    return operations.map(op => {
      const clean: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(op)) {
        if (value !== undefined) clean[key] = value;
      }
      return clean as unknown as EdgeOperationSpec;
    });
  };

  const toPlacementEdgeData = (
    sourceEdgeBanding: CutlistPart['edgeBanding'] | undefined
  ): Pick<PartPlacement, 'edgeBanding' | 'edgeOperationsBySide'> => {
    if (!sourceEdgeBanding) return {};

    const edgeBanding: PartPlacement['edgeBanding'] = {
      top: sourceEdgeBanding.top,
      bottom: sourceEdgeBanding.bottom,
      left: sourceEdgeBanding.left,
      right: sourceEdgeBanding.right,
      ...(sourceEdgeBanding.front !== undefined ? { front: sourceEdgeBanding.front } : {}),
      ...(sourceEdgeBanding.material !== undefined ? { material: sourceEdgeBanding.material } : {}),
      ...(sourceEdgeBanding.thickness !== undefined ? { thickness: sourceEdgeBanding.thickness } : {}),
      ...(sourceEdgeBanding.edges ? {
        edges: {
          ...(sourceEdgeBanding.edges.top ? {
            top: {
              ...(sourceEdgeBanding.edges.top.material !== undefined ? { material: sourceEdgeBanding.edges.top.material } : {}),
              ...(sourceEdgeBanding.edges.top.thickness !== undefined ? { thickness: sourceEdgeBanding.edges.top.thickness } : {}),
              ...(sourceEdgeBanding.edges.top.length !== undefined ? { length: sourceEdgeBanding.edges.top.length } : {}),
              ...(cloneOperations(sourceEdgeBanding.edges.top.operations) ? { operations: cloneOperations(sourceEdgeBanding.edges.top.operations) } : {}),
            },
          } : {}),
          ...(sourceEdgeBanding.edges.bottom ? {
            bottom: {
              ...(sourceEdgeBanding.edges.bottom.material !== undefined ? { material: sourceEdgeBanding.edges.bottom.material } : {}),
              ...(sourceEdgeBanding.edges.bottom.thickness !== undefined ? { thickness: sourceEdgeBanding.edges.bottom.thickness } : {}),
              ...(sourceEdgeBanding.edges.bottom.length !== undefined ? { length: sourceEdgeBanding.edges.bottom.length } : {}),
              ...(cloneOperations(sourceEdgeBanding.edges.bottom.operations) ? { operations: cloneOperations(sourceEdgeBanding.edges.bottom.operations) } : {}),
            },
          } : {}),
          ...(sourceEdgeBanding.edges.left ? {
            left: {
              ...(sourceEdgeBanding.edges.left.material !== undefined ? { material: sourceEdgeBanding.edges.left.material } : {}),
              ...(sourceEdgeBanding.edges.left.thickness !== undefined ? { thickness: sourceEdgeBanding.edges.left.thickness } : {}),
              ...(sourceEdgeBanding.edges.left.length !== undefined ? { length: sourceEdgeBanding.edges.left.length } : {}),
              ...(cloneOperations(sourceEdgeBanding.edges.left.operations) ? { operations: cloneOperations(sourceEdgeBanding.edges.left.operations) } : {}),
            },
          } : {}),
          ...(sourceEdgeBanding.edges.right ? {
            right: {
              ...(sourceEdgeBanding.edges.right.material !== undefined ? { material: sourceEdgeBanding.edges.right.material } : {}),
              ...(sourceEdgeBanding.edges.right.thickness !== undefined ? { thickness: sourceEdgeBanding.edges.right.thickness } : {}),
              ...(sourceEdgeBanding.edges.right.length !== undefined ? { length: sourceEdgeBanding.edges.right.length } : {}),
              ...(cloneOperations(sourceEdgeBanding.edges.right.operations) ? { operations: cloneOperations(sourceEdgeBanding.edges.right.operations) } : {}),
            },
          } : {}),
          ...(sourceEdgeBanding.edges.front ? {
            front: {
              ...(sourceEdgeBanding.edges.front.material !== undefined ? { material: sourceEdgeBanding.edges.front.material } : {}),
              ...(sourceEdgeBanding.edges.front.thickness !== undefined ? { thickness: sourceEdgeBanding.edges.front.thickness } : {}),
              ...(sourceEdgeBanding.edges.front.length !== undefined ? { length: sourceEdgeBanding.edges.front.length } : {}),
              ...(cloneOperations(sourceEdgeBanding.edges.front.operations) ? { operations: cloneOperations(sourceEdgeBanding.edges.front.operations) } : {}),
            },
          } : {}),
        },
      } : {}),
    };

    const edgeOperationsBySide = {
      ...(cloneOperations(sourceEdgeBanding.edges?.top?.operations) ? { top: cloneOperations(sourceEdgeBanding.edges?.top?.operations) } : {}),
      ...(cloneOperations(sourceEdgeBanding.edges?.right?.operations) ? { right: cloneOperations(sourceEdgeBanding.edges?.right?.operations) } : {}),
      ...(cloneOperations(sourceEdgeBanding.edges?.bottom?.operations) ? { bottom: cloneOperations(sourceEdgeBanding.edges?.bottom?.operations) } : {}),
      ...(cloneOperations(sourceEdgeBanding.edges?.left?.operations) ? { left: cloneOperations(sourceEdgeBanding.edges?.left?.operations) } : {}),
      ...(cloneOperations(sourceEdgeBanding.edges?.front?.operations) ? { front: cloneOperations(sourceEdgeBanding.edges?.front?.operations) } : {}),
    };

    return {
      edgeBanding,
      ...(Object.keys(edgeOperationsBySide).length > 0 ? { edgeOperationsBySide } : {}),
    };
  };

  const partsById = new Map(parts.map(part => [part.id, part]));
  const inferPlacementQuarterTurns = (
    placement: { width: number; height: number; rotated: boolean },
    originalPart: CutlistPart | undefined
  ): number => {
    if (originalPart) {
      const epsilon = 0.001;
      const sameOrientation =
        Math.abs(placement.width - originalPart.length) < epsilon &&
        Math.abs(placement.height - originalPart.width) < epsilon;
      if (sameOrientation) return 0;
      const quarterTurnOrientation =
        Math.abs(placement.width - originalPart.width) < epsilon &&
        Math.abs(placement.height - originalPart.length) < epsilon;
      if (quarterTurnOrientation) return 1;
    }
    // Fallback for unresolved source metadata.
    return placement.rotated ? 0 : 1;
  };

  const resolveOriginalPart = (panelId: string): CutlistPart | undefined => {
    if (!panelId) return undefined;

    // 1) Exact ID match always wins.
    const exact = partsById.get(panelId);
    if (exact) return exact;

    // 2) Quantity-expanded IDs are created as `${baseId}-${n}` by optimizer.
    // Only strip one trailing numeric segment when exact lookup fails.
    const suffixMatch = panelId.match(/^(.*)-(\d+)$/);
    if (!suffixMatch) return undefined;

    return partsById.get(suffixMatch[1]);
  };

  return result.sheets.map((sheet, index) => {
    const placements: PartPlacement[] = sheet.placements.map(p => {
      const panelId = p.panel.id || '';
      const originalPart = resolveOriginalPart(panelId);
      const sourceEdgeBanding = originalPart?.edgeBanding;
      const edgeData = toPlacementEdgeData(sourceEdgeBanding);
      
      // Store PLACED dimensions (already accounting for rotation)
      // These match what the NestingStudio displays
      const rotationQuarterTurns = inferPlacementQuarterTurns(p, originalPart);
      return {
        partId: p.panel.id || `part-${index}`,
        partName: p.label,
        designItemId: originalPart?.designItemId || '',
        designItemName: originalPart?.designItemName || '',
        x: p.x,
        y: p.y,
        length: p.width,   // Placed width (horizontal on sheet)
        width: p.height,   // Placed height (vertical on sheet)
        rotated: p.rotated,
        rotationQuarterTurns,
        grainAligned: !p.rotated || p.panel.grain === 0,
        // Keep source edge sides from cutlist; PDF layer applies rotation-aware
        // display mapping so edge markers stay locked to part orientation.
        ...edgeData,
      };
    });
    
    // Calculate waste regions from guillotine cut algorithm
    const wasteRegions = calculateWasteRegions({
      width: sheet.width,
      height: sheet.height,
      wastedArea: sheet.wastedArea,
      wasteRegions: sheet.wasteRegions,
    }, placements);
    
    return {
      id: sheet.id,
      sheetIndex: index,
      stockSheetId: sheet.stockSheet.material,
      materialId: sheet.material,
      materialName: sheet.material,
      sheetSize: { length: sheet.width, width: sheet.height },
      placements,
      utilizationPercent: sheet.utilization,
      wasteArea: sheet.wastedArea,
      wasteRegions,
    };
  });
}

/**
 * Calculate waste regions on a sheet from guillotine cut free rectangles
 * For panel saw cutting, waste regions are the remaining free rectangles after all parts are placed
 */
function calculateWasteRegions(
  sheet: { width: number; height: number; wastedArea: number; wasteRegions?: { x: number; y: number; width: number; height: number }[] },
  _placements: PartPlacement[],
  minimumUsableSize: { width: number; height: number } = { width: 200, height: 200 }
): WasteRegion[] {
  const regions: WasteRegion[] = [];
  
  // Use actual waste regions from guillotine algorithm if available
  if (sheet.wasteRegions && sheet.wasteRegions.length > 0) {
    for (const rect of sheet.wasteRegions) {
      const area = rect.width * rect.height;
      // A region is reusable if both dimensions are >= minimum usable size
      const reusable = rect.width >= minimumUsableSize.width && rect.height >= minimumUsableSize.height;
      
      regions.push({
        x: rect.x,
        y: rect.y,
        length: rect.width,   // Horizontal dimension
        width: rect.height,   // Vertical dimension
        area,
        reusable,
      });
    }
  } else if (sheet.wastedArea > 0) {
    // Fallback: create estimated waste region if no detailed regions available
    // This shouldn't happen with panel saw cuts but provides backwards compatibility
    const estimatedSide = Math.sqrt(sheet.wastedArea);
    regions.push({
      x: sheet.width - estimatedSide,
      y: sheet.height - estimatedSide,
      length: estimatedSide,
      width: estimatedSide,
      area: sheet.wastedArea,
      reusable: estimatedSide >= minimumUsableSize.width && estimatedSide >= minimumUsableSize.height,
    });
  }
  
  return regions;
}

/**
 * Build cut sequence from nesting sheets
 */
function buildCutSequence(sheets: NestingSheet[]): CutOperation[] {
  const operations: CutOperation[] = [];
  let sequence = 1;
  
  for (const sheet of sheets) {
    // Generate cuts for each sheet
    // Simplified: just create horizontal and vertical cuts based on placements
    const placements = [...sheet.placements].sort((a, b) => a.y - b.y || a.x - b.x);
    
    for (const placement of placements) {
      // Rip cut (vertical)
      operations.push({
        id: `cut-${sequence}`,
        sheetId: sheet.id,
        sequence: sequence++,
        type: 'rip',
        startX: placement.x + placement.length,
        startY: 0,
        endX: placement.x + placement.length,
        endY: sheet.sheetSize.width,
        length: sheet.sheetSize.width,
        resultingParts: [placement.partId],
      });
      
      // Crosscut (horizontal)
      operations.push({
        id: `cut-${sequence}`,
        sheetId: sheet.id,
        sequence: sequence++,
        type: 'crosscut',
        startX: 0,
        startY: placement.y + placement.width,
        endX: placement.x + placement.length,
        endY: placement.y + placement.width,
        length: placement.x + placement.length,
        resultingParts: [placement.partId],
      });
    }
  }
  
  return operations;
}

/**
 * Calculate total cutting length
 */
function calculateTotalCuttingLength(cuts: CutOperation[]): number {
  return cuts.reduce((sum, cut) => sum + cut.length, 0);
}

/**
 * Estimate cut time based on cut sequence
 */
function estimateCutTime(cuts: CutOperation[]): number {
  // Assume 2 seconds per 100mm of cutting
  const totalLength = calculateTotalCuttingLength(cuts);
  return Math.ceil(totalLength / 100 * 2 / 60); // minutes
}

// ============================================
// Utility Functions
// ============================================

/**
 * Check if optimization needs re-run
 */
export function needsReOptimization(
  project: Project,
  mode: 'estimation' | 'production'
): boolean {
  const state = project.optimizationState?.[mode];
  return !state || !!state.invalidatedAt;
}

/**
 * Get optimization status summary
 */
export function getOptimizationStatus(project: Project): {
  estimationStatus: 'none' | 'valid' | 'stale';
  productionStatus: 'none' | 'valid' | 'stale';
  canRunProduction: boolean;
} {
  const estimation = project.optimizationState?.estimation;
  const production = project.optimizationState?.production;
  
  return {
    estimationStatus: !estimation ? 'none' : estimation.invalidatedAt ? 'stale' : 'valid',
    productionStatus: !production ? 'none' : production.invalidatedAt ? 'stale' : 'valid',
    canRunProduction: !!estimation && !estimation.invalidatedAt,
  };
}

/**
 * Update optimization config
 */
export async function updateProjectConfig(
  projectId: string, 
  changes: Partial<OptimizationConfig>,
  userId: string
): Promise<void> {
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  
  // Build update object for each changed field
  const updates: Record<string, any> = {
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  };
  
  if (changes.kerf !== undefined) {
    updates['optimizationState.config.kerf'] = changes.kerf;
  }
  if (changes.targetYield !== undefined) {
    updates['optimizationState.config.targetYield'] = changes.targetYield;
  }
  if (changes.grainMatching !== undefined) {
    updates['optimizationState.config.grainMatching'] = changes.grainMatching;
  }
  if (changes.allowRotation !== undefined) {
    updates['optimizationState.config.allowRotation'] = changes.allowRotation;
  }
  if (changes.stockSheets !== undefined) {
    updates['optimizationState.config.stockSheets'] = changes.stockSheets;
  }
  
  await updateDoc(projectRef, updates);
}

/**
 * Clear estimation and mark for re-run
 */
export async function clearEstimation(projectId: string, userId: string): Promise<void> {
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  
  await updateDoc(projectRef, {
    'optimizationState.estimation': null,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

/**
 * Clear production and mark for re-run
 */
export async function clearProduction(projectId: string, userId: string): Promise<void> {
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  
  await updateDoc(projectRef, {
    'optimizationState.production': null,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}
