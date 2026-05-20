import * as React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useUIStore } from '@/shared/stores/uiStore';
import { Sparkline } from './Sparkline';

export type Trend = 'up' | 'down' | 'flat';

export interface KPICardProps {
  /** Small uppercase label above the value. */
  label: React.ReactNode;
  /** The big number (or formatted string). */
  value: React.ReactNode;
  /** Optional unit suffix (e.g. "UGX"). */
  unit?: React.ReactNode;
  /** Optional delta string (e.g. "+12.4%"). */
  delta?: React.ReactNode;
  /** Trend direction — styles the delta color. */
  trend?: Trend;
  /** Sparkline points (rendered bottom-right if provided + user has sparklines on). */
  spark?: number[];
  /** Sparkline color override. Default = accent. */
  sparkColor?: string;
  className?: string;
}

const TREND_COLOR: Record<Trend, string> = {
  up:   'var(--rag-green)',
  down: 'var(--rag-red)',
  flat: 'var(--fg-tertiary)',
};

const TREND_ICON: Record<Trend, React.ComponentType<{ className?: string }>> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
};

/**
 * KPI card — matches the portal redesign template spec exactly:
 * - `--border-default` (1px) + `--bg-surface` + `--radius` rounded
 * - 11px uppercase label · `--fg-tertiary` · letter-spacing 0.08em
 * - 26/600 value · letter-spacing -0.02em · line-height 1.15 · tabular-nums
 * - 14px unit · `--fg-tertiary` · ml-4
 * - 12/500 delta with up/down/flat color
 * - Sparkline absolute bottom-right, 60% width × 36px tall, opacity 0.7
 *
 * The sparkline is hidden globally when the user disables sparklines in
 * Preferences.
 */
export function KPICard({
  label,
  value,
  unit,
  delta,
  trend,
  spark,
  sparkColor,
  className,
}: KPICardProps) {
  const sparklinesEnabled = useUIStore((s) => s.sparklinesEnabled);
  const showSpark = sparklinesEnabled && spark && spark.length > 1;
  const TrendIcon = trend ? TREND_ICON[trend] : null;

  return (
    <div
      className={cn(
        'relative flex flex-col gap-1 overflow-hidden rounded-[10px]',
        'border bg-[var(--bg-surface)]',
        className,
      )}
      style={{
        padding: 'var(--pad-card)',
        borderColor: 'var(--border-default)',
      }}
    >
      <div
        className="text-[11px] font-medium uppercase tracking-[0.08em]"
        style={{ color: 'var(--fg-tertiary)' }}
      >
        {label}
      </div>
      <div className="flex items-baseline">
        <span
          className="text-[26px] font-semibold tabular-nums"
          style={{
            color: 'var(--fg-primary)',
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
          }}
        >
          {value}
        </span>
        {unit != null && unit !== '' && (
          <span
            className="text-[14px] font-medium ml-1"
            style={{ color: 'var(--fg-tertiary)' }}
          >
            {unit}
          </span>
        )}
      </div>
      {delta && (
        <div
          className="inline-flex items-center gap-1 text-[12px] font-medium tabular-nums"
          style={{ color: trend ? TREND_COLOR[trend] : 'var(--fg-secondary)' }}
        >
          {TrendIcon && <TrendIcon className="h-3 w-3" />}
          {delta}
        </div>
      )}
      {showSpark && (
        <SparkAttached spark={spark!} color={sparkColor ?? 'var(--accent)'} />
      )}
    </div>
  );
}

/**
 * Sparkline pinned bottom-right at 60% width × 36px tall, opacity 0.7 (per
 * the design template). Sizing is responsive via a ResizeObserver so the
 * line always fills the bottom 60% of the card, regardless of column width.
 */
function SparkAttached({ spark, color }: { spark: number[]; color: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(160);

  React.useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && Math.abs(w - width) > 0.5) setWidth(Math.max(40, Math.round(w)));
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div
      ref={ref}
      className="absolute bottom-0 right-0 pointer-events-none"
      style={{ width: '60%', height: 36, opacity: 0.7 }}
    >
      <Sparkline points={spark} color={color} width={width} height={36} />
    </div>
  );
}

export interface KPIGridProps {
  children: React.ReactNode;
  className?: string;
  /** Default columns on large screens (1-6). */
  cols?: 1 | 2 | 3 | 4 | 5 | 6;
}

/**
 * Convenience grid layout for KPI rows. 1-col on mobile, 2 on sm, `cols` on lg.
 */
export function KPIGrid({ children, className, cols = 4 }: KPIGridProps) {
  const colsClass =
    cols === 1
      ? 'lg:grid-cols-1'
      : cols === 2
      ? 'lg:grid-cols-2'
      : cols === 3
      ? 'lg:grid-cols-3'
      : cols === 5
      ? 'lg:grid-cols-5'
      : cols === 6
      ? 'lg:grid-cols-6'
      : 'lg:grid-cols-4';
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-4', colsClass, className)}>
      {children}
    </div>
  );
}
