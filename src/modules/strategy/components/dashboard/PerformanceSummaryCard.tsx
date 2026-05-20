// ============================================================================
// PerformanceSummaryCard COMPONENT
// DawinOS v2.0 - CEO Strategy Command Module
// Compact performance summary for dashboard display
// ============================================================================

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActionArea,
  Typography,
  LinearProgress,
  Chip,
  Skeleton,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import {
  PerformanceRating,
  TrendIndicator,
  PERFORMANCE_RATING_COLORS,
  PERFORMANCE_RATING_LABELS,
} from '../../constants/aggregation.constants';

interface PerformanceSummaryCardProps {
  title: string;
  score: number;
  rating: PerformanceRating;
  trend: TrendIndicator;
  changePercent?: number;
  subtitle?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  loading?: boolean;
}

export const PerformanceSummaryCard: React.FC<PerformanceSummaryCardProps> = ({
  title,
  score,
  rating,
  trend,
  changePercent,
  subtitle,
  icon,
  onClick,
  loading = false,
}) => {
  const getTrendIcon = () => {
    switch (trend) {
      case 'strong_up':
      case 'up':
        return <TrendingUpIcon fontSize="small" color="success" />;
      case 'strong_down':
      case 'down':
        return <TrendingDownIcon fontSize="small" color="error" />;
      default:
        return <TrendingFlatIcon fontSize="small" color="action" />;
    }
  };
  
  const getTrendColor = () => {
    if (trend === 'strong_up' || trend === 'up') return 'success.main';
    if (trend === 'strong_down' || trend === 'down') return 'error.main';
    return 'text.secondary';
  };
  
  if (loading) {
    return (
      <Card>
        <CardContent>
          <Skeleton variant="text" width="60%" height={24} />
          <Skeleton variant="text" width="40%" height={48} sx={{ my: 1 }} />
          <Skeleton variant="rectangular" height={8} />
          <Skeleton variant="text" width="80%" height={20} sx={{ mt: 1 }} />
        </CardContent>
      </Card>
    );
  }
  
  const content = (
    <CardContent>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {icon && (
            <Box sx={{ color: 'primary.main' }}>
              {icon}
            </Box>
          )}
          <Typography variant="subtitle2" color="text.secondary">
            {title}
          </Typography>
        </Box>
        {onClick && <ArrowIcon fontSize="small" color="action" />}
      </Box>
      
      {/* Score */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
        <Typography variant="h3" fontWeight="bold" color={PERFORMANCE_RATING_COLORS[rating]}>
          {score.toFixed(0)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          / 100
        </Typography>
      </Box>
      
      {/* Progress Bar */}
      <LinearProgress
        variant="determinate"
        value={score}
        sx={{
          height: 8,
          borderRadius: 4,
          bgcolor: 'grey.200',
          mb: 1.5,
          '& .MuiLinearProgress-bar': {
            borderRadius: 4,
            bgcolor: PERFORMANCE_RATING_COLORS[rating],
          },
        }}
      />
      
      {/* Footer */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Chip
          label={PERFORMANCE_RATING_LABELS[rating]}
          size="small"
          sx={{
            bgcolor: `${PERFORMANCE_RATING_COLORS[rating]}20`,
            color: PERFORMANCE_RATING_COLORS[rating],
            fontWeight: 'bold',
            fontSize: '0.7rem',
          }}
        />
        
        {changePercent !== undefined && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {getTrendIcon()}
            <Typography variant="body2" color={getTrendColor()} fontWeight="medium">
              {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}%
            </Typography>
          </Box>
        )}
      </Box>
      
      {subtitle && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {subtitle}
        </Typography>
      )}
    </CardContent>
  );
  
  if (onClick) {
    return (
      <Card>
        <CardActionArea onClick={onClick}>
          {content}
        </CardActionArea>
      </Card>
    );
  }
  
  return <Card>{content}</Card>;
};

export default PerformanceSummaryCard;
