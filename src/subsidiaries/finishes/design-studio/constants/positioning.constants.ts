/**
 * Positioning Constants — Cabinet placement in scenes
 */

export const CARDINAL_DIRECTIONS = ['north', 'south', 'east', 'west'] as const;
export type CardinalDirection = (typeof CARDINAL_DIRECTIONS)[number];

export const WALL_RUN_TYPES = [
  'straight', 'l_shape', 'u_shape', 'island', 'peninsula', 'freestanding',
] as const;
export type WallRunType = (typeof WALL_RUN_TYPES)[number];

export const CABINET_ANCHOR_POINTS = [
  'bottom_back_left', 'bottom_center', 'bottom_back_center', 'top_back_left',
] as const;
export type CabinetAnchorPoint = (typeof CABINET_ANCHOR_POINTS)[number];

export const ROTATION_INCREMENTS_DEG = [0, 90, 180, 270] as const;
export const FREE_ROTATION_ENABLED = true;
