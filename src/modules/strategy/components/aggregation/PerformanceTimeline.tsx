// ============================================================================
// PerformanceTimeline COMPONENT
// DawinOS v2.0 - CEO Strategy Command Module
// Timeline visualization of performance trends
// ============================================================================

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';
import { SafeResponsiveContainer } from '@/core/components/ui/SafeResponsiveContainer';
import { PerformanceTrend } from '../../types/aggregation.types';
import {
  PerformanceDomain,
  PERFORMANCE_DOMAIN_LABELS,
  TREND_INDICATOR_LABELS,
  PERFORMANCE_RATING_COLORS,
} from '../../constants/aggregation.constants';

// ----------------------------------------------------------------------------
// Props
// ----------------------------------------------------------------------------

interface PerformanceTimelineProps {
  trend: PerformanceTrend;
  height?: number;
  showProjection?: boolean;
  showDomains?: boolean;
  onDomainChange?: (domain: PerformanceDomain) => void;
}

// ----------------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------------

export const PerformanceTimeline: React.FC<PerformanceTimelineProps> = ({
  trend,
  height = 300,
  showProjection = true,
  showDomains = true,
  onDomainChange,
}) => {
  const formatDate = (timestamp: any): string => {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-UG', { month: 'short', year: '2-digit' });
  };

  const chartData = trend.dataPoints.map((dp) => ({
    date: formatDate(dp.date),
    score: dp.score,
    strategy: dp.strategyScore,
    okr: dp.okrScore,
    kpi: dp.kpiScore,
    rating: dp.rating,
  }));

  // Add projection point if available
  if (showProjection && trend.projectedScore !== undefined) {
    chartData.push({
      date: 'Projected',
      score: trend.projectedScore,
      strategy: undefined as any,
      okr: undefined as any,
      kpi: undefined as any,
      rating: trend.projectedRating as any,
    });
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;

    return (
      <Box
        sx={{
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          p: 1.5,
          boxShadow: 2,
        }}
      >
        <Typography variant="subtitle2" fontWeight="bold">
          {label}
        </Typography>
        {payload.map((entry: any) => (
          <Box key={entry.dataKey} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: entry.color,
              }}
            />
            <Typography variant="body2">
              {entry.name}: {entry.value?.toFixed(1) || 'N/A'}
            </Typography>
          </Box>
        ))}
        {data.rating && (
          <Chip
            label={data.rating}
            size="small"
            sx={{
              mt: 1,
              bgcolor: PERFORMANCE_RATING_COLORS[data.rating as keyof typeof PERFORMANCE_RATING_COLORS],
              color: 'white',
              fontSize: '0.7rem',
            }}
          />
        )}
      </Box>
    );
  };

  return (
    <Card elevation={2}>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight="bold">
              {trend.entityName} - Performance Trend
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {PERFORMANCE_DOMAIN_LABELS[trend.domain]} • {trend.dataPointCount} data points
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip
              label={TREND_INDICATOR_LABELS[trend.trend]}
              size="small"
              color={
                trend.trend.includes('up') ? 'success' :
                trend.trend.includes('down') ? 'error' : 'default'
              }
            />

            {trend.projectedScore !== undefined && (
              <Chip
                label={`Projected: ${trend.projectedScore.toFixed(1)}`}
                size="small"
                variant="outlined"
                color="primary"
              />
            )}
          </Box>
        </Box>

        {/* Domain Toggle */}
        {showDomains && onDomainChange && (
          <Box sx={{ mb: 2 }}>
            <ToggleButtonGroup
              value={trend.domain}
              exclusive
              onChange={(_: React.MouseEvent<HTMLElement>, value: PerformanceDomain | null) => value && onDomainChange(value)}
              size="small"
            >
              <ToggleButton value="combined">Combined</ToggleButton>
              <ToggleButton value="strategy">Strategy</ToggleButton>
              <ToggleButton value="okr">OKRs</ToggleButton>
              <ToggleButton value="kpi">KPIs</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        )}

        {/* Chart */}
        <SafeResponsiveContainer width="100%" height={height}>
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1976D2" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#1976D2" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />

            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickLine={false}
            />

            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />

            <Tooltip content={<CustomTooltip />} />

            <Legend />

            {/* Reference lines for rating thresholds */}
            <ReferenceLine y={90} stroke={PERFORMANCE_RATING_COLORS.exceptional} strokeDasharray="3 3" />
            <ReferenceLine y={60} stroke={PERFORMANCE_RATING_COLORS.on_track} strokeDasharray="3 3" />
            <ReferenceLine y={40} stroke={PERFORMANCE_RATING_COLORS.needs_attention} strokeDasharray="3 3" />

            {/* Area under the main score line */}
            <Area
              type="monotone"
              dataKey="score"
              stroke="none"
              fill="url(#colorScore)"
            />

            {/* Main score line */}
            <Line
              type="monotone"
              dataKey="score"
              name="Overall Score"
              stroke="#1976D2"
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />

            {/* Domain-specific lines when combined is selected */}
            {trend.domain === 'combined' && showDomains && (
              <>
                <Line
                  type="monotone"
                  dataKey="strategy"
                  name="Strategy"
                  stroke="#4CAF50"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="okr"
                  name="OKRs"
                  stroke="#FF9800"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="kpi"
                  name="KPIs"
                  stroke="#9C27B0"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </>
            )}
          </ComposedChart>
        </SafeResponsiveContainer>

        {/* Statistics Footer */}
        <Box sx={{ display: 'flex', justifyContent: 'space-around', mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" fontWeight="bold">
              {(trend.trendStrength * 100).toFixed(0)}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Trend Strength
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" fontWeight="bold">
              {trend.volatility.toFixed(1)}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Volatility
            </Typography>
          </Box>
          {trend.confidenceLevel !== undefined && (
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" fontWeight="bold">
                {trend.confidenceLevel.toFixed(0)}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Projection Confidence
              </Typography>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default PerformanceTimeline;
