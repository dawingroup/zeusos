/**
 * Scene Source Asset Service
 *
 * When a Scene is born from AI cabinet detection on a user-uploaded
 * multi-cabinet model, we need to preserve the geometry so the detected
 * cabinets can actually render in the Scene workspace. This service:
 *
 *   1. Converts a `ParsedModel` (any supported source — 3DS, OBJ, GLB, …)
 *      into a binary GLB Blob. If the model already carries a `glbBuffer`
 *      we reuse it; otherwise we build a THREE.Group from the parsed
 *      objects and export via GLTFExporter.
 *
 *   2. Uploads the GLB to Firebase Storage under the scene's directory
 *      and returns a download URL that survives the session.
 *
 * The returned URL is written to every detected SceneCabinet as
 * `sourceModelUrl` (plus the cabinet's `sourceMeshNames`) so the viewport
 * can load the shared GLB once and filter to the relevant meshes.
 */
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { ref, uploadBytes, getDownloadURL, getStorage } from 'firebase/storage';
import { app } from '@/shared/services/firebase/config';
import type { ParsedModel, ModelSource } from '../types/workshop-viewer.types';
import type { CabinetPosition } from '../types/scene.types';

const storage = getStorage(app);

/**
 * Build a binary GLB Blob from a ParsedModel. Mesh names are preserved so the
 * viewport can filter to `sourceMeshNames` at render time.
 */
export async function parsedModelToGlbBlob(model: ParsedModel): Promise<Blob> {
  // Fast path — user uploaded a GLB and we kept the original buffer
  if (model.glbBuffer && model.glbBuffer.byteLength > 0) {
    return new Blob([model.glbBuffer], { type: 'model/gltf-binary' });
  }

  // Slow path — rebuild a Three.js group from parsed objects, then export
  const group = new THREE.Group();
  group.name = model.fileName || 'source-model';

  // 3DS Max and DXF use Z-up; Three.js (and glTF) use Y-up. Without this
  // correction cabinets render rotated onto their back (appears "upside down"
  // or "lying flat"). We bake a R_x(-90°) transform into each geometry so the
  // exported GLB is pure Y-up and downstream placement / bounds math doesn't
  // need to know the source convention. (x, y, z) → (x, z, -y).
  const needsZUpToYUp = model.source === '3ds' || model.source === 'dxf';
  const axisFix = needsZUpToYUp
    ? new THREE.Matrix4().makeRotationX(-Math.PI / 2)
    : null;

  for (const obj of model.objects ?? []) {
    if (!obj.vertices || obj.vertices.length === 0) continue;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(obj.vertices, 3));
    if (obj.faces && obj.faces.length > 0) {
      geometry.setIndex(new THREE.BufferAttribute(obj.faces, 1));
    }
    if (axisFix) geometry.applyMatrix4(axisFix);
    geometry.computeVertexNormals();

    // Resolve a diffuse color from the material table if available
    const matDef = model.materials?.[obj.material];
    const color = matDef
      ? new THREE.Color(matDef.diffuse[0], matDef.diffuse[1], matDef.diffuse[2])
      : new THREE.Color(0xcccccc);

    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.6,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = obj.name;
    // Duplicate the name in userData so it survives any GLTF sanitization of
    // node names — GLTFExporter persists userData primitives as `extras` and
    // GLTFLoader rehydrates them, so this round-trips even when mesh.name gets
    // rewritten. The viewport's subset matcher reads this first.
    mesh.userData.dawinMeshId = obj.name;
    group.add(mesh);
  }

  const exporter = new GLTFExporter();
  const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      group,
      (result) => {
        if (result instanceof ArrayBuffer) resolve(result);
        else reject(new Error('GLTFExporter returned non-binary result'));
      },
      (err) => reject(err),
      { binary: true, embedImages: true, onlyVisible: false },
    );
  });

  return new Blob([arrayBuffer], { type: 'model/gltf-binary' });
}

/**
 * Upload a GLB Blob to Firebase Storage under the scene's source directory
 * and return a public download URL.
 */
export async function uploadSceneSourceModel(
  sceneId: string,
  blob: Blob,
  displayName: string,
): Promise<string> {
  const safe = displayName.replace(/\.[a-z0-9]+$/i, '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'source';
  const path = `scenes/${sceneId}/source/${Date.now()}-${safe}.glb`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: 'model/gltf-binary' });
  return await getDownloadURL(storageRef);
}

/**
 * Convenience: export + upload in a single call.
 */
export async function persistSceneSourceModel(
  sceneId: string,
  model: ParsedModel,
  displayName?: string,
): Promise<string> {
  const blob = await parsedModelToGlbBlob(model);
  return uploadSceneSourceModel(sceneId, blob, displayName ?? model.fileName ?? 'source');
}

/**
 * True when a ParsedModel source uses the Z-up convention (3DS Max, DXF) and
 * therefore needs R_x(−90°) applied to its geometry AND to any coordinates
 * derived from it (centroids, bounding boxes, positions) before being stored
 * or rendered in Y-up world space. Kept next to `parsedModelToGlbBlob` so the
 * geometry and metadata paths agree on what "needs rotating" means.
 */
export function needsZUpToYUpRotation(source: ModelSource): boolean {
  return source === '3ds' || source === 'dxf';
}

/**
 * Convert an AI-detection centroid (in the parsed model's native coordinate
 * space) into a `CabinetPosition` suitable for persistence + rendering.
 *
 * 3DS / DXF are Z-up: we apply R_x(−90°), which is (x, y, z) → (x, z, −y).
 * Height (y) is clamped to 0 so the cabinet stands on the floor — the
 * viewport's subset-centering logic already lifts each cabinet's geometry
 * so its bbox bottom sits at y=0 in its local frame, so storing y=0 places
 * the cabinet's base on the ground plane regardless of where its centroid
 * sat in the source model.
 *
 * Other sources (GLB, OBJ, FBX, SKP) are already Y-up; we keep x/z as-is
 * and honour the detected bounding-box min.y for vertical placement.
 */
export function detectionCentroidToPosition(
  centroid: { x: number; y: number; z: number },
  boundingBoxMinY: number,
  source: ModelSource,
): CabinetPosition {
  if (needsZUpToYUpRotation(source)) {
    return {
      x: centroid.x,
      y: 0,              // cabinet on floor; subset-centering handles local origin
      z: -centroid.y,    // R_x(−90°): z_new = −y_old
      anchoredTo: 'floor',
    };
  }
  return {
    x: centroid.x,
    y: boundingBoxMinY,
    z: centroid.z,
    anchoredTo: 'floor',
  };
}
