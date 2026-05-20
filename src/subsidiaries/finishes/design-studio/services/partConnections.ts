/**
 * partConnections — resolve the structural neighbours of a selected
 * ScenePart within its cabinet.
 *
 * Two signals feed in, both pure (no Three.js / Firestore reads):
 *
 *   1. Same-assembly siblings — parts that share `assemblyId` with the
 *      selected one. These are structurally connected by definition:
 *      a drawer box's 4 sides + bottom belong to one drawer_box, a
 *      carcass's 6 panels belong to one carcass, etc.
 *
 *   2. Cross-assembly kin — parts in other assemblies of the same
 *      cabinet that connect via `jointSpec` or shared boring specs
 *      (dowels / cam-locks between a drawer front and a drawer box).
 *
 * The helper also exposes a small summary (counts, by-category breakdown)
 * so the Part Detail panel can render "3 siblings in this drawer_box · 2
 * parts joined" without walking the data twice.
 */
import type { ScenePart, SceneAssembly } from '../types/assembly.types';
import type { GeomBox } from './partGeometryClassifier';

/** Hardware drill-through reference lifted out of a part's boringSpec —
 *  a hinge cup, drawer runner, cam-lock receptacle, etc. May resolve
 *  to a Materials-library row (InventoryResolver) or stand alone. */
export interface HardwareTarget {
  /** Stable key for React keys — either the inventoryItemId or a
   *  synthesised "boring-N" slug. */
  key: string;
  /** Materials library id when known — used by the PartDetailPanel
   *  to render a clickable inventory ref. */
  inventoryItemId?: string;
  /** Short human description ("35mm hinge cup"), pulled from the
   *  boring spec's own text fields. */
  label: string;
  /** Quantity of the hardware item drilled for (e.g. 2 dowels). */
  quantity?: number;
  /** Source hint: 'boring' means the reference came from boringSpec. */
  source: 'boring';
}

export interface PartConnectionsResult {
  /** Other parts in the same assembly as the selected part. */
  sameAssembly: ScenePart[];
  /** Parts in OTHER assemblies that share a joint / boring spec /
   *  hardware interface with the selected part. */
  joined: ScenePart[];
  /** Parts whose mesh directly neighbours the selected part's mesh
   *  by name pattern — e.g. `side_L` + `side_L_cover`. Cheap
   *  heuristic used when the model has no jointSpec data yet. */
  neighbouringByName: ScenePart[];
  /** Parts whose bbox touches or overlaps the selected part's bbox
   *  within tolerance. Populated only when the caller supplies
   *  `bboxByMesh` — typically from the parsedModel. Catches the
   *  cases the name + joint heuristics miss: a drawer bottom
   *  sitting inside a drawer box with no name family overlap, a
   *  cover panel flush against a carcase with no jointSpec. */
  touching: ScenePart[];
  /** Hardware items the selected part's boringSpec drills FOR —
   *  distinct from "joined parts" because hardware is often an
   *  inventory reference, not a ScenePart. */
  hardwareTargets: HardwareTarget[];
  /** Parent assembly of the selected part, if resolvable. */
  parentAssembly?: SceneAssembly;
  /** Aggregate counts for the Part Detail header. */
  summary: {
    sameAssembly: number;
    joined: number;
    neighbouringByName: number;
    touching: number;
    hardwareTargets: number;
    /** Total unique connected parts across every bucket. */
    total: number;
  };
}

export interface FindConnectionsOptions {
  /** Per-mesh bbox lookup — feed from parsedModel when available. */
  bboxByMesh?: ReadonlyMap<string, GeomBox>;
  /** Tolerance for "touching" (mm). Default 5mm. */
  touchToleranceMm?: number;
}

/**
 * Walk the cabinet's assemblies + parts, returning the structural
 * neighbours of `selected`. Stable sort by partName / partCode so the
 * UI list order doesn't flicker between re-renders.
 */
export function findPartConnections(
  selected: ScenePart,
  cabinet: { assemblies?: SceneAssembly[] },
  opts: FindConnectionsOptions = {},
): PartConnectionsResult {
  const assemblies = cabinet.assemblies ?? [];
  const allParts: ScenePart[] = [];
  let parentAssembly: SceneAssembly | undefined;

  for (const asm of assemblies) {
    if (asm.id === selected.assemblyId) parentAssembly = asm;
    for (const p of asm.parts ?? []) {
      if (p.id !== selected.id) allParts.push(p);
    }
  }

  // ── Same-assembly siblings ────────────────────────────────────────
  const sameAssembly = allParts.filter(p => p.assemblyId === selected.assemblyId);

  // ── Joined — parts in OTHER assemblies that share a joint / boring ──
  const joined: ScenePart[] = [];
  const selectedMesh = selected.meshNodeId;
  const selectedBoringMeshRefs = collectBoringMeshRefs(selected);
  for (const p of allParts) {
    if (p.assemblyId === selected.assemblyId) continue;
    // A. jointSpec on the parent assembly references the other part's mesh.
    if (parentAssembly?.jointSpec?.some(j => referencesMesh(j, p.meshNodeId))) {
      joined.push(p);
      continue;
    }
    // B. boring on the selected part drills into p's mesh (or vice versa).
    if (selectedBoringMeshRefs.has(p.meshNodeId ?? '')) {
      joined.push(p);
      continue;
    }
    const otherBoring = collectBoringMeshRefs(p);
    if (selectedMesh && otherBoring.has(selectedMesh)) {
      joined.push(p);
      continue;
    }
  }

  // ── Neighbouring by mesh name — cheap fallback for models without
  // explicit jointSpec / boring data. Matches parts whose mesh name
  // shares a base token with the selected one ("side_L" + "side_L_cover",
  // "drawer_front_01" + "drawer_bottom_01"). Dedupes against joined.
  const joinedIds = new Set(joined.map(p => p.id));
  const neighbouringByName = selectedMesh
    ? allParts
        .filter(p =>
          !joinedIds.has(p.id)
          && p.assemblyId !== selected.assemblyId
          && sharesMeshBaseToken(selectedMesh, p.meshNodeId),
        )
    : [];

  // ── Touching — spatial proximity from parsedModel bbox data. Skipped
  //    when no bbox map was supplied (panel opened before the GLB
  //    finished loading). Dedupes against every earlier bucket.
  const touching: ScenePart[] = [];
  const bboxMap = opts.bboxByMesh;
  const selectedBbox = selectedMesh ? bboxMap?.get(selectedMesh) : undefined;
  const tol = opts.touchToleranceMm ?? 5;
  if (bboxMap && selectedBbox) {
    const alreadyCounted = new Set<string>([
      ...sameAssembly.map(p => p.id),
      ...joined.map(p => p.id),
      ...neighbouringByName.map(p => p.id),
    ]);
    for (const p of allParts) {
      if (alreadyCounted.has(p.id)) continue;
      if (!p.meshNodeId) continue;
      const b = bboxMap.get(p.meshNodeId);
      if (!b) continue;
      if (boxesAdjacent(selectedBbox, b, tol)) {
        touching.push(p);
      }
    }
  }

  // ── Hardware targets — inventoryItem references lifted out of the
  //    selected part's boringSpec. Distinct from "joined parts" because
  //    hardware is often an inventory SKU, not a ScenePart (e.g. "this
  //    hole receives a 35mm Blum hinge cup"). Caller can later resolve
  //    inventoryItemId → full spec via createInventoryResolver.
  const hardwareTargets = collectHardwareTargets(selected);

  const byName = (a: ScenePart, b: ScenePart) =>
    (a.partName || a.partCode || a.id).localeCompare(b.partName || b.partCode || b.id);

  sameAssembly.sort(byName);
  joined.sort(byName);
  neighbouringByName.sort(byName);
  touching.sort(byName);

  const total =
    sameAssembly.length + joined.length + neighbouringByName.length
    + touching.length + hardwareTargets.length;
  return {
    sameAssembly,
    joined,
    neighbouringByName,
    touching,
    hardwareTargets,
    parentAssembly,
    summary: {
      sameAssembly: sameAssembly.length,
      joined: joined.length,
      neighbouringByName: neighbouringByName.length,
      touching: touching.length,
      hardwareTargets: hardwareTargets.length,
      total,
    },
  };
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

function referencesMesh(joint: unknown, meshNodeId?: string): boolean {
  if (!meshNodeId || !joint || typeof joint !== 'object') return false;
  const j = joint as Record<string, unknown>;
  const meshes = [j.meshA, j.meshB, j.mesh, ...(Array.isArray(j.meshNodeIds) ? j.meshNodeIds : [])];
  return meshes.some(m => typeof m === 'string' && m === meshNodeId);
}

function collectBoringMeshRefs(part: ScenePart): Set<string> {
  const refs = new Set<string>();
  const spec = part.boringSpec;
  if (!spec) return refs;
  // Legacy data may carry mesh-id refs as top-level keys; read them
  // defensively through a loose cast since the canonical CNCBoringSpec
  // doesn't declare them, but old Firestore docs may still have them.
  const loose = spec as unknown as Record<string, unknown>;
  for (const key of ['intoMeshId', 'targetMeshId', 'throughMesh']) {
    const v = loose[key];
    if (typeof v === 'string' && v) refs.add(v);
  }
  // Canonical targets may carry meshId for hardware-mounted-on references
  if (spec.targets) {
    for (const t of spec.targets) {
      const meshId = (t as unknown as { meshId?: string }).meshId;
      if (typeof meshId === 'string') refs.add(meshId);
    }
  }
  return refs;
}

/**
 * Very lightweight mesh-name matching: strip trailing suffixes that
 * typically denote a variant ("_L", "_R", "_cover", numeric suffix)
 * and compare stems.
 */
export function sharesMeshBaseToken(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  // Loop until stable — compound suffixes like "_L_cover" or "_front_02"
  // need multiple passes to strip down to the base stem.
  const stem = (s: string) => {
    let out = s.toLowerCase();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const next = out
        .replace(/[_-]+(l|r|left|right|top|bottom|front|back|cover|inner|outer)$/i, '')
        .replace(/[_-]+\d+$/, '');
      if (next === out) break;
      out = next;
    }
    return out.trim();
  };
  const sa = stem(a);
  const sb = stem(b);
  return sa.length >= 3 && sa === sb;
}

// ---------------------------------------------------------------------------
// Bbox adjacency — are two boxes "touching" within tolerance?
//
// Definition: the boxes overlap on at least two axes and are within
// `tol` mm of each other on the third. Two flush-face panels
// (drawer side + drawer bottom, door + stile, cabinet side + back)
// satisfy this; two floating unrelated boxes don't.
//
// Exported so other callers (the alignment system, future rendering
// improvements) can reuse the same definition.
// ---------------------------------------------------------------------------

export function boxesAdjacent(a: GeomBox, b: GeomBox, tol = 5): boolean {
  const overlaps = (aMin: number, aMax: number, bMin: number, bMax: number) =>
    aMin <= bMax + tol && bMin <= aMax + tol;
  const gap = (aMin: number, aMax: number, bMin: number, bMax: number) => {
    if (aMax < bMin) return bMin - aMax;
    if (bMax < aMin) return aMin - bMax;
    return 0; // overlapping
  };

  const oX = overlaps(a.min.x, a.max.x, b.min.x, b.max.x);
  const oY = overlaps(a.min.y, a.max.y, b.min.y, b.max.y);
  const oZ = overlaps(a.min.z, a.max.z, b.min.z, b.max.z);
  const axesOverlapping = [oX, oY, oZ].filter(Boolean).length;
  // All three axes "overlap" = boxes actually intersect or are within
  // tolerance on every axis — definitely touching.
  if (axesOverlapping === 3) return true;
  // Two overlapping + tight gap on the third = face-to-face adjacency.
  if (axesOverlapping === 2) {
    const gX = gap(a.min.x, a.max.x, b.min.x, b.max.x);
    const gY = gap(a.min.y, a.max.y, b.min.y, b.max.y);
    const gZ = gap(a.min.z, a.max.z, b.min.z, b.max.z);
    // Only one axis has a non-zero gap here (the one not overlapping).
    return Math.max(gX, gY, gZ) <= tol;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Hardware-target extraction from boringSpec
//
// boringSpec is loose-typed in the ScenePart contract (cast via
// `unknown`) so we look at a few well-known shapes:
//   - `targets: [{ inventoryItemId, label, quantity }]`
//   - `hardware: [...]` (older variant)
//   - `holes: [{ hardwareId, description, quantity }]`
// Any inventory-like reference gets lifted into the return list.
// Mesh-id refs stay in `joined` (handled upstream).
// ---------------------------------------------------------------------------

function collectHardwareTargets(part: ScenePart): HardwareTarget[] {
  const spec = part.boringSpec;
  if (!spec) return [];
  const out: HardwareTarget[] = [];

  // Canonical CNCBoringSpec stores targets directly. Skip entries
  // that are purely mesh-refs (no inventoryItemId and no label) — those
  // belong in the `joined` set, not hardware targets.
  if (spec.targets) {
    for (let i = 0; i < spec.targets.length; i++) {
      const t = spec.targets[i];
      if (!t.inventoryItemId && !t.label) continue; // mesh-only ref
      out.push({
        key: t.inventoryItemId ?? `targets-${i + 1}`,
        inventoryItemId: t.inventoryItemId || undefined,
        label: t.label ?? t.inventoryItemId ?? `targets-${i + 1}`,
        quantity: t.quantity,
        source: 'boring',
      });
    }
  }

  // Legacy data may still carry `hardware` or non-canonical `holes` arrays.
  // Handle defensively through a loose cast for the transition period.
  const loose = spec as unknown as Record<string, unknown>;
  const visit = (entries: unknown, bucket: string) => {
    if (!Array.isArray(entries)) return;
    for (let i = 0; i < entries.length; i++) {
      const raw = entries[i];
      if (!raw || typeof raw !== 'object') continue;
      const r = raw as Record<string, unknown>;
      const inventoryItemId =
        (typeof r.inventoryItemId === 'string' && r.inventoryItemId)
        || (typeof r.hardwareId === 'string' && r.hardwareId)
        || (typeof r.itemId === 'string' && r.itemId)
        || undefined;
      const hasMeshRef = typeof r.meshId === 'string'
        || typeof r.meshNodeId === 'string';
      if (!inventoryItemId && hasMeshRef) continue;

      const label =
        (typeof r.label === 'string' && r.label)
        || (typeof r.description === 'string' && r.description)
        || (typeof r.name === 'string' && r.name)
        || (typeof r.type === 'string' && r.type)
        || inventoryItemId
        || `${bucket}-${i + 1}`;
      const quantity = typeof r.quantity === 'number' ? r.quantity
        : typeof r.qty === 'number' ? r.qty
        : undefined;
      out.push({
        key: inventoryItemId ?? `${bucket}-${i + 1}`,
        inventoryItemId: inventoryItemId || undefined,
        label,
        quantity,
        source: 'boring',
      });
    }
  };

  visit(loose.hardware, 'hardware');
  // Legacy `holes` array may carry inventory refs alongside position data.
  // Only visit through the legacy path — canonical holes don't have itemId.
  visit(loose.holes, 'holes');

  // Dedupe by inventoryItemId when present (summing quantities).
  const byId = new Map<string, HardwareTarget>();
  const anon: HardwareTarget[] = [];
  for (const t of out) {
    if (t.inventoryItemId) {
      const prev = byId.get(t.inventoryItemId);
      if (prev) {
        prev.quantity = (prev.quantity ?? 0) + (t.quantity ?? 0) || undefined;
      } else {
        byId.set(t.inventoryItemId, { ...t });
      }
    } else {
      anon.push(t);
    }
  }
  return [...byId.values(), ...anon];
}
