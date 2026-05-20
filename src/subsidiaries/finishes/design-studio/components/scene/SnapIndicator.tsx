/**
 * SnapIndicator — persistent-geometry green line between a dragged
 * cabinet and the neighbour it's snapped against.
 *
 * Mounted once per viewport; the hosting scene passes `preview` (or
 * `null`) every drag tick. We never recreate the BufferGeometry —
 * only mutate its position attribute in place, per the Cabinet
 * Alignment spec's perf rule ("never re-create Three.js geometries
 * per frame").
 *
 * The indicator lives inside a `<primitive>`-style ref mount — the
 * component doesn't render React DOM, it returns null and pushes a
 * line into the scene on mount.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { SnapPreview } from '../../hooks/useCabinetGizmo';

interface SnapIndicatorProps {
  /** The Three.js scene to inject the line into. */
  scene: THREE.Scene | null;
  /** Current snap preview, or null when nothing is snapped. */
  preview: SnapPreview | null;
}

/** Brand "confirmed" green — same as the snap-success pill colour. */
const SNAP_COLOUR = 0x00D26A;
/** Tiny Y-offset so the line sits just above the ground plane and
 *  isn't Z-fighting with it. */
const LINE_Y_OFFSET = 2;

export function SnapIndicator({ scene, preview }: SnapIndicatorProps) {
  const lineRef = useRef<THREE.Line | null>(null);
  const positionsRef = useRef<Float32Array | null>(null);

  // Mount + cleanup. The line geometry is a two-vertex Float32Array
  // that we mutate every update — never recreated.
  useEffect(() => {
    if (!scene) return;
    const positions = new Float32Array(6); // 2 points × xyz
    positionsRef.current = positions;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setDrawRange(0, 0); // hidden until first preview
    const material = new THREE.LineBasicMaterial({
      color: SNAP_COLOUR,
      linewidth: 2,            // renderable in wide-line mode; ignored otherwise
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      depthWrite: false,
    });
    const line = new THREE.Line(geometry, material);
    line.renderOrder = 998; // just under the gizmo
    line.visible = false;
    scene.add(line);
    lineRef.current = line;

    return () => {
      scene.remove(line);
      geometry.dispose();
      material.dispose();
      lineRef.current = null;
      positionsRef.current = null;
    };
  }, [scene]);

  // Update on preview change. Mutates the existing buffer in place.
  useEffect(() => {
    const line = lineRef.current;
    const positions = positionsRef.current;
    if (!line || !positions) return;
    if (!preview) {
      line.visible = false;
      return;
    }
    positions[0] = preview.draggedCentre.x;
    positions[1] = preview.draggedCentre.y + LINE_Y_OFFSET;
    positions[2] = preview.draggedCentre.z;
    positions[3] = preview.neighbourCentre.x;
    positions[4] = preview.neighbourCentre.y + LINE_Y_OFFSET;
    positions[5] = preview.neighbourCentre.z;
    const attr = line.geometry.getAttribute('position') as THREE.BufferAttribute;
    attr.needsUpdate = true;
    line.geometry.setDrawRange(0, 2);
    line.visible = true;
  }, [preview]);

  return null;
}
