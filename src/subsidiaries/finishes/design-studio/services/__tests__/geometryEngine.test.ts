import { describe, it, expect } from 'vitest';
import { estimateMeshDimensions } from '../geometryEngine';

function makeBoxVertices(width: number, depth: number, height: number): Float32Array {
  const x = width / 2;
  const y = depth / 2;
  const z = height / 2;
  return new Float32Array([
    -x, -y, -z,
    x, -y, -z,
    x, y, -z,
    -x, y, -z,
    -x, -y, z,
    x, -y, z,
    x, y, z,
    -x, y, z,
  ]);
}

function rotateZ(vertices: Float32Array, angleRad: number): Float32Array {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  const out = new Float32Array(vertices.length);
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i];
    const y = vertices[i + 1];
    out[i] = x * c - y * s;
    out[i + 1] = x * s + y * c;
    out[i + 2] = vertices[i + 2];
  }
  return out;
}

describe('estimateMeshDimensions', () => {
  it('returns stable LWT dimensions for axis-aligned cuboid', () => {
    const v = makeBoxVertices(600, 350, 18);
    const dims = estimateMeshDimensions(v);
    expect(Math.round(dims.length)).toBe(600);
    expect(Math.round(dims.width)).toBe(350);
    expect(Math.round(dims.thickness)).toBe(18);
    expect(dims.method).toBe('obb');
  });

  it('detects uncertainty when OBB differs materially from AABB', () => {
    const v = rotateZ(makeBoxVertices(800, 300, 18), Math.PI / 4);
    const dims = estimateMeshDimensions(v);
    expect(dims.uncertain).toBe(true);
    expect(dims.confidence).toBeLessThan(0.9);
    expect(Math.round(dims.length)).toBeGreaterThanOrEqual(790);
    expect(Math.round(dims.thickness)).toBeLessThanOrEqual(25);
  });
});
