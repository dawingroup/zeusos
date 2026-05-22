/**
 * MarginBadge — green ≥ floor (with the amber band), amber within 5pp,
 * red below. Used on the QuoteBuilder preview and the rate-card editor's
 * "what-if" pane.
 *
 * Spec §6.2 says the floor is enforced *on issue*. The badge mirrors that
 * exactly: under the floor → red (and `issueQuote` will reject without an
 * override).
 */

import { bandForMargin, MARGIN_AMBER_BAND_PP, MARGIN_FLOOR_DEFAULT_PCT } from '../constants/floors';
import type { MarginBand } from '../constants/floors';

interface MarginBadgeProps {
  /** Current margin percentage (0–100). */
  marginPct: number;
  /** Floor for this quote (defaults to 25%). */
  floorPct?: number;
  /** Override the amber band width (defaults to 5pp). */
  amberBandPp?: number;
  /** When true, renders a wider variant suitable for table cells. */
  compact?: boolean;
}

const BAND_STYLES: Record<MarginBand, { bg: string; fg: string; label: string }> = {
  green: { bg: '#dcfce7', fg: '#166534', label: 'Healthy' },
  amber: { bg: '#fef9c3', fg: '#854d0e', label: 'Near floor' },
  red:   { bg: '#fecaca', fg: '#991b1b', label: 'Below floor' },
};

export function MarginBadge({
  marginPct,
  floorPct = MARGIN_FLOOR_DEFAULT_PCT,
  amberBandPp = MARGIN_AMBER_BAND_PP,
  compact = false,
}: MarginBadgeProps) {
  const band = bandForMargin(marginPct, floorPct, amberBandPp);
  const style = BAND_STYLES[band];
  const formatted = `${marginPct.toFixed(1)}%`;

  return (
    <span
      data-testid="margin-badge"
      data-band={band}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: compact ? '2px 8px' : '4px 12px',
        borderRadius: 12,
        background: style.bg,
        color: style.fg,
        fontSize: compact ? 11 : 12,
        fontWeight: 600,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
      }}
      title={`Margin ${formatted} · floor ${floorPct}% · ${style.label}`}
    >
      <span aria-hidden>●</span>
      <span>{formatted}</span>
      {!compact && <span style={{ opacity: 0.75 }}>· {style.label}</span>}
    </span>
  );
}
