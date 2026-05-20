import { describe, expect, it } from 'vitest';
import {
  isCoverLikeMeshName,
  repairUnassignedCoverMeshes,
} from '../cabinetDetector.service';
import type { DetectedCabinet } from '../../types/cabinetDetection.types';

function makeCabinet(partial: Partial<DetectedCabinet>): DetectedCabinet {
  return {
    provisionalCode: partial.provisionalCode ?? 'KB-A',
    suggestedName: partial.suggestedName ?? 'Cabinet A',
    meshNames: partial.meshNames ?? [],
    boundingBox: partial.boundingBox ?? {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 600, y: 720, z: 560 },
      size: { x: 600, y: 720, z: 560 },
    },
    centroid: partial.centroid ?? { x: 300, y: 360, z: 280 },
    confidence: partial.confidence ?? 0.9,
    reasoning: partial.reasoning ?? 'Detected by tests',
    selected: partial.selected ?? true,
    sequence: partial.sequence ?? 0,
    suggestedArchetypeKey: partial.suggestedArchetypeKey,
  };
}

describe('isCoverLikeMeshName', () => {
  it('recognizes typical cover mesh labels', () => {
    expect(isCoverLikeMeshName('Gable_Cover_Left')).toBe(true);
    expect(isCoverLikeMeshName('modesty_panel_front')).toBe(true);
  });

  it('does not flag generic structural names', () => {
    expect(isCoverLikeMeshName('side_panel_1')).toBe(false);
    expect(isCoverLikeMeshName('shelf_03')).toBe(false);
  });
});

describe('repairUnassignedCoverMeshes', () => {
  it('auto-attaches unassigned cover meshes to nearest cabinet', () => {
    const cabinets = [
      makeCabinet({
        provisionalCode: 'KB-A',
        meshNames: ['side_a', 'bottom_a'],
        boundingBox: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 600, y: 720, z: 560 },
          size: { x: 600, y: 720, z: 560 },
        },
      }),
      makeCabinet({
        provisionalCode: 'KB-B',
        meshNames: ['side_b', 'bottom_b'],
        boundingBox: {
          min: { x: 700, y: 0, z: 0 },
          max: { x: 1300, y: 720, z: 560 },
          size: { x: 600, y: 720, z: 560 },
        },
      }),
    ];
    const unassigned = [
      { meshName: 'Gable_Cover_Right', reason: 'ai uncertain' },
      { meshName: 'stray_hardware', reason: 'floating tiny object' },
    ];
    const meshes = [
      { name: 'Gable_Cover_Right', bbox: { min: [1280, 0, 0] as [number, number, number], max: [1320, 720, 560] as [number, number, number] } },
      { name: 'stray_hardware', bbox: { min: [2500, 10, 10] as [number, number, number], max: [2510, 20, 20] as [number, number, number] } },
    ];

    const repaired = repairUnassignedCoverMeshes(cabinets, unassigned, meshes);

    expect(repaired.cabinets[1].meshNames).toContain('Gable_Cover_Right');
    expect(repaired.unassigned).toEqual([
      { meshName: 'stray_hardware', reason: 'floating tiny object' },
    ]);
  });

  it('rescues generic mesh names when AI reason marks trim/filler', () => {
    const cabinets = [
      makeCabinet({
        provisionalCode: 'KB-A',
        meshNames: ['side_a', 'bottom_a'],
        boundingBox: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 600, y: 720, z: 560 },
          size: { x: 600, y: 720, z: 560 },
        },
      }),
      makeCabinet({
        provisionalCode: 'KB-B',
        meshNames: ['side_b', 'bottom_b'],
        boundingBox: {
          min: { x: 700, y: 0, z: 0 },
          max: { x: 1300, y: 720, z: 560 },
          size: { x: 600, y: 720, z: 560 },
        },
      }),
    ];
    const unassigned = [
      { meshName: 'Layer_object 80', reason: 'Appears to be trim/filler piece, not structural cabinet component.' },
      { meshName: 'stray_hardware', reason: 'floating tiny object' },
    ];
    const meshes = [
      { name: 'Layer_object 80', bbox: { min: [1280, 0, 0] as [number, number, number], max: [1320, 720, 560] as [number, number, number] } },
      { name: 'stray_hardware', bbox: { min: [2500, 10, 10] as [number, number, number], max: [2510, 20, 20] as [number, number, number] } },
    ];

    const repaired = repairUnassignedCoverMeshes(cabinets, unassigned, meshes);

    expect(repaired.cabinets[1].meshNames).toContain('Layer_object 80');
    expect(repaired.unassigned).toEqual([
      { meshName: 'stray_hardware', reason: 'floating tiny object' },
    ]);
  });

  it('rescues dropped cover-like meshes not listed in unassigned', () => {
    const cabinets = [
      makeCabinet({
        provisionalCode: 'KB-A',
        meshNames: ['side_a', 'bottom_a'],
        boundingBox: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 600, y: 720, z: 560 },
          size: { x: 600, y: 720, z: 560 },
        },
      }),
      makeCabinet({
        provisionalCode: 'KB-B',
        meshNames: ['side_b', 'bottom_b'],
        boundingBox: {
          min: { x: 700, y: 0, z: 0 },
          max: { x: 1300, y: 720, z: 560 },
          size: { x: 600, y: 720, z: 560 },
        },
      }),
    ];
    const unassigned = [
      { meshName: 'stray_hardware', reason: 'floating tiny object' },
    ];
    const meshes = [
      { name: 'side_a', bbox: { min: [0, 0, 0] as [number, number, number], max: [20, 720, 560] as [number, number, number] } },
      { name: 'side_b', bbox: { min: [700, 0, 0] as [number, number, number], max: [720, 720, 560] as [number, number, number] } },
      { name: 'Gable_Cover_Right', bbox: { min: [1280, 0, 0] as [number, number, number], max: [1320, 720, 560] as [number, number, number] } },
      { name: 'stray_hardware', bbox: { min: [2500, 10, 10] as [number, number, number], max: [2510, 20, 20] as [number, number, number] } },
    ];

    const repaired = repairUnassignedCoverMeshes(cabinets, unassigned, meshes);

    expect(repaired.cabinets[1].meshNames).toContain('Gable_Cover_Right');
    expect(repaired.unassigned).toEqual([
      { meshName: 'stray_hardware', reason: 'floating tiny object' },
    ]);
  });
});
