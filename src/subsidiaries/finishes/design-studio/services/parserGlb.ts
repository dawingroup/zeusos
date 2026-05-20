/**
 * GLB/GLTF Parser — Extract geometry from GLB files into ParsedModel format
 *
 * Uses Three.js GLTFLoader to parse the binary glTF format, then extracts
 * vertices, faces, and materials into the same ParsedModel structure used
 * by the 3DS and DXF parsers.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ParsedModel, MeshObject, MaterialDef } from '../types/workshop-viewer.types';

/**
 * Parse a GLB file buffer into a ParsedModel.
 */
export async function parseGLB(buffer: ArrayBuffer): Promise<ParsedModel> {
  const loader = new GLTFLoader();

  const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
    loader.parse(buffer, '', resolve, reject);
  });

  const objects: MeshObject[] = [];
  const materials: Record<string, MaterialDef> = {};
  let meshIndex = 0;

  gltf.scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    const geometry = child.geometry as THREE.BufferGeometry;
    if (!geometry) return;

    // Ensure geometry has position attribute
    const posAttr = geometry.getAttribute('position');
    if (!posAttr) return;

    // Get world transform
    child.updateWorldMatrix(true, false);
    const worldMatrix = child.matrixWorld;

    // Extract vertices (apply world transform)
    const vertexCount = posAttr.count;
    const vertices = new Float32Array(vertexCount * 3);
    const tempVec = new THREE.Vector3();
    for (let i = 0; i < vertexCount; i++) {
      tempVec.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      tempVec.applyMatrix4(worldMatrix);
      vertices[i * 3] = tempVec.x;
      vertices[i * 3 + 1] = tempVec.y;
      vertices[i * 3 + 2] = tempVec.z;
    }

    // Extract faces (index buffer or generate sequential)
    let faces: Uint16Array | Uint32Array;
    if (geometry.index) {
      // Use Uint32Array for meshes with >65535 vertices to avoid index truncation
      faces = vertexCount > 65535
        ? new Uint32Array(geometry.index.array)
        : new Uint16Array(geometry.index.array);
    } else {
      // Non-indexed geometry — create sequential indices
      faces = vertexCount > 65535
        ? new Uint32Array(vertexCount).map((_, i) => i)
        : new Uint16Array(vertexCount).map((_, i) => i);
    }

    // Extract material
    const mat = Array.isArray(child.material) ? child.material[0] : child.material;
    const matName = mat?.name || child.name || `material_${meshIndex}`;

    if (!materials[matName] && mat) {
      const color = (mat as THREE.MeshStandardMaterial).color || new THREE.Color(0.8, 0.8, 0.8);
      materials[matName] = {
        diffuse: [color.r, color.g, color.b],
      };
    }

    const objName = child.name || `mesh_${meshIndex}`;
    const dawinMeshId = (child.userData?.dawinMeshId as string | undefined)
      || (child.userData?.extras?.dawinMeshId as string | undefined);
    objects.push({
      name: objName,
      vertices,
      faces,
      material: matName,
      dawinMeshId,
    });

    meshIndex++;
  });

  return {
    source: 'glb',
    fileName: '',
    objects,
    materials,
    glbBuffer: buffer,
  };
}
