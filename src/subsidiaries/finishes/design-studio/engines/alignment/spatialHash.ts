/**
 * Spatial hash — broad-phase index for cabinet alignment queries.
 *
 * Pure TypeScript, no Three.js / React imports — trivially unit-testable.
 *
 * Each tracked item (cabinet id + XZ bbox) is stored in every integer cell
 * its bbox covers (cell = CELL_SIZE_MM × CELL_SIZE_MM on the XZ plane).
 * `queryRadius(center, radius)` returns the union of items in every cell
 * the query disc overlaps — typically 1–9 cells in a 1000mm-grid layout.
 *
 * Cabinets lie flat on the floor so the Y axis is intentionally ignored.
 * Wall cabinets stacked over bases will share cells, which is correct —
 * the snap engine downstream does 3D collision resolution separately.
 *
 * Used by `useCabinetGizmo` to avoid scanning every cabinet in the scene
 * per drag tick. For 40 cabinets the O(n) scan is cheap, but once scenes
 * grow (spec budget: 40 cabinets, but real projects can exceed 100) the
 * scan becomes the dominant cost in the drag pipeline at 60 fps.
 */

/** Cell size matches the spec default (1000mm ≈ one cabinet wide). */
export const DEFAULT_CELL_SIZE_MM = 1000;

export interface AabbXZ {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

export interface SpatialHashEntry<T> {
  id: string;
  item: T;
  bbox: AabbXZ;
}

/**
 * Mutable spatial hash. Designed for rebuild-or-patch rather than
 * immutable snapshots so the drag hook can keep a single instance alive
 * across many ticks.
 */
export class SpatialHash<T> {
  private readonly cellSize: number;
  private readonly cells = new Map<string, Map<string, SpatialHashEntry<T>>>();
  private readonly idToCells = new Map<string, string[]>();

  constructor(cellSize: number = DEFAULT_CELL_SIZE_MM) {
    if (cellSize <= 0) throw new Error(`SpatialHash cellSize must be > 0 (got ${cellSize})`);
    this.cellSize = cellSize;
  }

  /** Cells a bbox overlaps, inclusive on both ends. Cheap — typically 1–4. */
  private cellsFor(bbox: AabbXZ): string[] {
    const c = this.cellSize;
    const x0 = Math.floor(bbox.minX / c);
    const x1 = Math.floor(bbox.maxX / c);
    const z0 = Math.floor(bbox.minZ / c);
    const z1 = Math.floor(bbox.maxZ / c);
    const out: string[] = [];
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        out.push(`${x}|${z}`);
      }
    }
    return out;
  }

  /** Insert or replace an entry. Re-indexes if the bbox moved cells. */
  upsert(id: string, item: T, bbox: AabbXZ): void {
    this.remove(id);
    const cellKeys = this.cellsFor(bbox);
    this.idToCells.set(id, cellKeys);
    for (const key of cellKeys) {
      let bucket = this.cells.get(key);
      if (!bucket) {
        bucket = new Map();
        this.cells.set(key, bucket);
      }
      bucket.set(id, { id, item, bbox });
    }
  }

  /** Remove an entry by id. No-op if it isn't present. */
  remove(id: string): void {
    const cellKeys = this.idToCells.get(id);
    if (!cellKeys) return;
    for (const key of cellKeys) {
      const bucket = this.cells.get(key);
      if (!bucket) continue;
      bucket.delete(id);
      if (bucket.size === 0) this.cells.delete(key);
    }
    this.idToCells.delete(id);
  }

  /** Drop every entry — useful for reseeding from a fresh cabinets array. */
  clear(): void {
    this.cells.clear();
    this.idToCells.clear();
  }

  /**
   * Return every entry whose bbox lies inside (or overlaps) the square
   * `[center.x ± radius] × [center.z ± radius]`. Callers that need a true
   * circular filter should apply a distance check on the result — the
   * hash is a *broad* phase so we trade accuracy for O(1) cell lookups.
   */
  queryRadius(center: { x: number; z: number }, radius: number): SpatialHashEntry<T>[] {
    const c = this.cellSize;
    const x0 = Math.floor((center.x - radius) / c);
    const x1 = Math.floor((center.x + radius) / c);
    const z0 = Math.floor((center.z - radius) / c);
    const z1 = Math.floor((center.z + radius) / c);
    const seen = new Set<string>();
    const out: SpatialHashEntry<T>[] = [];
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const bucket = this.cells.get(`${x}|${z}`);
        if (!bucket) continue;
        for (const entry of bucket.values()) {
          if (seen.has(entry.id)) continue;
          seen.add(entry.id);
          out.push(entry);
        }
      }
    }
    return out;
  }

  /** Number of distinct entries in the hash — test helper. */
  size(): number {
    return this.idToCells.size;
  }
}

/**
 * Convenience builder: rebuild a hash from scratch given an array of
 * items with XZ centres and footprints. Cheaper than incremental
 * maintenance for small N (< 200).
 */
export function buildSpatialHash<T extends { id: string; x: number; z: number; width: number; depth: number }>(
  items: T[],
  cellSize: number = DEFAULT_CELL_SIZE_MM,
): SpatialHash<T> {
  const hash = new SpatialHash<T>(cellSize);
  for (const it of items) {
    const halfW = it.width / 2;
    const halfD = it.depth / 2;
    hash.upsert(it.id, it, {
      minX: it.x - halfW,
      maxX: it.x + halfW,
      minZ: it.z - halfD,
      maxZ: it.z + halfD,
    });
  }
  return hash;
}
