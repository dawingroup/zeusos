/**
 * 3DS Binary File Parser
 * Reads PolyBoard 3DS exports by walking the chunk hierarchy.
 * All integers are little-endian. Strings are null-terminated ASCII.
 *
 * Chunk structure: 2-byte ID + 4-byte length (includes header).
 *
 * Hierarchy:
 *   0x4D4D (Main)
 *     └─ 0x3D3D (Editor)
 *          ├─ 0xAFFF (Material)
 *          │    ├─ 0xA000 (Material Name)
 *          │    └─ 0xA020 (Diffuse Color)
 *          │         └─ 0x0011 (Color24)
 *          └─ 0x4000 (Object)
 *               ├─ Name (null-terminated)
 *               └─ 0x4100 (Tri Mesh)
 *                    ├─ 0x4110 (Vertex List)
 *                    ├─ 0x4120 (Face List)
 *                    │    └─ 0x4130 (Face Material)
 *                    └─ 0x4160 (Translation Matrix) — ignored
 */

import type { ParsedModel, MeshObject, MaterialDef } from '../types/workshop-viewer.types';

// Chunk IDs
const CHUNK_MAIN       = 0x4D4D;
const CHUNK_EDITOR     = 0x3D3D;
const CHUNK_MATERIAL   = 0xAFFF;
const CHUNK_MAT_NAME   = 0xA000;
const CHUNK_MAT_DIFFUSE = 0xA020;
const CHUNK_COLOR24    = 0x0011;
const CHUNK_COLOR_F    = 0x0010;
const CHUNK_OBJECT     = 0x4000;
const CHUNK_TRI_MESH   = 0x4100;
const CHUNK_VERTEX_LIST = 0x4110;
const CHUNK_FACE_LIST  = 0x4120;
const CHUNK_FACE_MAT   = 0x4130;

interface ChunkHeader {
  id: number;
  length: number;
  dataStart: number; // offset after the 6-byte header
}

/**
 * Parse a 3DS binary file into a ParsedModel.
 */
export function parse3DS(buffer: ArrayBuffer): ParsedModel {
  const view = new DataView(buffer);
  const objects: MeshObject[] = [];
  const materials: Record<string, MaterialDef> = {};

  function readChunkHeader(offset: number): ChunkHeader {
    const id = view.getUint16(offset, true);
    const length = view.getUint32(offset + 2, true);
    return { id, length, dataStart: offset + 6 };
  }

  function readNullTerminatedString(offset: number): { str: string; bytesRead: number } {
    let str = '';
    let i = offset;
    while (i < buffer.byteLength && view.getUint8(i) !== 0) {
      str += String.fromCharCode(view.getUint8(i));
      i++;
    }
    return { str, bytesRead: i - offset + 1 }; // +1 for null terminator
  }

  function parseVertexList(offset: number): Float32Array {
    const count = view.getUint16(offset, true);
    const vertices = new Float32Array(count * 3);
    let pos = offset + 2;
    for (let i = 0; i < count; i++) {
      vertices[i * 3]     = view.getFloat32(pos, true);      // X
      vertices[i * 3 + 1] = view.getFloat32(pos + 4, true);  // Y
      vertices[i * 3 + 2] = view.getFloat32(pos + 8, true);  // Z
      pos += 12;
    }
    return vertices;
  }

  function parseFaceList(offset: number): { faces: Uint16Array; faceCount: number; bytesRead: number } {
    const count = view.getUint16(offset, true);
    const faces = new Uint16Array(count * 3);
    let pos = offset + 2;
    for (let i = 0; i < count; i++) {
      faces[i * 3]     = view.getUint16(pos, true);      // vertex A
      faces[i * 3 + 1] = view.getUint16(pos + 2, true);  // vertex B
      faces[i * 3 + 2] = view.getUint16(pos + 4, true);  // vertex C
      // skip face flags (uint16)
      pos += 8;
    }
    return { faces, faceCount: count, bytesRead: pos - offset };
  }

  function parseFaceMaterial(offset: number, chunkEnd: number): { materialName: string; faceIndices: number[] } {
    const { str: materialName, bytesRead } = readNullTerminatedString(offset);
    let pos = offset + bytesRead;
    const faceCount = view.getUint16(pos, true);
    pos += 2;
    const faceIndices: number[] = [];
    for (let i = 0; i < faceCount && pos < chunkEnd; i++) {
      faceIndices.push(view.getUint16(pos, true));
      pos += 2;
    }
    return { materialName, faceIndices };
  }

  function parseColor24(offset: number): [number, number, number] {
    return [
      view.getUint8(offset) / 255,
      view.getUint8(offset + 1) / 255,
      view.getUint8(offset + 2) / 255,
    ];
  }

  function parseColorFloat(offset: number): [number, number, number] {
    return [
      view.getFloat32(offset, true),
      view.getFloat32(offset + 4, true),
      view.getFloat32(offset + 8, true),
    ];
  }

  function parseMaterial(startOffset: number, chunkEnd: number): void {
    let materialName = '';
    let diffuse: [number, number, number] = [0.8, 0.8, 0.8];
    let offset = startOffset;

    while (offset < chunkEnd) {
      if (offset + 6 > buffer.byteLength) break;
      const chunk = readChunkHeader(offset);
      const subEnd = offset + chunk.length;

      switch (chunk.id) {
        case CHUNK_MAT_NAME: {
          const { str } = readNullTerminatedString(chunk.dataStart);
          materialName = str;
          break;
        }
        case CHUNK_MAT_DIFFUSE: {
          // Walk sub-chunks looking for Color24 or ColorFloat
          let colorOffset = chunk.dataStart;
          while (colorOffset < subEnd) {
            if (colorOffset + 6 > buffer.byteLength) break;
            const colorChunk = readChunkHeader(colorOffset);
            if (colorChunk.id === CHUNK_COLOR24) {
              diffuse = parseColor24(colorChunk.dataStart);
            } else if (colorChunk.id === CHUNK_COLOR_F) {
              diffuse = parseColorFloat(colorChunk.dataStart);
            }
            colorOffset += colorChunk.length;
          }
          break;
        }
      }
      offset = subEnd;
    }

    if (materialName) {
      materials[materialName] = { diffuse };
    }
  }

  function parseObject(startOffset: number, chunkEnd: number): void {
    // Object name is null-terminated string at start of data
    const { str: objectName, bytesRead } = readNullTerminatedString(startOffset);
    let offset = startOffset + bytesRead;

    let vertices: Float32Array | null = null;
    let faces: Uint16Array | null = null;
    let materialName = '';

    while (offset < chunkEnd) {
      if (offset + 6 > buffer.byteLength) break;
      const chunk = readChunkHeader(offset);
      const subEnd = offset + chunk.length;

      if (chunk.id === CHUNK_TRI_MESH) {
        // Walk tri-mesh sub-chunks
        let meshOffset = chunk.dataStart;
        while (meshOffset < subEnd) {
          if (meshOffset + 6 > buffer.byteLength) break;
          const meshChunk = readChunkHeader(meshOffset);
          const meshSubEnd = meshOffset + meshChunk.length;

          switch (meshChunk.id) {
            case CHUNK_VERTEX_LIST:
              vertices = parseVertexList(meshChunk.dataStart);
              break;
            case CHUNK_FACE_LIST: {
              const faceResult = parseFaceList(meshChunk.dataStart);
              faces = faceResult.faces;
              // Check for face material sub-chunks within face list
              let faceSubOffset = meshChunk.dataStart + faceResult.bytesRead;
              while (faceSubOffset < meshSubEnd) {
                if (faceSubOffset + 6 > buffer.byteLength) break;
                const faceSubChunk = readChunkHeader(faceSubOffset);
                if (faceSubChunk.id === CHUNK_FACE_MAT) {
                  const mat = parseFaceMaterial(faceSubChunk.dataStart, faceSubOffset + faceSubChunk.length);
                  if (mat.materialName) {
                    materialName = mat.materialName;
                  }
                }
                faceSubOffset += faceSubChunk.length;
              }
              break;
            }
          }
          meshOffset = meshSubEnd;
        }
      }
      offset = subEnd;
    }

    if (vertices && faces && vertices.length > 0 && faces.length > 0) {
      objects.push({
        name: objectName,
        vertices,
        faces,
        material: materialName || 'default',
      });
    }
  }

  function parseEditor(startOffset: number, chunkEnd: number): void {
    let offset = startOffset;
    while (offset < chunkEnd) {
      if (offset + 6 > buffer.byteLength) break;
      const chunk = readChunkHeader(offset);
      const subEnd = offset + chunk.length;

      switch (chunk.id) {
        case CHUNK_MATERIAL:
          parseMaterial(chunk.dataStart, subEnd);
          break;
        case CHUNK_OBJECT:
          parseObject(chunk.dataStart, subEnd);
          break;
      }
      offset = subEnd;
    }
  }

  // Start parsing from the main chunk
  if (buffer.byteLength < 6) {
    throw new Error('File too small to be a valid 3DS file');
  }

  const mainChunk = readChunkHeader(0);
  if (mainChunk.id !== CHUNK_MAIN) {
    throw new Error(`Invalid 3DS file: expected main chunk 0x4D4D, got 0x${mainChunk.id.toString(16)}`);
  }

  // Walk main chunk's sub-chunks
  let offset = mainChunk.dataStart;
  const mainEnd = mainChunk.length;
  while (offset < mainEnd) {
    if (offset + 6 > buffer.byteLength) break;
    const chunk = readChunkHeader(offset);
    if (chunk.id === CHUNK_EDITOR) {
      parseEditor(chunk.dataStart, offset + chunk.length);
    }
    offset += chunk.length;
  }

  return {
    source: '3ds',
    fileName: '',
    objects,
    materials,
  };
}
