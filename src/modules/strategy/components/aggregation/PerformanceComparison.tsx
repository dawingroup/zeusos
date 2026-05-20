// ============================================================================
// PerformanceComparison COMPONENT
// DawinOS v2.0 - CEO Strategy Command Module
// Side-by-side comparison of entity performance
// ============================================================================

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Avatar,
  Tooltip,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  EmojiEvents as TrophyIcon,
} from '@mui/icons-material';
import {
  PerformanceComparison as PerformanceComparisonType,
} from '../../types/aggregation.types';
import {
  PERFORMANCE_RATING_COLORS,
  PERFORMANCE_RATING_LABELS,
  PERFORMANCE_DOMAIN_LABELS,
  AGGREGATION_LEVEL_LABELS,
  TrendIndicator,
} from '../../constants/aggregation.constants';

// ----------------------------------------------------------------------------
// Props
// ----------------------------------------------------------------------------

interface PerformanceComparisonProps {
  comparison: PerformanceComparisonType;
  showStatistics?: boolean;
}

// ----------------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------------

export const PerformanceComparison: React.FC<PerformanceComparisonProps> = ({
  comparison,
  showStatistics = true,
}) => {
  const getTrendIcon = (trend: TrendIndicator) => {
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

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <Avatar sx={{ width: 24, height: 24, bgcolor: 'gold' }}>
          <TrophyIcon sx={{ fontSize: 14 }} />
        </Avatar>
      );
    }
    if (rank === 2) {
      return (
        <Avatar sx={{ width: 24, height: 24, bgcolor: 'silver' }}>
          <Typography variant="caption" fontWeight="bold">2</Typography>
        </Avatar>
      );
    }
    if (rank === 3) {
      return (
        <Avatar sx={{ width: 24, height: 24, bgcolor: '#CD7F32' }}>
          <Typography variant="caption" fontWeight="bold">3</Typography>
        </Avatar>
      );
    }
    return (
      <Avatar sx={{ width: 24, height: 24, bgcolor: 'grey.300' }}>
        <Typography variant="caption">{rank}</Typography>
      </Avatar>
    );
  };

  return (
    <Card elevation={2}>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight="bold">
              Performance Comparison
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {PERFORMANCE_DOMAIN_LABELS[comparison.domain]} • FY{comparison.period.fiscalYear}
              {comparison.period.quarter && ` Q${comparison.period.quarter}`}
            </Typography>
          </Box>
          <Chip
            label={`${comparison.entities.length} Entities`}
            size="small"
            variant="outlined"
          />
        </Box>

        {/* Statistics Summary */}
        {showStatistics && (
          <Box
            sx={{
              display: 'flex',
              gap: 3,
              mb: 3,
              p: 2,
              bgcolor: 'grey.50',
              borderRadius: 1,
            }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" fontWeight="bold" color="primary">
                {comparison.average.toFixed(1)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Average
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" fontWeight="bold">
                {comparison.median.toFixed(1)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Median
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" fontWeight="bold" color="text.secondary">
                ±{comparison.standardDeviation.toFixed(1)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Std Dev
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }} />
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2" color="success.main" fontWeight="bold">
                Top: {comparison.topPerformer}
              </Typography>
              <Typography variant="body2" color="error.main">
                Bottom: {comparison.bottomPerformer}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Comparison Table */}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width={50}>Rank</TableCell>
                <TableCell>Entity</TableCell>
                <TableCell>Level</TableCell>
                <TableCell align="center">Score</TableCell>
                <TableCell align="center">Rating</TableCell>
                <TableCell align="center">Trend</TableCell>
                <TableCell align="right">Percentile</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {comparison.entities.map((entity) => (
                <TableRow
                  key={entity.entityId}
                  sx={{
                    bgcolor: entity.rank === 1 ? 'success.light' :
                             entity.rank === comparison.entities.length ? 'error.light' :
                             'transparent',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <TableCell>
                    {getRankBadge(entity.rank)}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {entity.entityName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {AGGREGATION_LEVEL_LABELS[entity.level]}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body2" fontWeight="bold">
                      {entity.score.toFixed(1)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={PERFORMANCE_RATING_LABELS[entity.rating]}
                      size="small"
                      sx={{
                        bgcolor: PERFORMANCE_RATING_COLORS[entity.rating],
                        color: 'white',
                        fontSize: '0.7rem',
                      }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title={entity.trend}>
                      {getTrendIcon(entity.trend)}
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" color="text.secondary">
                      {entity.percentile.toFixed(0)}%
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
};

export default PerformanceComparison;
