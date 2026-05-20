// src/modules/workshop-viewer/services/dimensionManager.ts
import type { DimensionSet, IntermediateDimension } from '../types/workshop-viewer.types';
import type { ManagedDimension, DimensionOverrides } from '../types/dimension.types';
import { DIMENSION_COLORS } from '../constants/workshop-viewer.constants';

let _autoIdCounter = 0;
function nextId() { return `auto-${Date.now()}-${_autoIdCounter++}`; }

// ─── Convert auto DimensionSet → ManagedDimension[] ─────────────────────────

export function convertAutoToManaged(dimSet: DimensionSet | null): ManagedDimension[] {
  if (!dimSet) return [];
  const managed: ManagedDimension[] = [];

  // Overall (Tier 1)
  const { overall } = dimSet;
  if (overall.width > 0) {
    managed.push({
      id: nextId(), type: 'auto', source: 'overall', tier: 1, view: 'front',
      from3d: { x: 0, y: 0, z: 0 }, to3d: { x: overall.width, y: 0, z: 0 },
      value: Math.round(overall.width), label: `${Math.round(overall.width)}`,
      color: DIMENSION_COLORS.overall_width, visible: true, offset: 14, isUserModified: false,
    });
  }
  if (overall.height > 0) {
    managed.push({
      id: nextId(), type: 'auto', source: 'overall', tier: 1, view: 'front',
      from3d: { x: 0, y: 0, z: 0 }, to3d: { x: 0, y: 0, z: overall.height },
      value: Math.round(overall.height), label: `${Math.round(overall.height)}`,
      color: DIMENSION_COLORS.overall_height, visible: true, offset: 14, isUserModified: false,
    });
  }
  if (overall.depth > 0) {
    managed.push({
      id: nextId(), type: 'auto', source: 'overall', tier: 1, view: 'right',
      from3d: { x: 0, y: 0, z: 0 }, to3d: { x: 0, y: overall.depth, z: 0 },
      value: Math.round(overall.depth), label: `${Math.round(overall.depth)}`,
      color: DIMENSION_COLORS.overall_width, visible: true, offset: 14, isUserModified: false,
    });
  }

  // Intermediate (Tier 2 & 3)
  for (const inter of dimSet.intermediate ?? []) {
    for (let i = 1; i < inter.positions.length; i++) {
      const val = Math.round(Math.abs(inter.positions[i] - inter.positions[i - 1]));
      if (val < 2) continue;
      const isDetail = inter.tier >= 3;
      managed.push({
        id: nextId(), type: 'auto',
        source: isDetail ? 'detail' : 'intermediate',
        tier: (inter.tier as 1 | 2 | 3) ?? 2,
        view: inter.view ?? 'front',
        from3d: positionToVec3(inter, i - 1),
        to3d: positionToVec3(inter, i),
        value: val, label: `${val}`,
        color: inter.color,
        visible: true,
        offset: inter.tier === 2 ? 8 : 4,
        isUserModified: false,
      });
    }
  }

  return managed;
}

function positionToVec3(inter: IntermediateDimension, index: number): { x: number; y: number; z: number } {
  const pos = inter.positions[index];
  if (inter.type === 'horizontal_chain' || inter.type === 'single_horizontal') {
    return { x: pos, y: 0, z: 0 };
  }
  return { x: 0, y: 0, z: pos };
}

// ─── Apply user overrides to managed dimensions ──────────────────────────────

export function applyOverrides(
  dimensions: ManagedDimension[],
  overrides: DimensionOverrides,
): ManagedDimension[] {
  return dimensions.map((dim) => {
    const override = overrides[dim.id];
    if (!override) return dim;
    return {
      ...dim,
      visible: override.visible,
      offset: override.offsetOverride ?? dim.offset,
      isUserModified: true,
    };
  });
}

// ─── Merge auto + user dimensions ────────────────────────────────────────────

export function mergeDimensions(
  autoDims: ManagedDimension[],
  userDims: ManagedDimension[],
  overrides: DimensionOverrides,
): ManagedDimension[] {
  return [...applyOverrides(autoDims, overrides), ...userDims];
}

// ─── Filter visible dimensions ────────────────────────────────────────────────

export function getVisibleDimensions(dims: ManagedDimension[]): ManagedDimension[] {
  return dims.filter((d) => d.visible);
}

// ─── Group by tier for sidebar ───────────────────────────────────────────────

export function groupByTier(dims: ManagedDimension[]): Record<string, ManagedDimension[]> {
  return {
    overall: dims.filter((d) => d.source === 'overall'),
    intermediate: dims.filter((d) => d.source === 'intermediate'),
    detail: dims.filter((d) => d.source === 'detail'),
    manual: dims.filter((d) => d.type === 'user'),
  };
}
