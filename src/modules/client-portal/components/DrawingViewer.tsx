import { useRef } from 'react';
import { Icon } from './Icon';

interface Pin {
  id?: string;
  n: number | string;
  x: number;
  y: number;
  /** Visual highlight (current selection or "needs attention"). */
  signal?: boolean;
  /** Faded look for resolved pins. */
  resolved?: boolean;
  onClick?: () => void;
}

interface DrawingViewerProps {
  kind?: 'elevation';
  pins?: Pin[];
  h?: number;
  /**
   * If true, the viewer area becomes a click target and on click
   * forwards the click position (as 0–100 percentages relative to
   * the viewer) to `onDropPin`. Cursor changes to crosshair.
   */
  dropMode?: boolean;
  onDropPin?: (x: number, y: number) => void;
}

export function DrawingViewer({
  kind = 'elevation', pins = [], h, dropMode, onDropPin,
}: DrawingViewerProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!dropMode || !onDropPin || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onDropPin(Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)));
  }

  return (
    <div
      ref={ref}
      className="h-viewer"
      style={{
        ...(h != null ? { height: h, minHeight: h, flex: '0 0 auto' } : undefined),
        cursor: dropMode ? 'crosshair' : undefined,
      }}
      onClick={handleClick}
    >
      <svg viewBox="0 0 800 480" className="h-viewer-drawing" preserveAspectRatio="xMidYMid meet" style={{ pointerEvents: 'none' }}>
        <defs>
          <pattern id="dv-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#d4cfc0" strokeWidth="0.5" opacity="0.5" />
          </pattern>
        </defs>
        <rect width="800" height="480" fill="url(#dv-grid)" />

        {kind === 'elevation' && (
          <g stroke="#16161a" strokeWidth="1.2" fill="none">
            <line x1="40" y1="420" x2="760" y2="420" strokeWidth="1.8" />
            <rect x="180" y="240" width="440" height="180" />
            <line x1="180" y1="270" x2="620" y2="270" />
            <line x1="240" y1="270" x2="240" y2="420" />
            <line x1="300" y1="270" x2="300" y2="420" />
            <line x1="360" y1="270" x2="360" y2="420" />
            <line x1="420" y1="270" x2="420" y2="420" />
            <line x1="480" y1="270" x2="480" y2="420" />
            <line x1="540" y1="270" x2="540" y2="420" />
            <line x1="180" y1="450" x2="620" y2="450" strokeWidth="0.8" />
            <line x1="180" y1="440" x2="180" y2="460" strokeWidth="0.8" />
            <line x1="620" y1="440" x2="620" y2="460" strokeWidth="0.8" />
            <text x="400" y="475" fontSize="11" fontFamily="JetBrains Mono" fill="#16161a" textAnchor="middle">4400 mm</text>

            <line x1="640" y1="240" x2="640" y2="420" strokeWidth="0.8" />
            <line x1="630" y1="240" x2="650" y2="240" strokeWidth="0.8" />
            <line x1="630" y1="420" x2="650" y2="420" strokeWidth="0.8" />
            <text x="660" y="334" fontSize="11" fontFamily="JetBrains Mono" fill="#16161a">1080</text>

            <rect x="160" y="230" width="480" height="14" fill="#16161a" opacity="0.85" />

            <line x1="180" y1="410" x2="620" y2="410" />
            <line x1="400" y1="210" x2="400" y2="430" strokeDasharray="4 4" strokeWidth="0.6" />

            <g>
              <rect x="40" y="40" width="220" height="56" stroke="#16161a" strokeWidth="0.8" fill="#fafaf7" />
              <text x="50" y="58" fontSize="9" fontFamily="JetBrains Mono" fill="#5e5c57" letterSpacing="1.5">SHEET 02 / 04</text>
              <text x="50" y="78" fontSize="13" fontFamily="Outfit" fontWeight="600" fill="#16161a">Cashwrap · Elevation A</text>
              <text x="50" y="92" fontSize="9" fontFamily="JetBrains Mono" fill="#5e5c57" letterSpacing="1.5">1:20 @ A3 · REV C</text>
            </g>

            <g>
              <rect x="640" y="60" width="120" height="6" fill="#16161a" />
              <rect x="660" y="60" width="20" height="6" fill="#fafaf7" stroke="#16161a" strokeWidth="0.8" />
              <rect x="700" y="60" width="20" height="6" fill="#fafaf7" stroke="#16161a" strokeWidth="0.8" />
              <text x="640" y="80" fontSize="9" fontFamily="JetBrains Mono" fill="#5e5c57">0</text>
              <text x="755" y="80" fontSize="9" fontFamily="JetBrains Mono" fill="#5e5c57" textAnchor="end">2m</text>
            </g>
          </g>
        )}
      </svg>

      <div className="h-viewer-tools" style={{ pointerEvents: 'auto' }}>
        <div className="h-viewer-tool"><Icon name="plus" size={14} /></div>
        <div className="h-viewer-tool">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <div className="h-viewer-tool"><Icon name="expand" size={14} /></div>
        <div className="h-viewer-tool"><Icon name="pencil" size={14} /></div>
      </div>

      {/* Drop-mode hint banner */}
      {dropMode ? (
        <div style={{
          position: 'absolute',
          top: 12, left: 12,
          padding: '6px 12px',
          background: 'var(--accent)',
          color: 'var(--accent-fg)',
          borderRadius: 100,
          font: '500 11px/1 var(--font-sans)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          boxShadow: 'var(--shadow-md)',
          pointerEvents: 'none',
        }}>
          Click on the drawing to drop a pin
        </div>
      ) : null}

      {pins.map((p, i) => (
        <button
          type="button"
          key={p.id ?? i}
          className={
            'h-viewer-pin'
            + (p.signal ? ' is-signal' : '')
            + (p.resolved ? ' is-resolved' : '')
          }
          style={{
            left: p.x + '%',
            top: p.y + '%',
            cursor: p.onClick ? 'pointer' : 'default',
            opacity: p.resolved ? 0.5 : 1,
            border: 0,
            padding: 0,
          }}
          onClick={(e) => {
            // Don't let pin clicks bubble up to the drop-mode handler.
            e.stopPropagation();
            p.onClick?.();
          }}
          aria-label={typeof p.n === 'number' ? `Pin ${p.n}` : `Pin ${p.n}`}
        >{p.n}</button>
      ))}
    </div>
  );
}
