/**
 * Assembly Engine
 * Intelligent part grouping, sub-assembly detection, and bidirectional mesh↔cutlist linkage.
 *
 * 1. Normalize PolyBoard names
 * 2. Detect assemblies (Shaker Door, Drawer Box, Carcase)
 * 3. Build mesh↔cutlist links (exact → dimension → material+dims → unmatched)
 * 4. Build hierarchical PartTreeNode[]
 */

import { nanoid } from 'nanoid';
import type {
  ParsedModel,
  CutListEntry,
  MeshObject,
  PartTreeNode,
  MeshCutListLink,
  NormalizedPartName,
  AssemblyType,
  PartRole,
  BoundingBox3D,
  AssemblyGroup,
  ConstructionStep,
} from '../types/workshop-viewer.types';
import { ASSEMBLY_PATTERNS, CONSTRUCTION_SEQUENCE } from '../constants/workshop-viewer.constants';
import {
  computeBoundingBox,
  mergeBoundingBoxes,
  bboxDimensions,
  bboxNear,
  classifyPartRole,
} from './geometryEngine';

// ============================================================================
// NAME NORMALIZATION
// ============================================================================

/**
 * Normalize a PolyBoard mesh object name.
 * "Door 1 (Double) [1]" → { baseName: "Door", instance: 1, variant: "Double", subIndex: 1 }
 * "Left Side Drawer 1 [1]" → { baseName: "Left Side Drawer", instance: 1, variant: null, subIndex: 1 }
 * "Bottom 1" → { baseName: "Bottom", instance: 1, variant: null, subIndex: null }
 * "Vertical Division [2] 16" → { baseName: "Vertical Division", instance: null, variant: null, subIndex: 2 }
 */
export function normalizePartName(name: string): NormalizedPartName {
  let remaining = name.trim();

  // Extract sub-index [N]
  let subIndex: number | null = null;
  const subMatch = remaining.match(/\[(\d+)\]/);
  if (subMatch) {
    subIndex = parseInt(subMatch[1], 10);
    remaining = remaining.replace(/\s*\[\d+\]\s*/g, ' ').trim();
  }

  // Extract variant (text in parentheses)
  let variant: string | null = null;
  const variantMatch = remaining.match(/\(([^)]+)\)/);
  if (variantMatch) {
    variant = variantMatch[1].trim();
    remaining = remaining.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  }

  // Extract trailing instance number
  let instance: number | null = null;
  const instanceMatch = remaining.match(/\s+(\d+)\s*$/);
  if (instanceMatch) {
    instance = parseInt(instanceMatch[1], 10);
    remaining = remaining.replace(/\s+\d+\s*$/, '').trim();
  }

  return {
    baseName: remaining,
    instance,
    variant,
    subIndex,
    original: name,
  };
}

// ============================================================================
// ASSEMBLY DETECTION
// ============================================================================

interface MeshWithMeta {
  obj: MeshObject;
  normalized: NormalizedPartName;
  role: PartRole;
  bbox: BoundingBox3D;
  assignedAssembly: string | null;
}

/**
 * Detect assemblies from mesh objects using naming patterns and spatial proximity.
 */
function detectAssemblies(meshes: MeshWithMeta[]): Map<string, { type: AssemblyType; members: MeshWithMeta[] }> {
  const assemblies = new Map<string, { type: AssemblyType; members: MeshWithMeta[] }>();

  // Find door assemblies: a "door" role mesh + nearby rail/stile/panel meshes
  const doors = meshes.filter(m => m.role === 'door');
  for (const door of doors) {
    const assemblyId = `asm_${nanoid(6)}`;
    const members: MeshWithMeta[] = [door];
    door.assignedAssembly = assemblyId;

    // Find sub-components (rails, stiles, panels) that are spatially near
    const childRoles: PartRole[] = ['rail', 'stile', 'panel', 'muntin'];
    for (const mesh of meshes) {
      if (mesh.assignedAssembly) continue;
      if (!childRoles.includes(mesh.role)) continue;
      if (bboxNear(door.bbox, mesh.bbox, 100)) {
        members.push(mesh);
        mesh.assignedAssembly = assemblyId;
      }
    }

    // Determine door type
    const hasRails = members.some(m => m.role === 'rail');
    const hasStiles = members.some(m => m.role === 'stile');
    const hasPanel = members.some(m => m.role === 'panel');

    let type: AssemblyType = 'slab_door';
    if (hasRails && hasStiles && hasPanel) type = 'shaker_door';
    else if (hasRails && hasStiles) type = 'raised_panel_door';

    assemblies.set(assemblyId, { type, members });
    // Update assembly id with a better name
    const namedId = `door_${door.normalized.instance ?? nanoid(4)}`;
    assemblies.delete(assemblyId);
    assemblies.set(namedId, { type, members });
    for (const m of members) m.assignedAssembly = namedId;
  }

  // Find drawer assemblies: a "drawer" role mesh + nearby drawer_component meshes
  const drawers = meshes.filter(m => m.role === 'drawer' && !m.assignedAssembly);
  for (const drawer of drawers) {
    const namedId = `drawer_${drawer.normalized.instance ?? nanoid(4)}`;
    const members: MeshWithMeta[] = [drawer];
    drawer.assignedAssembly = namedId;

    const childRoles: PartRole[] = ['drawer_component', 'counter_front'];
    for (const mesh of meshes) {
      if (mesh.assignedAssembly) continue;
      if (!childRoles.includes(mesh.role)) continue;
      if (bboxNear(drawer.bbox, mesh.bbox, 100)) {
        members.push(mesh);
        mesh.assignedAssembly = namedId;
      }
    }

    assemblies.set(namedId, { type: 'drawer_box', members });
  }

  return assemblies;
}

// ============================================================================
// MESH ↔ CUT LIST LINKAGE
// ============================================================================

/**
 * Build bidirectional links between 3DS mesh objects and CSV cut list entries.
 * Three-pass matching: exact name → dimension → material+dims.
 */
export function buildMeshCutListLinks(
  model: ParsedModel,
  cutList: CutListEntry[],
): MeshCutListLink[] {
  const links: MeshCutListLink[] = [];
  const matchedMeshes = new Set<string>();
  const matchedCutList = new Set<number>();

  // Normalize all names for matching
  const meshNormalized = model.objects.map(obj => ({
    name: obj.name,
    normalized: normalizePartName(obj.name),
    bbox: computeBoundingBox(obj.vertices),
    dims: bboxDimensions(computeBoundingBox(obj.vertices)),
  }));

  const cutNormalized = cutList.map((entry, idx) => ({
    ...entry,
    index: idx,
    normalized: normalizePartName(entry.partName),
  }));

  // Pass 1: Exact name match (case-insensitive, after normalization)
  for (const mesh of meshNormalized) {
    if (matchedMeshes.has(mesh.name)) continue;

    for (const cut of cutNormalized) {
      if (matchedCutList.has(cut.index)) continue;

      if (mesh.normalized.baseName.toLowerCase() === cut.normalized.baseName.toLowerCase()) {
        links.push({
          meshObjectName: mesh.name,
          cutListIndex: cut.index,
          confidence: 'exact',
          matchedBy: 'name',
        });
        matchedMeshes.add(mesh.name);
        matchedCutList.add(cut.index);
        break;
      }
    }
  }

  // Pass 1.5: Fuzzy type-keyword matching
  // Handles cases like "Door 1 17" (3DS) matching "Door 1 (Double) [1]_1" (CSV)
  const TYPE_KEYWORDS = [
    'Door', 'Drawer', 'Side', 'Shelf', 'Shelve', 'Top', 'Bottom',
    'Back', 'Division', 'Rail', 'Stile', 'Panel', 'Bar', 'Counter',
  ];

  function fuzzyNameMatch(meshBase: string, cutBase: string): boolean {
    const meshType = TYPE_KEYWORDS.find(kw => meshBase.toLowerCase().includes(kw.toLowerCase()));
    const cutType = TYPE_KEYWORDS.find(kw => cutBase.toLowerCase().includes(kw.toLowerCase()));
    if (!meshType || !cutType) return false;
    if (meshType.toLowerCase() !== cutType.toLowerCase()) return false;

    // Same type keyword — now check if instance numbers overlap
    const meshNums = meshBase.match(/\d+/g)?.map(Number) || [];
    const cutNums = cutBase.match(/\d+/g)?.map(Number) || [];
    if (meshNums.length === 0 && cutNums.length === 0) return true;
    return meshNums.some(n => cutNums.includes(n));
  }

  for (const mesh of meshNormalized) {
    if (matchedMeshes.has(mesh.name)) continue;
    for (const cut of cutNormalized) {
      if (matchedCutList.has(cut.index)) continue;
      if (fuzzyNameMatch(mesh.normalized.baseName || mesh.name, cut.normalized.baseName || cutList[cut.index].partName)) {
        links.push({
          meshObjectName: mesh.name,
          cutListIndex: cut.index,
          confidence: 'fuzzy' as const,
          matchedBy: 'name' as const,
        });
        matchedMeshes.add(mesh.name);
        matchedCutList.add(cut.index);
        break;
      }
    }
  }

  // Pass 2: Dimension match within 2mm tolerance
  const DIM_TOLERANCE = 2;
  for (const mesh of meshNormalized) {
    if (matchedMeshes.has(mesh.name)) continue;

    for (const cut of cutNormalized) {
      if (matchedCutList.has(cut.index)) continue;

      // Compare mesh bbox dimensions with cut list dimensions
      // PolyBoard: length × width × thickness
      const meshDims = [mesh.dims.w, mesh.dims.d, mesh.dims.h].sort((a, b) => b - a);
      const cutDims = [cut.length, cut.width, cut.thickness].sort((a, b) => b - a);

      const match = meshDims.every((d, i) => Math.abs(d - cutDims[i]) < DIM_TOLERANCE);
      if (match) {
        links.push({
          meshObjectName: mesh.name,
          cutListIndex: cut.index,
          confidence: 'fuzzy',
          matchedBy: 'dimensions',
        });
        matchedMeshes.add(mesh.name);
        matchedCutList.add(cut.index);
        break;
      }
    }
  }

  // Pass 3: Material + dimension match (relaxed tolerance)
  for (const mesh of meshNormalized) {
    if (matchedMeshes.has(mesh.name)) continue;

    for (const cut of cutNormalized) {
      if (matchedCutList.has(cut.index)) continue;

      const meshDims = [mesh.dims.w, mesh.dims.d, mesh.dims.h].sort((a, b) => b - a);
      const cutDims = [cut.length, cut.width, cut.thickness].sort((a, b) => b - a);

      const dimMatch = meshDims.every((d, i) => Math.abs(d - cutDims[i]) < DIM_TOLERANCE * 3);
      if (dimMatch) {
        links.push({
          meshObjectName: mesh.name,
          cutListIndex: cut.index,
          confidence: 'fuzzy',
          matchedBy: 'material_and_dims',
        });
        matchedMeshes.add(mesh.name);
        matchedCutList.add(cut.index);
        break;
      }
    }
  }

  // Pass 4: Mark unmatched meshes
  for (const mesh of meshNormalized) {
    if (!matchedMeshes.has(mesh.name)) {
      links.push({
        meshObjectName: mesh.name,
        cutListIndex: -1,
        confidence: 'unmatched',
        matchedBy: 'none',
      });
    }
  }

  return links;
}

// ============================================================================
// PART TREE CONSTRUCTION
// ============================================================================

/**
 * Build the hierarchical part tree from a parsed model and optional cut list.
 */
export function buildPartTree(
  model: ParsedModel,
  _cutList: CutListEntry[],
  links: MeshCutListLink[],
): PartTreeNode[] {
  // Build mesh metadata
  const meshMeta: MeshWithMeta[] = model.objects.map(obj => ({
    obj,
    normalized: normalizePartName(obj.name),
    role: classifyPartRole(obj.name),
    bbox: computeBoundingBox(obj.vertices),
    assignedAssembly: null,
  }));

  // Detect assemblies
  const assemblies = detectAssemblies(meshMeta);

  // Build link map: meshName → cutListIndices
  const linkMap = new Map<string, number[]>();
  for (const link of links) {
    if (link.cutListIndex >= 0) {
      const existing = linkMap.get(link.meshObjectName) ?? [];
      existing.push(link.cutListIndex);
      linkMap.set(link.meshObjectName, existing);
    }
  }

  // Build tree nodes
  const rootChildren: PartTreeNode[] = [];

  // Add assembly nodes
  for (const [asmId, assembly] of assemblies) {
    const children: PartTreeNode[] = assembly.members.map(m => ({
      id: `leaf_${nanoid(6)}`,
      name: m.normalized.baseName + (m.normalized.instance ? ` ${m.normalized.instance}` : ''),
      role: m.role,
      meshObjectNames: [m.obj.name],
      cutListEntryIds: linkMap.get(m.obj.name) ?? [],
      children: [],
      bbox: m.bbox,
      dims: bboxDimensions(m.bbox),
      isExpanded: false,
      isLeaf: true,
    }));

    const allBboxes = assembly.members.map(m => m.bbox);
    const asmBbox = mergeBoundingBoxes(allBboxes);

    // Build assembly display name
    const primary = assembly.members.find(m => m.role === 'door' || m.role === 'drawer');
    const instanceNum = primary?.normalized.instance;
    const baseName = primary?.normalized.baseName ?? 'Assembly';
    const displayName = instanceNum
      ? `${baseName} ${instanceNum} — ${formatAssemblyType(assembly.type)}`
      : `${baseName} — ${formatAssemblyType(assembly.type)}`;

    rootChildren.push({
      id: asmId,
      name: displayName,
      role: primary?.role ?? 'other',
      assemblyType: assembly.type,
      meshObjectNames: assembly.members.map(m => m.obj.name),
      cutListEntryIds: assembly.members.flatMap(m => linkMap.get(m.obj.name) ?? []),
      children,
      bbox: asmBbox,
      dims: bboxDimensions(asmBbox),
      isExpanded: false,
      isLeaf: false,
    });
  }

  // Add unassigned parts as leaf nodes
  for (const mesh of meshMeta) {
    if (mesh.assignedAssembly) continue;

    rootChildren.push({
      id: `leaf_${nanoid(6)}`,
      name: mesh.normalized.baseName + (mesh.normalized.instance ? ` ${mesh.normalized.instance}` : ''),
      role: mesh.role,
      meshObjectNames: [mesh.obj.name],
      cutListEntryIds: linkMap.get(mesh.obj.name) ?? [],
      children: [],
      bbox: mesh.bbox,
      dims: bboxDimensions(mesh.bbox),
      isExpanded: false,
      isLeaf: true,
    });
  }

  // Sort: assemblies first, then by role priority, then alphabetically
  rootChildren.sort((a, b) => {
    if (a.isLeaf !== b.isLeaf) return a.isLeaf ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  return rootChildren;
}

// ============================================================================
// ASSEMBLY GROUPING ENGINE (Phase 3)
// ============================================================================

/**
 * Suggest assembly groups from the part tree using role-based classification.
 * Groups are sorted by construction sequence order.
 */
export function suggestAssemblyGroups(partTree: PartTreeNode[]): AssemblyGroup[] {
  const groups: AssemblyGroup[] = [];
  const assignedIds = new Set<string>();
  let groupIndex = 0;

  function collectAllNodes(nodes: PartTreeNode[]): PartTreeNode[] {
    const result: PartTreeNode[] = [];
    for (const node of nodes) {
      result.push(node);
      if (node.children?.length) result.push(...collectAllNodes(node.children));
    }
    return result;
  }

  const allNodes = collectAllNodes(partTree);

  // Carcase: side, top_bottom, back, vertical_division
  const carcaseParts = allNodes.filter(n =>
    ['side', 'top_bottom', 'back', 'vertical_division'].includes(n.role) && !assignedIds.has(n.id)
  );
  if (carcaseParts.length > 0) {
    groups.push({
      id: `group-${groupIndex++}`,
      category: 'carcase',
      name: 'Carcase',
      partIds: carcaseParts.map(p => p.id),
      confidence: 'high',
      isUserModified: false,
    });
    carcaseParts.forEach(p => assignedIds.add(p.id));
  }

  // Fixed shelves
  const fixedShelves = allNodes.filter(n =>
    n.role === 'shelf' && !assignedIds.has(n.id)
  );
  if (fixedShelves.length > 0) {
    groups.push({
      id: `group-${groupIndex++}`,
      category: 'fixed_shelves',
      name: 'Fixed Shelves',
      partIds: fixedShelves.map(p => p.id),
      confidence: 'high',
      isUserModified: false,
    });
    fixedShelves.forEach(p => assignedIds.add(p.id));
  }

  // Mobile/adjustable shelves
  const mobileShelves = allNodes.filter(n =>
    n.role === 'mobile_shelf' && !assignedIds.has(n.id)
  );
  if (mobileShelves.length > 0) {
    groups.push({
      id: `group-${groupIndex++}`,
      category: 'mobile_shelves',
      name: 'Adjustable Shelves',
      partIds: mobileShelves.map(p => p.id),
      confidence: 'high',
      isUserModified: false,
    });
    mobileShelves.forEach(p => assignedIds.add(p.id));
  }

  // Door assemblies (detect nodes with assemblyType containing 'door')
  const doorAssemblies = allNodes.filter(n =>
    n.assemblyType && /door/i.test(n.assemblyType) && !assignedIds.has(n.id)
  );
  for (const door of doorAssemblies) {
    const childIds = door.children?.map(c => c.id) || [];
    const allIds = [door.id, ...childIds];
    groups.push({
      id: `group-${groupIndex++}`,
      category: 'door',
      name: door.name || `Door Assembly ${groupIndex}`,
      partIds: allIds,
      confidence: childIds.length >= 3 ? 'high' : 'medium',
      isUserModified: false,
    });
    allIds.forEach(id => assignedIds.add(id));
  }

  // Individual door parts not in assemblies
  const looseDoors = allNodes.filter(n =>
    n.role === 'door' && !assignedIds.has(n.id)
  );
  if (looseDoors.length > 0) {
    groups.push({
      id: `group-${groupIndex++}`,
      category: 'door',
      name: 'Doors',
      partIds: looseDoors.map(p => p.id),
      confidence: 'medium',
      isUserModified: false,
    });
    looseDoors.forEach(p => assignedIds.add(p.id));
  }

  // Drawer assemblies
  const drawerAssemblies = allNodes.filter(n =>
    n.assemblyType && /drawer/i.test(n.assemblyType) && !assignedIds.has(n.id)
  );
  for (const drawer of drawerAssemblies) {
    const childIds = drawer.children?.map(c => c.id) || [];
    const allIds = [drawer.id, ...childIds];
    const isFront = /front/i.test(drawer.assemblyType || '');
    groups.push({
      id: `group-${groupIndex++}`,
      category: isFront ? 'drawer_front' : 'drawer_box',
      name: drawer.name || `Drawer ${groupIndex}`,
      partIds: allIds,
      confidence: 'high',
      isUserModified: false,
    });
    allIds.forEach(id => assignedIds.add(id));
  }

  // Loose drawer parts
  const looseDrawers = allNodes.filter(n =>
    (n.role === 'drawer' || n.role === 'drawer_component') && !assignedIds.has(n.id)
  );
  if (looseDrawers.length > 0) {
    groups.push({
      id: `group-${groupIndex++}`,
      category: 'drawer_box',
      name: 'Drawer Components',
      partIds: looseDrawers.map(p => p.id),
      confidence: 'low',
      isUserModified: false,
    });
    looseDrawers.forEach(p => assignedIds.add(p.id));
  }

  // Cover/countertop/plinth
  const covers = allNodes.filter(n =>
    ['cover', 'countertop', 'plinth'].includes(n.role) && !assignedIds.has(n.id)
  );
  if (covers.length > 0) {
    groups.push({
      id: `group-${groupIndex++}`,
      category: 'cover',
      name: 'Covers & Countertops',
      partIds: covers.map(p => p.id),
      confidence: 'high',
      isUserModified: false,
    });
    covers.forEach(p => assignedIds.add(p.id));
  }

  // Remaining unclassified
  const remaining = allNodes.filter(n => !assignedIds.has(n.id) && n.isLeaf);
  if (remaining.length > 0) {
    groups.push({
      id: `group-${groupIndex++}`,
      category: 'other',
      name: 'Other Components',
      partIds: remaining.map(p => p.id),
      confidence: 'low',
      isUserModified: false,
    });
  }

  // Sort by construction sequence
  const seqOrder = new Map<string, number>(CONSTRUCTION_SEQUENCE.map((cat, i) => [cat, i]));
  groups.sort((a, b) => (seqOrder.get(a.category) ?? 99) - (seqOrder.get(b.category) ?? 99));

  return groups;
}

/**
 * Generate a construction plan from confirmed assembly groups.
 * Phase 2 placeholder — instructions will be RAG-generated in the future.
 */
export function generateConstructionPlan(
  groups: AssemblyGroup[],
  _cutList: CutListEntry[],
): ConstructionStep[] {
  const seqOrder = new Map<string, number>(CONSTRUCTION_SEQUENCE.map((cat, i) => [cat, i]));
  const sorted = [...groups].sort((a, b) => (seqOrder.get(a.category) ?? 99) - (seqOrder.get(b.category) ?? 99));
  return sorted.map((group, index) => ({
    stepNumber: index + 1,
    groupId: group.id,
    title: `${group.category}: ${group.name}`,
    parts: group.partIds,
    instructions: [], // Phase 2: RAG-generated
  }));
}

function formatAssemblyType(type: AssemblyType): string {
  const pattern = ASSEMBLY_PATTERNS.find(p => p.type === type);
  if (pattern) return pattern.description;
  const fallback: Record<string, string> = {
    carcase: 'Carcase',
    custom: 'Custom Assembly',
  };
  return fallback[type] ?? type;
}
