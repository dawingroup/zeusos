// ============================================================================
// KPI SPARK CARD — Compact metric card with optional sparkline
// Used on the Finance Overview page for top-line KPIs
// ============================================================================

import { useNavigate } from 'react-router-dom';
import { Card } from '@/core/components/ui/card';
import { LineChart, Line } from 'recharts';
import { SafeResponsiveContainer } from '@/core/components/ui/SafeResponsiveContainer';
import type { LucideIcon } from 'lucide-react';

interface KPISparkCardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  /** Color for icon background and sparkline */
  color: string;
  /** Navigation path when clicked */
  href?: string;
  /** Sparkline data points (array of numbers) */
  sparkData?: number[];
  /** Change indicator (positive = green, negative = red) */
  change?: number;
}

export function KPISparkCard({
  label,
  value,
  subtitle,
  icon: Icon,
  color,
  href,
  sparkData,
  change,
}: KPISparkCardProps) {
  const navigate = useNavigate();
  const chartData = sparkData?.map((v, i) => ({ i, v }));
  const sparkColor = change !== undefined && change < 0 ? '#dc2626' : color;

  return (
    <Card
      className={`p-4 transition-all ${href ? 'cursor-pointer hover:shadow-md hover:border-[var(--border-default)]' : ''}`}
      onClick={() => href && navigate(href)}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="flex items-center justify-center w-7 h-7 rounded-md"
              style={{ backgroundColor: `${color}15` }}
            >
              <Icon className="w-3.5 h-3.5" style={{ color }} />
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
              {label}
            </p>
          </div>
          <p className="text-xl font-bold text-foreground mt-1">{value}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {subtitle && (
              <span className="text-xs text-[var(--fg-tertiary)]">{subtitle}</span>
            )}
            {change !== undefined && (
              <span
                className={`text-xs font-medium ${change >= 0 ? 'text-[var(--rag-green)]' : 'text-[var(--rag-red)]'}`}
              >
                {change >= 0 ? '+' : ''}{change.toFixed(1)}%
              </span>
            )}
          </div>
        </div>

        {chartData && chartData.length > 1 && (
          <div className="w-20 h-10 shrink-0">
            <SafeResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={sparkColor}
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </SafeResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
}
