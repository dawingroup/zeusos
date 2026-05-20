/**
 * Assembly Service — Scene-level assembly operations
 *
 * Extracts assemblies from GLB scene graph, maps parts to assemblies
 * using DKB patterns, and provides merge/split operations.
 */
import type { SceneAssembly, ScenePart, BoundingBox, BOMCategoryRollup } from '../types/assembly.types';
import type { AssemblyTypeEnum, PartCategory } from '../constants/assembly.constants';
import { DEFAULT_ASSEMBLY_HIERARCHIES, ASSEMBLY_BOM_GROUP_ORDER } from '../constants/assembly.constants';

/**
 * Extract assemblies from a GLB scene graph.
 *
 * Parses named groups from CadQuery/PolyBoard exports.
 * Maps groups to assembly types using DKB patterns when available.
 * Falls back to heuristic grouping based on part naming.
 */
export function extractAssembliesFromParsedModel(
  cabinetId: string,
  meshNames: string[],
  archetypeKey?: string,
): SceneAssembly[] {
  const assemblies: SceneAssembly[] = [];

  // Get expected assembly hierarchy from archetype
  const expectedTypes = archetypeKey && DEFAULT_ASSEMBLY_HIERARCHIES[archetypeKey]
    ? DEFAULT_ASSEMBLY_HIERARCHIES[archetypeKey]
    : ['carcass', 'door_assembly', 'hardware_kit'];

  // Group mesh names by detected assembly type
  const groups = new Map<string, string[]>();

  for (const name of meshNames) {
    const assemblyType = detectAssemblyTypeFromName(name);
    const key = assemblyType ?? 'custom';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(name);
  }

  // Ensure expected types exist (even if empty — used for completeness tracking)
  for (const type of expectedTypes) {
    if (!groups.has(type)) groups.set(type, []);
  }

  let sequence = 0;
  for (const [type, meshNodeIds] of groups) {
    const assemblyType = type as AssemblyTypeEnum;
    assemblies.push({
      id: `${cabinetId}-${type}-${sequence}`,
      cabinetId,
      assemblyType,
      assemblyCode: `${type}-${sequence + 1}`,
      displayName: formatAssemblyName(assemblyType),
      parts: [],
      meshNodeIds,
      boundingBox: EMPTY_BBOX,
      jointSpec: [],
      assemblySequence: [],
      isComplete: meshNodeIds.length > 0,
      totalPartCount: meshNodeIds.length,
      totalArea: 0,
      totalCost: 0,
      sequence,
    });
    sequence++;
  }

  return assemblies;
}

/**
 * Detect assembly type from a mesh name using naming conventions.
 */
function detectAssemblyTypeFromName(name: string): AssemblyTypeEnum | null {
  const lower = name.toLowerCase();

  // Specific cover / facing tokens — checked FIRST so they win over the
  // generic carcass "side / back" match below (a "gable_cover" mesh
  // must be cover_panel_run, not carcass).
  if (lower.includes('cable_cover') || lower.includes('cable_tray') || lower.includes('cable-tray')) return 'cable_tray';
  if (lower.includes('gable_cover') || lower.includes('end_cap') || lower.includes('rear_cover')
    || lower.includes('back_cover') || lower.includes('filler') || lower.includes('infill')
    || lower.includes('cover_panel') || (lower.includes('cover') && !lower.includes('cover_of'))) {
    return 'cover_panel_run';
  }
  if (lower.includes('modesty') || lower.includes('privacy_panel')) return 'modesty_panel';
  if (lower.includes('fascia') || lower.includes('valance') || lower.includes('light_rail')
    || lower.includes('brow_panel')) return 'cornice_run';
  if (lower.includes('counter_front') || lower.includes('client_side') || lower.includes('reception_front')
    || lower.includes('reveal_panel')) return 'counter_front';
  if (lower.includes('work_surface') || lower.includes('desk_top') || lower.includes('worktop')
    || lower.includes('counter_top')) return 'work_surface';
  if (lower.includes('security_grille') || lower.includes('security_shutter') || lower.includes('roller_grille')
    || lower.includes('grille')) return 'security_grille';
  if (lower.includes('display_back') || lower.includes('slatwall') || lower.includes('pegboard')) return 'display_back';
  if (lower.includes('display_shelf') || lower.includes('adjustable_shelf') || lower.includes('dispensary_shelf')) return 'display_shelf_pack';
  if (lower.includes('upright') || lower.includes('gondola_post') || lower.includes('standard_upright')
    || (lower.includes('gable') && !lower.includes('gable_cover'))) return 'gable_run';
  if (lower.includes('bookcase') || lower.includes('bookshelf_frame')) return 'bookcase_frame';

  // Existing kitchen / wardrobe heuristics.
  if (lower.includes('door') || lower.includes('front_panel')) return 'door_assembly';
  if (lower.includes('drawer') && !lower.includes('front')) return 'drawer_box';
  if (lower.includes('drawer_front') || lower.includes('drawer-front')) return 'drawer_front';
  if (lower.includes('shelf') || lower.includes('shelv')) return 'shelf_pack';
  if (lower.includes('plinth') || lower.includes('kickboard') || lower.includes('toe_kick')) return 'plinth_assembly';
  if (lower.includes('cornice') || lower.includes('pelmet')) return 'cornice_run';
  if (lower.includes('hinge') || lower.includes('handle') || lower.includes('slide')
    || lower.includes('runner') || lower.includes('cam_lock') || lower.includes('dowel')) return 'hardware_kit';
  if (lower.includes('side') || lower.includes('bottom') || lower.includes('top_rail')
    || lower.includes('back') || lower.includes('carcass') || lower.includes('carcase')) return 'carcass';

  return null;
}

/**
 * Format assembly type into a human-readable display name.
 */
function formatAssemblyName(type: AssemblyTypeEnum): string {
  const names: Record<AssemblyTypeEnum, string> = {
    carcass: 'Main Carcass',
    drawer_box: 'Drawer Box',
    door_assembly: 'Door Assembly',
    drawer_front: 'Drawer Front',
    shelf_pack: 'Shelf Pack',
    hardware_kit: 'Hardware Kit',
    plinth_assembly: 'Plinth Assembly',
    cornice_run: 'Cornice Run',
    panel_run: 'Panel Run',
    custom: 'Custom Assembly',
    work_surface: 'Work Surface',
    counter_front: 'Counter Front',
    modesty_panel: 'Modesty Panel',
    cable_tray: 'Cable Tray',
    gable_run: 'Gable Run',
    display_shelf_pack: 'Display Shelves',
    display_back: 'Display Back',
    cover_panel_run: 'Cover Panels',
    security_grille: 'Security Grille',
    bookcase_frame: 'Bookcase Frame',
  };
  return names[type] ?? type;
}

/**
 * Map parts to assemblies based on naming heuristics.
 */
export function mapPartsToAssemblies(
  parts: ScenePart[],
  assemblies: SceneAssembly[],
): SceneAssembly[] {
  const updated = assemblies.map(a => ({ ...a, parts: [] as ScenePart[] }));
  const assemblyMap = new Map(updated.map(a => [a.assemblyType, a]));
  const fallback = updated.find(a => a.assemblyType === 'custom')
    ?? updated.find(a => a.assemblyType === 'carcass')
    ?? updated[0];

  for (const part of parts) {
    const type = detectAssemblyTypeFromName(part.partName)
      ?? detectPartCategoryToAssemblyType(part.partCategory);
    const target = assemblyMap.get(type) ?? fallback;
    if (target) {
      target.parts.push({ ...part, assemblyId: target.id });
    }
  }

  // Update totals
  for (const assembly of updated) {
    assembly.totalPartCount = assembly.parts.length;
    assembly.totalArea = assembly.parts
      .filter(p => p.dimensions)
      .reduce((sum, p) => sum + (p.dimensions!.length * p.dimensions!.width) / 1_000_000, 0);
    assembly.totalCost = assembly.parts.reduce((sum, p) => sum + p.totalCost, 0);
    assembly.isComplete = assembly.parts.length > 0;
  }

  return updated;
}

function detectPartCategoryToAssemblyType(category: PartCategory): AssemblyTypeEnum {
  switch (category) {
    case 'panel':              return 'carcass';
    case 'edge_band':          return 'carcass';
    case 'hardware':           return 'hardware_kit';
    case 'fastener':           return 'hardware_kit';
    case 'fitting':            return 'hardware_kit';
    case 'cover_panel':        return 'cover_panel_run';
    case 'toe_kick':           return 'plinth_assembly';
    case 'fascia':             return 'cornice_run';
    case 'upright':            return 'gable_run';
    case 'stretcher':          return 'carcass';
    case 'finish_consumable':  return 'hardware_kit';
    case 'packaging':          return 'hardware_kit';
    default:                   return 'carcass';
  }
}

/**
 * Compute BOM rollup for an assembly — groups parts by category.
 */
export function getAssemblyBOM(assembly: SceneAssembly): BOMCategoryRollup[] {
  const byCategory = new Map<PartCategory, ScenePart[]>();

  for (const part of assembly.parts) {
    if (!byCategory.has(part.partCategory)) {
      byCategory.set(part.partCategory, []);
    }
    byCategory.get(part.partCategory)!.push(part);
  }

  const rollups: BOMCategoryRollup[] = [];
  for (const cat of ASSEMBLY_BOM_GROUP_ORDER) {
    const parts = byCategory.get(cat);
    if (!parts || parts.length === 0) continue;

    rollups.push({
      category: cat,
      lineItems: parts.map(p => ({
        inventoryItemId: p.inventoryItemId,
        inventoryItemName: p.inventoryItemName,
        description: p.materialDescription,
        quantity: p.quantity,
        unit: p.unit,
        unitCost: p.unitCost,
        totalCost: p.totalCost,
        appearingIn: [{ cabinetId: p.cabinetId, cabinetName: '', qty: p.quantity }],
      })),
      subtotal: parts.reduce((sum, p) => sum + p.totalCost, 0),
      partCount: parts.length,
    });
  }

  return rollups;
}

/**
 * Merge selected parts into a new assembly.
 */
export function mergePartsIntoAssembly(
  assemblies: SceneAssembly[],
  partIds: string[],
  newAssemblyType: AssemblyTypeEnum,
  newAssemblyName: string,
  cabinetId: string,
): SceneAssembly[] {
  const partIdSet = new Set(partIds);
  const mergedParts: ScenePart[] = [];

  // Remove parts from existing assemblies
  const updated = assemblies.map(a => {
    const remaining: ScenePart[] = [];
    for (const p of a.parts) {
      if (partIdSet.has(p.id)) {
        mergedParts.push(p);
      } else {
        remaining.push(p);
      }
    }
    return { ...a, parts: remaining, totalPartCount: remaining.length };
  });

  // Create new assembly
  const newAssembly: SceneAssembly = {
    id: `${cabinetId}-${newAssemblyType}-merged`,
    cabinetId,
    assemblyType: newAssemblyType,
    assemblyCode: `${newAssemblyType}-merged`,
    displayName: newAssemblyName,
    parts: mergedParts.map(p => ({ ...p, assemblyId: `${cabinetId}-${newAssemblyType}-merged` })),
    meshNodeIds: mergedParts.map(p => p.meshNodeId).filter(Boolean) as string[],
    boundingBox: EMPTY_BBOX,
    jointSpec: [],
    assemblySequence: [],
    isComplete: true,
    totalPartCount: mergedParts.length,
    totalArea: 0,
    totalCost: mergedParts.reduce((sum, p) => sum + p.totalCost, 0),
    sequence: updated.length,
  };

  return [...updated.filter(a => a.parts.length > 0), newAssembly];
}

/**
 * Split an assembly into multiple by part group assignment.
 */
export function splitAssembly(
  assemblies: SceneAssembly[],
  assemblyId: string,
  partGroups: string[][],
  groupNames: string[],
  cabinetId: string,
): SceneAssembly[] {
  const source = assemblies.find(a => a.id === assemblyId);
  if (!source) return assemblies;

  const partMap = new Map(source.parts.map(p => [p.id, p]));
  const newAssemblies: SceneAssembly[] = [];

  for (let i = 0; i < partGroups.length; i++) {
    const groupParts = partGroups[i].map(id => partMap.get(id)).filter(Boolean) as ScenePart[];
    const newId = `${cabinetId}-${source.assemblyType}-split-${i}`;
    newAssemblies.push({
      ...source,
      id: newId,
      assemblyCode: `${source.assemblyType}-${i + 1}`,
      displayName: groupNames[i] ?? `${source.displayName} (${i + 1})`,
      parts: groupParts.map(p => ({ ...p, assemblyId: newId })),
      totalPartCount: groupParts.length,
      totalCost: groupParts.reduce((sum, p) => sum + p.totalCost, 0),
      sequence: source.sequence + i,
    });
  }

  return [
    ...assemblies.filter(a => a.id !== assemblyId),
    ...newAssemblies,
  ];
}

/**
 * Compute bounding box for an assembly from its parts' mesh extents.
 */
export function getAssemblyBoundingBox(assembly: SceneAssembly): BoundingBox {
  if (assembly.parts.length === 0) return EMPTY_BBOX;

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const part of assembly.parts) {
    if (!part.dimensions) continue;
    // Approximate: use dimensions as extents from origin
    const l = part.dimensions.length;
    const w = part.dimensions.width;
    const t = part.dimensions.thickness;
    maxX = Math.max(maxX, l);
    maxY = Math.max(maxY, t);
    maxZ = Math.max(maxZ, w);
    minX = Math.min(minX, 0);
    minY = Math.min(minY, 0);
    minZ = Math.min(minZ, 0);
  }

  if (!isFinite(minX)) return EMPTY_BBOX;

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 },
    size: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ },
  };
}

const EMPTY_BBOX: BoundingBox = {
  min: { x: 0, y: 0, z: 0 },
  max: { x: 0, y: 0, z: 0 },
  center: { x: 0, y: 0, z: 0 },
  size: { x: 0, y: 0, z: 0 },
};
