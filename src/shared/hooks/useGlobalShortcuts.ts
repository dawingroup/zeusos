import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * `G + <letter>` sequential shortcuts (Linear/GitHub pattern).
 * Mount once at the app shell.
 *
 *   G S → Strategy
 *   G H → HR
 *   G F → Finance
 *   G C → Capital
 *   G O → Compliance
 *   G M → Market Intel
 *
 * Emits a `keyprefix` window CustomEvent({ detail: 'G' }) when the prefix
 * is active so pills can render a kbd hint.
 */
export function useGlobalShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    let prefix: string | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const clear = () => {
      prefix = null;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const onKey = (e: KeyboardEvent) => {
      const target = document.activeElement as HTMLElement | null;
      const tag = target?.tagName;
      const inField =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable;
      if (inField || e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      if (key === 'g' && !prefix) {
        prefix = 'G';
        timer = setTimeout(clear, 1200);
        window.dispatchEvent(new CustomEvent('keyprefix', { detail: 'G' }));
        return;
      }

      if (prefix === 'G') {
        const map: Record<string, string> = {
          s: '/strategy',
          h: '/hr/employees',
          f: '/finance/budgets',
          c: '/capital/dashboard',
          o: '/compliance',
          m: '/market-intel/competitors',
        };
        const target = map[key];
        if (target) {
          e.preventDefault();
          navigate(target);
        }
        clear();
        // Tell listeners the prefix cleared.
        window.dispatchEvent(new CustomEvent('keyprefix', { detail: null }));
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      clear();
    };
  }, [navigate]);
}
