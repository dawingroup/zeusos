import { describe, expect, it } from 'vitest';
import {
  filterCuttableParts,
  isCuttablePart,
  isSceneOriginComponentPart,
} from '../cuttableParts';

describe('cuttableParts guard', () => {
  it('flags scene-origin component parts as non-cuttable', () => {
    const sceneComponent = { partType: 'component', source: 'design-studio' };

    expect(isSceneOriginComponentPart(sceneComponent)).toBe(true);
    expect(isCuttablePart(sceneComponent)).toBe(false);
  });

  it('keeps non-scene components cuttable', () => {
    const manualComponent = { partType: 'component', source: 'manual' };
    expect(isCuttablePart(manualComponent)).toBe(true);
  });

  it('keeps scene-origin non-components cuttable', () => {
    const scenePanel = { partType: 'sheet', source: 'design-studio' };
    expect(isCuttablePart(scenePanel)).toBe(true);
  });

  it('filters only scene-origin component rows', () => {
    const parts = [
      { id: 'a', partType: 'component', source: 'design-studio' },
      { id: 'b', partType: 'component', source: 'manual' },
      { id: 'c', partType: 'sheet', source: 'design-studio' },
      { id: 'd', partType: 'sheet', source: 'csv-import' },
    ];

    expect(filterCuttableParts(parts).map((p) => p.id)).toEqual(['b', 'c', 'd']);
  });
});
