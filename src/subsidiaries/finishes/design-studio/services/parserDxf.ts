/**
 * DXF Text File Parser (fallback for non-3DS exports)
 * Parses ENTITIES section, extracting 3DFACE and LINE entities.
 * Uses DXF group-code parsing (code + value pairs).
 */

import type { ParsedModel, MeshObject } from '../types/workshop-viewer.types';

interface DxfVertex {
  x: number;
  y: number;
  z: number;
}

interface DxfFace {
  v1: DxfVertex;
  v2: DxfVertex;
  v3: DxfVertex;
  v4?: DxfVertex; // 3DFACE can be quad
  layer: string;
}

interface DxfLine {
  start: DxfVertex;
  end: DxfVertex;
  layer: string;
}

/**
 * Parse a DXF text file into a ParsedModel.
 */
export function parseDXF(content: string): ParsedModel {
  const lines = content.split(/\r?\n/);
  const faces: DxfFace[] = [];
  const dxfLines: DxfLine[] = [];
  let inEntities = false;
  let i = 0;

  // Helper to read a group code pair
  function readPair(): { code: number; value: string } | null {
    if (i + 1 >= lines.length) return null;
    const code = parseInt(lines[i].trim(), 10);
    const value = lines[i + 1].trim();
    i += 2;
    return { code, value };
  }

  function peekCode(): number | null {
    if (i >= lines.length) return null;
    return parseInt(lines[i].trim(), 10);
  }

  // Find ENTITIES section
  while (i < lines.length) {
    const pair = readPair();
    if (!pair) break;
    if (pair.code === 2 && pair.value === 'ENTITIES') {
      inEntities = true;
      break;
    }
  }

  if (!inEntities) {
    return { source: 'dxf', fileName: '', objects: [], materials: {} };
  }

  // Parse entities
  while (i < lines.length) {
    const pair = readPair();
    if (!pair) break;

    // End of ENTITIES section
    if (pair.code === 0 && pair.value === 'ENDSEC') break;

    if (pair.code === 0 && pair.value === '3DFACE') {
      const face: Partial<DxfFace> = {
        v1: { x: 0, y: 0, z: 0 },
        v2: { x: 0, y: 0, z: 0 },
        v3: { x: 0, y: 0, z: 0 },
        v4: undefined,
        layer: '0',
      };

      // Read face attributes until next entity (code 0)
      while (peekCode() !== null && peekCode() !== 0) {
        const attrPair = readPair();
        if (!attrPair) break;
        const val = parseFloat(attrPair.value);

        switch (attrPair.code) {
          case 8: face.layer = attrPair.value; break;
          // Vertex 1
          case 10: face.v1!.x = val; break;
          case 20: face.v1!.y = val; break;
          case 30: face.v1!.z = val; break;
          // Vertex 2
          case 11: face.v2!.x = val; break;
          case 21: face.v2!.y = val; break;
          case 31: face.v2!.z = val; break;
          // Vertex 3
          case 12: face.v3!.x = val; break;
          case 22: face.v3!.y = val; break;
          case 32: face.v3!.z = val; break;
          // Vertex 4 (optional quad)
          case 13: {
            if (!face.v4) face.v4 = { x: 0, y: 0, z: 0 };
            face.v4.x = val;
            break;
          }
          case 23: {
            if (!face.v4) face.v4 = { x: 0, y: 0, z: 0 };
            face.v4.y = val;
            break;
          }
          case 33: {
            if (!face.v4) face.v4 = { x: 0, y: 0, z: 0 };
            face.v4.z = val;
            break;
          }
        }
      }

      faces.push(face as DxfFace);
    } else if (pair.code === 0 && pair.value === 'LINE') {
      const line: DxfLine = {
        start: { x: 0, y: 0, z: 0 },
        end: { x: 0, y: 0, z: 0 },
        layer: '0',
      };

      while (peekCode() !== null && peekCode() !== 0) {
        const attrPair = readPair();
        if (!attrPair) break;
        const val = parseFloat(attrPair.value);

        switch (attrPair.code) {
          case 8: line.layer = attrPair.value; break;
          case 10: line.start.x = val; break;
          case 20: line.start.y = val; break;
          case 30: line.start.z = val; break;
          case 11: line.end.x = val; break;
          case 21: line.end.y = val; break;
          case 31: line.end.z = val; break;
        }
      }

      dxfLines.push(line);
    }
  }

  // Group faces by layer → MeshObject
  const layerFaces = new Map<string, DxfFace[]>();
  for (const face of faces) {
    const existing = layerFaces.get(face.layer) ?? [];
    existing.push(face);
    layerFaces.set(face.layer, existing);
  }

  const objects: MeshObject[] = [];

  for (const [layer, layerFaceList] of layerFaces) {
    // Build vertex buffer and index buffer from faces
    const vertexMap = new Map<string, number>();
    const vertexArray: number[] = [];
    const indexArray: number[] = [];

    function getVertexIndex(v: DxfVertex): number {
      // Round to 0.01mm to merge near-duplicate vertices
      const key = `${Math.round(v.x * 100)},${Math.round(v.y * 100)},${Math.round(v.z * 100)}`;
      if (vertexMap.has(key)) return vertexMap.get(key)!;
      const idx = vertexArray.length / 3;
      vertexArray.push(v.x, v.y, v.z);
      vertexMap.set(key, idx);
      return idx;
    }

    for (const face of layerFaceList) {
      const i1 = getVertexIndex(face.v1);
      const i2 = getVertexIndex(face.v2);
      const i3 = getVertexIndex(face.v3);
      indexArray.push(i1, i2, i3);

      // If quad, triangulate as two triangles
      if (face.v4) {
        const v4Same = (
          Math.abs(face.v4.x - face.v3.x) < 0.01 &&
          Math.abs(face.v4.y - face.v3.y) < 0.01 &&
          Math.abs(face.v4.z - face.v3.z) < 0.01
        );
        if (!v4Same) {
          const i4 = getVertexIndex(face.v4);
          indexArray.push(i1, i3, i4);
        }
      }
    }

    if (vertexArray.length > 0 && indexArray.length > 0) {
      objects.push({
        name: layer,
        vertices: new Float32Array(vertexArray),
        faces: new Uint16Array(indexArray),
        material: 'default',
      });
    }
  }

  return {
    source: 'dxf',
    fileName: '',
    objects,
    materials: {},
  };
}
