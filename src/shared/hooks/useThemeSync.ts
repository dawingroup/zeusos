import { useEffect } from 'react';
import { useUIStore } from '../stores/uiStore';
import { usePlatformDefaults } from './usePlatformDefaults';

/**
 * Mirrors uiStore preferences onto <html> as data attributes so CSS variable
 * selectors ([data-theme], [data-density], [data-accent]) resolve correctly.
 * Mount once at the app root.
 */
export function useThemeSync() {
  // Seed user preferences from platform defaults on first authenticated load.
  usePlatformDefaults();

  const theme = useUIStore((s) => s.theme);
  const density = useUIStore((s) => s.density);
  const accent = useUIStore((s) => s.accent);

  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      const resolved =
        theme === 'system'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : theme;

      root.setAttribute('data-theme', resolved);
      root.classList.toggle('dark', resolved === 'dark');
    };

    apply();

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-density', density);
  }, [density]);

  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accent);
  }, [accent]);
}

/**
 * Headless component variant — renders nothing, just runs the effect.
 */
export function ThemeSync(): null {
  useThemeSync();
  return null;
}
