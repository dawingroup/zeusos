// ============================================================================
// PerformanceOverview COMPONENT
// ZeusOS v2.0 - CEO Strategy Command Module
// Overview card showing aggregated performance across domains
// ============================================================================

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Divider,
  LinearProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  Refresh as RefreshIcon,
  CheckCircle as HealthyIcon,
  Warning as WarningIcon,
  Error as CriticalIcon,
  Help as NoDataIcon,
} from '@mui/icons-material';
import { AggregatedPerformance } from '../../types/aggregation.types';
import {
  PERFORMANCE_RATING_LABELS,
  PERFORMANCE_RATING_COLORS,
  TREND_INDICATOR_LABELS,
  HEALTH_INDICATOR_COLORS,
  TrendIndicator,
  HealthIndicator,
} from '../../constants/aggregation.constants';

// ----------------------------------------------------------------------------
// Props
// ----------------------------------------------------------------------------

interface PerformanceOverviewProps {
  aggregation: AggregatedPerformance;
  loading?: boolean;
  onRefresh?: () => void;
  showDetails?: boolean;
}

// ----------------------------------------------------------------------------
// Score Gauge Component
// ----------------------------------------------------------------------------

interface ScoreGaugeProps {
  score: number;
  label: string;
  size?: 'small' | 'medium' | 'large';
}

const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score, label, size = 'medium' }) => {
  const dimensions = {
    small: { width: 80, height: 80, fontSize: '1.25rem' },
    medium: { width: 100, height: 100, fontSize: '1.5rem' },
    large: { width: 140, height: 140, fontSize: '2rem' },
  };

  const { width, height, fontSize } = dimensions[size];
  const radius = (width - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  const getScoreColor = (s: number): string => {
    if (s >= 90) return PERFORMANCE_RATING_COLORS.exceptional;
    if (s >= 80) return PERFORMANCE_RATING_COLORS.strong;
    if (s >= 60) return PERFORMANCE_RATING_COLORS.on_track;
    if (s >= 40) return PERFORMANCE_RATING_COLORS.needs_attention;
    if (s >= 20) return PERFORMANCE_RATING_COLORS.at_risk;
    return PERFORMANCE_RATING_COLORS.critical;
  };

  return (
    <Box sx={{ textAlign: 'center' }}>
      <Box sx={{ position: 'relative', display: 'inline-block', width, height }}>
        <svg width={width} height={height}>
          <circle
            cx={width / 2}
            cy={height / 2}
            r={radius}
            fill="none"
            stroke="#e0e0e0"
            strokeWidth="8"
          />
          <circle
            cx={width / 2}
            cy={height / 2}
            r={radius}
            fill="none"
            stroke={getScoreColor(score)}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            transform={`rotate(-90 ${width / 2} ${height / 2})`}
          />
        </svg>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <Typography variant="h6" sx={{ fontSize, fontWeight: 'bold' }}>
            {score.toFixed(0)}
          </Typography>
        </Box>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {label}
      </Typography>
    </Box>
  );
};

// ----------------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------------

export const PerformanceOverview: React.FC<PerformanceOverviewProps> = ({
  aggregation,
  loading = false,
  onRefresh,
  showDetails = true,
}) => {
  const getTrendIcon = (trend: TrendIndicator) => {
    switch (trend) {
      case 'strong_up':
      case 'up':
        return <TrendingUpIcon color="success" />;
      case 'strong_down':
      case 'down':
        return <TrendingDownIcon color="error" />;
      default:
        return <TrendingFlatIcon color="action" />;
    }
  };

  const getHealthIcon = (health: HealthIndicator) => {
    switch (health) {
      case 'healthy':
        return <HealthyIcon sx={{ color: HEALTH_INDICATOR_COLORS.healthy }} />;
      case 'warning':
        return <WarningIcon sx={{ color: HEALTH_INDICATOR_COLORS.warning }} />;
      case 'critical':
        return <CriticalIcon sx={{ color: HEALTH_INDICATOR_COLORS.critical }} />;
      default:
        return <NoDataIcon sx={{ color: HEALTH_INDICATOR_COLORS.no_data }} />;
    }
  };

  return (
    <Card elevation={2}>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h5" fontWeight="bold">
              {aggregation.entityName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              FY{aggregation.fiscalYear} {aggregation.quarter ? `Q${aggregation.quarter}` : 'Full Year'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title={TREND_INDICATOR_LABELS[aggregation.trend]}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {getTrendIcon(aggregation.trend)}
                {aggregation.scoreChangePercent !== undefined && (
                  <Typography
                    variant="body2"
                    color={aggregation.scoreChangePercent >= 0 ? 'success.main' : 'error.main'}
                    sx={{ ml: 0.5 }}
                  >
                    {aggregation.scoreChangePercent >= 0 ? '+' : ''}
                    {aggregation.scoreChangePercent.toFixed(1)}%
                  </Typography>
                )}
              </Box>
            </Tooltip>
            <Chip
              label={PERFORMANCE_RATING_LABELS[aggregation.rating]}
              size="small"
              sx={{
                bgcolor: PERFORMANCE_RATING_COLORS[aggregation.rating],
                color: 'white',
                fontWeight: 'bold',
              }}
            />
            {onRefresh && (
              <IconButton onClick={onRefresh} disabled={loading} size="small">
                <RefreshIcon />
              </IconButton>
            )}
          </Box>
        </Box>

        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {/* Main Score */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
          <ScoreGauge score={aggregation.combinedScore} label="Overall Score" size="large" />
        </Box>

        {/* Domain Scores */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid {...{ item: true, xs: 4 } as any}>
            <ScoreGauge score={aggregation.strategyScore} label="Strategy" />
          </Grid>
          <Grid {...{ item: true, xs: 4 } as any}>
            <ScoreGauge score={aggregation.okrScore} label="OKRs" />
          </Grid>
          <Grid {...{ item: true, xs: 4 } as any}>
            <ScoreGauge score={aggregation.kpiScore} label="KPIs" />
          </Grid>
        </Grid>

        {/* Health Summary */}
        {showDetails && (
          <>
            <Divider sx={{ my: 2 }} />

            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                {getHealthIcon(aggregation.health.overall)}
                <Typography variant="subtitle2">Health Status</Typography>
              </Box>

              <Grid container spacing={2}>
                <Grid {...{ item: true, xs: 3 } as any}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" color="success.main">
                      {aggregation.health.healthyItems}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Healthy
                    </Typography>
                  </Box>
                </Grid>
                <Grid {...{ item: true, xs: 3 } as any}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" color="warning.main">
                      {aggregation.health.warningIssues}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Warnings
                    </Typography>
                  </Box>
                </Grid>
                <Grid {...{ item: true, xs: 3 } as any}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" color="error.main">
                      {aggregation.health.criticalIssues}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Critical
                    </Typography>
                  </Box>
                </Grid>
                <Grid {...{ item: true, xs: 3 } as any}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" color="text.disabled">
                      {aggregation.health.noDataItems}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      No Data
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>

            {/* Item Counts */}
            <Box sx={{ display: 'flex', justifyContent: 'space-around', mt: 2 }}>
              <Tooltip title="Strategic Plans">
                <Chip label={`${aggregation.strategyCount} Plans`} size="small" variant="outlined" />
              </Tooltip>
              <Tooltip title="Objectives">
                <Chip label={`${aggregation.okrCount} OKRs`} size="small" variant="outlined" />
              </Tooltip>
              <Tooltip title="Key Performance Indicators">
                <Chip label={`${aggregation.kpiCount} KPIs`} size="small" variant="outlined" />
              </Tooltip>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PerformanceOverview;
