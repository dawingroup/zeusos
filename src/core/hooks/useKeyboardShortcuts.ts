import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearch, useSidebar } from '@/integration/store';

interface ShortcutHelp {
  keys: string;
  description: string;
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const { isOpen, openSearch, closeSearch } = useSearch();
  const { toggleSidebar } = useSidebar();

  const shortcuts: ShortcutHelp[] = useMemo(
    () => [
      { keys: 'Ctrl+K', description: 'Open global search' },
      { keys: 'Ctrl+B', description: 'Toggle sidebar' },
      { keys: 'G D', description: 'Go to dashboard' },
      { keys: 'G H', description: 'Go to HR' },
      { keys: 'G S', description: 'Go to Strategy' },
      { keys: 'G F', description: 'Go to Finance' },
      { keys: 'Esc', description: 'Close dialogs' },
    ],
    []
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      const key = event.key.toLowerCase();
      const ctrl = event.ctrlKey || event.metaKey;

      if (ctrl && key === 'k') {
        event.preventDefault();
        if (isOpen) closeSearch();
        else openSearch();
        return;
      }

      if (ctrl && key === 'b') {
        event.preventDefault();
        toggleSidebar();
        return;
      }

      if (event.key === 'Escape') {
        if (isOpen) {
          event.preventDefault();
          closeSearch();
        }
        return;
      }

      if (isTypingTarget) return;

      // Two-key navigation: "g" then key within 500ms
      if (key === 'g') {
        const handler = (nextEvent: KeyboardEvent) => {
          const nextKey = nextEvent.key.toLowerCase();
          if (nextKey === 'd') {
            nextEvent.preventDefault();
            navigate('/dashboard');
          }
          if (nextKey === 'h') {
            nextEvent.preventDefault();
            navigate('/hr');
          }
          if (nextKey === 's') {
            nextEvent.preventDefault();
            navigate('/strategy');
          }
          if (nextKey === 'f') {
            nextEvent.preventDefault();
            navigate('/finance');
          }
          document.removeEventListener('keydown', handler);
        };

        document.addEventListener('keydown', handler);
        window.setTimeout(() => {
          document.removeEventListener('keydown', handler);
        }, 500);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeSearch, isOpen, navigate, openSearch, toggleSidebar]);

  return { shortcuts };
}

export function useCustomShortcut(
  key: string,
  handler: () => void,
  options: {
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
    enabled?: boolean;
  } = {}
) {
  const { ctrlKey, shiftKey, altKey, enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const keyMatch = key.toLowerCase() === event.key.toLowerCase();
      const ctrlMatch = ctrlKey ? event.ctrlKey || event.metaKey : true;
      const shiftMatch = shiftKey ? event.shiftKey : true;
      const altMatch = altKey ? event.altKey : true;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        event.preventDefault();
        handler();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [altKey, ctrlKey, enabled, handler, key, shiftKey]);
}
