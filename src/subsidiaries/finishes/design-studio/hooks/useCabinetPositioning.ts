/**
 * useCabinetPositioning — Drag-and-drop positioning state
 *
 * Handles snap-to-grid, snap-to-cabinet-edge, wall alignment.
 * Used by SceneLayoutEditor for 2D top-down positioning.
 */
import { useState, useCallback, useRef } from 'react';
import type { CabinetPosition, SceneCabinet } from '../types/scene.types';
import { DEFAULT_CABINET_SPACING_MM, WALL_GAP_MM, SNAP_THRESHOLD_MM } from '../constants/scene.constants';
import type { PositioningMode } from '../constants/scene.constants';
import { updateCabinetPosition } from '../services/scene.service';

interface DragState {
  cabinetId: string;
  startX: number;
  startZ: number;
  offsetX: number;
  offsetZ: number;
}

interface UseCabinetPositioningResult {
  positioningMode: PositioningMode;
  setPositioningMode: (mode: PositioningMode) => void;
  isDragging: boolean;
  dragCabinetId: string | null;
  startDrag: (cabinetId: string, mouseX: number, mouseZ: number) => void;
  updateDrag: (mouseX: number, mouseZ: number) => CabinetPosition | null;
  endDrag: (sceneId: string) => Promise<void>;
  cancelDrag: () => void;
  snapPosition: (pos: CabinetPosition) => CabinetPosition;
  alignToRun: (cabinetId: string, cabinets: SceneCabinet[], spacing?: number) => CabinetPosition[];
}

export function useCabinetPositioning(cabinets: SceneCabinet[]): UseCabinetPositioningResult {
  const [positioningMode, setPositioningMode] = useState<PositioningMode>('grid_300mm');
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const [currentPos, setCurrentPos] = useState<CabinetPosition | null>(null);

  const snapToGrid = useCallback((value: number, gridSize: number): number => {
    return Math.round(value / gridSize) * gridSize;
  }, []);

  const snapPosition = useCallback((pos: CabinetPosition): CabinetPosition => {
    switch (positioningMode) {
      case 'grid_300mm':
        return { ...pos, x: snapToGrid(pos.x, 300), z: snapToGrid(pos.z, 300) };
      case 'snap_floor':
        return { ...pos, y: 0, anchoredTo: 'floor' };
      case 'snap_wall':
        return { ...pos, z: WALL_GAP_MM, anchoredTo: 'wall' };
      case 'align_run':
      case 'free':
      default:
        return pos;
    }
  }, [positioningMode, snapToGrid]);

  const findNearestEdgeSnap = useCallback((
    pos: CabinetPosition,
    draggedId: string,
  ): CabinetPosition => {
    const SNAP_THRESHOLD = SNAP_THRESHOLD_MM; // mm — lifted to scene.constants
    let snapped = { ...pos };

    for (const cab of cabinets) {
      if (cab.id === draggedId) continue;
      const cabPos = cab.position ?? { x: 0, y: 0, z: 0 };

      // Snap X edges (left-right alignment)
      const dx = Math.abs(pos.x - cabPos.x);
      if (dx < SNAP_THRESHOLD) {
        snapped = { ...snapped, x: cabPos.x, alignedWithCabinetId: cab.id, alignmentEdge: 'left' as const };
      }

      // Snap Z edges (front-back alignment)
      const dz = Math.abs(pos.z - cabPos.z);
      if (dz < SNAP_THRESHOLD) {
        snapped = { ...snapped, z: cabPos.z };
      }
    }

    return snapped;
  }, [cabinets]);

  const startDrag = useCallback((cabinetId: string, mouseX: number, mouseZ: number) => {
    const cabinet = cabinets.find(c => c.id === cabinetId);
    if (!cabinet || cabinet.isLocked) return;

    const cabPos = cabinet.position ?? { x: 0, y: 0, z: 0 };
    dragRef.current = {
      cabinetId,
      startX: cabPos.x,
      startZ: cabPos.z,
      offsetX: mouseX - cabPos.x,
      offsetZ: mouseZ - cabPos.z,
    };
    setIsDragging(true);
  }, [cabinets]);

  const updateDrag = useCallback((mouseX: number, mouseZ: number): CabinetPosition | null => {
    const drag = dragRef.current;
    if (!drag) return null;

    let pos: CabinetPosition = {
      x: mouseX - drag.offsetX,
      y: 0,
      z: mouseZ - drag.offsetZ,
      anchoredTo: 'floor',
    };

    // Apply snapping
    pos = snapPosition(pos);

    // Apply edge snapping in align_run mode
    if (positioningMode === 'align_run') {
      pos = findNearestEdgeSnap(pos, drag.cabinetId);
    }

    setCurrentPos(pos);
    return pos;
  }, [snapPosition, positioningMode, findNearestEdgeSnap]);

  const endDrag = useCallback(async (sceneId: string) => {
    const drag = dragRef.current;
    if (!drag || !currentPos) {
      setIsDragging(false);
      dragRef.current = null;
      return;
    }

    await updateCabinetPosition(sceneId, drag.cabinetId, currentPos);
    setIsDragging(false);
    dragRef.current = null;
    setCurrentPos(null);
  }, [currentPos]);

  const cancelDrag = useCallback(() => {
    setIsDragging(false);
    dragRef.current = null;
    setCurrentPos(null);
  }, []);

  const alignToRun = useCallback((
    startCabinetId: string,
    allCabinets: SceneCabinet[],
    spacing: number = DEFAULT_CABINET_SPACING_MM,
  ): CabinetPosition[] => {
    const startCab = allCabinets.find(c => c.id === startCabinetId);
    if (!startCab) return [];

    const startPos = startCab.position ?? { x: 0, y: 0, z: 0 };
    const sorted = [...allCabinets].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));

    let currentX = startPos.x;
    return sorted.map(cab => {
      const config = cab.configuration ?? {};
      const width = typeof config.width === 'number' ? config.width : 600;
      const pos: CabinetPosition = {
        x: currentX,
        y: startPos.y,
        z: startPos.z,
        anchoredTo: 'floor',
        alignedWithCabinetId: cab.id === startCabinetId ? undefined : startCabinetId,
        alignmentEdge: 'left',
      };
      currentX += width + spacing;
      return pos;
    });
  }, []);

  return {
    positioningMode,
    setPositioningMode,
    isDragging,
    dragCabinetId: dragRef.current?.cabinetId ?? null,
    startDrag,
    updateDrag,
    endDrag,
    cancelDrag,
    snapPosition,
    alignToRun,
  };
}
