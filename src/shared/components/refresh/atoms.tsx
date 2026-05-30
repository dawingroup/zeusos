/**
 * UI Refresh — shared page atoms.
 *
 * Faithful TSX ports of the prototype's reusable presentational atoms
 * (`/tmp/zeus-ui-refresh/pages*.jsx`). Pure presentation — no data
 * dependencies — consumed across the batch-3 page ports so the refreshed
 * visual language is authored once. Styling leans on the atom classes
 * added to `src/index.css` in Phase 1 (.card, .eyebrow, .display, .h1,
 * .pill, .burn, .zeus-underline, .btn) plus a few inline styles lifted
 * verbatim from the prototype for pixel fidelity.
 */

import React from 'react';
import { ChevronLeft } from 'lucide-react';

export type RagTone = 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'brand';

// ---------------------------------------------------------------------------
// Pill — status chip with optional leading dot
// ---------------------------------------------------------------------------
export function Pill({
  tone = 'neutral',
  dot = true,
  children,
}: {
  tone?: RagTone;
  dot?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className={`pill ${tone === 'neutral' ? '' : tone}`}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Eyebrow — uppercased label
// ---------------------------------------------------------------------------
export function Eyebrow({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className="eyebrow" style={style}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionH — between-card section header with eyebrow + title + action
// ---------------------------------------------------------------------------
export function SectionH({
  eyebrow,
  title,
  action,
  titleSize = 17,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  action?: React.ReactNode;
  titleSize?: number;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        margin: '32px 0 14px',
      }}
    >
      <div>
        {eyebrow && (
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            {eyebrow}
          </div>
        )}
        <h2 className="h1" style={{ fontSize: titleSize }}>
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PageHero — top-of-page headline with eyebrow + body + actions.
// The signature red underline is applied to the title unless it contains a
// "·" separator (the prototype's convention) or `underline` is false.
// ---------------------------------------------------------------------------
export function PageHero({
  eyebrow,
  title,
  body,
  actions,
  underline = true,
}: {
  eyebrow?: React.ReactNode;
  title: string;
  body?: React.ReactNode;
  actions?: React.ReactNode;
  underline?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginBottom: 24,
        gap: 16,
      }}
    >
      <div style={{ minWidth: 0 }}>
        {eyebrow && (
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            {eyebrow}
          </div>
        )}
        <h1 className="display">
          {underline && !title.includes('·') ? (
            <span className="zeus-underline">{title}</span>
          ) : (
            title
          )}
        </h1>
        {body && (
          <p style={{ marginTop: 12, color: 'var(--fg-secondary)', fontSize: 14, maxWidth: 560 }}>
            {body}
          </p>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flex: 'none' }}>{actions}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sparkline — tiny inline line chart from a numeric series
// ---------------------------------------------------------------------------
export function Sparkline({
  points,
  color = 'currentColor',
  height = 28,
}: {
  points: number[];
  color?: string;
  height?: number;
}) {
  const w = 100;
  const h = height;
  if (!points.length) return <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height }} />;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = w / Math.max(points.length - 1, 1);
  const d = points
    .map((p, i) => {
      const x = i * step;
      const y = h - ((p - min) / range) * (h - 4) - 2;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const lastY = h - ((points[points.length - 1] - min) / range) * (h - 4) - 2;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height, flex: 1 }}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w} cy={lastY} r="2" fill={color} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// KPI — dashboard hero tile (label, value, optional unit/delta/sparkline)
// ---------------------------------------------------------------------------
export function KPI({
  label,
  value,
  unit,
  delta,
  deltaDir = 'flat',
  spark,
  accent,
  direction = 'ambitious',
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  delta?: React.ReactNode;
  deltaDir?: 'up' | 'down' | 'flat';
  spark?: number[];
  accent?: string;
  direction?: 'conservative' | 'ambitious';
}) {
  const deltaColor =
    deltaDir === 'up' ? 'var(--rag-green)' : deltaDir === 'down' ? 'var(--rag-red)' : 'var(--fg-tertiary)';
  return (
    <div
      className="card card-pad"
      style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', overflow: 'hidden' }}
    >
      <div className="eyebrow" style={{ fontSize: 10.5 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span className="display tabular" style={{ fontSize: direction === 'ambitious' ? 32 : 26 }}>
          {value}
        </span>
        {unit && <span style={{ fontSize: 13, color: 'var(--fg-tertiary)', fontWeight: 500 }}>{unit}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {delta && (
          <span className="tabular" style={{ fontSize: 12, color: deltaColor, fontWeight: 600 }}>
            {delta}
          </span>
        )}
        {spark && <Sparkline points={spark} color={accent || 'var(--fg-tertiary)'} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BurnMeter — segmented utilisation bar with 80% / 100% threshold ticks
// ---------------------------------------------------------------------------
export function BurnMeter({ value, label }: { value: number; label?: React.ReactNode }) {
  const pct = Math.min(value, 1.2);
  const tone = value >= 1 ? 'over' : value >= 0.8 ? 'warn' : '';
  const color = value >= 1 ? 'var(--rag-red)' : value >= 0.8 ? 'var(--rag-amber)' : 'var(--rag-green)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label !== undefined && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--fg-tertiary)' }}>
          <span>{label}</span>
          <span className="tabular" style={{ color, fontWeight: 600 }}>
            {Math.round(value * 100)}%
          </span>
        </div>
      )}
      <div className={`burn ${tone}`} style={{ position: 'relative' }}>
        <span style={{ width: `${Math.min((pct * 100) / 1.2, 100)}%` }} />
        <span className="tick" style={{ left: `${80 / 1.2}%` }} />
        <span className="tick" style={{ left: `${100 / 1.2}%` }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BackBar — "← Label" ghost button for detail pages
// ---------------------------------------------------------------------------
export function BackBar({ label, onBack }: { label: React.ReactNode; onBack: () => void }) {
  return (
    <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: 16, paddingLeft: 0 }}>
      <ChevronLeft size={14} />
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// DetailLayout — two-column shell (main + sticky right rail)
// ---------------------------------------------------------------------------
export function DetailLayout({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'flex-start' }}>
      <div style={{ minWidth: 0 }}>{left}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 16 }}>
        {right}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SideCard — right-rail card with uppercase title + optional action
// ---------------------------------------------------------------------------
export function SideCard({
  title,
  action,
  children,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="card-head">
        <h3
          style={{
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--fg-tertiary)',
          }}
        >
          {title}
        </h3>
        {action}
      </div>
      <div style={{ padding: '0 var(--pad-card) var(--pad-card)' }}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MetaRow — label/value row used inside SideCards
// ---------------------------------------------------------------------------
export function MetaRow({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '6px 0',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <span style={{ fontSize: 11.5, color: 'var(--fg-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
