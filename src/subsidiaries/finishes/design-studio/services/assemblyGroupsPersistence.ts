/**
 * assemblyGroupsPersistence — round-trip between the Quick-Review-style
 * `AssemblyGroup[]` the drag-and-drop review panel operates on, and
 * the `SceneAssembly[]` shape persisted on the cabinet doc (and read
 * by every downstream consumer — PDF generator, DM parts sync,
 * cost aggregator).
 *
 * The Quick-Review → scene direction was the missing leg: users could
 * drag parts between assemblies in the drawer, but nothing wrote the
 * change back to Firestore, so reloading the scene (or generating the
 * PDF) threw their reorganisation away.
 */
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { AssemblyCategory, AssemblyGroup, PartTreeNode } from '../types/workshop-viewer.types';
import type { SceneAssembly, ScenePart } from '../types/assembly.types';
import type { SceneCabinet } from '../types/scene.types';
import type { AssemblyTypeEnum } from '../constants/assembly.constants';
import { classifyPartRole } from './geometryEngine';

const SCENES_COLLECTION = 'designScenes';
const CABINETS_SUBCOLLECTION = 'cabinets';

// ---------------------------------------------------------------------------
// Category mapping — inverse of sceneAssembliesToGroups's mapType
// ---------------------------------------------------------------------------

const CATEGORY_TO_TYPE: Record<AssemblyCategory, AssemblyTypeEnum> = {
  carcase:         'carcass',
  door:            'door_assembly',
  drawer_box:      'drawer_box',
  drawer_front:    'drawer_front',
  fixed_shelves:   'shelf_pack',
  mobile_shelves:  'shelf_pack',
  hardware:        'hardware_kit',
  cover:           'cover_panel_run',
  other:           'custom',
};

function categoryToAssemblyType(cat: AssemblyCategory): AssemblyTypeEnum {
  return CATEGORY_TO_TYPE[cat] ?? 'custom';
}

// ---------------------------------------------------------------------------
// Pure converter
// ---------------------------------------------------------------------------

/**
 * Convert the review-panel's AssemblyGroup[] (part-tree-node based)
 * into SceneAssembly[] (mesh-node-id based) suitable for persistence.
 *
 * Existing SceneAssembly state is preserved where possible:
 *   - ScenePart[] for unchanged assemblies flows through unchanged,
 *     so material assignments, finishes, and dimensions authored
 *     elsewhere aren't wiped out by a drag-and-drop save.
 *   - `id` is kept stable when the group's id matches an existing
 *     assembly — downstream consumers that key on assembly id
 *     (DesignItemIssues, for example) don't get orphaned.
 *
 * Parts that move between assemblies: their ScenePart.assemblyId
 * is rewritten to the new parent's assembly id. Parts whose
 * mesh no longer appears in ANY group land in a synthetic
 * "Unassigned" assembly at the end, so they're never silently
 * dropped.
 */
export function assemblyGroupsToSceneAssemblies(
  groups: ReadonlyArray<AssemblyGroup>,
  partTree: ReadonlyArray<PartTreeNode>,
  cabinet: Pick<SceneCabinet, 'id' | 'assemblies'>,
): SceneAssembly[] {
  const allTreeNodes = flattenTree(partTree);

  // Map partId → list of mesh names the node covers.
  const partToMeshes = new Map<string, string[]>();
  for (const n of allTreeNodes) partToMeshes.set(n.id, n.meshObjectNames ?? []);

  // Index existing ScenePart[] by mesh name so we can reuse authored
  // material / finish / dimensions when a mesh stays inside its assembly.
  const existingPartByMesh = new Map<string, ScenePart>();
  // Index existing SceneAssembly by id so we can preserve their
  // metadata (boundingBox, jointSpec, assemblySequence) on rewrite.
  const existingAsmById = new Map<string, SceneAssembly>();
  for (const asm of cabinet.assemblies ?? []) {
    existingAsmById.set(asm.id, asm);
    for (const p of asm.parts ?? []) {
      if (p.meshNodeId) existingPartByMesh.set(p.meshNodeId, p);
    }
  }

  const claimedMeshes = new Set<string>();
  const claimedPartIds = new Set<string>();

  const assemblies: SceneAssembly[] = groups.map((group, index) => {
    const meshes: string[] = [];
    const parts: ScenePart[] = [];
    for (const partId of group.partIds) {
      claimedPartIds.add(partId);
      const names = partToMeshes.get(partId) ?? [];
      for (const mesh of names) {
        if (claimedMeshes.has(mesh)) continue; // guard against duplicates
        claimedMeshes.add(mesh);
        meshes.push(mesh);
        const existing = existingPartByMesh.get(mesh);
        if (existing) {
          parts.push({
            ...existing,
            assemblyId: group.id,
            cabinetId: cabinet.id,
          });
        } else {
          parts.push(makeStubPart(cabinet.id, group.id, mesh));
        }
      }
    }

    const existingAsm = existingAsmById.get(group.id);
    return {
      id: group.id,
      cabinetId: cabinet.id,
      assemblyType: categoryToAssemblyType(group.category),
      assemblyCode: existingAsm?.assemblyCode || deriveAssemblyCode(group, index),
      displayName: group.name,
      parts,
      meshNodeIds: meshes,
      boundingBox: existingAsm?.boundingBox ?? emptyBbox(),
      jointSpec: existingAsm?.jointSpec ?? [],
      assemblySequence: existingAsm?.assemblySequence ?? [],
      isComplete: parts.length > 0,
      totalPartCount: parts.length,
      totalArea: existingAsm?.totalArea ?? 0,
      totalCost: parts.reduce((s, p) => s + (p.totalCost ?? 0), 0),
      sequence: existingAsm?.sequence ?? index,
    };
  });

  // Capture meshes that lived in an existing assembly but no group
  // now references — stash in a synthetic "Unassigned" assembly so
  // material data + cost aren't silently deleted.
  const orphanParts: ScenePart[] = [];
  for (const asm of cabinet.assemblies ?? []) {
    for (const p of asm.parts ?? []) {
      if (!p.meshNodeId) continue;
      if (claimedMeshes.has(p.meshNodeId)) continue;
      orphanParts.push({ ...p, assemblyId: 'unassigned', cabinetId: cabinet.id });
      claimedMeshes.add(p.meshNodeId);
    }
  }
  if (orphanParts.length > 0) {
    assemblies.push({
      id: 'unassigned',
      cabinetId: cabinet.id,
      assemblyType: 'custom',
      assemblyCode: 'UNA',
      displayName: 'Unassigned',
      parts: orphanParts,
      meshNodeIds: orphanParts.map(p => p.meshNodeId!).filter(Boolean),
      boundingBox: emptyBbox(),
      jointSpec: [],
      assemblySequence: [],
      isComplete: false,
      totalPartCount: orphanParts.length,
      totalArea: 0,
      totalCost: orphanParts.reduce((s, p) => s + (p.totalCost ?? 0), 0),
      sequence: assemblies.length,
    });
  }

  return assemblies;
}

function flattenTree(nodes: ReadonlyArray<PartTreeNode>): PartTreeNode[] {
  const out: PartTreeNode[] = [];
  for (const n of nodes) {
    out.push(n);
    if (n.children?.length) out.push(...flattenTree(n.children));
  }
  return out;
}

function deriveAssemblyCode(group: AssemblyGroup, index: number): string {
  const prefix = group.category.slice(0, 3).toUpperCase();
  return `${prefix}-${String(index + 1).padStart(2, '0')}`;
}

function emptyBbox(): SceneAssembly['boundingBox'] {
  return {
    min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 },
    center: { x: 0, y: 0, z: 0 }, size: { x: 0, y: 0, z: 0 },
  };
}

function makeStubPart(cabinetId: string, assemblyId: string, mesh: string): ScenePart {
  return {
    id: `${cabinetId}-${assemblyId}-${mesh}`,
    assemblyId,
    cabinetId,
    partCode: mesh.replace(/\s+/g, '_').slice(0, 40),
    partName: mesh,
    partCategory: 'panel',
    role: classifyPartRole(mesh),
    inventoryItemId: '',
    inventoryItemName: '',
    meshNodeId: mesh,
    quantity: 1,
    unit: 'pcs',
    unitCost: 0,
    totalCost: 0,
    currency: 'UGX',
    materialDescription: '',
  };
}

// ---------------------------------------------------------------------------
// Firestore writer
// ---------------------------------------------------------------------------

/**
 * Persist the reorganised assemblies onto the cabinet doc. Called
 * when the user hits "Confirm" in the scene's Assembly Review
 * drawer. Rejects locked cabinets — a cabinet that's been committed
 * to production shouldn't have its structural breakdown rewritten.
 */
export async function saveCabinetAssemblies(
  sceneId: string,
  cabinetId: string,
  assemblies: SceneAssembly[],
): Promise<void> {
  const cabRef = doc(db, SCENES_COLLECTION, sceneId, CABINETS_SUBCOLLECTION, cabinetId);
  const snap = await getDoc(cabRef);
  if (!snap.exists()) throw new Error(`Cabinet ${cabinetId} not found`);
  const cabinet = snap.data() as SceneCabinet;
  if (cabinet.isLocked) {
    throw new Error(
      'Cannot rewrite assemblies on a locked cabinet — unlock before confirming.',
    );
  }

  // Stamp a timestamp per assembly so downstream readers can tell
  // which groups the user touched this session.
  const now = Timestamp.now();
  const stamped = assemblies.map(a => ({
    ...a,
    // Legacy SceneAssembly doesn't declare updatedAt; cast-spread is
    // safer than extending the interface for a diagnostic field.
    updatedAt: now as unknown,
  }));

  await updateDoc(cabRef, {
    assemblies: stamped,
    updatedAt: serverTimestamp(),
  });
}
