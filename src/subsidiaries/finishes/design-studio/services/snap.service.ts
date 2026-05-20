/**
 * Snap Service — Face-to-face snap math for 3D cabinet drag.
 *
 * Pure functions: given a dragged cabinet's intended XZ position and the
 * other cabinets in the scene, decide whether (and how) to snap its face
 * flush to a neighbour's face. Cabinets are modelled as axis-aligned boxes
 * on the floor — a cabinet occupies a rectangle `[x - w/2, x + w/2]` ×
 * `[z - d/2, z + d/2]` where w = configuration.width, d = configuration.depth.
 * The anchor is the cabinet's base-centre on the XZ plane.
 *
 * No Three.js imports here so this is easy to unit-test.
 */
import type { SceneCabinet } from '../types/scene.types';
import {
  SNAP_THRESHOLD_MM,
  ANCHOR_THRESHOLD_MM,
  DEFAULT_CABINET_WIDTH_MM,
  DEFAULT_CABINET_DEPTH_MM,
} from '../constants/scene.constants';

/** Axis-aligned bounding box for a cabinet placed in the scene.
 *  Position is the base-centre of the cabinet (matching group.position in
 *  the viewport after subset-centering) — i.e. the cabinet occupies
 *  `[x-w/2, x+w/2] × [y, y+h] × [z-d/2, z+d/2]`. */
export interface CabinetBox {
  id: string;
  position: { x: number; y: number; z: number };
  width: number;
  depth: number;
  height: number;
}

export interface XZ {
  x: number;
  z: number;
}

export interface SnapResult {
  position: XZ;
  /** Which cabinet (if any) we snapped to. */
  snappedToId: string | null;
  /** Which face of `snappedToId` we are now flush against. */
  edge: 'left' | 'right' | 'front' | 'back' | null;
}

/**
 * Resolve a dragged cabinet's candidate position against every neighbour so
 * no two cabinets overlap in 3D. Overlap is defined by full AABB intersection
 * — a wall cabinet sitting *above* a base cabinet (Y offset beyond the base's
 * top) is allowed to share XZ footprint, because the base cabinet is not
 * actually in the way at that height.
 *
 * When an overlap is found the dragged cabinet is pushed along the axis of
 * least penetration. We iterate a few times so cascades (pushed out of A,
 * now overlapping B) settle. Finally the Y position is clamped to ≥ 0 so
 * cabinets can never sit below the floor.
 */
export function resolveCollisions(
  dragged: CabinetBox,
  neighbours: CabinetBox[],
  maxIter = 4,
): { x: number; y: number; z: number } {
  const dw = dragged.width;
  const dd = dragged.depth;
  const dh = dragged.height;
  const pos = { ...dragged.position };

  for (let iter = 0; iter < maxIter; iter++) {
    let pushedAny = false;
    for (const nb of neighbours) {
      if (nb.id === dragged.id) continue;
      const nw = nb.width, nd = nb.depth, nh = nb.height;
      const nx = nb.position.x, ny = nb.position.y, nz = nb.position.z;

      // Per-axis overlap magnitudes — positive means overlapping.
      const ox = Math.min(pos.x + dw / 2, nx + nw / 2) - Math.max(pos.x - dw / 2, nx - nw / 2);
      const oz = Math.min(pos.z + dd / 2, nz + nd / 2) - Math.max(pos.z - dd / 2, nz - nd / 2);
      const oy = Math.min(pos.y + dh,        ny + nh    ) - Math.max(pos.y,             ny           );

      if (ox <= 0 || oy <= 0 || oz <= 0) continue;   // no 3D overlap — OK

      // Push along the axis with the smallest overlap (minimum translation).
      // Ties broken in XZ-first order (users work mostly on the floor plan;
      // only resort to Y push when it's the cheapest resolution).
      if (ox <= oz && ox <= oy) {
        pos.x += pos.x < nx ? -ox : ox;
      } else if (oz <= oy) {
        pos.z += pos.z < nz ? -oz : oz;
      } else {
        pos.y += pos.y < ny ? -oy : oy;
      }
      pushedAny = true;
    }
    if (!pushedAny) break;
  }

  // Hard floor — no cabinet ever sinks below the ground plane.
  if (pos.y < 0) pos.y = 0;

  return pos;
}

/** Extract the effective width/depth for a cabinet. Falls back to 600×560mm
 *  when `configuration` is missing values — same fallback SceneLayoutEditor
 *  uses so the two editors agree on cabinet footprints. */
export function cabinetFootprint(cab: SceneCabinet): { width: number; depth: number } {
  const config = (cab.configuration ?? {}) as Record<string, unknown>;
  const width = typeof config.width === 'number' && config.width > 0
    ? config.width : DEFAULT_CABINET_WIDTH_MM;
  const depth = typeof config.depth === 'number' && config.depth > 0
    ? config.depth : DEFAULT_CABINET_DEPTH_MM;
  return { width, depth };
}

/**
 * Compute a snapped XZ position for a dragged cabinet by finding the nearest
 * alignment opportunity on each axis *independently*.
 *
 * For every proximate neighbour we enumerate 5 candidate X positions and 5
 * candidate Z positions. Each candidate expresses a different kind of
 * alignment:
 *
 *   • **flush-east** — dragged's left face touches neighbour's right face
 *   • **flush-west** — dragged's right face touches neighbour's left face
 *   • **coplanar-left** — both cabinets' left faces share the same X
 *   • **coplanar-right** — both cabinets' right faces share the same X
 *   • **center-aligned** — both cabinets share the same X centre
 *
 * (Same five along Z, using front/back faces.) The smallest delta under
 * `threshold` wins per axis, and the two axes are independent — so one can
 * snap while the other follows the cursor. Corner-to-corner alignment
 * emerges naturally when both axes snap at the same time.
 *
 * This replaces the previous flush-or-corner logic which required
 * perpendicular overlap (for face) or simultaneous X+Z proximity (for
 * corner). Users hit "neither condition true" too often, so snap felt dead.
 *
 * Only X and Z are snapped. Y is preserved.
 */
export function computeFaceSnap(
  dragged: SceneCabinet,
  neighbours: SceneCabinet[],
  dragPos: XZ,
  threshold: number = SNAP_THRESHOLD_MM,
  anchorThreshold: number = ANCHOR_THRESHOLD_MM,
): SnapResult {
  const { width: dw, depth: dd } = cabinetFootprint(dragged);

  // Per-axis "best candidate so far" tracker. `delta: Infinity` = nothing yet.
  let bestX: { delta: number; value: number; sourceId: string | null } =
    { delta: Infinity, value: dragPos.x, sourceId: null };
  let bestZ: { delta: number; value: number; sourceId: string | null } =
    { delta: Infinity, value: dragPos.z, sourceId: null };

  // Proximity gate: only consider neighbours within 3× threshold of the
  // dragged bbox. This keeps far cabinets from tugging the dragged one
  // toward alignment with something on the other side of the room.
  const proximityRange = threshold * 3;

  for (const nb of neighbours) {
    if (nb.id === dragged.id) continue;
    const nbPos = nb.position;
    if (!nbPos || typeof nbPos.x !== 'number' || typeof nbPos.z !== 'number') continue;
    const { width: nw, depth: nd } = cabinetFootprint(nb);

    // Gap (mm) between the dragged cabinet's bbox and this neighbour's bbox
    // per axis — 0 if they already overlap, positive if separated.
    const gapX = Math.max(0, Math.abs(dragPos.x - nbPos.x) - (dw + nw) / 2);
    const gapZ = Math.max(0, Math.abs(dragPos.z - nbPos.z) - (dd + nd) / 2);
    if (gapX > proximityRange && gapZ > proximityRange) continue;

    // Five candidate X positions the dragged cabinet could align to, via nb.
    const xCandidates = [
      nbPos.x,                         // center-aligned
      nbPos.x - nw / 2 + dw / 2,       // coplanar-left (shared left face)
      nbPos.x + nw / 2 - dw / 2,       // coplanar-right (shared right face)
      nbPos.x + nw / 2 + dw / 2,       // flush-east (dragged's left on nb's right)
      nbPos.x - nw / 2 - dw / 2,       // flush-west (dragged's right on nb's left)
    ];
    for (const cx of xCandidates) {
      const d = Math.abs(cx - dragPos.x);
      if (d < threshold && d < bestX.delta) {
        bestX = { delta: d, value: cx, sourceId: nb.id };
      }
    }

    // Same five candidates for Z.
    const zCandidates = [
      nbPos.z,
      nbPos.z - nd / 2 + dd / 2,
      nbPos.z + nd / 2 - dd / 2,
      nbPos.z + nd / 2 + dd / 2,
      nbPos.z - nd / 2 - dd / 2,
    ];
    for (const cz of zCandidates) {
      const d = Math.abs(cz - dragPos.z);
      if (d < threshold && d < bestZ.delta) {
        bestZ = { delta: d, value: cz, sourceId: nb.id };
      }
    }
  }

  // Face-snapped position — may be unchanged on one or both axes.
  const faceSnappedX = bestX.sourceId ? bestX.value : dragPos.x;
  const faceSnappedZ = bestZ.sourceId ? bestZ.value : dragPos.z;

  // ── Anchor-to-anchor secondary pass ─────────────────────────────────
  // If exactly one axis snapped (the cabinet is flush on, say, its side
  // face), check whether the orthogonal axis can align to the same
  // neighbour's *corner* along the matched face plane. For two base
  // cabinets butted side-to-side, this is what produces "front edges
  // line up exactly" behaviour once you drag close enough.
  //
  // We evaluate 4 corner anchor pairs (front-left / front-right /
  // back-left / back-right) and pull the smallest delta under
  // `anchorThreshold`. The snapped axis stays fixed; only the free
  // axis translates.
  let finalX = faceSnappedX;
  let finalZ = faceSnappedZ;
  const xSnapped = !!bestX.sourceId;
  const zSnapped = !!bestZ.sourceId;

  if (xSnapped !== zSnapped) {
    // Pick the neighbour that drove the face snap — the anchor pass
    // only operates against that cabinet.
    const anchorSourceId = xSnapped ? bestX.sourceId : bestZ.sourceId;
    const anchorNb = neighbours.find(n => n.id === anchorSourceId);
    if (anchorNb) {
      const { width: nw, depth: nd } = cabinetFootprint(anchorNb);
      const nx = anchorNb.position?.x ?? 0;
      const nz = anchorNb.position?.z ?? 0;

      // Dragged corners along the free axis; neighbour corners along
      // the same axis. Pick the pair with the smallest delta.
      if (xSnapped) {
        // X is locked — look for Z-axis corner alignment.
        const draggedCorners = [faceSnappedZ - dd / 2, faceSnappedZ + dd / 2];
        const nbCorners = [nz - nd / 2, nz + nd / 2];
        let bestDelta = Infinity;
        let bestZAdjust = 0;
        for (const dc of draggedCorners) {
          for (const nc of nbCorners) {
            const d = nc - dc;
            if (Math.abs(d) < Math.abs(bestDelta)) {
              bestDelta = d;
              bestZAdjust = d;
            }
          }
        }
        if (Math.abs(bestDelta) < anchorThreshold) {
          finalZ = faceSnappedZ + bestZAdjust;
        }
      } else {
        // Z is locked — look for X-axis corner alignment.
        const draggedCorners = [faceSnappedX - dw / 2, faceSnappedX + dw / 2];
        const nbCorners = [nx - nw / 2, nx + nw / 2];
        let bestDelta = Infinity;
        let bestXAdjust = 0;
        for (const dc of draggedCorners) {
          for (const nc of nbCorners) {
            const d = nc - dc;
            if (Math.abs(d) < Math.abs(bestDelta)) {
              bestDelta = d;
              bestXAdjust = d;
            }
          }
        }
        if (Math.abs(bestDelta) < anchorThreshold) {
          finalX = faceSnappedX + bestXAdjust;
        }
      }
    }
  }

  return {
    position: { x: finalX, z: finalZ },
    // Attribute the snap to whichever neighbour caused *an* axis to snap.
    // When both axes snapped against the same neighbour, that's the
    // corner/line alignment case and the attribution is unambiguous.
    snappedToId: bestX.sourceId ?? bestZ.sourceId,
    edge: null,
  };
}
