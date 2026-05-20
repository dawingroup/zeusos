import * as React from 'react';

export interface SparklineProps extends Omit<React.SVGAttributes<SVGSVGElement>, 'fill' | 'points'> {
  points: number[];
  /** Stroke color — accepts CSS variables (default uses --accent). */
  color?: string;
  /** Width in px (defaults to 100). */
  width?: number;
  /** Height in px (defaults to 32). */
  height?: number;
  /** Render an area-fill gradient below the line. */
  fill?: boolean;
  /** Show a dot on the last point. */
  showLastDot?: boolean;
}

/**
 * Lightweight SVG sparkline. Stateless; recomputes path from `points`.
 * Defaults to current accent color and a soft gradient fill.
 */
export function Sparkline({
  points,
  color = 'var(--accent)',
  width = 100,
  height = 32,
  fill = true,
  showLastDot = true,
  ...props
}: SparklineProps) {
  if (!points.length) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = points.length > 1 ? width / (points.length - 1) : 0;

  const xy = points.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });

  const linePath = xy
    .map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`))
    .join(' ');

  const fillPath = `${linePath} L${width},${height} L0,${height} Z`;

  const gradientId = React.useId().replace(/:/g, '');
  const [lastX, lastY] = xy[xy.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label="Sparkline"
      {...props}
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={`spark-grad-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={fillPath} fill={`url(#spark-grad-${gradientId})`} />
        </>
      )}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showLastDot && (
        <circle cx={lastX} cy={lastY} r={2} fill={color} />
      )}
    </svg>
  );
}
