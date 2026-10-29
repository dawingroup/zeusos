/**
 * The document shell the memo pages share: a page head (back, title, meta,
 * actions), numbered section cards, and the contents rail beside the
 * continuous document. Plain primitives — the memo is a formal document, not
 * a dashboard.
 */
import type { CSSProperties, ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';

export function DocHeader({ onBack, backLabel, title, meta, actions }: {
  onBack: () => void;
  backLabel: string;
  title: ReactNode;
  meta?: ReactNode[];
  actions?: ReactNode;
}) {
  const shown = (meta ?? []).filter((m) => m !== null && m !== undefined && m !== '');
  return (
    <div style={{ marginBottom: 16 }}>
      <button type="button" className="btn btn-ghost" onClick={onBack} style={{ paddingLeft: 0, marginBottom: 8 }}>
        <ChevronLeft size={14} /> {backLabel}
      </button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div style={{ minWidth: 0 }}>
          <div className="flex flex-wrap items-center gap-2 text-h2 font-semibold" style={{ color: 'var(--fg-primary)' }}>{title}</div>
          {shown.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--fg-tertiary)' }}>
              {shown.map((m, i) => <span key={i}>{m}</span>)}
            </div>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function docSectionNumber(n: number): string {
  return n === 0 ? '§' : String(n).padStart(2, '0');
}

export function DocSection({ id, n, title, kicker, action, muted, children }: {
  id: string;
  n: string;
  title: ReactNode;
  kicker?: ReactNode;
  action?: ReactNode;
  muted?: boolean;
  children: ReactNode;
}) {
  return (
    <section id={`memo-section-${id}`} data-section={id} style={{ marginBottom: 20, opacity: muted ? 0.6 : 1, scrollMarginTop: 80 }}>
      <div className="flex items-start justify-between gap-3" style={{ marginBottom: 8 }}>
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-mono text-tiny" style={{ color: 'var(--fg-tertiary)' }}>{n}</span>
            <h2 className="text-body font-semibold" style={{ color: 'var(--fg-primary)' }}>{title}</h2>
          </div>
          {kicker && <p className="text-small" style={{ color: 'var(--fg-tertiary)', marginTop: 2 }}>{kicker}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export interface DocTocItem { key: string; n: string; label: ReactNode; badge?: string; tone?: 'green' | 'amber' | 'red' | 'na'; muted?: boolean }

const TONE_COLOR: Record<NonNullable<DocTocItem['tone']>, string> = {
  green: 'var(--rag-green)', amber: 'var(--rag-amber)', red: 'var(--rag-red)', na: 'var(--fg-tertiary)',
};

export function DocLayout({ toc, children }: { toc: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]" style={{ alignItems: 'flex-start' }}>
      <div style={{ minWidth: 0 }}>{children}</div>
      <aside className="hidden lg:block" style={{ position: 'sticky', top: 16 }}>{toc}</aside>
    </div>
  );
}

export function DocumentToc({ items, children }: { items: DocTocItem[]; children?: ReactNode }) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>Contents</div>
      <ol style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map((it) => (
          <li key={it.key}>
            <a
              href={`#memo-section-${it.key}`}
              className="flex items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-[var(--bg-sunken)]"
              style={{ color: it.muted ? 'var(--fg-tertiary)' : 'var(--fg-secondary)' }}
            >
              <span className="text-mono" style={{ width: 20, color: 'var(--fg-tertiary)' }}>{it.n}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
              {it.tone && <span style={{ width: 6, height: 6, borderRadius: 999, background: TONE_COLOR[it.tone] }} />}
              {it.badge && <span className="text-tiny" style={{ color: 'var(--fg-tertiary)' }}>{it.badge}</span>}
            </a>
          </li>
        ))}
      </ol>
      {children}
    </div>
  );
}

export function DocTocPanel({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="text-small" style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
      <div className="eyebrow" style={{ marginBottom: 4 }}>{title}</div>
      {children}
    </div>
  );
}

export function DocCard({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="card" style={{ padding: 20, ...style }}>{children}</div>;
}
