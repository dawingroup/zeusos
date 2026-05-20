import { useRef, useState, useEffect, type ReactNode } from 'react';
import { ResponsiveContainer, type ResponsiveContainerProps as RCProps } from 'recharts';

type SafeResponsiveContainerProps = RCProps & { children: ReactNode };

/**
 * Wraps recharts ResponsiveContainer to prevent rendering when the
 * container has zero or negative dimensions (hidden tabs, loading states, etc.).
 * Uses ResizeObserver to detect when the container becomes visible.
 */
export function SafeResponsiveContainer({ children, ...props }: SafeResponsiveContainerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (ready) return;

    const check = (entries?: ResizeObserverEntry[]) => {
      // Use ResizeObserver entry if available (more accurate), fall back to getBoundingClientRect
      let w = 0, h = 0;
      if (entries && entries.length > 0) {
        const entry = entries[0];
        w = entry.contentRect.width;
        h = entry.contentRect.height;
      } else {
        const rect = el.getBoundingClientRect();
        w = rect.width;
        h = rect.height;
      }
      if (w > 1 && h > 1) {
        setReady(true);
      }
    };

    // Check immediately
    check();

    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ready]);

  return (
    <div
      ref={ref}
      style={{
        width: props.width ?? '100%',
        height: props.height ?? '100%',
        minWidth: 0,
        minHeight: 0,
      }}
    >
      {ready ? (
        <ResponsiveContainer {...props} minWidth={0}>
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}
