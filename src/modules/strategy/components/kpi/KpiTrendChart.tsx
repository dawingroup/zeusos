import React from 'react';
import { LineChart } from 'lucide-react';
import type { KPIDataPoint } from '../../types/kpi.types';

interface KpiTrendChartProps {
  dataPoints: KPIDataPoint[]; // newest first (as returned by kpiDataService)
  target?: number;
  unit?: string;
  height?: number;
}

// Tiny pure-SVG line chart. No deps. Renders a target reference line, the
// data series, and an axis frame. We chart at most the last 24 points so a
// long history doesn't drown the trend.
export const KpiTrendChart: React.FC<KpiTrendChartProps> = ({
  dataPoints,
  target,
  unit,
  height = 180,
}) => {
  if (dataPoints.length === 0) {
    return (
      <div
        className="rounded-md border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 text-[12px]"
        style={{ height }}
      >
        <LineChart className="h-6 w-6 mb-1 opacity-60" />
        No data points yet
      </div>
    );
  }

  // Chronological for plotting (oldest → newest).
  const series = [...dataPoints]
    .sort((a, b) => a.date.toMillis() - b.date.toMillis())
    .slice(-24);

  const values = series.map((p) => p.value);
  if (target !== undefined) values.push(target);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  // SVG viewport
  const W = 600;
  const H = height;
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const xAt = (i: number): number => {
    if (series.length <= 1) return padL + plotW / 2;
    return padL + (i / (series.length - 1)) * plotW;
  };
  const yAt = (v: number): number => {
    return padT + plotH - ((v - min) / range) * plotH;
  };

  const linePath = series
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(p.value)}`)
    .join(' ');

  const areaPath = `${linePath} L ${xAt(series.length - 1)} ${padT + plotH} L ${padL} ${padT + plotH} Z`;

  const yTickValues = [min, min + range / 2, max].map((v) => Number(v.toFixed(1)));

  const targetY = target !== undefined ? yAt(target) : null;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height }}
        role="img"
        aria-label="KPI trend chart"
      >
        {/* Y grid */}
        {yTickValues.map((v, i) => {
          const y = yAt(v);
          return (
            <g key={i}>
              <line
                x1={padL}
                x2={W - padR}
                y1={y}
                y2={y}
                stroke="#f1f5f9"
                strokeDasharray={i === 1 ? '0' : '2 2'}
              />
              <text x={padL - 4} y={y + 3} textAnchor="end" fontSize="9" fill="#94a3b8">
                {v}
              </text>
            </g>
          );
        })}

        {/* Target line */}
        {targetY !== null && (
          <g>
            <line
              x1={padL}
              x2={W - padR}
              y1={targetY}
              y2={targetY}
              stroke="#3b82f6"
              strokeWidth={1}
              strokeDasharray="4 3"
              opacity={0.6}
            />
            <text
              x={W - padR}
              y={targetY - 3}
              textAnchor="end"
              fontSize="9"
              fill="#3b82f6"
              opacity={0.8}
            >
              target {target}
              {unit ? ` ${unit}` : ''}
            </text>
          </g>
        )}

        {/* Area under line */}
        <path d={areaPath} fill="url(#kpi-gradient)" opacity={0.25} />
        <defs>
          <linearGradient id="kpi-gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Line */}
        <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth={1.75} />

        {/* Points */}
        {series.map((p, i) => (
          <g key={p.id}>
            <circle cx={xAt(i)} cy={yAt(p.value)} r={3} fill="#3b82f6" />
            <title>
              {p.date.toDate().toLocaleDateString()} — {p.value}
              {unit ? ` ${unit}` : ''}
              {p.note ? `\n${p.note}` : ''}
            </title>
          </g>
        ))}

        {/* X labels (first / middle / last) */}
        {[0, Math.floor(series.length / 2), series.length - 1]
          .filter((v, i, arr) => arr.indexOf(v) === i && series[v])
          .map((i) => (
            <text
              key={i}
              x={xAt(i)}
              y={H - 10}
              textAnchor={i === 0 ? 'start' : i === series.length - 1 ? 'end' : 'middle'}
              fontSize="9"
              fill="#94a3b8"
            >
              {series[i].date.toDate().toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </text>
          ))}
      </svg>
    </div>
  );
};
