/**
 * sceneProjectUtils.test — covers the pure helpers, focusing on
 * P21.10's `suggestSceneName` (auto-derived scene names from the parent
 * project).
 */
import { describe, expect, it } from 'vitest';
import {
  isProjectBoundProjectId,
  isStandaloneProjectId,
  suggestSceneName,
} from '../utils/sceneProjectUtils';

describe('isStandaloneProjectId', () => {
  it('treats empty / undefined / "standalone" as standalone', () => {
    expect(isStandaloneProjectId(undefined)).toBe(true);
    expect(isStandaloneProjectId(null)).toBe(true);
    expect(isStandaloneProjectId('')).toBe(true);
    expect(isStandaloneProjectId('standalone')).toBe(true);
  });
  it('treats a real project id as non-standalone', () => {
    expect(isStandaloneProjectId('proj-abc-123')).toBe(false);
  });
});

describe('isProjectBoundProjectId', () => {
  it('is the inverse of isStandaloneProjectId', () => {
    expect(isProjectBoundProjectId('proj-123')).toBe(true);
    expect(isProjectBoundProjectId('standalone')).toBe(false);
    expect(isProjectBoundProjectId(null)).toBe(false);
  });
});

describe('suggestSceneName', () => {
  it('appends " - Scene 1" when no scenes exist', () => {
    expect(suggestSceneName('Mukasa Kitchen', [])).toBe('Mukasa Kitchen - Scene 1');
  });

  it('enumerates past existing scenes', () => {
    expect(
      suggestSceneName('Mukasa Kitchen', [
        'Mukasa Kitchen - Scene 1',
        'Mukasa Kitchen - Scene 2',
      ]),
    ).toBe('Mukasa Kitchen - Scene 3');
  });

  it('fills gaps (renames in place)', () => {
    expect(
      suggestSceneName('Mukasa Kitchen', [
        'Mukasa Kitchen - Scene 1',
        'Mukasa Kitchen - Scene 3',
      ]),
    ).toBe('Mukasa Kitchen - Scene 2');
  });

  it('is case-insensitive when checking collisions', () => {
    expect(
      suggestSceneName('Kitchen', ['kitchen - scene 1']),
    ).toBe('Kitchen - Scene 2');
  });

  it('handles empty project name with "Scene N" fallback', () => {
    expect(suggestSceneName('', [])).toBe('Scene 1');
    expect(suggestSceneName('  ', ['Scene 1'])).toBe('Scene 2');
  });

  it('ignores unrelated existing names', () => {
    expect(
      suggestSceneName('Kitchen', ['Bathroom - Scene 1', 'Random Thing']),
    ).toBe('Kitchen - Scene 1');
  });
});
