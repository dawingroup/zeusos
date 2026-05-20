import { useEffect, useRef, useState } from 'react';

/**
 * useClickOutside — generic toggle hook for popovers/dropdowns.
 *
 * Returns `{ open, setOpen, ref }`. Attach `ref` to the wrapping
 * element (trigger + menu both inside it). Any pointerdown or
 * Escape outside that wrapper closes the popover.
 */
export function useClickOutside<T extends HTMLElement = HTMLDivElement>() {
  const [open, setOpen] = useState(false);
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (ref.current && target && !ref.current.contains(target)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    // pointerdown fires before click, so menu items can still click-close
    // via their own handlers without racing.
    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return { open, setOpen, ref };
}
