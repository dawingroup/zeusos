// src/modules/workshop-viewer/hooks/useMeasureTool.ts
import { useState, useCallback, useRef } from 'react';
import * as THREE from 'three';
import type { MeasureToolState, ManagedDimension, SnapTarget } from '../types/dimension.types';
import type { ParsedModel } from '../types/workshop-viewer.types';
import { findNearestSnapTarget } from '../services/snapEngine';

const USER_DIM_COLOR = '#00BCD4';

interface UseMeasureToolReturn {
  toolState: MeasureToolState;
  activateTool: () => void;
  deactivateTool: () => void;
  handleClick: (intersectPoint: THREE.Vector3) => ManagedDimension | null;
  handleMouseMove: (intersectPoint: THREE.Vector3) => SnapTarget | null;
  isActive: boolean;
}

export function useMeasureTool(model: ParsedModel | null): UseMeasureToolReturn {
  const [toolState, setToolState] = useState<MeasureToolState>({ mode: 'idle' });
  const counterRef = useRef(0);

  const isActive = toolState.mode !== 'idle';

  const activateTool = useCallback(() => setToolState({ mode: 'picking_first' }), []);
  const deactivateTool = useCallback(() => setToolState({ mode: 'idle' }), []);

  const handleMouseMove = useCallback(
    (point: THREE.Vector3): SnapTarget | null => {
      if (!model || !isActive) return null;
      return findNearestSnapTarget(point, model);
    },
    [model, isActive],
  );

  const handleClick = useCallback(
    (point: THREE.Vector3): ManagedDimension | null => {
      if (!model) return null;

      const snap = findNearestSnapTarget(point, model);
      const snappedPoint = snap ? snap.worldPosition : point.clone();

      if (toolState.mode === 'picking_first') {
        setToolState({ mode: 'picking_second', firstPoint: snappedPoint, snappedTo: snap });
        return null;
      }

      if (toolState.mode === 'picking_second') {
        const { firstPoint } = toolState;
        const distance = Math.round(firstPoint.distanceTo(snappedPoint));
        if (distance < 1) return null;

        const dim: ManagedDimension = {
          id: `user-${Date.now()}-${counterRef.current++}`,
          type: 'user',
          source: 'manual',
          tier: 3,
          view: 'all',
          from3d: { x: firstPoint.x, y: firstPoint.y, z: firstPoint.z },
          to3d: { x: snappedPoint.x, y: snappedPoint.y, z: snappedPoint.z },
          value: distance,
          label: `${distance}`,
          color: USER_DIM_COLOR,
          visible: true,
          offset: 12,
          isUserModified: false,
        };

        // Stay in picking_first for continuous measurement
        setToolState({ mode: 'picking_first' });
        return dim;
      }

      return null;
    },
    [model, toolState],
  );

  return { toolState, activateTool, deactivateTool, handleClick, handleMouseMove, isActive };
}
