/**
 * Silhouette Edge Extraction
 *
 * PolyBoard exports box-shaped panels as 12 triangular faces (2 per rectangular face × 6).
 * Without this, every triangle diagonal renders as a visible line.
 *
 * Algorithm:
 * 1. Compute face normals via cross product
 * 2. Build edge→normals map (edge = sorted vertex pair)
 * 3. Filter: boundary edges (1 face) → KEEP, coplanar internals (dot > 0.999) → REMOVE,
 *    different-normal edges (crease) → KEEP
 */

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface SilhouetteEdge {
  a: Vec3;
  b: Vec3;
  partName: string;
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (len < 1e-10) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function edgeKey(aIdx: number, bIdx: number): string {
  return aIdx < bIdx ? `${aIdx}-${bIdx}` : `${bIdx}-${aIdx}`;
}

function getVertex(vertices: Float32Array, index: number): Vec3 {
  return {
    x: vertices[index * 3],
    y: vertices[index * 3 + 1],
    z: vertices[index * 3 + 2],
  };
}

/**
 * Extract silhouette edges from mesh geometry.
 * Returns edges that form the visible outline of each panel (box edges, crease edges).
 * Removes internal coplanar edges (triangle diagonals within flat faces).
 */
export function extractSilhouetteEdges(
  vertices: Float32Array,
  faces: Uint16Array | Uint32Array,
  partName: string,
  /** Dot product threshold for coplanar detection (higher = stricter, keeps fewer edges). Default 0.95 (~18°). Use 0.5 (~60°) for organic meshes. */
  coplanarThreshold = 0.95,
): SilhouetteEdge[] {
  const faceCount = faces.length / 3;

  // Step 1: Compute face normals
  const faceNormals: Vec3[] = [];
  for (let i = 0; i < faceCount; i++) {
    const v0 = getVertex(vertices, faces[i * 3]);
    const v1 = getVertex(vertices, faces[i * 3 + 1]);
    const v2 = getVertex(vertices, faces[i * 3 + 2]);
    const edge1 = sub(v1, v0);
    const edge2 = sub(v2, v0);
    faceNormals.push(normalize(cross(edge1, edge2)));
  }

  // Step 2: Build edge → face normals map
  const edgeNormals = new Map<string, Vec3[]>();
  const edgeVertices = new Map<string, [number, number]>();

  for (let i = 0; i < faceCount; i++) {
    const a = faces[i * 3];
    const b = faces[i * 3 + 1];
    const c = faces[i * 3 + 2];
    const normal = faceNormals[i];

    for (const [v1, v2] of [[a, b], [b, c], [c, a]] as [number, number][]) {
      const key = edgeKey(v1, v2);
      if (!edgeNormals.has(key)) {
        edgeNormals.set(key, []);
        edgeVertices.set(key, [v1, v2]);
      }
      edgeNormals.get(key)!.push(normal);
    }
  }

  // Step 3: Filter edges
  const silhouetteEdges: SilhouetteEdge[] = [];

  for (const [key, normals] of edgeNormals) {
    const [v1Idx, v2Idx] = edgeVertices.get(key)!;
    let keep = false;

    if (normals.length === 1) {
      // Boundary edge (1 face) → always keep
      keep = true;
    } else if (normals.length === 2) {
      // Shared by 2 faces — check if coplanar
      const d = Math.abs(dot(normals[0], normals[1]));
      if (d < coplanarThreshold) {
        // Different normals beyond threshold → crease/silhouette edge
        keep = true;
      } else if (d < 0.999) {
        // Between 0.95 and 0.999 — check edge length for arc tessellation.
        // Short edges (<15mm) with similar normals are arc tessellation artifacts.
        const v1 = getVertex(vertices, v1Idx);
        const v2 = getVertex(vertices, v2Idx);
        const dx = v2.x - v1.x, dy = v2.y - v1.y, dz = v2.z - v1.z;
        const edgeLen = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (edgeLen > 15) {
          // Long edge with small angle difference — still a real crease
          keep = true;
        }
        // else: short arc tessellation edge → remove
      }
      // else: d >= 0.999 → fully coplanar internal → remove
    } else {
      // 3+ faces (non-manifold) → keep
      keep = true;
    }

    if (keep) {
      silhouetteEdges.push({
        a: getVertex(vertices, v1Idx),
        b: getVertex(vertices, v2Idx),
        partName,
      });
    }
  }

  return silhouetteEdges;
}

export type { SilhouetteEdge, Vec3 };
