/**
 * groupEngine — pure-TS math for multi-cabinet groups.
 *
 * The Cabinet Alignment System treats a group of cabinets as a rigid
 * body: drag / rotate / nudge apply uniformly to every member so runs
 * of cabinets (e.g. a 5-cabinet kitchen base row) can be repositioned
 * as a unit.
 *
 * This module is pure — no React, no Three.js, no Firebase. Inputs are
 * plain `{x, y, z}` / `{x, z}` objects; outputs are arrays the caller
 * can pass straight into `moveCabinet`. Tested in isolation.
 */

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface XZ {
  x: number;
  z: number;
}

export interface GroupMember {
  id: string;
  position: Vec3Like;
  /** Rotation around Y in degrees. Preserved verbatim by `applyDelta`. */
  rotation: number;
}

/**
 * Arithmetic centroid of a group's positions in XZ. Y is averaged too
 * for symmetry but the alignment system is mostly floor-plan-focused.
 */
export function groupCentroid(members: GroupMember[]): Vec3Like {
  if (members.length === 0) return { x: 0, y: 0, z: 0 };
  let sx = 0, sy = 0, sz = 0;
  for (const m of members) {
    sx += m.position.x;
    sy += m.position.y;
    sz += m.position.z;
  }
  const n = members.length;
  return { x: sx / n, y: sy / n, z: sz / n };
}

/**
 * Translate every member by the same delta. Inter-member offsets are
 * preserved — this is the operation behind "drag one cabinet of a
 * group, they all move together".
 */
export function applyDelta(
  members: GroupMember[],
  delta: Vec3Like,
): GroupMember[] {
  return members.map(m => ({
    ...m,
    position: {
      x: m.position.x + delta.x,
      y: m.position.y + delta.y,
      z: m.position.z + delta.z,
    },
  }));
}

/**
 * Rotate every member around a pivot (typically the group centroid)
 * by `angleDeg` on the Y axis. Preserves inter-member geometry.
 *
 * Each member's own `rotation` also adjusts by the same delta so
 * "rotate group 45°" turns every cabinet by 45° *relative to its
 * current facing*.
 */
export function rotateAroundPivot(
  members: GroupMember[],
  pivot: Vec3Like,
  angleDeg: number,
): GroupMember[] {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return members.map(m => {
    const dx = m.position.x - pivot.x;
    const dz = m.position.z - pivot.z;
    return {
      ...m,
      position: {
        x: pivot.x + dx * cos + dz * sin,
        y: m.position.y,
        z: pivot.z - dx * sin + dz * cos,
      },
      rotation: m.rotation + angleDeg,
    };
  });
}

/**
 * Compute the 2D convex hull of a set of XZ points using the gift-
 * wrapping (Jarvis march) algorithm. Cheap for small N (< 100) which
 * covers realistic group sizes. Returned vertices are in counter-
 * clockwise order, starting from the point with the smallest X (ties
 * broken by smallest Z).
 *
 * Degenerate cases:
 *   - 0 points → []
 *   - 1 point → [p]
 *   - 2 points → [p0, p1]
 *   - N collinear points → [endpointA, endpointB]
 */
export function convexHullXZ(points: XZ[]): XZ[] {
  const n = points.length;
  if (n === 0) return [];
  if (n === 1) return [{ x: points[0].x, z: points[0].z }];

  // Find the leftmost-bottom point.
  let start = 0;
  for (let i = 1; i < n; i++) {
    if (
      points[i].x < points[start].x
      || (points[i].x === points[start].x && points[i].z < points[start].z)
    ) {
      start = i;
    }
  }

  const hull: XZ[] = [];
  let current = start;
  do {
    hull.push({ x: points[current].x, z: points[current].z });
    let next = (current + 1) % n;
    for (let i = 0; i < n; i++) {
      if (i === current) continue;
      // Cross product of (points[next] - points[current]) x (points[i] - points[current]).
      const cross =
        (points[next].x - points[current].x) * (points[i].z - points[current].z)
        - (points[next].z - points[current].z) * (points[i].x - points[current].x);
      if (cross < 0) {
        next = i;
      } else if (cross === 0) {
        // Collinear — prefer the farther point so we don't include
        // interior-segment points as hull vertices.
        const dNext = (points[next].x - points[current].x) ** 2 + (points[next].z - points[current].z) ** 2;
        const dI    = (points[i].x    - points[current].x) ** 2 + (points[i].z    - points[current].z) ** 2;
        if (dI > dNext) next = i;
      }
    }
    current = next;
    if (hull.length > n + 1) break;  // guard against infinite loops on pathological input
  } while (current !== start);

  return hull;
}

/**
 * Convenience: expand a set of cabinets (given centre + footprint) into
 * their four corner points, then return the convex hull of the union.
 * This is what `GroupOutline` should render as a dashed line.
 */
export interface GroupCornerInput {
  x: number;
  z: number;
  width: number;
  depth: number;
  rotationDeg?: number;
}

export function groupBoundingHull(cabinets: GroupCornerInput[]): XZ[] {
  const points: XZ[] = [];
  for (const c of cabinets) {
    const halfW = c.width / 2;
    const halfD = c.depth / 2;
    // Four corners in cabinet-local coords (centre at origin).
    const local: XZ[] = [
      { x: -halfW, z: -halfD },
      { x:  halfW, z: -halfD },
      { x:  halfW, z:  halfD },
      { x: -halfW, z:  halfD },
    ];
    const rot = ((c.rotationDeg ?? 0) * Math.PI) / 180;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    for (const p of local) {
      points.push({
        x: c.x + p.x * cos + p.z * sin,
        z: c.z - p.x * sin + p.z * cos,
      });
    }
  }
  return convexHullXZ(points);
}
