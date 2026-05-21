// ============================================================================
// TrendSparkline COMPONENT
// ZeusOS v2.0 - CEO Strategy Command Module
// Compact sparkline chart for showing trends
// ============================================================================

import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import {
  TrendingUp as UpIcon,
  TrendingDown as DownIcon,
  TrendingFlat as FlatIcon,
} from '@mui/icons-material';
import { LineChart, Line, YAxis } from 'recharts';
import { SafeResponsiveContainer } from '@/core/components/ui/SafeResponsiveContainer';

interface TrendSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showTrendIcon?: boolean;
  showChange?: boolean;
  label?: string;
}

export const TrendSparkline: React.FC<TrendSparklineProps> = ({
  data,
  width = 100,
  height = 30,
  color,
  showTrendIcon = true,
  showChange = true,
  label,
}) => {
  if (data.length < 2) {
    return (
      <Box sx={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          No data
        </Typography>
      </Box>
    );
  }
  
  const chartData = data.map((value, index) => ({ value, index }));
  const firstValue = data[0];
  const lastValue = data[data.length - 1];
  const changePercent = firstValue !== 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
  
  const getTrendColor = () => {
    if (changePercent > 3) return '#4CAF50';
    if (changePercent < -3) return '#F44336';
    return '#9E9E9E';
  };
  
  const lineColor = color || getTrendColor();
  
  const TrendIcon = () => {
    if (changePercent > 3) return <UpIcon fontSize="small" sx={{ color: lineColor }} />;
    if (changePercent < -3) return <DownIcon fontSize="small" sx={{ color: lineColor }} />;
    return <FlatIcon fontSize="small" sx={{ color: lineColor }} />;
  };
  
  return (
    <Tooltip
      title={
        <Box>
          {label && <Typography variant="caption">{label}</Typography>}
          <Typography variant="body2">
            {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}% change
          </Typography>
        </Box>
      }
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <SafeResponsiveContainer width={width} height={height}>
          <LineChart data={chartData}>
            <YAxis hide domain={['dataMin', 'dataMax']} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={lineColor}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </SafeResponsiveContainer>
        
        {showTrendIcon && <TrendIcon />}
        
        {showChange && (
          <Typography variant="caption" sx={{ color: lineColor, fontWeight: 'bold' }}>
            {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(0)}%
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
};

export default TrendSparkline;
