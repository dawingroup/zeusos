import * as React from 'react';
import { Icon, type IconName } from './Icon';

// ── BUTTON ──────────────────────────────────────────────
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  primary?: boolean;
  signal?: boolean;
  ghost?: boolean;
  sm?: boolean;
  lg?: boolean;
  full?: boolean;
  icon?: IconName;
  iconRight?: IconName;
  children?: React.ReactNode;
}

export function Btn({
  children, primary, signal, ghost, sm, lg, full, icon, iconRight, className, ...rest
}: BtnProps) {
  const cls = 'h-btn'
    + (primary ? ' is-primary' : '')
    + (signal ? ' is-signal' : '')
    + (ghost ? ' is-ghost' : '')
    + (sm ? ' is-sm' : '')
    + (lg ? ' is-lg' : '')
    + (full ? ' is-full' : '')
    + (className ? ' ' + className : '');
  return (
    <button type="button" className={cls} {...rest}>
      {icon ? <Icon name={icon} size={sm ? 13 : 14} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} size={sm ? 13 : 14} /> : null}
    </button>
  );
}

// ── CHIP ────────────────────────────────────────────────
interface ChipProps {
  children?: React.ReactNode;
  active?: boolean;
  outline?: boolean;
  signal?: boolean;
  quiet?: boolean;
  dot?: boolean;
  icon?: IconName;
  style?: React.CSSProperties;
}

export function Chip({ children, active, outline, signal, quiet, dot, icon, style }: ChipProps) {
  const cls = 'h-chip'
    + (active ? ' is-active' : '')
    + (outline ? ' is-outline' : '')
    + (signal ? ' is-signal' : '')
    + (quiet ? ' is-quiet' : '');
  return (
    <span className={cls} style={style}>
      {dot ? <span className="h-chip-dot" /> : null}
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </span>
  );
}

// ── BADGE ───────────────────────────────────────────────
export function Badge({ children }: { children?: React.ReactNode }) {
  return <span className="h-badge">{children}</span>;
}

// ── SIGNAL LINE ─────────────────────────────────────────
export function SignalLine({ children }: { children?: React.ReactNode }) {
  return <span className="h-signal-line">{children}</span>;
}

// ── CARD ────────────────────────────────────────────────
interface CardProps {
  children?: React.ReactNode;
  signal?: boolean;
  dark?: boolean;
  flush?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export function Card({ children, signal, dark, flush, style, onClick }: CardProps) {
  const cls = 'h-card'
    + (signal ? ' is-signal' : '')
    + (dark ? ' is-dark' : '')
    + (flush ? ' is-flush' : '');
  return <div className={cls} style={style} onClick={onClick}>{children}</div>;
}

// ── PANE ────────────────────────────────────────────────
interface PaneProps {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  flush?: boolean;
  style?: React.CSSProperties;
}

export function Pane({ title, action, children, flush, style }: PaneProps) {
  return (
    <div className="h-pane" style={style}>
      {(title || action) ? (
        <div className="h-pane-h">
          <span className="h-pane-h-t">{title}</span>
          {action ? <span className="h-pane-h-a">{action}</span> : null}
        </div>
      ) : null}
      <div className={'h-pane-b' + (flush ? ' is-flush' : '')}>{children}</div>
    </div>
  );
}

// ── STAT (KPI card) ─────────────────────────────────────
// Brand-aligned layout: label · value (+ unit) · delta · optional
// sparkline. `delta` accepts a number or pre-formatted string; sign
// (up / down / flat) drives the colour. `unit` renders muted next to
// the value (e.g. "2.84Bn UGX"). Pass `sparkline={[10,12,9,15,…]}` to
// render a small trend behind the bottom-right corner.
interface StatProps {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  sub?: React.ReactNode;
  trail?: React.ReactNode;
  delta?: number | string;
  /**
   * Direction of the delta — controls colour. If undefined and `delta`
   * is a number, derived from the sign of `delta`.
   */
  deltaDir?: 'up' | 'down' | 'flat';
  /** Series of numeric points for the sparkline. */
  sparkline?: number[];
  signal?: boolean;
}

export function Stat({
  label, value, unit, sub, trail, delta, deltaDir, sparkline, signal,
}: StatProps) {
  const dir = resolveDir(delta, deltaDir);
  const deltaText = typeof delta === 'number'
    ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`
    : delta;
  return (
    <div className={'h-stat' + (signal ? ' is-signal' : '')}>
      <div className="h-stat-l">{label}</div>
      <div className="h-stat-v">
        {value}
        {unit ? <span className="h-stat-unit">{unit}</span> : null}
      </div>
      {delta !== undefined ? (
        <div className={`h-stat-delta is-${dir}`}>
          <span aria-hidden style={{ fontSize: 11 }}>
            {dir === 'up' ? '↑' : dir === 'down' ? '↓' : '–'}
          </span>
          <span>{deltaText}</span>
        </div>
      ) : null}
      {sub ? <div className="h-stat-s">{sub}</div> : null}
      {trail ? <div className="h-stat-trail">{trail}</div> : null}
      {sparkline && sparkline.length > 1 ? (
        <Sparkline points={sparkline} className="h-stat-spark" />
      ) : null}
    </div>
  );
}

function resolveDir(delta: number | string | undefined, dir: StatProps['deltaDir']): 'up' | 'down' | 'flat' {
  if (dir) return dir;
  if (typeof delta === 'number') {
    if (delta > 0.05) return 'up';
    if (delta < -0.05) return 'down';
    return 'flat';
  }
  return 'flat';
}

// ── SPARKLINE ───────────────────────────────────────────
interface SparklineProps {
  points: number[];
  className?: string;
  /** Override stroke colour. Defaults to the brand accent. */
  color?: string;
}

/**
 * Tiny SVG sparkline. Scales `points` to a unit viewbox so callers
 * don't need to pre-normalise.
 */
export function Sparkline({ points, className, color = 'var(--accent)' }: SparklineProps) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = 100 / (points.length - 1);
  const d = points
    .map((p, i) => {
      const x = i * step;
      const y = 100 - ((p - min) / span) * 100;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
  const fillD = `${d} L 100 100 L 0 100 Z`;
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillD} fill="url(#spark-grad)" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── BAR ─────────────────────────────────────────────────
interface BarProps {
  pct?: number;
  signal?: boolean;
  thick?: boolean;
}

export function Bar({ pct = 50, signal, thick }: BarProps) {
  return (
    <div className={'h-bar' + (thick ? ' is-thick' : '')}>
      <i className={signal ? 'is-signal' : ''} style={{ width: pct + '%' }} />
    </div>
  );
}

interface BarLineProps {
  label: React.ReactNode;
  right?: React.ReactNode;
  pct: number;
  signal?: boolean;
}

export function BarLine({ label, right, pct, signal }: BarLineProps) {
  return (
    <div className="h-barline">
      <div className="h-barline-h">
        <span>{label}</span>
        <span className="h-barline-h-r">{right ?? pct + '%'}</span>
      </div>
      <Bar pct={pct} signal={signal} />
    </div>
  );
}

// ── ROW (list item) ─────────────────────────────────────
interface RowProps {
  title?: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
  rightSub?: React.ReactNode;
  signal?: boolean;
  dim?: boolean;
  attn?: boolean;
  icon?: IconName;
  onClick?: () => void;
}

export function Row({ title, sub, right, rightSub, dim, attn, icon, onClick }: RowProps) {
  return (
    <div className={'h-row' + (dim ? ' is-dim' : '')} onClick={onClick} style={{ cursor: onClick ? 'pointer' : undefined }}>
      <div className="h-row-l">
        <div className="h-row-t">
          {icon ? <Icon name={icon} size={14} color="var(--ink-2)" /> : null}
          {title}
          {attn ? <SignalLine /> : null}
        </div>
        {sub ? <div className="h-row-s">{sub}</div> : null}
      </div>
      {(right != null || rightSub != null) ? (
        <div className="h-row-r">
          {right != null ? <div className="h-row-rt">{right}</div> : null}
          {rightSub != null ? <div className="h-row-rs">{rightSub}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

// ── SECTION ─────────────────────────────────────────────
interface SectionProps {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
}

export function Section({ title, action, children }: SectionProps) {
  return (
    <div className="h-sec">
      {(title || action) ? (
        <div className="h-sec-h">
          <span className="h-sec-h-t">{title}</span>
          {action ? <span className="h-sec-h-a">{action}</span> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

// ── DIAL (circular progress) ────────────────────────────
interface DialProps {
  pct?: number;
  size?: number;
  label?: React.ReactNode;
  value?: React.ReactNode;
  signal?: boolean;
}

export function Dial({ pct = 62, size = 84, label, value, signal }: DialProps) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div style={{ width: size, height: size, position: 'relative', display: 'inline-block' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--paper-3)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={signal ? 'var(--signal)' : 'var(--ink)'}
          strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ font: '600 22px/1 var(--font-display)', letterSpacing: '-0.03em' }}>
          {value ?? pct}<span style={{ fontSize: 11, color: 'var(--ink-2)', marginLeft: 1 }}>%</span>
        </div>
        {label ? (
          <div style={{
            font: '500 9px/1 var(--font-mono)',
            color: 'var(--ink-2)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginTop: 3,
          }}>{label}</div>
        ) : null}
      </div>
    </div>
  );
}

// ── SEPARATOR ───────────────────────────────────────────
export function Sep({ style }: { style?: React.CSSProperties }) {
  return <hr style={{ border: 0, borderTop: '1px solid var(--line-2)', margin: 0, ...style }} />;
}

// ── IMAGE PLACEHOLDER ───────────────────────────────────
export type ImgTone =
  | 'interior' | 'interior-warm' | 'site' | 'render' | 'render-2'
  | 'fabric' | 'light' | 'plan' | 'stone';

interface ImgProps {
  tone?: ImgTone;
  label?: React.ReactNode;
  h?: number;
  w?: number;
  ratio?: string;
  hero?: boolean;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  src?: string;
}

export function Img({ tone = 'interior', label, h, w, ratio, hero, style, children, src }: ImgProps) {
  const cls = 'h-img is-' + tone + (hero ? ' is-hero' : '');
  const s: React.CSSProperties = { ...style };
  if (h != null) s.height = h;
  if (w != null) s.width = w;
  if (ratio) s.aspectRatio = ratio;
  if (src) {
    s.backgroundImage = `url('${src}')`;
    s.backgroundSize = 'cover';
    s.backgroundPosition = 'center';
  }
  return (
    <div className={cls} style={s}>
      {children}
      {label ? <div className="h-img-label">{label}</div> : null}
    </div>
  );
}

// ── SEGMENTED CONTROL ───────────────────────────────────
interface SegmentProps {
  items: { k: string; l: React.ReactNode; on?: boolean }[];
  onChange?: (k: string) => void;
}

export function Segment({ items, onChange }: SegmentProps) {
  return (
    <div className="h-segment">
      {items.map((it) => (
        <div
          key={it.k}
          className={'h-segment-i' + (it.on ? ' is-on' : '')}
          onClick={() => onChange?.(it.k)}
        >{it.l}</div>
      ))}
    </div>
  );
}

// ── EYEBROW + MONO + NUM helpers ────────────────────────
export function Eyebrow({ children, signal, style }: { children?: React.ReactNode; signal?: boolean; style?: React.CSSProperties }) {
  return <div className={'h-eyebrow' + (signal ? ' is-signal' : '')} style={style}>{children}</div>;
}
export function Mono({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return <span className="h-mono" style={style}>{children}</span>;
}
export function Num({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return <span className="h-num" style={style}>{children}</span>;
}
