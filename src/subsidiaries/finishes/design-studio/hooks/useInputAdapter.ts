/**
 * useInputAdapter — unify mouse / keyboard / touch input primitives
 * for the Cabinet Alignment System.
 *
 * The viewport itself is driven by `CameraControls`, which handles
 * camera-level input (orbit, pan, zoom, pinch) natively on both
 * desktop and touch. This hook adds the *application-level* touch
 * equivalents that don't come for free:
 *
 *   - **Touch detection** — exposes `isTouchDevice` so panels can
 *     show/hide touch-only affordances (NudgePad, bottom-sheet
 *     layouts) without assuming screen width.
 *   - **Long-press** — touch's context-menu trigger. Fires after a
 *     configurable delay (default 500ms, spec value) if the pointer
 *     hasn't moved more than `moveTolerancePx` or the user hasn't
 *     lifted.
 *   - **Two-finger detection** — tracks the number of active touch
 *     points so the drag hook can bypass snap on multi-touch (the
 *     touch equivalent of Alt-held on desktop).
 *
 * The returned `bindLongPress` helper produces a tiny props object
 * `{ onPointerDown, onPointerMove, onPointerUp, onPointerCancel }`
 * that a caller can spread onto the viewport container.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const LONG_PRESS_MS_DEFAULT = 500;
const MOVE_TOLERANCE_PX_DEFAULT = 10;

export interface LongPressPayload {
  /** Viewport-local x / y where the long-press fired. */
  clientX: number;
  clientY: number;
  /** PointerEvent target at press time (may be stale if DOM shifted). */
  target: EventTarget | null;
}

export interface UseInputAdapterOptions {
  /** ms before a stationary touch fires `onLongPress`. Default 500. */
  longPressDelayMs?: number;
  /** px the pointer is allowed to drift before the timer cancels. Default 10. */
  moveTolerancePx?: number;
  /** Called when a long-press fires. Return nothing. */
  onLongPress?: (payload: LongPressPayload) => void;
}

export interface UseInputAdapterResult {
  /** True when the current device primarily uses a coarse pointer (touch).
   *  Updates live if the user plugs/unplugs a mouse. */
  isTouchDevice: boolean;
  /** True while two or more pointers are simultaneously active — the
   *  drag hook reads this to bypass snap (Alt equivalent). */
  isMultiTouch: boolean;
  /** Spread onto the viewport container to enable long-press detection. */
  bindLongPress: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
}

/** Detect coarse-pointer devices once at mount + listen for media-query
 *  changes (user plugging in a mouse, etc.). */
function getIsCoarsePointer(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(pointer: coarse)').matches;
}

export function useInputAdapter(options: UseInputAdapterOptions = {}): UseInputAdapterResult {
  const {
    longPressDelayMs = LONG_PRESS_MS_DEFAULT,
    moveTolerancePx = MOVE_TOLERANCE_PX_DEFAULT,
    onLongPress,
  } = options;

  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(getIsCoarsePointer);
  const [isMultiTouch, setIsMultiTouch] = useState<boolean>(false);
  const onLongPressRef = useRef(onLongPress);
  onLongPressRef.current = onLongPress;

  // Coarse-pointer live detection (iPad, hybrid tablets, etc.).
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(pointer: coarse)');
    const onChange = () => setIsTouchDevice(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  // Active pointer set — drives the multi-touch flag and also gates
  // the long-press so it only arms on single-finger touches.
  const activePointers = useRef(new Set<number>());
  const longPressTimer = useRef<number | null>(null);
  const pressStart = useRef<{ id: number; x: number; y: number; target: EventTarget | null } | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    pressStart.current = null;
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    activePointers.current.add(e.pointerId);
    if (activePointers.current.size > 1) {
      setIsMultiTouch(true);
      clearLongPress();
      return;
    }
    // Only arm long-press on a touch primary button — mouse right-click
    // is handled separately and synthetic pointer events from Apple
    // Pencil fire as `pointerType === 'pen'` which we treat like touch.
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
    if (e.button !== 0 && e.button !== -1) return;

    pressStart.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      target: e.target,
    };
    const startX = e.clientX;
    const startY = e.clientY;
    const target = e.target;
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      onLongPressRef.current?.({ clientX: startX, clientY: startY, target });
    }, longPressDelayMs);
  }, [clearLongPress, longPressDelayMs]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const start = pressStart.current;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.hypot(dx, dy) > moveTolerancePx) {
      clearLongPress();
    }
  }, [clearLongPress, moveTolerancePx]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) setIsMultiTouch(false);
    if (pressStart.current?.id === e.pointerId) clearLongPress();
  }, [clearLongPress]);

  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    handlePointerUp(e);
  }, [handlePointerUp]);

  return {
    isTouchDevice,
    isMultiTouch,
    bindLongPress: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    },
  };
}
