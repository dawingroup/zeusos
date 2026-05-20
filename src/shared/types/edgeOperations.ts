/**
 * Canonical per-edge manufacturing operations.
 * These operations stay attached to a physical part edge and must be
 * rotation-aware in nesting/render pipelines.
 */

export type EdgeSide = 'top' | 'right' | 'bottom' | 'left' | 'front';

export type EdgeOperationType =
  | 'edge_banding'
  | 'grooving'
  | 'mitering'
  | 'routing'
  | 'custom';

export interface EdgeOperationSpec {
  id?: string;
  type: EdgeOperationType;
  label?: string;
  note?: string;
  depthMm?: number;
  widthMm?: number;
  angleDeg?: number;
  toolId?: string;
  metadata?: Record<string, unknown>;
}

export type EdgeOperationsBySide = Partial<Record<EdgeSide, EdgeOperationSpec[]>>;
