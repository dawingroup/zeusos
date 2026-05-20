/**
 * partGeometryClassifier — a second opinion on what a mesh IS, driven
 * by its axis-aligned bounding box (not its name).
 *
 * Why: the name-based detector (detectPartCategoryFromName) handles
 * well-named CAD exports but collapses when mesh names are cryptic
 * ("object_17", "mesh_L_02"). The AI grouper falls back to `'panel'`
 * for anything unclassified, which is the lowest-signal bucket and
 * wipes out every richer category the taxonomy supports.
 *
 * A thin rectangular block positioned AT THE FLOOR of a carcase is
 * almost certainly a toe-kick. A thin rectangular panel OUTSIDE the
 * cabinet's envelope is almost certainly a cover panel. This module
 * encodes those spatial rules.
 *
 * Stays pure: takes an axis-aligned bbox + optional parent cabinet
 * bbox + a domain hint, returns a { category, confidence, reason }
 * triple. The AI grouper calls this when the name-based resolver
 * returned `'panel'` — the geometry can sharpen `'panel'` into
 * `'toe_kick'` / `'cover_panel'` / `'upright'` / `'fascia'` / keep
 * `'panel'`.
 */
import type { PartCategory } from '../constants/assembly.constants';
import type { FurnitureDomain } from '../constants/furnitureDomains';

/** Minimal axis-aligned box shape — matches `BoundingBox` but loosened
 *  so callers can pass a simpler {min, max} without ferrying the extra
 *  `center` / `size` fields. */
export interface GeomBox {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

export interface ClassificationResult {
  category: PartCategory;
  /** 0–1. > 0.65 = confident enough to override name-based 'panel'. */
  confidence: number;
  /** Human-readable rationale — surfaces in the AI grouper's
   *  ModelGrouping.reasoning string when this codepath fires. */
  reason: string;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function sizeOf(box: GeomBox): { w: number; h: number; d: number } {
  return {
    w: Math.max(0, box.max.x - box.min.x),
    h: Math.max(0, box.max.y - box.min.y),
    d: Math.max(0, box.max.z - box.min.z),
  };
}

function sortedAxes(size: { w: number; h: number; d: number }): [number, number, number] {
  const arr = [size.w, size.h, size.d].sort((a, b) => a - b);
  return [arr[0], arr[1], arr[2]];
}

function ratio(a: number, b: number): number {
  return b === 0 ? Infinity : a / b;
}

/** Part is a "thin sheet" — shortest dimension much smaller than the
 *  other two. Covers 15–30mm panels on 600+mm meshes. */
function isSheetLike(size: { w: number; h: number; d: number }): boolean {
  const [shortest, mid, longest] = sortedAxes(size);
  if (shortest <= 0 || mid <= 0) return false;
  // Shortest must be <10% of longest AND <25% of mid.
  return shortest / longest < 0.12 && shortest / mid < 0.30;
}

/** Part is a "linear stick" — longest dimension dominates, other two
 *  comparable. Covers shelf standards / uprights / gondola posts. */
function isStickLike(size: { w: number; h: number; d: number }): boolean {
  const [shortest, mid, longest] = sortedAxes(size);
  if (shortest <= 0 || mid <= 0) return false;
  // Longest > 6× mid, and mid/shortest ratio reasonably square (<2).
  return longest / mid > 6 && ratio(mid, shortest) < 2;
}

/** Return true when `box` sits entirely OUTSIDE `parent` along any
 *  axis (within tolerance). Classic signal for a cover / filler panel
 *  bolted to the outside of a carcase. */
function isOutsideEnvelope(box: GeomBox, parent: GeomBox, tolMm = 5): boolean {
  return (
    box.max.x < parent.min.x - tolMm
    || box.min.x > parent.max.x + tolMm
    || box.max.y < parent.min.y - tolMm
    || box.min.y > parent.max.y + tolMm
    || box.max.z < parent.min.z - tolMm
    || box.min.z > parent.max.z + tolMm
  );
}

/** Relative Y-position of a box inside `parent`, 0 = at floor, 1 = at top. */
function verticalPositionInParent(box: GeomBox, parent: GeomBox): number {
  const parentH = parent.max.y - parent.min.y;
  if (parentH <= 0) return 0.5;
  const boxMidY = (box.min.y + box.max.y) / 2;
  return Math.min(1, Math.max(0, (boxMidY - parent.min.y) / parentH));
}

// ---------------------------------------------------------------------------
// Main classifier
// ---------------------------------------------------------------------------

/**
 * Classify a part by geometry alone. Returns `'panel'` when no rule
 * triggers confidently — callers can then keep the name-based
 * classification rather than letting the geometry override with low
 * confidence.
 */
export function classifyPartByGeometry(
  box: GeomBox,
  parent?: GeomBox,
  domain: FurnitureDomain = 'storage',
): ClassificationResult {
  const size = sizeOf(box);

  // ── 1. Linear stick → upright (retail / pharmacy / library) ──────
  if (isStickLike(size)) {
    const isVerticalDominant = size.h >= size.w && size.h >= size.d;
    const retailish = domain === 'retail' || domain === 'pharmacy'
      || domain === 'library' || domain === 'display';
    if (isVerticalDominant && retailish) {
      return {
        category: 'upright',
        confidence: 0.78,
        reason: `Stick-like vertical (${Math.round(size.h)}mm tall, ` +
          `${Math.round(size.w)}×${Math.round(size.d)}mm cross-section) ` +
          `in ${domain} domain → upright.`,
      };
    }
    if (isVerticalDominant) {
      return {
        category: 'stretcher',
        confidence: 0.60,
        reason: 'Stick-like vertical in non-retail domain → stretcher.',
      };
    }
  }

  // ── 2. Sheet with parent context → toe_kick / cover_panel / panel ──
  if (isSheetLike(size) && parent) {
    const outside = isOutsideEnvelope(box, parent);
    if (outside) {
      return {
        category: 'cover_panel',
        confidence: 0.80,
        reason: 'Thin sheet positioned outside the parent carcase envelope → cover panel.',
      };
    }

    const yPos = verticalPositionInParent(box, parent);

    // Floor-level low thin panel (bottom 10% of parent) → toe-kick.
    // The panel has to be LONG (width > 2× depth) to distinguish from
    // a drawer bottom that also sits low.
    const [, mid, longest] = sortedAxes(size);
    if (yPos < 0.1 && longest / mid > 2.5) {
      return {
        category: 'toe_kick',
        confidence: 0.75,
        reason:
          `Thin horizontal sheet at floor level ` +
          `(${Math.round(yPos * 100)}% up parent) → toe-kick / plinth cover.`,
      };
    }

    // Top-edge wide thin horizontal → fascia / cornice.
    if (yPos > 0.85 && longest / mid > 2.5) {
      return {
        category: 'fascia',
        confidence: 0.68,
        reason:
          `Thin horizontal sheet near top of parent ` +
          `(${Math.round(yPos * 100)}% up) → fascia / cornice.`,
      };
    }
  }

  // ── 3. Sheet with no parent context → panel (low confidence) ─────
  if (isSheetLike(size)) {
    return {
      category: 'panel',
      confidence: 0.40,
      reason: 'Sheet-like geometry without parent context → generic panel.',
    };
  }

  // ── Fallback ─────────────────────────────────────────────────────
  return {
    category: 'panel',
    confidence: 0.20,
    reason: 'No geometric signature matched — defaulting to panel.',
  };
}

/** Confidence threshold above which geometry should OVERRIDE a
 *  name-based `'panel'` fallback. Below it, trust the name. */
export const GEOMETRY_OVERRIDE_THRESHOLD = 0.65;
