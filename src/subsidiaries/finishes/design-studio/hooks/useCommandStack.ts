/**
 * useCommandStack — undo/redo for the Cabinet Alignment System.
 *
 * Pure command pattern: a mutation is a `{ do, undo, label }` object.
 * The stack records commands as they execute (callers `push` them),
 * keyboard shortcuts (`Cmd/Ctrl+Z`, `Shift+Cmd/Ctrl+Z`) replay
 * `undo` / `do` on the most recent entry, and everything is capped
 * at `MAX_HISTORY` (50 per the spec) so we don't grow unbounded.
 *
 * Commands are opaque to this hook — they don't know about cabinets,
 * groups, Firestore, or React. Callers construct them using the
 * helpers in `types/commands.ts`.
 *
 * The `do` function is NOT re-run on initial push (callers already
 * performed the mutation); it only runs on redo. This avoids a
 * spurious double-write when a user takes an action.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface AlignmentCommand {
  /** Short human-readable description shown in dev console / telemetry. */
  label: string;
  /** Re-apply the mutation. Called on redo. */
  do: () => Promise<void> | void;
  /** Revert the mutation. Called on undo. */
  undo: () => Promise<void> | void;
}

const MAX_HISTORY = 50;

interface UseCommandStackResult {
  push: (cmd: AlignmentCommand) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
  /** Clear everything — used when switching scenes. */
  clear: () => void;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

export function useCommandStack(enabled: boolean = true): UseCommandStackResult {
  // Undo-able past: newest on the end.
  const [undoStack, setUndoStack] = useState<AlignmentCommand[]>([]);
  // Re-doable future: newest on the end.
  const [redoStack, setRedoStack] = useState<AlignmentCommand[]>([]);

  // Mirror the latest stacks in a ref so the keyboard handler can
  // read them without re-subscribing every push. State still drives
  // the `canUndo`/`canRedo` booleans for UI badges later.
  const undoRef = useRef(undoStack);
  const redoRef = useRef(redoStack);
  undoRef.current = undoStack;
  redoRef.current = redoStack;

  const push = useCallback((cmd: AlignmentCommand) => {
    setUndoStack(prev => {
      const next = [...prev, cmd];
      // Cap history — drop the oldest entry when we exceed the budget.
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });
    // New action invalidates the redo future.
    setRedoStack([]);
  }, []);

  const undo = useCallback(async () => {
    const stack = undoRef.current;
    if (stack.length === 0) return;
    const cmd = stack[stack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    try {
      await cmd.undo();
      setRedoStack(prev => [...prev, cmd]);
    } catch (err) {
      console.warn('[useCommandStack] undo failed:', err, cmd.label);
      // Put it back so the user can retry.
      setUndoStack(prev => [...prev, cmd]);
    }
  }, []);

  const redo = useCallback(async () => {
    const stack = redoRef.current;
    if (stack.length === 0) return;
    const cmd = stack[stack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    try {
      await cmd.do();
      setUndoStack(prev => [...prev, cmd]);
    } catch (err) {
      console.warn('[useCommandStack] redo failed:', err, cmd.label);
      setRedoStack(prev => [...prev, cmd]);
    }
  }, []);

  const clear = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  // Keyboard bindings. Cmd/Ctrl+Z → undo; Shift+Cmd/Ctrl+Z → redo.
  // Also support `Ctrl+Y` as a common Windows redo alternative.
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, undo, redo]);

  return {
    push,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    clear,
  };
}
