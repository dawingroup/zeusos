import { useEffect, type RefObject } from 'react';
import { useRailStore } from '@/shared/stores/railStore';

/** Where the eye is typing — `]` must stay a character there. */
function isTypingTarget(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node || typeof node.tagName !== 'string') return false;
  const tag = node.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || node.isContentEditable === true;
}

/** `]` toggles the rail anywhere outside a text field. */
export function useRailShortcut(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ']' || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      useRailStore.getState().toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/**
 * The rail is `position: fixed` under the top bar, the way the sidebar is fixed
 * beside the canvas. The shell has two headers (desktop two-row, mobile) and an
 * offline banner above them, so the top is measured, not assumed, and published
 * as `--shell-top` on <html>.
 */
export function useShellTop(headers: Array<RefObject<HTMLElement | null>>): void {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const bottom = headers.reduce((max, ref) => {
        const rect = ref.current?.getBoundingClientRect();
        return rect && rect.height > 0 ? Math.max(max, rect.bottom) : max;
      }, 0);
      const next = `${Math.max(0, Math.round(bottom))}px`;
      if (root.style.getPropertyValue('--shell-top') !== next) root.style.setProperty('--shell-top', next);
    };
    apply();
    const ro = new ResizeObserver(apply);
    headers.forEach((ref) => ref.current && ro.observe(ref.current));
    // The offline banner scrolls away above the sticky header.
    window.addEventListener('scroll', apply, { passive: true });
    window.addEventListener('resize', apply);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
      root.style.removeProperty('--shell-top');
    };
    // The refs are stable for the shell's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
