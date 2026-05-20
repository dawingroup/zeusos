import type { ReactNode } from 'react';
import { Icon } from './Icon';

interface DemoBannerProps {
  /** What this module will eventually source. */
  source: string;
  /** Optional extra context (e.g. "Coming Q3 2026"). */
  hint?: ReactNode;
}

/**
 * DemoBanner — placed at the top of portal modules that haven't been
 * wired to live data yet. Reuses the RAG amber palette to signal
 * "informational" without alarming the client. Compact: 1 line of
 * body, suitable to slot above the PageHead inside a PortalShell.
 */
export function DemoBanner({ source, hint }: DemoBannerProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      padding: '10px 14px',
      background: 'var(--rag-amber-soft)',
      border: '1px solid rgba(225, 132, 37, 0.28)',
      borderRadius: 'var(--radius-sm)',
      color: 'var(--fg-primary)',
      font: '400 12.5px/1.5 var(--font-sans)',
    }}>
      <Icon name="star" size={14} color="var(--rag-amber)" stroke={2} style={{ flex: '0 0 auto', marginTop: 2 }} />
      <div style={{ flex: 1 }}>
        <strong style={{ font: '500 12.5px/1.5 var(--font-sans)' }}>Showcase content</strong>{' — '}
        the data shown below is illustrative.{' '}
        This module will pull from <strong>{source}</strong> when it goes live.
        {hint ? <> {hint}</> : null}
      </div>
    </div>
  );
}
