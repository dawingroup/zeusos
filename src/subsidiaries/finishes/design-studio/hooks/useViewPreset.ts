/**
 * useViewPreset — Current view preset with per-scene localStorage persistence
 */
import { useState, useCallback, useEffect } from 'react';
import type { ViewPresetKey } from '../constants/framing.constants';
import { DEFAULT_VIEW_PRESET, VIEW_PRESETS } from '../constants/framing.constants';

const STORAGE_PREFIX = 'dawin.framing.preset.';

export function useViewPreset(sceneKey: string | null = null): {
  preset: ViewPresetKey;
  setPreset: (p: ViewPresetKey) => void;
  projection: 'perspective' | 'orthographic';
} {
  const key = sceneKey ? `${STORAGE_PREFIX}${sceneKey}` : null;

  const [preset, setPresetState] = useState<ViewPresetKey>(() => {
    if (!key || typeof window === 'undefined') return DEFAULT_VIEW_PRESET;
    try {
      const stored = window.localStorage.getItem(key);
      if (stored && stored in VIEW_PRESETS) {
        return stored as ViewPresetKey;
      }
    } catch {
      // localStorage not available
    }
    return DEFAULT_VIEW_PRESET;
  });

  useEffect(() => {
    if (!key || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, preset);
    } catch {
      // ignore quota/private mode issues
    }
  }, [key, preset]);

  const setPreset = useCallback((p: ViewPresetKey) => {
    setPresetState(p);
  }, []);

  return {
    preset,
    setPreset,
    projection: VIEW_PRESETS[preset].projection,
  };
}
