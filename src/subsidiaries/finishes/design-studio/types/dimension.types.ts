// src/modules/workshop-viewer/types/dimension.types.ts
import type { Vec3 } from './workshop-viewer.types';
import type * as THREE from 'three';

// ─── Managed Dimension ────────────────────────────────────────────────────────

export interface ManagedDimension {
  id: string;
  type: 'auto' | 'user';
  source: 'overall' | 'intermediate' | 'detail' | 'manual';
  tier: 1 | 2 | 3;
  view: string;           // View direction this dim appears on, or 'all'
  from3d: Vec3;
  to3d: Vec3;
  value: number;          // Distance in mm
  label: string;          // Display text
  color: string;          // Hex colour
  visible: boolean;
  offset: number;         // Perpendicular offset from model edge in mm
  isUserModified: boolean;
}

// ─── Snap target ─────────────────────────────────────────────────────────────

export interface SnapTarget {
  type: 'vertex' | 'edge_endpoint' | 'edge_midpoint' | 'face_center';
  position: Vec3;
  partName: string;
  worldPosition: THREE.Vector3;
}

// ─── Measure tool state machine ───────────────────────────────────────────────

export type MeasureToolState =
  | { mode: 'idle' }
  | { mode: 'picking_first' }
  | { mode: 'picking_second'; firstPoint: THREE.Vector3; snappedTo: SnapTarget | null }
  | { mode: 'adjusting_offset'; dimension: ManagedDimension };

// ─── Dimension overrides for persistence ─────────────────────────────────────

export interface DimensionOverrides {
  [dimensionId: string]: {
    visible: boolean;
    offsetOverride?: number;
  };
}
