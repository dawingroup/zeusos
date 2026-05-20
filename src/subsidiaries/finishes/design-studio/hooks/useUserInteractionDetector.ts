/**
 * useUserInteractionDetector — Listen to OrbitControls / camera-controls events
 *
 * When the user grabs the mouse to orbit/pan, framing pauses. After the user
 * releases AND a debounce period passes, the system can re-engage (though the
 * caller decides whether to actually re-frame — typically only on RECENTER).
 */
import { useEffect, useRef } from 'react';
import { USER_CONTROL_PAUSE_MS } from '../constants/framing.constants';

interface MinimalControls {
  addEventListener: (type: string, handler: (event?: unknown) => void) => void;
  removeEventListener: (type: string, handler: (event?: unknown) => void) => void;
}

interface UseUserInteractionDetectorProps {
  controls: MinimalControls | null;
  onStart?: () => void;
  onEnd?: () => void;
  debounceMs?: number;
}

export function useUserInteractionDetector({
  controls,
  onStart,
  onEnd,
  debounceMs = USER_CONTROL_PAUSE_MS,
}: UseUserInteractionDetectorProps): void {
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!controls) return;

    const handleStart = () => {
      if (endTimerRef.current) {
        clearTimeout(endTimerRef.current);
        endTimerRef.current = null;
      }
      onStart?.();
    };

    const handleEnd = () => {
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
      endTimerRef.current = setTimeout(() => {
        onEnd?.();
        endTimerRef.current = null;
      }, debounceMs);
    };

    // camera-controls uses 'controlstart' / 'controlend'; THREE OrbitControls uses 'start' / 'end'
    controls.addEventListener('controlstart', handleStart);
    controls.addEventListener('controlend', handleEnd);
    controls.addEventListener('start', handleStart);
    controls.addEventListener('end', handleEnd);

    return () => {
      controls.removeEventListener('controlstart', handleStart);
      controls.removeEventListener('controlend', handleEnd);
      controls.removeEventListener('start', handleStart);
      controls.removeEventListener('end', handleEnd);
      if (endTimerRef.current) {
        clearTimeout(endTimerRef.current);
        endTimerRef.current = null;
      }
    };
  }, [controls, onStart, onEnd, debounceMs]);
}
