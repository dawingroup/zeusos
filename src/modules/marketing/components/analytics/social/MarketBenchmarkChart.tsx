/**
 * MarketBenchmarkChart
 * Plots own vs market average for a selected metric/platform, sourced from
 * the BQ-backed getSocialBenchmark callable.
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { SafeResponsiveContainer } from '@/core/components/ui/SafeResponsiveContainer';
import type { BenchmarkPoint } from '../../../hooks/useSocialBenchmark';

interface Props {
  series: BenchmarkPoint[];
  loading?: boolean;
  height?: number;
  metricLabel: string;
}

export function MarketBenchmarkChart({ series, loading, height = 320, metricLabel }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (!series || series.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-gray-400" style={{ height }}>
        No benchmark data yet — we need at least one tracked own account and a few competitor profiles
        on the same platform.
      </div>
    );
  }

  const data = series.map((p) => ({
    date: p.date,
    'Our value': p.ownValue,
    'Market avg': p.marketAvg,
  }));

  return (
    <SafeResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#888' }} />
        <YAxis tick={{ fontSize: 11, fill: '#888' }} />
        <Tooltip
          formatter={(value: number | string | undefined) =>
            typeof value === 'number' ? value.toLocaleString() : String(value ?? '')
          }
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="Our value"
          stroke="#872E5C"
          strokeWidth={2}
          dot={false}
          name={`Our ${metricLabel}`}
        />
        <Line
          type="monotone"
          dataKey="Market avg"
          stroke="#9CA3AF"
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={false}
          name={`Market avg ${metricLabel}`}
        />
      </LineChart>
    </SafeResponsiveContainer>
  );
}
