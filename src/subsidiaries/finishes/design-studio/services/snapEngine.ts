// src/modules/workshop-viewer/services/snapEngine.ts
import * as THREE from 'three';
import type { SnapTarget } from '../types/dimension.types';
import type { ParsedModel } from '../types/workshop-viewer.types';

const DEFAULT_SNAP_RADIUS = 10; // mm

export function findNearestSnapTarget(
  intersectPoint: THREE.Vector3,
  model: ParsedModel,
  snapRadius: number = DEFAULT_SNAP_RADIUS,
): SnapTarget | null {
  let closest: SnapTarget | null = null;
  let minDist = snapRadius;

  for (const obj of model.objects) {
    const verts = obj.vertices;
    const faces = obj.faces;

    // Check vertices
    for (let i = 0; i + 2 < verts.length; i += 3) {
      const v = new THREE.Vector3(verts[i], verts[i + 1], verts[i + 2]);
      const dist = v.distanceTo(intersectPoint);
      if (dist < minDist) {
        minDist = dist;
        closest = {
          type: 'vertex',
          position: { x: v.x, y: v.y, z: v.z },
          partName: obj.name,
          worldPosition: v.clone(),
        };
      }
    }

    // Check edge midpoints from face edges
    const edgeSet = new Set<string>();
    for (let f = 0; f + 2 < faces.length; f += 3) {
      const triPairs: [number, number][] = [
        [faces[f], faces[f + 1]],
        [faces[f + 1], faces[f + 2]],
        [faces[f + 2], faces[f]],
      ];
      for (const [a, b] of triPairs) {
        const key = `${Math.min(a, b)}_${Math.max(a, b)}`;
        if (edgeSet.has(key)) continue;
        edgeSet.add(key);

        const va = new THREE.Vector3(verts[a * 3], verts[a * 3 + 1], verts[a * 3 + 2]);
        const vb = new THREE.Vector3(verts[b * 3], verts[b * 3 + 1], verts[b * 3 + 2]);
        const mid = va.clone().add(vb).multiplyScalar(0.5);
        const dist = mid.distanceTo(intersectPoint);

        if (dist < minDist) {
          minDist = dist;
          closest = {
            type: 'edge_midpoint',
            position: { x: mid.x, y: mid.y, z: mid.z },
            partName: obj.name,
            worldPosition: mid.clone(),
          };
        }

        // Edge endpoints
        for (const ep of [va, vb]) {
          const eDist = ep.distanceTo(intersectPoint);
          if (eDist < minDist) {
            minDist = eDist;
            closest = {
              type: 'edge_endpoint',
              position: { x: ep.x, y: ep.y, z: ep.z },
              partName: obj.name,
              worldPosition: ep.clone(),
            };
          }
        }
      }
    }
  }

  return closest;
}

/** Engineering-style crosshair + diamond snap indicator (replaces old sphere). */
export function createSnapIndicator(): THREE.Group {
  const group = new THREE.Group();
  const size = 10; // mm
  const mat = new THREE.LineBasicMaterial({
    color: 0x00BCD4,
    depthTest: false,
    linewidth: 2,
  });

  // Crosshair: 3 perpendicular lines
  const mkLine = (a: THREE.Vector3, b: THREE.Vector3) => {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    return new THREE.Line(g, mat);
  };
  group.add(mkLine(new THREE.Vector3(-size, 0, 0), new THREE.Vector3(size, 0, 0)));
  group.add(mkLine(new THREE.Vector3(0, -size, 0), new THREE.Vector3(0, size, 0)));
  group.add(mkLine(new THREE.Vector3(0, 0, -size), new THREE.Vector3(0, 0, size)));

  // Diamond outline at centre
  const d = size * 0.4;
  const diamond = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, d, 0), new THREE.Vector3(d, 0, 0),
    new THREE.Vector3(0, -d, 0), new THREE.Vector3(-d, 0, 0),
    new THREE.Vector3(0, d, 0),
  ]);
  group.add(new THREE.Line(diamond, mat));

  group.renderOrder = 999;
  return group;
}

export function createPreviewLineMaterial(): THREE.LineDashedMaterial {
  return new THREE.LineDashedMaterial({
    color: 0x00BCD4,
    dashSize: 5,
    gapSize: 3,
    depthTest: false,
  });
}
